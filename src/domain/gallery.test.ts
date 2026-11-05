import { describe, expect, it } from 'vitest'
import {
  CORRIDOR,
  DOOR_HALF,
  DOOR_W,
  EDGE_KEEP,
  FRAME_BORDER,
  HALLS,
  HANG_PITCH,
  PORTAL,
  ROUTE,
  RUINS_STPAUL,
  SEA_RIBBONS,
  SPACES,
  SPAWN,
  SPACE_BY_ID,
  STPAUL_CROSS_H,
  STPAUL_TIERS,
  ruinsMetrics,
  doorViolations,
  evenSlotsOnWall,
  frameOuterW,
  portalApex,
  portalSpring,
  ribbonSlots,
  slotPose,
  spaceSize,
  wallBoxes,
  wallCapacityOnWall,
  wallRuns,
  zoneAt,
  type Door,
  type Space,
  type WallId,
} from './gallery'

describe('空间模型', () => {
  it('共 9 个空间：4 厅 + 2 门厅 + 3 暗廊', () => {
    expect(SPACES.filter((s) => s.kind === 'hall')).toHaveLength(4)
    expect(SPACES.filter((s) => s.kind === 'lobby')).toHaveLength(2)
    expect(SPACES.filter((s) => s.kind === 'corridor')).toHaveLength(3)
  })

  it('展厅统一 18×13×5.2，暗廊净高 4.0（v6：给拱环上方留墙）', () => {
    for (const h of HALLS) {
      const { len, wid } = spaceSize(h)
      expect(len).toBeCloseTo(18, 6)
      expect(wid).toBeCloseTo(13, 6)
      expect(h.h).toBe(5.2)
    }
    expect([CORRIDOR.width, CORRIDOR.height]).toEqual([1.8, 4.0])
    // 最深预设 3.75 + 拱环 0.16 必须低于暗廊净高，否则拱环顶穿暗廊天花
    expect(PORTAL.apexMain + PORTAL.ring).toBeLessThanOrEqual(CORRIDOR.height)
  })

  it('三条暗廊横向净宽统一 2.4m（v6 修 CW 的 1.8 → 门洞越界）', () => {
    for (const id of ['CS', 'CW', 'CN']) {
      const s = SPACE_BY_ID.get(id)!
      // CS/CN 沿 x 通行 → 横向是 z；CW 沿 z 通行 → 横向是 x
      const cross = id === 'CW' ? s.x1 - s.x0 : s.z1 - s.z0
      expect(cross, `${id} 横向净宽`).toBeCloseTo(2.4, 6)
    }
  })
})

describe('门洞不变量（v6 新增，钉死穿墙回归）', () => {
  it('所有门洞完整落在所属墙段内', () => {
    const bad: string[] = []
    for (const s of SPACES) {
      const { len, wid } = spaceSize(s)
      for (const wall of ['N', 'S', 'E', 'W'] as WallId[]) {
        const span = wall === 'N' || wall === 'S' ? len : wid
        for (const d of s.doors[wall] ?? []) {
          const w = d.w ?? DOOR_W
          if (d.at - w / 2 < -1e-9 || d.at + w / 2 > span + 1e-9) {
            bad.push(`${s.id}.${wall} [${(d.at - w / 2).toFixed(2)}, ${(d.at + w / 2).toFixed(2)}] / span ${span.toFixed(2)}`)
          }
        }
      }
    }
    expect(bad).toEqual([])
  })

  it('拱环（洞缘外扩 ring）不得绕出墙角', () => {
    expect(doorViolations()).toEqual([])
  })

  it('暗廊门两侧墙垛 ≥0.3m（视觉上拱环是嵌在墙里的，不是浮在洞口外）', () => {
    for (const id of ['CS', 'CW', 'CN']) {
      const s = SPACE_BY_ID.get(id)!
      for (const wall of ['N', 'S', 'E', 'W'] as WallId[]) {
        const span = wall === 'N' || wall === 'S' ? s.x1 - s.x0 : s.z1 - s.z0
        for (const d of s.doors[wall] ?? []) {
          const w = d.w ?? DOOR_W
          expect(d.at - w / 2, `${id}.${wall} 西/南垛`).toBeGreaterThanOrEqual(0.3 - 1e-9)
          expect(span - (d.at + w / 2), `${id}.${wall} 东/北垛`).toBeGreaterThanOrEqual(0.3 - 1e-9)
        }
      }
    }
  })
})

describe('拱门几何', () => {
  it('半圆拱：半径 = 净宽/2，拱顶 = 起拱线 + 半径', () => {
    for (const w of [1.8, 3.0]) {
      expect(portalSpring(w) + w / 2).toBeCloseTo(portalApex(w), 9)
    }
  })

  it('默认预设全馆同一拱顶标高 3.5m，比例约为 1:1.17（真实罗马拱观感）', () => {
    expect(PORTAL.apexMain).toBe(3.5)
    expect(PORTAL.apexPassage).toBe(3.5)
    expect(portalSpring(3.0)).toBeCloseTo(2.0, 9)
    expect(portalSpring(1.8)).toBeCloseTo(2.6, 9)
    expect(portalApex(3.0)).toBeCloseTo(3.5, 9)
    expect(portalApex(1.8)).toBeCloseTo(3.5, 9)
  })
})

describe('wallRuns / 定距挂位容量', () => {
  it('无门整墙为一段 0..len', () => {
    expect(wallRuns(18, [])).toEqual([[0, 18]])
  })

  it('门洞从实墙区间中扣除', () => {
    expect(wallRuns(13, [{ at: 1.2 }])).toEqual([
      [0, 1.2 - DOOR_HALF],
      [1.2 + DOOR_HALF, 13],
    ])
  })

  it('定距容量：18m 整墙 5 位、13m 整墙 3 位（pitch 3.5 + 端部留白 1.45）', () => {
    expect(wallCapacityOnWall(18)).toBe(5)
    expect(wallCapacityOnWall(13)).toBe(3)
  })

  it('有门端墙按净段折算（10.9m 净段 3 位；12.7..13 的 0.3m 边角料跳过）', () => {
    expect(wallCapacityOnWall(13, [{ at: 11.8 }])).toBe(3)
    expect(wallCapacityOnWall(13, [{ at: 1.2 }])).toBe(3)
    expect(wallCapacityOnWall(13, [{ at: 2.0, w: 3 }])).toBe(2)
  })

  it('四厅容量均齐 15（总 60），不再有 14/16 的偏差', () => {
    const per: number[] = []
    for (const h of HALLS) {
      const { len, wid } = spaceSize(h)
      const cap = (w: WallId) => wallCapacityOnWall(w === 'N' || w === 'S' ? len : wid, h.doors[w] ?? [])
      per.push(cap('N') + cap('S') + cap('W') + cap('E'))
    }
    expect(per).toEqual([15, 15, 15, 15])
  })

  it('定距挂位：同墙相邻中心距恒为 HANG_PITCH，整组在墙段内居中', () => {
    for (const h of HALLS) {
      const { len, wid } = spaceSize(h)
      for (const w of ['N', 'S', 'W', 'E'] as WallId[]) {
        const L = w === 'N' || w === 'S' ? len : wid
        const doors = h.doors[w] ?? []
        const cap = wallCapacityOnWall(L, doors)
        const pts = evenSlotsOnWall(L, doors, cap)
        expect(pts.length).toBe(cap)
        for (let i = 1; i < pts.length; i++) {
          expect(pts[i] - pts[i - 1], `${h.id}.${w} 中心距`).toBeCloseTo(HANG_PITCH, 1)
        }
        for (const at of pts) {
          for (const d of doors) {
            expect(Math.abs(at - d.at)).toBeGreaterThanOrEqual((d.w ?? DOOR_W) / 2 + EDGE_KEEP - 1e-6)
          }
        }
      }
    }
  })

  it('挂位坐标落在厅内且不穿墙', () => {
    for (const h of HALLS) {
      const { len, wid } = spaceSize(h)
      let idx = 0
      for (const w of ['N', 'S', 'W', 'E'] as WallId[]) {
        const L = w === 'N' || w === 'S' ? len : wid
        const doors = h.doors[w] ?? []
        for (const at of evenSlotsOnWall(L, doors, wallCapacityOnWall(L, doors))) {
          const p = slotPose(h, { hallId: h.id, wall: w, at, index: idx++ })
          expect(p.x).toBeGreaterThan(h.x0)
          expect(p.x).toBeLessThan(h.x1)
          expect(p.z).toBeGreaterThan(h.z0)
          expect(p.z).toBeLessThan(h.z1)
        }
      }
    }
  })
})

describe('画框口径', () => {
  it('画框外宽 = 画心 + 单边 0.12×2（渲染与布展契约同源）', () => {
    expect(FRAME_BORDER).toBe(0.12)
    expect(frameOuterW(1.9)).toBeCloseTo(2.14, 9)
    // 统一 3.5m 中心距下，最宽画框之间的净隙
    expect(HANG_PITCH - frameOuterW(1.9)).toBeCloseTo(1.36, 9)
  })
})

// 门在全局坐标下的开口区间（per-door 门宽）
function openingGlobal(space: Space, wall: WallId): Array<{ axis: 'x' | 'z'; lo: number; hi: number }> {
  const doors: Door[] = space.doors[wall] ?? []
  return doors.map((d) => {
    const half = (d.w ?? DOOR_W) / 2
    if (wall === 'N' || wall === 'S') return { axis: 'x' as const, lo: space.x0 + d.at - half, hi: space.x0 + d.at + half }
    return { axis: 'z' as const, lo: space.z0 + d.at - half, hi: space.z0 + d.at + half }
  })
}

describe('蛇形动线上的门洞对位', () => {
  const pairs: Array<[string, WallId, string, WallId]> = [
    ['ENTRY', 'W', 'H1', 'E'],
    ['H1', 'W', 'CS', 'E'],
    ['CS', 'W', 'H2', 'E'],
    ['H2', 'N', 'CW', 'S'],
    ['CW', 'N', 'H3', 'S'],
    ['H3', 'E', 'CN', 'W'],
    ['CN', 'E', 'H4', 'W'],
    ['H4', 'E', 'EXIT', 'W'],
  ]

  it.each(pairs)('%s %s墙 门洞与 %s %s墙 完全对位', (aId, aw, bId, bw) => {
    const a = SPACE_BY_ID.get(aId)!
    const b = SPACE_BY_ID.get(bId)!
    const oa = openingGlobal(a, aw)
    const ob = openingGlobal(b, bw)
    expect(oa).toHaveLength(1)
    expect(ob).toHaveLength(1)
    expect(oa[0].axis).toBe(ob[0].axis)
    expect(oa[0].lo).toBeCloseTo(ob[0].lo, 6)
    expect(oa[0].hi).toBeCloseTo(ob[0].hi, 6)
  })
})

describe('动线与出生点', () => {
  it('出生点位于入口厅内，面朝西', () => {
    expect(zoneAt(SPAWN.x, SPAWN.z)?.id).toBe('ENTRY')
    expect(SPAWN.yaw).toBe(-Math.PI / 2)
  })

  it('蛇形动线节点全部落在可达空间内（含门洞边界容差）', () => {
    for (const [x, z] of ROUTE) {
      const hit = SPACES.some(
        (s) => x >= s.x0 - 0.05 && x <= s.x1 + 0.05 && z >= s.z0 - 0.05 && z <= s.z1 + 0.05,
      )
      expect(hit, `动线点 (${x},${z}) 不在任何空间`).toBe(true)
    }
  })

  it('碰撞体数量确定（建墙/碰撞同源回归）', () => {
    expect(wallBoxes().length).toBeGreaterThanOrEqual(50)
  })
})

describe('H3「海与港」悬垂海浪丝带（v8 灰模）', () => {
  it('5 条丝带以长凳中心为圆心半环均布，相邻弦距一致', () => {
    const slots = ribbonSlots()
    expect(slots).toHaveLength(SEA_RIBBONS.count)
    expect(SEA_RIBBONS.count).toBe(5)
    const dists = slots.slice(1).map((s, i) => Math.hypot(s.x - slots[i].x, s.z - slots[i].z))
    for (const d of dists) expect(d).toBeCloseTo(dists[0], 6)
    // 相邻角 140/4 = 35° → 弦长 2R·sin(17.5°)
    expect(dists[0]).toBeCloseTo(2 * SEA_RIBBONS.radius * Math.sin((17.5 * Math.PI) / 180), 2)
  })

  it('相邻净隙 = 弦距 − 带宽 ≥ 0.5m（老板要的“有间隔”）', () => {
    const slots = ribbonSlots()
    const chord = Math.hypot(slots[1].x - slots[0].x, slots[1].z - slots[0].z)
    expect(chord - SEA_RIBBONS.width).toBeGreaterThanOrEqual(0.5)
  })

  it('下沿垂到长凳面（0.34）上方，且离地留 0.4m 清扫净空', () => {
    const lip = 0.1 // 底边浪舌下探量（ribbonGeometry 同源）
    expect(SEA_RIBBONS.bottomY).toBeGreaterThan(0.34 + 0.15) // 不插进凳体
    expect(SEA_RIBBONS.bottomY - lip).toBeGreaterThanOrEqual(0.4) // 离地净空
    expect(SEA_RIBBONS.topY).toBeLessThanOrEqual(5.09) // 低于灯头下沿
    expect(SEA_RIBBONS.topY).toBeLessThan(5.2)
    expect(SEA_RIBBONS.cableY).toBeLessThanOrEqual(5.13)
  })

  it('全部丝带落在 H3 天棚发光板投影内，且不压南北灯轨（z=18.7 / 25.1）', () => {
    const h = SPACE_BY_ID.get('H3')!
    for (const s of ribbonSlots()) {
      expect(s.x).toBeGreaterThan(h.x0 + 0.45 + SEA_RIBBONS.width / 2)
      expect(s.x).toBeLessThan(h.x1 - 0.45 - SEA_RIBBONS.width / 2)
      expect(s.z).toBeGreaterThan(h.z0 + 0.45)
      expect(s.z).toBeLessThan(h.z1 - 0.45)
    }
  })
})

describe('H2「双城纪事」澳门大三巴牌坊（B+ 分层构件 + 壁龛浮雕）', () => {
  const m = ruinsMetrics()
  const h = SPACE_BY_ID.get('H2')!

  it('总高 0.22 石台 + 4×0.03 台阶 + 2.22 立面 = 2.56m，压在北墙画顶遮挡红线 2.60 之下', () => {
    expect(m.totalH).toBeCloseTo(2.56, 6)
    expect(m.totalH).toBeLessThanOrEqual(RUINS_STPAUL.maxTotalH)
  })

  it('立面 2.00 宽 × 2.22 高，接近真迹 23m:25.5m = 1:1.109', () => {
    expect(RUINS_STPAUL.baseW).toBeCloseTo(2.0, 6)
    expect(RUINS_STPAUL.facadeH).toBeCloseTo(2.22, 6)
    expect(m.aspect).toBeCloseTo(25.5 / 23, 2)
  })

  it('五段分层自下而上单调抬升、逐层收分；山花顶 = facadeH − 十字架高', () => {
    for (let i = 1; i < STPAUL_TIERS.length; i++) {
      expect(STPAUL_TIERS[i].y).toBeCloseTo(STPAUL_TIERS[i - 1].y + STPAUL_TIERS[i - 1].h, 6)
      expect(STPAUL_TIERS[i].w).toBeLessThan(STPAUL_TIERS[i - 1].w)
    }
    expect(m.tierTop).toBeCloseTo(RUINS_STPAUL.facadeH - STPAUL_CROSS_H, 6)
    expect(m.taper).toBeCloseTo(1.513 / 2.0, 6)
  })

  it('台座完整落在 H2 中庭内，碰撞盒（2.80×1.15）不越界', () => {
    expect(RUINS_STPAUL.center.x).toBeCloseTo((h.x0 + h.x1) / 2, 6)
    expect(RUINS_STPAUL.center.z).toBeCloseTo((h.z0 + h.z1) / 2, 6)
    expect(m.box.w).toBeLessThan(h.x1 - h.x0 - 4)
    expect(m.box.d).toBeLessThan(h.z1 - h.z0 - 4)
  })

  it('动线（z=11.8）到台座外缘净距 ≥2.6m，不与碰撞盒相撞', () => {
    expect(m.routeClear).toBeGreaterThanOrEqual(2.6)
  })

  it('东门（18,11.8）望立面顶仰角低于北墙画顶 7.4°——中庭展品不遮首批画', () => {
    expect(m.eastDoorDeg).toBeLessThan(7.4)
    expect(m.eastDoorDeg).toBeGreaterThan(0)
  })
})
