# AI 数字摄影艺术展 · 60 幅

![AI 数字摄影艺术展 · 60 幅](docs/social-preview.jpg)

可漫游 3D 线上美术馆 · 四主题展厅：香港故事 / 双城纪事 / 海与港 / 林间生灵。白盒展厅语言，60 幅作品按 15 幅/厅上墙。

**在线访问**：https://huangxxuan.github.io/gallery3d/

## 本地运行

```bash
export PATH="$HOME/.local/node/bin:$PATH"   # 非交互 shell 必需
npm install
npm run dev                                  # 打开 http://localhost:5173/?artview=0
```

## 构建与部署

`npm run build` 产出 `dist/`；推送到 `main` 后由 `.github/workflows/deploy.yml` 自动发布到 GitHub Pages。

接手先读 [AGENTS.md](AGENTS.md)，完整交接包在 [docs/handoff/](docs/handoff/)。
