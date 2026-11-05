import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { slotPose } from '../domain/gallery'
import { dragState, useUI } from '../state/player'
import { loadPlacements, type ManifestArt, type Placement } from './placements'
import { studioEnv } from './env'

const FRAME_CY = 1.65
/** 画框构造（与 domain/gallery.FRAME_BORDER 对齐：单边 0.12 = 白卡纸 0.09 + 框梃 0.03） */
const MAT_EXTRA = 0.18
const FRAME_EXTRA = 0.06
const REBATE_EXTRA = 0.01

// ── 三级纹理管理：本厅 2048 / 邻厅 1024 / 大图 4096 按需；离区即释放显存 ──
const loader = new THREE.TextureLoader()
let MAX_ANISO = 8
const texCache = new Map<string, THREE.Texture>()
const inflight = new Map<string, Promise<THREE.Texture | null>>()

function requestTex(url: string): Promise<THREE.Texture | null> {
  const hit = texCache.get(url)
  if (hit) return Promise.resolve(hit)
  let p = inflight.get(url)
  if (!p) {
    p = new Promise((resolve) => {
      loader.load(
        `${import.meta.env.BASE_URL}${url}`,
        (t) => {
          t.colorSpace = THREE.SRGBColorSpace
          t.anisotropy = MAX_ANISO
          texCache.set(url, t)
          inflight.delete(url)
          resolve(t)
        },
        undefined,
        () => {
          inflight.delete(url)
          texErrors.push(url)
          resolve(null)
        },
      )
    })
    inflight.set(url, p)
  }
  return p
}

function dropTex(url: string) {
  const t = texCache.get(url)
  if (t) {
    t.dispose()
    texCache.delete(url)
  }
}

// QA 调试探针（?artview / ?focus 页面可用 __texDebug 观察纹理层）
const texErrors: string[] = []
if (typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__texDebug = { texCache, texErrors }
}

/** 分区加载策略：所在厅 2048 主档，蛇形相邻厅 1024 预载，其余不放纹理（反正隔着墙看不见） */
function activeHalls(zoneId: string): { mid: string | null; lo: string[] } {
  switch (zoneId) {
    case 'H1': return { mid: 'H1', lo: ['H2'] }
    case 'H2': return { mid: 'H2', lo: ['H1', 'H3'] }
    case 'H3': return { mid: 'H3', lo: ['H2', 'H4'] }
    case 'H4': return { mid: 'H4', lo: ['H3'] }
    case 'CS': return { mid: null, lo: ['H1', 'H2'] }
    case 'CW': return { mid: null, lo: ['H2', 'H3'] }
    case 'CN': return { mid: null, lo: ['H3', 'H4'] }
    case 'ENTRY': return { mid: 'H1', lo: [] }
    case 'EXIT': return { mid: null, lo: ['H4'] }
    default: return { mid: null, lo: [] }
  }
}

// 白色径向渐变（背光晕基底，主题色由材质 color 注入，Additive 混合洗墙）
function makeGlowTexture(): THREE.Texture {
  const cv = document.createElement('canvas')
  cv.width = 512
  cv.height = 512
  const ctx = cv.getContext('2d')!
  const g = ctx.createRadialGradient(256, 250, 20, 256, 250, 250)
  g.addColorStop(0, 'rgba(255,255,255,0.9)')
  g.addColorStop(0.34, 'rgba(255,255,255,0.3)')
  g.addColorStop(0.68, 'rgba(255,255,255,0.08)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 512, 512)
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

interface Mats {
  frame: THREE.MeshStandardMaterial
  mat: THREE.MeshStandardMaterial
  rebate: THREE.MeshStandardMaterial
}

function ArtEntry({ p, glow, mats, i }: { p: Placement; glow: THREE.Texture; mats: Mats; i: number }) {
  const pose = slotPose(p.hall, p.slot)
  const matW = p.photoW + MAT_EXTRA
  const matH = p.photoH + MAT_EXTRA
  const focusArt = useUI((s) => s.focusArt)
  const zoneId = useUI((s) => s.zoneId)
  const focusIndex = useUI((s) => s.focusIndex)
  const act = useMemo(() => activeHalls(zoneId), [zoneId])
  const wantHd = focusIndex === p.index && p.art.srcHd
  const level: 'hd' | 'mid' | 'lo' | 'none' = wantHd
    ? 'hd'
    : act.mid === p.art.hall
      ? 'mid'
      : act.lo.includes(p.art.hall)
        ? 'lo'
        : 'none'
  const url =
    level === 'hd'
      ? p.art.srcHd ?? p.art.src
      : level === 'mid'
        ? p.art.src
        : level === 'lo'
          ? p.art.srcLo ?? p.art.src
          : null

  const [tex, setTex] = useState<THREE.Texture | null>(null)
  const held = useRef<string | null>(null)
  const matRef = useRef<THREE.MeshStandardMaterial>(null)

  // map 从 null→texture 必须重编译材质（USE_MAP 宏），R3F 条件分支不会自动触发
  useEffect(() => {
    if (matRef.current) matRef.current.needsUpdate = true
  }, [tex])

  useEffect(() => {
    let alive = true
    const cur = held.current
    if (!url) {
      if (cur) {
        dropTex(cur)
        held.current = null
        setTex(null)
      }
      return
    }
    if (cur === url) return
    // 错峰：按全局序号微延迟，避免进厅瞬间几十张同时解码
    const timer = setTimeout(() => {
      requestTex(url).then((t) => {
        if (!alive) return
        if (held.current && held.current !== url) dropTex(held.current)
        held.current = url
        setTex(t)
      })
    }, 25 * (i % 12))
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [url, i])

  useEffect(
    () => () => {
      if (held.current) dropTex(held.current)
    },
    [],
  )

  // 画上方射灯光斑：椭圆光池叠在画顶（冷银白洗墙灯的视觉暗示）
  const spotW = Math.max(1.8, p.photoW + 0.7)

  // focus 时画心自发光平滑增强（0.06→0.5）：大图「亮起来」的主驱动，纹理零改动
  useFrame((_, dt) => {
    const m = matRef.current
    if (!m) return
    const target = focusIndex === p.index && tex ? 0.5 : tex ? 0.06 : 0
    m.emissiveIntensity += (target - m.emissiveIntensity) * Math.min(1, dt * 7)
  })

  return (
    <group
      position={[pose.x, FRAME_CY, pose.z]}
      rotation-y={pose.rotationY}
      onPointerUp={(e) => {
        // R3F onClick 要求 down/up 两次 raycast 命中一致才派发——鼠标微转/帧间漂移会让点击静默丢失。
        // 改用 onPointerUp：松开时命中即触发，dragState.moved 仍挡拖拽。
        e.stopPropagation()
        if (!dragState.moved) focusArt(p.index)
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'auto'
      }}
    >
      {/* 画上方射灯光斑 */}
      <mesh position={[0, p.photoH / 2 + 0.62, -0.012]}>
        <planeGeometry args={[spotW, 0.85]} />
        <meshBasicMaterial
          map={glow}
          color="#f2f7ff"
          transparent
          opacity={0.5}
          depthWrite={false}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* 香槟钛银拉丝框：envMap 由程序化摄影棚环境提供，否则 metalness 0.85 会渲染成近黑 */}
      <mesh material={mats.frame}>
        <boxGeometry args={[matW + FRAME_EXTRA, matH + FRAME_EXTRA, 0.045]} />
      </mesh>
      {/* 卡纸阴影缝（8mm）：把卡纸与金属框分开，避免白卡纸与白墙同亮度糊成一片 */}
      <mesh position={[0, 0, 0.0245]} material={mats.rebate}>
        <planeGeometry args={[matW + REBATE_EXTRA, matH + REBATE_EXTRA]} />
      </mesh>
      {/* 白卡纸 */}
      <mesh position={[0, 0, 0.029]} material={mats.mat}>
        <planeGeometry args={[matW, matH]} />
      </mesh>
      {/* 当前作品银描边锚点（仅 focus 时出现，解决「点击后不知定位到哪幅」） */}
      {focusIndex === p.index && tex && (
        <mesh position={[0, 0, -0.031]}>
          <planeGeometry args={[matW + 0.09, matH + 0.09]} />
          <meshBasicMaterial color="#eaf2ff" toneMapped={false} />
        </mesh>
      )}
      {/* 作品：白盒照明环境下靠真实光照呈现（未加载时是浅灰卡位板） */}
      <mesh position={[0, 0, 0.0335]}>
        <planeGeometry args={[p.photoW, p.photoH]} />
        <meshStandardMaterial
          ref={matRef}
          map={tex ?? undefined}
          emissiveMap={tex ?? undefined}
          color={tex ? '#ffffff' : '#e3e1dd'}
          emissive={tex ? '#ffffff' : '#000000'}
          emissiveIntensity={tex ? 0.06 : 0}
          roughness={0.72}
          metalness={0}
        />
      </mesh>
    </group>
  )
}

function ArtworkLayer({ placements }: { placements: Placement[] }) {
  const gl = useThree((s) => s.gl)
  const glow = useMemo(() => makeGlowTexture(), [])
  const env = useMemo(() => studioEnv(gl), [gl])
  const mats = useMemo<Mats>(
    () => ({
      // 香槟钛银拉丝：无 envmap 时高 metalness 必发暗（铁律14/18）。
      // env 生成失败时降级为哑光钛银，宁可少一点反射也不能变黑。
      frame: new THREE.MeshStandardMaterial({
        color: '#c3bdb2',
        roughness: env ? 0.34 : 0.58,
        metalness: env ? 0.72 : 0.12,
        envMap: env ?? undefined,
        envMapIntensity: 1.15,
      }),
      // 卡纸：纯白（比墙面亮一档），配合阴影缝才能读出「装裱」层次
      mat: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.96, metalness: 0 }),
      rebate: new THREE.MeshStandardMaterial({ color: '#4b4741', roughness: 0.85, metalness: 0.1 }),
    }),
    [env],
  )
  return (
    <>
      {placements.map((p, i) => (
        <ArtEntry key={p.art.id} p={p} glow={glow} mats={mats} i={i} />
      ))}
    </>
  )
}

export default function Artworks() {
  const [placements, setPlacements] = useState<Placement[] | null>(null)
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    MAX_ANISO = Math.min(16, gl.capabilities.getMaxAnisotropy())
  }, [gl])
  // 直接消费布展结果：v5 曾把选出的 60 张再喂回 pickPlacements 二次分配，
  // 二次分配按墙长比例、忽略容量，会把 5 幅压进只能放 4 幅的墙（间距崩掉的隐患）。
  useEffect(() => {
    loadPlacements().then(setPlacements)
  }, [])
  if (!placements) return null
  return <ArtworkLayer placements={placements} />
}

export type { ManifestArt }
