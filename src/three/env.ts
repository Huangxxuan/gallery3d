import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'

/**
 * 程序化摄影棚环境贴图（离线 · 零外网请求，符合铁律 8）。
 *
 * 为什么必须有它：无 envmap 的场景里 metalness 高的 MeshStandardMaterial 只能反射
 * 纯黑环境（F0 镜面项没有来源），#c3bdb2 metal0.85 的香槟钛银画框会渲染成近黑色
 * —— 2026-10-20 像素实测 (34,32,28)，与设计值 (195,189,178) 相差一个数量级。
 *
 * 做法：RoomEnvironment（three 官方程序化棚拍场景）→ PMREM 预卷积 → 只挂给金属材质
 * （画框 / 拱门套 / 灯轨），不写 scene.environment，避免把白盒墙面的漫反射一起提亮。
 */
let cache: THREE.Texture | null = null

export function studioEnv(gl: THREE.WebGLRenderer): THREE.Texture | null {
  if (cache) return cache
  try {
    const pmrem = new THREE.PMREMGenerator(gl)
    const room = new RoomEnvironment()
    const rt = pmrem.fromScene(room, 0.04)
    cache = rt.texture
    pmrem.dispose()
    const geos = new Set<THREE.BufferGeometry>()
    const mats = new Set<THREE.Material>()
    room.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return
      geos.add(o.geometry)
      const m = o.material
      if (Array.isArray(m)) m.forEach((x) => mats.add(x))
      else if (m) mats.add(m)
    })
    geos.forEach((g) => g.dispose())
    mats.forEach((m) => m.dispose())
    return cache
  } catch {
    return null
  }
}
