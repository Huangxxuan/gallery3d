# gallery3d · 后续任务执行书（接手照此做）

顺序即优先级。每项含目标、动手位置、验收标准、预估耗时、风险点。
开工前先读 `AGENTS.md`，命令行先 `export PATH="$HOME/.local/node/bin:$PATH"`。

---

## T0 全量素材管线（177 张）—— 下一步第一项

- 目标：把 `~/Downloads/摄影作品`（177 张、约 1.06GB、含 6 HEIC）全部入展。
- 动手：
  1. `node scripts/prepare-assets.mjs 177`（sips 转码，估时约 3-8 分钟，单张 1-3s）。
  2. **分厅策略需决策**：现脚本按文件名排序轮流分厅（i%4），全量后每厅约 44 幅，而每厅仅 U 型三面墙各 1 个样片位。必须扩展布展算法：
     - 位置：`src/three/placements.ts` 的 `pickPlacements`；挂位池来自 `hallSlots()`（每厅 48 位，总 192 ≥ 177）。
     - 建议：先长边墙按挂位顺序布，竖/横幅混排时跳过尺寸冲突位；保留 U 型观展顺序（见文件内 U_WALLS 映射）。
  3. 压缩纹理：JPG 177 张 ×2048 长边，显存估算约 177×2048×1536×4B ≈ 2.2GB（超限）。必须做**分级纹理**：
     - 方案 A（推荐，工作量小）：生成 1024 长边 JPG 全量常驻 + 当前厅相邻厅用 2048；`Artworks.tsx` 按 zone 切换 src。
     - 方案 B：KTX2/Basis（需 toktx 或 gltf-transform 工具链，离线包体积增大，Mac/Linux 差异）。
  4. manifest 增加 `srcLow` 字段（与 schema `docs/exhibition.schema.json` 对齐）。
- 验收：177 张全部可在四厅走到并点开；显存占用浏览器实测 <1.2GB；构建通过、单测绿。
- 耗时：管线 0.5d + 分级加载 0.5d ≈ 1 人日。
- 风险：竖横幅混排与门位冲突；HEIC 色彩配置（Display P3）转 sRGB 后可能偏色，必要时 sips 加色彩同步。

## T1 真机帧率终验与性能收口

- 目标：1920×1080 系统 Chrome：标准档 ≥45fps，`?quality=perf` ≥30fps。
- 方法：`?fps=1` 分别在四厅中央、暗廊、大图模式各采样 10s；用 Chrome Performance 面板录主线程长任务。
- 已知基线：drawcall 130（样片），全量后预计随纹理/挂位上升；dpr 已封顶 1.5、隐藏页已停渲染（FrameloopGuard）。
- 若不达标，按此顺序优化：
  1. 非当前厅作品 `<mesh visible={zone 相邻}> ` 或 `frameloop` 级卸载；
  2. InstancedMesh 合并灯头/画框等重复几何；
  3. perf 档已关 AA/dpr=1，再关假光斑透明叠加（按距离淡入）。
- 耗时：0.5 人日（含真机排期）。
- 注意：不要再被宿主 42Hz 节流误导，先量裸 rAF 基线。

## T2 过门黑场 + 分区加载（ADR-0004 兑现）

- 目标：进暗廊过门时 300ms 黑场，切换期间卸载远端厅纹理。
- 动手位置：`Player.tsx` useFrame 中 `zoneAt` 变化处 → HUD 层黑场 div（CSS opacity 过渡）；纹理加载逻辑在 `Artworks.tsx`（配合 T0 的分级 src）。
- 验收：四厅间各走一次，黑场不晕、无白闪、内存回落；单测覆盖 zone 切换序列。
- 耗时：0.5 人日。

## T3 编辑模式（布展侧，ADR 原始需求另一半）

- 现状：样片只做了观众漫游；MASTER 里的"编辑模式拖拽布展/调灯"未开工。
- 动手要点：
  - 模式扩展：`state/player.ts` 的 mode 增加 `edit`；OrbitControls（drei）鸟瞰，禁第一人称移动。
  - 拖拽布展：raycast 挂位吸附（领域层已有 slotPose/挂位间距，spike/poses.ts 有早期吸附计算可复用）。
  - 调灯：spotPose 已预留灯位/朝向纯函数；编辑结果写 exhibition JSON（schema 已在 docs/exhibition.schema.json），localStorage 自动保存 + 导入导出。
- 前置：T0 完成后再做（没有全量作品，编辑器无意义）。
- 耗时：2-3 人日（建议独立 spec 审批后开工）。

## T4 离线交付包

- 目标：双击可看、无外网依赖的本地展览。
- 动作：
  1. `npm run build`；验证 `vite preview` 下全部资源相对路径可加载（图片/manifest 均为本地）。
  2. 文字已全 CanvasTexture（labels.ts），确认无网络字体回退。
  3. 交付目录建议：`release/gallery3d-dist-YYYYMMDD/`（dist 静态文件 + 启动说明.txt：`npx vite preview --port 8080` 或任意静态服务器；file:// 直开因 ES module 策略不可行，必须带 HTTP）。
- 验收：断网状态下新机器走完四厅 + 12 幅大图。
- 耗时：0.5 人日。

## 建议排期

| 顺序 | 任务 | 人日 | 门控 |
| --- | --- | --- | --- |
| 1 | T0 全量素材+分级纹理 | 1.0 | 老板先确认分厅/排序策略 |
| 2 | T1 真机帧率终验 | 0.5 | 必须真机，不接受宿主数据 |
| 3 | T2 黑场分区 | 0.5 | — |
| 4 | T4 离线交付包（样片→全量后重打） | 0.5 | — |
| 5 | T3 编辑模式 | 2-3 | 另立 spec 审批 |

## 给下一个 agent 的开工检查单

- [ ] `export PATH="$HOME/.local/node/bin:$PATH"` 后 `npm run dev` 能起
- [ ] 系统 Chrome 打开 `http://localhost:5173/?artview=0` 画面正常（非 SwiftShader）
- [ ] `npm run test` 41/41 绿
- [ ] 已读 AGENTS.md §5 覆盖表，不引用过时 ADR
- [ ] 改动领域模型后跑单测 + 重生成 floorplan.svg
- [ ] 交互改动用真实点击验，不用合成事件
