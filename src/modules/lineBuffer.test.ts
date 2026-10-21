import LineBuffer from './lineBuffer'

const time = new Date()

describe('LineBuffer', () => {
    test('按 \\r\\n 与 \\n 分行', () => {
        const buffer = new LineBuffer()
        const lines = buffer.consume('第一行\r\n第二行\n', time)

        expect(lines.map(l => l.value)).toEqual(['第一行', '第二行'])
        expect(buffer.pending).toBe('')
    })

    test('没有换行的内容作为当前行保留', () => {
        const buffer = new LineBuffer()

        expect(buffer.consume('login: ', time)).toEqual([])
        expect(buffer.pending).toBe('login: ')

        expect(buffer.consume('root\n', time).map(l => l.value)).toEqual(['login: root'])
        expect(buffer.pending).toBe('')
    })

    test('单独的 \\r 是回车覆盖，不是换行', () => {
        const buffer = new LineBuffer()

        expect(buffer.consume('10%\r20%\r30%', time)).toEqual([])
        expect(buffer.pending).toBe('30%')
    })

    test('回车后用更长的内容覆盖', () => {
        const buffer = new LineBuffer()

        buffer.consume('Loading...\r', time)
        buffer.consume('Done!\n', time)

        expect(buffer.pending).toBe('')
    })

    test('跨数据块拼接完整行', () => {
        const buffer = new LineBuffer()

        buffer.consume('abc', time)
        const lines = buffer.consume('def\r\n', time)

        expect(lines.map(l => l.value)).toEqual(['abcdef'])
    })

    test('超长行会被强制截断', () => {
        const buffer = new LineBuffer({ maxLineLength: 4 })
        const lines = buffer.consume('abcdefghij', time)

        expect(lines.map(l => l.value)).toEqual(['abcd', 'efgh'])
        expect(buffer.pending).toBe('ij')
    })

    test('reset 清空当前行', () => {
        const buffer = new LineBuffer()

        buffer.consume('未完成的一行', time)
        buffer.reset()

        expect(buffer.pending).toBe('')
    })
})
