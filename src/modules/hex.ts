/**
 * HEX 收发相关的纯函数：把各种写法的十六进制文本解析成字节，
 * 再把字节格式化成可读的 dump。只跟字节有关，与 React、串口无关。
 */

export const BYTES_PER_ROW = 16
export const MAX_HEX_BYTES = 4096

// 允许的分隔符：空格、换行、逗号、冒号、短横线
const SEPARATORS = /[\s,:-]+/g
// 只去掉紧跟在开头或分隔符后面的 0x，避免把 f0x1 这类内容误伤
const PREFIX = /(^|[\s,:-])0[xX]/g
const HEX_ONLY = /^[0-9a-fA-F]*$/

export interface ParseHexResult {
    bytes: Uint8Array | null
    /** 空字符串表示成功，否则是给用户看的中文说明 */
    error: string
}

export interface ParseHexOptions {
    maxBytes?: number
}

/**
 * 入参用 unknown：内容来自输入框和 localStorage，任何东西都可能传进来，
 * 校验必须在这里收住。
 */
export function parseHex(input: unknown, options: ParseHexOptions = {}): ParseHexResult {
    const maxBytes = options.maxBytes === undefined ? MAX_HEX_BYTES : options.maxBytes
    const raw = input === undefined || input === null ? '' : `${input}`

    const cleaned = raw.replace(PREFIX, '$1').replace(SEPARATORS, '')

    if (cleaned === '') {
        return { bytes: null, error: '请输入要发送的十六进制内容' }
    }

    if (!HEX_ONLY.test(cleaned)) {
        const invalid = cleaned.match(/[^0-9a-fA-F]/)
        return { bytes: null, error: `包含非十六进制字符「${invalid ? invalid[0] : ''}」` }
    }

    if (cleaned.length % 2 !== 0) {
        return { bytes: null, error: `十六进制位数必须是偶数，当前 ${cleaned.length} 位` }
    }

    const length = cleaned.length / 2

    if (length > maxBytes) {
        return { bytes: null, error: `一次最多发送 ${maxBytes} 字节，当前 ${length} 字节` }
    }

    const bytes = new Uint8Array(length)

    for (let i = 0; i < length; i++) {
        bytes[i] = Number.parseInt(cleaned.slice(i * 2, i * 2 + 2), 16)
    }

    return { bytes: bytes, error: '' }
}

export function bytesToHex(bytes: Uint8Array | null | undefined, separator = ' '): string {
    if (!bytes) return ''

    const parts = new Array<string>(bytes.length)

    for (let i = 0; i < bytes.length; i++) {
        parts[i] = bytes[i].toString(16).toUpperCase().padStart(2, '0')
    }

    return parts.join(separator)
}

/** 回显用：太长时截断，避免一条命令把终端刷满 */
export function hexPreview(bytes: Uint8Array | null | undefined, max = 32): string {
    if (!bytes) return ''

    if (bytes.length <= max) return bytesToHex(bytes)

    return `${bytesToHex(bytes.subarray(0, max))} …（共 ${bytes.length} 字节）`
}

/**
 * 格式化成标准 dump（最多 16 字节）：
 *   00000000  48 65 6C 6C 6F 00 00 00  00 00 00 00 00 00 00 00  |Hello...........|
 * offset 是这行第一个字节在整个数据流里的位置。
 */
export function formatHexRow(bytes: Uint8Array, offset = 0): string {
    const hex = new Array<string>(BYTES_PER_ROW)
    const ascii = new Array<string>(BYTES_PER_ROW)

    for (let i = 0; i < BYTES_PER_ROW; i++) {
        if (i < bytes.length) {
            const byte = bytes[i]

            hex[i] = byte.toString(16).toUpperCase().padStart(2, '0')
            ascii[i] = byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : '.'
        } else {
            // 补空格而不是补 00，宽度保持一致又不会让人误以为真有这些字节
            hex[i] = '  '
            ascii[i] = ' '
        }
    }

    const left = hex.slice(0, 8).join(' ')
    const right = hex.slice(8).join(' ')
    const address = offset.toString(16).toUpperCase().padStart(8, '0')

    return `${address}  ${left}  ${right}  |${ascii.join('')}|`
}
