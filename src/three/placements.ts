import {
  HALLS,
  evenSlotsOnWall,
  slotPose,
  wallCapacityOnWall,
  type Slot,
  type Space,
  type WallId,
} from '../domain/gallery'

export interface ManifestArt {
  id: string
  src: string
  srcLo?: string
  srcHd?: string
  category?: string
  theme?: string
  widthPx: number
  heightPx: number
  orientation: 'portrait' | 'landscape'
  hall: string
}

export interface Placement {
  index: number
  art: ManifestArt
  hall: Space
  slot: Slot
  photoW: number
  photoH: number
}

// 观展墙序（U 型，随蛇形动线）：进门左手长墙 → 远端墙 → 右手长墙 → 门侧墙收尾
const WALL_ORDER: Record<string, WallId[]> = {
  H1: ['S', 'W', 'N', 'E'],
  H2: ['N', 'W', 'S', 'E'],
  H3: ['W', 'N', 'E', 'S'],
  H4: ['N', 'E', 'S', 'W'],
}

// 零裁剪画框基准：竖幅定高 2.1 / 横幅定宽 1.9；极端长宽比只等比缩小到 MAX 盒内，永不裁剪/拉伸
const PORTRAIT_H = 2.1
const LANDSCAPE_W = 1.9
const MAX_W = 2.4
const MAX_H = 2.3

/** 每厅精选上墙数（v6：统一 3.5m 中心距下四厅容量恰为 15，cap 同值兜底；总 60） */
export const SELECT_CAP = 15

function fitPhoto(ratio: number, portrait: boolean) {
  let w = portrait ? PORTRAIT_H * ratio : LANDSCAPE_W
  let h = portrait ? PORTRAIT_H : LANDSCAPE_W / ratio
  if (w > MAX_W) {
    w = MAX_W
    h = w / ratio
  }
  if (h > MAX_H) {
    h = MAX_H
    w = h * ratio
  }
  return { photoW: w, photoH: h }
}

function wallLen(hall: Space, w: WallId) {
  return w === 'N' || w === 'S' ? hall.x1 - hall.x0 : hall.z1 - hall.z0
}

/**
 * 按各墙「定距容量」分配作品数（最大余数法，且每墙不超过自身容量）。
 * v6 修正：旧实现用「实墙长度比例」分配，会把 5 幅硬塞进只能放 4 幅的墙，
 * 导致该墙中心距被压到 2.6m —— 与「全馆统一间距」直接冲突。
 */
function allocByCapacity(caps: number[], count: number): number[] {
  const out = caps.map(() => 0)
  const total = caps.reduce((s, c) => s + c, 0)
  const want = Math.min(count, total)
  if (want <= 0) return out
  if (want <= caps.length) {
    const order = caps.map((c, i) => ({ c, i })).sort((a, b) => b.c - a.c || a.i - b.i)
    for (let k = 0; k < want; k++) out[order[k].i] = 1
    return out
  }
  const raw = caps.map((c) => (want * c) / total)
  const base = raw.map((r, i) => Math.min(caps[i], Math.floor(r)))
  base.forEach((b, i) => (out[i] = b))
  let used = base.reduce((s, b) => s + b, 0)
  const frac = raw
    .map((r, i) => ({ i, f: r - Math.floor(r) }))
    .sort((a, b) => b.f - a.f || a.i - b.i)
  let guard = 0
  while (used < want && guard < 1000) {
    for (const { i } of frac) {
      if (used >= want) break
      if (out[i] < caps[i]) {
        out[i] += 1
        used += 1
      }
    }
    guard += 1
  }
  return out
}

let cache: Promise<Placement[]> | null = null

/** 拉取 /manifest.json 并完成布展（模块级单例，全场景共享一次解析） */
export function loadPlacements(): Promise<Placement[]> {
  if (!cache) {
    cache = fetch(`${import.meta.env.BASE_URL}manifest.json`)
      .then((r) => r.json())
      .then((m: { artworks: ManifestArt[] }) => pickPlacements(m.artworks))
  }
  return cache
}

/**
 * 精选布展（v6）：容量（统一 3.5m 中心距 + 端部 1.45m 留白）→ 每墙上限；
 * 每厅沿观展墙序按容量比例分配，再按定距居中落位。
 * 类目内按 stride 均匀采样（题材分布不扎堆），落选作品不上墙。
 */
export function pickPlacements(arts: ManifestArt[]): Placement[] {
  const out: Placement[] = []
  let index = 0
  for (const hall of HALLS) {
    const items = arts.filter((a) => a.hall === hall.id)
    if (items.length === 0) continue
    const order = WALL_ORDER[hall.id]
    const caps = order.map((w) => wallCapacityOnWall(wallLen(hall, w), hall.doors[w] ?? []))
    const n = Math.min(items.length, SELECT_CAP, caps.reduce((s, c) => s + c, 0))
    // 精选：类目内均匀采样（stride），保持题材时间序均匀分布
    const selected =
      items.length > n ? Array.from({ length: n }, (_, i) => items[Math.floor((i * items.length) / n)]) : items
    const alloc = allocByCapacity(caps, n)
    let k = 0
    order.forEach((wall, wi) => {
      const cnt = alloc[wi]
      if (cnt <= 0) return
      for (const at of evenSlotsOnWall(wallLen(hall, wall), hall.doors[wall] ?? [], cnt)) {
        const art = selected[k]
        if (!art) break
        const ratio = art.widthPx / art.heightPx
        const { photoW, photoH } = fitPhoto(ratio, art.orientation === 'portrait')
        out.push({ index: index++, art, hall, slot: { hallId: hall.id, wall, at, index: k }, photoW, photoH })
        k += 1
      }
    })
  }
  return out
}

/**
 * 大图飞行机位：站在画前正对画心（近景距离随画高自适应）。
 * 相机 YXZ 约定 forward=(-sin θ,0,-cos θ)：
 * 朝北 θ=π ｜ 朝南 θ=0 ｜ 朝西 θ=π/2 ｜ 朝东 θ=-π/2
 */
export function cameraStand(p: Placement, dist?: number) {
  const pose = slotPose(p.hall, p.slot)
  const cx = pose.x
  const cz = pose.z
  const d = dist ?? Math.max(1.35, Math.min(2.6, 2.45 * (p.photoH / PORTRAIT_H)))
  switch (p.slot.wall) {
    case 'N': return { x: cx, y: 1.65, z: cz - d, yaw: Math.PI, pitch: 0 }
    case 'S': return { x: cx, y: 1.65, z: cz + d, yaw: 0, pitch: 0 }
    case 'W': return { x: cx + d, y: 1.65, z: cz, yaw: Math.PI / 2, pitch: 0 }
    case 'E': return { x: cx - d, y: 1.65, z: cz, yaw: -Math.PI / 2, pitch: 0 }
  }
}
