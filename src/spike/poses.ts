// Spike S2：双模式位姿互推导（验证后演进为 src/three/cameraRig.ts）
export type V3 = { x: number; y: number; z: number }

export const EYE_HEIGHT = 1.6
export const ORBIT_BACK = 3.2
export const ORBIT_UP = 2.0

const sub = (a: V3, b: V3): V3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })
const lenXZ = (v: { x: number; z: number }) => Math.hypot(v.x, v.z) || 1

/** Orbit 相机 → 漫游起点：target 前 1.5m（沿俯视方向的水平投影），眼高 1.6，看向 target */
export function deriveWalkPose(orbitPos: V3, orbitTarget: V3): { pos: V3; lookAt: V3 } {
  const dir = sub(orbitTarget, orbitPos)
  const l = lenXZ(dir)
  const fwd = { x: dir.x / l, z: dir.z / l }
  return {
    pos: { x: orbitTarget.x - fwd.x * 1.5, y: EYE_HEIGHT, z: orbitTarget.z - fwd.z * 1.5 },
    lookAt: { x: orbitTarget.x, y: Math.min(orbitTarget.y, 2.2), z: orbitTarget.z },
  }
}

/** 漫游位姿 → Orbit 位姿：眼位后上方 3.2m/2m，target 为眼前 2m */
export function deriveOrbitPose(walkPos: V3, walkFwdXZ: { x: number; z: number }): { pos: V3; target: V3 } {
  const l = lenXZ(walkFwdXZ)
  const fwd = { x: walkFwdXZ.x / l, z: walkFwdXZ.z / l }
  return {
    pos: { x: walkPos.x - fwd.x * ORBIT_BACK, y: walkPos.y + ORBIT_UP, z: walkPos.z - fwd.z * ORBIT_BACK },
    target: { x: walkPos.x + fwd.x * 2, y: walkPos.y, z: walkPos.z + fwd.z * 2 },
  }
}
