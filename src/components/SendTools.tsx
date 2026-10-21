import React from 'react'

import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Divider from '@mui/material/Divider'
import FormControlLabel from '@mui/material/FormControlLabel'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'

import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import SendIcon from '@mui/icons-material/Send'

import { parseHex } from '../modules/hex'
import { MAX_MACROS, createMacro } from '../modules/macros'
import type { Macro, TimerConfig, TimerStatus } from '../types'

export type SendToolsTab = 'timer' | 'macros'

export interface SendToolsProps {
    open: boolean
    tab: SendToolsTab
    onTabChange: (tab: SendToolsTab) => void
    close: () => void
    timer: TimerStatus & { payload: string; hex: boolean }
    /** 返回错误文案，空串表示已经开始 */
    startTimer: (config: TimerConfig) => string
    stopTimer: () => void
    macros: Macro[]
    saveMacros: (list: Macro[]) => void
    sendMacro: (macro: Macro) => void
}

const SendTools = (props: SendToolsProps) => {
    const [intervalMs, setIntervalMs] = React.useState(`${props.timer.intervalMs}`)
    const [payload, setPayload] = React.useState(props.timer.payload)
    const [hex, setHex] = React.useState(props.timer.hex)
    const [timerError, setTimerError] = React.useState('')

    const [draft, setDraft] = React.useState<Macro | null>(null)
    const [macroError, setMacroError] = React.useState('')
    const [deletingId, setDeletingId] = React.useState('')

    // 每次打开都用主界面里的最新配置回填
    React.useEffect(() => {
        if (!props.open) return

        setIntervalMs(`${props.timer.intervalMs}`)
        setPayload(props.timer.payload)
        setHex(props.timer.hex)
        setTimerError('')
        setMacroError('')
        setDraft(null)
        setDeletingId('')
    }, [props.open, props.timer.intervalMs, props.timer.payload, props.timer.hex])

    const start = () => {
        setTimerError(props.startTimer({
            // 输入框里是字符串，范围校验交给上层
            intervalMs: Number(intervalMs),
            payload: payload,
            hex: hex,
        }))
    }

    const saveDraft = () => {
        if (!draft) return

        if (draft.payload.trim() === '') {
            setMacroError('内容不能为空')
            return
        }

        if (draft.hex) {
            const { error } = parseHex(draft.payload)

            if (error) {
                setMacroError(error)
                return
            }
        }

        const exists = props.macros.some(macro => macro.id === draft.id)

        if (!exists && props.macros.length >= MAX_MACROS) {
            setMacroError(`最多只能存 ${MAX_MACROS} 条宏`)
            return
        }

        const next = exists
            ? props.macros.map(macro => (macro.id === draft.id ? draft : macro))
            : props.macros.concat([draft])

        props.saveMacros(next)
        setDraft(null)
        setMacroError('')
    }

    const removeMacro = (id: string) => {
        props.saveMacros(props.macros.filter(macro => macro.id !== id))
        setDeletingId('')
    }

    return (
        <Dialog open={props.open} onClose={props.close} fullWidth maxWidth='sm'>
            <DialogTitle>发送工具</DialogTitle>

            <Tabs
                value={props.tab}
                onChange={(_e, value: SendToolsTab) => props.onTabChange(value)}
                sx={{ px: 3 }}
            >
                <Tab value='timer' label='定时发送' />
                <Tab value='macros' label='命令宏' />
            </Tabs>

            <DialogContent dividers>

                {props.tab === 'timer' &&
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
                        <TextField
                            label='发送间隔（毫秒）'
                            type='number'
                            size='small'
                            fullWidth
                            value={intervalMs}
                            onChange={(e) => setIntervalMs(e.target.value)}
                            helperText='50 – 600000 毫秒。1000 = 每秒一次'
                        />

                        <TextField
                            label='发送内容'
                            size='small'
                            fullWidth
                            multiline
                            minRows={3}
                            maxRows={8}
                            value={payload}
                            onChange={(e) => setPayload(e.target.value)}
                            placeholder={hex ? '例如 48 65 6C 6C 6F' : '例如 AT+GMR'}
                        />

                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={hex}
                                    onChange={(e) => setHex(e.target.checked)}
                                />
                            }
                            label='按十六进制解析内容'
                        />

                        {timerError !== '' && <Alert severity='error'>{timerError}</Alert>}

                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            {props.timer.running ?
                                <Button variant='contained' color='error' disableElevation onClick={props.stopTimer}>
                                    停止（已发送 {props.timer.count} 次）
                                </Button>
                                :
                                <Button variant='contained' disableElevation onClick={start}>
                                    开始定时发送
                                </Button>
                            }

                            <Typography variant='caption' sx={{ color: 'text.secondary' }}>
                                断开连接或关闭页面会自动停止
                            </Typography>
                        </Box>
                    </Box>
                }

                {props.tab === 'macros' &&
                    <Box>
                        <Typography variant='body2' sx={{ color: 'text.secondary', mb: 1 }}>
                            常用命令存成宏，之后终端下方会出现一排按钮，点一下直接发送。
                        </Typography>

                        <List dense disablePadding>
                            {props.macros.length === 0 &&
                                <Typography variant='body2' sx={{ color: 'text.secondary', py: 1 }}>
                                    还没有宏。
                                </Typography>
                            }

                            {props.macros.map(macro =>
                                <ListItem key={macro.id} divider disableGutters sx={{ gap: 1, alignItems: 'flex-start' }}>
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography variant='body2' sx={{ fontWeight: 600 }}>
                                            {macro.name}{macro.hex ? ' · HEX' : ''}
                                        </Typography>
                                        <Typography variant='caption' sx={{
                                            display: 'block',
                                            fontFamily: 'Roboto Mono, monospace',
                                            color: 'text.secondary',
                                            wordBreak: 'break-all',
                                        }}>
                                            {macro.payload.slice(0, 120) || '（内容为空）'}
                                        </Typography>
                                    </Box>

                                    {deletingId === macro.id ?
                                        <Box sx={{ display: 'flex', gap: .5, flexShrink: 0 }}>
                                            <Button size='small' color='error' onClick={() => removeMacro(macro.id)}>删除</Button>
                                            <Button size='small' onClick={() => setDeletingId('')}>取消</Button>
                                        </Box>
                                        :
                                        <Box sx={{ display: 'flex', flexShrink: 0 }}>
                                            <Tooltip title='发送'>
                                                <IconButton size='small' aria-label={`发送宏 ${macro.name}`} onClick={() => props.sendMacro(macro)}>
                                                    <SendIcon fontSize='small' />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title='编辑'>
                                                <IconButton size='small' aria-label={`编辑宏 ${macro.name}`} onClick={() => setDraft({ ...macro })}>
                                                    <EditIcon fontSize='small' />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title='删除'>
                                                <IconButton size='small' aria-label={`删除宏 ${macro.name}`} onClick={() => setDeletingId(macro.id)}>
                                                    <DeleteIcon fontSize='small' />
                                                </IconButton>
                                            </Tooltip>
                                        </Box>
                                    }
                                </ListItem>
                            )}
                        </List>

                        <Divider sx={{ my: 2 }} />

                        {draft === null ?
                            <Button startIcon={<AddIcon />} onClick={() => { setDraft(createMacro()); setMacroError('') }}>
                                新增宏
                            </Button>
                            :
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                <Typography variant='subtitle2'>
                                    编辑宏
                                </Typography>

                                <TextField
                                    label='名称'
                                    size='small'
                                    fullWidth
                                    value={draft.name}
                                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                                    placeholder='例如：查询版本'
                                />

                                <TextField
                                    label='内容'
                                    size='small'
                                    fullWidth
                                    multiline
                                    minRows={2}
                                    maxRows={6}
                                    value={draft.payload}
                                    onChange={(e) => setDraft({ ...draft, payload: e.target.value })}
                                    placeholder={draft.hex ? '例如 41 54 0D 0A' : '例如 AT+GMR'}
                                />

                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={draft.hex}
                                            onChange={(e) => setDraft({ ...draft, hex: e.target.checked })}
                                        />
                                    }
                                    label='按十六进制解析'
                                />

                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={draft.appendLineEnding}
                                            disabled={draft.hex}
                                            onChange={(e) => setDraft({ ...draft, appendLineEnding: e.target.checked })}
                                        />
                                    }
                                    label='自动追加行尾符（HEX 模式不追加）'
                                />

                                {macroError !== '' && <Alert severity='error'>{macroError}</Alert>}

                                <Box sx={{ display: 'flex', gap: 1 }}>
                                    <Button variant='contained' disableElevation onClick={saveDraft}>保存</Button>
                                    <Button onClick={() => { setDraft(null); setMacroError('') }}>取消</Button>
                                </Box>
                            </Box>
                        }
                    </Box>
                }

            </DialogContent>

            <DialogActions>
                <Button onClick={props.close} color='secondary'>关闭</Button>
            </DialogActions>
        </Dialog>
    )
}

export default React.memo(SendTools)
