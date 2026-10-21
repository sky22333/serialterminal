/**
 * DTR / RTS 信号控制：Arduino 的自动复位电路接在 DTR 上，ESP32 / ESP8266
 * 的自动下载电路同时用 DTR 和 RTS 控制 EN、IO0。
 *
 * 时序放在这里而不是组件里，既能单独测试，也免得 UI 里塞一堆 setTimeout。
 * 能不能用完全取决于板子电路和驱动，失败要如实告诉用户。
 */

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

export type SignalActionId = 'dtr-pulse' | 'rts-pulse' | 'esp-boot'

export interface SignalAction {
    id: SignalActionId
    label: string
    hint: string
}

/** 只依赖 setSignals，测试里给个假对象就够 */
export interface SignalTarget {
    setSignals: (signals: SerialOutputSignals) => Promise<string>
}

interface SignalStep {
    signals: SerialOutputSignals
    wait?: number
}

export const SIGNAL_ACTIONS: readonly SignalAction[] = [
    {
        id: 'dtr-pulse',
        label: 'DTR 脉冲',
        hint: '把 DTR 拉低 120ms 再拉高，多数 Arduino 板会复位',
    },
    {
        id: 'rts-pulse',
        label: 'RTS 脉冲',
        hint: '把 RTS 拉低 120ms 再拉高，部分开发板用它控制复位',
    },
    {
        id: 'esp-boot',
        label: 'ESP 进入下载模式',
        hint: '按 DTR/RTS 时序复位进 bootloader，需要板子上有自动下载电路',
    },
]

const SEQUENCES: Record<SignalActionId, readonly SignalStep[]> = {
    'dtr-pulse': [
        { signals: { dataTerminalReady: false }, wait: 120 },
        { signals: { dataTerminalReady: true } },
    ],
    'rts-pulse': [
        { signals: { requestToSend: false }, wait: 120 },
        { signals: { requestToSend: true } },
    ],
    'esp-boot': [
        { signals: { dataTerminalReady: false, requestToSend: true }, wait: 120 },
        { signals: { dataTerminalReady: true, requestToSend: false }, wait: 80 },
        { signals: { dataTerminalReady: false, requestToSend: false } },
    ],
}

/**
 * 执行一组信号时序，出错即中止。
 * @returns 空字符串表示成功，否则是给用户看的错误文案
 */
export async function runSignalAction(serial: SignalTarget, id: string): Promise<string> {
    // 入参来自界面，可能是任何字符串
    const steps = (SEQUENCES as Record<string, readonly SignalStep[] | undefined>)[id]

    if (!steps) return '未知的信号操作'

    for (const step of steps) {
        const error = await serial.setSignals(step.signals)

        if (error) return error

        if (step.wait) await sleep(step.wait)
    }

    return ''
}
