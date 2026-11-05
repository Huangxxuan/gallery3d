import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import { SPAWN, SPACES, spotPose } from '../domain/gallery'
import { NEUTRAL, THEMES } from '../domain/themes'
import GalleryWorld from './GalleryWorld'
import Artworks from './Artworks'
import Player from './Player'
import HUD from '../ui/HUD'
import { loadPlacements } from './placements'
import { useUI } from '../state/player'

/**
 * 白盒美术馆真光源预算 ≤12（v3 当前 8 + focus 射灯 1 = 9）：
 * 白环境光 + 中性半球光 + 4 厅各 1 盏中性白顶光（主题色交由灯带/导视牌点睛）+ 入/出口 2 盏。
 * 大面亮度由发光天棚承担，真光源只负责墙面渐变与体积感。
 */
function BaseLights() {
  const white = useMemo(() => new THREE.Color('#ffffff'), [])
  return (
    <>
      <ambientLight intensity={0.85} color="#ffffff" />
      <hemisphereLight args={['#ffffff', '#b3b1ac', 0.5]} />
      {SPACES.filter((s) => s.kind !== 'corridor').map((s) => {
        const cx = (s.x0 + s.x1) / 2
        const cz = (s.z0 + s.z1) / 2
        const isHall = s.kind === 'hall'
        const isEntry = s.id === 'ENTRY'
        const col = isEntry
          ? new THREE.Color('#cfe6ff')
          : isHall
            ? white.clone().lerp(new THREE.Color(THEMES[s.id]?.accent ?? NEUTRAL.accent), 0.1)
            : new THREE.Color('#ffffff')
        return (
          <pointLight
            key={s.id}
            // 入口厅点光上移 4.45 + 强度 1.6（v16）：光源远离墙面掠射角，消除墙面纯白硬高光斑
            position={[cx, isEntry ? 4.45 : isHall ? 4.6 : 3.7, cz]}
            intensity={isEntry ? 1.6 : isHall ? 2.6 : 3.2}
            distance={isHall ? 26 : 12}
            decay={1.6}
            color={col}
          />
        )
      })}
    </>
  )
}

const PERF = new URLSearchParams(window.location.search).get('quality') === 'perf'

/** focus 动态真射灯（第 9 盏）：复用布展 spotPose 轨道位，进大图时向画心平滑点亮光池 */
function FocusSpot() {
  const focusIndex = useUI((s) => s.focusIndex)
  const light = useRef<THREE.SpotLight>(null)
  const tgt = useMemo(() => new THREE.Object3D(), [])
  const head = useRef(new THREE.Vector3())
  const want = useRef(new THREE.Vector3())
  useEffect(() => {
    if (focusIndex === null) return
    let alive = true
    loadPlacements().then((list) => {
      if (!alive) return
      const p = list[focusIndex]
      if (!p) return
      const s = spotPose(p.hall, p.slot)
      tgt.position.set(s.target.x, s.target.y, s.target.z)
      want.current.set(s.pos.x, s.pos.y, s.pos.z)
      if (head.current.lengthSq() === 0) head.current.copy(want.current)
    })
    return () => {
      alive = false
    }
  }, [focusIndex, tgt])
  useFrame((_, dt) => {
    const l = light.current
    if (!l) return
    const k = Math.min(1, dt * 6)
    l.intensity += ((focusIndex !== null ? 35 : 0) - l.intensity) * k
    head.current.lerp(want.current, k)
    l.position.copy(head.current)
  })
  return (
    <>
      <primitive object={tgt} />
      <spotLight ref={light} target={tgt} angle={0.5} penumbra={0.55} decay={1.4} distance={16} intensity={0} color="#fff6e6" />
    </>
  )
}

/** focus 画质联动：dpr 解封 min(dpr,2)（大图清晰度）+ 曝光渐变 1.15；退出恢复 perf 档与 1.0 */
function FocusQuality() {
  const focusIndex = useUI((s) => s.focusIndex)
  const setDpr = useThree((s) => s.setDpr)
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    const dpr = window.devicePixelRatio || 1
    setDpr(focusIndex !== null ? Math.min(dpr, 2) : PERF ? 1 : Math.min(dpr, 1.5))
  }, [focusIndex, setDpr])
  useFrame((_, dt) => {
    const t = focusIndex !== null ? 1.15 : 1.0
    gl.toneMappingExposure += (t - gl.toneMappingExposure) * Math.min(1, dt * 5)
  })
  return null
}

/** 发热对策：标签页隐藏时停止渲染循环，回前台恢复 */
function FrameloopGuard() {
  const setFrameloop = useThree((s) => s.setFrameloop)
  useEffect(() => {
    const onVis = () => setFrameloop(document.hidden ? 'never' : 'always')
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [setFrameloop])
  return null
}

export default function GalleryScene() {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#dcdad6' }}>
      <Canvas
        camera={{ fov: 66, near: 0.05, far: 120, position: [SPAWN.x, SPAWN.y, SPAWN.z] }}
        dpr={PERF ? 1 : Math.min(window.devicePixelRatio || 1, 1.5)}
        gl={{
          antialias: !PERF,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.0,
        }}
        onCreated={({ gl, scene, camera }) => {
          gl.setClearColor('#e4e2de')
          // QA 调试探针：__glScene / __glRenderer 供浏览器侧检查材质与渲染器状态
          ;(window as unknown as Record<string, unknown>).__glScene = scene
          ;(window as unknown as Record<string, unknown>).__glRenderer = gl
          ;(window as unknown as Record<string, unknown>).__glCamera = camera
        }}
      >
        <Suspense fallback={null}>
          <BaseLights />
          <GalleryWorld />
          <Artworks />
          <FocusSpot />
        </Suspense>
        <Player />
        <FocusQuality />
        <FrameloopGuard />
        {/* Bloom 只咬 >0.92 的发光面片（灯带/厅号/光环），天棚面板压在阈值下不炸；perf 档整体关闭 */}
        {!PERF && (
          <EffectComposer multisampling={4}>
            <Bloom mipmapBlur intensity={0.3} luminanceThreshold={0.92} luminanceSmoothing={0.2} />
            <Vignette eskil={false} offset={0.3} darkness={0.35} />
          </EffectComposer>
        )}
      </Canvas>
      <HUD />
    </div>
  )
}
