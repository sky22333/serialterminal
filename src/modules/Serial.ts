/**
 * Web Serial 的封装。三条必须守住的边界：
 *   1. 收：原始字节原样抛出，解码交给上层（HEX 视图要字节，文本视图要字符串）
 *   2. 发：所有写入串成一条链，绝不并发抢 writer 锁；大数据自动分片，关闭时立即中止
 *   3. 关：先取消读取、等读循环退出、等写链排空，再关端口，否则会卡在 "port is locked"
 */

const reason = (e: unknown): string => (e instanceof Error ? e.message : `${e}`)

const isCancel = (e: unknown): boolean =>
    e instanceof Error && (e.name === 'NotFoundError' || e.name === 'AbortError')

/** 等写链排空的上限：分片间隔最长 8ms，正常几毫秒就好；底层卡死时不能无限等 */
const DRAIN_TIMEOUT = 1000

export default class Serial {
    onSuccess: () => void = () => { }
    onFail: () => void = () => { }
    onReceive: (bytes: Uint8Array) => void = () => { }

    open = false
    port: SerialPort | null = null
    reader: ReadableStreamDefaultReader<Uint8Array> | null = null
    baudRate = 115200

    /** 写入串成一条链，避免抢 writer 锁 */
    private writeChain: Promise<boolean> = Promise.resolve(false)

    /** close() 靠它等读循环真正退出 */
    private readDone: Promise<void> | null = null
    private readResolve: (() => void) | null = null

    /** 主动关闭期间的异常不算设备掉线 */
    private closing = false

    private disconnectHandler: (() => void) | null = null

    supported(): boolean {
        return typeof navigator !== 'undefined' && 'serial' in navigator
    }

    /** 部分平台 / 驱动不实现 setSignals */
    supportsSignals(): boolean {
        return this.port !== null && typeof this.port.setSignals === 'function'
    }

    async requestPort(): Promise<string> {
        await this.close()

        // 未加过滤器：用户可以选择任意串口（CH340、CP210x、FTDI…）
        try {
            this.port = await navigator.serial.requestPort({ filters: [] })
        } catch (e) {
            // 用户点了取消，不算错误，静默返回
            if (isCancel(e)) return ''

            console.error('[SERIAL] 选择端口失败：', e)
            return reason(e)
        }

        return this.openPort()
    }

    /** 列出这个域名已授权的串口，授权过一次就能跳过选择器直接连 */
    async getPorts(): Promise<SerialPort[]> {
        if (!this.supported() || typeof navigator.serial.getPorts !== 'function') return []

        try {
            return await navigator.serial.getPorts()
        } catch (e) {
            console.warn('[SERIAL] 读取已授权设备失败：', e)
            return []
        }
    }

    async openExisting(port: SerialPort | null): Promise<string> {
        if (!port) return '没有可用的串口设备'

        await this.close()

        this.port = port

        return this.openPort()
    }

    private async openPort(): Promise<string> {
        const port = this.port
        if (!port) return '没有选择串口设备'

        try {
            await port.open({ baudRate: this.baudRate })
        } catch (e) {
            console.error('[SERIAL] 打开串口失败：', e)
            this.onFail()
            return `打开串口失败：${reason(e)}`
        }

        console.log(`[SERIAL] 已连接，波特率 ${this.baudRate}`)

        this.closing = false
        this.open = true

        this.disconnectHandler = () => {
            console.warn('[SERIAL] 设备已拔出')

            if (!this.open) return

            // 标记成非主动关闭，让读循环把它当成掉线上报
            this.open = false
            this.closing = false
            this.onFail()
        }

        port.addEventListener('disconnect', this.disconnectHandler)

        this.readDone = new Promise<void>(resolve => { this.readResolve = resolve })

        this.onSuccess()
        void this.read()

        return ''
    }

    private async read(): Promise<void> {
        const readable = this.port?.readable

        if (!readable) {
            this.open = false
            this.onFail()
            return
        }

        const reader = readable.getReader()
        this.reader = reader

        try {
            while (this.open) {
                const { value, done } = await reader.read()

                if (done) break

                // 原始字节，不做任何解码
                if (value && value.byteLength > 0) this.onReceive(value)
            }
        } catch (e) {
            if (!this.closing) console.error('[SERIAL] 读取中断：', e)
        } finally {
            const unexpected = !this.closing && this.open

            this.open = false
            this.reader = null

            try { reader.releaseLock() } catch { /* 已经释放 */ }

            if (unexpected) this.onFail()

            if (this.readResolve) {
                this.readResolve()
                this.readResolve = null
            }
        }
    }

    async send(value: string): Promise<boolean> {
        return this.write(new TextEncoder().encode(`${value}`))
    }

    async sendBytes(bytes: Uint8Array | null): Promise<boolean> {
        if (!bytes || bytes.byteLength === 0) return false

        return this.write(bytes)
    }

    async sendByte(value: number): Promise<boolean> {
        return this.write(new Uint8Array([value]))
    }

    /** @returns 空字符串表示成功 */
    async setSignals(signals: SerialOutputSignals): Promise<string> {
        const port = this.port

        if (!this.open || !port) return '串口未连接'

        if (typeof port.setSignals !== 'function') {
            return '当前浏览器不支持控制 DTR / RTS'
        }

        try {
            await port.setSignals(signals)
            return ''
        } catch (e) {
            console.error('[SERIAL] 设置信号失败：', e)
            return `设置信号失败：${reason(e)}`
        }
    }

    /** 串行写入，并按数据量分片，避免灌爆设备的小容量 RX 缓冲 */
    private write(bytes: Uint8Array): Promise<boolean> {
        if (!this.open) {
            console.warn('[SERIAL] 串口未打开，忽略发送')
            return Promise.resolve(false)
        }

        return this.enqueue(async () => {
            // 进到任务里再取：排队期间可能已经断开，此时 writable 是不能再拿 writer 的
            const writable = this.port?.writable

            if (!this.open || !writable) return false

            const writer = writable.getWriter()

            try {
                let chunkSize = bytes.length
                let delay = 0

                if (bytes.length > 256) { chunkSize = 64; delay = 2 }
                if (bytes.length > 2048) { chunkSize = 16; delay = 8 }

                for (let offset = 0; offset < bytes.length; offset += chunkSize) {
                    // 断开时立刻收手：占着 writer 会让 port.close() 抛 InvalidStateError
                    if (!this.open) return false

                    await writer.write(bytes.subarray(offset, offset + chunkSize))

                    if (delay > 0 && offset + chunkSize < bytes.length) {
                        await new Promise(resolve => setTimeout(resolve, delay))
                    }
                }

                return true
            } finally {
                writer.releaseLock()
            }
        })
    }

    private enqueue(task: () => Promise<boolean>): Promise<boolean> {
        this.writeChain = this.writeChain
            .then(task)
            .catch(e => {
                console.error('[SERIAL] 发送失败：', e)
                return false
            })

        return this.writeChain
    }

    /** 等写链排空，最多等 DRAIN_TIMEOUT，避免底层卡死时把断开也拖住 */
    private drainWrites(): Promise<void> {
        const drained = this.writeChain.then(() => undefined, () => undefined)
        const timeout = new Promise<void>(resolve => { setTimeout(resolve, DRAIN_TIMEOUT) })

        return Promise.race([drained, timeout])
    }

    async close(): Promise<void> {
        const wasOpen = this.open

        this.closing = true
        this.open = false

        const reader = this.reader

        if (reader) {
            try { await reader.cancel() } catch { /* 已经结束 */ }
        }

        // 等读循环真正退出、释放锁之后再关端口
        if (this.readDone) {
            try { await this.readDone } catch { /* 忽略 */ }
            this.readDone = null
        }

        // 写链也要排空：writer 还占着锁时 port.close() 会抛 InvalidStateError，
        // 之前这个错误被吞掉，端口其实没关、设备一直被占着
        await this.drainWrites()

        const port = this.port

        if (port) {
            try {
                await port.close()
            } catch (e) {
                // 不能再静默：关不掉是真的会把设备锁住，必须留痕
                console.warn('[SERIAL] 端口关闭失败：', e)
            }
        }

        if (this.disconnectHandler && port) {
            try {
                port.removeEventListener('disconnect', this.disconnectHandler)
            } catch { /* 部分实现没有 removeEventListener */ }
        }

        this.disconnectHandler = null
        this.closing = false

        if (wasOpen) console.log('[SERIAL] 已断开')
    }

    setBaudRate(newBaudRate: number): void {
        this.baudRate = newBaudRate
    }
}
