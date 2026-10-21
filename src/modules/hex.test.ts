import { describe, expect, test } from 'vitest'

import { bytesToHex, formatHexRow, hexPreview, parseHex } from './hex'

describe('parseHex', () => {
    test('空格分隔的字节', () => {
        const { bytes, error } = parseHex('48 65 6C 6C 6F')

        expect(error).toBe('')
        expect(bytesToHex(bytes)).toBe('48 65 6C 6C 6F')
    })

    test('支持 0x 前缀、逗号、冒号、短横线', () => {
        expect(bytesToHex(parseHex('0x48,0x65:6C-6C 6F').bytes)).toBe('48 65 6C 6C 6F')
    })

    test('不带分隔符的连续串', () => {
        expect(bytesToHex(parseHex('48656C6C6F').bytes)).toBe('48 65 6C 6C 6F')
    })

    test('小写也认', () => {
        expect(bytesToHex(parseHex('ff 00').bytes)).toBe('FF 00')
    })

    test('空输入给出提示', () => {
        expect(parseHex('').error).toContain('请输入')
        expect(parseHex('   ').error).toContain('请输入')
        expect(parseHex(null).error).toContain('请输入')
    })

    test('位数是奇数时报错，而不是悄悄补 0', () => {
        expect(parseHex('ABC').error).toContain('偶数')
    })

    test('非法字符会被指出来', () => {
        expect(parseHex('48 6G').error).toContain('G')
    })

    test('超过单次上限时报错', () => {
        const { error } = parseHex('00 '.repeat(10), { maxBytes: 4 })
        expect(error).toContain('最多')
    })

    test('不把 f0x1 里的 0x 当成前缀删掉', () => {
        // f0x1 → 只有 x 是非法的
        expect(parseHex('f0x1').error).toContain('x')
    })
})

describe('bytesToHex', () => {
    test('补零到两位', () => {
        expect(bytesToHex(new Uint8Array([0, 5, 255]))).toBe('00 05 FF')
    })

    test('可以换分隔符', () => {
        expect(bytesToHex(new Uint8Array([0x41, 0x42]), '-')).toBe('41-42')
    })

    test('空值返回空串', () => {
        expect(bytesToHex(null)).toBe('')
    })
})

describe('hexPreview', () => {
    test('短内容完整返回', () => {
        expect(hexPreview(new Uint8Array([1, 2]))).toBe('01 02')
    })

    test('长内容截断并标注总长度', () => {
        const preview = hexPreview(new Uint8Array(40), 4)
        expect(preview).toContain('00 00 00 00')
        expect(preview).toContain('共 40 字节')
    })
})

describe('formatHexRow', () => {
    test('固定宽度、带偏移和 ASCII 列', () => {
        const row = formatHexRow(new Uint8Array([0x48, 0x69, 0x00]), 0x10)

        expect(row.startsWith('00000010  48 69 00')).toBe(true)
        expect(row).toContain('|Hi.')
        // 一行固定 78 个字符，虚拟滚动才能稳定估算高度
        expect(row).toHaveLength(78)
    })

    test('不满一行时补空格而不是补 00', () => {
        const row = formatHexRow(new Uint8Array([0x41]), 0)

        expect(row).toContain('41')
        expect(row).not.toContain('41 00')
    })
})
