import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { Capsule } from 'three/addons/math/Capsule.js'
import { ROUTE, SPAWN, zoneAt } from '../domain/gallery'
import { THEMES } from '../domain/themes'
import { buildWorldOctree, EYE_HEIGHT, PLAYER_RADIUS, RUN_SPEED, WALK_SPEED } from './collision'
import { cameraStand, loadPlacements, type Placement } from './placements'
import { dragState, playerPose, resetRequest, useUI } from '../state/player'

const START_Y = PLAYER_RADIUS // 胶囊下球心高度（下半球触地 y=0）
const PITCH_LIMIT = 0.7 // ±40°
const LOOK_YAW = 0.105 // 鼠标微调 ±6°
const LOOK_PITCH = 0.07 // 微调俯仰 ±4°
const DRAG_THRESHOLD = 7 // px，区分点击与拖拽环视
const TURN_SPEED = 1.9
const FLY_DUR = 0.6

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

interface Fly {
  t: number
  fromP: THREE.Vector3
  fromYaw: number
  fromPitch: number
  toP: THREE.Vector3
  toYaw: number
  toPitch: number
}

export default function Player() {
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const world = useMemo(() => buildWorldOctree(), [])
  const setZone = useUI((s) => s.setZone)
  const mode = useUI((s) => s.mode)
  const focusIndex = useUI((s) => s.focusIndex)

  const capsule = useMemo(
    () => new Capsule(new THREE.Vector3(SPAWN.x, START_Y, SPAWN.z), new THREE.Vector3(SPAWN.x, 1, SPAWN.z), PLAYER_RADIUS),
    [],
  )
  const velocity = useMemo(() => new THREE.Vector3(), [])
  const keys = useRef<Record<string, boolean>>({})
  const fwd = useMemo(() => new THREE.Vector3(), [])
  const right = useMemo(() => new THREE.Vector3(), [])
  const wish = useMemo(() => new THREE.Vector3(), [])
  const tmp = useMemo(() => new THREE.Vector3(), [])

  // 相机姿态唯一权威：baseYaw/pitch + 鼠标微调偏移
  const baseYaw = useRef(Math.PI / 2) // 出生朝西（-x）
  const pitch = useRef(0)
  const look = useRef({ x: 0, y: 0 })
  const dragging = useRef<{ id: number; x: number; y: number } | null>(null)

  const autopilot = useRef(false)
  const routeIdx = useRef(0)

  const placementsRef = useRef<Placement[]>([])
  const fly = useRef<Fly | null>(null)
  const savedView = useRef<{ x: number; z: number; yaw: number; pitch: number } | null>(null)
  const lastFocus = useRef<number | null>(null)

  // QA 机位：?artview=n 站画前；?focus=n 直接进大图；?cam=x,z,yaw[,pitch] 任意机位（验收拱门/门洞用）
  const qa = useMemo(() => {
    const q = new URLSearchParams(window.location.search)
    const num = (k: string) => {
      const v = q.get(k)
      return v === null || Number.isNaN(Number(v)) ? null : Number(v)
    }
    const raw = q.get('cam')
    const cam = raw
      ? raw.split(',').map(Number)
      : null
    return {
      artview: num('artview'),
      focus: num('focus'),
      cam: cam && cam.length >= 3 && cam.slice(0, 3).every((n) => Number.isFinite(n)) ? cam : null,
    }
  }, [])

  const placeAt = (x: number, z: number, yaw: number) => {
    capsule.start.set(x, START_Y, z)
    capsule.end.set(x, 1, z)
    velocity.set(0, 0, 0)
    baseYaw.current = yaw
    pitch.current = 0
    camera.position.set(x, EYE_HEIGHT, z)
    camera.rotation.set(0, yaw, 0)
  }

  const resetToSpawn = () => {
    autopilot.current = false
    routeIdx.current = 0
    fly.current = null
    placeAt(SPAWN.x, SPAWN.z, -SPAWN.yaw)
  }

  // 载入布展（artview QA 机位用）
  useEffect(() => {
    loadPlacements().then((list) => {
      placementsRef.current = list
      if (qa.cam) {
        const [cx, cz, cyaw, cpitch] = qa.cam
        placeAt(cx, cz, cyaw)
        pitch.current = cpitch ?? 0
        useUI.getState().setWalking(true)
        return
      }
      const k = qa.focus ?? qa.artview
      if (k !== null && list[k]) {
        const s = cameraStand(list[k], 2.9)
        placeAt(s.x, s.z, s.yaw)
        useUI.getState().setWalking(true)
        if (qa.focus !== null) useUI.getState().focusArt(qa.focus)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── 键盘：模式矩阵，intro 不响应；walk 行走转向；focus 仅翻幅/退出 ──
  useEffect(() => {
    camera.rotation.order = 'YXZ'

    const down = (e: KeyboardEvent) => {
      const m = useUI.getState().mode
      if (m === 'intro') return
      keys.current[e.code] = true

      if (e.code === 'KeyR') {
        resetRequest.n += 1
        useUI.getState().closeFocus()
        resetToSpawn()
        return
      }
      if (m === 'focus') {
        const n = placementsRef.current.length
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') { e.preventDefault(); useUI.getState().stepArt(-1, n) }
        if (e.code === 'ArrowRight' || e.code === 'KeyD') { e.preventDefault(); useUI.getState().stepArt(1, n) }
        if (e.code === 'Escape' || e.code === 'Backspace') useUI.getState().closeFocus()
        return
      }
      // walk
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault()
      if (e.code === 'KeyP') {
        autopilot.current = !autopilot.current
        routeIdx.current = 0
      }
    }
    const up = (e: KeyboardEvent) => { keys.current[e.code] = false }

    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', () => { keys.current = {} })
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera])

  // ── 鼠标：移动微调（离窗回中）+ 按住左键拖拽环视；仅 walk 模式 ──
  useEffect(() => {
    const el = gl.domElement
    const updateLook = (cx: number, cy: number) => {
      look.current.x = Math.max(-1, Math.min(1, (cx / window.innerWidth - 0.5) * 2))
      look.current.y = Math.max(-1, Math.min(1, (0.5 - cy / window.innerHeight) * 2))
    }
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || useUI.getState().mode !== 'walk') return
      dragging.current = { id: e.pointerId, x: e.clientX, y: e.clientY }
      dragState.moved = false
    }
    const onMove = (e: PointerEvent) => {
      updateLook(e.clientX, e.clientY)
      const d = dragging.current
      if (!d || d.id !== e.pointerId || useUI.getState().mode !== 'walk') return
      const dx = e.clientX - d.x
      const dy = e.clientY - d.y
      if (!dragState.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) dragState.moved = true
      if (dragState.moved) {
        baseYaw.current -= dx * 0.00315
        pitch.current = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch.current - dy * 0.0028))
        d.x = e.clientX
        d.y = e.clientY
      }
    }
    const onUp = (e: PointerEvent) => {
      if (dragging.current?.id === e.pointerId) {
        dragging.current = null
        setTimeout(() => { dragState.moved = false }, 0)
      }
    }
    const onLeave = () => { look.current.x = 0; look.current.y = 0 }

    el.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    el.addEventListener('mouseleave', onLeave)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      el.removeEventListener('mouseleave', onLeave)
    }
  }, [gl])

  // ── 大图飞行：focusIndex 变化即重设飞行目标；关闭时飞回保存机位 ──
  useEffect(() => {
    const list = placementsRef.current
    if (focusIndex !== null && focusIndex !== lastFocus.current) {
      const stand = cameraStand(list[focusIndex])
      const to = new THREE.Vector3(stand.x, stand.y, stand.z)
      if (lastFocus.current === null) {
        savedView.current = { x: capsule.start.x, z: capsule.start.z, yaw: baseYaw.current, pitch: pitch.current }
        autopilot.current = false
      }
      fly.current = {
        t: 0,
        fromP: camera.position.clone(),
        fromYaw: baseYaw.current,
        fromPitch: pitch.current,
        toP: to,
        toYaw: stand.yaw,
        toPitch: 0,
      }
    }
    if (focusIndex === null && lastFocus.current !== null && savedView.current) {
      const s = savedView.current
      fly.current = {
        t: 0,
        fromP: camera.position.clone(),
        fromYaw: baseYaw.current,
        fromPitch: pitch.current,
        toP: new THREE.Vector3(s.x, EYE_HEIGHT, s.z),
        toYaw: s.yaw,
        toPitch: s.pitch,
      }
      savedView.current = null
    }
    lastFocus.current = focusIndex
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusIndex])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)

    // ── 飞行插值（focus 与返回共用），期间物理/输入全部让位；结束帧硬锁目标位姿 ──
    if (fly.current) {
      const f = fly.current
      f.t += dt / FLY_DUR
      const done = f.t >= 1
      const k = easeOutCubic(Math.min(1, f.t))
      camera.position.lerpVectors(f.fromP, f.toP, k)
      // 角度最短弧插值
      let dy = f.toYaw - f.fromYaw
      while (dy > Math.PI) dy -= Math.PI * 2
      while (dy < -Math.PI) dy += Math.PI * 2
      baseYaw.current = f.fromYaw + dy * k
      pitch.current = f.fromPitch + (f.toPitch - f.fromPitch) * k
      capsule.start.x = camera.position.x
      capsule.start.z = camera.position.z
      if (done) {
        // 硬锁：消除插值残差，机位与画心严格对齐（点击定位精度的兜底）
        camera.position.copy(f.toP)
        baseYaw.current = f.toYaw
        pitch.current = f.toPitch
        capsule.start.x = f.toP.x
        capsule.start.z = f.toP.z
        fly.current = null
      }
    } else if (mode === 'walk') {
      // ── 键盘转向（左右键） ──
      if (!autopilot.current) {
        if (keys.current['ArrowLeft']) baseYaw.current += TURN_SPEED * dt
        if (keys.current['ArrowRight']) baseYaw.current -= TURN_SPEED * dt
      }

      // ── 期望速度：水平朝向仅取 baseYaw（不含微调俯仰/偏航） ──
      let moving = false
      if (autopilot.current) {
        const tgt = ROUTE[routeIdx.current]
        if (tgt) {
          const dx = tgt[0] - capsule.start.x
          const dz = tgt[1] - capsule.start.z
          const dist = Math.hypot(dx, dz)
          if (dist < 0.6) {
            routeIdx.current += 1
          } else {
            // worldForward=(-sin θ,-cos θ)；目标 θ 满足 (-sin,-cos)∝(dx,dz)
            const wantYaw = Math.atan2(-dx / dist, -dz / dist)
            let dy = wantYaw - baseYaw.current
            while (dy > Math.PI) dy -= Math.PI * 2
            while (dy < -Math.PI) dy += Math.PI * 2
            baseYaw.current += dy * Math.min(1, dt * 4)
            wish.set(dx / dist, 0, dz / dist).multiplyScalar(WALK_SPEED * 1.15)
            moving = true
          }
        } else {
          autopilot.current = false
          wish.set(0, 0, 0)
        }
      } else {
        fwd.set(-Math.sin(baseYaw.current), 0, -Math.cos(baseYaw.current))
        right.crossVectors(fwd, camera.up).normalize()
        wish.set(0, 0, 0)
        if (keys.current['ArrowUp'] || keys.current['KeyW']) wish.add(fwd)
        if (keys.current['ArrowDown'] || keys.current['KeyS']) wish.sub(fwd)
        if (keys.current['KeyD']) wish.add(right)
        if (keys.current['KeyA']) wish.sub(right)
        moving = wish.lengthSq() > 0
        if (moving) wish.normalize()
        const speed = keys.current['ShiftLeft'] || keys.current['ShiftRight'] ? RUN_SPEED : WALK_SPEED
        wish.multiplyScalar(speed)
      }
      velocity.x += (wish.x - velocity.x) * Math.min(1, dt * 12)
      velocity.z += (wish.z - velocity.z) * Math.min(1, dt * 12)
      playerPose.moving = moving

      // ── 分轴推进 + Octree 推出（沿法线滑动） ──
      const resolve = (axis: 'x' | 'z') => {
        const d = velocity[axis] * dt
        if (Math.abs(d) < 1e-6) return
        capsule.translate(tmp.set(axis === 'x' ? d : 0, 0, axis === 'z' ? d : 0))
        for (let i = 0; i < 3; i++) {
          const hit = world.capsuleIntersect(capsule)
          if (!hit) break
          capsule.translate(tmp.set(hit.normal.x * hit.depth, 0, hit.normal.z * hit.depth))
          const vn = velocity.x * hit.normal.x + velocity.z * hit.normal.z
          if (vn < 0) {
            velocity.x -= vn * hit.normal.x
            velocity.z -= vn * hit.normal.z
          }
        }
      }
      resolve('x')
      resolve('z')

      camera.position.set(capsule.start.x, EYE_HEIGHT, capsule.start.z)
    }

    // ── 相机姿态输出（唯一写入口） ──
    const micro = mode === 'walk' && !dragging.current && !autopilot.current
    camera.rotation.set(
      pitch.current + (micro ? look.current.y * LOOK_PITCH : 0),
      baseYaw.current + (micro ? look.current.x * LOOK_YAW : 0),
      0,
    )

    playerPose.x = capsule.start.x
    playerPose.z = capsule.start.z
    playerPose.yaw = Math.atan2(-Math.sin(baseYaw.current), -Math.cos(baseYaw.current))

    const z = zoneAt(capsule.start.x, capsule.start.z)
    if (z) setZone(z.id, THEMES[z.id]?.name ?? z.name, z.id === 'EXIT')
  })

  return null
}
