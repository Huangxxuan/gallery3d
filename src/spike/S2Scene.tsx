import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, PointerLockControls } from '@react-three/drei'
import { useEffect, useRef, useState } from 'react'
import type {
  OrbitControls as OrbitControlsImpl,
  PointerLockControls as PLImpl,
} from 'three-stdlib'
import * as THREE from 'three'
import { deriveOrbitPose, deriveWalkPose } from './poses'

type Mode = 'orbit' | 'walk'
const FADE_MS = 300

type SharedRig = {
  camera: THREE.Camera | null
  orbit: OrbitControlsImpl | null
  pl: PLImpl | null
}

/** 漫游简易 WASD（S2 不含碰撞，G1 接入 B3） */
function WalkController({ active }: { active: boolean }) {
  const camera = useThree((s) => s.camera)
  const keys = useRef<Record<string, boolean>>({})
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keys.current[e.code] = true
    }
    const up = (e: KeyboardEvent) => {
      keys.current[e.code] = false
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])
  useFrame((_, dt) => {
    if (!active) return
    const k = keys.current
    let f = 0
    let r = 0
    if (k['KeyW']) f += 1
    if (k['KeyS']) f -= 1
    if (k['KeyD']) r += 1
    if (k['KeyA']) r -= 1
    if (!f && !r) return
    const speed = (k['ShiftLeft'] ? 6 : 3) * Math.min(dt, 0.05)
    const dir = new THREE.Vector3()
    camera.getWorldDirection(dir)
    dir.y = 0
    dir.normalize()
    const right = new THREE.Vector3().crossVectors(dir, camera.up).normalize()
    camera.position.addScaledVector(dir, f * speed).addScaledVector(right, r * speed)
    camera.position.y = 1.6
  })
  return null
}

function Room() {
  const panels: [number, number, number, number][] = [
    [-2.2, 1.8, -4.96, 0],
    [0, 1.8, -4.96, 0],
    [2.2, 1.8, -4.96, 0],
    [5.96, 1.8, -1.5, Math.PI / 2],
    [-5.96, 1.8, -1.5, -Math.PI / 2],
  ]
  return (
    <group>
      {[
        { p: [0, 2, -5] as const, s: [12, 4, 0.2] as const },
        { p: [0, 2, 5] as const, s: [12, 4, 0.2] as const },
        { p: [-6, 2, 0] as const, s: [0.2, 4, 10] as const },
        { p: [6, 2, 0] as const, s: [0.2, 4, 10] as const },
      ].map((w, i) => (
        <mesh key={i} position={[...w.p]}>
          <boxGeometry args={[...w.s]} />
          <meshStandardMaterial color="#161514" roughness={0.98} />
        </mesh>
      ))}
      <mesh rotation-x={-Math.PI / 2}>
        <planeGeometry args={[12, 10]} />
        <meshStandardMaterial color="#232221" roughness={0.4} metalness={0.05} />
      </mesh>
      <mesh position={[0, 4, 0]} rotation-x={Math.PI / 2}>
        <planeGeometry args={[12, 10]} />
        <meshStandardMaterial color="#10100f" roughness={1} />
      </mesh>
      {panels.map(([x, y, z, rot], i) => (
        <mesh key={i} position={[x, y, z]} rotation-y={rot}>
          <planeGeometry args={[1.04, 1.44]} />
          <meshStandardMaterial color={['#6b7a8f', '#8f6b6b', '#7a8f6b', '#8f8a6b', '#6b8f8a'][i]} />
        </mesh>
      ))}
    </group>
  )
}

function Rig({
  shared,
  mode,
  onLock,
  onUnlock,
}: {
  shared: React.MutableRefObject<SharedRig>
  mode: Mode
  onLock: () => void
  onUnlock: () => void
}) {
  const camera = useThree((s) => s.camera)
  useEffect(() => {
    shared.current.camera = camera
  }, [camera, shared])
  return (
    <>
      <Room />
      <WalkController active={mode === 'walk'} />
      <OrbitControls ref={(r) => { shared.current.orbit = r }} makeDefault target={[0, 1.5, -2]} />
      <PointerLockControls ref={(r) => { shared.current.pl = r }} onLock={onLock} onUnlock={onUnlock} />
    </>
  )
}

export default function S2Scene() {
  const shared = useRef<SharedRig>({ camera: null, orbit: null, pl: null })
  const [mode, setMode] = useState<Mode>('orbit')
  const [locked, setLocked] = useState(false)
  const [fade, setFade] = useState(false)
  const [instant, setInstant] = useState(false) // 瞬黑（无过渡），用于 lock 同帧遮罩
  const [error, setError] = useState(false)
  const [entries, setEntries] = useState(0)

  // Spike 修正：lock() 必须在用户手势同步栈内（setTimeout 会被判 "user gesture required"）
  const requestLock = () => {
    const p = shared.current.pl?.lock() as unknown as Promise<void> | undefined
    p?.catch?.(() => {
      setError(true)
      setInstant(false)
      setFade(false)
    })
  }

  const enterWalk = () => {
    setError(false)
    setInstant(true)
    setFade(true) // 同步瞬黑，机位切换藏在不透明黑幕后
    const cam = shared.current.camera
    const t = shared.current.orbit?.target ?? new THREE.Vector3(0, 1.5, -2)
    if (cam) {
      const { pos, lookAt } = deriveWalkPose(
        { x: cam.position.x, y: cam.position.y, z: cam.position.z },
        { x: t.x, y: t.y, z: t.z },
      )
      cam.position.set(pos.x, pos.y, pos.z)
      cam.lookAt(lookAt.x, lookAt.y, lookAt.z)
    }
    if (shared.current.orbit) shared.current.orbit.enabled = false
    setMode('walk')
    requestLock() // 同一次点击手势内调用
  }

  const backToOrbit = () => {
    setFade(true)
    window.setTimeout(() => {
      const cam = shared.current.camera
      if (cam) {
        const d = new THREE.Vector3()
        cam.getWorldDirection(d)
        const { pos, target } = deriveOrbitPose(
          { x: cam.position.x, y: cam.position.y, z: cam.position.z },
          { x: d.x, z: d.z },
        )
        cam.position.set(pos.x, pos.y, pos.z)
        const o = shared.current.orbit
        if (o) {
          o.target.set(target.x, target.y, target.z)
          o.enabled = true
          o.update()
        }
      }
      setMode('orbit')
      window.setTimeout(() => setFade(false), 120)
    }, FADE_MS)
  }

  const relock = () => {
    setError(false)
    setInstant(true)
    setFade(true)
    requestLock()
  }

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Canvas shadows camera={{ position: [4, 3.2, 5], fov: 60 }}>
        <color attach="background" args={['#0e0e10']} />
        <ambientLight intensity={0.18} />
        <directionalLight position={[3, 6, 4]} intensity={0.4} />
        <Rig
          shared={shared}
          mode={mode}
          onLock={() => {
            setLocked(true)
            setError(false)
            setEntries((n) => n + 1)
            // 两帧：先恢复 transition（opacity 仍1），下一帧再降 opacity，浏览器才会跑淡出
            setInstant(false)
            requestAnimationFrame(() => requestAnimationFrame(() => setFade(false)))
          }}
          onUnlock={() => setLocked(false)}
        />
      </Canvas>

      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: '#000',
          opacity: fade ? 1 : 0,
          transition: instant ? 'none' : `opacity ${FADE_MS}ms ease`,
          pointerEvents: 'none',
          zIndex: 20,
        }}
      />

      <div
        style={{
          position: 'absolute',
          top: 76,
          left: 20,
          fontSize: 13,
          lineHeight: 1.7,
          color: '#94a3b8',
          background: 'rgba(14,14,16,0.72)',
          padding: '10px 14px',
          borderRadius: 8,
          zIndex: 10,
        }}
      >
        <b style={{ color: '#fafafa' }}>S2 双相机互切</b>
        <br />
        模式：{mode === 'orbit' ? '编辑(Orbit鸟瞰)' : '漫游(PointerLock)'} ｜ 成功切入：{entries} 次
        <br />
        漫游：WASD 移动 / Shift 加速 / Esc 暂停
      </div>

      {mode === 'orbit' && (
        <button onClick={enterWalk} style={btnStyle}>
          进入漫游（300ms 黑场）
        </button>
      )}

      {mode === 'walk' && !locked && (
        <div style={overlayStyle}>
          <div style={{ color: '#fafafa', fontSize: 15, marginBottom: 14 }}>
            {error ? '浏览器拒绝锁定，点击重试' : '漫游已暂停（Esc）'}
          </div>
          <button onClick={relock} style={{ ...btnStyle, position: 'static', transform: 'none', marginRight: 10 }}>
            点击继续
          </button>
          <button
            onClick={backToOrbit}
            style={{ ...btnStyle, position: 'static', transform: 'none', background: '#2a2a2e', borderColor: '#555' }}
          >
            返回编辑
          </button>
        </div>
      )}
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 28,
  left: '50%',
  transform: 'translateX(-50%)',
  padding: '10px 22px',
  fontSize: 14,
  borderRadius: 8,
  border: '1px solid #C9A876',
  background: '#1D1D20',
  color: '#fafafa',
  cursor: 'pointer',
  zIndex: 30,
}

const overlayStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'rgba(0,0,0,0.72)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 25,
}
