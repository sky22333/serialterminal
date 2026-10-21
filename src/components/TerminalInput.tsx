import React from 'react'

import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Tooltip from '@mui/material/Tooltip'

import useShortcuts from '../hooks/useShortcuts'
import { parseHex } from '../modules/hex'
import type { InputMode } from '../types'

export interface TerminalInputProps {
    input: string
    setInput: (value: string) => void
    /** 返回错误文案，空串表示成功 */
    send: () => string
    history: string[]
    mode: InputMode
    onModeChange: (mode: InputMode) => void
}

// 输入后自动聚焦
const useFocus = (): [React.RefObject<HTMLInputElement | null>, () => void] => {
    const htmlElRef = React.useRef<HTMLInputElement | null>(null)
    const setFocus = React.useCallback(() => {
        if (htmlElRef.current) htmlElRef.current.focus()
    }, [])

    return [htmlElRef, setFocus]
}

const TerminalInput = (props: TerminalInputProps) => {
    const [inputFocus, setInputFocus] = useFocus()

    // 正在浏览发送历史的第几条（-1 表示没在浏览），以及开始浏览前已输入的内容
    const [historyIndex, setHistoryIndex] = React.useState(-1)
    const draftRef = React.useRef('')

    const [sendError, setSendError] = React.useState('')

    React.useEffect(() => {
        setInputFocus()
    }, [props.input, setInputFocus])

    React.useEffect(() => {
        setSendError('')
    }, [props.input, props.mode])

    // Ctrl+L 回到输入框
    useShortcuts({ l: () => setInputFocus() })

    const handleChange = (value: string) => {
        setHistoryIndex(-1)
        props.setInput(value)
    }

    const browseHistory = (direction: number) => {
        const history = props.history || []
        if (history.length === 0) return

        if (direction < 0) {
            if (historyIndex === -1) {
                draftRef.current = props.input
                setHistoryIndex(0)
                props.setInput(history[0])
                return
            }

            const next = Math.min(historyIndex + 1, history.length - 1)
            setHistoryIndex(next)
            props.setInput(history[next])
            return
        }

        if (historyIndex === -1) return

        const next = historyIndex - 1

        if (next < 0) {
            setHistoryIndex(-1)
            props.setInput(draftRef.current)
        } else {
            setHistoryIndex(next)
            props.setInput(history[next])
        }
    }

    const send = () => {
        const error = props.send()

        setSendError(error || '')
        setHistoryIndex(-1)
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter') {
            send()
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            browseHistory(-1)
        } else if (e.key === 'ArrowDown') {
            e.preventDefault()
            browseHistory(1)
        }
    }

    const isHex = props.mode === 'hex'

    // 输到一半就提示哪里不对，而不是等按了发送才报错
    const hexError = React.useMemo(() => {
        if (!isHex || props.input.trim() === '') return ''
        return parseHex(props.input).error
    }, [isHex, props.input])

    const error = hexError || sendError

    return (
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
            <ToggleButtonGroup
                orientation='vertical'
                exclusive
                size='small'
                value={props.mode}
                onChange={(_e, value: InputMode | null) => { if (value) props.onModeChange(value) }}
                sx={{
                    width: '4.6rem',
                    // 与右侧输入框、发送按钮同高，三者上下边对齐
                    height: 56,
                    flexShrink: 0,
                    '& .MuiToggleButton-root': {
                        flex: 1,
                        minHeight: 0,
                        py: 0,
                        px: 0,
                        fontSize: '.72rem',
                        lineHeight: 1.1,
                        color: 'text.secondary',
                        // 默认选中态只有 8% 黑，白底上几乎看不出；用主色着色并加粗，
                        // 让「选中」同时有底色和字重两个线索
                        '&.Mui-selected': {
                            color: '#2c387e',
                            backgroundColor: 'rgba(44, 56, 126, .18)',
                            fontWeight: 600,
                            '&:hover': { backgroundColor: 'rgba(44, 56, 126, .26)' },
                        },
                    },
                }}
            >
                <Tooltip title='按普通文本发送' placement='right'>
                    <ToggleButton value='text' aria-label='文本输入'>
                        文本
                    </ToggleButton>
                </Tooltip>
                <Tooltip title='把输入解析成字节发送' placement='right'>
                    <ToggleButton value='hex' aria-label='HEX 输入'>
                        HEX
                    </ToggleButton>
                </Tooltip>
            </ToggleButtonGroup>

            <TextField
                label='输入'
                variant='outlined'
                onChange={(e) => handleChange(e.target.value)}
                value={props.input}
                fullWidth
                onKeyDown={handleKeyDown}
                autoComplete='off'
                autoFocus
                inputRef={inputFocus}
                error={Boolean(error)}
                helperText={error || undefined}
                placeholder={
                    isHex
                        ? '例如 48 65 6C 6C 6F'
                        : (props.history.length > 0 ? '↑↓ 可翻发送历史' : '')
                }
            />

            <Button
                sx={{
                    height: 56,
                    width: '7rem',
                    flexShrink: 0,
                    color: '#fff',
                    '&.Mui-disabled': {
                        color: '#aaa'
                    },
                }}
                variant='contained'
                disableElevation
                onClick={send}
            >发送</Button>
        </Box>
    )
}

export default TerminalInput
