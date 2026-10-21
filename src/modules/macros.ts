/**
 * 命令宏：常用命令的快捷入口。
 *
 * 和设置一样必须能被校验——数组长度、字段类型、超长内容都要收住，
 * 不能让 localStorage 里的脏数据直接进渲染或发送链路。
 */

import type { Macro } from '../types'
import { readJSON, writeJSON } from './storage'

const STORAGE_KEY = 'macros'

export const MAX_MACROS = 30
export const MAX_NAME_LENGTH = 24
export const MAX_PAYLOAD_LENGTH = 2048

const makeId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

const EMPTY_MACRO: Macro = {
    id: '',
    name: '',
    payload: '',
    hex: false,
    appendLineEnding: true,
}

export function createMacro(overrides: Partial<Macro> = {}): Macro {
    return { ...EMPTY_MACRO, id: makeId(), ...overrides }
}

/** index 用于给没起名字的宏兜一个默认名 */
export function normalizeMacro(raw: unknown, index = 0): Macro {
    const source = raw !== null && typeof raw === 'object' ? raw as Record<string, unknown> : {}

    const name = typeof source.name === 'string' ? source.name.trim().slice(0, MAX_NAME_LENGTH) : ''
    const payload = typeof source.payload === 'string' ? source.payload.slice(0, MAX_PAYLOAD_LENGTH) : ''

    return {
        id: typeof source.id === 'string' && source.id !== '' ? source.id : makeId(),
        name: name === '' ? `宏 ${index + 1}` : name,
        payload: payload,
        hex: source.hex === true,
        appendLineEnding: source.appendLineEnding !== false,
    }
}

export function normalizeMacros(raw: unknown): Macro[] {
    if (!Array.isArray(raw)) return []

    return raw.slice(0, MAX_MACROS).map(normalizeMacro)
}

export function loadMacros(): Macro[] {
    return normalizeMacros(readJSON<unknown>(STORAGE_KEY, []))
}

export function saveMacros(macros: unknown): Macro[] {
    const normalized = normalizeMacros(macros)

    writeJSON(STORAGE_KEY, normalized)

    return normalized
}
