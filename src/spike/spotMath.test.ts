import { describe, expect, it } from 'vitest'
import { aimGeometry, coversMat, ellipseAxes, kelvinToRGB, spotRadius } from './spotMath'

describe('S3 光斑覆盖', () => {
  const light = { x: 0.6, y: 3.4, z: 0 }
  const target = { x: 0.03, y: 1.5, z: 0 }
  const { distance, tiltFromNormal } = aimGeometry(light, target, { x: 1, z: 0 })

  it('默认布机位：灯→画心约 2m、倾角约 73°', () => {
    expect(distance).toBeCloseTo(1.98, 1)
    expect(tiltFromNormal).toBeCloseTo(73.3 * (Math.PI / 180), 1)
  })

  it('angle=π/11 时光斑覆盖卡纸外径+10cm', () => {
    const { semiMinor, semiMajor } = ellipseAxes(distance, Math.PI / 11, tiltFromNormal)
    expect(coversMat(semiMinor, semiMajor)).toBe(true)
  })

  it('angle 过小（π/20）不覆盖', () => {
    const { semiMinor, semiMajor } = ellipseAxes(distance, Math.PI / 20, tiltFromNormal)
    expect(coversMat(semiMinor, semiMajor)).toBe(false)
  })

  it('正对墙时长短轴相等', () => {
    const a = ellipseAxes(2, 0.3, 0)
    expect(a.semiMinor).toBeCloseTo(a.semiMajor, 9)
    expect(spotRadius(2, 0.3)).toBeCloseTo(2 * Math.tan(0.3), 9)
  })
})

describe('S3 色温', () => {
  it('3500K 暖白 r>g>b', () => {
    const c = kelvinToRGB(3500)
    expect(c.r).toBeGreaterThan(c.g)
    expect(c.g).toBeGreaterThan(c.b)
  })
  it('6500K 冷白 b 接近或大于 r', () => {
    const c = kelvinToRGB(6500)
    expect(c.b).toBeGreaterThanOrEqual(c.r - 0.02)
  })
  it('2700K/10000K 均有界', () => {
    for (const k of [2700, 10000]) {
      const c = kelvinToRGB(k)
      for (const v of [c.r, c.g, c.b]) {
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(1)
      }
    }
  })
})
