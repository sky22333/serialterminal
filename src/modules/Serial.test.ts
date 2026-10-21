import { describe, expect, test, vi, beforeEach } from 'vitest'

import Serial from './Serial'

type ReadResult = { value: Uint8Array | undefined; done: boolean }

/**
 * 一个可以手动喂数据的「假设备」
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
        releaseLock: vi.fn(),
    }
}

let reader: ReturnType<typeof makeReader>

class FakePort {
    info: SerialPortInfo
    writes: number[][] = []
    openOptions: SerialOptions | null = null
    closed = false
    listeners: Record<string, () => void> = {}
    signals: SerialOutputSignals[] = []
    readable: { getReader: () => typeof reader }
    writable: { getWriter: () => { write: (chunk: Uint8Array) => Promise<void>; releaseLock: () => void } }
    /** 声明成可选，方便模拟「驱动不支持」的平台 */
    setSignals?: (signals: SerialOutputSignals) => Promise<void>
    /** 还占着 writer 的数量：真实实现里端口被锁时 close() 会抛 InvalidStateError */
    locks = 0

    constructor(info: SerialPortInfo = { usbVendorId: 0x1a86, usbProductId: 0x7523 }) {
        this.info = info

        this.readable = { getReader: () => reader }

        this.writable = {
            getWriter: () => {
                this.locks += 1

                return {
                    write: async (chunk: Uint8Array) => {
                        await tick()
                        this.writes.push(Array.from(chunk))
                    },
                    releaseLock: () => { this.locks -= 1 },
                }
            },
        }

        this.setSignals = async (signals: SerialOutputSignals) => { this.signals.push(signals) }
    }

    addEventListener(type: string, fn: () => void) { this.listeners[type] = fn }

    removeEventListener(type: string) { delete this.listeners[type] }

    async open(options: SerialOptions) { this.openOptions = options }

    async close() {
        if (this.locks > 0) throw new Error('InvalidStateError: The port is locked')

        this.closed = true
    }

    getInfo(): SerialPortInfo { return this.info }

    get text() {
        return this.writes.map(bytes => String.fromCharCode(...bytes)).join('')
    }
}

/** 测试里只用到 Serial 需要的那部分，转成 SerialPort 交给被测代码 */
const asPort = (port: FakePort) => port as unknown as SerialPort

const tick = () => new Promise(resolve => setTimeout(resolve, 0))

beforeEach(() => {
    reader = makeReader()
})

describe('Serial.openExisting', () => {
    test('用当前设置打开指定设备，并触发 onSuccess', async () => {
        const serial = new Serial()
        const port = new FakePort()
        const onSuccess = vi.fn()

        serial.setBaudRate(921600)
        serial.onSuccess = onSuccess

        const result = await serial.openExisting(asPort(port))

        expect(result).toBe('')
        expect(port.openOptions).toEqual({ baudRate: 921600 })
        expect(serial.open).toBe(true)
        expect(onSuccess).toHaveBeenCalled()

        await serial.close()
    })

    test('没给端口时返回错误文案而不是抛异常', async () => {
        const serial = new Serial()
        expect(await serial.openExisting(null)).toBe('没有可用的串口设备')
    })

    test('打开失败时返回错误并触发 onFail', async () => {
        const serial = new Serial()
        const port = new FakePort()
        const onFail = vi.fn()

        port.open = async () => { throw new Error('端口被占用') }
        serial.onFail = onFail

        expect(await serial.openExisting(asPort(port))).toContain('端口被占用')
        expect(onFail).toHaveBeenCalled()
    })

    test('设备被拔出时触发 onFail', async () => {
        const serial = new Serial()
        const port = new FakePort()
        const onFail = vi.fn()

        serial.onFail = onFail
        await serial.openExisting(asPort(port))

        port.listeners.disconnect()

        expect(onFail).toHaveBeenCalled()
        expect(serial.open).toBe(false)

        await serial.close()
    })
})

describe('Serial 接收', () => {
    test('吐出的是原始字节，解码由上层负责', async () => {
        const serial = new Serial()
        const port = new FakePort()
        const received: Uint8Array[] = []

        serial.onReceive = (bytes) => { received.push(bytes) }
        await serial.openExisting(asPort(port))
        await tick()

        reader.push(new TextEncoder().encode('hello'))
        await tick()

        const chunk = received[0]

        expect(ArrayBuffer.isView(chunk)).toBe(true)
        expect(chunk.byteLength).toBe(5)
        expect(new TextDecoder().decode(chunk)).toBe('hello')

        await serial.close()
    })

    test('主动断开不会被当成掉线，并且能关掉端口', async () => {
        const serial = new Serial()
        const port = new FakePort()
        const onFail = vi.fn()

        serial.onFail = onFail
        await serial.openExisting(asPort(port))
        await tick()

        await serial.close()

        expect(onFail).not.toHaveBeenCalled()
        expect(serial.open).toBe(false)
        expect(port.closed).toBe(true)
        // 读循环退出时必须释放锁，否则端口关不掉
        expect(reader.releaseLock).toHaveBeenCalled()
    })
})

describe('Serial 发送', () => {
    test('未打开时静默忽略，不抛异常', async () => {
        const serial = new Serial()
        expect(await serial.send('x')).toBe(false)
        expect(await serial.sendByte(3)).toBe(false)
        expect(await serial.sendBytes(new Uint8Array([1]))).toBe(false)
    })

    test('小数据一次写完', async () => {
        const serial = new Serial()
        const port = new FakePort()

        await serial.openExisting(asPort(port))
        await serial.send('abc')

        expect(port.writes).toHaveLength(1)
        expect(port.text).toBe('abc')
        await serial.close()
    })

    test('超过 256 字节自动分片，避免灌爆设备缓冲', async () => {
        const serial = new Serial()
        const port = new FakePort()

        await serial.openExisting(asPort(port))
        await serial.send('a'.repeat(300))

        // 300 字节按 64 字节一片 → 64×4 + 44
        expect(port.writes).toHaveLength(5)
        expect(port.writes[0]).toHaveLength(64)
        expect(port.writes[4]).toHaveLength(44)
        expect(port.text).toBe('a'.repeat(300))
        await serial.close()
    })

    test('连续发送会排队，不会抢锁也不会乱序', async () => {
        const serial = new Serial()
        const port = new FakePort()

        await serial.openExisting(asPort(port))

        const first = serial.send('first')
        const second = serial.send('second')
        const third = serial.sendByte(0x03)

        await Promise.all([first, second, third])

        expect(port.text).toBe('firstsecond\u0003')
        await serial.close()
    })

    test('单字节发送用于 Ctrl+C 这类控制字符', async () => {
        const serial = new Serial()
        const port = new FakePort()

        await serial.openExisting(asPort(port))
        await serial.sendByte(3)

        expect(port.writes).toEqual([[3]])
        await serial.close()
    })

    test('HEX 发送走原始字节，不会被当成文本', async () => {
        const serial = new Serial()
        const port = new FakePort()

        await serial.openExisting(asPort(port))
        await serial.sendBytes(new Uint8Array([0xff, 0x00, 0x41]))

        expect(port.writes).toEqual([[0xff, 0x00, 0x41]])
        await serial.close()
    })
})

describe('Serial 关闭时序', () => {
    test('大包发送途中断开：释放写锁、真正关端口，且不再继续发', async () => {
        const serial = new Serial()
        const port = new FakePort()

        await serial.openExisting(asPort(port))

        // 3000 字节会按 16 字节 / 8ms 切成 188 片，正常要一秒多
        const sending = serial.send('a'.repeat(3000))
        await tick()

        await serial.close()

        expect(port.closed).toBe(true)
        expect(port.locks).toBe(0)
        // 断开后立刻收手，不会把剩下的分片发完
        expect(port.writes.length).toBeLessThan(20)
        expect(await sending).toBe(false)
    })

    test('断开后新的发送请求直接被忽略，不会去抢已关闭端口的锁', async () => {
        const serial = new Serial()
        const port = new FakePort()

        await serial.openExisting(asPort(port))
        await serial.close()

        const before = port.writes.length

        expect(await serial.send('late')).toBe(false)
        expect(port.writes.length).toBe(before)
        expect(port.locks).toBe(0)
    })
})

describe('Serial 信号控制', () => {
    test('把信号原样交给端口', async () => {
        const serial = new Serial()
        const port = new FakePort()

        await serial.openExisting(asPort(port))

        expect(serial.supportsSignals()).toBe(true)
        expect(await serial.setSignals({ dataTerminalReady: false })).toBe('')
        expect(port.signals).toEqual([{ dataTerminalReady: false }])

        await serial.close()
    })

    test('未连接时给出提示而不是抛异常', async () => {
        const serial = new Serial()
        expect(await serial.setSignals({ dataTerminalReady: true })).toBe('串口未连接')
    })

    test('端口不支持时明确说明', async () => {
        const serial = new Serial()
        const port = new FakePort()

        port.setSignals = undefined
        await serial.openExisting(asPort(port))

        expect(serial.supportsSignals()).toBe(false)
        expect(await serial.setSignals({ requestToSend: true })).toContain('不支持')

        await serial.close()
    })

    test('驱动报错时把原因带回来', async () => {
        const serial = new Serial()
        const port = new FakePort()

        port.setSignals = async () => { throw new Error('not supported on this platform') }
        await serial.openExisting(asPort(port))

        expect(await serial.setSignals({ requestToSend: true })).toContain('not supported')

        await serial.close()
    })
})
