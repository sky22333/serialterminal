import { DEFAULT_SETTINGS, loadSettings, normalizeSettings, saveSettings } from './settings'

const STORAGE_KEY = 'serialterminal.settings'

beforeEach(() => {
    window.localStorage.clear()
})

describe('normalizeSettings', () => {
    test('空输入返回默认值', () => {
        expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS)
        expect(normalizeSettings('垃圾数据')).toEqual(DEFAULT_SETTINGS)
    })

    test('合法值原样保留', () => {
        const result = normalizeSettings({
            baudRate: 921600,
            lineEnding: '\\n',
            echoFlag: false,
            timeFlag: true,
            ctrlFlag: false,
            ansiFlag: false,
            wrapFlag: false,
        })

        expect(result.baudRate).toBe(921600)
        expect(result.lineEnding).toBe('\\n')
        expect(result.echoFlag).toBe(false)
        expect(result.timeFlag).toBe(true)
        expect(result.wrapFlag).toBe(false)
    })

    test('非法波特率落回默认，避免传到 port.open 才炸', () => {
        expect(normalizeSettings({ baudRate: '??? ' }).baudRate).toBe(115200)
        expect(normalizeSettings({ baudRate: 1 }).baudRate).toBe(115200)
        expect(normalizeSettings({ baudRate: 99999999 }).baudRate).toBe(115200)
        expect(normalizeSettings({ baudRate: 0 }).baudRate).toBe(115200)
    })

    test('边界值可用', () => {
        expect(normalizeSettings({ baudRate: 50 }).baudRate).toBe(50)
        expect(normalizeSettings({ baudRate: 4000000 }).baudRate).toBe(4000000)
    })

    test('未知的行尾符落回默认', () => {
        expect(normalizeSettings({ lineEnding: 'CRCR' }).lineEnding).toBe('\\r\\n')
    })

    test('布尔项必须是布尔，字符串不算', () => {
        expect(normalizeSettings({ echoFlag: 'false' }).echoFlag).toBe(true)
    })

    test('HEX 视图默认关闭，显式 true 才打开', () => {
        expect(DEFAULT_SETTINGS.hexView).toBe(false)
        expect(normalizeSettings({ hexView: true }).hexView).toBe(true)
        expect(normalizeSettings({ hexView: 'true' }).hexView).toBe(false)
    })
})

describe('loadSettings / saveSettings', () => {
    test('没存过时返回默认值', () => {
        expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
    })

    test('保存后能读回来，并写入 localStorage', () => {
        saveSettings({ ...DEFAULT_SETTINGS, baudRate: 9600 })
        expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null').baudRate).toBe(9600)
        expect(loadSettings().baudRate).toBe(9600)
    })

    test('localStorage 里是脏数据时回退默认值', () => {
        window.localStorage.setItem(STORAGE_KEY, '{不是 JSON')
        expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
    })
})
