import { describe, expect, test, vi, afterEach } from 'vitest'

import { SIGNAL_ACTIONS, runSignalAction } from './signals'

afterEach(() => {
    vi.useRealTimers()
})

const fakeSerial = (error = '') => ({
    setSignals: vi.fn().mockResolvedValue(error),
})

describe('SIGNAL_ACTIONS', () => {
    test('每个动作都有文案和说明，id 不重复', () => {
        expect(SIGNAL_ACTIONS.length).toBeGreaterThan(0)

        const ids = SIGNAL_ACTIONS.map(action => action.id)
        expect(new Set(ids).size).toBe(ids.length)

        for (const action of SIGNAL_ACTIONS) {
            expect(action.label).toBeTruthy()
            expect(action.hint).toBeTruthy()
        }
    })
})

describe('runSignalAction', () => {
    test('DTR 脉冲先拉低、等一下、再拉高', async () => {
        vi.useFakeTimers()

        const serial = fakeSerial()
        const task = runSignalAction(serial, 'dtr-pulse')

        await vi.runAllTimersAsync()
        expect(await task).toBe('')

        expect(serial.setSignals.mock.calls.map(call => call[0])).toEqual([
            { dataTerminalReady: false },
            { dataTerminalReady: true },
        ])
    })

    test('ESP 下载模式是三步时序，最后两个信号都释放', async () => {
        vi.useFakeTimers()

        const serial = fakeSerial()
        const task = runSignalAction(serial, 'esp-boot')

        await vi.runAllTimersAsync()
        await task

        const calls = serial.setSignals.mock.calls.map(call => call[0])

        expect(calls).toHaveLength(3)
        expect(calls[0]).toEqual({ dataTerminalReady: false, requestToSend: true })
        expect(calls[2]).toEqual({ dataTerminalReady: false, requestToSend: false })
    })

    test('出错就停下，并原样带回原因', async () => {
        vi.useFakeTimers()

        const serial = fakeSerial('设置信号失败：not supported')
        const task = runSignalAction(serial, 'dtr-pulse')

        await vi.runAllTimersAsync()

        expect(await task).toBe('设置信号失败：not supported')
        // 只发了第一步就中止
        expect(serial.setSignals).toHaveBeenCalledTimes(1)
    })

    test('未知动作直接返回错误', async () => {
        const serial = fakeSerial()

        expect(await runSignalAction(serial, 'nope')).toBe('未知的信号操作')
        expect(serial.setSignals).not.toHaveBeenCalled()
    })
})
