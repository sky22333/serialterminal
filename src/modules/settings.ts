/**
 * 设置的默认值、校验与持久化。
 *
 * localStorage 里的内容用户能随手改，也可能是旧版本写进去的结构，
 * 所以任何一项不合法都要落回默认值，而不是让 `baudRate: "???"` 一路传到
 * port.open() 里才炸。
 */

import type { LineEndingKey, Settings } from '../types'
import { readJSON, writeJSON } from './storage'

const STORAGE_KEY = 'settings'

// Web Serial 允许的范围
export const BAUD_MIN = 50
export const BAUD_MAX = 4000000

/** 行尾符：键是设置里存的值，值是真正发送的字符 */
export const LINE_ENDINGS: Record<LineEndingKey, string> = {
    'None': '',
    '\\n': '\n',
    '\\r': '\r',
    '\\r\\n': '\r\n',
}

export const DEFAULT_SETTINGS: Settings = {
    baudRate: 115200,
    lineEnding: '\\r\\n',
    echoFlag: true,
    timeFlag: false,
    ctrlFlag: true,
    ansiFlag: true,
    wrapFlag: true,
    hexView: false,
}

const BOOLEAN_KEYS = ['echoFlag', 'timeFlag', 'ctrlFlag', 'ansiFlag', 'wrapFlag', 'hexView'] as const

const isLineEndingKey = (value: unknown): value is LineEndingKey =>
    typeof value === 'string' && Object.hasOwn(LINE_ENDINGS, value)

/** 对象就取出来，其它一律当成空对象——后面每一项都会各自兜底 */
const asRecord = (value: unknown): Record<string, unknown> =>
    value !== null && typeof value === 'object' ? value as Record<string, unknown> : {}

export function lineEndingValue(key: LineEndingKey): string {
    return LINE_ENDINGS[key] ?? ''
}

export function normalizeSettings(raw: unknown): Settings {
    const source = asRecord(raw)
    const settings: Settings = { ...DEFAULT_SETTINGS }

    const baudRate = Number(source.baudRate)
    if (Number.isInteger(baudRate) && baudRate >= BAUD_MIN && baudRate <= BAUD_MAX) {
        settings.baudRate = baudRate
    }

    if (isLineEndingKey(source.lineEnding)) {
        settings.lineEnding = source.lineEnding
    }

    for (const key of BOOLEAN_KEYS) {
        if (typeof source[key] === 'boolean') settings[key] = source[key]
    }

    return settings
}

export function loadSettings(): Settings {
    return normalizeSettings(readJSON<unknown>(STORAGE_KEY, null))
}

/** 返回实际存下去的那份经过校验的值 */
export function saveSettings(settings: unknown): Settings {
    const normalized = normalizeSettings(settings)

    writeJSON(STORAGE_KEY, normalized)

    return normalized
}
