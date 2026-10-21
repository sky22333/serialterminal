import { parseAnsi, stripAnsi } from './ansiParser'

describe('stripAnsi', () => {
    test('去掉颜色控制符', () => {
        expect(stripAnsi('\u001b[32mOK\u001b[0m')).toBe('OK')
    })

    test('去掉光标与清屏控制符', () => {
        expect(stripAnsi('abc\u001b[Kdef\u001b[2J')).toBe('abcdef')
    })

    test('普通文本原样返回', () => {
        expect(stripAnsi('hello 世界')).toBe('hello 世界')
    })
})

describe('parseAnsi', () => {
    test('没有控制符时返回单个片段', () => {
        const segments = parseAnsi('hello')
        expect(segments).toHaveLength(1)
        expect(segments[0].text).toBe('hello')
        expect(segments[0].style).toBeNull()
    })

    test('基础前景色', () => {
        const segments = parseAnsi('\u001b[31merror\u001b[0m')
        expect(segments).toHaveLength(1)
        expect(segments[0].text).toBe('error')
        expect(segments[0].style?.color).toBe('#f28b82')
    })

    test('加粗红色后重置', () => {
        const segments = parseAnsi('\u001b[1;31mA\u001b[0mB')
        expect(segments).toHaveLength(2)
        expect(segments[0].style?.color).toBe('#f28b82')
        expect(segments[0].style?.fontWeight).toBe(700)
        expect(segments[1].text).toBe('B')
        expect(segments[1].style).toBeNull()
    })

    test('256 色与真彩色', () => {
        const indexed = parseAnsi('\u001b[38;5;196mX')
        expect(indexed[0].style?.color).toBe('#ff0000')

        const truecolor = parseAnsi('\u001b[38;2;18;52;86mY')
        expect(truecolor[0].style?.color).toBe('#123456')
    })

    test('背景色与反显', () => {
        const segments = parseAnsi('\u001b[7mZ')
        expect(segments[0].style?.color).toBe('#202124')
        expect(segments[0].style?.backgroundColor).toBe('#e8eaed')
    })

    test('多段文本样式互不影响', () => {
        const segments = parseAnsi('\u001b[32mPASS\u001b[0m rest')
        expect(segments.map(s => s.text)).toEqual(['PASS', ' rest'])
        expect(segments[1].style).toBeNull()
    })
})
