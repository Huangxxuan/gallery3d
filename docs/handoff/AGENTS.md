# gallery3d · Agent 交接入口（任何接手者先读本文）

- 更新：2026-10-26（v9 H2「双城纪事」中庭罗马斗兽场建筑模型，已落码待终验；v8.1 H3 海浪丝带冻结）
- 项目根：`/Users/huang/TRAEWORK/gallery3d`
- 本文是**现行口径最高优先级**。与 `docs/MASTER.md` 或早期 ADR 冲突时，以本文「§5 现行口径覆盖表」为准。

---

## 1. 项目是什么

本地运行的 3D 摄影展览网页：程序化展馆（2×2 四厅 + 蛇形动线），第一人称漫游观展，点击作品相机飞行看大图。
当前为 **v6 圆拱门修版**（2026-10-20 晚，在 v5 基础上修三类问题）：

- **① 门洞越界（真实 bug，已修）**：CW 西端廊横向净宽 1.8 却把 1.8m 门洞摆在 at=1.2 → 东侧 **−0.3m 穿墙**（暗廊东墙从门洞正中穿过、拱环右腿埋进墙里）；H4 出口门 at=1.2/w3 → 南侧 **−0.3m 越界**（拱环 0.42m 悬在暗腔）。修法：`CW.x1 1.8→2.4`（三条暗廊横向统一 2.4m）、出口门移到 `z=17.4`，动线/文字/平面图同步。
- **② 挂位间距不统一（根因已除）**：v5 的 `evenSlotsOnWall` 用 `净长/count` 逐墙自适应 → 同馆并存 **2.67 / 3.02 / 3.37 / 3.70** 四种中心距；且画框外宽口径写错（注释 1.96，实际 2.14），最窄框边净隙只剩 **0.53m**。v6 改为 **全馆统一中心距 `HANG_PITCH=3.5`**，整组在墙段内居中，余量全部转为端部留白；最窄净隙 **1.36m**。
- **③ 拱门统一与抬高**：拱顶 **3.2→3.5m**（主门 3.0×3.5，宽高比 1:1.17），暗廊净高 **3.6→4.0**（拱环上留 0.36m 墙），拱环 **0.12→0.14**、骑缝 0.02。参数收敛到 `PORTAL_PRESETS`，三档可用 `?portal=` 现场比对（默认 `gallery`）。
- 另修：画框 `metalness 0.85` 无 envmap → 实测渲染成 **(34,32,28) 近黑**（设计值 #c3bdb2），加程序化 RoomEnvironment PMREM 环境反射；白卡纸与墙面同亮度（178 vs 172）不可见，改为纯白 + 8mm 阴影缝。
- **v8 改向（2026-10-26，老板否决 v7）**：v7「墙面波浪浮雕带 + 焦散」被判定「像装修线条、没有海浪氛围」，**整案废弃，不保留并行**。改做 **H3 悬垂海浪丝带装置**：5 条宽 1.1m 浪带从发光天棚垂下（顶 5.02 / 底 **0.6**（v8.1 加长：垂到凳面 0.34 上方 0.26m、含浪舌离地 0.5m）/ 吊索到 5.13），绕长凳中心 (9,21.9) 半环 r=2.9、张角 140°（开口朝南），相邻弦距 1.744m、净隙 0.644m；参数唯一真源 `domain/gallery.ts → SEA_RIBBONS / ribbonSlots()`。**玻璃海材质已落地**：自定义 ShaderMaterial（`SEA_VERT / SEA_FRAG`）——纵向四段水色（深海青 #0a4f63 → 青 #1ea3a8 → 玻璃青 #6fdde2 → 白沫 #eafbff，顶端轻白化）、浪花高光带 1.9 rad/s 向上推进（5 条相位错开）、菲涅尔边缘 #d8f7fb、α 0.72 起步；几何为微卷边截面（弦宽 1.1m / 弧深 0.155m）+ 纵向扭转 0.30rad + 侧摆 0.30m（顶固定、底最大）+ 底边浪舌 + 顶部 18% 锁定贴吊索。`?quality=perf` 冻结 uTime。全装置不加光源、不进 Octree、不占挂位。

其余沿用 v5：精选 **60** 幅上墙（库 148 全保留，每厅 15）、白盒美术馆视觉、香槟钛银画框、一体化厅号导视牌、全馆冷银白灯带；高厅 18×13×5.2 / 门厅 5.0 / 暗廊 4.0，动线 ≈104m。

## 2. 环境与命令（接手第一道坎：Node 不在默认 PATH）

- Node 为官方二进制手动安装：`~/.local/node`，PATH 已写入 `~/.zshrc`。
- **非交互 shell（自动化 agent）必须先**：`export PATH="$HOME/.local/node/bin:$PATH"`，否则 `npm` 报 command not found。
- npm 镜像：`.npmrc` → `registry.npmmirror.com`。
- 实际版本（package.json 已升，旧文档写的 React18 已过时）：
  node 见 `~/.local/node`；vite 8.3、react 19.3、three 0.186、@react-three/fiber 9.8、@react-three/drei 10.7、zustand 5、typescript 7、vitest 5。

| 操作 | 命令（项目根执行） |
|---|---|
| 装依赖 | `npm install` |
| 开发服务 | `npm run dev` → http://localhost:5173 |
| 构建（含 tsc） | `npm run build` → `dist/` |
| 单测 | `npm run test`（69 个用例，全绿是底线） |
| 生产预览 | `npm run preview` |
| 素材处理 | `node scripts/prepare-assets.mjs`（macOS，依赖系统 sips；无参=全量 148 张） |
| 平面图重生成 | `node scripts/gen-floorplan.mjs` → `public/floorplan.svg` |

已知无害警告：`npm ls` 报 drei 依赖 stats-gl 期望 three@0.170；实测不影响运行，勿为此降级 three。

- **`vite.config.ts` 的 `base` 已改为 `'./'`（v8.1/T4）**：同一份 `dist` 既可在根路径（本地离线包）运行，也可直接放到 GitHub Pages 子路径（`/repo/`）运行；所有资源引用均走 `import.meta.env.BASE_URL`，禁止在代码里写死 `/xxx` 绝对路径。

## 3. 浏览器 QA 参数（调试/验收必备）

| URL | 作用 |
|---|---|
| `/` | 正常入场（intro 遮罩 → 点击进入） |
| `/?artview=0..59` | 跳过 intro，相机直接站到第 n 幅画前 2.9m |
| `/?focus=0..59` | 直接进入大图飞行模式（程序化验证翻幅链路用，**不能替代真实点击测试**） |
| `/?cam=x,z,yaw[,pitch]` | **v6 新增**：任意机位（验收门洞/拱门）。例：`?cam=33,3,-1.5708` 入口拱、`?cam=1.2,9,3.1416` CW 南拱、`?cam=26,11.8,1.5708` 暗廊门 |
| `/?portal=gallery\|monumental\|layered` | **v6 新增**：切换三档拱门预设（默认 gallery） |
| `/?fps=1` | 右下角 FPS 读数 |
| `/?quality=perf` | 性能档：dpr=1、关抗锯齿、关 Bloom/反射/后期 |
| `/#spike` | 早期技术 Spike 试验场（SpikeHost），非交付路径 |

验收真机：用系统 Chrome（硬件加速开启）。内嵌/沙箱预览容器是 SwiftShader，建不了 WebGL，属容器限制不是应用 bug。

## 4. 文件地图与职责

```
gallery3d/
├── index.html                    # 挂载点
├── vite.config.ts                # 裸 Vite + react，无别名无代理
├── scripts/
│   ├── prepare-assets.mjs        # 素材管线v2：~/Downloads/摄影作品 分类扫描 → public/photos 三级输出 + manifest v2（sips，仅 macOS）
│   └── gen-floorplan.mjs         # 从领域模型生成 SVG 平面图（与 gallery.ts 同源）
├── public/
│   ├── manifest.json             # 展品清单 schemaVersion 2（id/src/srcLo/srcHd/widthPx/heightPx/orientation/category/theme/hall）
│   ├── floorplan.svg             # 平面图（生成产物，勿手改）
│   └── photos/                   # 148 张三级输出：art_NN.jpg(2048q92) + lo/(1024q80) + hd/(4096q92)
├── src/
│   ├── main.tsx                  # React 19 createRoot（StrictMode 双挂载，注意副作用幂等）
│   ├── App.tsx                   # 路由分流：#spike → SpikeHost；其余 → GalleryScene
│   ├── domain/gallery.ts         # 【核心】空间/墙/门洞/挂位/动线 纯数据+纯函数；PORTAL_PRESETS 拱门三档、定距挂位 evenSlotsOnWall、doorViolations 越界断言
│   ├── domain/themes.ts          # 四厅主题（LUMEN）：H1香港故事暖金 / H2双城纪事品红 / H3海与港冷青 / H4林间生灵翠绿 + NEUTRAL
│   ├── domain/gallery.test.ts    # 31 个领域测试
│   ├── state/player.ts           # zustand UI 状态：mode(intro/walk/focus)、zone、focusIndex；+ 模块级 playerPose/dragState 命令式对象
│   ├── three/
│   │   ├── GalleryScene.tsx      # Canvas 根：9盏真光源(白环境光+中性顶光+FocusSpot随行射灯)、ACES曝光(focus渐变1.15)、dpr 1.5/focus解封2、Bloom阈值0.92+Vignette（perf档关闭）、FrameloopGuard
│   │   ├── GalleryWorld.tsx      # 白盒世界+v6参数化圆拱PortalFrames(一洞一环ExtrudeGeometry单mesh:拱环0.14骑缝0.02+拱上封墙WALL_T齐平,共享墙去重,拱顶全馆统一3.5,暗廊净高4.0)+一体化HallSigns导视牌+**v9 H2 中庭 Colosseum 斗兽场模型**+**v8.1 H3 海元素 SeaRibbons（玻璃海·加长至凳前）**；白清水混凝土程序纹理墙/浅灰微反射地/发光天棚凹槽灯箱/冷银白灯带/深灰路线嵌线/灯轨/长凳（H1/H3/H4，H2 换基座）
│   │   ├── env.ts                # 【v6】程序化 RoomEnvironment → PMREM 环境贴图（离线），只给金属材质（画框/拱门套），根治高 metalness 无 envmap 发黑
│   │   ├── Artworks.tsx          # 装裱作品：三级纹理按需加载(lo/mid/hd)+dispose释放；香槟钛银拉丝框+纯白卡纸+8mm阴影缝+画上射灯光斑；直接消费 loadPlacements 结果（禁止二次 pickPlacements）；点击用 onPointerUp
│   │   ├── Player.tsx            # 【最复杂】自持 yaw/pitch 相机、模式矩阵、WASD+碰撞、大图飞行插值、P 自动巡游、QA 机位
│   │   ├── collision.ts          # three 官方 Octree + Capsule 世界（墙+DECOR_BOXES 家具/展品基座+地+顶）
│   │   ├── placements.ts         # manifest → 精选 60 张上墙（wallCapacityOnWall 容量 + SELECT_CAP=16 防御值；fitPhoto 零裁剪）；cameraStand 大图机位
│   │   ├── placements.test.ts    # 布展测试（60张/每厅15/无重复/零裁剪/画框距门洞≥0.2/挂距≥2.63/框边净隙≥0.6）
│   │   └── labels.ts             # CanvasTexture 离线文字面片（不依赖网络字体/troika）
│   ├── ui/HUD.tsx                # intro 遮罩、区名、小地图(canvas rAF)、大图底栏、出口提示、FPS
│   ├── styles/global.css         # 全屏无 margin
│   └── spike/                    # S1-S4 技术 Spike 与其测试（zoning/spotMath/snap/poses，共 23 个测试）
└── docs/
    ├── MASTER.md / spec.md / plan.md / design-system.md / GLOSSARY.md   # Phase 0-2 文档（部分结论已被覆盖，见 §5）
    ├── exhibition.schema.json    # 展览配置 JSON Schema（全量布展期启用）
    ├── adr/0001..0007            # 早期架构决策（注意 §5 覆盖）
    └── handoff/                  # ★ 交接包：AGENTS.md / RETROSPECTIVE.md / NEXT-STEPS.md
```

## 5. 现行口径覆盖表（旧文档以下内容已作废）

| 主题 | 旧口径（勿再引用） | 现行口径 |
|---|---|---|
| React | React 18 | **React 19.3** |
| 碰撞 | 自研 AABB（ADR-0003） | **three 官方 Octree + Capsule(r=0.35)**，沿法线滑动（AABB 对角碰撞双轴归零卡死） |
| 视角控制 | PointerLock | **弃用 PointerLock**；baseYaw/pitch 自持 + YXZ 序 + 每帧强制 z=0；按住左键拖拽环视 + 鼠标位置微转 |
| 看画 | DOM 黑底 Lightbox（ADR-0006） | **相机在 3D 世界内飞行**到画前 0.6s easeOutCubic+结束帧硬锁；Esc 飞回原机位；点击用 `onPointerUp`（非 onClick，见铁律12） |
| 灯光 | 每幅作品一盏真 SpotLight | **真光源仅 9 盏**（白环境光0.85+白半球光+4厅中性顶光+入/出口2盏+FocusSpot 随行射灯1盏，≤12 预算）；"亮"靠发光天棚灯箱(toneMapped:false) + 每画射灯光斑(#f2f7ff additive) + FocusSpot 随行(35强度渐入) + 画心 emissive focus 0.5 + Bloom(0.92/0.3) + focus 曝光 1.15 |
| 视觉基调 | 样片版暗黑简约 / LUMEN 曜黑 | **v3 白盒美术馆，v4 银边玻璃导视牌，v5 罗马半圆拱，v6 拱门统一抬高 + 金属环境反射**：白清水混凝土程序纹理墙(rough0.92)+浅灰微反射地(mirror0.18)+发光天棚凹槽灯箱(#efede6)+每画射灯光斑(#f2f7ff)+**香槟钛银拉丝画框(#c3bdb2 metal0.72/rough0.34 + RoomEnvironment envMap)**+**纯白卡纸 #ffffff + 8mm 阴影缝 #4b4741**；**冷银白灯带 #eef4ff**（顶灯带1.0/踢脚0.75，全馆统一）；**v6 圆拱门套 #43464d metal0.45/rough0.6**（一洞一环 ExtrudeGeometry 单 mesh：**拱环宽 0.14**、骑缝突出 0.02、拱上封墙 WALL_T 齐平·无板缝纯色 #ecebe7，**拱顶全馆统一 3.5m**——主门 r1.5 起拱 2.0、暗廊 r0.9 起拱 2.6；共享墙按墙平面去重）；**一体化导视牌 v4 C 方案**：暖白背板 #f4f2ec + 亮银细框 MeshBasic #b3ada2 + 2048×410 Canvas；四厅主题色仅存于导视牌厅号与暗廊指路字 |
| 布展 | 每厅 U 型三面墙 3 幅（12 样片）/ 全量 148 张 / v3 96 / v4 72（间距 2.15 画心距）/ v5 60（净隙 0.35，逐墙自适应） | **v6 精选 60 幅，全馆统一中心距 `HANG_PITCH=3.5`**：不再用「净长/count」逐墙拉伸（v5 因此并存 2.67/3.02/3.37/3.70 四种间距）；k 个挂位占 (k−1)×3.5 并在实墙段内居中，余量全部转为端部留白；容量 = Σ(floor((段长−**2×EDGE_KEEP**)/3.5)+**1**)，EDGE_KEEP=**1.45** → 四厅各 **15**，SELECT_CAP=15，总 60；**画框外宽口径收敛为 `FRAME_BORDER=0.12`（单边白卡纸0.09+框梃0.03）**，`frameOuterW(1.9)=2.14`，最窄框边净隙 **1.36m**（v5 注释写 1.96、实际 2.14，最窄只有 0.53m）；fitPhoto 零裁剪（竖高2.1/横宽1.9，MAX盒2.4×2.3 内等比缩小）；画心高 **1.65**；门洞缓冲=(d.w??1.8)/2+**1.45** |
| 纹理 | 单级 2048/q88 全量加载 | **三级按需**：lo 1024/q80（蛇形相邻厅）+ mid 2048/q92（所在厅）+ hd 4096/q92（大图模式按需）；activeHalls 分区策略 + dropTex 释放显存 |
| manifest | schemaVersion 1（12张轮转分厅） | **schemaVersion 2**：老板分类目录→四厅映射（H1香港故事44 / H2双城纪事42 / H3海与港36 / H4林间生灵26）；148=实际图片数（此前口径152系误计.DS_Store） |
| 编辑模式 | edit(Orbit)↔walk 双模式 | **仅漫游侧**；编辑布展是后续任务 |
| H3 背景墙 | 无（白墙留白） | **v8**：北墙背景保持留白；艺术元素改为**绕长凳悬垂的 5 条海浪丝带**（顶 5.02 / 底 **0.6**（v8.1 垂到凳面上方 0.26m、离地 0.5m）/ 吊索至 5.13；半环 r2.9、张角 140°、弦距 1.744、净隙 0.644）；**玻璃海 ShaderMaterial 已上**（#0a4f63→#1ea3a8→#6fdde2→#eafbff + 流动高光带 + 菲涅尔边缘，perf 档冻结）；微卷边截面 + 扭转 + 侧摆 + 底边浪舌；不新增光源、不进碰撞、不占用挂位 |
| H2 中庭陈设 | 长凳（2.6×0.34×0.8） | **v9**：长凳整件移除，改为**罗马斗兽场椭圆建筑模型 + 椭圆基座 + 展签**。尺度：外廓半轴 a=2.6 / b=2.15（ratio 1.209 ≈ 真实 1.205）、基座 plinthA=2.82 / plinthB=2.37 / 高 0.34、**总高 2.54m ≤ 遮挡红线 2.6**、竖向 dwarf=1.657（相对真实 188×156×48m 的 1:36.2 外廓压缩）；三层拱券每层 **40 跨**（bayChord 0.374、净洞 0.269、起拱 0.24、拱顶 0.374）+ 顶层阁楼 0.4（40 方窗）+ 4 道檐口 + 7 级 cavea + arena 盘 + 品红细环 + 南沿斜置 18° 展签；参数唯一真源 `domain/gallery.ts → H2_COLOSSEUM / colosseumMetrics()`；**0 新增光源、0 网络贴图（石灰华 256² 程序纹理）、≈11 draw call**；碰撞由 `DECOR_BOXES` 基座盒接管 |
| 入口位置 | 早期其他布局 | **入口在右侧**，四厅左右各二（2×2 组团蛇形），见 floorplan.svg v5 |

## 6. 关键领域事实（改布局前必读）

- 坐标系：x 东、z 北、y 上，单位米；地面 y=0；眼高 1.7；厅 18×13×**5.2m**；门厅高 **5.0**；暗廊横向净宽 **2.4**、净高 **4.0**（v6，原 1.8/3.6）；用地 45.8×28.4m。
- 门洞 per-door：`Door.w?`（默认 1.8 暗廊门；主门/厅口/出口 **w:3**）；wallRuns/wallCapacityOnWall/碰撞/门套全部按 per-door 折算。
- **门洞不变量（v6 新增，`doorViolations()` + 单测钉死）**：`w/2 ≤ at ≤ 墙长−w/2`（门洞不越界）且 `at±(w/2+ring)` 也在墙内（拱环不绕出墙角）。v5 有 3 处违反：CW 南/北门洞东侧 −0.3m、H4 出口门南侧 −0.3m。
- 门洞渲染（v6）：wallBoxes 无门楣（门 runs 开到墙全高），拱肩与拱上封堵全靠 PortalFrames 的拱环+archFill；**拱顶全馆统一 3.5m**，两级洞宽→同一拱门家族（主门 w:3→r1.5/起拱2.0，通道 w:1.8→r0.9/起拱2.6）；拱环宽 0.14、骑缝 0.02；碰撞零改动（拱环/fill 不进 Octree，只收 wallBoxes+DECOR_BOXES）。
- 唯一布局源：`src/domain/gallery.ts` 的 `SPACES`。改它 → 重跑 gen-floorplan → 建筑/碰撞/小地图/挂位全自动跟随（注意 gen-floorplan.mjs 独立复制了一份坐标数据，需同步）。
- 拱门预设：`PORTAL_PRESETS` 三档（gallery 默认 / monumental / layered），`?portal=` 切换；**加深拱顶时必须同时检查 `apex + ring ≤ CORRIDOR.height`**（测试已断言）。
- 挂位：**v6 定距制**——容量 = Σ(floor((实墙段长−2×**1.45**)/**3.5**)+1)（段长 < 2×1.45+3.5 的窄段跳过），SELECT_CAP=**15**，按观展墙序填充（每厅恰 **15**：H1 S5/W3/N5/E2、H2 N4/W3/S5/E3、H3 W3/N5/E3/S4、H4 N5/E2/S5/W3，总 **60**）；evenSlotsOnWall 按 3.5m 定距居中，**count 小于容量时不拉伸间距**（余量留白）。
- 动线：`ROUTE` 门心折线（全程 ≈104m），自动巡游(P)沿它走；`SPAWN=(44.2,1.7,3)` 朝西；出口段 `z=17.4`（v6，原 16.6）。
- 作品尺寸：竖幅高 **2.1m**、横幅宽 **1.9m**；画心高 **1.65m**；**画框外宽 = 画心 + 2×`FRAME_BORDER`(0.12)**；挂距（v6）：同墙相邻**中心距恒为 3.5m**，最窄框边净隙 **1.36m**；画框边缘距门套/墙角 ≥**0.2m**（EDGE_KEEP=1.45 保证）。
- 大图机位 cameraStand y=1.65；画框锚定 FRAME_CY=1.65；focus 大图 dpr 解封 min(dpr,2)+曝光1.15+真射灯随行。
- manifest 分厅映射（老板分类目录）：H1=香港故事44 / H2=澳门故事+城市艺展+城市建筑42 / H3=海边时刻+维多利亚港+无人机视角36 / H4=绿林秋色+秋天落羽杉+池中漫舞火烈鸟26；库 148 全保留（精选 60 + 落选 88）。

## 7. 开发铁律（来自实战，见 RETROSPECTIVE.md）

1. 领域变动先改 `domain/gallery.ts` 并跑 `npm run test`，禁止在 3D 组件里硬编码坐标。
2. 相机姿态只有 Player 一个写入口；任何改动后确认 `rotation.order='YXZ'` 且 z=0（roll 污染有前科）。
3. R3F 交互事件挂在**最小公共祖先 group**，不要挂被遮挡的子 mesh。
4. 禁止用 JS 合成 pointer 事件验证 R3F 点击——raycast 不认；用真实浏览器点击或 QA 参数。
5. 性能结论先排除宿主节流：测 FPS 前先量空页面 rAF 节拍（本机自动化容器仅 42Hz）。
6. 真光源数量是硬预算（≤12，当前 8）；要亮先加假光/自发光，不加灯。
7. 文字一律 CanvasTexture 面片，禁止引网络字体/troika（离线交付）。
8. 交付物要求离线可跑：不允许任何运行时外网请求（字体/CDN/贴图域名）。
9. **R3F 材质条件分支切换 props 不触发 shader 重编译**（USE_MAP 宏缺失 → map 绑了也不采样，渲染成平色板）。有 map/none 切换的场景：单材质元素全量声明所有 props + `material.needsUpdate = true`（useEffect 驱动）。2026-10-20 曾致 148 张画心全灰。
10. 纹理换级（mid→lo 等）必须 `dispose()` 旧纹理释放显存；显存账：本厅 mid 44×32MB + 邻厅 lo 42×8MB ≈ 1.75GB，设计内。
11. glowMat 发光面片公式：`MeshBasicMaterial + color×亮度系数 + toneMapped:false`，亮度系数 >1 才能越过 Bloom 阈值 0.92 发光（v3 发光天棚 #efede6 大面压在阈值下不炸，冷银白灯带 #eef4ff 越阈发光）；作品画心 emissive 常态 0.06、focus 0.5（lerp 平滑）。
12. **R3F 点击用 onPointerUp 不用 onClick**：onClick 要求 down/up 两次 raycast 命中一致才派发，鼠标微转/帧间漂移会静默丢点击（v2「点击无法定位」根因之一）；onPointerUp+dragState.moved 门禁等效且免疫。2026-10-20 修复。
13. labels.ts 文字面片 `side: FrontSide`（反字根治）；透明导视必须配实体背板（GalleryWorld sign+backing 6mm 间隙防 z-fight）。
14. **无 envmap 的场景中高 metalness MeshStandardMaterial 必发暗**（镜面 F0 反射暗环境，环境越亮对比越黑）。装饰性金属细件（导视牌框等）改用 `MeshBasicMaterial(恒定色)`——不受光照拖累、视觉稳定；亮度压在 Bloom 阈值 0.92 下即不发光。2026-10-20 导视牌银框两轮返工的根因。
15. **Shape/ExtrudeGeometry 带弧线路径必须「沿弧线开洞」构成简单多边形**（左 downside→弧线→右 upside→顶边 closePath）：先上后横再 closePath 会产生贯穿对角边，填充区缩水+对角薄片伪影（v5 archFillGeometry 拱肩漏光根因）。且 absarc 顺时针约定 `absarc(0,spring,r,π,0,true)`=π→0 过弧顶。拱上封墙材质必须用**无板缝纯色**（混凝土贴图 0.5m 板缝经世界坐标 UV 映射会落门洞轴线）、厚度取整墙 WALL_T 齐平（薄板悬墙中面掠射角露细缝线）。2026-10-20 v5 首轮 QA 实测两连根因。

16. **同一个布展结果只能算一次**：`loadPlacements()` 内部已调用 `pickPlacements`；组件若把结果再喂回 `pickPlacements`，二次分配的另一套规则会覆盖第一次的容量约束（v5 按墙长比例分配，可把 5 幅压进只能放 4 幅的墙）。直接消费 `Placement[]`。凡是「渲染用的尺寸口径」和「布展校验用的口径」都必须是**同一个导出常量**（`FRAME_BORDER` 就是这么来的：v5 注释 1.96 / 实际 2.14，导致净隙少算 0.18m）。
17. **门洞不是只校验"两侧对位"**：对位测试只能证明两扇门在同一个位置，不能证明这个位置在墙里。必须同时断言 `at ± w/2` 与 `at ± (w/2+ring)` 落在 `[0, 墙长]` 内（`doorViolations()`），否则门洞会开进封闭暗腔 —— 表现为"门洞里有一道墙""拱腿悬空"。
18. **无 envmap 的场景里 metalness > 0.5 一律视为 bug**（铁律 14 的量化版）：`#c3bdb2 / metal 0.85` 实测渲染成 (34,32,28)。金属件要么用 `MeshBasicMaterial`，要么挂 `RoomEnvironment → PMREM` 的 envMap（`src/three/env.ts`，离线）。加完 envMap 记得 `material.needsUpdate = true`。

## 8. 当前验收状态（2026-10-26 · v9 H2 中庭斗兽场；v6 拱门验收基线保留）

- `npm run build` 通过（exit 0）；单测 **65/65** 通过；`floorplan.svg` **v6** 已重生成（15/厅×4=60、出口门 z=17.4）。
- **拱门档位已拍板（2026-10-20）**：**A · 高拱（`gallery`，拱顶全馆统一 3.5m）为交付口径**。代码默认档即 `gallery`，交付路径不依赖 URL 参数；`?portal=monumental|layered` 仅作 QA 对比开关，三档并存可复现对照、不计为并行旧镜像。设计依据见 `docs/DESIGN-PORTALS.md`。
- **v6 三项修复闭环**：
  ① **门洞越界**：CW 横向 1.8→2.4（三条暗廊统一 2.4，1.8m 门洞两侧各 0.3m 墙垛）、H4 出口门 z 16.6→17.4（南侧 0.5m 墙垛）、EXIT/ROUTE/文字/平面图同步；新增 `doorViolations()` + 3 组单测，越界会直接编译期/测试期报错。
  ② **挂位间距统一**：`HANG_PITCH=3.5` 定距居中，取代 v5 的逐墙均摊；全馆实测中心距恒 3.5m，最窄框边净隙由 **0.53m → 1.36m**；删除 `Artworks` 的二次 `pickPlacements`。
  ③ **拱门统一抬高**：拱顶 3.2→**3.5m**（1:1.17）、暗廊净高 3.6→**4.0m**、拱环 0.12→0.14；三档预设可 `?portal=` 切换；设计说明书见 `docs/DESIGN-PORTALS.md`。
- 另修视觉缺陷：画框 envMap（原来近黑）、白卡纸纯白 + 8mm 阴影缝（原来与墙面同亮度不可见）。
- 静态几何自检（脚本核算，非真机）：全部 10 扇门的门洞/拱环均在墙段内；四厅挂位 15/15/15/15；每厅容量 15。
- **headless 目视 QA（2026-10-20 21:40，真 GPU · Chrome CDP 截图）**：`?cam=33,3,-1.5708` 入口拱 = 圆拱完整、拱环无缺口、门内可见下一道拱成序列；`?cam=1.2,9,3.1416` CW 南拱 = 两侧各 0.3m 墙垛、拱环不绕墙角、无穿墙/白柱；`?cam=26,11.8,1.5708` 暗廊门同 PASS；`?artview=0` 画框修复已确认（香槟钛银框 + 纯白卡纸清晰可辨，不再是近黑框/隐形卡纸）。
- **仍需老板本机终验**：标准档 ≥45fps / `?quality=perf` ≥30fps、真实指针点击作品定位手感（三档取舍已拍板 A，无需再比）。
- **v8.1 加长（2026-10-26，老板验收「满意但略短」后拍板）**：`SEA_RIBBONS.bottomY` 2.05→**0.6**，丝带净长 2.97→**4.42m（+49%）**，下沿垂到长凳面（0.34）上方 0.26m、含底边浪舌最低 0.5m（离地清扫净空 0.5m）；环距凳心 2.9m、最内缘 2.35m ≫ 凳半长 1.3m，侧摆最坏 0.3m 后仍有 ≥0.69m 净隙，**不穿凳、不穿地**。单测 **69/69**、`npm run build` exit 0（**`dist/assets/index-BLKecpDn.js` 1,319.10 kB / gzip 365.33 kB**）；headless 真 GPU 三机位复查：`?cam=9,16.4,3.1416,0.02&qa=11`（正视全景，丝带纵向贯通、下端悬于凳前）、`?cam=9,19.2,3.1416,0.05&qa=12`（近景，底边浪舌不触地）、`?cam=14.4,19.6,2.28,0.06&qa=13`（斜侧，无穿凳/无遮画主体）；控制台仅 1 条框架级 `THREE.Clock deprecated`。
- **v8 悬垂海浪丝带（2026-10-26，玻璃海材质已上，老板拍板冻结）**：单测 **69/69** 通过（v7 的 5 条 SEA_ACCENT 断言已删，新增 4 条 SEA_RIBBONS 断言：5 条半环均布且弦距一致、净隙=弦距−带宽 ≥0.5、下沿垂到凳面上方且离地 ≥0.4、上沿低于灯头 5.09/天花 5.2/吊索 5.13、全部落在天棚发光板投影内）；`npm run build` exit 0（**`dist/assets/index-B-79QL2i.js` 1,319.10 kB / gzip 365.34 kB**）；headless 真 GPU 目视四机位复查：`?cam=9,17.6,3.1416,0.12`（正视）、`?cam=15.5,19.5,2.01,0.12&qa=2`（斜侧）、`?cam=9,21.5,3.1416,0.25`（凳心仰视）、`?cam=9,17.6,3.1416,0.12&quality=perf&qa=3`（性能档）—— 色调/卷边/流动带成立，无色偏、无黑屏、无穿墙、无遮画；控制台仅 1 条框架级 `THREE.Clock deprecated` 警告。**老板已拍板**：维持现档（ShaderMaterial + 菲涅尔），**不升级 MeshPhysicalMaterial 物理玻璃**；v8 在此冻结。**仍挂账**：本机终验帧率（标准档 ≥45fps / perf ≥30fps）与真实指针点击手感。
- **v8.1/T4 离线交付包（2026-10-26，已验收）**：产出在项目外的 `/Users/huang/TRAEWORK/gallery3d-offline/`，含 `app/`（dist 拷贝，449 文件 / 615.6MB）、`serve.mjs`（零依赖 Node 静态服务器，127.0.0.1:8088，含目录穿越防护与 EADDRINUSE 提示）、`启动.command`（双击即启动，优先 node、回落 python3，自动开浏览器）、`使用说明.txt`。**不可双击 index.html 直接打开**：file:// 下 `fetch(manifest.json)` 被跨域策略拦截、ES 模块无法从本地文件加载，必须走本地服务。验收：curl 6 条路由 200 + MIME 正确、`/../` 越权 404、headless 真 GPU 截图与 4173 一致、控制台 0 error（补 `<link rel="icon" href="data:,">` 消除 favicon 404）。单测 69/69、build exit 0（`index--H7yCMx0.js`）。
- **GitHub Pages 可行性结论（2026-10-26 评估，未部署）**：技术可行——`base:'./'` 已就绪；单页应用、路由走 hash，无 Pages 深链 404 问题；单文件最大 2.1MB，远低于 100MB 硬限。瓶颈是**体积**：全量站点 615.6MB，对 Pages「发布站点 ≤1GB」只剩 38% 余量；若源码仓（含 `public/photos` 615MB）与部署分支（258MB）并存，合计 ≈1.1GB 会触发 GitHub 仓库体积提醒与慢克隆。推荐**瘦身 web 版**：去 hd 4096、聚焦回落到 mid 2048 → ≈258MB；源码仓 `.gitignore` 掉 `public/photos`，仅 `gh-pages` 分支承载站点产物。前置：删除 hd 目录当前会导致大图白屏（`Artworks` 加载失败只 resolve(null)，无回落），瘦身必须先把回落逻辑补上。环境现状：gh CLI 未安装、项目尚未 `git init`。
- **v9 H2 中庭斗兽场（2026-10-26，老板拍板 B 档「压缩比例·完整四层」+「椭圆基座＋展签」，待本机终验）**：`H2_COLOSSEUM` + `colosseumMetrics()` 单源（半轴 2.6/2.15、基座 2.82×2.37×0.34、总高 **2.54m**、40 跨/层、bayChord 0.374、dwarf 1.657），拱券以**真实米制** ExtrudeGeometry 单跨 × 120 实例（1 draw call，非等比缩放会把半圆拱压成尖拱——已踩坑）；阁楼椭圆环墙 + 40 方窗 + 4 道檐口 + LatheGeometry 7 级 cavea + arena 盘 + 品红细环 + 南沿斜置 18° 展签；**内圈环廊墙**（r=0.88 外廓，深灰华 #9a9184）让拱洞后是石墙而非白展厅墙，撑起实体厚度感；基座外沿 1 draw call 接触暗环。单测 **74/74**、`npm run build` exit 0（`dist/assets/index-BmqS9yzC.js`）；headless 真 GPU 四机位复查：`?cam=16.4,11.8,1.5708,0.03`（东门入场，模型占右侧画面、展签可读）、`?cam=14.6,10.2,0.987,0.05`（斜 3/4，三层拱券/阁楼方窗/落地接触线成立）、`?cam=9,11.0,0,0.16`（近景仰视，拱洞内为深色环廊墙、无白纸板感）、`?cam=9,11.35,0,0.1`（模型主体特写）；控制台仅 1 条 `THREE.Clock deprecated`。遮挡复核：东门视平线 1.7 → 模型顶 2.54 / 距离 10.4 → 仰角 **4.6°**，低于北墙画顶 7.4°（余量 2.8°）；模型距动线 z=11.8 净距 **2.93m**。**仍挂账**：本机终验（帧率 + 真实指针点击手感 + 中庭模型近景观感）。
- 仍未完成：① 真机终验（帧率 + 真实指针点击）；② 暗廊过门 300ms 黑场（T2，仅 spike 里有实现，交付路径未接）；③ 177 张全量素材 / KTX2；④ hd 4096 目前由 mid 2048 放大；⑤ 编辑模式（T3）；⑥ GitHub Pages 部署（仅完成可行性评估）；⑦ hd 缺失时的 mid 回落（瘦身前置条件）。

