/**
 * localStorage 的薄封装。统一加前缀，避免和其他项目 / 插件抢键名。
 */

const PREFIX = 'serialterminal.'

/**
 * 返回值直接断言成 T：localStorage 是用户能随手改的外部数据，
 * 真正的校验在各自的 `normalize*` 里，这里只负责「读不出来就用兜底值」。
 */
export function readJSON<T>(key: string, fallback: T): T {
    try {
        const raw = window.localStorage.getItem(PREFIX + key)
        if (raw === null) return fallback
        return JSON.parse(raw) as T
    } catch (e) {
        // 隐私模式会直接抛异常，脏数据也会解析失败
        console.warn(`[STORAGE] 读取 ${key} 失败：`, e)
        return fallback
    }
}

/** @returns 是否写入成功 */
export function writeJSON(key: string, value: unknown): boolean {
    try {
        window.localStorage.setItem(PREFIX + key, JSON.stringify(value))
        return true
    } catch (e) {
        console.warn(`[STORAGE] 写入 ${key} 失败：`, e)
        return false
    }
}

