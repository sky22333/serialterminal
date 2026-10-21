import React from 'react'

import Autocomplete from '@mui/material/Autocomplete'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import Divider from '@mui/material/Divider'
import FormControl from '@mui/material/FormControl'
import FormControlLabel from '@mui/material/FormControlLabel'
import FormGroup from '@mui/material/FormGroup'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import TextField from '@mui/material/TextField'

import { BAUD_MAX, BAUD_MIN, DEFAULT_SETTINGS, LINE_ENDINGS } from '../modules/settings'
import type { LineEndingKey, Settings as SettingsValue } from '../types'

export interface SettingsProps {
    open: boolean
    close: () => void
    settings: SettingsValue
    save: (next: SettingsValue) => void
    /** 端口已连接时不允许改波特率 */
    openPort: boolean
}

const baudrates = [
    300,
    1200,
    2400,
    4800,
    9600,
    19200,
    38400,
    57600,
    74880,
    115200,
    230400,
    250000,
    460800,
    500000,
    921600,
    1000000,
    2000000,
]

// key 与 settings 模块的 LINE_ENDINGS 一一对应，漏了会编译不过
const lineEndingLabels: Record<LineEndingKey, string> = {
    'None': '无',
    '\\n': 'LF（\\n）',
    '\\r': 'CR（\\r）',
    '\\r\\n': 'CRLF（\\r\\n）',
}

const lineEndings = (Object.keys(LINE_ENDINGS) as LineEndingKey[]).map(value => ({
    value: value,
    label: lineEndingLabels[value],
}))

const formElementCSS = {
    marginTop: 1,
    minWidth: '10em',
}

const Settings = (props: SettingsProps) => {
    // 手填的波特率可能是空串或越界值，保存时才校验
    const [baudRate, setBaudRate] = React.useState<number | string>(props.settings.baudRate)
    const [lineEnding, setLineEnding] = React.useState<LineEndingKey>(props.settings.lineEnding)
    const [echoFlag, setEchoFlag] = React.useState(props.settings.echoFlag)
    const [timeFlag, setTimeFlag] = React.useState(props.settings.timeFlag)
    const [ctrlFlag, setCtrlFlag] = React.useState(props.settings.ctrlFlag)
    const [ansiFlag, setAnsiFlag] = React.useState(props.settings.ansiFlag)
    const [wrapFlag, setWrapFlag] = React.useState(props.settings.wrapFlag)
    const [hexView, setHexView] = React.useState(props.settings.hexView)

    const cancel = () => {
        setBaudRate(props.settings.baudRate)
        setLineEnding(props.settings.lineEnding)
        setEchoFlag(props.settings.echoFlag)
        setTimeFlag(props.settings.timeFlag)
        setCtrlFlag(props.settings.ctrlFlag)
        setAnsiFlag(props.settings.ansiFlag)
        setWrapFlag(props.settings.wrapFlag)
        setHexView(props.settings.hexView)

        props.close()
    }

    const reset = () => {
        if (!props.openPort) setBaudRate(DEFAULT_SETTINGS.baudRate)
        setLineEnding(DEFAULT_SETTINGS.lineEnding)
        setEchoFlag(DEFAULT_SETTINGS.echoFlag)
        setTimeFlag(DEFAULT_SETTINGS.timeFlag)
        setCtrlFlag(DEFAULT_SETTINGS.ctrlFlag)
        setAnsiFlag(DEFAULT_SETTINGS.ansiFlag)
        setWrapFlag(DEFAULT_SETTINGS.wrapFlag)
        setHexView(DEFAULT_SETTINGS.hexView)
    }

    const save = () => {
        // 校验不过就保持原值
        const parsed = Number(baudRate)
        const valid = Number.isInteger(parsed) && parsed >= BAUD_MIN && parsed <= BAUD_MAX

        props.save({
            baudRate: valid ? parsed : props.settings.baudRate,
            lineEnding: lineEnding,
            echoFlag: echoFlag,
            timeFlag: timeFlag,
            ctrlFlag: ctrlFlag,
            ansiFlag: ansiFlag,
            wrapFlag: wrapFlag,
            hexView: hexView,
        })

        props.close()
    }

    return (
        <Dialog open={props.open} onClose={cancel}>
            <DialogTitle>设置</DialogTitle>

            <DialogContent>
                <DialogContentText>
                    串口连接
                </DialogContentText>

                <Autocomplete
                    freeSolo
                    disableClearable
                    disabled={props.openPort}
                    options={baudrates}
                    value={baudRate}
                    onChange={(_e, value) => { if (value !== null) setBaudRate(value) }}
                    onInputChange={(_e, value, reason) => {
                        if (reason === 'input') setBaudRate(value)
                    }}
                    getOptionLabel={(option) => `${option}`}
                    isOptionEqualToValue={(option, value) => Number(option) === Number(value)}
                    renderInput={(params) => (
                        <TextField
                            {...params}
                            variant='filled'
                            label='波特率'
                            helperText={props.openPort ? '需断开重连后生效' : `可直接输入，范围 ${BAUD_MIN}–${BAUD_MAX}`}
                            sx={formElementCSS}
                        />
                    )}
                />

                <FormControl variant='filled' fullWidth sx={formElementCSS} >
                    <InputLabel>行尾符</InputLabel>
                    <Select
                        value={lineEnding}
                        onChange={(e) => setLineEnding(e.target.value as LineEndingKey)}
                        label='行尾符'
                    >
                        {lineEndings.map(ending =>
                            <MenuItem value={ending.value} key={ending.value}>{ending.label}</MenuItem>
                        )}
                    </Select>
                </FormControl>

                <FormGroup sx={{ mt: 1 }}>
                    <FormControlLabel control={
                        <Checkbox
                            checked={echoFlag}
                            onChange={(e) => setEchoFlag(e.target.checked)}
                        />
                    } label='显示我发送的内容（本地回显）' />
                </FormGroup>

                <FormGroup>
                    <FormControlLabel control={
                        <Checkbox
                            checked={ctrlFlag}
                            onChange={(e) => setCtrlFlag(e.target.checked)}
                        />
                    } label='识别 Ctrl+C / Ctrl+D' />
                </FormGroup>

                <Divider sx={{ mt: 2, mb: 1 }} />

                <DialogContentText>
                    显示
                </DialogContentText>

                <FormGroup sx={{ mt: 1 }}>
                    <FormControlLabel control={
                        <Checkbox
                            checked={ansiFlag}
                            onChange={(e) => setAnsiFlag(e.target.checked)}
                        />
                    } label='解析 ANSI 颜色' />
                </FormGroup>

                <FormGroup>
                    <FormControlLabel control={
                        <Checkbox
                            checked={hexView}
                            onChange={(e) => setHexView(e.target.checked)}
                        />
                    } label='HEX 视图（按字节显示，切换不丢内容）' />
                </FormGroup>

                <FormGroup>
                    <FormControlLabel control={
                        <Checkbox
                            checked={wrapFlag}
                            onChange={(e) => setWrapFlag(e.target.checked)}
                        />
                    } label='长行自动折行（关闭则横向滚动）' />
                </FormGroup>

                <FormGroup>
                    <FormControlLabel control={
                        <Checkbox
                            checked={timeFlag}
                            onChange={(e) => setTimeFlag(e.target.checked)}
                        />
                    } label='显示时间戳' />
                </FormGroup>

            </DialogContent>

            <DialogActions>
                <Button onClick={reset} color='error'>恢复默认</Button>
                <Button onClick={cancel} color='secondary'>取消</Button>
                <Button onClick={save} color='primary'>保存</Button>
            </DialogActions>
        </Dialog>
    )
}

export default React.memo(Settings)
