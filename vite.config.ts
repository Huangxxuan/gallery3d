import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // 相对基址：同一份构建产物可同时用于本地/离线包（根路径）与 GitHub Pages 子路径（/repo/）
  base: './',
  plugins: [react()],
})
