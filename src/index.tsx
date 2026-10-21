import React from 'react'
import { createRoot } from 'react-dom/client'

import GlobalStyles from '@mui/material/GlobalStyles'

import App from './App'
import ErrorBoundary from './components/ErrorBoundary'

import './assets/fonts/fonts.css'

const container = document.getElementById('root')

if (!container) {
  // 少了 #root 说明打包配置坏了，直接报错比白屏好排查
  throw new Error('找不到 #root 挂载点')
}

createRoot(container).render(
  <React.StrictMode>
    {/* MUI 的组件尺寸都按 border-box 计算：少了这条，凡是同时设了
        maxWidth / width 和 padding 的组件都会宽出 padding 的量 */}
    <GlobalStyles styles={{
      '*, *::before, *::after': { boxSizing: 'border-box' },
      body: { margin: 0, fontFamily: 'Roboto, system-ui, sans-serif' },
    }} />
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
