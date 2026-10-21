import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  window.localStorage.clear()
})

// jsdom 没有这些 API，补最小可用版本。
// ResizeObserver 是空实现，元素高度恒为 0，虚拟列表会退回按估算高度渲染。
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() { }
    unobserve() { }
    disconnect() { }
  }
}

if (!window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() { },
    removeListener() { },
    addEventListener() { },
    removeEventListener() { },
    dispatchEvent() { return false },
  }) as MediaQueryList
}

// 没有布局，给 scrollTo 一个空实现，免得调用即抛错
const elementProto = Element.prototype as unknown as Record<string, unknown>

if (typeof elementProto.scrollTo !== 'function') {
  elementProto.scrollTo = () => { }
}
