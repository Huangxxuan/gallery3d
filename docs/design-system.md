# 设计系统（Phase 0 终审版）

- 版本：v1.0（黑盒沉浸修订版，2026-10-05 终审通过）
- Design Read：专业创作工具（画布型产品），美术馆级克制暗色工具语言；Minimalism & Swiss（OLED Dark 分支）；VARIANCE 3 / MOTION 3 / DENSITY 7（漫游层 DENSITY 1）。

## 1. Pattern（结构模式）

产品型录命中：Drawing & Sketching Canvas（Procreate 型）—— Canvas focused / neutral canvas / dark tool panel。

唯一模式状态机：`edit ↔ walk`。

### edit 编辑模式
```
顶栏 48px：Logo │ edit/walk 切换 │ 性能档位 │ 导入 │ 导出 │ 保存状态
左栏 260px：作品库（全部作品缩略图，按厅/系列分组，拖拽源）
中央：3D 画布，OrbitControls 鸟瞰/环绕，选中作品显示 TransformGizmo
右栏 300px：检查器（位置/旋转/尺寸/画框只读规格/射灯参数/所属展厅）
状态条 28px：坐标 │ FPS │ 当前厅 │ 选中项 │ 操作提示
```

### walk 漫游模式
3D 全屏 + PointerLock；仅中心准星、左下快捷键条、右下退出提示；全部面板退场。

- 8px 栅格；面板圆角 8px；按钮 6px；控件最小命中 44×28px。
- WCAG 2.2 AA：每处拖拽必须同时有数值输入 + 键盘步进替代通道。

## 2. Style

Minimalism & Swiss 暗色 OLED 分支：近黑中性底、hairline 描边分层、不用重阴影。
3D 展厅为纯黑盒，作品是全场唯一色彩来源；UI 明度不得高于画面。
禁：紫蓝渐变、全局玻璃拟态、Inter+slate 默认味、装饰性循环动效、emoji 图标（统一 Lucide 1.5px 线性）。

## 3. Colors

### Layer A 编辑器 UI

| 角色 | Hex | 变量 |
|---|---|---|
| 应用底 | #0E0E10 | --bg-app |
| 面板底 | #161618 | --bg-panel |
| 浮层 | #1D1D20 | --bg-overlay |
| 主文本 | #FAFAFA | --fg |
| 次文本 | #94A3B8 | --fg-muted |
| 描边 | #2E2E33 / #3F3F46 | --border / --border-strong |
| 主按钮 | #F8FAFC 底 / #0F172A 字 | --btn-primary |
| 强调（选中/手柄/灯位） | #C9A876 哑光黄铜 | --accent |
| 悬停描边 | #5A5A63 | --border-hover |
| 危险 | #EF4444 | --destructive |
| 焦点环 | #FAFAFA 2px | --ring |

强调色总面积 ≤5%，只表达"选中/活动灯/关键数值"。

### Layer B 3D 黑盒材质

| 对象 | 参数 |
|---|---|
| 墙面 | #161514，roughness 0.98 |
| 地面 | #232221 深灰自流平，roughness 0.4，metalness 0.05，Reflector 反射压至 10% |
| 天花 | #0E0E0E，灯轨深嵌不可见 |
| 环境光 | intensity 0.05 |
| 入口洗墙光 | 0.12，仅辨认空间 |
| 画射灯 | 常态主光源：intensity 1.4 / angle π/11 / penumbra 0.55 / decay 2 / 色温 3500K（#FFD9A0 近似）；光斑覆盖卡纸外径 +10cm；目标点锁画心；俯角 30° |
| 雾 | #121214，near 25 / far 120 |
| 画框 | 哑黑 #111110，metalness 0.3 / roughness 0.4，条宽 2cm、厚 3cm |
| 卡纸 | 暖白 #F2EFE8，roughness 0.9，四边等宽 10cm |

不提供彩色氛围灯（摄影作品色偏零容忍）。

## 4. Typography

| 用途 | 字体 | 规格 |
|---|---|---|
| 面板标题 | Archivo 600 | 13px / 0.02em |
| 正文/按钮 | Space Grotesk 400/500 | 13px / 1.5 |
| 参数数值 | JetBrains Mono 400 | 12px tabular-nums |
| 漫游 HUD | Space Grotesk | 14px / 0.04em |
| 中文回退 | PingFang SC / Noto Sans SC | — |

全部 self-host woff2，禁止 Google CDN 依赖。正文 ≥12px，对比度 ≥4.5:1。

## 5. Effects

- UI 过渡 200–250ms ease-out；面板开合 150ms 透明度+4px。
- 选中态：画框外圈 2px 黄铜描边 + Gizmo（双通道，不仅靠颜色）。
- 模式切换：相机位姿互相初始化 + 300ms 黑场交叉淡入，零跳变；PointerLock 失败显示重试按钮。
- 阴影：PCFSoftShadowMap；射灯 shadow-normalBias 0.05、bias 0。
- 性能档 P：关闭射灯阴影；标准 ≥45fps / 性能 ≥30fps（1920×1080，单厅满载约 40 幅）。
- prefers-reduced-motion：全部直出终态。

## 6. 相框与装裱规格

- 形制：全展统一 A 款（细哑黑铝框 + 暖白卡纸）。
- 六标准比例画心（M 档，宽×高 m）：

| 比例 | 取向 | 画心 | 含框含卡纸外径 |
|---|---|---|---|
| 2:3 | 竖 | 0.80×1.20 | 1.04×1.44 |
| 3:4 | 竖 | 0.90×1.20 | 1.14×1.44 |
| 9:16 | 竖 | 0.72×1.28 | 0.96×1.52 |
| 16:9 | 横 | 1.44×0.81 | 1.68×1.05 |
| 3:2 | 横 | 1.35×0.90 | 1.59×1.14 |
| 4:3 | 横 | 1.28×0.96 | 1.52×1.20 |

- S=0.75×、L=1.35×，逐幅可改；非标比例按原图同规自动装框，零裁剪零拉伸。
- 画心中心高 1.50m；同墙中缝 ≥0.6m。

## 7. 反模式硬禁项（14 条）

1. 面板明度高于展厅画面；2. 彩色/多光源叠摄影作品；3. 拖拽为唯一操作通道；4. 玻璃拟态/紫蓝渐变/循环微动画；5. 厚框金框默认；6. 照片宽高比变形；7. 阴影痤疮/锯齿不调 bias；8. 玩家/相机穿墙穿画；9. PointerLock 无退出路径；10. 原图直传显存；11. 全局关 toneMapped 过曝；12. 选中只靠颜色；13. 宣称 file:// 双击可用；14. emoji 充当图标。

## 8. 交付前检查清单

- [ ] 拖拽全有键盘/数值替代；[ ] 键盘可走完全部编辑流；[ ] 对比度 ≥4.5:1
- [ ] 1280/1440/1920 无横向滚动；[ ] 照片零变形、EXIF 旋转正确
- [ ] edit↔walk 切换 20 次无跳变/锁死；[ ] 全厅碰撞无穿透
- [ ] 单厅满载帧率达标；[ ] 大图导入不崩溃有内存上限提示
- [ ] 刷新配置恢复、JSON 导入导出闭环；[ ] 断网完整运行；[ ] reduced-motion 生效
