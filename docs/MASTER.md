# 3D 摄影展布展漫游系统 · 项目总纲（MASTER）

> ⚠️ **2026-10-07 现行口径**：本文为 Phase 0-2 历史稿，部分锁定基线已被实现推翻
> （React 19 而非 18；碰撞改 Octree 而非自研 AABB；弃 PointerLock 改自持相机；
> 大图改相机飞行而非 DOM Lightbox；真光源 8 盏 + 假光斑）。
> **任何接手者先读 [`handoff/AGENTS.md`](./handoff/AGENTS.md)，冲突以交接包为准。**
> 复盘见 [`handoff/RETROSPECTIVE.md`](./handoff/RETROSPECTIVE.md)，后续执行见
> [`handoff/NEXT-STEPS.md`](./handoff/NEXT-STEPS.md)。当前进度：样片版 12 幅全链路完成。

- 版本：v0.2（Phase 1 稿，已被 handoff 包增补至 v0.3 现行口径）
- 更新：2026-10-05（2026-10-07 加交接指引）
- 工作流：WORKFLOW-C v1.0（6 阶段门控制）
- 代号：gallery3d（目录名可改，不影响工程）

## 1. 项目定位

摄影展"布展规划 + 沉浸式观展"一体化 3D 工具。本地运行、浏览器访问。
服务两类动作：操盘手在编辑模式布展调灯看效果；观众/老板本人在漫游模式游走看展、点开作品全屏看全貌。

## 2. 已锁定基线（不可漂移，变更走 ADR）

| 项 | 结论 | 出处 |
|---|---|---|
| 技术栈 | Vite + React 18 + TypeScript + Three.js + @react-three/fiber + @react-three/drei + zustand | ADR-0001 |
| 空间 | 纯黑盒沉浸，无昼夜切换 | ADR-0002、design-system.md |
| 碰撞 | 自研轻量 AABB，不引物理引擎 | ADR-0003 |
| 展厅 | 四厅串联全量展（177 张可同时在展），按厅分区加载/卸载 | ADR-0004 |
| 数据 | 布展配置 JSON Schema 驱动，localStorage 自动保存 + 导入导出 | ADR-0005 |
| 看画 | 点击作品 → 黑底全屏 Lightbox，左右键翻幅，Esc 回到原位 | ADR-0006 |
| 资产 | 展厅/画框/灯光全部程序化几何，零外部模型 | ADR-0007 |
| 相框 | A 款：细哑黑铝框 2cm + 暖白卡纸 10cm，默认 M 档逐幅可调 | design-system.md |
| 视角 | edit（Orbit 鸟瞰拖拽编辑）↔ walk（PointerLock + WASD 纯地面行走） | spec.md |
| 素材 | /Users/huang/Downloads/摄影作品，177 张，1.06GB；导入生成 2048/4096 纹理 | spec.md |

## 3. 阶段记录

| 阶段 | 状态 | 产出 | 审批 |
|---|---|---|---|
| Phase 0 设计系统 | ✅ 通过（修订版终审） | docs/design-system.md | 2026-10-05 老板确认 |
| Phase 1 需求/领域建模 | ✅ 通过 | spec.md / GLOSSARY.md / adr/ / exhibition.schema.json | 2026-10-05 老板确认；HEIC 预转、压缩纹理入工程 |
| Phase 2 计划拆解 | 🔄 待审批 | docs/plan.md（S 四题 Spike + T0 素材 + A–J 共 24 任务） | — |
| Phase 3 技术 Spike | 未开始 | 贴墙吸附 / 双相机 / 实时射灯 / 四厅分区 四题 | — |
| Phase 4 实现 | 未开始 | src/ | — |
| Phase 5 审查 | 未开始 | 双轴 review + 性能审计 | — |
| Phase 6 交付 | 未开始 | dist 静态包 + 浏览器实测 | — |

## 4. 文档索引

- ★ 交接包（2026-10-07，现行口径）：[handoff/AGENTS.md](./handoff/AGENTS.md) · [handoff/RETROSPECTIVE.md](./handoff/RETROSPECTIVE.md) · [handoff/NEXT-STEPS.md](./handoff/NEXT-STEPS.md)
- 设计系统：[design-system.md](./design-system.md)
- 功能规格：[spec.md](./spec.md)
- 术语表：[GLOSSARY.md](./GLOSSARY.md)
- 决策记录：[adr/](./adr/)
- 布展数据契约：[exhibition.schema.json](./exhibition.schema.json)

## 5. 老板工作规则（本项目强制执行）

- 结论先行；判断 + 收口 + 唯一下一步。
- 遇到不确定问题或缺失信息：必须给建议方案 + 可选项，禁止擅自假设。
- 不新建无关文件；产物并入 docs 体系。
- 不装新技能、不删文件、不发外部消息，未经确认不执行。
