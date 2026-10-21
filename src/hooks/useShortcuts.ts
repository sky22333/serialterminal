import React from 'react'

/**
 * 全局快捷键：挂在 window 上，焦点在输入框、滚动区里都有效。
 * 弹窗打开时不抢键，否则在设置面板里按 Ctrl+K 会把终端清了。
 *
 * 用法：useShortcuts({ k: () => clear(), l: () => focus() })
 */

export type ShortcutHandlers = Record<string, (event: KeyboardEvent) => void>

const isDialogOpen = () => document.querySelector('.MuiDialog-container') !== null

export default function useShortcuts(handlers: ShortcutHandlers): void {
    // 用 ref 存最新的处理函数：订阅只做一次，不会因为每次渲染都是新对象而反复解绑
    const handlersRef = React.useRef(handlers)

    React.useEffect(() => {
        handlersRef.current = handlers
    })

    React.useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            // 只处理 Ctrl/Cmd + 单个字母，不碰 Alt、Shift 组合
            if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return
            if (isDialogOpen()) return

            const handler = handlersRef.current[(e.key || '').toLowerCase()]
            if (typeof handler !== 'function') return

            // 拦下来，否则 Ctrl+S 会弹保存对话框、Ctrl+F 会弹浏览器查找
            e.preventDefault()
            handler(e)
        }

        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [])
}
