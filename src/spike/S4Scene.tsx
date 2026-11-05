import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import {
  detectCrossing,
  HALL_CHAIN,
  textureBudget,
  zoneFor,
  type HallId,
  type ZoneState,
} from './zoning'

const HALL_LEN = 10
const HALL_W = 8
const HALL_H = 4
const GAP = 2
const CENTER_X = [0, HALL_LEN + GAP, 2 * (HALL_LEN + GAP), 3 * (HALL_LEN + GAP)]
const PER_HALL = 44 // 模拟满载（176 张）
const FULL_BYTES = 2048 * 2048 * 4
const THUMB_BYTES = 320 * 320 * 4

const HALL_TINT = ['#3d4a6b', '#6b3d4a', '#4a6b3d', '#6b5d3d']

function HallShell({
  index,
  zone,
}: {
  index: number
  zone: ZoneState
}) {
  const cx = CENTER_X[index]
  const wallColor = zone === 'frozen' ? '#0c0c0d' : '#161514'
  // 端墙留 1.6m 门洞（z -0.8..0.8）
  const endWallSegs = [
    { z: -2.8, len: 2.4 },
    { z: 2.8, len: 2.4 },
  ]
  const panels: number[] = [-3, -1.8, -0.6, 0.6, 1.8, 3]
  return (
    <group position={[cx, 0, 0]}>
      {/* 两侧墙 */}
      {[1, -1].map((s) => (
        <mesh key={s} position={[0, HALL_H / 2, (s * HALL_W) / 2]}>
          <boxGeometry args={[HALL_LEN, HALL_H, 0.2]} />
          <meshStandardMaterial color={wallColor} roughness={0.98} />
        </mesh>
      ))}
      {/* 端墙分段（中间门洞） */}
      {[-1, 1].map((s) =>
        endWallSegs.map((seg, i) => (
          <mesh key={`${s}-${i}`} position={[(s * HALL_LEN) / 2, HALL_H / 2, seg.z]}>
            <boxGeometry args={[0.2, HALL_H, seg.len]} />
            <meshStandardMaterial color={wallColor} roughness={0.98} />
          </mesh>
        )),
      )}
      {/* 地/顶 */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]}>
        <planeGeometry args={[HALL_LEN, HALL_W]} />
        <meshStandardMaterial color={zone === 'frozen' ? '#141313' : '#232221'} roughness={0.5} />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position={[0, HALL_H, 0]}>
        <planeGeometry args={[HALL_LEN, HALL_W]} />
        <meshStandardMaterial color="#10100f" />
      </mesh>
      {/* 两侧各 6 幅，共 12 个代理（视觉样本；实际 44 个挂位含前后墙） */}
      {panels.map((z, i) =>
        [1, -1].map((s) => {
          const color =
            zone === 'active' ? HALL_TINT[index] : zone === 'adjacent' ? '#4a4a52' : '#18181c'
          return (
            <mesh
              key={`${z}-${s}`}
              position={[((i % 3) - 1) * 2.6, 1.6, (s * (HALL_W / 2 - 0.12))]}
              rotation-y={s > 0 ? -Math.PI / 2 : Math.PI / 2}
            >
              <planeGeometry args={[0.9, 1.2]} />
              <meshStandardMaterial
                color={color}
                emissive={zone === 'active' ? color : '#000000'}
                emissiveIntensity={zone === 'active' ? 0.25 : 0}
                roughness={0.85}
              />
            </mesh>
          )
        }),
      )}
      {/* active 厅补光，模拟全质+射灯；其余厅仅环境微光 */}
      {zone === 'active' && <pointLight position={[0, 3.2, 0]} intensity={8} distance={12} decay={2} color="#ffd9a0" />}
      {/* 编号 */}
      <mesh position={[0, 3.4, -HALL_W / 2 + 0.12]}>
        <planeGeometry args={[1.2, 0.5]} />
        <meshBasicMaterial color={zone === 'frozen' ? '#1a1a1e' : '#2a2a30'} />
      </mesh>
    </group>
  )
}

function Corridor({ x }: { x: number }) {
  return (
    <group position={[x, 0, 0]}>
      <mesh rotation-x={-Math.PI / 2}>
        <planeGeometry args={[GAP, 1.6]} />
        <meshStandardMaterial color="#1a1918" roughness={0.6} />
      </mesh>
      {[1, -1].map((s) => (
        <mesh key={s} position={[0, 1.6, s * 0.9]}>
          <boxGeometry args={[GAP, 3.2, 0.15]} />
          <meshStandardMaterial color="#0f0f0e" roughness={1} />
        </mesh>
      ))}
    </group>
  )
}

function Rig({
  shared,
}: {
  shared: React.MutableRefObject<{ camera: THREE.Camera | null; orbit: OrbitControlsImpl | null }>
}) {
  const camera = useThree((s) => s.camera)
  useEffect(() => {
    shared.current.camera = camera
  }, [camera, shared])
  return (
    <OrbitControls
      ref={(r) => {
        shared.current.orbit = r
      }}
      makeDefault
      target={[0, 1.6, 0]}
      maxPolarAngle={Math.PI / 2 - 0.05}
    />
  )
}

export default function S4Scene() {
  const shared = useRef<{ camera: THREE.Camera | null; orbit: OrbitControlsImpl | null }>({
    camera: null,
    orbit: null,
  })
  const [active, setActive] = useState<HallId>('h1')
  const [fade, setFade] = useState(false)
  const [auto, setAuto] = useState(false)
  const halls = useMemo(() => HALL_CHAIN.map((id) => ({ id, count: PER_HALL })), [])

  const budget = textureBudget(active, halls, { full: FULL_BYTES, thumb: THUMB_BYTES })
  const budgetMB = budget / 1024 / 1024

  const go = (id: HallId) => {
    const prev = active
    if (prev === id) return
    setFade(true)
    window.setTimeout(() => {
      const idx = HALL_CHAIN.indexOf(id)
      const cam = shared.current.camera
      cam?.position.set(CENTER_X[idx], 1.6, 2.6)
      shared.current.orbit?.target.set(CENTER_X[idx], 1.6, 0)
      shared.current.orbit?.update()
      setActive(id)
      if (detectCrossing(prev, id)) {
        window.setTimeout(() => setFade(false), 120)
      } else {
        setFade(false)
      }
    }, 280)
  }

  useEffect(() => {
    if (!auto) return
    const t = window.setInterval(() => {
      setActive((cur) => {
        const i = HALL_CHAIN.indexOf(cur)
        const next = HALL_CHAIN[(i + 1) % HALL_CHAIN.length]
        setFade(true)
        window.setTimeout(() => {
          const ni = HALL_CHAIN.indexOf(next)
          const cam = shared.current.camera
          cam?.position.set(CENTER_X[ni], 1.6, 2.6)
          shared.current.orbit?.target.set(CENTER_X[ni], 1.6, 0)
          shared.current.orbit?.update()
          window.setTimeout(() => setFade(false), 120)
        }, 280)
        return next
      })
    }, 2600)
    return () => window.clearInterval(t)
  }, [auto])

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Canvas shadows={false} camera={{ position: [0, 1.6, 2.6], fov: 62 }}>
        <color attach="background" args={['#08080a']} />
        <ambientLight intensity={0.1} />
        {HALL_CHAIN.map((id, i) => (
          <HallShell key={id} index={i} zone={zoneFor(active, id)} />
        ))}
        {[HALL_LEN / 2 + GAP / 2, CENTER_X[2] - HALL_LEN / 2 - GAP / 2, CENTER_X[3] - HALL_LEN / 2 - GAP / 2].map(
          (x, i) => (
            <Corridor key={i} x={x} />
          ),
        )}
        <Rig shared={shared} />
      </Canvas>

      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: '#000',
          opacity: fade ? 1 : 0,
          transition: 'opacity 280ms ease',
          pointerEvents: 'none',
          zIndex: 20,
        }}
      />

      <div style={panelStyle}>
        <b style={{ color: '#fafafa' }}>S4 四厅分区加载</b>
        <div style={{ marginTop: 8, lineHeight: 1.8 }}>
          {HALL_CHAIN.map((id) => {
            const z = zoneFor(active, id)
            return (
              <div key={id} style={{ color: z === 'active' ? '#C9A876' : z === 'adjacent' ? '#94a3b8' : '#55555f' }}>
                {id}：{z === 'active' ? '当前厅·全质+阴影' : z === 'adjacent' ? '邻厅·320缩略' : '远厅·冻结(纹理释放)'}
              </div>
            )
          })}
        </div>
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #2E2E33', lineHeight: 1.7 }}>
          模拟挂载：4厅×{PER_HALL}=176 幅
          <br />
          纹理驻留预算：<b style={{ color: '#7ddf8a' }}>{budgetMB.toFixed(1)} MB</b>
          <br />
          （176幅全质需 {(176 * FULL_BYTES) / 1024 / 1024 / 1024 >= 1 ? `${((176 * FULL_BYTES) / 1024 / 1024 / 1024).toFixed(2)} GB` : '0'}）
          <br />
          shadow 投射灯：{PER_HALL} 盏（仅当前厅）
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 8, zIndex: 10 }}>
        {HALL_CHAIN.map((id) => (
          <button key={id} onClick={() => go(id)} style={btn(active === id)}>
            {id}
          </button>
        ))}
        <button onClick={() => setAuto((a) => !a)} style={{ ...btn(false), borderColor: auto ? '#7ddf8a' : '#555' }}>
          {auto ? '停止巡游' : '自动巡游'}
        </button>
      </div>
    </div>
  )
}

const btn = (on: boolean): React.CSSProperties => ({
  padding: '8px 18px',
  fontSize: 13,
  borderRadius: 8,
  border: '1px solid',
  borderColor: on ? '#C9A876' : '#3a3a40',
  background: on ? '#1D1D20' : '#161618',
  color: '#fafafa',
  cursor: 'pointer',
})

const panelStyle: React.CSSProperties = {
  position: 'absolute',
  top: 76,
  left: 20,
  width: 250,
  fontSize: 12,
  color: '#94a3b8',
  background: 'rgba(14,14,16,0.82)',
  padding: '12px 14px',
  borderRadius: 8,
  zIndex: 10,
}
