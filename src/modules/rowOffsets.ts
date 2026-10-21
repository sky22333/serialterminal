/**
 * 行偏移的分块前缀和。
 *
 * 逐行维护一张 n+1 长的偏移表，每测一行都要重填并分配几百 KB；
 * 这里每 BLOCK 行一块，只存块起点，测量一行只重算「本块 + 后续块的累计」，
 * 单次更新的代价从 O(n) 降到 O(BLOCK + n/BLOCK)。
 */

const BLOCK = 256

export default class RowOffsets<T extends object> {
  private items: readonly T[] = []
  private heights: WeakMap<object, number> | null = null
  private estimate: number
  /** 每块的高度合计 */
  private sums: number[] = []
  /** 每块的起始偏移 */
  private bases: number[] = []
  private size = 0
  total = 0

  constructor(estimate: number) {
    this.estimate = estimate
  }

  /** 用最新的行数组与测量表重建。没有逐行数组，分配量只和块数有关 */
  sync(items: readonly T[], heights: WeakMap<object, number>, estimate: number): void {
    const size = items.length
    const blocks = Math.ceil(size / BLOCK)

    this.items = items
    this.heights = heights
    this.estimate = estimate
    this.size = size
    this.sums.length = blocks
    this.bases.length = blocks

    let cursor = 0

    for (let block = 0; block < blocks; block++) {
      const start = block * BLOCK
      const end = Math.min(size, start + BLOCK)

      this.bases[block] = cursor

      let sum = 0
      for (let i = start; i < end; i++) {
        const measured = heights.get(items[i])
        sum += measured === undefined ? estimate : measured
      }

      this.sums[block] = sum
      cursor += sum
    }

    this.total = cursor
  }

  /** 某一行的高度：量过用实测值，没量过用估算值 */
  private heightAt(index: number): number {
    const measured = this.heights?.get(this.items[index])
    return measured === undefined ? this.estimate : measured
  }

  /** 第 index 行在内容里的纵向偏移 */
  offsetOf(index: number): number {
    if (this.size === 0 || index <= 0) return 0
    if (index >= this.size) return this.total

    const block = Math.floor(index / BLOCK)
    let offset = this.bases[block]

    for (let i = block * BLOCK; i < index; i++) offset += this.heightAt(i)

    return offset
  }

  /** 纵向偏移 offset 落在第几行 */
  indexAt(offset: number): number {
    if (this.size === 0) return 0

    const target = Math.max(0, offset)

    if (target >= this.total) return this.size - 1

    let low = 0
    let high = this.bases.length - 1

    while (low < high) {
      const mid = (low + high + 1) >> 1
      if (this.bases[mid] <= target) low = mid
      else high = mid - 1
    }

    const start = low * BLOCK
    const end = Math.min(this.size, start + BLOCK)
    let cursor = this.bases[low]

    for (let i = start; i < end; i++) {
      const next = cursor + this.heightAt(i)
      if (next > target) return i
      cursor = next
    }

    return end - 1
  }

  /** 测量到新高度后就地修正，不重建整张表 */
  update(index: number, height: number, heights: WeakMap<object, number>): void {
    if (index < 0 || index >= this.size) return

    heights.set(this.items[index], height)

    const block = Math.floor(index / BLOCK)
    const start = block * BLOCK
    const end = Math.min(this.size, start + BLOCK)

    let sum = 0
    for (let i = start; i < end; i++) {
      const measured = heights.get(this.items[i])
      sum += measured === undefined ? this.estimate : measured
    }

    const delta = sum - this.sums[block]
    if (delta === 0) return

    this.sums[block] = sum
    for (let b = block + 1; b < this.bases.length; b++) this.bases[b] += delta

    this.total += delta
  }
}
