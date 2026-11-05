// 平面设计图生成器（v6 圆拱门修版，2026-10-20）
// 输出：public/floorplan.svg —— 与 src/domain/gallery.ts 同源（高厅 18×13×5.2）。
// v6 变更：① 修 CW 暗廊门洞越界（净宽 1.8 时门洞 -0.3m 穿墙）→ 横向改 2.4；
//   ② 修 H4 出口门 at=1.2/w3 南侧越界 → 移至 z=17.4；③ 挂位改全馆统一中心距 3.5m（不再逐墙拉伸）；
//   ④ 拱顶 3.2→3.5，暗廊净高 3.6→4.0，拱环 0.14/骑缝 0.02。
//
// 建筑坐标：x = 东向（图纸向右），z = 北向（图纸向上），单位米。
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

// ───────────────────────── 布局常量 ─────────────────────────
const HALL = { length: 18, width: 13, height: 5.2 }
const CORRIDOR = { length: 2.4, width: 1.8, height: 4.0 }
const LOBBY = { depth: 8, width: 6, height: 5.0 } // 入口/出口厅：进深8（东西）×面宽6
const GAP = 2.4 // 厅间暗腔/暗廊带宽
const WALL_T = 0.2
const DOOR_W = 1.8 // 默认门洞 1.8m（暗廊门）；主门/厅口/出口用 per-door w:3
const DOOR_HALF = DOOR_W / 2

// 挂位规则（v6）：全馆统一中心距 3.5m + 端部留白 ≥1.45m；画框外宽 = 画心 + 0.24
const HANG_PITCH = 3.5
const FRAME_W = 1.8 // 图示例画框外宽代表值
const EDGE_KEEP = 1.45
const ARCH_APEX = 3.5 // 拱顶净高（主门与暗廊门同一标高）
const ARCH_RING = 0.14
const ARTWORKS = [15, 15, 15, 15] // 精选 60 分配（库 148：44/42/36/26）

// ───────────────────────── 空间模型（2×2 紧凑组团 + 蛇形动线） ─────────────────────────
// 参观顺序：入口厅(东南) → 展区一(右下) → 南中廊 → 展区二(左下) → 西端廊
//          → 展区三(左上) → 北中廊 → 展区四(右上) → 出口厅(东北)
// 门 at 坐标：N/S 墙 = 自西角沿 x；E/W 墙 = 自南角沿 z。
const SPACES = [
  { id: 'ENTRY', kind: 'lobby', name: '入口厅', x0: 37.8, z0: 0, x1: 45.8, z1: 6,
    doors: { W: [{ at: 3, w: 3 }], E: [{ at: 3, w: 3, outer: true }] } },
  { id: 'H1', kind: 'hall', name: '展区一', sub: '首站 · 右下', x0: 19.8, z0: 0, x1: 37.8, z1: 13,
    doors: { E: [{ at: 3, w: 3, tag: '入口' }], W: [{ at: 11.8, tag: '→展区二' }] } },
  { id: 'H2', kind: 'hall', name: '展区二', sub: '左下', x0: 0, z0: 0, x1: 18, z1: 13,
    doors: { E: [{ at: 11.8, tag: '自展区一' }], N: [{ at: 1.2, tag: '→展区三' }] } },
  { id: 'H3', kind: 'hall', name: '展区三', sub: '左上', x0: 0, z0: 15.4, x1: 18, z1: 28.4,
    doors: { S: [{ at: 1.2, tag: '自展区二' }], E: [{ at: 11.8, tag: '→展区四' }] } },
  { id: 'H4', kind: 'hall', name: '展区四', sub: '末站 · 右上', x0: 19.8, z0: 15.4, x1: 37.8, z1: 28.4,
    doors: { W: [{ at: 11.8, tag: '自展区三' }], E: [{ at: 2.0, w: 3, tag: '出口' }] } },
  { id: 'EXIT', kind: 'lobby', name: '出口厅', x0: 37.8, z0: 12.6, x1: 45.8, z1: 20.6,
    doors: { W: [{ at: 4.8, w: 3 }], E: [{ at: 4.8, w: 3, outer: true }] } },
  { id: 'CS', kind: 'corridor', name: '暗廊', x0: 18, z0: 10.6, x1: 19.8, z1: 13,
    doors: { W: [{ at: 1.2 }], E: [{ at: 1.2 }] } },
  // v6：横向净宽 1.8 → 2.4（v5 门洞 at=1.2/w1.8 在东侧 -0.3m 穿墙）
  { id: 'CW', kind: 'corridor', name: '暗廊', x0: 0, z0: 13, x1: 2.4, z1: 15.4,
    doors: { S: [{ at: 1.2 }], N: [{ at: 1.2 }] } },
  { id: 'CN', kind: 'corridor', name: '暗廊', x0: 18, z0: 26, x1: 19.8, z1: 28.4,
    doors: { W: [{ at: 1.2 }], E: [{ at: 1.2 }] } },
]

// 封闭暗腔（厅间 2.4m 夹道，不可进入；图上灰底点阵）
const VOIDS = [
  { x0: 18, z0: 0, x1: 19.8, z1: 10.6 },   // 纵缝南段
  { x0: 18, z0: 13, x1: 19.8, z1: 26 },    // 纵缝中北段（含十字腔）
  { x0: 2.4, z0: 13, x1: 18, z1: 15.4 },   // 横缝西段
  { x0: 19.8, z0: 13, x1: 37.8, z1: 15.4 }, // 横缝东段
]

// 蛇形动线节点（世界坐标米）
const ROUTE = [
  [46.6, 3], [44, 3],
  [21.4, 3], [21.4, 11.8], [16.8, 11.8], [1.2, 11.8],
  [1.2, 16.6], [1.2, 27.2], [21.4, 27.2],
  [36.4, 27.2], [36.4, 17.4], [41.8, 17.4], [46.6, 17.4],
]
const SEQUENCE = [
  { n: 1, x: 41.8, z: 3, label: '入口厅' },
  { n: 2, x: 28.8, z: 6.5, label: '展区一' },
  { n: 3, x: 9, z: 6.5, label: '展区二' },
  { n: 4, x: 9, z: 21.9, label: '展区三' },
  { n: 5, x: 28.8, z: 21.9, label: '展区四' },
  { n: 6, x: 41.8, z: 17.4, label: '出口厅' },
]

const SITE = { x0: 0, z0: 0, x1: 45.8, z1: 28.4 }

// ───────────────────────── SVG 基础 ─────────────────────────
const C = {
  ink: '#1f2937',
  wall: '#111827',
  slot: '#b45309',
  lamp: '#d97706',
  route: '#b91c1c',
  dim: '#6b7280',
  fillHall: '#f8fafc',
  fillLobby: '#eef2ff',
  fillCorr: '#e2e0da',
  voidFill: '#f1f0ee',
  note: '#374151',
}
const FONT = `font-family="PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif"`
const esc = (n) => Math.round(n * 100) / 100

function line(x1, y1, x2, y2, extra = '') {
  return `<line x1="${esc(x1)}" y1="${esc(y1)}" x2="${esc(x2)}" y2="${esc(y2)}" ${extra}/>`
}
function text(x, y, str, extra = '') {
  return `<text x="${esc(x)}" y="${esc(y)}" ${FONT} ${extra}>${str}</text>`
}
function rect(x, y, w, h, extra = '') {
  return `<rect x="${esc(x)}" y="${esc(w < 0 ? y + h : y)}" width="${esc(Math.abs(w))}" height="${esc(Math.abs(h))}" ${extra}/>`
}
function circle(cx, cy, r, extra = '') {
  return `<circle cx="${esc(cx)}" cy="${esc(cy)}" r="${esc(r)}" ${extra}/>`
}

// 墙面开门：返回扣除门洞后的实墙区间（per-door 门宽，默认 1.8m）
function wallRuns(len, doors = []) {
  const cuts = doors.map((d) => {
    const half = (d.w ?? DOOR_W) / 2
    return [Math.max(0, d.at - half), Math.min(len, d.at + half)]
  }).sort((a, b) => a[0] - b[0])
  const runs = []
  let cur = 0
  for (const [a, b] of cuts) {
    if (a > cur) runs.push([cur, a])
    cur = Math.max(cur, b)
  }
  if (cur < len) runs.push([cur, len])
  return runs
}

// 容量与挂位（与 src/domain/gallery.ts 同源 v6）：k 个定距挂位占 (k−1)·pitch
//   ⇒ k ≤ floor((段长−2E)/pitch) + 1；段长 < 2E+pitch 的边角料跳过
function wallCapacityOnWall(len, doors = []) {
  return wallRuns(len, doors)
    .filter(([a, b]) => b - a >= EDGE_KEEP * 2 + HANG_PITCH)
    .reduce((s, [a, b]) => s + Math.floor((b - a - 2 * EDGE_KEEP) / HANG_PITCH) + 1, 0)
}

// 定距挂位（v6）：步长恒为 HANG_PITCH，整组在实墙段内居中，余量留在两端当留白
function slotsOnWall(len, doors = [], count = wallCapacityOnWall(len, doors)) {
  if (count <= 0) return []
  const runs = wallRuns(len, doors).filter(([a, b]) => b - a >= EDGE_KEEP * 2 + HANG_PITCH)
  if (runs.length === 0) return []
  const caps = runs.map(([a, b]) => Math.floor((b - a - 2 * EDGE_KEEP) / HANG_PITCH) + 1)
  const total = caps.reduce((s, c) => s + c, 0)
  const want = Math.min(count, total)
  const out = []
  runs.forEach(([a, b], i) => {
    // 简化分配（平面图仅作示意）：按容量比例取整，保证总数精确
    const k = runs.length === 1 ? want : Math.max(0, Math.min(caps[i], Math.round((want * caps[i]) / total)))
    if (k <= 0) return
    const span = (k - 1) * HANG_PITCH
    const start = a + (b - a - span) / 2
    for (let j = 0; j < k; j++) out.push(Math.round((start + j * HANG_PITCH) * 100) / 100)
  })
  return out.sort((x, y) => x - y)
}

// ───────────────────────── 总平面图 ─────────────────────────
function buildOverview() {
  const S = 13
  const OX = 92
  const TOP = 128
  const X = (m) => OX + m * S
  const Y = (z) => TOP + (SITE.z1 - z) * S
  const out = []

  // 暗腔
  for (const v of VOIDS) {
    out.push(rect(X(v.x0), Y(v.z1), (v.x1 - v.x0) * S, (v.z1 - v.z0) * S, `fill="url(#voidDot)" stroke="none"`))
  }

  // 空间填色
  for (const s of SPACES) {
    const fill = s.kind === 'hall' ? C.fillHall : s.kind === 'lobby' ? C.fillLobby : C.fillCorr
    out.push(rect(X(s.x0), Y(s.z1), (s.x1 - s.x0) * S, (s.z1 - s.z0) * S, `fill="${fill}" stroke="none"`))
  }

  const wallAttr = `stroke="${C.wall}" stroke-width="2.6" stroke-linecap="square"`
  // 墙体（四面，门洞断开）
  for (const s of SPACES) {
    const D = s.doors
    for (const [lo, hi] of wallRuns(s.x1 - s.x0, D.N)) out.push(line(X(s.x0 + lo), Y(s.z1), X(s.x0 + hi), Y(s.z1), wallAttr))
    for (const [lo, hi] of wallRuns(s.x1 - s.x0, D.S)) out.push(line(X(s.x0 + lo), Y(s.z0), X(s.x0 + hi), Y(s.z0), wallAttr))
    for (const [lo, hi] of wallRuns(s.z1 - s.z0, D.E)) out.push(line(X(s.x1), Y(s.z0 + lo), X(s.x1), Y(s.z0 + hi), wallAttr))
    for (const [lo, hi] of wallRuns(s.z1 - s.z0, D.W)) out.push(line(X(s.x0), Y(s.z0 + lo), X(s.x0), Y(s.z0 + hi), wallAttr))
  }

  // 外门门扇符号（东立面，向内 -x 开启；门宽 per-door）
  const outerDoors = [
    { zc: SPACES[0].doors.E[0].at + SPACES[0].z0, hw: (SPACES[0].doors.E[0].w ?? DOOR_W) / 2 },
    { zc: SPACES[5].doors.E[0].at + SPACES[5].z0, hw: (SPACES[5].doors.E[0].w ?? DOOR_W) / 2 },
  ]
  for (const { zc, hw } of outerDoors) {
    const r = hw * S
    const xe = X(SITE.x1)
    const yC = Y(zc), yLo = Y(zc - hw), yHi = Y(zc + hw)
    const xOpen = X(SITE.x1) - r
    out.push(line(xe, yLo, xOpen, yLo, `stroke="${C.ink}" stroke-width="1.1"`))
    out.push(line(xe, yHi, xOpen, yHi, `stroke="${C.ink}" stroke-width="1.1"`))
    out.push(`<path d="M ${esc(xe)} ${esc(yC)} A ${esc(r)} ${esc(r)} 0 0 0 ${esc(xOpen)} ${esc(yLo)}" fill="none" stroke="${C.dim}" stroke-width="0.7"/>`)
    out.push(`<path d="M ${esc(xe)} ${esc(yC)} A ${esc(r)} ${esc(r)} 0 0 1 ${esc(xOpen)} ${esc(yHi)}" fill="none" stroke="${C.dim}" stroke-width="0.7"/>`)
  }

  // 动线（红色虚线，逐段箭头）
  for (let i = 0; i < ROUTE.length - 1; i++) {
    const [ax, az] = ROUTE[i]
    const [bx, bz] = ROUTE[i + 1]
    out.push(line(X(ax), Y(az), X(bx), Y(bz),
      `stroke="${C.route}" stroke-width="1.7" stroke-dasharray="7 5" marker-end="url(#arrow)" fill="none" stroke-linecap="round"`))
  }

  // 序号泡
  for (const q of SEQUENCE) {
    out.push(circle(X(q.x), Y(q.z), 11.5, `fill="#ffffff" stroke="${C.route}" stroke-width="1.8"`))
    out.push(text(X(q.x), Y(q.z) + 4.2, String(q.n), `font-size="12" font-weight="800" fill="${C.route}" text-anchor="middle"`))
  }

  // 标签
  for (const s of SPACES) {
    const cx = X((s.x0 + s.x1) / 2)
    if (s.kind === 'hall') {
      out.push(text(cx, Y(s.z1) - 12, s.name, `font-size="15" font-weight="800" fill="${C.ink}" text-anchor="middle"`))
      out.push(text(cx, Y(s.z1) - 27, s.sub, `font-size="9.5" fill="${C.dim}" text-anchor="middle"`))
      out.push(text(cx, Y(s.z0) + 16, `${HALL.length}×${HALL.width}m · 精选${ARTWORKS[0]}幅`, `font-size="9.5" fill="${C.dim}" text-anchor="middle"`))
    } else if (s.kind === 'lobby') {
      out.push(text(cx, Y((s.z0 + s.z1) / 2) - 2, s.name, `font-size="11.5" font-weight="700" fill="${C.ink}" text-anchor="middle"`))
      out.push(text(cx, Y((s.z0 + s.z1) / 2) + 12, `${LOBBY.depth}×${LOBBY.width}m`, `font-size="8.5" fill="${C.dim}" text-anchor="middle"`))
    }
  }
  // 暗廊小标签
  for (const id of ['CS', 'CW', 'CN']) {
    const s = SPACES.find((x) => x.id === id)
    out.push(text(X((s.x0 + s.x1) / 2), Y((s.z0 + s.z1) / 2) + 3, '廊', `font-size="8" fill="${C.dim}" text-anchor="middle"`))
  }
  // 门标签（仅厅门）
  for (const s of SPACES.filter((x) => x.kind === 'hall')) {
    for (const wall of ['N', 'S', 'E', 'W']) {
      for (const d of s.doors[wall] || []) {
        let px, py, anc
        if (wall === 'E') { px = X(s.x1) - 5; py = Y(s.z0 + d.at) - 4; anc = 'end' }
        if (wall === 'W') { px = X(s.x0) + 5; py = Y(s.z0 + d.at) - 4; anc = 'start' }
        if (wall === 'N') { px = X(s.x0 + d.at); py = Y(s.z1) + 13; anc = 'middle' }
        if (wall === 'S') { px = X(s.x0 + d.at); py = Y(s.z0) - 5; anc = 'middle' }
        out.push(text(px, py, d.tag, `font-size="8" fill="${C.route}" text-anchor="${anc}"`))
      }
    }
  }
  // 外门 入/出
  out.push(text(X(45.8) + 14, Y(3) + 4, '入（外门3.0m）', `font-size="10" font-weight="700" fill="${C.route}"`))
  out.push(text(X(45.8) + 14, Y(17.4) + 4, '出（外门3.0m）', `font-size="10" font-weight="700" fill="${C.route}"`))

  // ── 尺寸标注 ──
  // 南侧横链
  const cy = Y(0) + 34
  const chain = [[0, 18, '18'], [18, 19.8, '1.8'], [19.8, 37.8, '18'], [37.8, 45.8, '8']]
  for (const [a, b, t] of chain) {
    out.push(line(X(a), cy, X(b), cy, `stroke="${C.dim}" stroke-width="0.9"`))
    out.push(line(X(a), cy - 4, X(a), cy + 4, `stroke="${C.dim}"`))
    out.push(text(X((a + b) / 2), cy + 13, t, `font-size="9.5" fill="${C.dim}" text-anchor="middle"`))
  }
  out.push(line(X(45.8), cy - 4, X(45.8), cy + 4, `stroke="${C.dim}"`))
  // 西侧竖链
  const cx0 = X(0) - 26
  const vchain = [[0, 13, '13'], [13, 15.4, '2.4'], [15.4, 28.4, '13']]
  for (const [a, b, t] of vchain) {
    out.push(line(cx0, Y(a), cx0, Y(b), `stroke="${C.dim}" stroke-width="0.9"`))
    out.push(line(cx0 - 4, Y(a), cx0 + 4, Y(a), `stroke="${C.dim}"`))
    out.push(`<g transform="translate(${esc(cx0 - 8)},${esc(Y((a + b) / 2))}) rotate(-90)"><text ${FONT} font-size="9.5" fill="${C.dim}" text-anchor="middle">${t}</text></g>`)
  }
  out.push(line(cx0 - 4, Y(28.4), cx0 + 4, Y(28.4), `stroke="${C.dim}"`))
  // 总宽/总深（顶部与右侧）
  out.push(line(X(0), 112, X(45.8), 112, `stroke="${C.ink}" stroke-width="1.1"`))
  out.push(line(X(0), 107, X(0), 117, `stroke="${C.ink}"`))
  out.push(line(X(45.8), 107, X(45.8), 117, `stroke="${C.ink}"`))
  out.push(text(X(22.9), 106, '占地总宽 45.8m', `font-size="10.5" font-weight="700" fill="${C.ink}" text-anchor="middle"`))
  out.push(`<g transform="translate(${X(45.8) + 22},${Y(14.2)}) rotate(90)"><text ${FONT} font-size="10.5" font-weight="700" fill="${C.ink}" text-anchor="middle">总深 28.4m</text></g>`)

  out.push(text(OX, 164 - 26, '总平面图  1:220（示意比例）｜ 2×2 组团 · 蛇形单向回流', `font-size="13" font-weight="700" fill="${C.ink}"`))
  return out.join('\n')
}

// ───────────────────────── 单厅挂位详图（样板：展区一） ─────────────────────────
function buildHallDetail() {
  const S = 14
  const OX = 80
  const TOP = 800
  const L = HALL.length
  const W = HALL.width
  const X = (m) => OX + m * S
  const Y = (z) => TOP + (W - z) * S
  const out = []

  const doors = { E: [{ at: 3, w: 3 }], W: [{ at: 11.8 }] }

  out.push(rect(X(0), Y(W), L * S, W * S, `fill="${C.fillHall}" stroke="none"`))
  const wallAttr = `stroke="${C.wall}" stroke-width="4" stroke-linecap="square"`
  for (const [lo, hi] of wallRuns(L, doors.N)) out.push(line(X(lo), Y(W), X(hi), Y(W), wallAttr))
  for (const [lo, hi] of wallRuns(L, doors.S)) out.push(line(X(lo), Y(0), X(hi), Y(0), wallAttr))
  for (const [lo, hi] of wallRuns(W, doors.E)) out.push(line(X(L), Y(lo), X(L), Y(hi), wallAttr))
  for (const [lo, hi] of wallRuns(W, doors.W)) out.push(line(X(0), Y(lo), X(0), Y(hi), wallAttr))

  // 门洞标签
  out.push(text(X(L) + 8, Y(3), '入口（自入口厅，门洞3.0m）', `font-size="9" font-weight="700" fill="${C.route}"`))
  out.push(text(X(0) - 8, Y(11.8) - 4, '通往展区二（暗廊1.8m）', `font-size="9" font-weight="700" fill="${C.route}" text-anchor="end"`))

  const slotLen = FRAME_W * S
  const lampOff = 0.6 * S

  // 北墙 A / 南墙 C（长墙，无门，各 7 位 = 容量 floor((18-2×1.45)/2.15)）
  const aSlots = slotsOnWall(L, [])
  aSlots.forEach((at, i) => {
    const id = String(i + 1).padStart(2, '0')
    const cx = X(at)
    out.push(line(cx - slotLen / 2, Y(W) + 10, cx + slotLen / 2, Y(W) + 10, `stroke="${C.slot}" stroke-width="5"`))
    out.push(text(cx, Y(W) + 23, `A${id}`, `font-size="6.5" fill="${C.slot}" text-anchor="middle"`))
    out.push(circle(cx, Y(W) + 10 + lampOff, 2.2, `fill="${C.lamp}"`))
    out.push(line(cx - slotLen / 2, Y(0) - 10, cx + slotLen / 2, Y(0) - 10, `stroke="${C.slot}" stroke-width="5"`))
    out.push(text(cx, Y(0) - 15, `C${id}`, `font-size="6.5" fill="${C.slot}" text-anchor="middle"`))
    out.push(circle(cx, Y(0) - 10 - lampOff, 2.2, `fill="${C.lamp}"`))
  })

  // 西墙 B（门@11.8 → 3位）/ 东墙 D（门@3 宽3.0 → 2位）
  const drawEnd = (wall, slots, prefix) => {
    const isW = wall === 'W'
    const px = isW ? X(0) + 10 : X(L) - 10
    const inward = isW ? 1 : -1
    slots.forEach((at, i) => {
      const id = String(i + 1).padStart(2, '0')
      const cy = Y(at)
      out.push(line(px, cy - slotLen / 2, px, cy + slotLen / 2, `stroke="${C.slot}" stroke-width="5"`))
      out.push(text(px + inward * 9, cy + 2.5, `${prefix}${id}`, `font-size="6.5" fill="${C.slot}" text-anchor="${isW ? 'start' : 'end'}"`))
      out.push(circle(px + inward * lampOff, cy, 2.2, `fill="${C.lamp}"`))
    })
  }
  drawEnd('W', slotsOnWall(W, doors.W), 'B')
  drawEnd('E', slotsOnWall(W, doors.E), 'D')

  // 观画活动区
  out.push(rect(X(2), Y(11), (L - 4) * S, 9 * S, `fill="none" stroke="${C.dim}" stroke-width="1" stroke-dasharray="4 5" rx="6"`))
  out.push(text(X(L / 2), Y(6.5) - 3, '观画活动区', `font-size="11" fill="${C.dim}" text-anchor="middle"`))
  out.push(text(X(L / 2), Y(6.5) + 11, '两门对角布置，强制观众扫展全厅', `font-size="9" fill="${C.dim}" text-anchor="middle"`))

  // 间距标注
  const px1 = X(aSlots[0]), px2 = X(aSlots[1])
  const py = Y(W) + 40
  out.push(line(px1, py, px2, py, `stroke="${C.slot}" stroke-width="0.9"`))
  out.push(line(px1, py - 3, px1, py + 3, `stroke="${C.slot}"`))
  out.push(line(px2, py - 3, px2, py + 3, `stroke="${C.slot}"`))
  out.push(text((px1 + px2) / 2, py + 12, `挂位中到中 ${(aSlots[1] - aSlots[0]).toFixed(2)}m（全馆统一 ${HANG_PITCH}m）`, `font-size="8.5" fill="${C.slot}" text-anchor="middle"`))

  out.push(text(OX, TOP - 16, '标准展厅挂位详图（以展区一为样板）1:70', `font-size="13" font-weight="700" fill="${C.ink}"`))
  out.push(text(OX, TOP + W * S + 56, 'A/C 长墙各 5 位 ｜ B 端墙 3 位 · D 端墙 2 位 ｜ 合计 15 幅精选（端部留白≥1.45m）｜ 赭线=挂位，橙点=射灯位（每幅一灯）',
    `font-size="9.5" fill="${C.note}"`))
  return out.join('\n')
}

// ───────────────────────── 中下：蛇形序列与门位表 ─────────────────────────
function buildSequencePanel() {
  const x = 540
  const y0 = 786
  const out = []
  out.push(text(x, y0, '蛇形参观序列（单向回流，可往返逆行）', `font-size="13" font-weight="700" fill="${C.ink}"`))

  const steps = [
    ['①', '入口厅', '东外门进（东南）'],
    ['②', '展区一 右下', '东墙南端入 → 西墙北端出'],
    ['③', '展区二 左下', '东墙北端入 → 北墙西端出'],
    ['④', '展区三 左上', '南墙西端入 → 东墙北端出'],
    ['⑤', '展区四 右上', '西墙北端入 → 东墙南端出'],
    ['⑥', '出口厅', '东外门出（东北），可一键回入口'],
  ]
  let y = y0 + 26
  for (const [n, name, desc] of steps) {
    out.push(circle(x + 8, y - 4, 10, `fill="#fff" stroke="${C.route}" stroke-width="1.5"`))
    out.push(text(x + 8, y, n.replace(/[①②③④⑤⑥]/, (m) => String('①②③④⑤⑥'.indexOf(m) + 1)), `font-size="10" font-weight="800" fill="${C.route}" text-anchor="middle"`))
    out.push(text(x + 26, y, name, `font-size="10.5" font-weight="700" fill="${C.ink}"`))
    out.push(text(x + 130, y, desc, `font-size="10" fill="${C.note}"`))
    y += 22
  }
  y += 6
  for (const t of [
    '连接：厅间以 2.4m 暗廊过渡（净高 4.0m＋地脚微光，过门 300ms 黑场做分区加载）。',
    '门位全部对角或偏端布置，单厅展线覆盖最大化；全段强制动线长 ≈104m。',
    '厅间 2.4m 夹道除暗廊外全部封死为暗腔（设备/声学腔，不可进入）。',
  ]) {
    out.push(text(x, y, t, `font-size="9.5" fill="${C.note}"`))
    y += 17
  }

  // 容量小卡
  y += 10
  out.push(line(x, y - 8, x + 500, y - 8, `stroke="#e5e7eb"`))
  const cards = [
    ['挂位', '15/厅 × 4 = 60 幅精选'],
    ['素材库 148 张', '精选 60 · 落选 88'],
    ['挂距契约', '全馆统一中心距 3.5m（框边净隙 ≥1.36m）'],
    ['室内面积', '约 1045 ㎡（厅936＋廊13＋门厅96）'],
  ]
  let cx = x
  for (const [a, b] of cards) {
    out.push(text(cx, y + 12, a, `font-size="9" fill="${C.dim}"`))
    out.push(text(cx, y + 28, b, `font-size="11" font-weight="700" fill="${C.ink}"`))
    cx += 128
  }
  return out.join('\n')
}

// ───────────────────────── 右侧说明面板 ─────────────────────────
function buildPanel() {
  const x = 1100
  let y = 118
  const out = []
  const head = (yy, t) => out.push(text(x, yy, t, `font-size="12.5" font-weight="700" fill="${C.ink}"`))
  const row = (yy, a, b, bold = false) =>
    out.push(
      text(x, yy, a, `font-size="10.5" fill="${C.note}" ${bold ? 'font-weight="700"' : ''}`),
      text(x + 180, yy, b, `font-size="10.5" fill="${bold ? C.ink : C.note}" ${bold ? 'font-weight="700"' : ''}`),
    )

  head(y, '一、空间参数（v6 高厅 · 圆拱门 · 白盒美术馆）'); y += 20
  row(y, '展区（×4）', '18m × 13m × 净高5.2m'); y += 17
  row(y, '暗廊（×3）', '横向净宽2.4m × 净高4.0m'); y += 17
  row(y, '入口厅 / 出口厅', '进深8 × 面宽6 × 高5.0m'); y += 17
  row(y, '门厅位置', '同在东立面：南入 / 北出'); y += 17
  row(y, '占地', '45.8m × 28.4m'); y += 17
  row(y, '强制动线长', '≈104m（含门厅与暗廊）', true); y += 17
  row(y, '门洞', `半圆拱 · 拱顶全馆统一 ${ARCH_APEX}m（起拱 2.0/2.6）· 拱环 ${ARCH_RING}m；主门/出口净宽3.0 · 暗廊门 1.8`); y += 26

  head(y, '二、容量核算（自适应精选）'); y += 20
  row(y, '每厅长墙（18m）', '4~5 幅 × 2（容量驱动）'); y += 17
  row(y, '每厅端墙（13m）', '2~3 幅 × 2（容量驱动）'); y += 17
  row(y, '每厅挂位', '15 位 × 4 厅 = 60（端部留白≥1.45m）', true); y += 17
  row(y, '素材库 148 张', '精选 60 ｜ 落选 88（库全保留）', true); y += 17
  row(y, '挂距契约', '全馆统一中心距 3.5m（框边净隙 ≥1.36m）', true); y += 26

  head(y, '三、图例'); y += 20
  const legend = [
    [`<line x1="${x}" y1="${y - 4}" x2="${x + 26}" y2="${y - 4}" stroke="${C.wall}" stroke-width="4"/>`, '墙体（厚 0.2m，哑光黑）'],
    [`<rect x="${x}" y="${y + 9}" width="26" height="9" fill="${C.fillCorr}"/>`, '暗廊（封闭，仅通行）'],
    [`<rect x="${x}" y="${y + 25}" width="26" height="9" fill="url(#voidDot)" stroke="#d6d3cd"/>`, '暗腔（封死，不可进入）'],
    [`<line x1="${x}" y1="${y + 45}" x2="${x + 26}" y2="${y + 45}" stroke="${C.slot}" stroke-width="5"/>`, '挂位（精选 · 全馆中心距 3.5m）'],
    [`<circle cx="${x + 13}" cy="${y + 62}" r="3" fill="${C.lamp}"/>`, '射灯位（暖白 · 每幅一灯）'],
    [`<line x1="${x}" y1="${y + 78}" x2="${x + 26}" y2="${y + 78}" stroke="${C.route}" stroke-width="1.6" stroke-dasharray="6 4"/>`, '蛇形参观动线'],
  ]
  for (const [shape, label] of legend) {
    out.push(shape)
    out.push(text(x + 36, y, label, `font-size="10.5" fill="${C.note}"`))
    y += 17
  }
  y += 10

  head(y, '四、动线与碰撞规则（实现口径）'); y += 20
  for (const t of [
    '• 入口厅：标题墙＋简介＋操作说明，点击/按键进入',
    '• 暗廊：净高4.0m、地脚微光，过门 300ms 黑场分区加载',
    '• 出口厅：致谢墙＋作品数，可一键回入口',
    '• 碰撞：Octree＋胶囊(r=0.35m)，官方 FPS 方案',
    '• 禁穿墙；沿碰撞法线滑动，对角过门不卡死',
    '• 门洞1.8m ＞ 胶囊直径0.7m（通过比 2.57）',
    '• R 键复位回入口；小地图 HUD 常驻',
  ]) {
    out.push(text(x, y, t, `font-size="10" fill="${C.note}"`))
    y += 16
  }
  y += 12

  head(y, '五、版本记录'); y += 20
  for (const t of [
    'v5 罗马拱门：一洞一环挤出成型；V 形拼装错位（白柱）结构性根除。',
    'v6 ① 修 CW 暗廊门洞越界：净宽 1.8 而门洞 at=1.2 → 东侧 −0.3m 开进封闭暗腔；横向改 2.4m。',
    'v6 ② 修 H4 出口门越界：at=1.2/w3 → 南侧 −0.3m，拱环绕出墙角；移至 z=17.4，两侧留 0.5m 墙垛。',
    'v6 ③ 挂位改全馆统一中心距 3.5m：v5 逐墙自适应产生 2.67/3.02/3.37/3.70 四种节奏，且最窄净隙仅 0.53m。',
    'v6 ④ 拱顶 3.2→3.5m、暗廊净高 3.6→4.0m，拱环 0.14m；三档预设 ?portal=gallery|monumental|layered。',
  ]) {
    out.push(text(x, y, t, `font-size="10" fill="${C.note}"`))
    y += 18
  }
  return out.join('\n')
}

// ───────────────────────── 组装 ─────────────────────────
const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1680" height="1120" viewBox="0 0 1680 1120">
<defs>
  <marker id="arrow" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">
    <path d="M0,0 L9,4.5 L0,9 z" fill="${C.route}"/>
  </marker>
  <pattern id="voidDot" width="7" height="7" patternUnits="userSpaceOnUse">
    <rect width="7" height="7" fill="${C.voidFill}"/>
    <circle cx="1.6" cy="1.6" r="0.9" fill="#cfccc5"/>
  </pattern>
</defs>
<rect width="1680" height="1120" fill="#ffffff"/>
${text(60, 48, '3D 摄影展布展漫游系统 · 平面设计图', `font-size="22" font-weight="800" fill="${C.ink}"`)}
${text(60, 76, '2×2 组团 · 蛇形单向回流 ｜ 入口/出口位于东侧（南入北出）｜ v6 圆拱门 ｜ 2026-10-20 ｜ 单位：米', `font-size="11" fill="${C.dim}"`)}
<line x1="60" y1="92" x2="1620" y2="92" stroke="#e5e7eb" stroke-width="1"/>
${buildOverview()}
${buildHallDetail()}
${buildSequencePanel()}
${buildPanel()}
${text(60, 1096, '制图：gallery3d / scripts/gen-floorplan.mjs 数据驱动生成 ｜ 确认后本图作为施工（程序化建墙）与最终交付平面图的同源基线', `font-size="9.5" fill="${C.dim}"`)}
</svg>`

const outPath = 'public/floorplan.svg'
mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, svg.replace(/\n\s*\n/g, '\n'), 'utf-8')
console.log(`floorplan v6 generated: ${outPath} (${(svg.length / 1024).toFixed(1)} KB), site 45.8x28.4m, 精选/厅 ${ARTWORKS[0]}`)
