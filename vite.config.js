import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages 项目站点挂在 /space-raiden-3d/ 子路径下，绝对路径 /assets/... 会 404。
  // 用相对路径后，dist/ 既能被 Pages 子路径托管，也能本地直接打开预览。
  base: './',
  build: {
    target: 'es2020',
    // three.js 本身压缩后约 570 KB，属预期体积，不做代码分割（单场景游戏无拆分收益）。
    chunkSizeWarningLimit: 800,
  },
});
