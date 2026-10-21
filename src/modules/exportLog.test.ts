import { serializeLog } from './exportLog'
import type { Line } from '../types'

const time = new Date(2026, 9, 21, 8, 3, 7)

const lines: Line[] = [
    { type: 'output', value: '\u001b[32mready\u001b[0m', time },
    { type: 'userInput', value: 'help', time },
    { type: 'output', value: 'a,b', time },
]

describe('serializeLog', () => {
    test('txt：带方向与时间戳，去掉颜色控制符', () => {
        const text = serializeLog(lines, { format: 'txt', time: true })
        expect(text).toContain('[08:03:07] RX ready')
        expect(text).toContain('[08:03:07] TX help')
        expect(text).not.toContain('\u001b')
    })

    test('txt：可以不带时间戳', () => {
        const text = serializeLog(lines, { format: 'txt', time: false })
        expect(text).toContain('RX ready')
        expect(text).not.toContain('[08:03:07]')
    })

    test('可以排除自己发送的内容', () => {
        const text = serializeLog(lines, { format: 'txt', input: false })
        expect(text).not.toContain('TX help')
        expect(text).toContain('RX ready')
    })

    test('csv：含逗号的内容会被引号包住', () => {
        const text = serializeLog(lines, { format: 'csv' })
        const rows = text.split('\r\n')
        expect(rows[0]).toBe('时间,方向,内容')
        expect(rows).toContain('"08:03:07","RX","a,b"')
    })

    test('json：结构完好且方向小写', () => {
        const parsed = JSON.parse(serializeLog(lines, { format: 'json' }))
        expect(parsed.count).toBe(3)
        expect(parsed.entries[1].direction).toBe('tx')
        expect(parsed.entries[0].text).toBe('ready')
    })

    test('md：表格里转义竖线', () => {
        const text = serializeLog(
            [{ type: 'output', value: 'a|b', time }],
            { format: 'md' }
        )
        expect(text).toContain('| 08:03:07 | RX | a\\|b |')
    })
})
