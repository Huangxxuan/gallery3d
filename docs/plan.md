# 3D 摄影展布展漫游系统 Implementation Plan

> **For agentic workers:** 用 subagent-driven-development（推荐）或 executing-plans 逐任务执行。步骤用 `- [ ]` 跟踪。纯 TDD 任务遵循"红→绿→提交"。

**Goal:** 交付本地运行的黑盒四厅 3D 摄影展：编辑模式拖拽布展调灯，漫游模式 WASD 看展，点击全屏看画。

**Architecture:** Vite + React + r3f。纯函数领域层（装裱/布局/碰撞/动线/配置）零 WebGL 依赖、全量单测；zustand store 为唯一数据源，形状等同 exhibition.schema.json；3D 层全部程序化几何，四厅按区加载。

**Tech Stack:** Vite 5/6、TypeScript、React 19、three（npm latest，预期 ^0.185）、@react-three/fiber ^9、@react-three/drei ^10、zustand、ajv、vitest、@testing-library/react、playwright；素材脚本 sharp + 系统 sips。**S0 负责锁定并记录实测兼容版本矩阵。**

**Spec:** docs/spec.md、docs/design-system.md、docs/GLOSSARY.md、docs/adr/、docs/exhibition.schema.json（执行者必须先读）。

## Global Constraints

- Node ≥20；包管理器 npm；锁版本必须提交 package-lock.json。
- 全部字体/three/addons/图标本地化，断网可运行；禁止 Google CDN、Draco CDN。
- 相框全展 A 款：框条 0.02m、卡纸 0.10m；画心中心高 1.50m；中缝 ≥0.6m。
- 射灯默认 intensity 1.4 / angle π/11 / penumbra 0.55 / decay 2 / 3500K / pitch 30°。
- 黑盒材质：墙 #161514(0.98)、地 #232221(0.4/反射10%)、天花 #0E0E0E、环境光 0.05、洗墙 0.12、雾 #121214 25–120。
- 纹理档 2048（L 4096）；原图永不直接入显存；性能：标准 ≥45fps、性能 ≥30fps。
- 任何拖拽必须有数值输入+键盘步进等价通道（WCAG 2.2 AA）。
- 图标仅 Lucide；零 emoji；零彩色灯；零 file:// 交付承诺。
- 无 Git 提交动作除非老板另行授权；任务"提交"步骤改为"请老板确认后提交或记录 checkpoint"。

## Review Focus（spec 未明写但最易出事的 5 点）

1. 同文件名"IMG_4523.JPG / IMG_4523 2.JPG"与大小写扩展名（.JPG/.jpg）：id 生成必须去重且稳定——T0 测试钉。
2. EXIF  Orientation=6/8 的 iPhone 照片：sharp/sips 输出必须按方向正立——T0 抽查竖拍样张 IMG_6288。
3. 门洞处圆-AABB：玩家必须能穿过门洞区间但不能从两侧墙进入——B3 用门洞边界用例钉死。
4. edit↔walk 频繁切换：位姿互相初始化，连续 20 次切换无 NaN/跳变——I1 测试钉。
5. 损坏/旧版 JSON 导入：给字段级错误与迁移结果，禁止白屏——B5 测试钉。

---

# 阶段 S：技术 Spike（可丢弃验证，先于正式编码）

### Task S0: 版本矩阵与脚手架冒烟
- [ ] `npm create vite@latest`（react-ts）；装 three/@react-three/fiber/@react-three/drei/zustand/ajv；记录实测版本到 docs/adr/0001 附录。
- [ ] 最小 Canvas 渲染一个盒子 + drei OrbitControls；`npm run dev` 与 `npm run build` 均通过。
- 验收：无 peer dependency 报错；build 产物可本地 http 打开看到旋转盒子。

### Task S1: 贴墙拖拽吸附验证
- [ ] Spike：射线击中墙面 → 求沿墙偏移 → TransformGizmo/拖拽位置被约束在墙面平面，拖入门洞区间时拒绝并回弹。
- 验收：作品无法被拖离墙面、无法覆盖门洞；结论写进 B2 接口备注。

### Task S2: Orbit↔PointerLock 相机互切
- [ ] Spike：两控制器互斥挂载，切换时以当前相机 position/quaternion 初始化对方，300ms 黑场覆盖。
- 验收：连续切换 20 次视角连续无跳变；PointerLock 拒绝时出现"点击继续"按钮。

### Task S3: 实时射灯 + 阴影参数
- [ ] Spike：单幅装裱 + SpotLight（默认参数），滑杆实时改 intensity/angle/色温；验证 shadow-normalBias 0.05 无痤疮。
- 验收：光斑覆盖卡纸外径 +10cm；调参肉眼可辨且无阴影瑕疵。

### Task S4: 四厅分区加载策略
- [ ] Spike：4 个几何厅，仅当前厅全质纹理+阴影、邻厅降级、远厅冻结；过门黑场切换。
- 验收：同帧 draw call/纹理内存随分区显著下降；切换无白闪。
- **Spike 门：** S0–S4 结论向老板口头汇报（5 分钟），确认后再进阶段 A。

---

# 阶段 T0：素材预处理

### Task T0: 素材管线脚本
**Files:** Create `scripts/prepare-assets.mjs`；产出 `public/photos/{full,thumb}/<id>.jpg` + `public/photos/manifest.json`
**Interfaces:** Produces `manifest.json: ArtworkManifestEntry[] = {id, fileName, widthPx, heightPx, orientation, ratioClass, textureTier, heicConverted, src, thumbSrc}[]`
- [ ] Step 1: 遍历 `/Users/huang/Downloads/摄影作品`，HEIC 先经 sips 转 JPG 临时文件；用 sharp 读宽高并 autorotate。
- [ ] Step 2: id 规则 `art_` + 小写文件名去空格去连字符；重名追加 `_2/_3`（断言钉 Review#1）。
- [ ] Step 3: 生成 full（长边 2048，quality 82）与 thumb（长边 320，quality 70）；29MP 等需要 L 档判定：规则=被自动初排放到主墙或手动指定（一期一律 2048，manifest 预留 textureTier 字段）。
- [ ] Step 4: 输出 manifest（177 条），打印成功/跳过计数；抽查 IMG_6288（竖拍 EXIF）方向正确。
- 验收：177 条记录、目录总体积 ≤220MB、manifest 可被 B5 schema 校验通过（schema 嵌入清单校验脚本）。

---

# 阶段 A：工程基座

### Task A1: 工程骨架与设计 token
**Files:** `index.html`、`src/main.tsx`、`src/App.tsx`、`src/styles/tokens.css`、`src/config/gallery.ts`
- [ ] 接入 self-host 字体（Archivo/Space Grotesk/JetBrains Mono woff2 放 src/assets/fonts，@font-face 本地化）。
- [ ] tokens.css 写入 design-system.md 第 3/4 节全部 CSS 变量与字号档。
- [ ] gallery.ts：四厅常量 rect=28×20×4m；每厅四面墙与门洞 openings（H1 入口、H1–H4 间 2m 暗廊连接，门洞宽 1.6m×高 2.6m）；装裱表 MOUNT_M 与 FRAME/TIER 常量。
- 验收：构建无外链请求（grep 构建产物无 fonts.googleapis/unpkg/jsdelivr）。

### Task A2: Schema TS 类型与样例配置
**Files:** `src/schema/types.ts`（手写对齐 JSON Schema）、`src/data/defaultExhibition.ts`
- [ ] 类型含 Exhibition/Artwork/Hall/Wall/Slot/Spot；字段名与 schema 逐字一致。
- [ ] defaultExhibition：空挂位的四厅 + settings 默认值。
- 测试（TS 编译即可，无运行时逻辑）：`tsc --noEmit` 通过。

---

# 阶段 B：领域纯函数（TDD 核心，先红后绿）

### Task B1: 比例归类与装裱尺寸
**Files:** `src/domain/ratio.ts`、`src/domain/ratio.test.ts`
**Produces:**
```ts
type RatioClass = '2:3'|'3:4'|'9:16'|'16:9'|'3:2'|'4:3'|'custom'
classifyRatio(wPx:number,hPx:number,tol=0.03):RatioClass
mountSize(rc:RatioClass,wPx:number,hPx:number,tier:'S'|'M'|'L'):{image:{w:number,h:number},outer:{w:number,h:number}}
```
- [ ] 测试断言（M 档）：2:3→image 0.80×1.20/outer 1.04×1.44；3:4→0.90×1.20/1.14×1.44；9:16→0.72×1.28/0.96×1.52；16:9→1.44×0.81/1.68×1.05；3:2→1.35×0.90/1.59×1.14；4:3→1.28×0.96/1.52×1.20。
- [ ] 测试：S=0.75×、L=1.35×；custom（如 1.586 宽幅）按短边对齐最近标准、长边按原比例，outer 恒含 +0.24（框0.02+卡纸0.10 双边）。
- [ ] 红→绿→vitest 全过。

### Task B2: 贴墙吸附/边界/冲突
**Files:** `src/domain/layout.ts`、`src/domain/layout.test.ts`
**Produces:**
```ts
snapToWall(p:{x:number,z:number}, wall:Wall):{offsetOnWall:number}
clampSlot(offset:number, outerW:number, wall:Wall):number   // 扣洞口与墙端
hasConflict(a:{offset:number,w:number},b:{offset:number,w:number},gap=0.6):boolean
autoLayout(artworks:Artwork[], halls:Hall[]):Slot[]          // 均分四厅逐墙排列
```
- [ ] 测试：点在墙前 3m 任意位置→offset 为垂足坐标；作品宽 1.04 在长 28m 墙→offset 钳制在 [0.52+扣洞口, …]；两幅中缝 <0.6 判定冲突；177 张 autoLayout 后四厅数量差 ≤1 且零冲突零越界（用 T0 manifest 跑）。

> **S1 Spike 结论（2026-10-05，已通过）**：原型 `src/spike/snap.ts`（snapOffset/nearestLegal，5/5 vitest）+ 浏览器实证。
> 1. 射线→墙面 mesh `worldToLocal(point)` 取沿墙坐标，链路可用，拖动实时坐标正确；
> 2. 合法性判定（墙端余量=外框半宽；与洞口区间严格不相交，临界贴边合法）已钉死，直接演进为 clampSlot；
> 3. **坑（正式实现修正）**：pointerup 不得只挂墙面——门洞黑平面/画框遮挡会吞掉松手事件导致状态悬挂。F3 拖拽一律挂 window pointermove/up + 每帧 raycaster 求交，OrbitControls 在 dragging 时 enabled=false；
> 4. 非法态视觉：框体 emissive 红 + 松手 nearestLegal 回弹，交互成立。

### Task B3: 圆-AABB 碰撞
**Files:** `src/domain/collision.ts`、`src/domain/collision.test.ts`
**Produces:**
```ts
type AABB={minX:number,maxX:number,minZ:number,maxZ:number}
buildHallBoxes(hall:Hall):AABB[]                // 墙减门洞 + 挂位外凸（厚度0.05+半径余量）
moveCircle(pos:{x:number,z:number},r:number,delta:{x:number,z:number},boxes:AABB[]):{x:number,z:number}
```
- [ ] 测试：直推撞墙→x 停在 r 距离；沿墙滑行→另一轴自由；门洞区间可穿过（Review#3）；画框前 0.35m 阻挡；分轴推进无穿透抖动。

### Task B4: 动线与翻幅顺序
**Files:** `src/domain/route.ts`、`src/domain/route.test.ts`
**Produces:**
```ts
walkOrder(exhibition:Exhibition):string[]   // H1→H4，厅内按墙面顺序+offsetOnWall
neighbor(slotId:string, order:string[], dir:1|-1):string|null
```
- [ ] 测试：顺序跨厅连续；首尾 dir 越界返回 null；空厅自动跳过。

### Task B5: 配置校验与迁移
**Files:** `src/domain/configIO.ts`、`src/domain/configIO.test.ts`
**Produces:**
```ts
validateExhibition(raw:unknown):{ok:boolean;errors:{path:string,message:string}[];data?:Exhibition}
migrate(raw:unknown):Exhibition   // schemaVersion 升级链；当前 1 直通
```
- [ ] 测试：合法样例通过（含 T0 manifest 装配的最小展览）；缺 artworkId、尺寸档非法、重复 slot id → 字段级错误；坏 JSON 不抛异常；v1 直通。

---

# 阶段 C：状态层

### Task C1: exhibitionStore + 撤销重做
**Files:** `src/store/exhibitionStore.ts`、`src/store/history.ts`、`src/store/exhibitionStore.test.ts`
**Produces actions:** `placeArtwork(artworkId, wallId, offset) / removeSlot(slotId) / moveSlot(slotId, wallId, offset) / setTier / setSpot / replaceExhibition / undo / redo`
- [ ] 测试：place 自动生成 slot+默认 spot（默认值逐字等于 Global Constraints）；remove 连带 spot；move 冲突时拒绝并返回原因；50 步历史上限；undo 链可回到初始。

### Task C2: 持久化与导入导出
**Files:** `src/store/persistence.ts`、`src/store/persistence.test.ts`
- [ ] debounce 500ms 写 localStorage（假时钟测试）；导出 JSON 文件下载（mock Blob）；导入走 B5，失败弹字段错误不覆盖现状态。

---

# 阶段 D：3D 黑盒空间

### Task D1: 程序化四厅构造器
**Files:** `src/three/Hall.tsx`、`src/three/Ground.tsx`、`src/three/Envelope.ts`（暗廊/门套筒口/踢脚线）
- [ ] 按 gallery.ts 常量生成墙/地/天花（BoxGeometry 拼装，洞口分段）、微反射地面（Reflector 强度 10%）、雾、环境光 0.05、入口洗墙 0.12。
- 验收：鸟瞰可见四个黑盒+暗廊串联；无模型网络请求。

### Task D2: 分区调度器（S4 结论落地）
**Files:** `src/three/ZoningManager.tsx`
**Produces:** `useActiveHalls(cameraPos):{full:string[], degraded:string[], frozen:string[]}`
- [ ] 当前厅 full、相邻 degraded（纹理 320 缩略/关阴影）、远端 frozen（无灯无纹理）；门区黑场 300ms。
- 验收：四厅满挂时任务管理器纹理内存不随 177 张线性增长。

> **S4 Spike 结论（2026-10-05，通过，浏览器四项全 PASS）**：原型 `src/spike/zoning.ts`（zoneFor/hallAt/detectCrossing/textureBudget/shadowCasterCount，8/8 vitest）+ `S4Scene.tsx`（四厅串联+走廊+黑场+自动巡游）。
> 1. 三级 LOD 状态机成立：active=全质+阴影+灯，adjacent=320 缩略，frozen=材质置深色且纹理释放；视觉上远厅自然隐入黑盒；
> 2. **内存账本实测**（2048² RGBA=16.0MB/幅，320² RGBA=0.39MB/幅，四厅×44=176 幅）：驻端厅 721.2MB、驻中厅 738.4MB，全量需 2.82GB——降幅 74%，且数值与 `textureBudget` 公式逐字节吻合；作品总数 44→176 预算仅增 2.4%（单测钉死 ≤2.5%），非线性目标达成；
> 3. 门区黑场 280ms、`detectCrossing` 仅在 厅→厅 跳变触发（途经走廊 null 不触发），自动巡游连切无白闪、无红错；
> 4. **D2 落地要点**：真实纹理用 `THREE.Texture.dispose()` + 引用计数按厅切换；邻厅缩略常驻（每厅 44 张仅 17MB）；切厅顺序=黑场开始→换 active→dispose 旧邻厅/加载新厅→黑场结束，加载放黑场窗口内避免白闪；
> 5. shadow 灯随 active 厅走（44 盏上限），与 S3 第 5 条联动；性能档全关阴影。

---

# 阶段 E：装裱与灯光

### Task E1: 程序化装裱组件
**Files:** `src/three/Frame.tsx`
- [ ] 框（四框条+厚度，#111110 m0.3 r0.4）、卡纸平面（#F2EFE8 r0.9）、画面平面（B1 尺寸）；纹理按 tier 加载；零拉伸（几何比=mountSize）。
- 验收：六比例+1 张 custom 各挂一幅，卡尺核对外径；缩略→全质替换无闪裂。

### Task E2: 射灯组件与灯随挂位
**Files:** `src/three/Spot.tsx`
- [ ] SpotLight + 灯筒小几何；target 锁画心；俯角 30°；光斑=卡纸外径+0.10m（由 angle/高度反推，写纯函数 `spotDistanceForCoverage` 放 E2 并单测）；性能档 castShadow=false。

> **S3 Spike 结论（2026-10-05，通过）**：原型 `src/spike/spotMath.ts`（ellipseAxes/aimGeometry/coversMat/kelvinToRgb，5/5 vitest）+ `S3Scene.tsx` 浏览器实证（暖光椭圆、实时滑杆、关阴影无红错）。
> 1. 参数直连 SpotLight 实时生效：intensity 1.4 / angle π/11 / penumbra 0.55 / decay 2 / 3500K；target 必须是加入 scene 的 Object3D（primitive 挂载），直接改 position 无效；
> 2. 覆盖数学：斜射光斑为椭圆，短径=2·d·tan(angle)，长径=短径/cos(倾角)。Spike 机位（墙前0.6m、上1.9m）d=1.98m/倾角73.3° → 短径1.16m、长径4.05m，覆盖 1.00×1.40+0.10 达标；angle≤π/20 即不达标（单测钉死）；
> 3. **与设计系统待对齐（E2 必须解）**：设计写「俯角30°」，若按灯头对水平面下压30°，灯位需在墙前约 3.3m、d≈3.78m，decay=2 下衰减显著，intensity 1.4 照度不足。E2 用 `spotDistanceForCoverage` 在「俯角30°+π/11+覆盖达标」约束下反推灯位与所需 intensity（必要时按平方距离补偿），出一版人眼校验表；
> 4. shadow-normalBias 0.05 + bias -0.0002 + 1024 map：当前机位 0 与 0.05 均未见痤疮，0.05 作正式默认冗余；
> 5. **性能关键**：177 盏灯各 1024 shadow map 不可行——只有当前厅的灯 castShadow（接 S4 ZoningManager），性能档全部 castShadow=false，已实证开关路径无报错；
> 6. 色温用 Tanner Helland 近似（kelvinToRGB），3500K 暖白观感正确。

---

# 阶段 F：编辑器

### Task F1: 三栏框架与顶栏
**Files:** `src/editor/TopBar.tsx`、`LibraryPanel.tsx`、`Inspector.tsx`、`StatusBar.tsx`、`src/App.tsx` 组装
- [ ] edit/walk 切换（接 I1 RIG）、性能档、导入导出、保存状态（"已保存/保存中"）；全部 token 化、Lucide 图标、焦点环可见。

### Task F2: 作品库
**Files:** `src/editor/LibraryPanel.tsx`
- [ ] manifest 缩略图、比例徽标、在展厅号；按厅/比例/文件名筛选；拖拽源写 placeArtwork；双击=挂到当前厅第一空位。

### Task F3: 墙面拖拽吸附 + 检查器双通道
**Files:** `src/editor/EditorGizmo.tsx`、`src/editor/drag.ts`、`src/editor/Inspector.tsx`
- [ ] 射线→B2 吸附→冲突红/绿反馈；TransformGizmo 仅沿墙平移+高度；检查器数值/↑↓步进（Shift×10）写同一 action；Del 摘画；Ctrl+Z/Y；选中黄铜描边+Gizmo 双通道。
- 验收：键盘可完成"选中→改高度→改尺寸档→摘画"全流程（WCAG）。

### Task F4: 自动初排与小地图
**Files:** `src/editor/autoLayoutAction.ts`（接 B2）、`src/editor/MiniMap.tsx`
- [ ] 一键 autoLayout 写入 store（可撤销）；H1–H4 键切厅；小地图显示厅轮廓/挂位点/当前视角；每厅数量与利用率（上限 45 红色）。

---

# 阶段 G：漫游

### Task G1: 第一人称控制器
**Files:** `src/walk/WalkControls.tsx`
- [ ] PointerLockControls；WASD/方向键地面移动（速度 3m/s，Shift 5.5m/s）；眼高 1.6；每帧 B3 moveCircle（AABB 由 buildHallBoxes 按当前+邻厅生成）；Esc 暂停遮罩"点击继续游览"+快捷键说明；PointerLock 拒绝有重试按钮。
- 验收：四厅全程不穿墙穿画；门洞双向可过。

### Task G2: 漫游 HUD 与性能档
**Files:** `src/walk/WalkHud.tsx`
- [ ] 准星、左下键位条、右下 Esc 提示、当前厅名（H1–H4 + 自定义名）；P 切性能档并在状态条/toast 明示。

---

# 阶段 H：全屏看画

### Task H1: Lightbox
**Files:** `src/lightbox/Lightbox.tsx`、路由数据接 B4
- [ ] walk 锁定态 Raycaster 点击挂位→黑底全屏 contain；标题/作者/拍摄信息缺省不渲染；←→/AD 按 walkOrder 翻幅；滚轮 1×/2×；Esc/点空白回原位姿与锁定态；打开期间暂停移动。
- 验收：从 H1 第 1 幅连翻至 H4 末幅顺序正确；退出站立点零误差。

---

# 阶段 I：模式整合

### Task I1: 相机 RIG 双模式
**Files:** `src/three/CameraRig.tsx`
- [ ] Orbit 与 PointerLock 互斥；切换互传 position/quaternion + 300ms 黑场；Orbit 限距限俯角防穿地。
- 测试：纯函数 `handoffPose(camera)` 往返 20 次无 NaN（单测）；肉眼零跳变（人工）。

> **S2 Spike 结论（2026-10-05，技术路径通过；黑幕淡出留人工目视 1 项）**：原型 `src/spike/poses.ts`（deriveWalkPose/deriveOrbitPose，3/3 vitest，20 轮互切无 NaN/朝向不翻转/步长有界）+ `S2Scene.tsx`。
> 1. **手势铁律**：`pl.lock()` 必须在点击事件的同步调用栈内——setTimeout(300) 后调用必报 `NotAllowedError: A user gesture is required`。方案：点击瞬间「瞬黑（transition:none+opacity:1）→ 同步重排机位 → 同步 lock()」，onLock 后再淡出；
> 2. **黑幕两帧坑**：同一 React 渲染里把 `transition:none→300ms` 与 `opacity:1→0` 一起提交，浏览器不跑首次过渡。必须先恢复 transition（opacity 仍 1），双 `requestAnimationFrame` 后再降 opacity；
> 3. `lock()` 在 three-stdlib 返回 Promise，拒绝为异步（try/catch 抓不住），必须 `.catch()` 兜降级遮罩（"点击继续/返回编辑"已实证可用）；
> 4. 两控制器常驻 + Orbit `enabled` 开关互斥，比条件挂载稳；相机经 `shared ref`（Canvas 桥接）供外部 UI 操作，勿在 Canvas 外用 useThree；
> 5. 房间必须封顶，否则仰角朝天看到 clearColor 穿帮（已在 Spike 补顶）；
> 6. 自动化浏览器 PointerLock 行为不稳定（合成鼠标/即时 unlock），**300ms 淡出与零跳变的肉眼验收放老板本机人工执行**，E2E 只覆盖 Orbit 态与降级菜单。

### Task I2: 编辑/漫游数据一致性
**Files:** `src/App.tsx`
- [ ] edit 改挂位/灯光→walk 即时反映；walk 中只读；厅区在两模式共用 ZoningManager。

---

# 阶段 J：验证与交付

### Task J1: E2E 关键流
**Files:** `tests/e2e/exhibition.spec.ts`（Playwright）
- [ ] 单条主流程：加载 8 张样例自动初排→拖 1 幅改位并核对检查器数值→切 walk→走过门洞进 H2→点开 Lightbox 翻 3 幅退出→刷新页面配置恢复。断言不含像素比对。

### Task J2: 性能审计与离线交付
- [ ] 1920×1080 单厅 40 幅录帧：标准 ≥45fps、性能 ≥30fps；四厅巡走一周无掉档崩溃。
- [ ] `npm run build`；断网用本地 http 打开 dist 走通主流程；勾选 design-system.md 第 8 节清单；README 只写运行命令（经老板同意后创建）。
- 验收门：Phase 5 双轴审查（标准+规格）通过后交付。

---

## 自检（writing-plans self-review）

- Spec 覆盖：用户故事 1–7→T0/F2；8–19→B2/F3/F4；20–24→E2/Inspector；25–31→I1/G1/G2；32–36→H1；37–41→C2/J2。无悬空故事。
- 类型一致性：Slot/Spot/Artwork/Hall/Wall 命名全文件对齐 schema；mount 尺寸字段统一 image/outer。
- Review Focus 5 点已在 T0/B3/B5/I1 落测试。
- 比例：纯函数给签名与关键断言值，3D 任务给验收而非代码，避免转录代码。
