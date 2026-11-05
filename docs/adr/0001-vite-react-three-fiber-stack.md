# ADR-0001 技术栈：Vite + React + r3f

- 状态：Accepted
- 日期：2026-10-05

## 背景
参考仓库 deanssmart/the-gallery 基于 CRA + react-three-fiber v5 + Three r122（2020），Node 18+ 依赖失修；另有"单 HTML 零安装"方案。

## 决策
Vite 5 + React 18 + TypeScript + Three.js 最新稳定版 + @react-three/fiber + @react-three/drei + zustand。本地 `npm run dev`，交付 `npm run build` 的 dist 纯静态包。

## 理由
- 声明式 3D 组件化与参考仓库心智一致，可直接迁移灯光/玩家模式的成熟参数。
- Vite 生态与 r3f 当前版本匹配，构建产物为纯静态目录，满足"本地运行/HTML 访问/可离线"。
- zustand 满足模式状态机与布展配置单数据源，无需 Redux 级重量。

## 备选
- 单 HTML + importmap：交付更轻，但四厅/编辑器/分区加载的工程复杂度下不可维护。
- 复刻旧仓库：旧依赖排错额外 3–5 工时且锁死历史版本。

## 后果
工程化门槛存在（需 Node 环境）；2026-10-05 本机安装 Node v24.21.0（官方 arm64 二进制，~/.local/node，PATH 已写 ~/.zshrc）+ npm 11.19.0。

## 附录：S0 实测版本矩阵（2026-10-05，npm ls 无 peer 冲突）

- node v24.21.0 / npm 11.19.0
- react 19.3.0 / react-dom 19.3.0
- three 0.186.1 / @types/three 0.186.x
- @react-three/fiber 9.8.1 / @react-three/drei 10.7.9
- zustand 5.0.15 / ajv 8.20
- vite 8.3.2 / typescript 7.0.2 / vitest 5.0.3 / @vitejs/plugin-react 6.1.2
- 项目级 .npmrc 指向 registry.npmmirror.com
- 冒烟：build 568 模块通过；浏览器 61fps；仅 Clock/PCFSoftShadowMap 弃用级 warn，正式代码用当前 API 写法规避。
