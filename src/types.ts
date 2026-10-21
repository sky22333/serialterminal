/**
 * 跨模块共享的纯数据类型。不 import 任何模块，避免组件 / hooks / modules
 * 之间为了一个类型互相引用绕成环。
 */

/** 键是设置里存的值，值是真正发送的字符 */
export type LineEndingKey = 'None' | '\\n' | '\\r' | '\\r\\n'

export type LineType = 'output' | 'userInput'

export interface Line {
    type: LineType
    value: string
    time: Date
}

export type InputMode = 'text' | 'hex'

export interface Settings {
    baudRate: number
    lineEnding: LineEndingKey
    echoFlag: boolean
    timeFlag: boolean
    ctrlFlag: boolean
    ansiFlag: boolean
    wrapFlag: boolean
    hexView: boolean
}

export interface Macro {
    id: string
    name: string
    payload: string
    hex: boolean
    /** HEX 内容不追加行尾符 */
    appendLineEnding: boolean
}

export interface TimerConfig {
    intervalMs: number
    payload: string
    hex: boolean
}

export interface TimerStatus {
    running: boolean
    intervalMs: number
    count: number
}

export interface PortIdentity {
    usbVendorId: number
    usbProductId: number | null
}

/** 与 MUI Alert 的 severity 对齐 */
export type ToastSeverity = 'success' | 'info' | 'warning' | 'error'

export interface Toast {
    open: boolean
    severity: ToastSeverity
    value: string
}

export interface SendOptions {
    /** 定时发送要关掉，否则会刷满屏幕 */
    echo?: boolean
    ending?: boolean
    /** 是否记进发送历史 */
    remember?: boolean
}
