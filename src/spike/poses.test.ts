import { describe, expect, it } from 'vitest'
import { deriveOrbitPose, deriveWalkPose, EYE_HEIGHT } from './poses'

const normXZ = (x: number, z: number) => {
  const l = Math.hypot(x, z) || 1
  return { x: x / l, z: z / l }
}

describe('S2 pose 互推导', () => {
  it('walk 起点恒为眼高 1.6 且距 target 1.5m', () => {
    const w = deriveWalkPose({ x: 4, y: 5, z: 4 }, { x: 0, y: 1.5, z: -2 })
    expect(w.pos.y).toBe(EYE_HEIGHT)
    expect(Math.hypot(w.pos.x - w.lookAt.x, w.pos.z - w.lookAt.z)).toBeCloseTo(1.5, 5)
  })

  it('连续 20 次互切：无 NaN、朝向不翻转、单步机位变化有界（无跳变）', () => {
    let orbit = { pos: { x: 4, y: 5, z: 4 }, target: { x: 0, y: 1.5, z: -2 } }
    const baseF = normXZ(orbit.target.x - orbit.pos.x, orbit.target.z - orbit.pos.z)
    for (let i = 0; i < 20; i++) {
      const w = deriveWalkPose(orbit.pos, orbit.target)
      const f = normXZ(w.lookAt.x - w.pos.x, w.lookAt.z - w.pos.z)
      // 朝向点积恒为 1：不发生朝向翻转
      expect(f.x * baseF.x + f.z * baseF.z).toBeCloseTo(1, 6)
      const o = deriveOrbitPose(w.pos, f)
      const step = Math.hypot(o.pos.x - orbit.pos.x, o.pos.z - orbit.pos.z)
      expect(step).toBeLessThan(8) // 几何有界：3.2+1.5+视线前移
      for (const v of [...Object.values(o.pos), ...Object.values(o.target)]) {
        expect(Number.isFinite(v)).toBe(true)
      }
      orbit = { pos: o.pos, target: o.target }
    }
  })

  it('orbit 相机位于漫游眼位后上方', () => {
    const o = deriveOrbitPose({ x: 1, y: 1.6, z: 1 }, { x: 0, z: -1 })
    expect(o.pos.z).toBeGreaterThan(1)
    expect(o.pos.y).toBeCloseTo(3.6, 5)
  })
})
