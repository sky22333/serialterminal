/**
 * 把连续的字节流切成 16 字节一行的 HEX dump。
 *
 * 文本视图按行尾切分、HEX 视图按字节数切分，两者互不干扰，
 * 所以切换视图既不丢数据，也不会互相影响。
 */

import type { Line } from '../types'
import { BYTES_PER_ROW, formatHexRow } from './hex'

export const MAX_HEX_ROWS = 20000

export interface HexBufferOptions {
    bytesPerRow?: number
}

export default class HexBuffer {
    readonly bytesPerRow: number

    /** 已接收的总字节数，同时作为下一行的起始偏移 */
    offset = 0

    private readonly row: Uint8Array
    private rowLength = 0
    private rowOffset = 0

    constructor(options: HexBufferOptions = {}) {
        this.bytesPerRow = options.bytesPerRow || BYTES_PER_ROW
        this.row = new Uint8Array(this.bytesPerRow)
    }

    reset(): void {
        this.offset = 0
        this.rowLength = 0
        this.rowOffset = 0
    }

    push(bytes: Uint8Array, time: Date): Line[] {
        const rows: Line[] = []
        let at = 0

        while (at < bytes.length) {
            if (this.rowLength === 0) this.rowOffset = this.offset

            const take = Math.min(this.bytesPerRow - this.rowLength, bytes.length - at)

            this.row.set(bytes.subarray(at, at + take), this.rowLength)

            this.rowLength += take
            this.offset += take
            at += take

            if (this.rowLength === this.bytesPerRow) rows.push(this.flushRow(time))
        }

        return rows
    }

    /** 把不满一行的残余收成一行（断开连接时调用，避免最后半行消失） */
    flush(time: Date): Line | null {
        if (this.rowLength === 0) return null

        return this.flushRow(time)
    }

    /** 还没凑满一行的内容，用于实时显示 */
    get pending(): string {
        if (this.rowLength === 0) return ''

        return formatHexRow(this.row.subarray(0, this.rowLength), this.rowOffset)
    }

    private flushRow(time: Date): Line {
        const value = formatHexRow(this.row.subarray(0, this.rowLength), this.rowOffset)

        this.rowLength = 0

        return { type: 'output', value: value, time: time }
    }
}
