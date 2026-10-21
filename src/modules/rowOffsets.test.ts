import { describe, expect, test } from 'vitest'

import RowOffsets from './rowOffsets'

const ESTIMATE = 20

const makeItems = (count: number) => Array.from({ length: count }, (_, i) => ({ id: i }))

/** 不测量时的参照实现：逐行前缀和 */
const reference = (items: readonly object[], heights: WeakMap<object, number>, estimate: number) => {
    const offsets = [0]
    let sum = 0

    for (const item of items) {
        const measured = heights.get(item)
        sum += measured === undefined ? estimate : measured
        offsets.push(sum)
    }

    return { offsets, total: sum }
}

describe('RowOffsets', () => {
    test('没有测量结果时按估算高度铺开', () => {
        const items = makeItems(1000)
        const heights = new WeakMap<object, number>()
        const metrics = new RowOffsets<{ id: number }>(ESTIMATE)

        metrics.sync(items, heights, ESTIMATE)

        expect(metrics.total).toBe(1000 * ESTIMATE)
        expect(metrics.offsetOf(0)).toBe(0)
        expect(metrics.offsetOf(257)).toBe(257 * ESTIMATE)
        expect(metrics.offsetOf(1000)).toBe(1000 * ESTIMATE)
        expect(metrics.indexAt(0)).toBe(0)
        expect(metrics.indexAt(20 * 10 + 1)).toBe(10)
    })

    test('跨块边界的偏移与逐行前缀和一致', () => {
        const items = makeItems(700)
        const heights = new WeakMap<object, number>()
        const metrics = new RowOffsets<{ id: number }>(ESTIMATE)

        // 每行高度各不相同，覆盖块内与块间
        items.forEach((item, i) => heights.set(item, 18 + (i % 7)))

        metrics.sync(items, heights, ESTIMATE)

        const { offsets, total } = reference(items, heights, ESTIMATE)

        expect(metrics.total).toBe(total)

        for (const i of [0, 1, 255, 256, 257, 511, 512, 699]) {
            expect(metrics.offsetOf(i)).toBeCloseTo(offsets[i], 10)
        }

        // 每一行的起点都能反查回自己
        for (const i of [0, 255, 256, 511, 512, 698]) {
            expect(metrics.indexAt(offsets[i])).toBe(i)
            expect(metrics.indexAt(offsets[i] + 1)).toBe(i)
        }
    })

    test('测量后总量与偏移同步修正，索引仍然自洽', () => {
        const items = makeItems(600)
        const heights = new WeakMap<object, number>()
        const metrics = new RowOffsets<{ id: number }>(ESTIMATE)

        metrics.sync(items, heights, ESTIMATE)
        metrics.update(300, 60, heights)
        metrics.update(5, 45, heights)
        metrics.update(599, 80, heights)

        const { offsets, total } = reference(items, heights, ESTIMATE)

        expect(metrics.total).toBe(total)
        expect(metrics.offsetOf(301)).toBeCloseTo(offsets[301], 10)
        expect(metrics.offsetOf(600)).toBe(total)

        for (const i of [0, 5, 6, 300, 301, 599]) {
            expect(metrics.indexAt(offsets[i])).toBe(i)
        }
    })

    test('空列表不会越界', () => {
        const metrics = new RowOffsets<{ id: number }>(ESTIMATE)

        metrics.sync([], new WeakMap(), ESTIMATE)

        expect(metrics.total).toBe(0)
        expect(metrics.offsetOf(0)).toBe(0)
        expect(metrics.indexAt(100)).toBe(0)
    })

    test('超出内容的偏移停在最后一行', () => {
        const items = makeItems(10)
        const heights = new WeakMap<object, number>()
        const metrics = new RowOffsets<{ id: number }>(ESTIMATE)

        metrics.sync(items, heights, ESTIMATE)

        expect(metrics.indexAt(ESTIMATE * 10)).toBe(9)
        expect(metrics.indexAt(99999)).toBe(9)
    })

    test('重复 sync 是幂等的', () => {
        const items = makeItems(400)
        const heights = new WeakMap<object, number>()
        const metrics = new RowOffsets<{ id: number }>(ESTIMATE)

        items.forEach((item, i) => heights.set(item, 30 + (i % 3)))

        metrics.sync(items, heights, ESTIMATE)
        const first = metrics.total

        metrics.sync(items, heights, ESTIMATE)

        const { offsets } = reference(items, heights, ESTIMATE)

        expect(metrics.total).toBe(first)
        expect(metrics.offsetOf(200)).toBe(offsets[200])
    })
})
