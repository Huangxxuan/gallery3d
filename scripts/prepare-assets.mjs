// 全量素材管线 v2（macOS，依赖系统自带 sips，无需第三方依赖）
// 输入：~/Downloads/摄影作品/<分类文件夹>/*.{jpg,jpeg,png,heic}
// 输出三级（零裁剪，sips -Z 等比缩放）：
//   public/photos/{id}.jpg      漫游主档 长边2048 质量92（本厅常驻）
//   public/photos/lo/{id}.jpg   远厅低模 长边1024 质量80（省显存）
//   public/photos/hd/{id}.jpg   大图高清 长边4096 质量92（focus 按需）
// manifest v2：增加 category（源分类名）/ theme（展题）/ srcLo / srcHd
// 用法：node scripts/prepare-assets.mjs
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const SRC = join(homedir(), 'Downloads', '摄影作品')
const OUT_DIR = join(ROOT, 'public', 'photos')
const MANIFEST = join(ROOT, 'public', 'manifest.json')

// 分厅映射（与布展口径一致，H4 偏空属既定决策：放宽挂距显高级）
const HALL_GROUPS = [
  { hall: 'H1', theme: '香港故事', cats: ['香港故事'] },
  { hall: 'H2', theme: '双城纪事', cats: ['澳门故事', '城市艺展', '城市建筑'] },
  { hall: 'H3', theme: '海与港', cats: ['海边时刻', '维多利亚港', '无人机视角'] },
  { hall: 'H4', theme: '林间生灵', cats: ['绿林秋色', '秋天落羽杉', '池中漫舞火烈鸟'] },
]

if (!existsSync(SRC)) {
  console.error(`源目录不存在：${SRC}`)
  process.exit(1)
}

// 汇总任务清单（顺序即全局作品序）
const jobs = []
for (const g of HALL_GROUPS) {
  for (const cat of g.cats) {
    const dir = join(SRC, cat)
    if (!existsSync(dir)) {
      console.error(`分类目录缺失：${dir}`)
      process.exit(1)
    }
    const files = readdirSync(dir)
      .filter((f) => !f.startsWith('.') && /\.(jpe?g|png|heic)$/i.test(f))
      .sort()
    for (const f of files) jobs.push({ hall: g.hall, theme: g.theme, category: cat, file: f, src: join(dir, f) })
  }
}
console.log(`共发现 ${jobs.length} 张源图，开始三级转换…`)

// 清空输出目录重建
mkdirSync(OUT_DIR, { recursive: true })
for (const f of readdirSync(OUT_DIR)) rmSync(join(OUT_DIR, f), { recursive: true })
mkdirSync(join(OUT_DIR, 'lo'), { recursive: true })
mkdirSync(join(OUT_DIR, 'hd'), { recursive: true })

function sipsJpg(src, dst, maxEdge, quality) {
  execFileSync(
    'sips',
    ['-s', 'format', 'jpeg', '-s', 'formatOptions', String(quality), '-Z', String(maxEdge), src, '--out', dst],
    { stdio: ['ignore', 'ignore', 'inherit'] },
  )
}

function dimsOf(file) {
  const out = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', file], { encoding: 'utf-8' })
  const w = Number(/pixelWidth:\s*(\d+)/.exec(out)?.[1])
  const h = Number(/pixelHeight:\s*(\d+)/.exec(out)?.[1])
  if (!w || !h) throw new Error(`无法读取尺寸：${file}`)
  return { w, h }
}

const artworks = []
let failures = 0
jobs.forEach((job, i) => {
  const id = `art_${String(i + 1).padStart(3, '0')}`
  const mid = join(OUT_DIR, `${id}.jpg`)
  const lo = join(OUT_DIR, 'lo', `${id}.jpg`)
  const hd = join(OUT_DIR, 'hd', `${id}.jpg`)
  try {
    sipsJpg(job.src, mid, 2048, 92)
    sipsJpg(mid, lo, 1024, 80) // 从已转 JPEG 二次缩，省一次 HEIC 解码
    sipsJpg(mid, hd, 4096, 92)
    const { w, h } = dimsOf(hd)
    artworks.push({
      id,
      src: `photos/${id}.jpg`,
      srcLo: `photos/lo/${id}.jpg`,
      srcHd: `photos/hd/${id}.jpg`,
      sourceFile: `${job.category}/${job.file}`,
      category: job.category,
      theme: job.theme,
      hall: job.hall,
      widthPx: w,
      heightPx: h,
      orientation: h >= w ? 'portrait' : 'landscape',
    })
    process.stdout.write(`✓ ${id}  ${job.category}/${job.file}  ${w}×${h}  → ${job.hall}\n`)
  } catch (err) {
    failures += 1
    console.error(`✗ ${job.category}/${job.file}: ${err.message}`)
  }
})

writeFileSync(
  MANIFEST,
  JSON.stringify({ schemaVersion: 2, generatedAt: new Date().toISOString(), artworks }, null, 2),
)
const byHall = HALL_GROUPS.map((g) => `${g.hall}:${artworks.filter((a) => a.hall === g.hall).length}`).join(' / ')
console.log(`\n${artworks.length} 张落盘（失败 ${failures}），manifest v2 已生成（${byHall}）`)
if (failures > 0) process.exit(2)
