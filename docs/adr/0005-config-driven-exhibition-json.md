# ADR-0005 展览配置 JSON Schema 驱动

- 状态：Accepted
- 日期：2026-10-05

## 背景
布展参数（作品、挂位、尺寸、灯光、厅/墙归属）需要可保存、可撤销、可导入导出、可被自动初排与校验消费。

## 决策
定义单一布展数据契约 `exhibition.schema.json`：Exhibition → Halls[] → Walls[] → Slots[]（artworkId、position、rotation、sizeTier、spot 参数）。Artwork 清单独立成节（原图 URI、宽高、纹理档、元信息）。
- 运行时单一数据源在 zustand store，store 形状即 Schema 形状。
- 自动保存：每次变更 debounce 500ms 写 localStorage；支持导出 .json 与导入（Schema 校验 + 迁移版本号）。
- 照片本体不入 JSON：仅存相对路径（public/photos 或导入会话内 ObjectURL 映射）。

## 理由
- Schema 是编辑器、渲染器、校验器、未来多厅自动布局的共同契约。
- JSON 可手改、可备份、可跨设备传递。

## 备选
- 二进制/IndexedDB 直存：不可读、不可手改、不可 Git 版本化。

## 后果
一期照片走"复制进 public/photos 后引用相对路径"为主路径；浏览器拖入 ObjectURL 仅当次会话有效，导出配置时提示素材打包。
