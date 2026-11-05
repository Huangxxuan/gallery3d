import { useState } from 'react'
import S1Scene from './spike/S1Scene'
import S2Scene from './spike/S2Scene'
import S3Scene from './spike/S3Scene'
import S4Scene from './spike/S4Scene'

const TABS = [
  { id: 'S1', label: 'S1 贴墙吸附' },
  { id: 'S2', label: 'S2 双相机切换' },
  { id: 'S3', label: 'S3 实时射灯' },
  { id: 'S4', label: 'S4 四厅分区' },
] as const

// Spike 验证场（#spike 入口保留）
export default function SpikeHost() {
  const [tab, setTab] = useState<string>('S1')
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {tab === 'S1' && <S1Scene />}
      {tab === 'S2' && <S2Scene />}
      {tab === 'S3' && <S3Scene />}
      {tab === 'S4' && <S4Scene />}
      <div style={{ position: 'absolute', top: 16, right: 20, display: 'flex', gap: 8, zIndex: 10 }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '6px 12px', fontSize: 12, borderRadius: 6, border: '1px solid',
              borderColor: tab === t.id ? '#C9A876' : '#2E2E33',
              background: tab === t.id ? '#1D1D20' : '#161618', color: '#fafafa', cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  )
}
