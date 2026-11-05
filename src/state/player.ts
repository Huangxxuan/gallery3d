import { create } from 'zustand'

// 玩家姿态（每帧更新，供小地图读取）
export const playerPose = { x: 67.4, z: 1.2, yaw: -Math.PI / 2, moving: false }

export const resetRequest = { n: 0 }

// 鼠标手势共享状态（Player 写入，作品 onClick 读取以区分点击/拖拽环视）
export const dragState = { moved: false }

type Mode = 'intro' | 'walk' | 'focus'

interface UIState {
  mode: Mode
  walking: boolean // 是否已入场（intro 遮罩控制）
  focusIndex: number | null // 大图模式当前作品序号
  zoneId: string
  zoneName: string
  atExit: boolean
  setWalking: (v: boolean) => void
  setZone: (id: string, name: string, atExit: boolean) => void
  focusArt: (i: number) => void
  stepArt: (dir: number, count: number) => void
  closeFocus: () => void
}

export const useUI = create<UIState>((set) => ({
  mode: 'intro',
  walking: false,
  focusIndex: null,
  zoneId: 'ENTRY',
  zoneName: '入口厅',
  atExit: false,
  setWalking: (v) => set({ walking: v, mode: v ? 'walk' : 'intro' }),
  setZone: (id, name, atExit) =>
    set((s) => (s.zoneId === id && s.atExit === atExit ? s : { zoneId: id, zoneName: name, atExit })),
  focusArt: (i) => set({ focusIndex: i, mode: 'focus' }),
  stepArt: (dir, count) =>
    set((s) => (s.focusIndex === null ? s : { focusIndex: (s.focusIndex + dir + count) % count })),
  closeFocus: () => set({ focusIndex: null, mode: 'walk' }),
}))
