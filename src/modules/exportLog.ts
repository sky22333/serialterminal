/**
 * 把终端里的行导出成 txt / csv / json / md。
 * 导出前统一 stripAnsi，避免文件里混进 `^[[32m`。
 */

import type { Line } from '../types'
import { stripAnsi } from './ansiParser'

export type LogFormat = 'txt' | 'csv' | 'json' | 'md'

const MIME: Record<LogFormat, string> = {
    txt: 'text/plain;charset=utf-8',
    csv: 'text/csv;charset=utf-8',
    json: 'application/json;charset=utf-8',
    md: 'text/markdown;charset=utf-8',
}

const pad2 = (n: number) => `${n}`.padStart(2, '0')

export const formatTime = (date: Date | null): string => {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return ''
    return `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`
}

const formatDateTime = (date: Date): string => {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return ''
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} `
        + `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`
}

// 文件名里不能有冒号
const fileStamp = (date: Date): string => `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}`
    + `-${pad2(date.getHours())}${pad2(date.getMinutes())}${pad2(date.getSeconds())}`

export interface SerializeOptions {
    format?: LogFormat
    time?: boolean
    input?: boolean
}

interface Entry {
    time: Date | null
    dir: 'RX' | 'TX'
    text: string
}

const directionOf = (line: Line): 'RX' | 'TX' => (line.type === 'userInput' ? 'TX' : 'RX')

const normalize = (lines: readonly Line[], options: SerializeOptions): Entry[] => {
    const includeInput = options.input !== false

    return lines
        .filter(line => line.type === 'output' || (includeInput && line.type === 'userInput'))
        .map(line => ({
            time: line.time instanceof Date ? line.time : null,
            dir: directionOf(line),
            text: stripAnsi(line.value === undefined || line.value === null ? '' : line.value),
        }))
}

const csvCell = (value: string) => `"${value.replace(/"/g, '""')}"`

const mdCell = (value: string) => value.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>')

export function serializeLog(lines: readonly Line[], options: SerializeOptions = {}): string {
    const format = options.format ?? 'txt'
    const withTime = options.time !== false
    const entries = normalize(lines, options)
    const exportedAt = formatDateTime(new Date())

    if (format === 'csv') {
        const head = '时间,方向,内容'
        const rows = entries.map(e => [
            csvCell(withTime ? formatTime(e.time) : ''),
            csvCell(e.dir),
            csvCell(e.text),
        ].join(','))
        return [head, ...rows].join('\r\n')
    }

    if (format === 'json') {
        return JSON.stringify({
            exportedAt: new Date().toISOString(),
            count: entries.length,
            entries: entries.map(e => ({
                time: e.time ? e.time.toISOString() : null,
                direction: e.dir.toLowerCase(),
                text: e.text,
            })),
        }, null, 2)
    }

    if (format === 'md') {
        const rows = entries.map(e => `| ${withTime ? formatTime(e.time) : ''} | ${e.dir} | ${mdCell(e.text)} |`)
        return [
            '# 串口日志',
            '',
            `- 导出时间：${exportedAt}`,
            `- 总行数：${entries.length}`,
            '',
            '| 时间 | 方向 | 内容 |',
            '| --- | --- | --- |',
            ...rows,
            '',
        ].join('\n')
    }

    const rows = entries.map(e => (withTime ? `[${formatTime(e.time)}] ${e.dir} ${e.text}` : `${e.dir} ${e.text}`))
    return [
        `# 串口日志 导出时间 ${exportedAt} 共 ${entries.length} 行`,
        ...rows,
        '',
    ].join('\n')
}

/** 触发浏览器下载，返回实际使用的文件名 */
export function downloadLog(lines: readonly Line[], options: SerializeOptions = {}): string {
    const format: LogFormat = options.format && options.format in MIME ? options.format : 'txt'
    let body = serializeLog(lines, { ...options, format })

    // Excel 需要 BOM 才认 UTF-8
    if (format === 'csv') body = `\ufeff${body}`

    const blob = new Blob([body], { type: MIME[format] })
    const url = URL.createObjectURL(blob)
    const name = `serial-log-${fileStamp(new Date())}.${format}`

    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = name
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()

    // 立刻 revoke 在部分浏览器上会取消下载，延后一点
    window.setTimeout(() => URL.revokeObjectURL(url), 2000)

    return name
}
