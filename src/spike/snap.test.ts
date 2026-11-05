import { describe, expect, it } from 'vitest'
import { nearestLegal, snapOffset } from './snap'

const OP = [{ from: -0.8, to: 0.8 }]
const WALL = 8
const HW = 0.52

describe('snapOffset S1 spike', () => {
  it('合法段内任意位置 valid=true', () => {
    expect(snapOffset(-2.2, WALL, HW, OP).valid).toBe(true)
    expect(snapOffset(2.2, WALL, HW, OP).valid).toBe(true)
  })
  it('作品占用区与门洞相交即非法（含贴边临界）', () => {
    expect(snapOffset(0, WALL, HW, OP).valid).toBe(false)
    expect(snapOffset(1.32 - 0.01, WALL, HW, OP).valid).toBe(false)
    expect(snapOffset(1.32, WALL, HW, OP).valid).toBe(true)
    expect(snapOffset(-1.32, WALL, HW, OP).valid).toBe(true)
  })
  it('越墙端非法', () => {
    expect(snapOffset(3.8, WALL, HW, OP).valid).toBe(false)
    expect(snapOffset(-3.8, WALL, HW, OP).valid).toBe(false)
    expect(snapOffset(3.48, WALL, HW, OP).valid).toBe(true)
  })
})

describe('nearestLegal S1 spike', () => {
  it('从门洞内回弹到最近的合法端点', () => {
    expect(nearestLegal(0, WALL, HW, OP)).toBeCloseTo(-1.32)
    expect(nearestLegal(0.7, WALL, HW, OP)).toBeCloseTo(1.32)
  })
  it('从墙外回弹到墙内端点', () => {
    expect(nearestLegal(-5, WALL, HW, OP)).toBeCloseTo(-3.48)
    expect(nearestLegal(5, WALL, HW, OP)).toBeCloseTo(3.48)
  })
})
