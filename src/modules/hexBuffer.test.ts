import { describe, expect, test } from 'vitest'

import HexBuffer from './hexBuffer'

const time = new Date(2026, 9, 21, 8, 0, 0)
const bytes = (count: number, start = 0) => new Uint8Array(Array.from({ length: count }, (_, i) => start + i))

describe('HexBuffer', () => {
    test('满 16 字节才产出一行，偏移按绝对值累加', () => {
        const buffer = new HexBuffer()

        expect(buffer.push(bytes(16), time)).toHaveLength(1)
        expect(buffer.push(bytes(16, 16), time)[0].value.startsWith('00000010')).toBe(true)
    })

    test('不满一行的部分先作为 pending 实时显示', () => {
        const buffer = new HexBuffer()

        buffer.push(bytes(3), time)

        expect(buffer.pending.startsWith('00000000  00 01 02')).toBe(true)
    })

    test('跨数据块会把半行补齐，不会每块都单独成行', () => {
        const buffer = new HexBuffer()

        expect(buffer.push(bytes(10), time)).toHaveLength(0)

        const rows = buffer.push(bytes(6, 10), time)

        expect(rows).toHaveLength(1)
        expect(rows[0].value).toContain('0A 0B 0C 0D 0E 0F')
    })

    test('flush 把残余收成一行', () => {
        const buffer = new HexBuffer()

        buffer.push(bytes(5), time)

        const row = buffer.flush(time)

        expect(row?.value.startsWith('00000000')).toBe(true)
        expect(buffer.pending).toBe('')
        expect(buffer.flush(time)).toBeNull()
    })

    test('reset 之后偏移从 0 重新开始', () => {
        const buffer = new HexBuffer()

        buffer.push(bytes(20), time)
        buffer.reset()

        expect(buffer.pending).toBe('')
        expect(buffer.push(bytes(16), time)[0].value.startsWith('00000000')).toBe(true)
    })

    test('空数据不产生任何行', () => {
        const buffer = new HexBuffer()

        expect(buffer.push(new Uint8Array(0), time)).toEqual([])
        expect(buffer.pending).toBe('')
    })
})
