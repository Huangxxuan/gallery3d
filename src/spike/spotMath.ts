// Spike S3：射灯光斑覆盖 + 色温转换（验证后演进为 src/three/spotParams.ts）

/** 光轴垂直面上的光斑半径（penumbra 只影响边缘羽化，不改变几何半径） */
export function spotRadius(distance: number, angle: number): number {
  return distance * Math.tan(angle)
}

/**
 * 斜射到墙面的椭圆光斑半轴（米）
 * @param distance 灯→目标距离
 * @param angle 半锥角（弧度）
 * @param tiltFromNormal 光轴与墙面法线夹角（弧度），0=正对墙
 */
export function ellipseAxes(
  distance: number,
  angle: number,
  tiltFromNormal: number,
): { semiMinor: number; semiMajor: number } {
  const r = spotRadius(distance, angle)
  return { semiMinor: r, semiMajor: r / Math.cos(tiltFromNormal) }
}

/** 卡纸外径 + 10cm 覆盖判定（M 档 2:3：卡纸 1.00×1.40） */
export function coversMat(
  semiMinor: number,
  semiMajor: number,
  matW = 1.0,
  matH = 1.4,
  margin = 0.1,
): boolean {
  return semiMinor * 2 >= matW + margin && semiMajor * 2 >= matH + margin
}

/** 灯位→画心 距离与倾角 */
export function aimGeometry(
  lightPos: { x: number; y: number; z: number },
  target: { x: number; y: number; z: number },
  wallNormal: { x: number; z: number },
): { distance: number; tiltFromNormal: number } {
  const dx = target.x - lightPos.x
  const dy = target.y - lightPos.y
  const dz = target.z - lightPos.z
  const distance = Math.hypot(dx, dy, dz)
  const nl = Math.hypot(wallNormal.x, wallNormal.z) || 1
  // 光轴（含竖直分量）与墙面法线的夹角，取绝对值兼容光从墙面两侧入射
  const dot = Math.abs((dx * wallNormal.x + dz * wallNormal.z) / (distance * nl))
  return { distance, tiltFromNormal: Math.acos(Math.min(1, Math.max(-1, dot))) }
}

/** Tanner Helland 黑体色温近似，返回 sRGB 0..1（线性显示，直接给 material.color 近似够用） */
export function kelvinToRGB(kelvin: number): { r: number; g: number; b: number } {
  const t = kelvin / 100
  let r: number
  let g: number
  let b: number
  if (t <= 66) {
    r = 255
    g = 99.4708025861 * Math.log(t) - 161.1195681661
    b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307
  } else {
    r = 329.698727446 * (t - 60) ** -0.1332047592
    g = 288.1221695283 * (t - 60) ** -0.0755148492
    b = 255
  }
  const cl = (v: number) => Math.min(255, Math.max(0, v)) / 255
  return { r: cl(r), g: cl(g), b: cl(b) }
}
