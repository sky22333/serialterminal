/**
 * 串口设备的识别与匹配。
 *
 * Web Serial 只说得出 USB 的 VID/PID（`getInfo()`），不会告诉我们这是
 * CH340 还是 ESP32-C3，所以这里只做三件事：格式化标签、记住上次的设备、
 * 在已授权设备里把上次那个找回来。
 */

import type { PortIdentity } from '../types'

/** 只要有 getInfo() 就够，不要求完整的 SerialPort，测试里也更好造 */
export interface PortLike {
    getInfo?: () => SerialPortInfo
}

const hex4 = (n: number) => Number(n).toString(16).toUpperCase().padStart(4, '0')

export function portInfo(port: PortLike | null | undefined): PortIdentity | null {
    if (!port || typeof port.getInfo !== 'function') return null

    try {
        const info = port.getInfo() ?? {}

        // 部分平台（如某些串口服务器）拿不到 USB 信息，此时没有可用标识
        if (info.usbVendorId === undefined || info.usbVendorId === null) return null

        return {
            usbVendorId: info.usbVendorId,
            usbProductId: info.usbProductId === undefined ? null : info.usbProductId,
        }
    } catch {
        return null
    }
}

export function portLabel(info: PortIdentity | null | undefined): string {
    if (!info || info.usbVendorId === undefined || info.usbVendorId === null) {
        return '串口设备'
    }

    const vid = hex4(info.usbVendorId)
    const pid = info.usbProductId === undefined || info.usbProductId === null
        ? '----'
        : hex4(info.usbProductId)

    return `USB ${vid}:${pid}`
}

const sameDevice = (a: PortIdentity | null, b: PortIdentity | null): boolean => !!a && !!b
    && a.usbVendorId === b.usbVendorId
    && a.usbProductId === b.usbProductId

/** 在已授权设备里找出上次用过的那个，找不到返回 null */
export function findRememberedPort<T extends PortLike>(
    ports: readonly T[] | null | undefined,
    remembered: PortIdentity | null,
): T | null {
    if (!Array.isArray(ports) || ports.length === 0) return null

    if (remembered) {
        const hit = ports.find(port => sameDevice(portInfo(port), remembered))
        if (hit) return hit
    }

    // 只授权过一个设备时不需要猜：就是它
    if (ports.length === 1) return ports[0]

    return null
}
