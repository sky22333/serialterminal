import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, test, vi, beforeEach } from 'vitest'

import App from './App'

const DEVICE: SerialPortInfo = { usbVendorId: 0x1a86, usbProductId: 0x7523 }

type ReadResult = { value: Uint8Array | undefined; done: boolean }

/**
 * 一个能手动喂数据的假串口设备，行为对齐 Web Serial 的 SerialPort
 */
const makeReader = () => {
    const queue: Uint8Array[] = []
    let waiting: ((result: ReadResult) => void) | null = null

    return {
        push(value: Uint8Array) {
            if (waiting) {
                const resolve = waiting
                waiting = null
                resolve({ value: value, done: false })
            } else {
                queue.push(value)
            }
        },
        read(): Promise<ReadResult> {
            if (queue.length > 0) return Promise.resolve({ value: queue.shift(), done: false })
            return new Promise(resolve => { waiting = resolve })
        },
        cancel() {
            if (waiting) {
                const resolve = waiting
                waiting = null
                resolve({ value: undefined, done: true })
            }
            return Promise.resolve()
        },
        releaseLock() { },
    }
}

let reader: ReturnType<typeof makeReader>
let port: ReturnType<typeof createPort>
let writes: number[][]

const createPort = () => {
    const listeners: Record<string, () => void> = {}

    return {
        open: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        setSignals: vi.fn().mockResolvedValue(undefined),
        getInfo: () => DEVICE,
        addEventListener: (type: string, fn: () => void) => { listeners[type] = fn },
        removeEventListener: () => { },
        listeners: listeners,
        readable: { getReader: () => reader },
        writable: {
            getWriter: () => ({
                write: async (chunk: Uint8Array) => { writes.push(Array.from(chunk)) },
                releaseLock: () => { },
            }),
        },
    }
}

// 把写出的字节拼成字符串，方便断言文本发送
const written = () => writes.map(bytes => String.fromCharCode(...bytes)).join('')

const readStored = (key: string): unknown =>
    JSON.parse(window.localStorage.getItem(`serialterminal.${key}`) ?? 'null')

const connect = async () => {
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: '连接设备' }))
    await screen.findByLabelText('导出日志')
}

let requestPort: ReturnType<typeof vi.fn>
let getPorts: ReturnType<typeof vi.fn>

beforeEach(() => {
    window.localStorage.clear()

    reader = makeReader()
    writes = []
    port = createPort()

    requestPort = vi.fn(async () => port)
    getPorts = vi.fn(async () => [port])

    Object.defineProperty(navigator, 'serial', {
        configurable: true,
        value: { requestPort, getPorts },
    })
})

describe('App 完整链路', () => {
    test('首次连接：点击连接设备 → 进入终端 → 收到数据 → 断开', async () => {
        await connect()

        expect(port.open).toHaveBeenCalledWith({ baudRate: 115200 })

        reader.push(new TextEncoder().encode('boot ok\r\nhello\r\n'))

        await waitFor(() => expect(screen.getByText('boot ok')).toBeInTheDocument())
        expect(screen.getByText('hello')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: /断开/ }))

        await screen.findByRole('button', { name: '连接设备' })
    })

    test('已授权设备：跳过选择器一键重连，并且记住这台设备', async () => {
        await connect()

        expect(readStored('lastPort')).toEqual(DEVICE)

        fireEvent.click(screen.getByRole('button', { name: /断开/ }))
        await screen.findByRole('button', { name: '连接设备' })

        // 断开后应该出现「继续使用 xxx」，点击即直接打开，不再弹选择器
        const reconnect = await screen.findByRole('button', { name: /继续使用 USB 1A86:7523/ })

        requestPort.mockClear()
        fireEvent.click(reconnect)

        await screen.findByLabelText('导出日志')

        expect(requestPort).not.toHaveBeenCalled()
        expect(port.open).toHaveBeenCalledTimes(2)
    })

    test('文本发送：按设置的行尾符写出，并回显', async () => {
        await connect()

        fireEvent.change(screen.getByLabelText('输入'), { target: { value: 'ping' } })
        fireEvent.click(screen.getByRole('button', { name: '发送' }))

        await waitFor(() => expect(written()).toBe('ping\r\n'))
        expect(screen.getByText('ping')).toBeInTheDocument()
    })

    test('HEX 发送：把输入解析成字节，而不是发字符串', async () => {
        await connect()

        fireEvent.click(screen.getByRole('button', { name: 'HEX 输入' }))

        const input = screen.getByLabelText('输入')
        fireEvent.change(input, { target: { value: '48 65 6C 6C 6F' } })
        fireEvent.click(screen.getByRole('button', { name: '发送' }))

        await waitFor(() => expect(writes).toEqual([[0x48, 0x65, 0x6C, 0x6C, 0x6F]]))
        // 回显里标出这是 HEX，避免和文本混淆
        expect(screen.getByText(/HEX 48 65 6C 6C 6F/)).toBeInTheDocument()
    })

    test('HEX 输入不合法时拒绝发送并提示原因', async () => {
        await connect()

        fireEvent.click(screen.getByRole('button', { name: 'HEX 输入' }))
        fireEvent.change(screen.getByLabelText('输入'), { target: { value: '123' } })

        expect(await screen.findByText(/偶数/)).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: '发送' }))
        expect(writes).toEqual([])
    })

    test('HEX 视图切换后显示的是字节 dump，切回来文本还在', async () => {
        await connect()

        reader.push(new TextEncoder().encode('AB'))
        await waitFor(() => expect(screen.getByText('AB')).toBeInTheDocument())

        fireEvent.click(screen.getByLabelText('HEX 视图'))

        await waitFor(() => expect(screen.getByText(/\|AB/)).toBeInTheDocument())

        fireEvent.click(screen.getByLabelText('HEX 视图'))

        await waitFor(() => expect(screen.getByText('AB')).toBeInTheDocument())
    })

    test('定时发送：按间隔重复写出，停止后不再发送', async () => {
        await connect()

        fireEvent.click(screen.getByLabelText('定时发送与命令宏'))

        fireEvent.change(screen.getByLabelText('发送间隔（毫秒）'), { target: { value: '50' } })
        fireEvent.change(screen.getByLabelText('发送内容'), { target: { value: 'tick' } })
        fireEvent.click(screen.getByRole('button', { name: '开始定时发送' }))

        await waitFor(() => expect(writes.length).toBeGreaterThan(1), { timeout: 2000 })
        // 定时发送与手动发送用同一套行尾符
        expect(written()).toBe('tick\r\n'.repeat(writes.length))

        fireEvent.click(screen.getByRole('button', { name: '关闭' }))
        fireEvent.click(await screen.findByRole('button', { name: '停止' }))

        const atStop = writes.length
        await new Promise(resolve => setTimeout(resolve, 160))

        expect(writes.length).toBe(atStop)
    })

    test('命令宏：新增后出现在快捷条里，点一下直接发送', async () => {
        await connect()

        fireEvent.click(screen.getByLabelText('定时发送与命令宏'))
        fireEvent.click(screen.getByRole('tab', { name: '命令宏' }))
        fireEvent.click(screen.getByRole('button', { name: '新增宏' }))

        fireEvent.change(screen.getByLabelText('名称'), { target: { value: '查询版本' } })
        fireEvent.change(screen.getByLabelText('内容'), { target: { value: 'AT+GMR' } })
        fireEvent.click(screen.getByRole('button', { name: '保存' }))

        fireEvent.click(screen.getByRole('button', { name: '关闭' }))

        const chip = await screen.findByText('查询版本')
        fireEvent.click(chip)

        await waitFor(() => expect(written()).toBe('AT+GMR\r\n'))
        // 宏存在 localStorage 里，刷新后还在
        expect(window.localStorage.getItem('serialterminal.macros') ?? '').toContain('查询版本')
    })

    test('DTR 脉冲通过 Web Serial 的 setSignals 下发', async () => {
        await connect()

        fireEvent.click(screen.getByLabelText('DTR RTS 信号'))
        fireEvent.click(await screen.findByText('DTR 脉冲'))

        await waitFor(() => expect(port.setSignals).toHaveBeenCalledTimes(2), { timeout: 2000 })
        expect(port.setSignals.mock.calls[0][0]).toEqual({ dataTerminalReady: false })
        expect(port.setSignals.mock.calls[1][0]).toEqual({ dataTerminalReady: true })
    })

    test('设置改动会持久化到 localStorage', async () => {
        await connect()

        fireEvent.click(screen.getByLabelText('设置'))
        fireEvent.click(screen.getByRole('checkbox', { name: '解析 ANSI 颜色' }))
        fireEvent.click(screen.getByRole('button', { name: '保存' }))

        await waitFor(() => {
            const stored = readStored('settings') as { ansiFlag?: boolean }
            expect(stored.ansiFlag).toBe(false)
        })
    })
})
