/**
 * ANSI 转义序列处理。
 *
 * 只保留改样式的 SGR（\x1b[32m、\x1b[1;31m…），清行 / 清屏 / 归位这类
 * 光标控制直接丢弃；不处理的话界面上会冒出 `^[[32m` 这种乱码。
 */

import type { CSSProperties } from 'react'

const DEFAULT_FG = '#e8eaed'
const DEFAULT_BG = '#202124'

// 按深色终端观感调亮过：纯 #000 / #fff 在 #202124 背景上不好读
const BASE_COLORS = [
    '#3c4043',
    '#f28b82',
    '#81c995',
    '#fdd663',
    '#8ab4f8',
    '#c58af9',
    '#78d9ec',
    '#e8eaed',
]

const BRIGHT_COLORS = [
    '#5f6368',
    '#ff8a80',
    '#a8e6a1',
    '#ffe082',
    '#aecbfa',
    '#dcb8fd',
    '#9ce8f7',
    '#ffffff',
]

const hex2 = (n: number) => n.toString(16).padStart(2, '0')

// xterm 的 256 色表：16 基础色 + 6×6×6 色立方 + 24 级灰阶
const PALETTE_256: string[] = (() => {
    const list = [...BASE_COLORS, ...BRIGHT_COLORS]
    const steps = [0, 95, 135, 175, 215, 255]

    for (let r = 0; r < 6; r++) {
        for (let g = 0; g < 6; g++) {
            for (let b = 0; b < 6; b++) {
                list.push(`#${hex2(steps[r])}${hex2(steps[g])}${hex2(steps[b])}`)
            }
        }
    }

    for (let i = 0; i < 24; i++) {
        const v = 8 + i * 10
        list.push(`#${hex2(v)}${hex2(v)}${hex2(v)}`)
    }

    return list
})()

// CSI / OSC / 其它两字符转义序列。一个正则覆盖，避免逐字符扫。
// ESC(0x1b)、BEL(0x07) 这类控制字符正是要被匹配的对象，所以这里必须关掉该规则
// eslint-disable-next-line no-control-regex
const ANSI_RE = /\u001b\[[0-9;:?]*[ -/]*[@-~]|\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)|\u001b[()#][0-9A-Za-z]|\u001b[@-Z\\-_]/g

interface AnsiState {
    fg: string | null
    bg: string | null
    bold: boolean
    dim: boolean
    italic: boolean
    underline: boolean
    inverse: boolean
}

/** 样式为 null 表示用默认样式 */
export interface AnsiSegment {
    text: string
    style: CSSProperties | null
}

const createState = (): AnsiState => ({
    fg: null,
    bg: null,
    bold: false,
    dim: false,
    italic: false,
    underline: false,
    inverse: false,
})

const clampByte = (n: number) => Math.max(0, Math.min(255, n | 0))

const applyCodes = (raw: string, state: AnsiState): AnsiState => {
    if (raw === '') {
        return createState()
    }

    const tokens = raw.split(/[;:]/)

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i]
        if (token === '') continue

        const code = parseInt(token, 10)
        if (Number.isNaN(code)) continue

        if (code === 0) {
            Object.assign(state, createState())
        } else if (code === 1) {
            state.bold = true
        } else if (code === 2) {
            state.dim = true
        } else if (code === 3) {
            state.italic = true
        } else if (code === 4) {
            state.underline = true
        } else if (code === 7) {
            state.inverse = true
        } else if (code === 21 || code === 22) {
            state.bold = false
            state.dim = false
        } else if (code === 23) {
            state.italic = false
        } else if (code === 24) {
            state.underline = false
        } else if (code === 27) {
            state.inverse = false
        } else if (code >= 30 && code <= 37) {
            state.fg = BASE_COLORS[code - 30]
        } else if (code === 39) {
            state.fg = null
        } else if (code >= 40 && code <= 47) {
            state.bg = BASE_COLORS[code - 40]
        } else if (code === 49) {
            state.bg = null
        } else if (code >= 90 && code <= 97) {
            state.fg = BRIGHT_COLORS[code - 90]
        } else if (code >= 100 && code <= 107) {
            state.bg = BRIGHT_COLORS[code - 100]
        } else if (code === 38 || code === 48) {
            // 扩展色：38;5;n（256 色）或 38;2;r;g;b（真彩色）
            const isForeground = code === 38
            const mode = parseInt(tokens[i + 1], 10)

            if (mode === 5) {
                const index = parseInt(tokens[i + 2], 10)
                const color = PALETTE_256[index]
                if (color) {
                    if (isForeground) state.fg = color
                    else state.bg = color
                }
                i += 2
            } else if (mode === 2) {
                const rgb: number[] = []
                let j = i + 2

                while (rgb.length < 3 && j < tokens.length) {
                    if (tokens[j] !== '') rgb.push(parseInt(tokens[j], 10))
                    j++
                }

                if (rgb.length === 3 && rgb.every(n => !Number.isNaN(n))) {
                    const color = `#${hex2(clampByte(rgb[0]))}${hex2(clampByte(rgb[1]))}${hex2(clampByte(rgb[2]))}`
                    if (isForeground) state.fg = color
                    else state.bg = color
                }

                i = j - 1
            } else {
                i += 1
            }
        }
    }

    return state
}

const toStyle = (state: AnsiState): CSSProperties | null => {
    let fg = state.fg
    let bg = state.bg

    if (state.inverse) {
        const tmp = fg || DEFAULT_FG
        fg = bg || DEFAULT_BG
        bg = tmp
    }

    const style: CSSProperties = {}

    if (fg) style.color = fg
    if (bg) style.backgroundColor = bg
    if (state.bold) style.fontWeight = 700
    if (state.dim) style.opacity = .65
    if (state.italic) style.fontStyle = 'italic'
    if (state.underline) style.textDecoration = 'underline'

    return Object.keys(style).length > 0 ? style : null
}

/** 把一段可能带 ANSI 的文本切成若干片段，每段带自己的样式 */
export function parseAnsi(input: unknown): AnsiSegment[] {
    const text = `${input}`
    const segments: AnsiSegment[] = []
    let state = createState()
    let last = 0

    const push = (chunk: string) => {
        if (!chunk) return
        segments.push({ text: chunk, style: toStyle(state) })
    }

    for (const match of text.matchAll(ANSI_RE)) {
        const at = match.index ?? 0

        if (at > last) push(text.slice(last, at))

        const seq = match[0]

        // 只有 SGR（以 m 结尾）会改样式，其余是光标/清屏控制，丢弃
        if (seq.startsWith('\u001b[') && seq.endsWith('m')) {
            state = applyCodes(seq.slice(2, -1), state)
        }

        last = at + seq.length
    }

    if (last < text.length) push(text.slice(last))

    if (segments.length === 0) segments.push({ text: '', style: null })

    return segments
}

/** 去掉所有转义序列，只留可读文本（导出、搜索、复制时用） */
export function stripAnsi(input: unknown): string {
    return `${input}`.replace(ANSI_RE, '')
}
