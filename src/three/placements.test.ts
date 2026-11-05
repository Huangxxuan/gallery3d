import { describe, expect, it } from 'vitest'
import { DOOR_HALF, EDGE_KEEP, HANG_PITCH, evenSlotsOnWall, frameOuterW } from '../domain/gallery'
import { pickPlacements, SELECT_CAP, type ManifestArt } from './placements'

describe('evenSlotsOnWall 定距挂位', () => {
  it('count=0 或墙段全被门占满时返回空', () => {
    expect(evenSlotsOnWall(18, [], 0)).toEqual([])
    expect(evenSlotsOnWall(1.8, [{ at: 0.9 }], 5)).toEqual([])
  })

  it('单幅居中', () => {
    expect(evenSlotsOnWall(13, [], 1)).toEqual([6.5])
  })

  it('无门整墙：中心距恒为 3.5m，整组居中，端部留白 >EDGE_KEEP', () => {
    const pts = evenSlotsOnWall(18, [], 5)
    expect(pts).toHaveLength(5)
    for (let i = 1; i < pts.length; i++) expect(pts[i] - pts[i - 1]).toBeCloseTo(HANG_PITCH, 2)
    expect(pts[0]).toBeGreaterThanOrEqual(EDGE_KEEP)
    expect(pts[pts.length - 1]).toBeLessThanOrEqual(18 - EDGE_KEEP)
    // 定距 + 居中 ⇒ 两端余量相等
    expect(pts[0]).toBeCloseTo(18 - pts[pts.length - 1], 2)
  })

  it('有门墙：所有挂位避开洞口缓冲（按 EDGE_KEEP）', () => {
    const pts = evenSlotsOnWall(13, [{ at: 1.2 }], 3)
    expect(pts).toHaveLength(3)
    for (const at of pts) {
      expect(Math.abs(at - 1.2)).toBeGreaterThanOrEqual(DOOR_HALF + EDGE_KEEP - 1e-6)
    }
  })

  it('count 小于容量时不拉伸间距（v6 关键：宁可留白也不改节奏）', () => {
    const pts = evenSlotsOnWall(18, [], 3)
    expect(pts).toHaveLength(3)
    for (let i = 1; i < pts.length; i++) expect(pts[i] - pts[i - 1]).toBeCloseTo(HANG_PITCH, 2)
    expect(pts[0]).toBeCloseTo(5.5, 2)
  })
})

// 构造与真实 manifest 同构的 148 张（44/42/36/26）
function fakeArts(): ManifestArt[] {
  const plan: Array<[string, number]> = [
    ['H1', 44],
    ['H2', 42],
    ['H3', 36],
    ['H4', 26],
  ]
  const out: ManifestArt[] = []
  let n = 0
  for (const [hall, count] of plan) {
    for (let i = 0; i < count; i++) {
      const portrait = n % 4 !== 3 // 每 4 张 1 横幅
      out.push({
        id: `art_${String(++n).padStart(3, '0')}`,
        src: `photos/${out.length + 1}.jpg`,
        srcLo: 'photos/lo/x.jpg',
        srcHd: 'photos/hd/x.jpg',
        widthPx: portrait ? 3000 : 5472,
        heightPx: portrait ? 4000 : 3648,
        orientation: portrait ? 'portrait' : 'landscape',
        hall,
      })
    }
  }
  return out
}

describe('pickPlacements 精选布展（定距容量）', () => {
  const arts = fakeArts()
  const placed = pickPlacements(arts)

  it('精选 60 张上墙（容量驱动）且全局序号连续', () => {
    expect(placed).toHaveLength(60)
    placed.forEach((p, i) => expect(p.index).toBe(i))
  })

  it('每厅 15 张（四厅均齐）', () => {
    const byHall: Record<string, number> = {}
    for (const p of placed) byHall[p.hall.id] = (byHall[p.hall.id] ?? 0) + 1
    expect(byHall).toEqual({ H1: 15, H2: 15, H3: 15, H4: 15 })
  })

  it('二次布展是不动点（防止 Artworks 再喂一遍就改布局）', () => {
    const again = pickPlacements(placed.map((p) => p.art))
    expect(again.map((p) => `${p.hall.id}${p.slot.wall}@${p.slot.at}`)).toEqual(
      placed.map((p) => `${p.hall.id}${p.slot.wall}@${p.slot.at}`),
    )
  })

  it('精选采样 stride 均匀：无重复、末位与 SELECT_CAP 步长公式一致', () => {
    for (const hall of ['H1', 'H2', 'H3', 'H4']) {
      const ids = placed.filter((p) => p.hall.id === hall).map((p) => p.art.id)
      expect(new Set(ids).size).toBe(ids.length)
      const all = arts.filter((a) => a.hall === hall)
      expect(ids[0]).toBe(all[0].id)
      const denom = Math.min(all.length, SELECT_CAP)
      expect(all.map((a) => a.id).indexOf(ids[ids.length - 1])).toBe(
        Math.floor(((ids.length - 1) * all.length) / denom),
      )
    }
  })

  it('零裁剪：画心宽高比与原图像素比完全一致', () => {
    for (const p of placed) {
      expect(p.photoW / p.photoH).toBeCloseTo(p.art.widthPx / p.art.heightPx, 6)
    }
  })

  it('挂位避开洞口、画框不凸门洞', () => {
    for (const hall of ['H1', 'H2', 'H3', 'H4']) {
      for (const p of placed.filter((q) => q.hall.id === hall)) {
        for (const d of p.hall.doors[p.slot.wall] ?? []) {
          const gap = Math.abs(p.slot.at - d.at)
          expect(gap, `${hall} ${p.slot.wall}@${p.slot.at} 压门洞`).toBeGreaterThanOrEqual((d.w ?? 1.8) / 2 + EDGE_KEEP - 1e-6)
          expect(gap - (d.w ?? 1.8) / 2 - frameOuterW(p.photoW) / 2, `${hall} 画框凸门洞`).toBeGreaterThanOrEqual(0.2 - 1e-6)
        }
      }
    }
  })

  it('全馆画心距恒为 3.5m（v6 核心：不再有 2.67/3.02/3.37/3.70 混排）', () => {
    const pitches: number[] = []
    for (const hall of ['H1', 'H2', 'H3', 'H4']) {
      const byWall: Record<string, number[]> = {}
      for (const p of placed.filter((q) => q.hall.id === hall)) {
        ;(byWall[p.slot.wall] ??= []).push(p.slot.at)
      }
      for (const ats of Object.values(byWall)) {
        ats.sort((a, b) => a - b)
        for (let i = 1; i < ats.length; i++) pitches.push(ats[i] - ats[i - 1])
      }
    }
    expect(pitches.length).toBeGreaterThan(0)
    const min = Math.min(...pitches)
    const max = Math.max(...pitches)
    expect(min).toBeGreaterThanOrEqual(HANG_PITCH - 0.01)
    expect(max).toBeLessThanOrEqual(HANG_PITCH + 0.01)
  })

  it('同墙相邻画框边净隙 ≥1.3m（远高于 0.35 旧契约）', () => {
    for (const hall of ['H1', 'H2', 'H3', 'H4']) {
      const byWall: Record<string, Array<{ at: number; hw: number }>> = {}
      for (const p of placed.filter((q) => q.hall.id === hall)) {
        ;(byWall[p.slot.wall] ??= []).push({ at: p.slot.at, hw: frameOuterW(p.photoW) / 2 })
      }
      for (const [, items] of Object.entries(byWall)) {
        items.sort((a, b) => a.at - b.at)
        for (let i = 1; i < items.length; i++) {
          const clear = items[i].at - items[i - 1].at - items[i].hw - items[i - 1].hw
          expect(clear, `${hall} 框边净隙`).toBeGreaterThanOrEqual(1.3)
        }
      }
    }
  })

  it('作品少于容量时全部上墙，且不超单墙容量', () => {
    const few = fakeArts().filter((a) => a.hall === 'H4').slice(0, 10)
    const placedFew = pickPlacements(few)
    expect(placedFew).toHaveLength(10)
    const byWall: Record<string, number> = {}
    for (const p of placedFew) byWall[p.slot.wall] = (byWall[p.slot.wall] ?? 0) + 1
    expect(byWall.N).toBeLessThanOrEqual(5)
    expect(byWall.E).toBeLessThanOrEqual(2)
    expect(byWall.S).toBeLessThanOrEqual(5)
    expect(byWall.W).toBeLessThanOrEqual(3)
  })

  it('大图机位朝向画心（机位坐标有限值回归）', async () => {
    const { cameraStand } = await import('./placements')
    for (const p of placed.slice(0, 20)) {
      const s = cameraStand(p)
      expect(Number.isFinite(s.x)).toBe(true)
      expect(Number.isFinite(s.z)).toBe(true)
    }
  })
})
