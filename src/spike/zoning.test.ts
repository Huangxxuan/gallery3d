import { describe, expect, it } from 'vitest'
import {
  detectCrossing,
  hallAt,
  HALL_CHAIN,
  shadowCasterCount,
  textureBudget,
  zoneFor,
  type HallBounds,
} from './zoning'

const BOUNDS: HallBounds[] = [
  { id: 'h1', minX: -5, maxX: 5 },
  { id: 'h2', minX: 7, maxX: 17 },
  { id: 'h3', minX: 19, maxX: 29 },
  { id: 'h4', minX: 31, maxX: 41 },
]

const FULL = 2048 * 2048 * 4
const THUMB = 320 * 320 * 4

describe('S4 zoneFor', () => {
  it('同厅 active / 序号差1 adjacent / 其余 frozen', () => {
    expect(zoneFor('h2', 'h2')).toBe('active')
    expect(zoneFor('h2', 'h1')).toBe('adjacent')
    expect(zoneFor('h2', 'h3')).toBe('adjacent')
    expect(zoneFor('h2', 'h4')).toBe('frozen')
  })
  it('端头厅只有一个邻厅', () => {
    expect(zoneFor('h1', 'h2')).toBe('adjacent')
    expect(zoneFor('h1', 'h3')).toBe('frozen')
    expect(zoneFor('h4', 'h3')).toBe('adjacent')
  })
})

describe('S4 hallAt / crossing', () => {
  it('厅内/走廊/厅外', () => {
    expect(hallAt(0, BOUNDS)).toBe('h1')
    expect(hallAt(17, BOUNDS)).toBe('h2')
    expect(hallAt(6, BOUNDS)).toBeNull()
    expect(hallAt(-9, BOUNDS)).toBeNull()
  })
  it('仅 厅↔厅 跳变算过门（走廊 null 不触发）', () => {
    expect(detectCrossing('h1', 'h2')).toBe(true)
    expect(detectCrossing('h1', null)).toBe(false)
    expect(detectCrossing(null, 'h2')).toBe(false)
    expect(detectCrossing('h2', 'h2')).toBe(false)
  })
})

describe('S4 纹理预算不随作品总数线性增长', () => {
  const oneHall = [{ id: 'h1' as const, count: 44 }, ...HALL_CHAIN.slice(1).map((id) => ({ id, count: 0 }))]
  const fourHalls = HALL_CHAIN.map((id) => ({ id, count: 44 })) // 176 张

  it('仅 h1 挂 44 张，驻留 h1：44 全质', () => {
    expect(textureBudget('h1', oneHall, { full: FULL, thumb: THUMB })).toBe(44 * FULL)
  })

  it('作品总数 44→176（4倍），驻留端厅预算增长 ≤2.5%', () => {
    const a = textureBudget('h1', oneHall, { full: FULL, thumb: THUMB })
    const b = textureBudget('h1', fourHalls, { full: FULL, thumb: THUMB })
    expect(b / a).toBeLessThan(1.025)
    // 具体：44 全质 + 邻厅 44 缩略
    expect(b).toBe(44 * FULL + 44 * THUMB)
  })

  it('驻留中厅：1 全质厅 + 2 缩略邻厅，远端 frozen=0', () => {
    expect(textureBudget('h2', fourHalls, { full: FULL, thumb: THUMB })).toBe(
      44 * FULL + 88 * THUMB,
    )
  })

  it('shadow 灯只数当前厅', () => {
    expect(shadowCasterCount('h3', fourHalls)).toBe(44)
  })
})
