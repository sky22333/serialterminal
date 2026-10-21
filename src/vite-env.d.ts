/// <reference types="vite/client" />

/**
 * 构建号由 CI 通过 VITE_VERSION 注入，本地开发时没有，
 * 所以声明成可选，读的时候用 `|| 'dev'` 兜底。
 */
interface ImportMetaEnv {
  readonly VITE_VERSION?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
