import { useEffect, useMemo } from 'react'
import { MeshReflectorMaterial } from '@react-three/drei'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  DOOR_W,
  HALLS,
  PORTAL,
  ROUTE,
  RUINS_STPAUL,
  SEA_RIBBONS,
  SITE,
  SPACES,
  STPAUL_CROSS_H,
  STPAUL_TIERS,
  WALL_T,
  portalApex,
  portalSpring,
  ribbonSlots,
  ruinsMetrics,
  wallBoxes,
  wallRuns,
  type Space,
  type WallId,
} from '../domain/gallery'
import { THEMES } from '../domain/themes'
import { makeLabelPlane } from './labels'
import { studioEnv } from './env'

const PERF = new URLSearchParams(window.location.search).get('quality') === 'perf'

// ── 白盒美术馆材质：白清水混凝土墙 + 浅灰微反射水泥地 + 发光天棚 ──

/** 白清水混凝土程序纹理：浅白基底 + 细腻噪点 + 对拉螺栓孔 + 板缝（零外网贴图） */
function makeConcreteTexture(): THREE.Texture {
  const S = 512
  const cv = document.createElement('canvas')
  cv.width = S
  cv.height = S
  const ctx = cv.getContext('2d')!
  ctx.fillStyle = '#ecebe7'
  ctx.fillRect(0, 0, S, S)
  for (let i = 0; i < 2600; i++) {
    const a = Math.random() * 0.045
    ctx.fillStyle = Math.random() > 0.5 ? `rgba(122,120,114,${a})` : `rgba(255,255,255,${a * 1.5})`
    ctx.beginPath()
    ctx.arc(Math.random() * S, Math.random() * S, Math.random() * 1.8 + 0.4, 0, Math.PI * 2)
    ctx.fill()
  }
  // 对拉螺栓孔 2×2
  for (const gx of [S * 0.3, S * 0.7]) {
    for (const gy of [S * 0.3, S * 0.7]) {
      ctx.beginPath()
      ctx.arc(gx, gy, 5, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(138,136,130,0.45)'
      ctx.fill()
      ctx.strokeStyle = 'rgba(112,110,106,0.32)'
      ctx.lineWidth = 1.2
      ctx.stroke()
    }
  }
  // 板缝十字
  ctx.strokeStyle = 'rgba(150,148,142,0.38)'
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(0, S / 2); ctx.lineTo(S, S / 2); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(S / 2, 0); ctx.lineTo(S / 2, S); ctx.stroke()
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(2, 1)
  return t
}

const concreteTex = makeConcreteTexture()
const MAT_WALL = new THREE.MeshStandardMaterial({ map: concreteTex, roughness: 0.92, metalness: 0 })
/** 拱上封墙专用材质（v5）：与墙同基色的无板缝纯色——混凝土贴图的 0.5m 板缝十字经世界坐标 UV
 *  映射到窄条 fill 上会恰好落在门洞轴线附近（拱顶短竖线根因之一），故 fill 不用贴图 */
const MAT_ARCH_FILL = new THREE.MeshStandardMaterial({ color: '#ecebe7', roughness: 0.92, metalness: 0 })
const MAT_CEIL_FRAME = new THREE.MeshStandardMaterial({ color: '#cfccc5', roughness: 0.9 })
const MAT_CORR_FLOOR = new THREE.MeshStandardMaterial({ color: '#cbc9c5', roughness: 0.55 })
const MAT_RAIL = new THREE.MeshStandardMaterial({ color: '#2e2c2a', roughness: 0.5, metalness: 0.4 })
const MAT_BENCH = new THREE.MeshStandardMaterial({ color: '#d8d6d2', roughness: 0.55, metalness: 0.03 })
const MAT_ROUTE_INLAY = new THREE.MeshStandardMaterial({ color: '#57544f', roughness: 0.7 })
/** 暗钢拱门套（v5 A 罗马半圆拱）：深灰哑光金属；metal 0.75→0.45/rough 0.6 提亮一档（无 envmap 高 metalness 必发暗，见铁律14），保持暗钢语言 */
const MAT_PORTAL = new THREE.MeshStandardMaterial({ color: '#43464d', roughness: 0.6, metalness: 0.45 })
/** 导视牌背板（v4 C 方案·银边玻璃牌）：暖白哑光薄板，融入白盒墙面 */
const MAT_SIGN_BACK = new THREE.MeshStandardMaterial({ color: '#f4f2ec', roughness: 0.5, metalness: 0.02 })
/** 导视牌细边框（v4）：恒定亮银（MeshBasic 不受光照/镜面拖累——无 envmap 场景中 metal 材质必发暗，见铁律11 同源问题）；亮度低于 Bloom 阈值不发光 */
const MAT_SIGN_FRAME = new THREE.MeshBasicMaterial({ color: '#b3ada2' })

/** v8 H3 海元素：改为悬垂玻璃海浪丝带装置（v7 墙面浮雕带 + 焦散已废弃） */

/** 发光天棚面板：柔光灯箱白（亮度压在 Bloom 阈值 0.92 下，整体亮而不炸） */
function ceilGlowMat(): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color: '#efede6', toneMapped: false })
}
const MAT_CEIL_GLOW = ceilGlowMat()
/** 入口厅天花灯箱（v16）：银白场里暖白顶偏炸，降一档到冷白 #e4e7ea（留在 Bloom 阈值下，仰视无白块） */
const MAT_ENTRY_CEIL_GLOW = new THREE.MeshBasicMaterial({ color: '#e4e7ea', toneMapped: false })

// ── v14 入口厅「AI 数字摄影艺术展 · 60 幅」赛博叙事（B 档）──
// 口径：只换入口厅皮肤与装置，四展厅白盒语言不改；深蓝内衬以 0.02 薄板贴合墙内侧，
// 不替换 wallBoxes 的 MAT_WALL（共享墙另一侧仍是白盒，避免染到 H1/EXIT）。
const ENTRY_SPACE = SPACES.find((s) => s.id === 'ENTRY')!
/** 入口厅银白亮光内衬（v16）：亮光不再靠强镜面——粗糙度 0.42 / 清漆 0.28，
 *  点光高光由「纯白硬斑」收敛为低对比柔光，仍有银白烤漆的窄反射带 */
const MAT_ENTRY_SKIN = new THREE.MeshPhysicalMaterial({
  color: '#ccd6e0', roughness: 0.42, metalness: 0.08, clearcoat: 0.28, clearcoatRoughness: 0.32,
})
/** 入口厅浅色玻璃地面：半透明压在全局反光水泥地上，保留镜面反射又带一层冷银薄雾 */
const MAT_ENTRY_FLOOR = new THREE.MeshStandardMaterial({
  color: '#c9d3de', roughness: 0.06, metalness: 0.34, transparent: true, opacity: 0.28, depthWrite: false,
})
/** 顶棚暗管（v17b 银白化）：深蓝 #2a3448 在亮顶上一道黑杠过于抢眼，收为磨砂银灰导管，
 *  比环碟再暗一档（#a9b8c8），保留顶棚的结构节奏而不构成视觉重物 */
const MAT_ENTRY_PIPE = new THREE.MeshStandardMaterial({
  color: '#a9b8c8', roughness: 0.44, metalness: 0.30, envMapIntensity: 0.3,
})
/** 入口环碟外环 + 吊杆（v17b 银白化）：深蓝 #182a44 在高亮顶棚下读成黑洞，改为缎面银白——
 *  比墙面 #ccd6e0 略暗一档、比灯箱顶 #e4e7ea 暗两档，保证环体在亮顶上仍有轮廓；
 *  低金属度 + 清漆保留窄反射带（无 envMap 时高金属度必发死黑，见铁律） */
const MAT_ENTRY_RING = new THREE.MeshPhysicalMaterial({
  color: '#c4cfdb', roughness: 0.34, metalness: 0.16, clearcoat: 0.25, clearcoatRoughness: 0.30,
  envMapIntensity: 0.35,
})
/** 冷青发光：颜色乘系数后越过 Bloom 0.92 阈值，泛光但不过曝 */
const MAT_ENTRY_RIM = glowMat('#dff3ff', 1.08)
/** 环碟中心核（v17b 银白化）：饱和青蓝 #8fd8ff 在银白场里成唯一强色块，收为冰白冷光 */
const MAT_ENTRY_CORE = glowMat('#d8efff', 1.10)

/** 主题发光材质：toneMapped=false 且颜色乘亮度系数，喂给 Bloom（>0.92 阈值） */
function glowMat(hex: string, k: number, opacity = 1): THREE.MeshBasicMaterial {
  const c = new THREE.Color(hex).multiplyScalar(k)
  return new THREE.MeshBasicMaterial({
    color: c,
    toneMapped: false,
    transparent: opacity < 1,
    opacity,
    depthWrite: opacity >= 1,
  })
}

export interface DecorBox {
  cx: number; cy: number; cz: number; sx: number; sy: number; sz: number
}

/**
 * H1「香港故事」天星小轮船模（v12）：
 * 老板口径——**长凳撤除，船模居中替换**；整体放大 1.21×（约 1:10），台座同步加大。
 * 厅中心 (28.8, 6.5)；船体 3.39×0.96m，台座 3.62×0.24×1.34m，总高 1.47m < 视平线 1.70。
 */
const FERRY = {
  center: { x: 28.8, z: 6.5 },
  plinth: { w: 3.62, h: 0.24, d: 1.34 },
  base: 0.02,
  scale: 1.21,
  len: 2.8,
  beam: 0.79,
} as const

/** 船模总高（含台座与旗杆）：碰撞盒与评审红线共用；旗杆球顶 1.230 − 水线底 0.22 = 1.010 */
const FERRY_TOTAL_H = FERRY.base + FERRY.plinth.h + 1.01 * FERRY.scale

/** 岛台/展品碰撞（v12）：H2 中庭大三巴牌坊、H1 中心天星小轮、其余厅长凳；供 Octree 世界加入 */
export const DECOR_BOXES: DecorBox[] = HALLS.flatMap((h) => {
  if (h.id === RUINS_STPAUL.hallId) {
    const m = ruinsMetrics()
    return [{
      cx: RUINS_STPAUL.center.x,
      cy: m.totalH / 2,
      cz: RUINS_STPAUL.center.z,
      // 立面朝 +x：局部宽度落在世界 z 轴、进深落在世界 x 轴
      sx: m.box.d,
      sy: m.totalH,
      sz: m.box.w,
    }]
  }
  if (h.id === 'H1') {
    return [{
      cx: FERRY.center.x,
      cy: FERRY_TOTAL_H / 2,
      cz: FERRY.center.z,
      sx: FERRY.plinth.w,
      sy: FERRY_TOTAL_H,
      sz: FERRY.plinth.d,
    }]
  }
  if (h.id === 'H4') {
    // v16 圆形花坛：外径 4.0m、总高 ~1.0m（含花），替换原长凳
    return [{
      cx: (h.x0 + h.x1) / 2,
      cy: 0.5,
      cz: (h.z0 + h.z1) / 2,
      sx: 4.0,
      sy: 1.0,
      sz: 4.0,
    }]
  }
  return [{
    cx: (h.x0 + h.x1) / 2,
    cy: 0.17,
    cz: (h.z0 + h.z1) / 2,
    sx: 2.6,
    sy: 0.34,
    sz: 0.8,
  }]
})

// ── v6 圆拱门（参数化，单一真源见 domain/gallery.PORTAL）──
// 两级净宽由平面拓扑决定（主门 3.0 / 暗廊 1.8，暗廊净宽 2.4 锁死），
// 拱顶标高、拱环宽、骑缝突出全馆统一 → 同一「拱门家族」，不存在第二套门框语言。
// 每洞一体 ExtrudeGeometry 拱环（骑缝突出）+ 拱上封墙：单 mesh 无拼装缝，
// 根治 v4 多梃拼装在共享墙两侧定义不一致时产生的洞中错位墙柱（老板验收截图 bug）。
const RING_W = PORTAL.ring
const PROUD = PORTAL.proud
const PORTAL_DEPTH = WALL_T + PROUD * 2

/** 拱环截面：外轮廓（洞形外扩 RING_W、落到底 y=0）减内孔（净洞半圆拱） */
function archRingGeometry(w: number, spring: number): THREE.ExtrudeGeometry {
  const r = w / 2
  const F = RING_W
  const shape = new THREE.Shape()
  shape.moveTo(-r - F, 0)
  shape.lineTo(-r - F, spring)
  shape.absarc(0, spring, r + F, Math.PI, 0, true)
  shape.lineTo(r + F, 0)
  shape.closePath()
  const hole = new THREE.Path()
  hole.moveTo(-r, 0)
  hole.lineTo(-r, spring)
  hole.absarc(0, spring, r, Math.PI, 0, true)
  hole.lineTo(r, 0)
  hole.closePath()
  shape.holes.push(hole)
  const g = new THREE.ExtrudeGeometry(shape, { depth: PORTAL_DEPTH, bevelEnabled: false, curveSegments: 64 })
  g.translate(0, 0, -PORTAL_DEPTH / 2) // 骑缝居中：两侧各突出墙面 PROUD
  return g
}

/** 拱上封墙：[spring,h] 矩形、下缘沿拱环外缘弧线（简单多边形：左 downside→弧顶→右 upside→顶边闭合）。
 *  路径必须「沿弧线开洞」而非先上后横再 closePath——后者会产生贯穿对角边，填充区只盖左上象限，
 *  右上拱肩漏光且对角薄片在拱顶处露出线状伪影（v5 首轮 QA 实测，已修复）。
 *  厚度取整面墙 WALL_T 骑缝（与墙面对齐）：薄板悬墙中面会在掠射角下沿弧缘露出细缝线。 */
function archFillGeometry(w: number, spring: number, h: number): THREE.ExtrudeGeometry {
  const r = w / 2 + RING_W
  const shape = new THREE.Shape()
  shape.moveTo(-r, h)
  shape.lineTo(-r, spring)
  shape.absarc(0, spring, r, Math.PI, 0, true) // 沿外拱弧线从左到右（π→0 顺时针过弧顶）
  shape.lineTo(r, h)
  shape.closePath()
  const g = new THREE.ExtrudeGeometry(shape, { depth: WALL_T, bevelEnabled: false, curveSegments: 64 })
  g.translate(0, 0, -WALL_T / 2)
  return g
}

/** 共享墙按墙平面去重（key: wx|wz，h 取双侧较大）；一洞一环，洞宽决定拱级 */
function PortalFrames() {
  const gl = useThree((s) => s.gl)
  const parts = useMemo(() => {
    const byKey = new Map<string, { alongX: boolean; wx: number; wz: number; w: number; h: number }>()
    for (const s of SPACES) {
      for (const wall of ['N', 'S', 'E', 'W'] as WallId[]) {
        for (const d of s.doors[wall] ?? []) {
          const alongX = wall === 'N' || wall === 'S'
          const wx = alongX ? s.x0 + d.at : wall === 'W' ? s.x0 : s.x1
          const wz = alongX ? (wall === 'N' ? s.z1 : s.z0) : s.z0 + d.at
          const key = `${wx.toFixed(2)}|${wz.toFixed(2)}`
          const prev = byKey.get(key)
          if (prev) {
            // 同一道墙两侧高度不同（厅 5.2 / 廊 4.0）：取高者，拱上封墙必须封到最高侧天花
            prev.h = Math.max(prev.h, s.h)
          } else byKey.set(key, { alongX, wx, wz, w: d.w ?? DOOR_W, h: s.h })
        }
      }
    }
    return [...byKey.values()]
  }, [])

  // 几何按「净宽」缓存（主门 / 暗廊各一份，全馆共享）
  const geos = useMemo(() => {
    const m = new Map<number, { ring: THREE.ExtrudeGeometry; spring: number; apex: number }>()
    for (const p of parts) {
      if (m.has(p.w)) continue
      const spring = portalSpring(p.w)
      m.set(p.w, { ring: archRingGeometry(p.w, spring), spring, apex: portalApex(p.w) })
    }
    return m
  }, [parts])

  // 拱门套用环境反射：暗钢在高金属度下没有 envmap 会发死黑（铁律14/18）
  const env = useMemo(() => studioEnv(gl), [gl])
  useEffect(() => {
    MAT_PORTAL.envMap = env ?? null
    // 无 env 时降 metalness，避免整圈门套变纯黑
    MAT_PORTAL.metalness = env ? 0.45 : 0.12
    MAT_PORTAL.roughness = env ? 0.6 : 0.72
    MAT_PORTAL.needsUpdate = true
  }, [env])

  return (
    <>
      {parts.map((p, i) => {
        const g = geos.get(p.w)!
        const fill = p.h - g.apex > 0.05 ? archFillGeometry(p.w, g.spring, p.h) : null
        return (
          <group key={i} position={[p.wx, 0, p.wz]} rotation-y={p.alongX ? 0 : Math.PI / 2}>
            <mesh geometry={g.ring} material={MAT_PORTAL} />
            {fill && <mesh geometry={fill} material={MAT_ARCH_FILL} />}
          </group>
        )
      })}
    </>
  )
}

/** D1 一体化厅导视牌画布（v4 银边玻璃牌）：暖白底 + 主题色厅号 + 深灰中英文名，与白盒展厅同语言 */
function makeHallSignTexture(no: string, name: string, en: string, accent: string): THREE.CanvasTexture {
  const W = 2048
  const H = 410
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H
  const ctx = cv.getContext('2d')!
  ctx.fillStyle = '#f6f4ef'
  ctx.fillRect(0, 0, W, H)
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillStyle = accent
  ctx.font = '200 240px "Helvetica Neue",Arial,sans-serif'
  ctx.fillText(no, 70, H / 2 + 8)
  ctx.fillStyle = 'rgba(43,46,51,0.16)'
  ctx.fillRect(430, 70, 3, H - 140)
  ctx.font = '700 148px "PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif'
  ctx.fillStyle = '#2b2e33'
  ctx.fillText(name, 500, H / 2 - 36)
  ctx.fillStyle = '#85898f'
  ctx.font = '400 50px "Helvetica Neue",Arial,sans-serif'
  ctx.fillText(en.split('').join(' '), 504, H / 2 + 84)
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

/** D1 一体化厅导视牌：入厅迎面远墙最宽实墙段中点、y=3.6（门楣填充墙上）；v4 银边玻璃牌（暖白板+香槟钛银细框） */
function HallSigns() {
  const signs = useMemo(() => {
    const FAR: Record<string, WallId> = { H1: 'W', H2: 'W', H3: 'N', H4: 'E' }
    const NO: Record<string, string> = { H1: '01', H2: '02', H3: '03', H4: '04' }
    const RY: Record<WallId, number> = { W: Math.PI / 2, E: -Math.PI / 2, N: Math.PI, S: 0 }
    return HALLS.map((h) => {
      const wall = FAR[h.id]
      const L = wall === 'N' || wall === 'S' ? h.x1 - h.x0 : h.z1 - h.z0
      const run = wallRuns(L, h.doors[wall] ?? []).reduce((m, r) => (r[1] - r[0] > m[1] - m[0] ? r : m))
      const mid = (run[0] + run[1]) / 2
      const w = Math.min(run[1] - run[0] - 0.6, 4.6)
      const t = THEMES[h.id]
      const x = wall === 'W' ? h.x0 + 0.131 : wall === 'E' ? h.x1 - 0.131 : h.x0 + mid
      const z = wall === 'N' ? h.z1 - 0.131 : wall === 'S' ? h.z0 + 0.131 : h.z0 + mid
      // H2 远墙导视牌上移 0.35：中心牌坊（2.56m）会挡住 3.6m 处的牌面下缘，抬到 3.95 后完全让开
      const y = h.id === RUINS_STPAUL.hallId ? 3.95 : 3.6
      return { pos: [x, y, z] as [number, number, number], ry: RY[wall], w, tex: makeHallSignTexture(NO[h.id], t.name, t.en, t.accent) }
    })
  }, [])
  const PW = 0.045 // 框条宽
  return (
    <>
      {signs.map((s, i) => {
        const BW = s.w + 0.16
        const BH = 1.08
        return (
          <group key={i} position={s.pos} rotation-y={s.ry}>
            <mesh position={[0, 0, -0.018]} material={MAT_SIGN_BACK}>
              <boxGeometry args={[BW, BH, 0.03]} />
            </mesh>
            {/* 香槟钛银细框：上下左右四条，与画框同材质 */}
            <mesh position={[0, BH / 2 - PW / 2, -0.016]} material={MAT_SIGN_FRAME}>
              <boxGeometry args={[BW, PW, 0.05]} />
            </mesh>
            <mesh position={[0, -BH / 2 + PW / 2, -0.016]} material={MAT_SIGN_FRAME}>
              <boxGeometry args={[BW, PW, 0.05]} />
            </mesh>
            <mesh position={[BW / 2 - PW / 2, 0, -0.016]} material={MAT_SIGN_FRAME}>
              <boxGeometry args={[PW, BH, 0.05]} />
            </mesh>
            <mesh position={[-BW / 2 + PW / 2, 0, -0.016]} material={MAT_SIGN_FRAME}>
              <boxGeometry args={[PW, BH, 0.05]} />
            </mesh>
            <mesh position={[0, 0, 0.002]}>
              <planeGeometry args={[s.w, 0.92]} />
              <meshBasicMaterial map={s.tex} toneMapped={false} />
            </mesh>
          </group>
        )
      })}
    </>
  )
}

interface Placed {
  mesh: THREE.Mesh
  pos: [number, number, number]
  ry: number
}

/** 标题/操作铭牌/致谢/暗廊导视（v3：标题居入口主门门楣上方填充墙，致谢悬于出口主门上方，导视带金属背板；厅号并入 HallSigns 一体导视牌） */
function WallLabels() {
  const labels = useMemo<Placed[]>(() => {
    const items: Placed[] = []
    const put = (mesh: THREE.Mesh, x: number, y: number, z: number, ry: number) =>
      items.push({ mesh, pos: [x, y, z], ry })

    const light = { bg: '#f7f6f3', fg: '#2a2c30', subFg: '#70747a' }
    const ink = { transparentBg: true, fg: '#2a2c30', subFg: '#70747a' }

    // 入口主标题（v17）：门楣撤字，迁入北墙圆角灯带框（5.6×2.9）正中 —— y 取框心 2.45
    // 字体设计：拉丁（AI / 60）走 Helvetica Neue，汉字按字形回退 PingFang SC（中英配对）；
    // 字重 500 + 0.10em 字距；逐字排版，行宽约 4.2m（框内净宽 5.5m，左右留白约 0.65m），不再被 maxWidth 压扁
    put(makeLabelPlane('AI 数字摄影艺术展 · 60 幅', '', {
      width: 5.2, height: 0.92, fontSizePx: 68, fontWeight: 500, letterSpacing: 0.10,
      fontFamily: '"Helvetica Neue","PingFang SC","Hiragino Sans GB",sans-serif',
      transparentBg: true, fg: '#13293b',
    }), 41.8, 2.45, 5.87, Math.PI)
    // 南墙镜像同一标题（v17b）：与北墙同字号/同字距/同框心，两侧对称收口
    put(makeLabelPlane('AI 数字摄影艺术展 · 60 幅', '', {
      width: 5.2, height: 0.92, fontSizePx: 68, fontWeight: 500, letterSpacing: 0.10,
      fontFamily: '"Helvetica Neue","PingFang SC","Hiragino Sans GB",sans-serif',
      transparentBg: true, fg: '#13293b',
    }), 41.8, 2.45, 0.13, 0)
    // 操作铭牌（入口厅北墙灯带框内下沿，透明底）：宽度收至 3.2，避免近距离视角下被画面裁切
    put(makeLabelPlane('WASD 行走　按住左键拖拽环视　点击作品看大图　P 自动巡游　R 复位', '', {
      width: 3.2, height: 0.34, fontSizePx: 30, transparentBg: true, fg: '#243f55', subFg: '#4b6b82',
    }), 41.8, 1.30, 5.87, Math.PI)

    // 出口致谢（出口主门门楣上方填充墙）+ 回入口提示（出口厅北墙实墙段）
    put(makeLabelPlane('谢 谢 观 看', '期待重逢', { width: 3.0, height: 1.0, ...ink }),
      45.68, 4.25, 17.4, -Math.PI / 2)
    put(makeLabelPlane('按 R 返回入口重走一遍', '', { width: 2.8, height: 0.4, fontSizePx: 72, ...light }),
      41.8, 1.9, 20.48, Math.PI)

    // 暗廊导视光板（指向下一展区主题；金属背板嵌墙衬底）
    const sign = (text: string, x: number, y: number, z: number, ry: number, accent: string) =>
      put(makeLabelPlane(text, '', { width: 1.5, height: 0.34, fontSizePx: 92, transparentBg: true, fg: accent, accent }),
        x, y, z, ry)
    sign('双城纪事 →', 18.9, 2.15, 12.86, Math.PI, THEMES.H2.accent)
    sign('海与港 ↑', 0.14, 2.15, 14.2, Math.PI / 2, THEMES.H3.accent)
    sign('林间生灵 →', 18.9, 2.15, 28.26, Math.PI, THEMES.H4.accent)
    const backing = (x: number, y: number, z: number, alongX: boolean) => {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(alongX ? 1.56 : 0.024, 0.4, alongX ? 0.024 : 1.56),
        MAT_SIGN_BACK,
      )
      put(m, x, y, z, 0)
    }
    backing(18.9, 2.15, 12.878, true)
    backing(0.122, 2.15, 14.2, false)
    backing(18.9, 2.15, 28.278, true)

    return items
  }, [])

  return (
    <>
      {labels.map((l, i) => (
        <primitive key={i} object={l.mesh} position={l.pos} rotation-y={l.ry} />
      ))}
    </>
  )
}

/** 顶部阴角细灯带（v3 C1：全馆统一冷银白，主题色仅保留导视牌点睛） */
function LightStrips() {
  const strips = useMemo(() => {
    const out: { pos: [number, number, number]; size: [number, number, number] }[] = []
    const push = (x: number, y: number, z: number, sx: number, sy: number, sz: number) =>
      out.push({ pos: [x, y, z], size: [sx, sy, sz] })

    for (const s of SPACES) {
      // 入口厅改用赛博圆角灯带框（EntryChamber），不再叠白盒阴角灯带
      if (s.id === 'ENTRY') continue
      const len = s.x1 - s.x0
      const wid = s.z1 - s.z0
      const cx = (s.x0 + s.x1) / 2
      const cz = (s.z0 + s.z1) / 2
      if (s.kind === 'hall') {
        const y = s.h - 0.1
        push(cx, y, s.z0 + 0.12, len - 1.6, 0.022, 0.07)
        push(cx, y, s.z1 - 0.12, len - 1.6, 0.022, 0.07)
        push(s.x0 + 0.12, y, cz, 0.07, 0.022, wid - 1.6)
        push(s.x1 - 0.12, y, cz, 0.07, 0.022, wid - 1.6)
      } else if (s.kind === 'corridor') {
        if (len >= wid) push(cx, s.h - 0.07, cz, 0.06, 0.018, wid - 0.3)
        else push(cx, s.h - 0.07, cz, len - 0.3, 0.018, 0.06)
      } else {
        push(cx, s.h - 0.08, s.z0 + 0.3, len - 1.2, 0.018, 0.06)
        push(cx, s.h - 0.08, s.z1 - 0.3, len - 1.2, 0.018, 0.06)
      }
    }
    return out
  }, [])
  const mat = useMemo(() => glowMat('#eef4ff', 1.0), [])

  return (
    <>
      {strips.map((s, i) => (
        <mesh key={i} position={s.pos} material={mat}>
          <boxGeometry args={s.size} />
        </mesh>
      ))}
    </>
  )
}

/** 圆角矩形框（灯带框/屏幕外框）：外轮廓减内孔，转角真圆角，单 mesh 无拼装缝 */
function roundedFrameGeom(w: number, h: number, r: number, t: number): THREE.ExtrudeGeometry {
  const outline = (s: THREE.Shape | THREE.Path, W: number, H: number, rad: number) => {
    const x = -W / 2
    const y = -H / 2
    s.moveTo(x + rad, y)
    s.lineTo(x + W - rad, y)
    s.absarc(x + W - rad, y + rad, rad, -Math.PI / 2, 0, false)
    s.lineTo(x + W, y + H - rad)
    s.absarc(x + W - rad, y + H - rad, rad, 0, Math.PI / 2, false)
    s.lineTo(x + rad, y + H)
    s.absarc(x + rad, y + H - rad, rad, Math.PI / 2, Math.PI, false)
    s.lineTo(x, y + rad)
    s.absarc(x + rad, y + rad, rad, Math.PI, Math.PI * 1.5, false)
  }
  const shape = new THREE.Shape()
  outline(shape, w, h, r)
  const hole = new THREE.Path()
  outline(hole, w - t * 2, h - t * 2, Math.max(0.01, r - t))
  shape.holes.push(hole)
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: false, curveSegments: 20 })
  g.translate(0, 0, -0.01)
  return g
}

/** 拱上薄板（0.02 厚）：与 archFillGeometry 同轮廓，用于入口厅西墙深蓝内衬（表面 37.90 对齐） */
function entryArchSkin(w: number, spring: number, h: number): THREE.ExtrudeGeometry {
  const r = w / 2 + RING_W
  const shape = new THREE.Shape()
  shape.moveTo(-r, h)
  shape.lineTo(-r, spring)
  shape.absarc(0, spring, r, Math.PI, 0, true)
  shape.lineTo(r, h)
  shape.closePath()
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: false, curveSegments: 48 })
  g.translate(0, 0, -0.01)
  return g
}

/** 环碟内盘：同心圈 + 扇区 + 中心核，贴 CircleGeometry（纹理外圈被圆裁掉） */
function makeDishTexture(): THREE.CanvasTexture {
  const S = 1024
  const cv = document.createElement('canvas')
  cv.width = S
  cv.height = S
  const ctx = cv.getContext('2d')!
  ctx.fillStyle = '#dfe7ef'
  ctx.fillRect(0, 0, S, S)
  const c = S / 2
  for (let i = 0; i < 6; i++) {
    const r = 120 + i * 68
    ctx.strokeStyle = i === 5 ? 'rgba(255,255,255,1)' : 'rgba(88,120,148,0.55)'
    ctx.lineWidth = i === 5 ? 8 : 3
    ctx.beginPath(); ctx.arc(c, c, r, 0, Math.PI * 2); ctx.stroke()
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    ctx.strokeStyle = 'rgba(96,132,162,0.5)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(c + Math.cos(a) * 190, c + Math.sin(a) * 190)
    ctx.lineTo(c + Math.cos(a) * 462, c + Math.sin(a) * 462)
    ctx.stroke()
  }
  ctx.strokeStyle = '#5f7a92'
  ctx.lineWidth = 5
  ctx.beginPath(); ctx.arc(c, c, 350, -Math.PI * 0.1, Math.PI * 0.35); ctx.stroke()
  ctx.beginPath(); ctx.arc(c, c, 350, Math.PI * 0.55, Math.PI * 0.95); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(c - 110, c); ctx.lineTo(c + 110, c); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(c, c - 110); ctx.lineTo(c, c + 110); ctx.stroke()
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

/**
 * 入口厅赛博空间装置（v13 B 档 / v16 收敛）：
 * ① 四面银白亮光内衬（保留原白墙，仅贴 0.02 薄板，共享墙另一侧不受影响）
 * ② 南/北墙圆角灯带框（5.6×2.9，转角 r=0.5）；v16 去除深色 HUD 屏与悬浮粒子
 *    v17：北框框心承载入口主标题（门楣字与门楣框一并撤除，主门拱上留净墙）
 * ④ 环碟天顶：(41.8, 4.60, 3)，外环 R1.30 / 发光细环 R1.20 / 内盘 R1.15 / 中心核 R0.26
 *    下沿 4.51 > 门楣视线在环心高度 2.68（SPAWN 44.2 朝 -x 不遮挡）
 * ⑤ 顶棚暗管 4 根
 */
function EntryChamber() {
  const built = useMemo(() => {
    const s = ENTRY_SPACE
    const cx = (s.x0 + s.x1) / 2
    const cz = (s.z0 + s.z1) / 2
    const w = s.x1 - s.x0
    const d = s.z1 - s.z0
    const h = s.h

    // ① 深蓝内衬：南/北 8×5、东 6×5、西墙左右两段（门洞 z 1.5~4.5 让开）
    // 表面比墙面（0.10）外凸 5mm：完全贴合会与墙共面产生 z-fighting（QA 首轮出现撕裂白斑）
    const skinIn = 0.105
    const skin: THREE.BufferGeometry[] = [
      new THREE.BoxGeometry(w, h, 0.02).translate(cx, h / 2, s.z0 + skinIn),
      new THREE.BoxGeometry(w, h, 0.02).translate(cx, h / 2, s.z1 - skinIn),
      new THREE.BoxGeometry(0.02, h, d).translate(s.x1 - skinIn, h / 2, cz),
      new THREE.BoxGeometry(0.02, h, 1.5).translate(s.x0 + skinIn, h / 2, s.z0 + 0.75),
      new THREE.BoxGeometry(0.02, h, 1.5).translate(s.x0 + skinIn, h / 2, s.z1 - 0.75),
    ]
    // 主门净宽 3.0（不是 DOOR_W=1.8 的暗廊宽）：用错净宽会让拱上深蓝板缩水，露出白色 archFill
    const archSkin = entryArchSkin(3.0, portalSpring(3.0), h)
    // 门洞两侧深蓝门柱：盖住骑缝突出的拱环竖直段（该段在暗场里读成刺眼白条）
    skin.push(new THREE.BoxGeometry(0.02, portalSpring(3.0) + 0.02, 0.14).translate(s.x0 + 0.125, (portalSpring(3.0) + 0.02) / 2, s.z0 + 1.43))
    skin.push(new THREE.BoxGeometry(0.02, portalSpring(3.0) + 0.02, 0.14).translate(s.x0 + 0.125, (portalSpring(3.0) + 0.02) / 2, s.z1 - 1.43))

    // ② 圆角灯带框：南/北墙
    const frame = roundedFrameGeom(5.6, 2.9, 0.5, 0.05)

    // ④ 环碟：吊杆 4 根 + 外环 + 发光细环（合批）
    const ringParts: THREE.BufferGeometry[] = []
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4
      ringParts.push(new THREE.BoxGeometry(0.035, 0.4, 0.035).translate(Math.cos(a) * 1.30, 4.80, cz + Math.sin(a) * 1.30))
    }
    const ring = mergeParts(ringParts)

    // ⑤ 顶棚暗管（沿 x 4 根）
    const pipes: THREE.BufferGeometry[] = []
    for (const z of [1.1, 2.2, 3.8, 4.9]) {
      pipes.push(new THREE.BoxGeometry(w - 0.6, 0.055, 0.055).translate(cx, 4.86, z))
    }
    const pipe = mergeParts(pipes)

    // ⑥ 倒角高光（v15 B 档）：墙顶 / 墙脚 0.035 冷白细线，复刻参考图的边缘亮边；西墙让开门洞
    const edges: THREE.BufferGeometry[] = []
    const E = 0.035
    const inset = 0.12
    for (const y of [h - 0.06, 0.06]) {
      edges.push(new THREE.BoxGeometry(w - inset * 2, E, E).translate(cx, y, s.z0 + inset))
      edges.push(new THREE.BoxGeometry(w - inset * 2, E, E).translate(cx, y, s.z1 - inset))
      edges.push(new THREE.BoxGeometry(E, E, d - inset * 2).translate(s.x1 - inset, y, cz))
      for (const [a, b] of [[s.z0 + inset, 1.5], [4.5, s.z1 - inset]] as const) {
        edges.push(new THREE.BoxGeometry(E, E, b - a).translate(s.x0 + inset, y, (a + b) / 2))
      }
    }
    const edge = mergeParts(edges)

    // ⑥ 悬浮粒子（v16 已移除：粒子在高亮银白墙上读作噪点，不保留）

    return { cx, cz, w, d, skin, archSkin, frame, ring, pipe, edge }
  }, [])

  const dishTex = useMemo(() => makeDishTexture(), [])
  // 亮光墙的反射来源：棚拍环境只挂内衬，不写 scene.environment（白盒四厅不受影响）
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    MAT_ENTRY_SKIN.envMap = studioEnv(gl)
    // 0.32 → 0.22：反射只做质感暗示，避免环境亮度叠加到墙面形成过曝
    MAT_ENTRY_SKIN.envMapIntensity = 0.22
    MAT_ENTRY_SKIN.needsUpdate = true
    // 环碟银白化后同挂棚拍环境：缎面银没有反射会读成灰塑料
    MAT_ENTRY_RING.envMap = studioEnv(gl)
    MAT_ENTRY_RING.needsUpdate = true
    MAT_ENTRY_PIPE.envMap = studioEnv(gl)
    MAT_ENTRY_PIPE.needsUpdate = true
  }, [gl])

  return (
    <>
      {/* ① 银白亮光内衬 */}
      <mesh geometry={mergeParts(built.skin)} material={MAT_ENTRY_SKIN} />
      <group position={[ENTRY_SPACE.x0 + 0.115, 0, built.cz]} rotation-y={Math.PI / 2}>
        <mesh geometry={built.archSkin} material={MAT_ENTRY_SKIN} />
      </group>
      {/* ⑥ 墙顶 / 墙脚倒角高光 */}
      <mesh geometry={built.edge} material={MAT_ENTRY_RIM} />

      {/* 深色玻璃地面 */}
      <mesh rotation-x={-Math.PI / 2} position={[built.cx, 0.006, built.cz]} material={MAT_ENTRY_FLOOR}>
        <planeGeometry args={[built.w, built.d]} />
      </mesh>

      {/* ② 南墙：圆角灯带框（深蓝 HUD 屏 v16 已移除：深色屏与银白墙语言冲突） */}
      <mesh geometry={built.frame} material={MAT_ENTRY_RIM} position={[built.cx, 2.45, 0.115]} />

      {/* ② 北墙：圆角灯带框（镜像朝 -z；v17 框心承载入口主标题） */}
      <mesh geometry={built.frame} material={MAT_ENTRY_RIM} position={[built.cx, 2.45, built.d - 0.115]} rotation-y={Math.PI} />

      {/* ④ 环碟天顶 */}
      <mesh geometry={built.ring} material={MAT_ENTRY_RING} />
      <mesh position={[built.cx, 4.60, built.cz]} rotation-x={Math.PI / 2} material={MAT_ENTRY_RING}>
        <torusGeometry args={[1.30, 0.085, 8, 96]} />
      </mesh>
      <mesh position={[built.cx, 4.60, built.cz]} rotation-x={Math.PI / 2} material={MAT_ENTRY_RIM}>
        <torusGeometry args={[1.19, 0.018, 8, 96]} />
      </mesh>
      <mesh position={[built.cx, 4.57, built.cz]} rotation-x={Math.PI / 2}>
        <circleGeometry args={[1.15, 64]} />
        <meshBasicMaterial map={dishTex} toneMapped={false} />
      </mesh>
      <mesh position={[built.cx, 4.56, built.cz]} rotation-x={Math.PI / 2} material={MAT_ENTRY_CORE}>
        <circleGeometry args={[0.26, 40]} />
      </mesh>

      {/* ⑤ 顶棚暗管 */}
      <mesh geometry={built.pipe} material={MAT_ENTRY_PIPE} />
    </>
  )
}

/** 踢脚细灯带：贴实墙脚线（跳过门洞），v3 C1 全馆冷银白 */
function SkirtingStrips() {
  const items = useMemo(() => {
    const out: { pos: [number, number, number]; size: [number, number, number] }[] = []
    const INSET = 0.16
    for (const h of HALLS) {
      const len = h.x1 - h.x0
      const wid = h.z1 - h.z0
      const add = (wall: WallId) => {
        const wallLen = wall === 'N' || wall === 'S' ? len : wid
        for (const [a, b] of wallRuns(wallLen, h.doors[wall] ?? [])) {
          if (b - a < 0.4) continue
          if (wall === 'N') out.push({ pos: [h.x0 + (a + b) / 2, 0.025, h.z1 - INSET], size: [b - a, 0.024, 0.05] })
          if (wall === 'S') out.push({ pos: [h.x0 + (a + b) / 2, 0.025, h.z0 + INSET], size: [b - a, 0.024, 0.05] })
          if (wall === 'W') out.push({ pos: [h.x0 + INSET, 0.025, h.z0 + (a + b) / 2], size: [0.05, 0.024, b - a] })
          if (wall === 'E') out.push({ pos: [h.x1 - INSET, 0.025, h.z0 + (a + b) / 2], size: [0.05, 0.024, b - a] })
        }
      }
      ;(['N', 'S', 'W', 'E'] as const).forEach(add)
    }
    return out
  }, [])
  const mat = useMemo(() => glowMat('#eef4ff', 0.75), [])
  return (
    <>
      {items.map((s, i) => (
        <mesh key={i} position={s.pos} material={mat}>
          <boxGeometry args={s.size} />
        </mesh>
      ))}
    </>
  )
}

/** 地面导览嵌线：沿蛇形动线的深灰细嵌线（浅色地面上的导览符号，非发光） */
function RouteLines() {
  const segs = useMemo(() => {
    const out: { pos: [number, number, number]; len: number; alongZ: boolean }[] = []
    for (let i = 0; i < ROUTE.length - 1; i++) {
      const [x0, z0] = ROUTE[i]
      const [x1, z1] = ROUTE[i + 1]
      const dx = x1 - x0
      const dz = z1 - z0
      const l = Math.hypot(dx, dz)
      if (l < 0.2) continue
      out.push({ pos: [(x0 + x1) / 2, 0.007, (z0 + z1) / 2], len: l, alongZ: Math.abs(dz) > Math.abs(dx) })
    }
    return out
  }, [])
  return (
    <>
      {segs.map((s, i) => (
        <mesh key={i} position={s.pos} rotation={[-Math.PI / 2, 0, s.alongZ ? Math.PI / 2 : 0]} material={MAT_ROUTE_INLAY}>
          <planeGeometry args={[s.alongZ ? 0.05 : s.len, s.alongZ ? s.len : 0.05]} />
        </mesh>
      ))}
    </>
  )
}

/** 灯轨：每厅天花 2 条深灰轨道 + 哑光灯头（白棚上的专业展陈细节） */
function LightRails() {
  const rails = useMemo(() => {
    const out: { hall: Space; zOff: number }[] = []
    for (const h of HALLS) for (const zOff of [-3.2, 3.2]) out.push({ hall: h, zOff })
    return out
  }, [])

  return (
    <>
      {rails.map(({ hall, zOff }, i) => {
        const cx = (hall.x0 + hall.x1) / 2
        const cz = (hall.z0 + hall.z1) / 2 + zOff
        return (
          <group key={i}>
            <mesh position={[cx, hall.h - 0.05, cz]} material={MAT_RAIL}>
              <boxGeometry args={[14, 0.045, 0.065]} />
            </mesh>
            {[-5.4, -2.7, 0, 2.7, 5.4].map((dx) => (
              <mesh key={dx} position={[cx + dx, hall.h - 0.13, cz]} material={MAT_RAIL}>
                <cylinderGeometry args={[0.04, 0.05, 0.12, 10]} />
              </mesh>
            ))}
          </group>
        )
      })}
    </>
  )
}

/** 岛台长凳：仅 H3 厅中心（H2 大三巴、H1 天星小轮、H4 圆形花坛各占中心位） */
function Benches() {
  return (
    <>
      {HALLS.filter((h) => h.id !== RUINS_STPAUL.hallId && h.id !== 'H1' && h.id !== 'H4').map((h) => {
        const cx = (h.x0 + h.x1) / 2
        const cz = (h.z0 + h.z1) / 2
        return (
          <mesh key={h.id} position={[cx, 0.17, cz]} material={MAT_BENCH}>
            <boxGeometry args={[2.6, 0.34, 0.8]} />
          </mesh>
        )
      })}
    </>
  )
}

// ── v16 H4「林间生灵」圆形花坛 + 郁金香（C 档）──
// 口径：零外链几何/贴图；近景 12~14 株精模（Lathe 16 段花头 + 双叶），其余 36 株简模（8 段 + 单叶），
// 全部 InstancedMesh + instanceColor 承载三色花；花坛外沿冷白细环沿用全馆灯带语言；
// 无阴影贴图 → 底部内凹暗圈 + 贴地接触暗环假造落地感。
const H4_SPACE = SPACES.find((s) => s.id === 'H4')!
const GARDEN = { r: 2.0, wall: 0.45, soilY: 0.32, stem: 0.45, rimR: 2.01 } as const
const TULIP_COLORS = ['#e8733c', '#f2ece1', '#c8547a', '#e8733c', '#f2ece1', '#e8733c'] as const

const MAT_GARDEN_SHELL = new THREE.MeshStandardMaterial({ color: '#d9d4c9', roughness: 0.82, side: THREE.DoubleSide })
const MAT_GARDEN_SOIL = new THREE.MeshStandardMaterial({ color: '#332c25', roughness: 0.95 })
const MAT_GARDEN_MOSS = new THREE.MeshStandardMaterial({ color: '#3f5137', roughness: 0.9 })
const MAT_TULIP_HEAD = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.62 })
const MAT_TULIP_STEM = new THREE.MeshStandardMaterial({ color: '#3e6b45', roughness: 0.75 })
const MAT_GARDEN_RIM = glowMat('#e8f4ff', 1.05)
const MAT_GARDEN_SHADOW = new THREE.MeshBasicMaterial({
  color: '#141414', transparent: true, opacity: 0.18, depthWrite: false,
})

/** H4 林间光斑（v17）：4 片贴地柔和冷光斑，径向渐变 Canvas 贴图 + 加色混合；
 *  不做真光源（厅内点光预算锁 1 盏），只用透明贴图在地面制造「树隙透光」的亮度层次 */
function makeSpotTexture(): THREE.CanvasTexture {
  const S = 256
  const cv = document.createElement('canvas')
  cv.width = S
  cv.height = S
  const ctx = cv.getContext('2d')!
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
  g.addColorStop(0, 'rgba(214,236,255,0.94)')
  g.addColorStop(0.32, 'rgba(192,220,252,0.62)')
  g.addColorStop(0.68, 'rgba(170,206,246,0.20)')
  g.addColorStop(1, 'rgba(160,200,240,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, S, S)
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}
const MAT_LIGHT_SPOT = new THREE.MeshBasicMaterial({
  map: makeSpotTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
})
const GEO_LIGHT_SPOT = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)
/** 光斑布局（相对厅中心，避开西侧门洞与花坛外沿 2.0m） */
const LIGHT_SPOTS = [
  { x: -4.4, z: 1.5, r: 1.45, rot: 0.55 },
  { x: -3.0, z: -3.4, r: 1.05, rot: 1.90 },
  { x: 4.3, z: 2.7, r: 1.60, rot: 2.40 },
  { x: 2.7, z: -4.6, r: 1.15, rot: 0.30 },
] as const

/** 郁金香花头：Lathe 杯形（口径 0.092 / 高 0.143）+ 6 片冠状尖瓣（v17 花瓣尖细化）。
 *  seg 决定杯体轮廓（近景 16 段 / 远景 8 段），尖瓣两级共用——2m 内冠状轮廓已可读出，
 *  只省杯体段数不省瓣形，避免近/远景株在同一画面里出现「尖瓣 vs 光蛋」的割裂感。 */
function tulipHeadGeom(seg: number): THREE.BufferGeometry {
  const K = 1.35
  const pts = [
    new THREE.Vector2(0.004, 0),
    new THREE.Vector2(0.014, 0.006),
    new THREE.Vector2(0.026, 0.020),
    new THREE.Vector2(0.034, 0.048),
    new THREE.Vector2(0.032, 0.078),
    new THREE.Vector2(0.023, 0.100),
    new THREE.Vector2(0.018, 0.106),
  ].map((p) => new THREE.Vector2(p.x * K, p.y * K))
  // 杯口封片：俯视 35° 时不再看进杯内黑洞（Lathe 开口，补一层同材质圆片）
  const cap = new THREE.CircleGeometry(0.032, seg).rotateX(-Math.PI / 2).translate(0, 0.137, 0)
  const cup = mergeParts([new THREE.LatheGeometry(pts, seg), cap])
  // 尖瓣：压扁四棱锥（瓣基 0.055×0.012），瓣基落在杯口外缘、外倾 0.20rad，瓣尖抬到 0.177
  const N = 6
  const petals: THREE.BufferGeometry[] = []
  for (let i = 0; i < N; i++) {
    const p = new THREE.ConeGeometry(0.0165, 0.058, 4)
      .scale(1.68, 1, 0.55)
      .translate(0, 0.029, 0)
      .rotateZ(-0.20)
      .translate(0.032, 0.122, 0)
      .rotateY((i / N) * Math.PI * 2 + Math.PI / N)
    petals.push(p)
  }
  return mergeParts([cup, ...petals])
}

/** 茎 + 叶：茎高 0.45；叶片薄板按角度倾斜插在茎下部 */
function tulipStemGeom(leafCount: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [
    new THREE.CylinderGeometry(0.007, 0.009, GARDEN.stem, 6).translate(0, GARDEN.stem / 2, 0),
  ]
  const angles = leafCount === 2 ? [0.38, -0.52] : [0.38]
  for (const a of angles) {
    parts.push(
      new THREE.BoxGeometry(0.032, 0.28, 0.005)
        .translate(0, 0.14, 0)
        .rotateZ(a)
        .translate(Math.sign(a) * 0.025, 0.10, 0),
    )
  }
  return mergeParts(parts)
}

interface TulipSpot {
  x: number; z: number; ry: number; tilt: number; s: number; color: string; near: boolean
}

/** 三环布局：R 0.55/1.05/1.55，10/16/22 株；朝西（入口）方向的近景株标为精模，上限 14 株 */
function tulipSpots(): TulipSpot[] {
  const spots: TulipSpot[] = []
  let ci = 0
  let nearCount = 0
  const rings = [
    { r: 0.55, n: 10 },
    { r: 1.05, n: 16 },
    { r: 1.55, n: 22 },
  ]
  for (const ring of rings) {
    for (let i = 0; i < ring.n; i++) {
      const a = (i / ring.n) * Math.PI * 2 + ring.r * 0.7
      const d = Math.abs(Math.atan2(Math.sin(a - Math.PI), Math.cos(a - Math.PI)))
      const near = d < Math.PI / 3 && nearCount < 14
      if (near) nearCount++
      spots.push({
        x: Math.cos(a) * ring.r,
        z: Math.sin(a) * ring.r,
        ry: -a,
        tilt: (Math.random() - 0.5) * 0.16,
        s: 0.9 + Math.random() * 0.25,
        color: TULIP_COLORS[ci++ % TULIP_COLORS.length],
        near,
      })
    }
  }
  return spots
}

/** 把一批株位写入 InstancedMesh（茎叶在土面，花头抬到茎顶）；tint=false 时不写实例色（茎叶保持本色绿） */
function fillTulips(mesh: THREE.InstancedMesh, spots: TulipSpot[], yBase: number, tint = true) {
  const o = new THREE.Object3D()
  const c = new THREE.Color()
  spots.forEach((p, i) => {
    o.position.set(p.x, yBase, p.z)
    o.rotation.set(0, p.ry, p.tilt)
    o.scale.setScalar(p.s)
    o.updateMatrix()
    mesh.setMatrixAt(i, o.matrix)
    if (tint) {
      c.set(p.color)
      mesh.setColorAt(i, c)
    }
  })
  mesh.instanceMatrix.needsUpdate = true
  if (tint && mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  mesh.frustumCulled = false
}

function TulipGarden() {
  const cx = (H4_SPACE.x0 + H4_SPACE.x1) / 2
  const cz = (H4_SPACE.z0 + H4_SPACE.z1) / 2

  const built = useMemo(() => {
    // 花坛外壳：外筒（略收口）+ 顶圈 + 内筒，双面材质一次合批
    const shell = mergeParts([
      new THREE.CylinderGeometry(GARDEN.r, GARDEN.r + 0.04, GARDEN.wall, 48, 1, true).translate(0, GARDEN.wall / 2, 0),
      new THREE.RingGeometry(GARDEN.r - 0.10, GARDEN.r + 0.02, 48).rotateX(-Math.PI / 2).translate(0, GARDEN.wall, 0),
      new THREE.CylinderGeometry(GARDEN.r - 0.10, GARDEN.r - 0.10, GARDEN.wall, 48, 1, true).translate(0, GARDEN.wall / 2, 0),
    ])
    const soil = new THREE.CircleGeometry(GARDEN.r - 0.11, 48).rotateX(-Math.PI / 2).translate(0, GARDEN.soilY, 0)
    // 中心苔藓丘：压扁半球（高 0.19）
    const moss = new THREE.SphereGeometry(0.55, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2)
      .scale(1, 0.34, 1)
      .translate(0, GARDEN.soilY, 0)
    const rim = new THREE.TorusGeometry(GARDEN.rimR, 0.016, 6, 64)
      .rotateX(Math.PI / 2)
      .translate(0, GARDEN.wall + 0.004, 0)
    // 贴地接触暗环：压住镜像地面上的悬浮感
    const shadow = new THREE.RingGeometry(GARDEN.r + 0.02, GARDEN.r + 0.18, 48)
      .rotateX(-Math.PI / 2)
      .translate(0, 0.009, 0)

    const spots = tulipSpots()
    const near = spots.filter((p) => p.near)
    const far = spots.filter((p) => !p.near)

    const headNear = new THREE.InstancedMesh(tulipHeadGeom(16), MAT_TULIP_HEAD, near.length)
    const headFar = new THREE.InstancedMesh(tulipHeadGeom(8), MAT_TULIP_HEAD, far.length)
    const stemNear = new THREE.InstancedMesh(tulipStemGeom(2), MAT_TULIP_STEM, near.length)
    const stemFar = new THREE.InstancedMesh(tulipStemGeom(1), MAT_TULIP_STEM, far.length)

    fillTulips(stemNear, near, GARDEN.soilY, false)
    fillTulips(stemFar, far, GARDEN.soilY, false)
    // 花头：同株位，y 抬到茎顶（缩放随株高同步）
    const hoist = (list: TulipSpot[], mesh: THREE.InstancedMesh) => {
      const shifted = list.map((p) => ({ ...p, x: p.x, z: p.z }))
      const o = new THREE.Object3D()
      const c = new THREE.Color()
      shifted.forEach((p, i) => {
        o.position.set(p.x, GARDEN.soilY + GARDEN.stem * p.s, p.z)
        o.rotation.set(0, p.ry, p.tilt)
        o.scale.setScalar(p.s)
        o.updateMatrix()
        mesh.setMatrixAt(i, o.matrix)
        c.set(p.color)
        mesh.setColorAt(i, c)
      })
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      mesh.frustumCulled = false
    }
    hoist(near, headNear)
    hoist(far, headFar)

    return { shell, soil, moss, rim, shadow, headNear, headFar, stemNear, stemFar }
  }, [])

  return (
    <group position={[cx, 0, cz]}>
      <mesh geometry={built.shell} material={MAT_GARDEN_SHELL} />
      <mesh geometry={built.soil} material={MAT_GARDEN_SOIL} />
      <mesh geometry={built.moss} material={MAT_GARDEN_MOSS} />
      <mesh geometry={built.shadow} material={MAT_GARDEN_SHADOW} />
      <mesh geometry={built.rim} material={MAT_GARDEN_RIM} />
      <primitive object={built.headNear} />
      <primitive object={built.headFar} />
      <primitive object={built.stemNear} />
      <primitive object={built.stemFar} />
      {LIGHT_SPOTS.map((s, i) => (
        <mesh
          key={`spot-${i}`}
          geometry={GEO_LIGHT_SPOT}
          material={MAT_LIGHT_SPOT}
          position={[s.x, 0.016, s.z]}
          rotation={[0, s.rot, 0]}
          scale={[s.r, 1, s.r]}
          renderOrder={2}
        />
      ))}
    </group>
  )
}

// ── v12 H1「香港故事」天星小轮 1:10 船模（A+ 方案）──
// 造型口径：双头对称船体（首尾同形、两端驾驶台）+ 墨绿船体 / 乳白舱壁 / 深绿顶棚 /
// 黑水线 / 橙色救生圈 / 白色船名带；零外链几何，单 mesh 合并（顶点色承载配色），
// 另配中性浅石材台座 + 暖金灯带 + 展签。整体 1.21×（1:12→1:10），
// 总高 1.48m，低于视平线 1.70 与画顶红线 2.60；布点即厅中心。
const C_FERRY_HULL = '#1b4b3b'
const C_FERRY_LINE = '#14181a'
const C_FERRY_WHITE = '#f2efe6'
const C_FERRY_GLASS = '#26423c'
const C_FERRY_ROOF = '#17443a'
const C_FERRY_ORANGE = '#e2602a'
const C_FERRY_DARK = '#1a1c1d'

/** 船漆材质：顶点色承载全部配色，缎面光泽（envmap 由组件挂 studio IBL；roughness 压住顶棚镜面高光，避免绿顶棚被洗成白甲板） */
const MAT_FERRY = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.58, metalness: 0.12 })
/** 台座前缘暖金灯带（亮度 0.52：比 v11 提一档，仍压在 Bloom 阈值 0.92 下只做勾勒） */
const MAT_FERRY_GLOW = glowMat(THEMES.H1.accent, 0.52)
/** 台座底部 2cm 暗槽（深暖灰），制造「浮起」的展台收头 */
const MAT_FERRY_BASE_GAP = new THREE.MeshStandardMaterial({ color: '#3b3732', roughness: 0.85, metalness: 0.02 })
/** 台座主体：中性浅石材（与白盒墙面同一语言；暖金只留在灯带与展签，避免整体发木色） */
const MAT_FERRY_PLINTH = new THREE.MeshStandardMaterial({ color: '#dedbd4', roughness: 0.78, metalness: 0.02 })

/**
 * 船体俯视轮廓：首尾同形（双头船），中段近等宽、两端收尖。
 * v12 收尖再锐一档：改用单段三次贝塞尔（首尾切线与中轴夹角由约 66°收至约 44°），
 * 中段用水平切线接续，轮廓零折点（v11 的四段二次曲线在肩部有约 30° 切向破口）。
 */
function ferryPlanShape(len: number, beam: number): THREE.Shape {
  const L = len / 2
  const B = beam / 2
  const s = new THREE.Shape()
  s.moveTo(L, 0)
  // +z 舷：首尖 → 最大船宽
  s.bezierCurveTo(L * 0.94, B * 0.52, L * 0.50, B * 0.98, 0, B * 0.995)
  s.bezierCurveTo(-L * 0.50, B * 0.98, -L * 0.94, B * 0.52, -L, 0)
  // −z 舷（与 +z 舷镜像）
  s.bezierCurveTo(-L * 0.94, -B * 0.52, -L * 0.50, -B * 0.98, 0, -B * 0.995)
  s.bezierCurveTo(L * 0.50, -B * 0.98, L * 0.94, -B * 0.52, L, 0)
  s.closePath()
  return s
}

/**
 * 顶点色涂层（与 shadePart 同构，但不带石材的暖褐偏色）：
 * 船漆要保持绿/白/橙的本色，只按法线方向压暗做体感。
 */
function paintPart(
  g: THREE.BufferGeometry,
  hex: string,
  opts?: { top?: number; front?: number; bottom?: number; side?: number },
): THREE.BufferGeometry {
  const geo = g.index ? g.toNonIndexed() : g
  if (!geo.getAttribute('normal')) geo.computeVertexNormals()
  const nor = geo.getAttribute('normal') as THREE.BufferAttribute
  const pos = geo.getAttribute('position') as THREE.BufferAttribute
  const c = new THREE.Color(hex)
  const top = opts?.top ?? 1
  const front = opts?.front ?? 0.97
  const bottom = opts?.bottom ?? 0.72
  const side = opts?.side ?? 0.88
  const col = new Float32Array(pos.count * 3)
  for (let i = 0; i < pos.count; i++) {
    const ny = nor.getY(i)
    const nz = nor.getZ(i)
    const s = Math.abs(ny) > 0.55 ? (ny > 0 ? top : bottom) : Math.abs(nz) > 0.55 ? (nz > 0 ? front : side) : side
    col[i * 3] = c.r * s
    col[i * 3 + 1] = c.g * s
    col[i * 3 + 2] = c.b * s
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
  return geo
}

/** 船体分层板：俯视轮廓沿 y 挤出一段（k = 相对船宽/船长的内缩系数） */
function hullSlab(y0: number, y1: number, k: number, hex: string): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(ferryPlanShape(FERRY.len * k, FERRY.beam * k), {
    depth: y1 - y0,
    bevelEnabled: false,
    curveSegments: 12,
  })
  g.rotateX(-Math.PI / 2)
  g.translate(0, y0, 0)
  return paintPart(g, hex, { top: 1, front: 0.98, bottom: 0.78, side: 0.9 })
}

/** 舷窗阵列（单侧一排方窗，深绿玻璃），sideSign=±1 指 ±z 舷侧 */
function portholeRow(y: number, zHalf: number, count: number, gap: number, w: number, h: number, hex: string): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = []
  for (const sgn of [-1, 1]) {
    for (let i = 0; i < count; i++) {
      const x = (i - (count - 1) / 2) * gap
      const g = new THREE.BoxGeometry(w, h, 0.014)
      g.translate(x, y, sgn * zHalf)
      out.push(paintPart(g, hex, { top: 0.94, front: 1, bottom: 0.82, side: 0.9 }))
    }
  }
  return out
}

/** 船名贴图：乳白字压在墨绿舷侧（透明底，避免多一层背板） */
function ferryNameTexture(): THREE.CanvasTexture {
  const W = 1024
  const H = 128
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H
  const ctx = cv.getContext('2d')!
  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = '#f4f1e7'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '600 76px "Helvetica Neue",Arial,sans-serif'
  ctx.fillText('S T A R   F E R R Y', W / 2, H / 2 + 4)
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

/** 几何落地：整体 1.21× 后把水线底（原 y=0.22）坐到台座顶面（0.02+0.24=0.26） */
function ferryPlace(g: THREE.BufferGeometry): THREE.BufferGeometry {
  g.scale(FERRY.scale, FERRY.scale, FERRY.scale)
  g.translate(0, FERRY.base + FERRY.plinth.h - 0.22 * FERRY.scale, 0)
  return g
}

/** 船体主几何：水线 → 舷带 → 白舱 → 绿顶 → 双驾驶台 → 旗杆（合并单 mesh） */
function buildStarFerry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  const L = FERRY.len

  // ① 水线黑带 0.22~0.248（底部略收，避免死角）
  parts.push(hullSlab(0.22, 0.248, 0.975, C_FERRY_LINE))
  // ② 墨绿船体 0.248~0.50（干舷）
  parts.push(hullSlab(0.248, 0.50, 1, C_FERRY_HULL))
  // ③ 下部白舷带 0.50~0.57（下舱窗带基色）
  parts.push(hullSlab(0.50, 0.57, 0.962, C_FERRY_WHITE))
  // ④ 上部白舱壁 0.57~0.86（内缩 0.865，形成台阶）
  parts.push(hullSlab(0.57, 0.86, 0.865, C_FERRY_WHITE))
  // ⑤ 深绿顶棚 0.86~0.905（内缩 0.9，出檐盖住舱壁）
  parts.push(hullSlab(0.86, 0.905, 0.90, C_FERRY_ROOF))

  // ⑥ 舷窗：下舱 8 个/侧（白带内暗窗），上舱 9 个/侧（深绿玻璃）
  parts.push(...portholeRow(0.534, FERRY.beam * 0.962 / 2 + 0.002, 8, 0.20, 0.088, 0.046, C_FERRY_GLASS))
  parts.push(...portholeRow(0.712, FERRY.beam * 0.865 / 2 + 0.001, 9, 0.152, 0.074, 0.142, C_FERRY_GLASS))

  // ⑦ 两端驾驶台：白色桥楼（0.12 高，不再是贴顶薄板）+ 四面深色窗带 + 深绿平檐
  for (const sgn of [-1, 1]) {
    const bx = sgn * 0.94
    parts.push(paintPart(new THREE.BoxGeometry(0.26, 0.12, 0.44).translate(bx, 0.965, 0), C_FERRY_WHITE, { top: 1, front: 0.98, bottom: 0.72, side: 0.9 }))
    // 外舷（首尾向）窗带
    parts.push(paintPart(new THREE.BoxGeometry(0.05, 0.06, 0.40).translate(bx + sgn * 0.112, 0.975, 0), C_FERRY_GLASS, { top: 0.9, front: 1, bottom: 0.8, side: 0.9 }))
    // 两舷（±z）窗带：正侧视也能读成驾驶台
    for (const zs of [-1, 1]) {
      parts.push(paintPart(new THREE.BoxGeometry(0.16, 0.05, 0.012).translate(bx, 0.975, zs * 0.221), C_FERRY_GLASS, { top: 0.9, front: 1, bottom: 0.8, side: 0.9 }))
    }
    parts.push(paintPart(new THREE.BoxGeometry(0.30, 0.008, 0.48).translate(bx, 1.029, 0), C_FERRY_ROOF, { top: 1, front: 0.95, bottom: 0.7, side: 0.86 }))
  }

  // ⑧ 黑色防撞护舷：舷侧 4 组小柱 + 首尾弧形护垫（收紧到 r0.026，避免读成轮胎）
  for (const sgn of [-1, 1]) {
    for (const bx of [-0.72, -0.24, 0.24, 0.72]) {
      const cyl = new THREE.CylinderGeometry(0.016, 0.016, 0.13, 8)
      cyl.translate(bx, 0.355, sgn * (FERRY.beam * 0.5 - 0.004))
      parts.push(paintPart(cyl, C_FERRY_DARK, { top: 0.9, front: 1, bottom: 0.7, side: 0.86 }))
    }
    // 首尾护垫：贴住船首柱，半径收到 0.022（此前 0.034 读成「轮胎/黑洞」）
    const pad = new THREE.CylinderGeometry(0.022, 0.022, 0.07, 8)
    pad.rotateX(Math.PI / 2)
    pad.translate(sgn * (L / 2 - 0.004), 0.33, 0)
    parts.push(paintPart(pad, C_FERRY_DARK, { top: 0.92, front: 0.98, bottom: 0.7, side: 0.88 }))
  }

  // ⑨ 橙色救生圈 4 只：挂在白舱壁舷侧
  for (const sgn of [-1, 1]) {
    for (const bx of [-0.46, 0.46]) {
      const ring = new THREE.TorusGeometry(0.042, 0.012, 6, 10)
      ring.translate(bx, 0.66, sgn * (FERRY.beam * 0.865 / 2 + 0.006))
      parts.push(paintPart(ring, C_FERRY_ORANGE, { top: 0.96, front: 1, bottom: 0.78, side: 0.9 }))
    }
  }

  // ⑩ 首尾旗杆 + 球顶（双头船两端同高，杆脚落在顶棚面上）
  for (const sgn of [-1, 1]) {
    const mast = new THREE.CylinderGeometry(0.006, 0.010, 0.30, 6)
    mast.translate(sgn * (L / 2 - 0.16), 1.055, 0)
    parts.push(paintPart(mast, C_FERRY_DARK, { top: 0.98, front: 1, bottom: 0.7, side: 0.86 }))
    const ball = new THREE.SphereGeometry(0.012, 6, 4)
    ball.translate(sgn * (L / 2 - 0.16), 1.218, 0)
    parts.push(paintPart(ball, C_FERRY_WHITE, { top: 1, front: 1, bottom: 0.8, side: 0.9 }))
  }

  return ferryPlace(mergeParts(parts))
}

/** 船名板（左右舷各一，同贴图合并单 mesh；与船体同变换缩放落地） */
function buildFerryNames(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  for (const sgn of [-1, 1]) {
    const g = new THREE.PlaneGeometry(0.56, 0.066)
    if (sgn < 0) g.rotateY(Math.PI)
    g.translate(0, 0.44, sgn * (FERRY.beam * 0.5 + 0.001))
    parts.push(g)
  }
  return ferryPlace(mergeParts(parts))
}

/** H1 天星小轮展品（A+）：船体 + 船名 + 石灰华台座 + 暖金灯带 + 落地接触线 + 展签 */
function StarFerry() {
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    const env = studioEnv(gl)
    MAT_FERRY.envMap = env
    MAT_FERRY.envMapIntensity = 0.42
    MAT_FERRY.needsUpdate = true
  }, [gl])

  const built = useMemo(
    () => ({
      ship: buildStarFerry(),
      names: buildFerryNames(),
      plinth: new THREE.BoxGeometry(FERRY.plinth.w, FERRY.plinth.h, FERRY.plinth.d),
      baseShadow: new THREE.BoxGeometry(FERRY.plinth.w - 0.08, 0.02, FERRY.plinth.d - 0.08),
      glow: new THREE.BoxGeometry(FERRY.plinth.w - 0.06, 0.012, 0.012),
      contact: new THREE.PlaneGeometry(FERRY.plinth.w + 0.24, FERRY.plinth.d + 0.24),
      nameTex: ferryNameTexture(),
    }),
    [],
  )

  const label = useMemo(
    () =>
      makeLabelPlane('天星小轮', 'STAR FERRY · 1:10 船模 · 香港', {
        width: 0.60,
        height: 0.155,
        bg: '#f2eee5',
        fg: '#22352e',
        subFg: '#7c8a83',
        accent: THEMES.H1.accent,
        fontSizePx: 112,
        subSizePx: 40,
      }),
    [],
  )

  useEffect(
    () => () => {
      built.ship.dispose()
      built.names.dispose()
      built.plinth.dispose()
      built.baseShadow.dispose()
      built.glow.dispose()
      built.contact.dispose()
      built.nameTex.dispose()
      const lm = label.material as THREE.MeshBasicMaterial
      lm.map?.dispose()
      lm.dispose()
      label.geometry.dispose()
    },
    [built, label],
  )

  return (
    <group position={[FERRY.center.x, 0, FERRY.center.z]}>
      {/* 台座下沉式暗槽（2cm）：把展台从「木托板」读成博物馆基座 */}
      <mesh position={[0, 0.01, 0]} geometry={built.baseShadow} material={MAT_FERRY_BASE_GAP} />
      {/* 中性石材台座（3.62×0.24×1.34，压在 2cm 暗槽上） */}
      <mesh position={[0, 0.02 + FERRY.plinth.h / 2, 0]} geometry={built.plinth} material={MAT_FERRY_PLINTH} />
      {/* 台座前缘暖金灯带（面向动线来向 -z 一侧） */}
      <mesh position={[0, 0.02 + FERRY.plinth.h - 0.004, -FERRY.plinth.d / 2]} geometry={built.glow} material={MAT_FERRY_GLOW} />
      {/* 船体：水线 + 干舷 + 舷带 + 舱壁 + 顶棚 + 驾驶台 + 护舷 + 救生圈 + 旗杆（单 mesh，已 1.21× 落台座顶） */}
      <mesh geometry={built.ship} material={MAT_FERRY} />
      {/* 左右舷船名（Canvas 贴图，透明底） */}
      <mesh geometry={built.names}>
        <meshBasicMaterial map={built.nameTex} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      {/* 台座落地接触线：把船模压在反光地面上 */}
      <mesh position={[0, 0.004, 0]} rotation-x={-Math.PI / 2} geometry={built.contact} material={MAT_CONTACT} renderOrder={1} />
      {/* 台座正面展签（朝 -z，迎动线来向） */}
      <primitive object={label} position={[0, 0.13, -(FERRY.plinth.d / 2 + 0.003)]} rotation-y={Math.PI} />
    </group>
  )
}

// ── v8 H3「海与港」悬垂海浪丝带装置（玻璃海材质档）──
// 老板口径：5 条宽海浪丝带从发光天棚垂下、绕长凳半环排布、有间隔、有流动感。
// 形态三项：① 横截面 S 形卷边（不再是刀片，侧面有绸带厚度）；② 纵向扭转 + 底摆大于顶（顶端吊点固定）；
// ③ shader 纵向流动：浪花高光带以 1.9 rad/s 向上推进、片体微摆，?quality=perf 档冻结。
// 色彩取自玻璃海：深海青 → 青 → 玻璃青 → 白沫；菲涅尔边缘 #CFF4FF，通透双面。
// 全装置不进 Octree、不加光源、不占挂位。
const SEA_VERT = /* glsl */ `
uniform float uTime;
attribute float aPhase;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
varying float vPhase;

void main() {
  vUv = uv;
  vPhase = aPhase;
  vec3 p = position;
  // 顶端吊点固定、越往下越自由：hang 0→1
  float hang = 1.0 - uv.y;
  float wob = sin(uv.y * 5.0 + uTime * 1.15 + aPhase) * 0.055 * hang;
  p.z += wob;
  p.x += wob * 0.65;

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`

const SEA_FRAG = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
uniform vec3 uDeep;
uniform vec3 uMid;
uniform vec3 uGlass;
uniform vec3 uFoam;
uniform vec3 uEdge;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
varying float vPhase;

void main() {
  float t = vUv.y;
  // 纵向水色分层：底下段深海青（压住重心）→ 中层青 → 上部玻璃青
  vec3 col = mix(uDeep, uMid, smoothstep(0.0, 0.52, t));
  col = mix(col, uGlass, smoothstep(0.48, 0.88, t));
  // 顶端极轻白化（贴天棚处像浪尖泛白，不发死白）
  col = mix(col, uFoam, 0.06 * smoothstep(0.93, 1.0, t));

  // 流动浪花高光带：沿纵向向上推进，5 条相位错开
  float band = sin(t * 11.0 - uTime * 1.9 + vUv.x * 3.4 + vPhase);
  float crest = pow(max(0.0, band), 10.0);
  col += uFoam * crest * 0.55;

  // 横向贴边白沫
  float ex = smoothstep(0.40, 0.50, abs(vUv.x - 0.5));
  col += uFoam * ex * 0.22;

  // 菲涅尔：正对视线的面通透、掠射角发亮（玻璃感）
  float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
  col = mix(col, uEdge, clamp(fres * 0.9, 0.0, 0.6));

  float a = uOpacity + 0.30 * fres + 0.22 * ex + 0.20 * crest;
  gl_FragColor = vec4(col, clamp(a, 0.0, 0.95));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

/** 吊索：细钢缆哑光深灰 */
const MAT_CABLE = new THREE.MeshStandardMaterial({ color: '#6a6f74', roughness: 0.5, metalness: 0.2 })

/** 玻璃海材质：自定义 shader（纵向流动 + 菲涅尔边缘；不走 transmission，避免额外 render target 开销） */
function makeSeaMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color('#0a4f63') },
      uMid: { value: new THREE.Color('#1ea3a8') },
      uGlass: { value: new THREE.Color('#6fdde2') },
      uFoam: { value: new THREE.Color('#eafbff') },
      uEdge: { value: new THREE.Color('#d8f7fb') },
      uOpacity: { value: 0.72 },
    },
    vertexShader: SEA_VERT,
    fragmentShader: SEA_FRAG,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  })
}

/** 丝带几何：微卷边截面 + 纵向扭转 + 顶端固定/底端摆动（一次成型，运行时只由 shader 做微流动） */
function ribbonGeometry(width: number, len: number, phase: number): THREE.PlaneGeometry {
  const geo = new THREE.PlaneGeometry(width, len, 24, 64)
  const pos = geo.attributes.position as THREE.BufferAttribute
  // 截面微卷：弦宽保持 1.1m、单边弧深 ≈0.155m（卷过头会变「蚌壳」，侧看像筒）
  const half = width / 2
  const ANG = 0.55
  const R = half / Math.sin(ANG)
  for (let i = 0; i < pos.count; i++) {
    const s = pos.getX(i)
    const ly = pos.getY(i)
    const t = (ly + len / 2) / len
    // 顶部 18% 锁定为平直：顶边贴合双吊索，不做卷边/扭转折角（否则顶端翘成鱼鳍、与吊索脱开）
    const topLock = Math.min(1, (1 - t) / 0.18)
    const phi = (s / half) * ANG
    // 宽度沿纵向呼吸 ±8%：左右边缘成波浪轮廓，不再是直边纱帘
    const wMod = 1 + 0.08 * Math.sin(t * Math.PI * 2 * 1.35 + phase * 1.7) * topLock
    const sx = R * Math.sin(phi) * wMod
    const z0 = R * (1 - Math.cos(phi)) * wMod
    // 纵向扭转
    const tw = SEA_RIBBONS.twist * Math.sin(t * Math.PI * 2 * 0.85 + phase * 1.4) * topLock
    // 侧摆：顶端吊点固定，越往下摆幅越大
    const wave = Math.sin(t * Math.PI * 2 * 1.15 + phase) * SEA_RIBBONS.sway * (1 - t)
    // 底边浪舌：只有最下 12% 向中间下探，形成浪尖而不是一刀平切
    const lip = Math.max(0, 1 - t * 8) * 0.1 * (1 - Math.pow(Math.abs(s / half), 2))
    pos.setXYZ(
      i,
      sx * Math.cos(tw) - z0 * Math.sin(tw) + wave,
      ly - lip,
      sx * Math.sin(tw) + z0 * Math.cos(tw),
    )
  }
  geo.setAttribute('aPhase', new THREE.BufferAttribute(new Float32Array(pos.count).fill(phase), 1))
  geo.computeVertexNormals()
  return geo
}

/** 5 条浪带：绕 H3 长凳中心半环均布，宽面朝圆心；顶部双吊索固定到发光天棚平面 */
function SeaRibbons() {
  const mat = useMemo(() => makeSeaMaterial(), [])
  useEffect(() => () => mat.dispose(), [mat])
  const items = useMemo(() => {
    const len = SEA_RIBBONS.topY - SEA_RIBBONS.bottomY
    return ribbonSlots().map((s, i) => ({
      ...s,
      geo: ribbonGeometry(SEA_RIBBONS.width, len, i * 0.55),
      cy: (SEA_RIBBONS.topY + SEA_RIBBONS.bottomY) / 2,
    }))
  }, [])
  useEffect(() => () => items.forEach((it) => it.geo.dispose()), [items])

  useFrame((state) => {
    if (PERF) return
    // 相位由 elapsedTime 直接驱动，不累加，避免后台/切页跳变
    mat.uniforms.uTime.value = state.clock.elapsedTime
  })

  const cableH = SEA_RIBBONS.cableY - SEA_RIBBONS.topY
  return (
    <>
      {items.map((it, i) => (
        <group key={i} position={[it.x, 0, it.z]} rotation-y={it.ry}>
          <mesh position={[0, it.cy, 0]} geometry={it.geo} material={mat} />
          {[-SEA_RIBBONS.width * 0.32, SEA_RIBBONS.width * 0.32].map((dx) => (
            <mesh key={dx} position={[dx, SEA_RIBBONS.topY + cableH / 2, 0]} material={MAT_CABLE}>
              <cylinderGeometry args={[0.006, 0.006, cableH, 6]} />
            </mesh>
          ))}
        </group>
      ))}
    </>
  )
}

// ── H2「双城纪事」中庭：澳门大三巴牌坊（老板拍板 B+ 分层构件 + 壁龛浮雕图集）──
// 尺度真源在 domain/gallery.RUINS_STPAUL + STPAUL_TIERS + ruinsMetrics，这里只做几何与材质实现。
// 构成：石灰华台座 → 四级台阶 → 四层收分墙板（真实开洞）→ 四道檐口 → 成对壁柱
//       → 壁龛浮雕背板 → 10 尊雕像剪影 → 三角山花 → 十字架 → 台面品红细环 → 展签。
// 约束：7 draw call / 0 新增光源 / 0 网络纹理；体积感全部靠顶点色 AO（单顶光无阴影贴图）。

/** 石灰华程序纹理：暖象牙底 + 横向砌层缝 + 气孔 + 纵向水痕（台座与立面共用） */
function makeTravertineTexture(repeatX: number, repeatY: number): THREE.Texture {
  const S = 256
  const cv = document.createElement('canvas')
  cv.width = cv.height = S
  const ctx = cv.getContext('2d')!
  ctx.fillStyle = '#dccba8'
  ctx.fillRect(0, 0, S, S)
  // 砌层：每 32px 一层，层间微色差 + 淡缝线（对比过强会呈瓦楞纸感）
  for (let row = 0; row < S / 32; row++) {
    const y = row * 32
    ctx.fillStyle = row % 2 ? 'rgba(198,176,132,0.26)' : 'rgba(232,222,198,0.20)'
    ctx.fillRect(0, y, S, 32)
    ctx.strokeStyle = 'rgba(148,126,90,0.26)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(S, y)
    ctx.stroke()
  }
  // 气孔（石灰华特征孔洞）
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `rgba(116,96,66,${Math.random() * 0.13 + 0.03})`
    ctx.fillRect(Math.random() * S, Math.random() * S, Math.random() * 2.2 + 0.4, Math.random() * 1.4 + 0.3)
  }
  // 纵向水痕（风化赭 #b79a5e 方向）
  for (let i = 0; i < 26; i++) {
    ctx.fillStyle = `rgba(164,138,98,${Math.random() * 0.06 + 0.02})`
    ctx.fillRect(Math.random() * S, 0, Math.random() * 3 + 0.6, S)
  }
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(repeatX, repeatY)
  t.anisotropy = 4
  return t
}

/**
 * 壁龛浮雕图集 2×2（单贴图喂全部壁龛，1 draw call）：
 * 左上 圣母 / 右上 天使 / 左下 门窗 / 右下 圣人。
 * CanvasTexture 默认 flipY=true → 画布上排对应 v∈[0.5,1]。
 */
function makeRecessAtlas(): THREE.Texture {
  const S = 1024
  const T = S / 2
  const cv = document.createElement('canvas')
  cv.width = cv.height = S
  const ctx = cv.getContext('2d')!

  /** 半圆拱凹龛path（局部坐标，tile 内留 40px 边） */
  const arch = () => {
    const pad = 40
    const x = pad
    const y = pad
    const w = T - pad * 2
    const h = T - pad * 2
    const rise = w * 0.46
    ctx.beginPath()
    ctx.moveTo(x, y + h)
    ctx.lineTo(x, y + rise)
    ctx.quadraticCurveTo(x, y, x + w / 2, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + rise)
    ctx.lineTo(x + w, y + h)
    ctx.closePath()
  }
  const head = (cx: number, cy: number, r: number) => {
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()
  }
  const niche = () => {
    arch()
    const g = ctx.createLinearGradient(0, 0, 0, T)
    g.addColorStop(0, '#c3a86e')
    g.addColorStop(1, '#7d6537')
    ctx.fillStyle = g
    ctx.fill()
    ctx.strokeStyle = '#5f4d28'
    ctx.lineWidth = 4
    ctx.stroke()
  }
  const tile = (ox: number, oy: number, tone: string, draw: () => void) => {
    ctx.fillStyle = tone
    ctx.fillRect(ox, oy, T, T)
    // 石面气孔随机斑
    for (let i = 0; i < 220; i++) {
      ctx.fillStyle = `rgba(96,78,44,${Math.random() * 0.06 + 0.015})`
      ctx.fillRect(ox + Math.random() * T, oy + Math.random() * T, Math.random() * 3 + 0.5, Math.random() * 2 + 0.4)
    }
    ctx.save()
    ctx.translate(ox, oy)
    draw()
    ctx.restore()
    // tile 边线：防止 mipmap 把相邻 tile 混进来
    ctx.strokeStyle = 'rgba(86,68,36,0.35)'
    ctx.lineWidth = 2
    ctx.strokeRect(ox + 1, oy + 1, T - 2, T - 2)
  }

  // 左上：圣母抱圣婴（T3 中龛）
  tile(0, 0, '#b0925a', () => {
    niche()
    ctx.fillStyle = '#efe0b4'
    ctx.strokeStyle = 'rgba(82,64,34,0.55)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(178, 432)
    ctx.quadraticCurveTo(196, 286, 256, 272)
    ctx.quadraticCurveTo(320, 286, 334, 432)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    head(256, 226, 40)
    ctx.strokeStyle = 'rgba(246,233,194,0.75)'
    ctx.lineWidth = 7
    ctx.beginPath()
    ctx.arc(256, 224, 60, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = '#efe0b4'
    head(322, 322, 26)
    ctx.beginPath()
    ctx.moveTo(302, 432)
    ctx.quadraticCurveTo(308, 350, 324, 342)
    ctx.quadraticCurveTo(344, 352, 350, 432)
    ctx.closePath()
    ctx.fill()
  })

  // 右上：天使（T3 两侧小龛）
  tile(T, 0, '#b0925a', () => {
    niche()
    ctx.fillStyle = '#ecdcae'
    for (const dir of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(256 + dir * 30, 310)
      ctx.quadraticCurveTo(256 + dir * 138, 268, 256 + dir * 152, 388)
      ctx.quadraticCurveTo(256 + dir * 92, 360, 256 + dir * 30, 384)
      ctx.closePath()
      ctx.fill()
    }
    head(256, 250, 34)
    ctx.fillStyle = '#efe0b4'
    ctx.beginPath()
    ctx.moveTo(214, 432)
    ctx.quadraticCurveTo(222, 330, 256, 318)
    ctx.quadraticCurveTo(292, 330, 298, 432)
    ctx.closePath()
    ctx.fill()
  })

  // 左下：门 / 窗暗腔（T1 三门 / T2 三窗）：整幅压暗，只留一道中梃，远看是「洞」不是「板」
  tile(0, T, '#5f4d28', () => {
    arch()
    ctx.fillStyle = '#463719'
    ctx.fill()
    ctx.strokeStyle = '#372a12'
    ctx.lineWidth = 4
    ctx.stroke()
    ctx.strokeStyle = '#b79a5e'
    ctx.lineWidth = 9
    ctx.beginPath()
    ctx.moveTo(256, 120)
    ctx.lineTo(256, 472)
    ctx.stroke()
  })

  // 右下：圣人立像（T4 三龛）
  tile(T, T, '#b0925a', () => {
    niche()
    ctx.fillStyle = '#efe0b4'
    ctx.strokeStyle = 'rgba(82,64,34,0.55)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(216, 472)
    ctx.quadraticCurveTo(224, 300, 256, 286)
    ctx.quadraticCurveTo(290, 300, 296, 472)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    head(256, 244, 36)
    // 手杖
    ctx.strokeStyle = 'rgba(246,233,194,0.8)'
    ctx.lineWidth = 6
    ctx.beginPath()
    ctx.moveTo(310, 200)
    ctx.lineTo(310, 472)
    ctx.stroke()
  })

  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

/** 立面几何的真源常量（本文件内派生，不重复定义域模型口径） */
const STPAUL_BASE_Y = RUINS_STPAUL.plinthH + RUINS_STPAUL.stepCount * RUINS_STPAUL.stepH
const STPAUL_FZ = RUINS_STPAUL.depth / 2

type RecessKind = 'window' | 'madonna' | 'angel' | 'saint'

interface Opening {
  /** 层内横向中心（0 = 轴线对中） */
  x: number
  /** 层内竖向原点 */
  y: number
  w: number
  h: number
  kind: RecessKind
}

/** 洞口表（真实开洞；y 相对本层底沿，单位米） */
const STPAUL_OPENINGS: Opening[][] = [
  // T1 三门：中门 0.35×0.351、两侧 0.20×0.28
  [
    { x: 0, y: 0, w: 0.35, h: 0.351, kind: 'window' },
    { x: -0.4875, y: 0, w: 0.2, h: 0.28, kind: 'window' },
    { x: 0.4875, y: 0, w: 0.2, h: 0.28, kind: 'window' },
  ],
  // T2 三窗：中窗 0.325×0.25、两侧 0.131×0.214
  [
    { x: 0, y: 0.048, w: 0.325, h: 0.25, kind: 'window' },
    { x: -0.494, y: 0.048, w: 0.131, h: 0.214, kind: 'window' },
    { x: 0.494, y: 0.048, w: 0.131, h: 0.214, kind: 'window' },
  ],
  // T3 圣母龛 + 两侧天使龛
  [
    { x: 0, y: 0.0298, w: 0.286, h: 0.286, kind: 'madonna' },
    { x: -0.286, y: 0.101, w: 0.0715, h: 0.179, kind: 'angel' },
    { x: 0.286, y: 0.101, w: 0.0715, h: 0.179, kind: 'angel' },
  ],
  // T4 三圣龛
  [
    { x: 0, y: 0.0594, w: 0.0713, h: 0.19, kind: 'saint' },
    { x: -0.44, y: 0.0594, w: 0.0713, h: 0.19, kind: 'saint' },
    { x: 0.44, y: 0.0594, w: 0.0713, h: 0.19, kind: 'saint' },
  ],
]

/** 成对壁柱的横向位置（每层一套，宽 0.045 / 骑缝 0.026） */
const STPAUL_PILASTERS: number[][] = [
  [-0.8375, -0.6625, -0.215, 0.215, 0.6625, 0.8375],
  [-0.9, -0.6125, 0.6125, 0.9],
  [-0.8625, 0.8625],
  [-0.7625, 0.7625],
]

/** 壁龛图集 UV 子区（[u0, v0, u1, v1]，与 makeRecessAtlas 的 tile 排布同源） */
const RECESS_UV: Record<RecessKind, [number, number, number, number]> = {
  madonna: [0, 0.5, 0.5, 1],
  angel: [0.5, 0.5, 1, 1],
  window: [0, 0, 0.5, 0.5],
  saint: [0.5, 0, 1, 0.5],
}

/**
 * 石材程序纹理（对照大三巴实景）：暖象牙白基底 + 三档尺度风化（大团块浸渍 / 中斑驳 / 细骨料）
 * + 竖向雨痕。保持无方向性、无砖缝，砖缝全部交给几何檐口与灰缝槽，避免各构件 UV 0..1
 * 被拉伸后出现“瓦楞木板”感。
 */
function makeStoneGrainTexture(): THREE.Texture {
  const S = 512
  const cv = document.createElement('canvas')
  cv.width = cv.height = S
  const ctx = cv.getContext('2d')!
  const PI2 = Math.PI * 2
  // 底色取暖金沙（对照参考图的风化花岗岩黄），材质 color 再叠一层金黄色相
  ctx.fillStyle = '#f8eed6'
  ctx.fillRect(0, 0, S, S)

  // ① 大尺度风化团块（赭褐浸渍）：九宫格重复绘制，保证平铺接缝无痕
  for (let i = 0; i < 80; i++) {
    const x = Math.random() * S
    const y = Math.random() * S
    const r = S * (0.035 + Math.random() * 0.065)
    const tone = Math.random() > 0.42 ? '150,124,86' : '120,98,62'
    const a = 0.018 + Math.random() * 0.03
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const cx = x + dx * S
        const cy = y + dy * S
        if (cx + r < 0 || cx - r > S || cy + r < 0 || cy - r > S) continue
        const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
        grd.addColorStop(0, `rgba(${tone},${a})`)
        grd.addColorStop(0.55, `rgba(${tone},${a * 0.5})`)
        grd.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = grd
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, PI2)
        ctx.fill()
      }
    }
  }

  // ② 中尺度斑驳
  for (let i = 0; i < 480; i++) {
    const tone = Math.random() > 0.5 ? '150,126,88' : '186,164,124'
    ctx.fillStyle = `rgba(${tone},${0.012 + Math.random() * 0.028})`
    ctx.beginPath()
    ctx.arc(Math.random() * S, Math.random() * S, 2 + Math.random() * 7, 0, PI2)
    ctx.fill()
  }

  // ③ 竖向雨痕（沿墙面下淌的污渍，远距只读为“石材变旧”）
  for (let i = 0; i < 26; i++) {
    const x = Math.random() * S
    const w = 1 + Math.random() * 6
    const y0 = Math.random() * S * 0.6
    const h = S * (0.18 + Math.random() * 0.5)
    const grd = ctx.createLinearGradient(0, y0, 0, y0 + h)
    grd.addColorStop(0, 'rgba(120,96,60,0)')
    grd.addColorStop(0.3, `rgba(120,96,60,${0.015 + Math.random() * 0.025})`)
    grd.addColorStop(1, 'rgba(120,96,60,0)')
    ctx.fillStyle = grd
    ctx.fillRect(x, y0, w, h)
  }

  // ④ 细骨料：深色颗粒 + 白色高光
  for (let i = 0; i < 7000; i++) {
    ctx.fillStyle = `rgba(120,98,64,${Math.random() * 0.045 + 0.01})`
    ctx.fillRect(Math.random() * S, Math.random() * S, Math.random() * 1.8 + 0.4, Math.random() * 1.6 + 0.3)
  }
  for (let i = 0; i < 2200; i++) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.05 + 0.015})`
    ctx.fillRect(Math.random() * S, Math.random() * S, Math.random() * 1.6 + 0.4, Math.random() * 1.4 + 0.3)
  }

  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(2, 2)
  t.anisotropy = 8
  return t
}

const STONE_GRAIN = makeStoneGrainTexture()

/** 石灰华立面：金砂黄（对照参考图风化黄石）+ 同图 bump（单顶光下靠微起伏出石材质感），vertexColors 承担 AO */
const MAT_STPAUL_STONE = new THREE.MeshStandardMaterial({
  map: STONE_GRAIN,
  bumpMap: STONE_GRAIN,
  bumpScale: 0.02,
  color: '#e8c87a',
  roughness: 0.84,
  metalness: 0.02,
  vertexColors: true,
})
/** 壁龛浮雕图集材质（只有 4 个 UV 子区被采样） */
const MAT_STPAUL_RECESS = new THREE.MeshStandardMaterial({
  map: makeRecessAtlas(),
  roughness: 0.88,
  metalness: 0,
  vertexColors: true,
})
/** 雕像剪影：赭褐色，与金砂墙面拉开明度差（远距离只读轮廓） */
const MAT_STPAUL_STATUE = new THREE.MeshStandardMaterial({
  color: '#9c7c40',
  roughness: 0.72,
  metalness: 0,
  vertexColors: true,
})
/** 台座：复用石灰华（与全馆石材语言统一） */
const MAT_TRAVERTINE_BASE = new THREE.MeshStandardMaterial({
  map: makeTravertineTexture(8, 1),
  color: '#e7d3a6',
  roughness: 0.82,
  metalness: 0.02,
})
/** H2 品红细环（台面色标）：亮度压在 Bloom 阈值 0.92 下，只做厅色识别、不产生光晕 */
const MAT_STPAUL_RING = glowMat(THEMES.H2.accent, 0.95, 0.9)
/** 台座落地接触线：极窄一圈压暗（模拟 AO 接地，避免模型像悬在反光地面上） */
const MAT_CONTACT = new THREE.MeshBasicMaterial({
  color: '#000000',
  transparent: true,
  opacity: 0.22,
  depthWrite: false,
})

/**
 * 顶点色 AO：按法线分面（上 1.00 / 前 0.90 / 下 0.62 / 侧 0.78）+ 构件内竖向风化梯度
 * （0.84 → 1.00）。单顶光 + 无阴影贴图时，这是立面体积感的唯一来源。
 */
function shadePart(
  g: THREE.BufferGeometry,
  base = 1,
  opts?: { top?: number; front?: number; bottom?: number; side?: number; grad?: [number, number] },
): THREE.BufferGeometry {
  const geo = g.index ? g.toNonIndexed() : g
  if (!geo.getAttribute('normal')) geo.computeVertexNormals()
  const pos = geo.getAttribute('position') as THREE.BufferAttribute
  const nor = geo.getAttribute('normal') as THREE.BufferAttribute
  const n = pos.count
  let minY = Infinity
  let maxY = -Infinity
  for (let i = 0; i < n; i++) {
    const y = pos.getY(i)
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  // 默认按构件自身高度做竖向风化梯度；砌块分格后同一层墙板传 grad，
  // 让 4~7 条横带共享一条 0.78→1.00 的梯度，避免每条横带自己重开一段而出现条带亮度差
  const gMin = opts?.grad ? opts.grad[0] : minY
  const gMax = opts?.grad ? opts.grad[1] : maxY
  const span = Math.max(1e-4, gMax - gMin)
  const top = opts?.top ?? 1.0
  const front = opts?.front ?? 0.96
  const bottom = opts?.bottom ?? 0.55
  const side = opts?.side ?? 0.76
  const col = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const ny = nor.getY(i)
    const nz = nor.getZ(i)
    let s = Math.abs(ny) > 0.55 ? (ny > 0 ? top : bottom) : Math.abs(nz) > 0.55 ? (nz > 0 ? front : side) : side
    const t = Math.min(1, Math.max(0, (pos.getY(i) - gMin) / span))
    // 竖向梯度 0.90→1.00：金砂石在单顶光下整体亮度已偏低，旧 0.78 底端会把立面压成深褐
    s *= 0.9 + 0.1 * t
    s *= base
    // 阴影端向赭褐偏色（金砂石的风化暗部呈暖褐，纯等比压暗会发灰发塑料）
    const k = 1 - Math.min(1, s)
    col[i * 3] = s
    col[i * 3 + 1] = s * (1 - 0.07 * k)
    col[i * 3 + 2] = s * (1 - 0.16 * k)
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
  return geo
}

/** 合并同属性构件（position / normal / uv / color）为单 mesh，压 draw call */
function mergeParts(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const out = new THREE.BufferGeometry()
  // 统一拆成非索引：BoxGeometry 等索引几何若直接拼 position，索引语义会丢失（三角形错乱）
  const list = parts.map((p) => (p.index ? p.toNonIndexed() : p))
  const first = list[0]
  if (!first) return out
  let total = 0
  for (const p of list) total += p.getAttribute('position').count
  for (const name of Object.keys(first.attributes)) {
    const itemSize = first.getAttribute(name).itemSize
    const arr = new Float32Array(total * itemSize)
    let off = 0
    for (const p of list) {
      const a = p.getAttribute(name)
      if (!a) continue
      arr.set(a.array as Float32Array, off)
      off += a.count * itemSize
    }
    out.setAttribute(name, new THREE.BufferAttribute(arr, itemSize))
  }
  out.computeBoundingSphere()
  return out
}

/** 构件级 UV 相位偏移：同一贴图在每块构件上取不同相位，消除“每层脏渍长得一模一样”的复读感 */
function offsetUV(g: THREE.BufferGeometry, seed: number) {
  const uv = g.getAttribute('uv') as THREE.BufferAttribute | undefined
  if (!uv) return
  const frac = (v: number) => v - Math.floor(v)
  const ox = frac(Math.sin(seed * 12.9898) * 43758.5453)
  const oy = frac(Math.sin(seed * 78.233) * 43758.5453)
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) + ox, uv.getY(i) + oy)
  uv.needsUpdate = true
}

/** 一个构件盒：建几何 → 位移到装配位 → 写顶点色 */
function boxPart(
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  base = 1,
  shade?: { top?: number; front?: number; bottom?: number; side?: number; grad?: [number, number] },
): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d)
  offsetUV(g, w * 127.1 + h * 311.7 + d * 74.7 + x * 269.5 + y * 183.3 + z * 419.2)
  g.translate(x, y, z)
  return shadePart(g, base, shade)
}

/**
 * 尖顶饰（obelisk 式女儿墙饰）：底座 + 收分柱身 + 球顶。
 * 参考图每层檐口两端都有成对的小尖顶，是立面轮廓的第二识别特征（第一是收分）。
 */
function pinnacleParts(x: number, yTop: number, z: number, h: number): THREE.BufferGeometry[] {
  const base = boxPart(0.056, 0.018, 0.056, x, yTop + 0.005, z, 1, { top: 0.95, front: 0.96, bottom: 0.7, side: 0.84 })
  const shaft = new THREE.CylinderGeometry(0.010, 0.026, h, 8)
  shaft.translate(x, yTop + 0.014 + h / 2, z)
  const tip = new THREE.SphereGeometry(0.013, 8, 6)
  tip.translate(x, yTop + 0.014 + h + 0.008, z)
  return [
    base,
    shadePart(shaft, 1, { top: 0.98, front: 1, bottom: 0.6, side: 0.8 }),
    shadePart(tip, 1.02),
  ]
}

/** 菱形浮雕（底层墙板的葡萄牙式菱格装饰）：45° 旋转薄板，投影宽度 = size×√2 */
function diamondPart(x: number, y: number, size: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(size, size, 0.012)
  g.rotateZ(Math.PI / 4)
  g.translate(x, y, STPAUL_FZ + 0.006)
  offsetUV(g, x * 269.5 + y * 183.3 + size * 127.1)
  return shadePart(g, 1, { top: 0.9, front: 0.98, bottom: 0.72, side: 0.8 })
}

/**
 * 层间弧形肩线（volute）：上层墙面与下层檐口顶面之间的凹圆填充。
 * 参考图的收分不是直角台阶，而是每层两侧带一段圆弧肩线，这是牌坊最有辨识度的侧影。
 * 截面 = 正方形角部挖去一个 1/4 圆（圆心在内角），沿进深方向挤出。
 */
function volutePart(sign: 1 | -1, xEdge: number, yTop: number, r: number, d: number): THREE.BufferGeometry {
  const s = new THREE.Shape()
  s.moveTo(0, 0)
  if (sign > 0) {
    s.lineTo(r, 0)
    s.absarc(r, r, r, -Math.PI / 2, Math.PI, true)
  } else {
    s.lineTo(-r, 0)
    s.absarc(-r, r, r, -Math.PI / 2, 0, false)
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false, curveSegments: 10 })
  g.translate(sign * xEdge, yTop, -d / 2)
  offsetUV(g, sign * xEdge * 269.5 + yTop * 183.3 + r * 127.1)
  return shadePart(g, 1, { top: 0.98, front: 0.95, bottom: 0.6, side: 0.8 })
}

/** 三角山花圆盘浮雕（圣灵玫瑰窗）：外盘 + 内盘双层，读作同心圆雕 */
function medallionParts(cy: number, z: number): THREE.BufferGeometry[] {
  const outer = new THREE.CylinderGeometry(0.072, 0.072, 0.012, 24)
  outer.rotateX(Math.PI / 2)
  outer.translate(0, cy, z + 0.004)
  const inner = new THREE.CylinderGeometry(0.042, 0.042, 0.014, 20)
  inner.rotateX(Math.PI / 2)
  inner.translate(0, cy, z + 0.006)
  return [
    shadePart(outer, 1, { top: 0.94, front: 1, bottom: 0.7, side: 0.82 }),
    shadePart(inner, 0.88),
  ]
}

/**
 * 墙板 2D 分格：先按洞口拆竖条，再按砌块横缝拆横带（真实开洞 + 真实凹槽）。
 * 横缝带高 8mm、前后各内缩 4mm，只落在实墙段上：遇到门窗口自动断开，形成砌块错缝。
 */
function wallParts(
  w: number,
  h: number,
  d: number,
  y0: number,
  openings: Opening[],
  courses: number[],
  parts: THREE.BufferGeometry[],
) {
  const GROOVE_H = 0.008
  const GROOVE_D = 0.004
  const rows: Array<{ a: number; b: number; groove: boolean }> = []
  let cur = 0
  for (const cy of courses) {
    const a = Math.max(0, cy - GROOVE_H / 2)
    const b = Math.min(h, cy + GROOVE_H / 2)
    if (a - cur > 1e-4) rows.push({ a: cur, b: a, groove: false })
    if (b - a > 1e-4) rows.push({ a, b, groove: true })
    cur = Math.max(cur, b)
  }
  if (h - cur > 1e-4) rows.push({ a: cur, b: h, groove: false })

  const xs: number[] = [-w / 2, w / 2]
  for (const o of openings) xs.push(o.x - o.w / 2, o.x + o.w / 2)
  xs.sort((a, b) => a - b)

  const grad: [number, number] = [y0, y0 + h]
  for (const row of rows) {
    for (let i = 0; i < xs.length - 1; i++) {
      const xa = xs[i]
      const xb = xs[i + 1]
      if (xb - xa < 1e-4) continue
      const o = openings.find((v) => v.x - v.w / 2 <= xa + 1e-4 && v.x + v.w / 2 >= xb - 1e-4)
      const segs: Array<[number, number]> = []
      if (!o) segs.push([row.a, row.b])
      else {
        const oa = o.y
        const ob = o.y + o.h
        if (oa - row.a > 1e-4) segs.push([row.a, Math.min(oa, row.b)])
        if (row.b - ob > 1e-4) segs.push([Math.max(ob, row.a), row.b])
      }
      for (const [sa, sb] of segs) {
        if (sb - sa < 1e-4) continue
        parts.push(
          boxPart(
            xb - xa,
            sb - sa,
            row.groove ? d - GROOVE_D * 2 : d,
            (xa + xb) / 2,
            y0 + (sa + sb) / 2,
            0,
            row.groove ? 0.9 : 1,
            row.groove
              ? { top: 0.92, front: 0.86, bottom: 0.8, side: 0.84, grad }
              : { grad },
          ),
        )
      }
    }
  }
}

/** 台阶 + 四层墙板 + 檐口 + 壁柱 + 山花 + 十字架 + 壁龛背板（单 geometry） */
function buildStPaulStone(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  const D = RUINS_STPAUL.depth

  // ① 四级台阶：自上而下逐级变宽、逐级出挑 0.04
  for (let k = 0; k < RUINS_STPAUL.stepCount; k++) {
    const sw = 2.3 - k * 0.08
    const sd = (RUINS_STPAUL.stepCount - k) * 0.04
    parts.push(
      boxPart(
        sw,
        RUINS_STPAUL.stepH,
        sd,
        0,
        RUINS_STPAUL.plinthH + k * RUINS_STPAUL.stepH + RUINS_STPAUL.stepH / 2,
        STPAUL_FZ + sd / 2,
      ),
    )
  }

  // ② 四层主体（山花在 STPAUL_TIERS 里是第 5 段，单独建）
  const GROOVE_H = 0.024 // 层间灰缝槽高
  const GROOVE_IN = 0.022 // 槽体单边内缩（左右 + 前后），形成真凹槽而非贴线
  const tiers = STPAUL_TIERS.slice(0, 4)
  tiers.forEach((t, i) => {
    const y0 = STPAUL_BASE_Y + t.y
    let wallY = y0
    let wallH = t.h
    let opens = STPAUL_OPENINGS[i]
    if (i > 0) {
      // 本层底部 0.024m 内缩 0.022m：槽体落在下一层檐口顶面之上 2mm，避免共面打架
      const dy = GROOVE_H + 0.002
      parts.push(
        boxPart(t.w - GROOVE_IN * 2, GROOVE_H, D - GROOVE_IN * 2, 0, y0 + 0.002 + GROOVE_H / 2, 0, 0.74, {
          top: 0.8,
          front: 0.66,
          bottom: 0.5,
          side: 0.58,
        }),
      )
      // 洞口 y 同步回扣 dy，保证门窗口的绝对标高与壁龛背板 / 浮雕面完全对齐
      wallY = y0 + dy
      wallH = t.h - dy
      opens = STPAUL_OPENINGS[i].map((o) => ({ ...o, y: o.y - dy }))
    }
    // 砌块横缝按层高等分三道（25% / 50% / 75%），遇门窗口自动断开
    wallParts(t.w, wallH, D, wallY, opens, [0.25, 0.5, 0.75].map((f) => f * wallH), parts)
    // 檐口做二段线脚：下枭（+0.06 / 高 0.010）+ 主檐（+0.12 / 高 0.022）
    parts.push(boxPart(t.w + 0.06, 0.01, D + 0.06, 0, y0 + t.h - 0.027, 0))
    parts.push(boxPart(t.w + 0.12, 0.022, D + 0.12, 0, y0 + t.h - 0.011, 0))
    // 檐口两端尖顶饰：立在主檐顶面、向外出挑 3.5cm（避开下层弧形肩线，不打架）
    const pinH = 0.125 - i * 0.008
    for (const sgn of [-1, 1]) {
      parts.push(...pinnacleParts(sgn * (t.w / 2 + 0.035), y0 + t.h, 0, pinH))
    }
    // 层间弧形肩线：半径 = 上下两层半宽差（天然贴合收分），只做 2~4 层
    if (i > 0) {
      const r = (tiers[i - 1].w - t.w) / 2
      if (r > 0.01) {
        parts.push(volutePart(1, t.w / 2, y0, r, D))
        parts.push(volutePart(-1, t.w / 2, y0, r, D))
      }
    }
    // 成对壁柱：宽 0.045 / 深 0.028 / 前表面骑缝 0.026
    for (const px of STPAUL_PILASTERS[i]) {
      const ph = t.h - 0.026
      parts.push(boxPart(0.045, ph, 0.028, px, y0 + 0.013 + ph / 2, STPAUL_FZ + 0.026 - 0.014))
    }
  })

  // ②b 底层菱格浮雕：门侧实墙板上 2 列 × 2 行（参考图底层的葡式菱格）
  for (const sgn of [-1, 1]) {
    for (const row of [0.125, 0.255]) {
      parts.push(diamondPart(sgn * 0.75, STPAUL_BASE_Y + row, 0.05))
      parts.push(diamondPart(sgn * 0.93, STPAUL_BASE_Y + row, 0.056))
    }
  }

  // ③ 三角山花：底宽 = 顶层宽、高 0.31、深 = 立面进深
  const crown = STPAUL_TIERS[4]
  const shape = new THREE.Shape()
  shape.moveTo(-crown.w / 2, 0)
  shape.lineTo(0, crown.h)
  shape.lineTo(crown.w / 2, 0)
  shape.closePath()
  const pediment = new THREE.ExtrudeGeometry(shape, { depth: D, bevelEnabled: false, steps: 1 })
  pediment.translate(0, STPAUL_BASE_Y + crown.y, -D / 2)
  parts.push(shadePart(pediment))
  // 山花正面圆盘浮雕：三角面形心偏下 0.105（留足三角余量），双层面盘
  parts.push(...medallionParts(STPAUL_BASE_Y + crown.y + 0.105, D / 2))

  // ④ 十字架：竖杆 0.018×0.22×0.018，横杆 0.13 宽、位于 0.64 高度
  const crossY = STPAUL_BASE_Y + crown.y + crown.h
  parts.push(boxPart(0.018, STPAUL_CROSS_H, 0.018, 0, crossY + STPAUL_CROSS_H / 2, 0))
  parts.push(boxPart(0.13, 0.016, 0.018, 0, crossY + STPAUL_CROSS_H * 0.64, 0))

  // ⑤ 壁龛背板：凹进 3cm 的龛体（内壁压暗，龛内亮度 0.55）
  for (let i = 0; i < 4; i++) {
    for (const o of STPAUL_OPENINGS[i]) {
      const y0 = STPAUL_BASE_Y + STPAUL_TIERS[i].y
      parts.push(
        boxPart(o.w - 0.008, o.h - 0.008, 0.1, o.x, y0 + o.y + o.h / 2, 0.09, 1, {
          top: 0.72,
          front: 0.55,
          bottom: 0.42,
          side: 0.6,
        }),
      )
    }
  }

  return mergeParts(parts)
}

/** 壁龛浮雕面（贴图子区 UV，2mm 贴在龛体前） */
function buildStPaulRecess(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  for (let i = 0; i < 4; i++) {
    for (const o of STPAUL_OPENINGS[i]) {
      const y0 = STPAUL_BASE_Y + STPAUL_TIERS[i].y
      const g = new THREE.PlaneGeometry(o.w - 0.008, o.h - 0.008)
      const [u0, v0, u1, v1] = RECESS_UV[o.kind]
      const uv = g.getAttribute('uv') as THREE.BufferAttribute
      for (let k = 0; k < uv.count; k++) uv.setXY(k, u0 + uv.getX(k) * (u1 - u0), v0 + uv.getY(k) * (v1 - v0))
      g.translate(o.x, y0 + o.y + o.h / 2, 0.142)
      parts.push(shadePart(g, 1, { top: 0.98, front: 1, bottom: 0.66, side: 0.9 }))
    }
  }
  // T2 四圣的浅龛底板：立面在这个位置是实墙（没有真开洞），用画板叠一块「龛」，
  // 否则 10cm 高的自由立像在 3.7m 会读成木栏杆立柱。
  const t1 = STPAUL_BASE_Y + STPAUL_TIERS[1].y
  for (const x of [-0.345, -0.245, 0.245, 0.345]) {
    const w = 0.095
    const h = 0.235
    const g = new THREE.PlaneGeometry(w, h)
    const [u0, v0, u1, v1] = RECESS_UV.saint
    const uv = g.getAttribute('uv') as THREE.BufferAttribute
    for (let k = 0; k < uv.count; k++) uv.setXY(k, u0 + uv.getX(k) * (u1 - u0), v0 + uv.getY(k) * (v1 - v0))
    g.translate(x, t1 + 0.01 + h / 2, STPAUL_FZ + 0.002)
    parts.push(shadePart(g, 1, { top: 0.98, front: 1, bottom: 0.66, side: 0.9 }))
  }
  return mergeParts(parts)
}

/** 一尊雕像剪影：底座 + 袍身 + 肩胸 + 头（8 段圆低面数，远距只读轮廓）
 *  袍身收窄到 0.04h→0.078h（旧 0.05→0.1 在 3.7m 读作木栏杆立柱），加肩胸段才有人形剪影 */
function statueParts(x: number, baseY: number, h: number, z: number): THREE.BufferGeometry[] {
  const footH = 0.05 * h
  const robeH = 0.72 * h
  const bustH = 0.1 * h
  const foot = new THREE.CylinderGeometry(0.072 * h, 0.082 * h, footH, 8)
  foot.translate(x, baseY + footH / 2, z)
  const robe = new THREE.CylinderGeometry(0.052 * h, 0.092 * h, robeH, 8)
  robe.translate(x, baseY + footH + robeH / 2, z)
  const bust = new THREE.CylinderGeometry(0.08 * h, 0.058 * h, bustH, 8)
  bust.translate(x, baseY + footH + robeH + bustH / 2, z)
  const head = new THREE.SphereGeometry(0.062 * h, 8, 6)
  head.translate(x, baseY + footH + robeH + bustH + 0.062 * h, z)
  return [
    shadePart(foot, 1, { top: 0.95, front: 1, bottom: 0.55, side: 0.8 }),
    shadePart(robe, 1, { top: 0.98, front: 1, bottom: 0.7, side: 0.85 }),
    shadePart(bust, 1, { top: 0.98, front: 1, bottom: 0.8, side: 0.86 }),
    shadePart(head, 1.04),
  ]
}

/** 十尊雕像：T2 四圣 / T3 圣母 + 两天使 / T4 三圣（单 geometry） */
function buildStPaulStatues(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  const t1 = STPAUL_BASE_Y + STPAUL_TIERS[1].y
  const t2 = STPAUL_BASE_Y + STPAUL_TIERS[2].y
  const t3 = STPAUL_BASE_Y + STPAUL_TIERS[3].y
  // T2 四圣：落在窗间壁面（成对左右对称），立于墙面前 1.5cm
  for (const x of [-0.345, -0.245, 0.245, 0.345]) parts.push(...statueParts(x, t1 + 0.02, 0.22, STPAUL_FZ + 0.025))
  // T3 圣母：中龛内，龛前
  parts.push(...statueParts(0, t2 + 0.03, 0.27, 0.175))
  // T3 两天使：左右小龛内
  for (const x of [-0.286, 0.286]) parts.push(...statueParts(x, t2 + 0.102, 0.17, 0.175))
  // T4 三圣：三龛内
  for (const x of [-0.44, 0, 0.44]) parts.push(...statueParts(x, t3 + 0.06, 0.18, 0.175))
  return mergeParts(parts)
}

/** 台面品红细环：四根细条拼成矩形框（内缩 0.10，单 mesh） */
function buildStPaulRing(): THREE.BufferGeometry {
  const y = RUINS_STPAUL.plinthH + 0.004
  const hx = RUINS_STPAUL.plinthW / 2 - 0.1
  const hz = RUINS_STPAUL.plinthD / 2 - 0.1
  const t = 0.02
  const parts = [
    new THREE.BoxGeometry(hx * 2, 0.006, t).translate(0, y, hz),
    new THREE.BoxGeometry(hx * 2, 0.006, t).translate(0, y, -hz),
    new THREE.BoxGeometry(t, 0.006, hz * 2).translate(hx, y, 0),
    new THREE.BoxGeometry(t, 0.006, hz * 2).translate(-hx, y, 0),
  ]
  return mergeParts(parts)
}

/** H2 中庭大三巴牌坊：全部构件程序化，静态几何一次成型 */
function RuinsStPaul() {
  const spec = RUINS_STPAUL
  const gl = useThree((s) => s.gl)
  // 单顶光的漫反射在立面正面上是掠射角（灯在牌坊正上方），实测面亮度只有环境光的 ~0.6，
  // 石色会被压成橄榄褐。给石材挂一层 studio IBL 补光（不新增光源、不改全馆照明）。
  useEffect(() => {
    const env = studioEnv(gl)
    for (const m of [MAT_STPAUL_STONE, MAT_STPAUL_STATUE, MAT_TRAVERTINE_BASE]) {
      m.envMap = env
      m.envMapIntensity = m === MAT_STPAUL_STONE ? 0.7 : 0.45
      m.needsUpdate = true
    }
  }, [gl])
  const built = useMemo(
    () => ({
      stone: buildStPaulStone(),
      recess: buildStPaulRecess(),
      statues: buildStPaulStatues(),
      ring: buildStPaulRing(),
      plinth: new THREE.BoxGeometry(spec.plinthW, spec.plinthH, spec.plinthD),
      contact: new THREE.PlaneGeometry(spec.plinthW + 0.2, spec.plinthD + 0.2),
    }),
    [spec.plinthW, spec.plinthH, spec.plinthD],
  )

  // 展签：台面斜置朝东门来向（整组 yaw +90°，正面迎入口动线），不压立面、不碰台阶
  const label = useMemo(
    () =>
      makeLabelPlane('RUINS OF ST. PAUL', '大三巴牌坊 · 澳门 · 巴洛克石砌前壁', {
        width: 0.46,
        height: 0.12,
        bg: '#f2eee5',
        fg: '#3a3733',
        subFg: '#8a8076',
        accent: THEMES.H2.accent,
        fontSizePx: 112,
        subSizePx: 44,
      }),
    [],
  )

  useEffect(
    () => () => {
      built.stone.dispose()
      built.recess.dispose()
      built.statues.dispose()
      built.ring.dispose()
      built.plinth.dispose()
      built.contact.dispose()
      const lm = label.material as THREE.MeshBasicMaterial
      lm.map?.dispose()
      lm.dispose()
      label.geometry.dispose()
    },
    [built, label],
  )

  return (
    <group position={[spec.center.x, 0, spec.center.z]} rotation-y={Math.PI / 2}>
      {/* 石灰华台座（2.60×0.22×0.95） */}
      <mesh position={[0, spec.plinthH / 2, 0]} geometry={built.plinth} material={MAT_TRAVERTINE_BASE} />
      {/* 立面：台阶 + 墙板 + 檐口 + 壁柱 + 山花 + 十字架（单 mesh） */}
      <mesh geometry={built.stone} material={MAT_STPAUL_STONE} />
      {/* 壁龛浮雕图集（单 mesh） */}
      <mesh geometry={built.recess} material={MAT_STPAUL_RECESS} />
      {/* 十尊雕像剪影（单 mesh） */}
      <mesh geometry={built.statues} material={MAT_STPAUL_STATUE} />
      {/* 台面粉红细环（H2 主题色只出现在台面与展签） */}
      <mesh geometry={built.ring} material={MAT_STPAUL_RING} />
      {/* 台座落地接触线：把石台压在反光地面上 */}
      <mesh
        position={[0, 0.004, 0]}
        rotation-x={-Math.PI / 2}
        geometry={built.contact}
        material={MAT_CONTACT}
        renderOrder={1}
      />
      {/* 台面展签 */}
      <primitive object={label} position={[0, spec.plinthH + 0.085, 0.4]} rotation={[-0.28, 0, 0]} />
    </group>
  )
}

export default function GalleryWorld() {
  const walls = useMemo(() => wallBoxes(), [])

  return (
    <group>
      {walls.map((b, i) => (
        <mesh key={i} position={[b.cx, b.cy, b.cz]} material={MAT_WALL}>
          <boxGeometry args={[b.sx, b.sy, b.sz]} />
        </mesh>
      ))}

      {/* 浅灰水泥微反射地面（perf 档退化为哑光浅灰） */}
      <mesh rotation-x={-Math.PI / 2} position={[(SITE.x0 + SITE.x1) / 2, 0, (SITE.z0 + SITE.z1) / 2]}>
        <planeGeometry args={[SITE.x1 - SITE.x0, SITE.z1 - SITE.z0]} />
        {PERF ? (
          <meshStandardMaterial color="#b9b7b3" roughness={0.55} metalness={0.05} />
        ) : (
          <MeshReflectorMaterial
            blur={[220, 70]}
            resolution={1024}
            mixBlur={0.9}
            mixStrength={0.9}
            depthScale={0.4}
            minDepthThreshold={0.4}
            maxDepthThreshold={1.4}
            color="#b7b5b1"
            metalness={0.08}
            roughness={0.42}
            mirror={0.18}
          />
        )}
      </mesh>
      {SPACES.filter((s) => s.kind === 'corridor').map((s) => (
        <mesh key={`f-${s.id}`} rotation-x={-Math.PI / 2}
          position={[(s.x0 + s.x1) / 2, 0.002, (s.z0 + s.z1) / 2]} material={MAT_CORR_FLOOR}>
          <planeGeometry args={[s.x1 - s.x0, s.z1 - s.z0]} />
        </mesh>
      ))}

      {/* 发光天棚：外圈收边框板 + 内嵌柔光灯箱（下沉 7cm 形成凹槽边）；入口厅 v16 用专用冷白灯箱 */}
      {SPACES.map((s) => (
        <group key={`c-${s.id}`}>
          <mesh rotation-x={Math.PI / 2} position={[(s.x0 + s.x1) / 2, s.h, (s.z0 + s.z1) / 2]} material={MAT_CEIL_FRAME}>
            <planeGeometry args={[s.x1 - s.x0, s.z1 - s.z0]} />
          </mesh>
          <mesh
            rotation-x={Math.PI / 2}
            position={[(s.x0 + s.x1) / 2, s.h - 0.07, (s.z0 + s.z1) / 2]}
            material={s.id === 'ENTRY' ? MAT_ENTRY_CEIL_GLOW : MAT_CEIL_GLOW}
          >
            <planeGeometry args={[s.x1 - s.x0 - 0.9, s.z1 - s.z0 - 0.9]} />
          </mesh>
        </group>
      ))}

      <PortalFrames />
      <EntryChamber />
      <LightStrips />
      <SkirtingStrips />
      <HallSigns />
      <RouteLines />
      <LightRails />
      <Benches />
      <TulipGarden />
      <StarFerry />
      <RuinsStPaul />
      <SeaRibbons />
      <WallLabels />
    </group>
  )
}
