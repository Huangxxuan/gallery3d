// 碰撞世界：与渲染建墙同源（domain/gallery.wallBoxes），three 官方 Octree 方案
import * as THREE from 'three'
import { Octree } from 'three/addons/math/Octree.js'
import { SITE, SPACES, wallBoxes } from '../domain/gallery'
import { DECOR_BOXES } from './GalleryWorld'

/** 构建世界 Octree：墙体 + 整片地面 + 各空间顶板（封顶防飞，门洞处自然留空） */
export function buildWorldOctree(): Octree {
  const group = new THREE.Group()

  const addBox = (cx: number, cy: number, cz: number, sx: number, sy: number, sz: number) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz))
    mesh.position.set(cx, cy, cz)
    group.add(mesh)
  }

  for (const b of wallBoxes()) addBox(b.cx, b.cy, b.cz, b.sx, b.sy, b.sz)
  for (const b of DECOR_BOXES) addBox(b.cx, b.cy, b.cz, b.sx, b.sy, b.sz)

  // 地面（覆盖整块用地，顶面 y=0）
  addBox((SITE.x0 + SITE.x1) / 2, -0.1, (SITE.z0 + SITE.z1) / 2, SITE.x1 - SITE.x0, 0.2, SITE.z1 - SITE.z0)

  // 顶板（厅/门厅 4m，暗廊 3.2m）
  for (const s of SPACES) {
    addBox((s.x0 + s.x1) / 2, s.h + 0.25, (s.z0 + s.z1) / 2, s.x1 - s.x0, 0.5, s.z1 - s.z0)
  }

  const octree = new Octree()
  octree.fromGraphNode(group)
  group.traverse((o) => {
    if (o instanceof THREE.Mesh) o.geometry.dispose()
  })
  return octree
}

export const PLAYER_RADIUS = 0.35
export const EYE_HEIGHT = 1.7
export const WALK_SPEED = 3.4
export const RUN_SPEED = 5.6
