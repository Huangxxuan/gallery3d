import { Canvas, ThreeEvent, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useRef, useState } from 'react'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import * as THREE from 'three'
import { nearestLegal, snapOffset, type Interval } from './snap'

const WALL_LENGTH = 8
const WALL_HEIGHT = 3
const OPENINGS: Interval[] = [{ from: -0.8, to: 0.8 }]
const FRAME_W = 1.04
const FRAME_H = 1.44
const HALF_W = FRAME_W / 2

const check = (raw: number) => snapOffset(raw, WALL_LENGTH, HALF_W, OPENINGS)

function MountedFrame({
  z,
  valid,
  selected,
  onDown,
}: {
  z: number
  valid: boolean
  selected: boolean
  onDown: (e: ThreeEvent<PointerEvent>) => void
}) {
  return (
    <group position={[0.03, 1.5, z]} onPointerDown={onDown}>
      <mesh>
        <boxGeometry args={[0.05, FRAME_H, FRAME_W]} />
        <meshStandardMaterial
          color={selected ? (valid ? '#C9A876' : '#EF4444') : '#111110'}
          metalness={0.3}
          roughness={0.4}
          emissive={selected ? (valid ? '#3a2f1c' : '#3a1414') : '#000000'}
        />
      </mesh>
      <mesh position={[0.03, 0, 0]}>
        <planeGeometry args={[FRAME_W - 0.04, FRAME_H - 0.04]} />
        <meshStandardMaterial color="#F2EFE8" roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0.031, 0, 0]}>
        <planeGeometry args={[0.8, 1.2]} />
        <meshStandardMaterial color="#5b6b55" roughness={0.8} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

function SceneContents({
  offset,
  setOffset,
  setCommitted,
  dragging,
  setDragging,
  selected,
  setSelected,
}: {
  offset: number
  setOffset: (n: number) => void
  setCommitted: (n: number) => void
  dragging: boolean
  setDragging: (b: boolean) => void
  selected: boolean
  setSelected: (b: boolean) => void
}) {
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null
  const wallRef = useRef<THREE.Mesh>(null)

  const hitWallZ = (e: ThreeEvent<PointerEvent>) => {
    const p = e.point.clone()
    wallRef.current?.worldToLocal(p)
    return p.z
  }

  return (
    <>
      <mesh
        ref={wallRef}
        position={[0, WALL_HEIGHT / 2, 0]}
        onPointerMove={(e) => {
          if (!dragging) return
          setOffset(hitWallZ(e))
        }}
        onPointerUp={() => {
          if (!dragging) return
          const r = check(offset)
          const finalZ = r.valid ? offset : nearestLegal(offset, WALL_LENGTH, HALF_W, OPENINGS)
          setOffset(finalZ)
          setCommitted(finalZ)
          setDragging(false)
          setSelected(false)
          if (controls) controls.enabled = true
        }}
      >
        <boxGeometry args={[0.2, WALL_HEIGHT, WALL_LENGTH]} />
        <meshStandardMaterial color="#161514" roughness={0.98} />
      </mesh>

      <mesh position={[0.11, WALL_HEIGHT / 2, 0]}>
        <planeGeometry args={[1.6, WALL_HEIGHT]} />
        <meshBasicMaterial color="#050505" />
      </mesh>

      <MountedFrame
        z={offset}
        valid={check(offset).valid}
        selected={selected}
        onDown={(e) => {
          e.stopPropagation()
          setSelected(true)
          setDragging(true)
          if (controls) controls.enabled = false
        }}
      />

      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[24, 24]} />
        <meshStandardMaterial color="#232221" roughness={0.4} metalness={0.05} />
      </mesh>
    </>
  )
}

export default function S1Scene() {
  const [offset, setOffset] = useState(-2.2)
  const [committed, setCommitted] = useState(-2.2)
  const [dragging, setDragging] = useState(false)
  const [selected, setSelected] = useState(false)

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Canvas shadows camera={{ position: [3.2, 2.2, 3.6], fov: 55 }}>
        <color attach="background" args={['#0e0e10']} />
        <ambientLight intensity={0.25} />
        <directionalLight position={[4, 6, 3]} intensity={0.5} />
        <SceneContents
          offset={offset}
          setOffset={setOffset}
          setCommitted={setCommitted}
          dragging={dragging}
          setDragging={setDragging}
          selected={selected}
          setSelected={setSelected}
        />
        <OrbitControls makeDefault target={[0, 1.4, 0]} />
      </Canvas>
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
        }}
      >
        <b style={{ color: '#fafafa' }}>S1 贴墙吸附</b>
        <br />
        按住作品沿墙拖动：黑区为门洞（宽1.6m，禁挂）
        <br />
        合法=黄铜高亮，非法=红色，松手自动回弹最近合法点
        <br />
        拖动 z={offset.toFixed(2)}m ｜ 已提交 z={committed.toFixed(2)}m ｜{' '}
        {check(offset).valid ? '合法' : '非法(门洞/越界)'}
      </div>
    </div>
  )
}
