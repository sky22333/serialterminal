import React from 'react'

import RowOffsets from '../modules/rowOffsets'

/**
 * 行窗口化的虚拟滚动。
 *
 * 终端允许折行，行高不固定，所以用「估算 + 实测」：先按估算值算偏移，
 * 渲染出来的行再量一次真实高度并修正偏移；视口上方的变化做滚动补偿，避免跳动。
 * 测量结果以行对象为键存在 WeakMap 里，行被裁掉或数组重排都不会错位。
 */

const DEFAULT_ESTIMATE = 21
const DEFAULT_OVERSCAN = 10

export interface VirtualWindowOptions<T extends object> {
  items: readonly T[]
  scrollRef: React.RefObject<HTMLElement | null>
  /** 未测量过的高度的估算值 */
  estimate?: number
  /** 视口上下各多渲染几行，滚动时不至于露白 */
  overscan?: number
  /** 变化就作废所有测量结果（例如折行开关切换） */
  resetKey?: unknown
}

export interface VirtualWindow<T extends object> {
  /** 可见区间的起止下标（左闭右开） */
  start: number
  end: number
  totalHeight: number
  padTop: number
  padBottom: number
  measure: (index: number, item: T, height: number) => void
  handleScroll: () => void
  scrollToIndex: (index: number) => void
  scrollToBottom: () => void
}

export default function useVirtualWindow<T extends object>(options: VirtualWindowOptions<T>): VirtualWindow<T> {
  const {
    items,
    scrollRef,
    estimate = DEFAULT_ESTIMATE,
    overscan = DEFAULT_OVERSCAN,
    resetKey,
  } = options

  // 用 state 持有测量表：读它发生在渲染期，用 ref 会违反 React 的约束
  const [heights, setHeights] = React.useState(() => new WeakMap<object, number>())
  const [version, setVersion] = React.useState(0)
  const [scrollTop, setScrollTop] = React.useState(0)
  const [viewport, setViewport] = React.useState(0)

  const startRef = React.useRef(0)
  const frameRef = React.useRef(0)

  const [metrics] = React.useState(() => new RowOffsets<T>(estimate))

  // 折行开关变了之后，之前量到的高度全部作废
  React.useEffect(() => {
    setHeights(new WeakMap<object, number>())
    setVersion(value => value + 1)
  }, [resetKey])

  // 行数组或测量结果变了就重建分块前缀和
  React.useMemo(() => {
    metrics.sync(items, heights, estimate)
    // version 变化代表有行被重新测量过（它本身不参与计算，这是有意为之）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metrics, items, heights, estimate, version])

  // 一帧里的多次测量合并成一次重渲染：每测一行就 setState 会让滚动卡死
  const bumpVersion = React.useCallback(() => {
    if (frameRef.current) return

    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = 0
      setVersion(value => value + 1)
    })
  }, [])

  React.useEffect(() => () => {
    if (frameRef.current) window.cancelAnimationFrame(frameRef.current)
  }, [])

  // jsdom / 隐藏容器里拿不到高度，退一步按可视行数估算，保证仍能渲染出一屏
  const viewportHeight = viewport > 0 ? viewport : estimate * 24

  const start = items.length === 0 ? 0 : metrics.indexAt(scrollTop)
  const end = items.length === 0 ? 0 : Math.min(items.length, metrics.indexAt(scrollTop + viewportHeight) + 1 + overscan)

  // measure 在子组件的 layout effect 里调用，读上一次渲染的起点就够用
  React.useEffect(() => {
    startRef.current = start
  }, [start])

  const handleScroll = React.useCallback(() => {
    const el = scrollRef.current
    if (!el) return

    setScrollTop(el.scrollTop)
    setViewport(el.clientHeight)
  }, [scrollRef])

  React.useEffect(() => {
    const el = scrollRef.current
    if (!el) return undefined

    const sync = () => {
      setViewport(el.clientHeight)
      setScrollTop(el.scrollTop)
    }

    sync()

    if (typeof ResizeObserver === 'undefined') return undefined

    const observer = new ResizeObserver(sync)
    observer.observe(el)

    return () => observer.disconnect()
  }, [scrollRef])

  const measure = React.useCallback((index: number, item: T, measuredHeight: number) => {
    if (!item || !(measuredHeight > 0)) return

    const previous = heights.get(item)

    // 亚像素抖动不触发更新，否则会陷入「测量 → 重渲染 → 再测量」的循环
    if (previous !== undefined && Math.abs(previous - measuredHeight) < 0.5) return

    metrics.update(index, measuredHeight, heights)

    const el = scrollRef.current

    if (el && index < startRef.current) {
      el.scrollTop += measuredHeight - (previous === undefined ? estimate : previous)
    }

    bumpVersion()
  }, [heights, metrics, scrollRef, estimate, bumpVersion])

  const scrollToIndex = React.useCallback((index: number) => {
    const el = scrollRef.current
    if (!el) return

    const safeIndex = Math.min(Math.max(index, 0), items.length)
    const offset = metrics.offsetOf(safeIndex)

    el.scrollTop = Math.max(0, offset - el.clientHeight / 2)
  }, [scrollRef, metrics, items.length])

  const scrollToBottom = React.useCallback(() => {
    const el = scrollRef.current
    if (!el) return

    el.scrollTop = metrics.total
  }, [scrollRef, metrics])

  return {
    start: start,
    end: end,
    totalHeight: metrics.total,
    padTop: metrics.offsetOf(start),
    padBottom: Math.max(0, metrics.total - metrics.offsetOf(end)),
    measure: measure,
    handleScroll: handleScroll,
    scrollToIndex: scrollToIndex,
    scrollToBottom: scrollToBottom,
  }
}
