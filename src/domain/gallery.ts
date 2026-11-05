// 展馆布局领域模型（v6 圆拱门修版，与 scripts/gen-floorplan.mjs / public/floorplan.svg 同源）
// 坐标：x 东向，z 北向，单位米；地面 y=0。
// 本模块为纯数据/纯函数，供 3D 建墙、碰撞体、小地图、布展算法共用。
//
// v3（2026-10-20）：紧凑高厅 18×13×5.2、主门 3.0m、冷银白灯带。
// v4：挂位端部留白 EDGE_KEEP=1.45、每厅精选上限收敛。
// v5：罗马半圆拱 PortalFrames（单 mesh 拱环）；挂距改「框边净隙」契约 HANG_GAP=2.63。
// v6（本次）：
//   ① 修门洞越界：CW 西端廊净宽 1.8 而门洞 1.8 却被摆在 at=1.2 → 东侧 -0.3m 穿墙；
//      H4 出口门 at=1.2/w3 → 南侧 -0.3m 拱环绕出墙角。CW 横向改 2.4（与 CS/CN 同宽），
//      出口门移到 z=17.4（两侧各留 0.5m 墙垛），动线随之东移。
//   ② 挂位改「全馆统一中心距」HANG_PITCH=3.5：不再逐墙自适应拉伸，同墙恒 3.5m，
//      不足一档的余量全部转为端部留白（老板要的「间距统一 + 留白」）。
//      画框外宽口径收敛为 FRAME_BORDER（单边 0.12m），渲染与契约同源。
//   ③ 拱门参数化：PORTAL 统一拱顶/拱环/骑缝，支持三档预设（?portal=gallery|monumental|layered）。
//   ④ 暗廊净高 3.6→4.0：给拱环上方留出 ≥0.2m 墙体，拱门不再顶到暗廊天花。
export const HALL = { length: 18, width: 13, height: 5.2 } as const
export const CORRIDOR = { width: 1.8, height: 4.0 } as const
export const LOBBY = { depth: 8, width: 6, height: 5.0 } as const
export const WALL_T = 0.2
/** 默认门洞宽（暗廊/走廊门）；主门（入/出口）per-door 加宽 */
export const DOOR_W = 1.8
export const DOOR_HALF = DOOR_W / 2

/**
 * 全馆统一挂位中心距（v6）：相邻画心（含框）中心距恒为 3.5m，不再逐墙拉伸。
 * 依据：最大画框外宽 2.14m（画心 1.9 + 单边 0.12 白卡纸+框梃）→ 最窄框边净隙 = 1.36m，
 * 远高于 v5 的 0.53m，也高于「框边净隙 ≥0.35」的旧硬下限。
 * 定距而非均摊的意义：18m 长墙 5 幅、13m 端墙 3~4 幅，中心距一律 3.5m，
 * 富余长度全部变成端部留白 —— 观感才是「策展留白」而不是「把墙填满」。
 */
export const HANG_PITCH = 3.5
/** 单边画框外扩：白卡纸 0.09 + 框梃 0.03（Artworks.tsx 与布展契约共用此值，禁止各写一份） */
export const FRAME_BORDER = 0.12
/** 画框外宽（含框） */
export const frameOuterW = (photoW: number) => photoW + FRAME_BORDER * 2

/**
 * 挂位端部留白：挂位中心距墙段端部（墙角/门洞边）≥1.45m。
 * 依据：画框半宽最大 1.07m + 0.38m 呼吸，画框永不凸入门洞/墙角。
 */
export const EDGE_KEEP = 1.45

export type WallId = 'N' | 'S' | 'E' | 'W'
export type SpaceKind = 'hall' | 'lobby' | 'corridor'

export interface Door {
  /** 沿墙位置：N/S 墙 = 自西角沿 x；E/W 墙 = 自南角沿 z */
  at: number
  /** 门洞净宽（缺省 DOOR_W=1.8；入/出口主门 3.0） */
  w?: number
  tag?: string
  outer?: boolean
}

export interface Space {
  id: string
  kind: SpaceKind
  name: string
  sub?: string
  x0: number
  z0: number
  x1: number
  z1: number
  h: number
  doors: Partial<Record<WallId, Door[]>>
}

// ── 空间模型：2×2 紧凑组团 + 蛇形动线 ──
// 门洞不变量（v6 起由测试钉死）：对每扇门，w/2 ≤ at ≤ 墙长 − w/2，
// 即门洞必须完整落在所属墙段内；否则门洞会开进封闭暗腔（穿墙视觉 bug）。
export const SPACES: Space[] = [
  { id: 'ENTRY', kind: 'lobby', name: '入口厅', x0: 37.8, z0: 0, x1: 45.8, z1: 6, h: LOBBY.height,
    doors: { W: [{ at: 3, w: 3, tag: '入口主门' }], E: [{ at: 3, w: 3, outer: true }] } },
  { id: 'H1', kind: 'hall', name: '展区一', sub: '首站', x0: 19.8, z0: 0, x1: 37.8, z1: 13, h: HALL.height,
    doors: { E: [{ at: 3, w: 3, tag: '入口' }], W: [{ at: 11.8, tag: '→展区二' }] } },
  { id: 'H2', kind: 'hall', name: '展区二', x0: 0, z0: 0, x1: 18, z1: 13, h: HALL.height,
    doors: { E: [{ at: 11.8, tag: '自展区一' }], N: [{ at: 1.2, tag: '→展区三' }] } },
  { id: 'H3', kind: 'hall', name: '展区三', x0: 0, z0: 15.4, x1: 18, z1: 28.4, h: HALL.height,
    doors: { S: [{ at: 1.2, tag: '自展区二' }], E: [{ at: 11.8, tag: '→展区四' }] } },
  // v6：出口门 z=17.4（H4 南角 15.4 + 0.5 墙垛 + 1.5 半宽）；v5 的 at=1.2 使南侧 −0.3m 越界
  { id: 'H4', kind: 'hall', name: '展区四', sub: '末站', x0: 19.8, z0: 15.4, x1: 37.8, z1: 28.4, h: HALL.height,
    doors: { W: [{ at: 11.8, tag: '自展区三' }], E: [{ at: 2.0, w: 3, tag: '出口' }] } },
  { id: 'EXIT', kind: 'lobby', name: '出口厅', x0: 37.8, z0: 12.6, x1: 45.8, z1: 20.6, h: LOBBY.height,
    doors: { W: [{ at: 4.8, w: 3, tag: '出口主门' }], E: [{ at: 4.8, w: 3, outer: true }] } },
  { id: 'CS', kind: 'corridor', name: '南中廊', x0: 18, z0: 10.6, x1: 19.8, z1: 13, h: CORRIDOR.height,
    doors: { W: [{ at: 1.2 }], E: [{ at: 1.2 }] } },
  // v6：横向净宽 1.8→2.4，与 CS/CN 统一；门洞 1.8 居中留 0.3m 墙垛（v5 为 −0.3m 越界）
  { id: 'CW', kind: 'corridor', name: '西端廊', x0: 0, z0: 13, x1: 2.4, z1: 15.4, h: CORRIDOR.height,
    doors: { S: [{ at: 1.2 }], N: [{ at: 1.2 }] } },
  { id: 'CN', kind: 'corridor', name: '北中廊', x0: 18, z0: 26, x1: 19.8, z1: 28.4, h: CORRIDOR.height,
    doors: { W: [{ at: 1.2 }], E: [{ at: 1.2 }] } },
]

export const HALLS = SPACES.filter((s) => s.kind === 'hall')

// 封闭暗腔（仅渲染用地面提示；碰撞由围合墙保证）
export const VOIDS = [
  { x0: 18, z0: 0, x1: 19.8, z1: 10.6 },
  { x0: 18, z0: 13, x1: 19.8, z1: 26 },
  { x0: 2.4, z0: 13, x1: 18, z1: 15.4 },
  { x0: 19.8, z0: 13, x1: 37.8, z1: 15.4 },
]

export const SITE = { x0: 0, z0: 0, x1: 45.8, z1: 28.4 }

// 蛇形动线节点（直角过门心；主门 3.0、暗廊门 1.8，胶囊半径 0.35，净距安全；全程 ~104m）
export const ROUTE: Array<[number, number]> = [
  [44, 3],
  [21.4, 3], [21.4, 11.8], [16.8, 11.8], // 入口厅 → 展区一 → 南中廊 → 展区二
  [1.2, 11.8], [1.2, 16.6], // 展区二 → 西端廊 → 展区三
  [1.2, 27.2], [21.4, 27.2], // 展区三 → 北中廊 → 展区四
  [36.4, 27.2], [36.4, 17.4], [41.8, 17.4], // 展区四 → 出口厅（出口门 z=17.4）
]

export const SPACE_BY_ID = new Map(SPACES.map((s) => [s.id, s]))

/** 出生点：入口外门内侧，面向西（-x）朝展区一 */
export const SPAWN = { x: 44.2, y: 1.7, z: 3, yaw: -Math.PI / 2 }

// ── 圆拱门参数（唯一真源；渲染、平面图、测试全部读这里） ──
export type PortalPresetId = 'gallery' | 'monumental' | 'layered'

export interface PortalSpec {
  id: PortalPresetId
  name: string
  /** 主门（净宽 ≥2.4）拱顶净高 */
  apexMain: number
  /** 暗廊门（净宽 1.8）拱顶净高 */
  apexPassage: number
  /** 拱环宽（洞缘外扩），同一拱门家族统一 */
  ring: number
  /** 拱环相对墙面的骑缝突出（单侧） */
  proud: number
  /** 设计意图说明 */
  note: string
}

/**
 * 三档预设：拱环宽/骑缝/构造完全一致，只改拱顶标高或主次分级。
 * 切换方式：URL 加 ?portal=monumental / ?portal=layered（默认 gallery）。
 * 暗廊净高 4.0 是上限约束：最深拱 3.75 + 拱环 0.16 = 3.91 ≤ 4.0。
 */
export const PORTAL_PRESETS: Record<PortalPresetId, PortalSpec> = {
  gallery: {
    id: 'gallery',
    name: '高拱 · 全馆统一拱顶',
    apexMain: 3.5,
    apexPassage: 3.5,
    ring: 0.14,
    proud: 0.02,
    note: '同一拱顶标高贯穿全馆：主门 3.0×3.5（起拱 2.0）、暗廊门 1.8×3.5（起拱 2.6）。节奏统一、比例最接近真实罗马半圆拱。',
  },
  monumental: {
    id: 'monumental',
    name: '纪念碑 · 更高拱顶',
    apexMain: 3.75,
    apexPassage: 3.75,
    ring: 0.16,
    proud: 0.025,
    note: '拱顶抬到 3.75m（厅高 72%），拱环加宽到 0.16。仪式感最强，但 1.8m 暗廊门呈 1:2.08 窄高拱，仰视偏压迫。',
  },
  layered: {
    id: 'layered',
    name: '双档 · 主次分层',
    apexMain: 3.5,
    apexPassage: 3.15,
    ring: 0.14,
    proud: 0.02,
    note: '主门 3.5 / 暗廊 3.15，以拱顶高度区分主次空间。暗廊更含蓄、拱上留墙更多，但全馆拱顶不再同一标高。',
  },
}

function readPreset(): PortalPresetId {
  if (typeof window === 'undefined') return 'gallery'
  const v = new URLSearchParams(window.location.search).get('portal')
  return v === 'monumental' || v === 'layered' || v === 'gallery' ? v : 'gallery'
}

/** 当前生效的拱门规格（模块级单例，URL 决定） */
export const PORTAL: PortalSpec = PORTAL_PRESETS[readPreset()]

/** 门洞是否按主门档（净宽 ≥2.4m）建拱 */
export const isMainDoor = (w: number) => w >= 2.4

/** 拱门起拱线高度 = 拱顶 − 半径（半圆拱：r = 净宽/2） */
export function portalSpring(w: number, spec: PortalSpec = PORTAL): number {
  return (isMainDoor(w) ? spec.apexMain : spec.apexPassage) - w / 2
}

/** 拱门净高（拱顶）= 起拱线 + 半径 */
export function portalApex(w: number, spec: PortalSpec = PORTAL): number {
  return portalSpring(w, spec) + w / 2
}

// ── 纯函数 ──

/** 墙面扣除门洞后的实墙区间（沿墙坐标 0..len；门宽 per-door；超界段会被夹紧） */
export function wallRuns(len: number, doors: Door[] = []): Array<[number, number]> {
  const cuts = doors
    .map((d): [number, number] => [Math.max(0, d.at - (d.w ?? DOOR_W) / 2), Math.min(len, d.at + (d.w ?? DOOR_W) / 2)])
    .sort((a, b) => a[0] - b[0])
  const runs: Array<[number, number]> = []
  let cur = 0
  for (const [a, b] of cuts) {
    if (a > cur) runs.push([cur, a])
    cur = Math.max(cur, b)
  }
  if (cur < len) runs.push([cur, len])
  return runs
}

/**
 * 定距容量（v6）：每个实墙段的净挂区（扣除两端 EDGE_KEEP）能放下几个「间距恒为 pitch」的挂位。
 * k 个挂位占 (k−1)·pitch，居中后两端余量 = (段长−2E−(k−1)pitch)/2 ≥ 0
 *   ⇒ k ≤ floor((段长−2E)/pitch) + 1。
 * 这与 v5 的 floor(净长/pitch) 差 1 位，因为 v5 是「均摊」语义、v6 是「定距」语义。
 */
export function wallCapacityOnWall(len: number, doors: Door[] = [], pitch = HANG_PITCH): number {
  return wallRuns(len, doors)
    .filter(([a, b]) => b - a >= EDGE_KEEP * 2 + pitch)
    .reduce((s, [a, b]) => s + Math.floor((b - a - 2 * EDGE_KEEP) / pitch) + 1, 0)
}

/** 最大余数法把 n 个挂位分配到大墙段（优先保证每段至少 1 位） */
function allocRuns(caps: number[], n: number): number[] {
  const out = caps.map(() => 0)
  const total = caps.reduce((s, c) => s + c, 0)
  const want = Math.max(0, Math.min(n, total))
  if (want === 0) return out
  if (want <= caps.length) {
    // 少于段数：给最长的 want 段各 1 位
    const order = caps.map((c, i) => ({ c, i })).sort((a, b) => b.c - a.c || a.i - b.i)
    for (let k = 0; k < want; k++) out[order[k].i] = 1
    return out
  }
  caps.forEach((_, i) => (out[i] = 1))
  const left = want - caps.length
  const room = caps.map((c) => c - 1)
  const roomTotal = room.reduce((s, c) => s + c, 0) || 1
  const raw = room.map((c) => (left * c) / roomTotal)
  const base = raw.map((r) => Math.floor(r))
  base.forEach((b, i) => (out[i] += b))
  let used = base.reduce((s, b) => s + b, 0)
  const frac = raw.map((r, i) => ({ i, f: r - Math.floor(r) })).sort((a, b) => b.f - a.f)
  for (let k = 0; used < left; k = (k + 1) % frac.length) {
    out[frac[k].i] += 1
    used += 1
  }
  return out
}

/**
 * 定距挂位（v6）：count 个挂位按全馆统一中心距 pitch 铺开，整组在各实墙段内居中。
 * 与 v5 的关键差别：v5 用「净长/count」当步长（画多就自动收紧 → 每面墙间距都不一样）；
 * v6 步长恒为 pitch，放不满的余量留在两端当留白。
 * 返回沿墙坐标（升序，2 位小数）。
 */
export function evenSlotsOnWall(len: number, doors: Door[] = [], count: number, pitch = HANG_PITCH): number[] {
  if (count <= 0) return []
  const runs = wallRuns(len, doors).filter(([a, b]) => b - a >= EDGE_KEEP * 2 + pitch)
  if (runs.length === 0) return []
  const caps = runs.map(([a, b]) => Math.floor((b - a - 2 * EDGE_KEEP) / pitch) + 1)
  const alloc = allocRuns(caps, count)
  const out: number[] = []
  runs.forEach(([a, b], i) => {
    const k = alloc[i]
    if (k <= 0) return
    const span = (k - 1) * pitch
    const start = a + (b - a - span) / 2
    for (let j = 0; j < k; j++) out.push(Math.round((start + j * pitch) * 100) / 100)
  })
  return out.sort((x, y) => x - y)
}

export function spaceSize(s: Space) {
  return { len: s.x1 - s.x0, wid: s.z1 - s.z0 }
}

export interface Slot {
  hallId: string
  wall: WallId
  at: number
  index: number
}

/**
 * 把挂位转成世界坐标 + 朝向（供装裱/射灯使用）。
 * 墙面内缩 0.12m；frame 面法线朝向室内。
 */
export function slotPose(hall: Space, slot: Slot) {
  const { x0, z0, x1, z1 } = hall
  const inset = WALL_T / 2 + 0.06
  switch (slot.wall) {
    case 'N':
      return { x: x0 + slot.at, z: z1 - inset, rotationY: Math.PI } // 画面朝南
    case 'S':
      return { x: x0 + slot.at, z: z0 + inset, rotationY: 0 }
    case 'W':
      return { x: x0 + inset, z: z0 + slot.at, rotationY: Math.PI / 2 } // 画面朝东
    case 'E':
      return { x: x1 - inset, z: z0 + slot.at, rotationY: -Math.PI / 2 }
  }
}

/** 射灯位/目标（轨道头贴顶，向画心斜打 30°） */
export function spotPose(hall: Space, slot: Slot) {
  const pose = slotPose(hall, slot)
  const dir: Record<WallId, [number, number]> = {
    N: [0, -1],
    S: [0, 1],
    W: [1, 0],
    E: [-1, 0],
  }
  const [dx, dz] = dir[slot.wall]
  const reach = 0.85 // 灯距墙水平距离
  return {
    pos: { x: pose.x + dx * reach, y: hall.h - 0.28, z: pose.z + dz * reach },
    target: { x: pose.x, y: 1.65, z: pose.z },
  }
}

/** 玩家所在空间（用于 HUD 区名） */
export function zoneAt(x: number, z: number): Space | null {
  for (const s of SPACES) {
    if (x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1) return s
  }
  return null
}

// 墙的世界几何描述（建墙 + 碰撞体同源）
export interface WallBox {
  cx: number
  cy: number
  cz: number
  sx: number
  sy: number
  sz: number
}

export function wallBoxes(): WallBox[] {
  const boxes: WallBox[] = []
  for (const s of SPACES) {
    const { len, wid } = spaceSize(s)
    const add = (cx: number, cz: number, sx: number, sz: number) =>
      boxes.push({ cx, cy: s.h / 2, cz, sx, sy: s.h, sz })
    const run = (wall: WallId) => wallRuns(wall === 'N' || wall === 'S' ? len : wid, s.doors[wall] ?? [])
    for (const [a, b] of run('N')) add(s.x0 + (a + b) / 2, s.z1, b - a, WALL_T)
    for (const [a, b] of run('S')) add(s.x0 + (a + b) / 2, s.z0, b - a, WALL_T)
    for (const [a, b] of run('E')) add(s.x1, s.z0 + (a + b) / 2, WALL_T, b - a)
    for (const [a, b] of run('W')) add(s.x0, s.z0 + (a + b) / 2, WALL_T, b - a)
  }
  return boxes
}

// ── H3「海与港」悬垂海浪丝带装置（v8：灰模预演 → 玻璃海材质）──
/**
 * 5 条宽幅丝带以长凳为中心、半环排布（弧心 = H3 中心，开口朝南），从发光天棚垂直垂下。
 * 硬约束（单测钉死）：
 * - 底沿 2.05 > 眼高 1.7 + 0.3 → 可穿行、不挡视线；
 * - 顶沿 5.02 < 灯头下沿 5.09，弧位最远 z=24.80 < 灯轨 z=25.10；
 * - 全部落在天棚发光板投影内（x 0.45..17.55 / z 15.85..27.95）。
 */
const H3_CENTER = (() => {
  const h = SPACES.find((s) => s.id === 'H3')!
  return { x: (h.x0 + h.x1) / 2, z: (h.z0 + h.z1) / 2 }
})()

export const SEA_RIBBONS = {
  hallId: 'H3',
  count: 5,
  center: H3_CENTER,
  /** 半环半径（以长凳中心为圆心） */
  radius: 2.9,
  /** 半环张角（度），开口朝南（来向） */
  arcDeg: 140,
  /** 丝带宽（老板要“宽一点”） */
  width: 1.1,
  /** 顶部挂点（发光天棚下沿） */
  topY: 5.02,
  /** 下沿高度：下探到长凳面（0.34）上方 0.26m，形成「垂到凳前」的纵向关系（v8.1） */
  bottomY: 0.6,
  /** 中心线侧摆振幅（m），顶端固定、底端摆幅最大 */
  sway: 0.3,
  /** 横向扭转角（rad），决定绸带翻卷的幅度 */
  twist: 0.3,
  /** 吊索顶端（发光天棚平面） */
  cableY: 5.13,
} as const

/** 5 条丝带的平面位置与朝向（ry：绕 y 旋转角，使丝带宽面法线指向弧心/长凳） */
export function ribbonSlots(spec: typeof SEA_RIBBONS = SEA_RIBBONS): Array<{ x: number; z: number; ry: number }> {
  const out: Array<{ x: number; z: number; ry: number }> = []
  const n: number = spec.count
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1)
    const th = ((-spec.arcDeg / 2 + spec.arcDeg * t) * Math.PI) / 180
    out.push({
      x: spec.center.x + spec.radius * Math.sin(th),
      z: spec.center.z + spec.radius * Math.cos(th),
      ry: th + Math.PI,
    })
  }
  return out
}

// ── H2「双城纪事」中庭：澳门大三巴牌坊（老板拍板 B+ 分层构件 + 壁龛浮雕贴图）──
/**
 * 尺度推导（不是估计）：
 * - 真迹：宽 23m × 高 25.5m，面宽:高 = 1:1.109 → 本馆立面 2.00m × 2.22m；
 * - 屏风式前壁：主体进深 0.38m，檐口外挑 0.06m，不做教堂体块；
 * - 石台 0.22m + 四级台阶 0.12m + 立面 2.22m = 2.56m，压在北墙画顶遮挡红线 2.60m 之下；
 * - 台座 2.60×0.95m，碰撞盒 2.80×1.15m；动线 z=11.8 到台座外缘净距 4.72m。
 */
const H2_CENTER = (() => {
  const h = SPACES.find((s) => s.id === 'H2')!
  return { x: (h.x0 + h.x1) / 2, z: (h.z0 + h.z1) / 2 }
})()

export const RUINS_STPAUL = {
  hallId: 'H2',
  center: H2_CENTER,
  /** 立面总高（四层主体 + 三角山花 + 十字架，不含石台/台阶） */
  facadeH: 2.22,
  /** 石灰华石台高 */
  plinthH: 0.22,
  /** 台阶级数与单级高（4×0.03 = 0.12） */
  stepCount: 4,
  stepH: 0.03,
  /** 立面底宽（真迹 23m 折算；3D 横向体量靠宽度而非高度） */
  baseW: 2.0,
  /** 屏风式前壁主体进深 */
  depth: 0.38,
  /** 台座尺寸（宽×深） */
  plinthW: 2.6,
  plinthD: 0.95,
  /** 遮挡红线：台座 + 台阶 + 立面总高 ≤2.6m */
  maxTotalH: 2.6,
} as const

/** 十字架高度（三角山花顶 → 立面顶） */
export const STPAUL_CROSS_H = 0.22

/** 立面分层（渲染构件表与单测共用的唯一真源；y 自立面底沿起算，单位米） */
export interface StPaulTier {
  /** 层底标高 */
  y: number
  /** 层高 */
  h: number
  /** 层底宽（逐层收分） */
  w: number
}

/** 四层主体 + 三角山花：层高 0.506/0.452/0.405/0.327、山花 0.31，合计 2.00 */
export const STPAUL_TIERS: StPaulTier[] = [
  { y: 0, h: 0.506, w: 2.0 },
  { y: 0.506, h: 0.452, w: 1.912 },
  { y: 0.958, h: 0.405, w: 1.813 },
  { y: 1.363, h: 0.327, w: 1.613 },
  { y: 1.69, h: 0.31, w: 1.513 },
]

/** 牌坊派生尺寸（渲染、单测、碰撞盒共用一个真源，禁止各处重算） */
export function ruinsMetrics(spec: typeof RUINS_STPAUL = RUINS_STPAUL) {
  const totalH = spec.plinthH + spec.stepCount * spec.stepH + spec.facadeH
  const crown = STPAUL_TIERS[STPAUL_TIERS.length - 1]
  return {
    totalH,
    /** 立面宽高比（真迹 23:25.5 = 1:1.109） */
    aspect: spec.facadeH / spec.baseW,
    /** 收分比（顶宽 / 底宽） */
    taper: crown.w / spec.baseW,
    /** 碰撞盒（台座外接 + 台阶出挑 0.10） */
    box: { w: spec.plinthW + 0.2, d: spec.plinthD + 0.2 },
    /** 立面分层顶标高（应等于 facadeH − 十字架高） */
    tierTop: crown.y + crown.h,
    /** 动线 z=11.8 到台座外缘的净距（立面朝 +x，宽度落在世界 z 轴） */
    routeClear: 11.8 - (spec.center.z + (spec.plinthW + 0.2) / 2),
    /** 东门 (18,11.8) 望立面顶的仰角（度） */
    eastDoorDeg:
      (Math.atan2(totalH - 1.7, Math.hypot(18 - spec.center.x, 11.8 - spec.center.z)) * 180) / Math.PI,
  }
}


/** 门洞在墙内的合法性（v6 不变量）：门洞与拱环都必须完整落在所属墙段内 */
export function doorViolations(): string[] {
  const bad: string[] = []
  for (const s of SPACES) {
    const { len, wid } = spaceSize(s)
    for (const wall of ['N', 'S', 'E', 'W'] as WallId[]) {
      const span = wall === 'N' || wall === 'S' ? len : wid
      for (const d of s.doors[wall] ?? []) {
        const w = d.w ?? DOOR_W
        const lo = d.at - w / 2
        const hi = d.at + w / 2
        const ring = PORTAL.ring
        if (lo < 1e-6 || hi > span + 1e-6) {
          bad.push(`${s.id}.${wall} 门洞越界: [${lo.toFixed(2)}, ${hi.toFixed(2)}] ⊄ [0, ${span.toFixed(2)}]`)
        }
        if (lo - ring < -1e-6 || hi + ring > span + 1e-6) {
          bad.push(`${s.id}.${wall} 拱环绕出墙角: [${(lo - ring).toFixed(2)}, ${(hi + ring).toFixed(2)}] ⊄ [0, ${span.toFixed(2)}]`)
        }
      }
    }
  }
  return bad
}
