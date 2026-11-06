# AI 数字摄影艺术展 · 60 幅

[English](README.en.md) · **简体中文**

[![Deploy to GitHub Pages](https://github.com/Huangxxuan/gallery3d/actions/workflows/deploy.yml/badge.svg)](https://github.com/Huangxxuan/gallery3d/actions/workflows/deploy.yml)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

![AI 数字摄影艺术展 · 60 幅](docs/social-preview.jpg)

## 在线访问

**https://huangxxuan.github.io/gallery3d/**

浏览器打开即可进入，无需安装、无需登录。桌面端体验最佳（需要 WebGL 与键盘）。

## 这是什么

一个可第一人称漫游的 **3D 线上摄影美术馆**。四座主题展厅、60 幅摄影作品全部按真实展陈逻辑上墙：

| 展厅 | 展题 | 作品数 |
|---|---|---|
| H1 | 香港故事 | 15 |
| H2 | 双城纪事 | 15 |
| H3 | 海与港 | 15 |
| H4 | 林间生灵 | 15 |

展厅采用「白盒」建筑语言：白墙、浅灰地面、共享天花框、拱门暗钢环与射灯光斑；入口厅与出口厅为银白语言。作品以香槟钛银拉丝框 + 白卡纸装裱，点击作品可进入大图模式查看高清版本。

## 使用方法

进入后先看到启动页，点击「进入」开始漫游（或按回车）。

| 操作 | 键位 / 方式 |
|---|---|
| 前后左右行走 | `W` `A` `S` `D` 或方向键 |
| 快走 | 按住 `Shift` |
| 环视 | 按住鼠标左键拖拽；鼠标移动微调 |
| 看大图 | 点击墙面作品 |
| 大图内翻页 | `←` `→`（或 `A` `D`） |
| 退出大图 | `Esc` / `Backspace` |
| 自动巡游 | `P` 切换 |
| 返回入口 | `R` |

其他：`?cam=x,z,yaw,pitch` 可直接定位机位，`?artview=0` 进入调试观察视图，用于截图验收。

## 技术栈

- **渲染**：three.js 0.186 + React Three Fiber 9 + @react-three/drei
- **框架**：React 19 + TypeScript 7，Vite 8 构建
- **状态**：zustand 5（模式机 / 焦点作品 / 当前展厅）
- **测试**：Vitest 5（布展规则、分区、光斑几何、机位快照）
- **部署**：GitHub Actions → GitHub Pages（push `main` 自动发布）

## 目录结构

```
src/
  domain/       展厅几何、布展规则、主题配置（纯数据与纯函数，可测试）
  three/        场景渲染：墙体/拱门/天花/画作/纹理分级/玩家胶囊碰撞/相机
  state/        zustand 状态：漫游/大图模式、焦点作品、区域判定
  ui/           HUD 覆盖层：启动页、操作提示、大图底栏
  spike/        光斑、分区、机位等实验场景（研究用，非线上路径）
public/
  manifest.json 作品清单（id / 三级图路径 / 主题 / 展厅 / 尺寸）
  photos/       主档（长边 1300）；lo/ 远厅低模；hd/ 大图
scripts/
  prepare-assets.mjs  素材管线：源图 → 三级 JPEG + manifest v2
docs/          设计口径、ADR、交接文档（AGENTS.md / RETROSPECTIVE.md / NEXT-STEPS.md）
```

## 本地运行

需要 Node 18+（CI 使用 Node 22）。

```bash
export PATH="$HOME/.local/node/bin:$PATH"   # 非交互 shell 必需，按你的 Node 安装位置调整
npm install
npm run dev        # http://localhost:5173/
npm test           # Vitest 单元测试
npm run build      # 产出 dist/
npm run preview    # 预览构建产物
```

## 构建与部署

`.github/workflows/deploy.yml` 在 push 到 `main` 时执行：`npm ci` → `npm run build` → 上传 `dist/` → 发布到 GitHub Pages。

`vite.config.ts` 使用 `base: './'`，同一份构建产物既能跑根路径（本地 / 离线包），也能跑 Pages 子路径 `/gallery3d/`。

## 素材管线

```bash
node scripts/prepare-assets.mjs
```

从 `~/Downloads/摄影作品/<分类>/*.{jpg,jpeg,png,heic}` 读取原图，用 macOS `sips` 生成三档 JPEG（主档长边 2048、远厅 1024、大图 4096，本仓库线上版本进一步压缩到 1300 / 800 / 1600 以控制仓库体积），并写出 `public/manifest.json`。

## 许可

- **代码**：Apache License 2.0，见 [LICENSE](LICENSE)。
- **摄影作品与展览图像**（`public/photos/**`、`docs/social-preview.jpg`）：版权归作者所有，**不适用** Apache-2.0，未经许可不得转载、商用或再分发。

如需引用本项目代码，请保留 LICENSE 与版权声明；如需使用作品图片，请先联系作者获得授权。
