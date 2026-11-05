// Spike S4：分区调度纯函数（验证后演进为 src/three/ZoningManager.ts）

export type ZoneState = 'active' | 'adjacent' | 'frozen'

/** 四厅线性串联 h1-h2-h3-h4 */
export const HALL_CHAIN = ['h1', 'h2', 'h3', 'h4'] as const
export type HallId = (typeof HALL_CHAIN)[number]

export function zoneFor(current: HallId, id: HallId): ZoneState {
  if (current === id) return 'active'
  const ci = HALL_CHAIN.indexOf(current)
  const ii = HALL_CHAIN.indexOf(id)
  if (Math.abs(ci - ii) === 1) return 'adjacent'
  return 'frozen'
}

export type HallBounds = { id: HallId; minX: number; maxX: number }

/** 位置（世界 x）→ 所在厅；走廊/厅外返回 null */
export function hallAt(x: number, bounds: HallBounds[]): HallId | null {
  return bounds.find((b) => x >= b.minX && x <= b.maxX)?.id ?? null
}

/** 过门检测：当前帧厅 id 与上一帧不同（含 null↔id）才触发黑场 */
export function detectCrossing(prev: HallId | null, next: HallId | null): boolean {
  return prev !== next && prev !== null && next !== null
}

export type HallLoad = { id: HallId; count: number }
export type TierBytes = { full: number; thumb: number }

/**
 * 当前驻留厅下的 GPU 纹理预算（字节）
 * active：每幅全质；adjacent：每幅缩略；frozen：0（纹理释放）
 */
export function textureBudget(activeHall: HallId, halls: HallLoad[], sizes: TierBytes): number {
  return halls.reduce((sum, h) => {
    const z = zoneFor(activeHall, h.id)
    if (z === 'active') return sum + h.count * sizes.full
    if (z === 'adjacent') return sum + h.count * sizes.thumb
    return sum
  }, 0)
}

/** 投射阴影灯数量（仅 active 厅），用于 shadow map 预算 */
export function shadowCasterCount(activeHall: HallId, halls: HallLoad[]): number {
  return halls.find((h) => h.id === activeHall)?.count ?? 0
}
