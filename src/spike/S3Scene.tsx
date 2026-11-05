import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useMemo, useState } from 'react'
import * as THREE from 'three'
import { aimGeometry, coversMat, ellipseAxes, kelvinToRGB } from './spotMath'

const LIGHT_POS = { x: 0.6, y: 3.4, z: 0 }
const TARGET = { x: 0.03, y: 1.5, z: 0 }

function Artwork() {
  return (
    <group position={[0.03, 1.5, 0]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.05, 1.44, 1.04]} />
        <meshStandardMaterial color="#111110" metalness={0.3} roughness={0.4} />
      </mesh>
      <mesh position={[0.03, 0, 0]} receiveShadow>
        <planeGeometry args={[1.0, 1.4]} />
        <meshStandardMaterial color="#F2EFE8" roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0.031, 0, 0]} castShadow>
        <planeGeometry args={[0.8, 1.2]} />
        <meshStandardMaterial color="#5b6b55" roughness={0.8} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

export default function S3Scene() {
  const [intensity, setIntensity] = useState(1.4)
  const [angle, setAngle] = useState(Math.PI / 11)
  const [penumbra, setPenumbra] = useState(0.55)
  const [kelvin, setKelvin] = useState(3500)
  const [shadow, setShadow] = useState(true)
  const [normalBias, setNormalBias] = useState(0.05)

  const targetObj = useMemo(() => new THREE.Object3D(), [])
  const color = useMemo(() => {
    const c = kelvinToRGB(kelvin)
    return new THREE.Color(c.r, c.g, c.b)
  }, [kelvin])

  const { distance, tiltFromNormal } = aimGeometry(LIGHT_POS, TARGET, { x: 1, z: 0 })
  const axes = ellipseAxes(distance, angle, tiltFromNormal)
  const covered = coversMat(axes.semiMinor, axes.semiMajor)

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Canvas shadows camera={{ position: [2.4, 2.1, 2.6], fov: 50 }}>
        <color attach="background" args={['#0e0e10']} />
        <ambientLight intensity={0.05} />
        {/* 射灯：每幅独立一盏的原型 */}
        <spotLight
          position={[LIGHT_POS.x, LIGHT_POS.y, LIGHT_POS.z]}
          target={targetObj}
          intensity={intensity}
          angle={angle}
          penumbra={penumbra}
          decay={2}
          color={color}
          castShadow={shadow}
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-bias={-0.0002}
          shadow-normalBias={normalBias}
        />
        <primitive object={targetObj} position={[TARGET.x, TARGET.y, TARGET.z]} />
        {/* 灯具示意（黑色轨道头） */}
        <mesh position={[LIGHT_POS.x, LIGHT_POS.y, LIGHT_POS.z]}>
          <cylinderGeometry args={[0.05, 0.08, 0.18, 16]} />
          <meshStandardMaterial color="#0a0a0a" />
        </mesh>

        {/* 墙 */}
        <mesh position={[0, 1.5, 0]} receiveShadow>
          <boxGeometry args={[0.2, 3, 4]} />
          <meshStandardMaterial color="#161514" roughness={0.98} />
        </mesh>
        <Artwork />
        <mesh rotation-x={-Math.PI / 2} receiveShadow>
          <planeGeometry args={[12, 12]} />
          <meshStandardMaterial color="#232221" roughness={0.4} metalness={0.05} />
        </mesh>
        <OrbitControls makeDefault target={[0.03, 1.5, 0]} minDistance={1} maxDistance={6} />
      </Canvas>

      <div style={panelStyle}>
        <b style={{ color: '#fafafa' }}>S3 实时射灯</b>
        <Slider label="强度 intensity" value={intensity} min={0} max={4} step={0.05} fmt={v => v.toFixed(2)} onChange={setIntensity} />
        <Slider label="半锥角 angle" value={angle} min={0.05} max={0.6} step={0.005} fmt={v => `${((v * 180) / Math.PI).toFixed(1)}°`} onChange={setAngle} />
        <Slider label="羽化 penumbra" value={penumbra} min={0} max={1} step={0.05} fmt={v => v.toFixed(2)} onChange={setPenumbra} />
        <Slider label="色温" value={kelvin} min={2700} max={6500} step={50} fmt={v => `${v}K`} onChange={setKelvin} />
        <Slider label="shadow-normalBias" value={normalBias} min={0} max={0.2} step={0.005} fmt={v => v.toFixed(3)} onChange={setNormalBias} />
        <label style={{ display: 'block', marginTop: 8, color: '#cbd5e1', fontSize: 12 }}>
          <input type="checkbox" checked={shadow} onChange={(e) => setShadow(e.target.checked)} /> 投射阴影（性能档关闭）
        </label>
        <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #2E2E33', fontSize: 12, lineHeight: 1.7 }}>
          灯距 {distance.toFixed(2)}m ｜ 倾角 {(tiltFromNormal * 180 / Math.PI).toFixed(1)}°
          <br />
          墙面光斑椭圆：短径 {(axes.semiMinor * 2).toFixed(2)}m × 长径 {(axes.semiMajor * 2).toFixed(2)}m
          <br />
          覆盖卡纸(1.00×1.40)+0.10：
          <b style={{ color: covered ? '#7ddf8a' : '#ef4444', marginLeft: 4 }}>
            {covered ? '达标' : '不达标'}
          </b>
          <br />
          阴影痤疮检验：normalBias 拖到 0 观察墙面条纹，0.05 应干净
        </div>
      </div>
    </div>
  )
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  fmt,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  fmt: (v: number) => string
  onChange: (v: number) => void
}) {
  return (
    <label style={{ display: 'block', marginTop: 8, color: '#cbd5e1', fontSize: 12 }}>
      {label}：{fmt(value)}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: '100%' }}
      />
    </label>
  )
}

const panelStyle: React.CSSProperties = {
  position: 'absolute',
  top: 76,
  right: 20,
  width: 260,
  fontSize: 12,
  color: '#94a3b8',
  background: 'rgba(14,14,16,0.82)',
  padding: '12px 14px',
  borderRadius: 8,
  zIndex: 10,
}
