import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

import TerminalOutput from './TerminalOutput'
import type { TerminalOutputProps } from './TerminalOutput'
import type { Line } from '../types'

const lines: Line[] = [
    { type: 'output', value: '\u001b[32mready\u001b[0m', time: new Date(2026, 9, 21, 8, 3, 7) },
    { type: 'output', value: 'boot failed', time: new Date(2026, 9, 21, 8, 3, 8) },
]

const baseProps: TerminalOutputProps = {
    lines,
    pending: '',
    history: ['ping'],
    setInput: vi.fn(),
    openSettings: vi.fn(),
    clear: vi.fn(),
    notify: vi.fn(),
    echo: true,
    time: false,
    ansi: true,
    wrap: true,
    hexView: false,
    toggleHexView: vi.fn(),
    openSendTools: vi.fn(),
    canSignal: true,
    runSignal: vi.fn(),
    timer: { running: false, intervalMs: 1000, count: 0 },
    stopTimer: vi.fn(),
}

describe('TerminalOutput', () => {
    test('渲染输出并把 ANSI 转义序列变成颜色，而不是乱码', () => {
        const { container } = render(<TerminalOutput {...baseProps} />)

        expect(container.textContent).toContain('ready')
        expect(container.textContent).not.toContain('\u001b')

        // 绿色 31/32 号色被翻译成行内样式
        const colored = container.querySelector('span.output span[style]')
        expect(colored).not.toBeNull()
        expect(colored?.textContent).toBe('ready')
    })

    test('关闭 ANSI 时仍然不显示控制符', () => {
        const { container } = render(<TerminalOutput {...baseProps} ansi={false} />)

        expect(container.textContent).toContain('ready')
        expect(container.textContent).not.toContain('\u001b')
        expect(container.textContent).not.toContain('[32m')
    })

    test('未换行的内容实时显示', () => {
        const { container } = render(<TerminalOutput {...baseProps} pending='login: ' />)
        expect(container.querySelector('span.pending')?.textContent).toBe('login: ')
    })

    test('搜索能定位到匹配行并给出计数', async () => {
        const { container } = render(<TerminalOutput {...baseProps} />)

        fireEvent.click(screen.getByLabelText('搜索输出'))
        fireEvent.change(screen.getByPlaceholderText('搜索终端输出'), { target: { value: 'fail' } })

        // 搜到之后会等一小段防抖时间
        await waitFor(() => expect(container.querySelector('.searchCount')?.textContent).toBe('1 / 1'))
        expect(container.querySelector('p.matchCurrent')).not.toBeNull()
    })

    test('清空需要二次确认', () => {
        const clear = vi.fn()
        render(<TerminalOutput {...baseProps} clear={clear} />)

        fireEvent.click(screen.getByLabelText('清空终端'))
        expect(clear).not.toHaveBeenCalled()

        fireEvent.click(screen.getByText('清空'))
        expect(clear).toHaveBeenCalledTimes(1)
    })

    test('Ctrl+F 打开搜索', () => {
        render(<TerminalOutput {...baseProps} />)

        fireEvent.keyDown(window, { key: 'f', ctrlKey: true })
        expect(screen.getByPlaceholderText('搜索终端输出')).toBeInTheDocument()
    })

    test('Ctrl+K 打开清空确认', () => {
        render(<TerminalOutput {...baseProps} />)

        fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
        expect(screen.getByText('清空终端？')).toBeInTheDocument()
    })

    test('Ctrl+S 打开导出', () => {
        render(<TerminalOutput {...baseProps} />)

        fireEvent.keyDown(window, { key: 's', ctrlKey: true })
        expect(screen.getByText('导出日志')).toBeInTheDocument()
    })

    test('终端为空时 Ctrl+K 不弹确认', () => {
        render(<TerminalOutput {...baseProps} lines={[]} />)

        fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
        expect(screen.queryByText('清空终端？')).toBeNull()
    })

    test('几万行也只渲染视口附近的几十行', () => {
        const many: Line[] = Array.from({ length: 5000 }, (_, i) => ({
            type: 'output',
            value: `line ${i}`,
            time: new Date(),
        }))

        const { container } = render(<TerminalOutput {...baseProps} lines={many} />)

        const rendered = container.querySelectorAll('p[data-index]')

        expect(rendered.length).toBeGreaterThan(0)
        expect(rendered.length).toBeLessThan(80)
        // 第一屏的第一行必须在
        expect(container.textContent).toContain('line 0')
    })

    test('HEX 视图的行原样渲染', () => {
        const hexLines: Line[] = [
            { type: 'output', value: '00000000  48 65 6C 6C 6F 00 00 00  00 00 00 00 00 00 00 00  |Hello...........|', time: new Date() },
        ]

        const { container } = render(<TerminalOutput {...baseProps} lines={hexLines} hexView />)

        expect(container.textContent).toContain('|Hello...........|')
    })

    test('HEX 视图按钮把切换意图交给上层', () => {
        const toggleHexView = vi.fn()
        render(<TerminalOutput {...baseProps} toggleHexView={toggleHexView} />)

        fireEvent.click(screen.getByLabelText('HEX 视图'))
        expect(toggleHexView).toHaveBeenCalledTimes(1)
    })

    test('定时发送时显示角标，点停止会回调', () => {
        const stopTimer = vi.fn()
        render(
            <TerminalOutput
                {...baseProps}
                timer={{ running: true, intervalMs: 1000, count: 3 }}
                stopTimer={stopTimer}
            />
        )

        expect(screen.getByText(/已发 3 次/)).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: '停止' }))
        expect(stopTimer).toHaveBeenCalledTimes(1)
    })

    test('DTR/RTS 菜单能触发信号时序', () => {
        const runSignal = vi.fn()
        render(<TerminalOutput {...baseProps} runSignal={runSignal} />)

        fireEvent.click(screen.getByLabelText('DTR RTS 信号'))
        fireEvent.click(screen.getByText('DTR 脉冲'))

        expect(runSignal).toHaveBeenCalledWith('dtr-pulse')
    })

    test('端口不支持信号时按钮禁用', () => {
        render(<TerminalOutput {...baseProps} canSignal={false} />)

        expect(screen.getByLabelText('DTR RTS 信号')).toBeDisabled()
    })

    test('发送历史用独立的历史列表，而不是从当前视图里筛', () => {
        render(<TerminalOutput {...baseProps} />)

        fireEvent.click(screen.getByLabelText('发送历史'))
        expect(screen.getByText('ping')).toBeInTheDocument()
    })
})
