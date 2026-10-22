import React from 'react'

import Box from '@mui/material/Box'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'

import Header from './components/Header'
import Footer from './components/Footer'
import Home from './components/Home'
import Terminal from './components/Terminal'
import Settings from './components/Settings'
import SendTools from './components/SendTools'
import type { SendToolsTab } from './components/SendTools'
import ErrorMessage from './components/ErrorMessage'

import Serial from './modules/Serial'
import LineBuffer from './modules/lineBuffer'
import HexBuffer, { MAX_HEX_ROWS } from './modules/hexBuffer'
import { hexPreview, parseHex } from './modules/hex'
import { loadMacros, saveMacros } from './modules/macros'
import { lineEndingValue, loadSettings, normalizeSettings, saveSettings } from './modules/settings'
import { findRememberedPort, portInfo, portLabel } from './modules/ports'
import { readJSON, writeJSON } from './modules/storage'
import { runSignalAction } from './modules/signals'
import type {
  InputMode, Line, Macro, PortIdentity, SendOptions,
  Settings as SettingsValue, TimerConfig, Toast, ToastSeverity,
} from './types'

// 超出后丢弃最旧的行，避免长时间运行把内存吃满
const MAX_TEXT_LINES = 50000

const MAX_HISTORY = 100

// port 对象不能序列化，只记 VID/PID
const LAST_PORT_KEY = 'lastPort'

const TIMER_KEY = 'timer'
const DEFAULT_TIMER: TimerConfig = { intervalMs: 1000, payload: '', hex: false }

interface RecentDevice {
  port: SerialPort
  label: string
}

interface Chunk {
  time: Date
  bytes: Uint8Array
}

const cap = <T,>(items: T[], limit: number): T[] => (items.length > limit ? items.slice(items.length - limit) : items)

const loadTimerConfig = (): TimerConfig => {
  const stored = readJSON<Partial<TimerConfig> | null>(TIMER_KEY, null)

  return {
    intervalMs: Number(stored?.intervalMs) || DEFAULT_TIMER.intervalMs,
    payload: typeof stored?.payload === 'string' ? stored.payload : '',
    hex: stored?.hex === true,
  }
}

function App() {
  const [serial] = React.useState(() => new Serial())
  const [connected, setConnected] = React.useState(false)

  // 两种视图各维护一份数据：切换视图不丢内容，也不用为另一种格式二次解析
  const [textLines, setTextLines] = React.useState<Line[]>([])
  const [hexRows, setHexRows] = React.useState<Line[]>([])
  const [pendingText, setPendingText] = React.useState('')
  const [pendingHex, setPendingHex] = React.useState('')

  // 发送历史（最新的在前），与渲染内容解耦，切换视图也不会乱
  const [history, setHistory] = React.useState<string[]>([])
  const [toast, setToast] = React.useState<Toast>({ open: false, severity: 'info', value: '' })

  const [settingsOpen, setSettingsOpen] = React.useState(false)

  const [sendToolsOpen, setSendToolsOpen] = React.useState(false)
  const [sendToolsTab, setSendToolsTab] = React.useState<SendToolsTab>('timer')

  const [errorOpen, setErrorOpen] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState('')

  const [settings, setSettings] = React.useState<SettingsValue>(loadSettings)
  const [macros, setMacros] = React.useState<Macro[]>(loadMacros)

  const [timerConfig, setTimerConfig] = React.useState<TimerConfig>(loadTimerConfig)
  const [timerRunning, setTimerRunning] = React.useState(false)
  const [timerCount, setTimerCount] = React.useState(0)
  const timerCountRef = React.useRef(0)

  const [recentDevice, setRecentDevice] = React.useState<RecentDevice | null>(null)

  // state 懒初始化拿到稳定实例；换成 ref 判空就得在渲染期写 ref
  const [lineBuffer] = React.useState(() => new LineBuffer())
  const [hexBuffer] = React.useState(() => new HexBuffer())

  // stream 模式才能正确处理跨数据块的多字节字符
  const decoderRef = React.useRef(new TextDecoder('utf-8'))

  const queueRef = React.useRef<Chunk[]>([])
  const frameRef = React.useRef(0)

  const appendText = React.useCallback((items: Line[]) => {
    if (items.length === 0) return
    setTextLines(prev => cap(prev.concat(items), MAX_TEXT_LINES))
  }, [])

  const appendHex = React.useCallback((items: Line[]) => {
    if (items.length === 0) return
    setHexRows(prev => cap(prev.concat(items), MAX_HEX_ROWS))
  }, [])

  // 把队列里的数据一次性消化成一帧的更新
  const flush = React.useCallback(() => {
    frameRef.current = 0

    const queue = queueRef.current
    if (queue.length === 0) return
    queueRef.current = []

    const decoder = decoderRef.current

    let total = 0
    for (const item of queue) total += item.bytes.byteLength

    const bytes = new Uint8Array(total)
    const producedText: Line[] = []
    let at = 0

    for (const item of queue) {
      bytes.set(item.bytes, at)
      at += item.bytes.byteLength

      const text = decoder.decode(item.bytes, { stream: true })
      if (text) {
        const produced = lineBuffer.consume(text, item.time)
        for (const line of produced) producedText.push(line)
      }
    }

    const producedHex = hexBuffer.push(bytes, queue[queue.length - 1].time)

    appendText(producedText)
    appendHex(producedHex)

    setPendingText(lineBuffer.pending)
    setPendingHex(hexBuffer.pending)
  }, [appendText, appendHex, lineBuffer, hexBuffer])

  const scheduleFlush = React.useCallback(() => {
    if (frameRef.current) return
    frameRef.current = window.requestAnimationFrame(flush)
  }, [flush])

  // 把未换行的残留内容收成一行（断开前调用，避免最后一行丢失）
  const commitPending = React.useCallback(() => {
    if (lineBuffer.pending) {
      appendText([{ type: 'output', value: lineBuffer.pending, time: new Date() }])
    }
    lineBuffer.reset()

    const row = hexBuffer.flush(new Date())
    if (row) appendHex([row])

    setPendingText('')
    setPendingHex('')
  }, [appendText, appendHex, lineBuffer, hexBuffer])

  // 注册串口回调（只注册一次）
  React.useEffect(() => {
    serial.onSuccess = () => {
      setConnected(true)

      // 新会话，丢掉解码器里可能残留的半个字符
      decoderRef.current = new TextDecoder('utf-8')

      const info = portInfo(serial.port)
      if (info) writeJSON(LAST_PORT_KEY, info)

      setToast({ open: true, severity: 'success', value: '已连接 🚀' })
    }

    serial.onFail = () => {
      setConnected(false)
      setTimerRunning(false)
      setToast({ open: true, severity: 'error', value: '连接已断开 🙀' })
    }

    serial.onReceive = (bytes) => {
      queueRef.current.push({ time: new Date(), bytes: bytes })
      scheduleFlush()
    }

    return () => {
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current)
    }
  }, [serial, scheduleFlush])

  React.useEffect(() => {
    saveSettings(settings)
    serial.setBaudRate(settings.baudRate)
  }, [settings, serial])

  const refreshRecentDevice = React.useCallback(async () => {
    const ports = await serial.getPorts()
    const port = findRememberedPort(ports, readJSON<PortIdentity | null>(LAST_PORT_KEY, null))

    setRecentDevice(port ? { port: port, label: portLabel(portInfo(port)) } : null)
  }, [serial])

  React.useEffect(() => {
    if (!connected) void refreshRecentDevice()
  }, [connected, refreshRecentDevice])

  const closeToast = React.useCallback(() => {
    setToast(prev => ({ ...prev, open: false }))
  }, [])

  const notify = React.useCallback((value: string, severity: ToastSeverity = 'success') => {
    setToast({ open: true, severity, value })
  }, [])

  const openSettings = React.useCallback(() => setSettingsOpen(true), [])

  const openSendTools = React.useCallback((tab?: SendToolsTab) => {
    if (tab) setSendToolsTab(tab)
    setSendToolsOpen(true)
  }, [])

  const showError = (message: string) => {
    setErrorMessage(message)
    setErrorOpen(true)
  }

  const updateSettings = React.useCallback((patch: Partial<SettingsValue>) => {
    setSettings(prev => normalizeSettings({ ...prev, ...patch }))
  }, [])

  const toggleHexView = React.useCallback(() => {
    updateSettings({ hexView: !settings.hexView })
  }, [updateSettings, settings.hexView])

  const closeSettings = React.useCallback(() => setSettingsOpen(false), [])
  const closeSendTools = React.useCallback(() => setSendToolsOpen(false), [])
  const closeError = React.useCallback(() => setErrorOpen(false), [])

  const openMacros = React.useCallback(() => openSendTools('macros'), [openSendTools])
  const openTimer = React.useCallback(() => openSendTools('timer'), [openSendTools])
  const serialSupported = React.useCallback(() => serial.supported(), [serial])

  const persistSettings = React.useCallback((next: SettingsValue) => {
    setSettings(normalizeSettings(next))
    notify('设置已保存 ✨')
  }, [notify])

  // 两个视图都写，切换后仍能看到自己发了什么
  const appendEcho = React.useCallback((value: string, remember = true) => {
    const line: Line = { type: 'userInput', value: value, time: new Date() }

    appendText([line])
    appendHex([line])

    // 空行不进发送历史，否则用 ↑ 翻历史时会翻到空条目
    if (remember && value.trim() !== '') setHistory(prev => cap([value, ...prev], MAX_HISTORY))
  }, [appendText, appendHex])

  const sendText = React.useCallback((text: string, options: SendOptions = {}) => {
    const { echo = true, ending = true, remember = true } = options

    void serial.send(`${text}${ending ? lineEndingValue(settings.lineEnding) : ''}`)

    if (echo) appendEcho(text, remember)
  }, [serial, settings.lineEnding, appendEcho])

  const sendHex = React.useCallback((input: string, options: SendOptions = {}): string => {
    const { echo = true, remember = false } = options
    const { bytes, error } = parseHex(input)

    if (error || !bytes) return error

    void serial.sendBytes(bytes)

    if (echo) appendEcho(`HEX ${hexPreview(bytes)}`, remember)

    return ''
  }, [serial, appendEcho])

  /** 空字符串表示成功发送，否则是错误文案 */
  const handleSend = React.useCallback((value: string, mode: InputMode = 'text'): string => {
    if (mode === 'hex') return sendHex(value)

    sendText(value)

    return ''
  }, [sendHex, sendText])

  const handleRawSend = React.useCallback((byte: number) => {
    void serial.sendByte(byte)
  }, [serial])

  const handleMacro = React.useCallback((macro: Macro) => {
    if (!macro) return

    if (macro.hex) {
      const error = sendHex(macro.payload, { echo: true, remember: false })
      if (error) notify(error, 'error')
      return
    }

    sendText(macro.payload, { ending: macro.appendLineEnding })
  }, [sendHex, sendText, notify])

  const handleSignal = React.useCallback(async (id: string) => {
    const error = await runSignalAction(serial, id)

    if (error) notify(error, 'error')
    else notify('已发送信号时序 ⚡', 'success')
  }, [serial, notify])

  const handleSaveMacros = React.useCallback((list: Macro[]) => {
    setMacros(saveMacros(list))
  }, [])

  // 定时发送：用最新的发送函数，避免闭包拿到旧的 lineEnding
  const latestSendRef = React.useRef({ sendText: sendText, sendHex: sendHex })
  React.useEffect(() => {
    latestSendRef.current = { sendText: sendText, sendHex: sendHex }
  }, [sendText, sendHex])

  React.useEffect(() => {
    if (!timerRunning) return undefined

    const id = window.setInterval(() => {
      const { sendText: sendPlain, sendHex: sendRawHex } = latestSendRef.current

      // 每拍都回显会刷屏，所以只计数；行尾符必须跟手动发送一致，
      // 否则会出现「手动能通、定时不通」
      if (timerConfig.hex) sendRawHex(timerConfig.payload, { echo: false })
      else sendPlain(timerConfig.payload, { echo: false, remember: false })

      timerCountRef.current += 1
      setTimerCount(timerCountRef.current)
    }, timerConfig.intervalMs)

    return () => window.clearInterval(id)
  }, [timerRunning, timerConfig])

  const startTimer = React.useCallback((config: TimerConfig): string => {
    const intervalMs = Math.round(Number(config.intervalMs))

    if (!Number.isFinite(intervalMs) || intervalMs < 50 || intervalMs > 600000) {
      return '发送间隔需在 50–600000 毫秒之间'
    }

    if (!config.payload || config.payload.trim() === '') return '发送内容不能为空'

    if (config.hex) {
      const { error } = parseHex(config.payload)
      if (error) return error
    }

    const next: TimerConfig = { intervalMs: intervalMs, payload: config.payload, hex: !!config.hex }

    writeJSON(TIMER_KEY, next)
    setTimerConfig(next)
    setTimerCount(0)
    timerCountRef.current = 0
    setTimerRunning(true)

    appendEcho(`[定时] 每 ${intervalMs}ms 发送一次${next.hex ? '（HEX）' : ''}：${next.payload.slice(0, 80)}`, false)

    return ''
  }, [appendEcho])

  const stopTimer = React.useCallback(() => {
    if (!timerRunning) return

    setTimerRunning(false)
    appendEcho(`[定时] 已停止，共发送 ${timerCountRef.current} 次`, false)
  }, [timerRunning, appendEcho])

  const doConnect = (port: SerialPort | null) => {
    if (!serial.supported()) {
      showError('当前浏览器不支持 Web Serial 接口。')
      return
    }

    const task = port ? serial.openExisting(port) : serial.requestPort()

    void task.then(res => {
      if (res !== '') showError(res)
    })
  }

  const connect = () => doConnect(null)

  const reconnect = () => {
    if (!recentDevice) {
      connect()
      return
    }

    doConnect(recentDevice.port)
  }

  const disconnect = React.useCallback(async () => {
    setTimerRunning(false)
    commitPending()
    await serial.close()
    setConnected(false)
    setToast({ open: true, severity: 'info', value: '已断开连接 👋' })
  }, [commitPending, serial])

  const handleClear = React.useCallback(() => {
    lineBuffer.reset()
    hexBuffer.reset()
    queueRef.current = []

    if (frameRef.current) {
      window.cancelAnimationFrame(frameRef.current)
      frameRef.current = 0
    }

    setPendingText('')
    setPendingHex('')
    setTextLines([])
    setHexRows([])

    notify('历史已清空 🧹', 'info')
  }, [notify, lineBuffer, hexBuffer])

  const lines = settings.hexView ? hexRows : textLines
  const pending = settings.hexView ? pendingHex : pendingText

  const timerStatus = React.useMemo(() => ({
    running: timerRunning,
    intervalMs: timerConfig.intervalMs,
    count: timerCount,
  }), [timerRunning, timerConfig.intervalMs, timerCount])

  const sendToolsTimer = React.useMemo(() => ({
    ...timerStatus,
    payload: timerConfig.payload,
    hex: timerConfig.hex,
  }), [timerStatus, timerConfig.payload, timerConfig.hex])

  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      height: '100dvh',
      minHeight: 0,
    }}>
      <Header
        connected={connected}
        disconnect={disconnect}
      />

      {connected ?
        <Terminal
          lines={lines}
          pending={pending}
          history={history}
          send={handleSend}
          sendRaw={handleRawSend}
          openSettings={openSettings}
          clear={handleClear}
          notify={notify}
          echo={settings.echoFlag}
          time={settings.timeFlag}
          ansi={settings.ansiFlag}
          wrap={settings.wrapFlag}
          ctrl={settings.ctrlFlag}
          hexView={settings.hexView}
          toggleHexView={toggleHexView}
          macros={macros}
          sendMacro={handleMacro}
          openMacros={openMacros}
          openSendTools={openTimer}
          canSignal={serial.supportsSignals()}
          runSignal={handleSignal}
          timer={timerStatus}
          stopTimer={stopTimer}
        />
        :
        <Home
          connect={connect}
          reconnect={reconnect}
          recentLabel={recentDevice ? recentDevice.label : ''}
          supported={serialSupported}
          openSettings={openSettings}
        />
      }

      <Settings
        open={settingsOpen}
        close={closeSettings}
        settings={settings}
        save={persistSettings}
        openPort={connected}
      />

      <SendTools
        open={sendToolsOpen}
        tab={sendToolsTab}
        onTabChange={setSendToolsTab}
        close={closeSendTools}
        timer={sendToolsTimer}
        startTimer={startTimer}
        stopTimer={stopTimer}
        macros={macros}
        saveMacros={handleSaveMacros}
        sendMacro={handleMacro}
      />

      <Snackbar open={toast.open} autoHideDuration={4000} onClose={closeToast}>
        <Alert onClose={closeToast} severity={toast.severity}>
          {toast.value}
        </Alert>
      </Snackbar>

      <ErrorMessage
        open={errorOpen}
        close={closeError}
        message={errorMessage}
      />

      <Footer />
    </Box>
  )
}

export default App
