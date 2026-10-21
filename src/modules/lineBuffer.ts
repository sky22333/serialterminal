/**
 * 把串口收到的文本流切成「行」，兼容 \r\n、\n 和单独的 \r。
 *
 * 单独的 \r 按终端语义当成「回车」：光标回到行首、后续字符覆盖原内容，
 * 这样进度条、刷新式输出不会被撑成几十行。
 */

import type { Line } from '../types'

const MAX_LINE_LENGTH = 8192

export interface LineBufferOptions {
    maxLineLength?: number
}

export default class LineBuffer {
    readonly maxLineLength: number

    private buffer = ''
    private cursor = 0

    constructor(options: LineBufferOptions = {}) {
        this.maxLineLength = options.maxLineLength || MAX_LINE_LENGTH
    }

    reset(): void {
        this.buffer = ''
        this.cursor = 0
    }

    get pending(): string {
        return this.buffer
    }

    consume(text: string, time: Date): Line[] {
        const lines: Line[] = []
        const str = `${text}`
        let i = 0

        while (i < str.length) {
            const cr = str.indexOf('\r', i)
            const lf = str.indexOf('\n', i)

            let next: number
            if (cr === -1) next = lf
            else if (lf === -1) next = cr
            else next = Math.min(cr, lf)

            // 没有行尾了，剩下的都属于当前行
            if (next === -1) {
                this.append(str.slice(i), lines, time)
                break
            }

            this.append(str.slice(i, next), lines, time)

            if (str[next] === '\r' && str[next + 1] === '\n') {
                lines.push(this.flushLine(time))
                i = next + 2
            } else if (str[next] === '\r') {
                // 单独的回车：光标回到行首，但不换行
                this.cursor = 0
                i = next + 1
            } else {
                lines.push(this.flushLine(time))
                i = next + 1
            }
        }

        return lines
    }

    private append(segment: string, lines: Line[], time: Date): void {
        if (!segment) return

        if (this.cursor >= this.buffer.length) {
            this.buffer += segment
            this.cursor = this.buffer.length
        } else {
            // 光标在行中间：覆盖写入
            const head = this.buffer.slice(0, this.cursor)
            const tail = this.buffer.slice(this.cursor + segment.length)
            this.buffer = head + segment + tail
            this.cursor = head.length + segment.length
        }

        // 超长行强制截断，避免单个字符串无限增长拖垮渲染
        while (this.buffer.length >= this.maxLineLength) {
            const chunk = this.buffer.slice(0, this.maxLineLength)
            this.buffer = this.buffer.slice(this.maxLineLength)
            this.cursor = Math.max(0, this.cursor - this.maxLineLength)
            lines.push({ type: 'output', value: chunk, time })
        }
    }

    private flushLine(time: Date): Line {
        const value = this.buffer
        this.buffer = ''
        this.cursor = 0
        return { type: 'output', value, time }
    }
}
