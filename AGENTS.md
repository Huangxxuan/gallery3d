# AGENTS.md — 接手本项目先读这里

完整交接包在 `docs/handoff/`，按顺序读：

1. **[docs/handoff/AGENTS.md](docs/handoff/AGENTS.md)** — 项目地图、环境/命令、文件职责、现行口径覆盖表、开发铁律、验收状态
2. **[docs/handoff/RETROSPECTIVE.md](docs/handoff/RETROSPECTIVE.md)** — 15 个实战踩坑（环境/渲染/相机交互/布局/验收）与经验
3. **[docs/handoff/NEXT-STEPS.md](docs/handoff/NEXT-STEPS.md)** — T0-T4 后续任务执行书与开工检查单

最快上手三条：

```bash
export PATH="$HOME/.local/node/bin:$PATH"   # 非交互 shell 必需
cd /Users/huang/TRAEWORK/gallery3d && npm install
npm run dev                                  # 系统 Chrome 打开 http://localhost:5173/?artview=0
```

注意：`docs/MASTER.md` 与 `docs/adr/` 为早期历史稿，与交接包冲突时一律以交接包为准。
