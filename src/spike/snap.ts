// Spike S1 验证用吸附函数（通过验证后演进为 src/domain/layout.ts）
export type Interval = { from: number; to: number }

/**
 * 作品中心沿墙坐标 raw 是否合法：
 * 1. 不越墙端（含作品半宽）
 * 2. 作品占用区间 [raw-hw, raw+hw] 不与任何门洞区间相交
 */
export function snapOffset(
  raw: number,
  wallLength: number,
  halfWidth: number,
  openings: Interval[],
): { offset: number; valid: boolean } {
  const inWall = raw - halfWidth >= -wallLength / 2 && raw + halfWidth <= wallLength / 2
  const hitsOpening = openings.some(
    (o) => raw + halfWidth > o.from && raw - halfWidth < o.to,
  )
  return { offset: raw, valid: inWall && !hitsOpening }
}

/** 非法时回弹：返回沿墙两个合法区间中距 raw 最近的区间端点 */
export function nearestLegal(
  raw: number,
  wallLength: number,
  halfWidth: number,
  openings: Interval[],
): number {
  const min = -wallLength / 2 + halfWidth
  const max = wallLength / 2 - halfWidth
  const zones: Interval[] = [{ from: min, to: max }]
  for (const o of openings) {
    const last = zones[zones.length - 1]
    zones.splice(zones.length - 1, 1, { from: last.from, to: o.from - halfWidth }, { from: o.to + halfWidth, to: last.to })
  }
  const legal = zones.filter((z) => z.from <= z.to)
  let best = legal[0].from
  let bestDist = Infinity
  for (const z of legal) {
    const c = Math.min(Math.max(raw, z.from), z.to)
    const d = Math.abs(c - raw)
    if (d < bestDist) {
      bestDist = d
      best = c
    }
  }
  return best
}
