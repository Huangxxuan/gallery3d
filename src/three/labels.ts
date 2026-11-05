// 离线文字墙贴：CanvasTexture 运行时生成（不依赖网络字体，规避 troika CDN）
import * as THREE from 'three'

export interface LabelOptions {
  width?: number // 世界宽（米）
  height?: number
  bg?: string
  fg?: string
  accent?: string
  fontSizePx?: number
  subSizePx?: number
  subFg?: string
  opacity?: number
  transparentBg?: boolean
  /** 字重（默认 700，其余标签零变化） */
  fontWeight?: number
  /** 字距（单位 em，默认 0）：>0 时逐字排版；超宽改为等比降字号，不再横向压扁字形 */
  letterSpacing?: number
  /** 字体族（默认中文黑体栈）；拉丁优先栈可按字形回退，天然实现中英混排配对 */
  fontFamily?: string
}

const FONT_STACK = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif'

/** 逐字排版：Σ字形宽 + 字距·(n−1) 求真实宽度并居中；超 maxW 时按 4%/轮降字号（下限 8px）。
 *  v17 修复：旧版 fillText 的 maxWidth 会把超宽标题横向压缩（入口旧门楣 96px 被压约 20%），
 *  字形失真且无法靠调字号解决——此处改为降字号，字形比例恒定。 */
function fillTracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  fs0: number,
  weight: number,
  family: string,
  trackingEm: number,
  maxW: number,
) {
  const glyphs = [...text]
  if (glyphs.length === 0) return
  const measure = (fs: number) => {
    ctx.font = `${weight} ${fs}px ${family}`
    let w = 0
    for (const ch of glyphs) w += ctx.measureText(ch).width
    return w + trackingEm * fs * (glyphs.length - 1)
  }
  let fs = fs0
  for (let i = 0; i < 40 && fs > 8 && measure(fs) > maxW; i++) fs *= 0.96
  ctx.font = `${weight} ${fs}px ${family}`
  let x = cx - measure(fs) / 2
  for (const ch of glyphs) {
    const w = ctx.measureText(ch).width
    ctx.fillText(ch, x, cy)
    x += w + trackingEm * fs
  }
}

export function makeLabelPlane(title: string, subtitle = '', opts: LabelOptions = {}): THREE.Mesh {
  const W = 1024
  const H = Math.round(W * (opts.height ?? 0.9) / (opts.width ?? 2.6))
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  if (!opts.transparentBg) {
    ctx.fillStyle = opts.bg ?? '#0d1116'
    ctx.fillRect(0, 0, W, H)
  }
  if (opts.accent) {
    ctx.fillStyle = opts.accent
    ctx.fillRect(0, 0, 14, H)
  }
  ctx.fillStyle = opts.fg ?? '#dfe8f0'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  fillTracked(
    ctx, title, W / 2, subtitle ? H * 0.4 : H / 2,
    opts.fontSizePx ?? 130, opts.fontWeight ?? 700, opts.fontFamily ?? FONT_STACK,
    opts.letterSpacing ?? 0, W - 120,
  )
  if (subtitle) {
    ctx.textAlign = 'center'
    ctx.fillStyle = opts.subFg ?? '#8fa3b4'
    ctx.font = `400 ${opts.subSizePx ?? 46}px ${FONT_STACK}`
    ctx.fillText(subtitle, W / 2, H * 0.74, W - 140)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity: opts.opacity ?? 1,
    side: THREE.FrontSide, // 反字根治：只渲染正面（透明导视在 GalleryWorld 加金属背板）
  })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(opts.width ?? 2.6, opts.height ?? 0.9), mat)
  return mesh
}
