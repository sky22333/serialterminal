import { findRememberedPort, portInfo, portLabel } from './ports'

const fakePort = (info: SerialPortInfo) => ({ getInfo: () => info })

describe('portInfo', () => {
    test('拿到 VID/PID', () => {
        expect(portInfo(fakePort({ usbVendorId: 0x1a86, usbProductId: 0x7523 })))
            .toEqual({ usbVendorId: 0x1a86, usbProductId: 0x7523 })
    })

    test('拿不到 USB 信息时返回 null', () => {
        expect(portInfo(fakePort({}))).toBeNull()
        expect(portInfo(null)).toBeNull()
        expect(portInfo({})).toBeNull()
    })

    test('getInfo 抛异常也不会炸', () => {
        expect(portInfo({ getInfo: () => { throw new Error('boom') } })).toBeNull()
    })
})

describe('portLabel', () => {
    test('格式化成 USB VID:PID', () => {
        expect(portLabel({ usbVendorId: 0x1a86, usbProductId: 0x7523 })).toBe('USB 1A86:7523')
    })

    test('没有产品 ID 时留空位', () => {
        expect(portLabel({ usbVendorId: 0x1a86, usbProductId: null })).toBe('USB 1A86:----')
    })

    test('完全没有信息时给个通用名', () => {
        expect(portLabel(null)).toBe('串口设备')
    })
})

describe('findRememberedPort', () => {
    const ch340 = fakePort({ usbVendorId: 0x1a86, usbProductId: 0x7523 })
    const cp210x = fakePort({ usbVendorId: 0x10c4, usbProductId: 0xea60 })

    test('按 VID/PID 找回上次那台', () => {
        const found = findRememberedPort([cp210x, ch340], { usbVendorId: 0x1a86, usbProductId: 0x7523 })
        expect(found).toBe(ch340)
    })

    test('只授权过一个设备时直接用它', () => {
        expect(findRememberedPort([ch340], null)).toBe(ch340)
    })

    test('多个设备且对不上时不瞎猜', () => {
        expect(findRememberedPort([ch340, cp210x], { usbVendorId: 0x1234, usbProductId: 0x5678 })).toBeNull()
    })

    test('没有已授权设备时返回 null', () => {
        expect(findRememberedPort([], null)).toBeNull()
        expect(findRememberedPort(undefined, null)).toBeNull()
    })
})
