import React from 'react'

import Box from '@mui/material/Box'

import MacroBar from './MacroBar'
import TerminalInput from './TerminalInput'
import TerminalOutput from './TerminalOutput'
import type { TerminalOutputProps } from './TerminalOutput'
import type { InputMode, Macro } from '../types'

export interface TerminalProps extends Omit<TerminalOutputProps, 'setInput'> {
  /** 发送内容，返回错误文案（空串表示成功） */
  send: (value: string, mode: InputMode) => string
  /** 发送单个原始字节，用于 Ctrl+C / Ctrl+D */
  sendRaw: (byte: number) => void
  ctrl: boolean
  macros: Macro[]
  sendMacro: (macro: Macro) => void
  openMacros: () => void
}

const Terminal = (props: TerminalProps) => {
  const [input, setInput] = React.useState('')
  const [mode, setMode] = React.useState<InputMode>('text')

  const handleSend = () => {
    const error = props.send(input, mode)

    // 失败时保留内容，方便改完重发
    if (!error) setInput('')

    return error || ''
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!props.ctrl) return

    // 有选中文字时放行，否则没法复制
    const selection = window.getSelection()
    if (selection && selection.toString().length > 0) return

    const key = (e.key || '').toLowerCase()

    if ((e.ctrlKey || e.metaKey) && key === 'c') {
      e.preventDefault()
      props.sendRaw(3) // 0x03 = Ctrl+C / SIGINT
    } else if ((e.ctrlKey || e.metaKey) && key === 'd') {
      e.preventDefault()
      props.sendRaw(4) // 0x04 = Ctrl+D / EOF
    }
  }

  return (
    <Box
      onKeyDown={handleKeyDown}
      sx={{ p: .75, display: 'flex', flexDirection: 'column', gap: 1, flex: 1, minHeight: 0 }}
    >
      <TerminalOutput
        lines={props.lines}
        pending={props.pending}
        history={props.history}
        setInput={setInput}
        openSettings={props.openSettings}
        clear={props.clear}
        notify={props.notify}
        echo={props.echo}
        time={props.time}
        ansi={props.ansi}
        wrap={props.wrap}
        hexView={props.hexView}
        toggleHexView={props.toggleHexView}
        openSendTools={props.openSendTools}
        canSignal={props.canSignal}
        runSignal={props.runSignal}
        timer={props.timer}
        stopTimer={props.stopTimer}
      />

      {props.macros.length > 0 &&
        <MacroBar
          macros={props.macros}
          send={props.sendMacro}
          manage={props.openMacros}
        />
      }

      <TerminalInput
        input={input}
        setInput={setInput}
        send={handleSend}
        history={props.history}
        mode={mode}
        onModeChange={setMode}
      />
    </Box>
  )
}

export default Terminal
