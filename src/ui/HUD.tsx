import { useEffect, useRef, useState } from 'react'
import { ROUTE, SITE, SPACES } from '../domain/gallery'
import { THEMES } from '../domain/themes'
import { playerPose, useUI } from '../state/player'
import { loadPlacements } from '../three/placements'

const panel: React.CSSProperties = {
  position: 'absolute',
  fontFamily: '"PingFang SC",sans-serif',
  color: '#2c2e32',
  pointerEvents: 'none',
}

function Minimap() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current!
    const ctx = cv.getContext('2d')!
    const W = cv.width
    const H = cv.height
    const pad = 8
    const s = Math.min((W - pad * 2) / (SITE.x1 - SITE.x0), (H - pad * 2) / (SITE.z1 - SITE.z0))
    const ox = pad
    const PX = (x: number) => ox + x * s
    const PY = (z: number) => H - pad - z * s

    let raf = 0
    const draw = () => {
      raf = requestAnimationFrame(draw)
      ctx.clearRect(0, 0, W, H)
      ctx.fillStyle = 'rgba(250,249,246,0.82)'
      ctx.fillRect(0, 0, W, H)
      for (const sp of SPACES) {
        const th = THEMES[sp.id]
        ctx.fillStyle = th
          ? th.accent + '30'
          : sp.kind === 'hall'
            ? '#e4e2dd'
            : sp.kind === 'lobby'
              ? '#dcdad5'
              : '#efeeea'
        ctx.fillRect(PX(sp.x0), PY(sp.z1), (sp.x1 - sp.x0) * s, (sp.z1 - sp.z0) * s)
        ctx.strokeStyle = th ? th.accent + '77' : '#a8a49d'
        ctx.lineWidth = 0.6
        ctx.strokeRect(PX(sp.x0), PY(sp.z1), (sp.x1 - sp.x0) * s, (sp.z1 - sp.z0) * s)
      }
      ctx.strokeStyle = 'rgba(70,74,80,0.6)'
      ctx.setLineDash([3, 3])
      ctx.beginPath()
      ROUTE.forEach(([x, z], i) => (i === 0 ? ctx.moveTo(PX(x), PY(z)) : ctx.lineTo(PX(x), PY(z))))
      ctx.stroke()
      ctx.setLineDash([])
      const px = PX(playerPose.x)
      const py = PY(playerPose.z)
      ctx.fillStyle = '#1a6fd4'
      ctx.beginPath()
      ctx.arc(px, py, 3.4, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#0d3f80'
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.moveTo(px, py)
      ctx.lineTo(px + Math.sin(playerPose.yaw) * 7, py - Math.cos(playerPose.yaw) * 7)
      ctx.stroke()
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [])
  return <canvas ref={ref} width={236} height={150} style={{ borderRadius: 6, border: '1px solid #c6c3bd' }} />
}

/** ?fps=1 右下角性能读数 */
function FpsMeter() {
  const [fps, setFps] = useState(0)
  const on = useRef(new URLSearchParams(window.location.search).get('fps') === '1')
  useEffect(() => {
    if (!on.current) return
    let frames = 0
    let last = performance.now()
    let raf = 0
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick)
      frames += 1
      if (t - last >= 500) {
        setFps(Math.round((frames * 1000) / (t - last)))
        frames = 0
        last = t
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  if (!on.current) return null
  return (
    <div style={{
      ...panel, right: 18, bottom: 14, fontSize: 12, fontFamily: 'monospace',
      color: fps >= 45 ? '#7fd17f' : fps >= 30 ? '#e0b34d' : '#e05d5d',
    }}>
      {fps} FPS
    </div>
  )
}

/** 大图模式底栏：上一幅 / 返回漫游 / 下一幅 */
function FocusBar() {
  const focusIndex = useUI((s) => s.focusIndex)
  const stepArt = useUI((s) => s.stepArt)
  const closeFocus = useUI((s) => s.closeFocus)
  const [names, setNames] = useState<string[]>([])
  useEffect(() => {
    loadPlacements().then((list) => setNames(list.map((p) => THEMES[p.hall.id]?.name ?? p.hall.name)))
  }, [])
  if (focusIndex === null) return null
  const n = names.length || 60

  const btn: React.CSSProperties = {
    pointerEvents: 'auto', cursor: 'pointer',
    padding: '9px 22px', fontSize: 13, letterSpacing: 2,
    color: '#33363b', background: 'rgba(252,251,249,0.88)',
    border: '1px solid #b9b6b0', borderRadius: 4,
  }
  const wide: React.CSSProperties = { ...btn, padding: '9px 30px', color: '#0d3f80', borderColor: '#7ea6cf' }

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 12, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', top: 24, left: '50%', transform: 'translateX(-50%)', ...panel, fontSize: 13, letterSpacing: 3 }}>
        {names[focusIndex] ?? ''}　作品 {String(focusIndex + 1).padStart(2, '0')} / {n}
      </div>
      <div style={{ position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 14 }}>
        <button style={btn} onClick={() => stepArt(-1, n)}>← 上一幅</button>
        <button style={wide} onClick={closeFocus}>返回漫游 (Esc)</button>
        <button style={btn} onClick={() => stepArt(1, n)}>下一幅 →</button>
      </div>
    </div>
  )
}

export default function HUD() {
  const mode = useUI((s) => s.mode)
  const zoneName = useUI((s) => s.zoneName)
  const atExit = useUI((s) => s.atExit)
  const walking = mode !== 'intro'

  return (
    <div style={{ position: 'absolute', inset: 0, fontFamily: '"PingFang SC",sans-serif', pointerEvents: 'none' }}>
      {mode === 'walk' && (
        <>
          <div style={{ ...panel, left: 20, top: 18, fontSize: 15, fontWeight: 700, letterSpacing: 2, textShadow: '0 1px 3px rgba(255,255,255,0.8)' }}>
            {zoneName}
          </div>
          <div style={{ ...panel, left: 20, bottom: 16, fontSize: 11, color: '#6d7076', textShadow: '0 1px 3px rgba(255,255,255,0.8)' }}>
            WASD 行走　按住左键拖拽环视　点击作品看大图　Shift 快走　P 自动巡游　R 返回入口
          </div>
          <div style={{ ...panel, right: 16, top: 14 }}>
            <Minimap />
          </div>
          {atExit && (
            <div style={{
              ...panel, left: '50%', bottom: 56, transform: 'translateX(-50%)',
              background: 'rgba(252,251,249,0.9)', border: '1px solid #b9b6b0', borderRadius: 8,
              padding: '10px 18px', fontSize: 13, color: '#33363b',
            }}>
              参观完成 — 按 R 返回入口
            </div>
          )}
        </>
      )}

      {mode === 'focus' && <FocusBar />}

      <FpsMeter />

      {!walking && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'radial-gradient(circle at 50% 40%, rgba(10,22,38,0.94), rgba(4,10,18,0.98))',
          zIndex: 20,
        }}>
          <div style={{ textAlign: 'center', color: '#e8f6ff', maxWidth: 620, padding: '0 24px' }}>
            <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: 6, marginBottom: 14, textShadow: '0 0 22px rgba(120,220,255,0.45)' }}>AI 数字摄影艺术展</div>
            <div style={{ fontSize: 12, color: '#6f93ad', letterSpacing: 2, marginBottom: 30 }}>
              60 幅作品 · 四主题展厅 · 白盒美术馆
            </div>
            <button
              onClick={() => useUI.getState().setWalking(true)}
              style={{
                pointerEvents: 'auto', cursor: 'pointer',
                padding: '12px 44px', fontSize: 15, letterSpacing: 4,
                color: '#dff3ff', background: 'rgba(12,32,56,0.92)', border: '1px solid #4fd0ff', borderRadius: 4,
                boxShadow: '0 0 24px rgba(79,208,255,0.35)',
              }}
            >
              点 击 进 入
            </button>
            <div style={{ marginTop: 26, fontSize: 12, color: '#6f93ad', lineHeight: 2 }}>
              按住鼠标左键拖拽环视 ｜ 鼠标移动微转 ｜ WASD 行走 ｜ 点击作品看大图
              <br />
              路线：入口厅 → 香港故事 → 双城纪事 → 海与港 → 林间生灵 → 出口厅
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
