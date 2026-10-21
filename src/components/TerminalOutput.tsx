import React from 'react'

import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonGroup from '@mui/material/ButtonGroup'
import Checkbox from '@mui/material/Checkbox'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import FormControl from '@mui/material/FormControl'
import FormControlLabel from '@mui/material/FormControlLabel'
import FormGroup from '@mui/material/FormGroup'
import IconButton from '@mui/material/IconButton'
import InputLabel from '@mui/material/InputLabel'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'

import CloseIcon from '@mui/icons-material/Close'
import CodeIcon from '@mui/icons-material/Code'
import FileDownloadIcon from '@mui/icons-material/FileDownload'
import HighlightOffIcon from '@mui/icons-material/HighlightOff'
import HistoryIcon from '@mui/icons-material/History'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import PauseIcon from '@mui/icons-material/Pause'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import ScheduleSendIcon from '@mui/icons-material/ScheduleSend'
import SearchIcon from '@mui/icons-material/Search'
import SettingsIcon from '@mui/icons-material/Settings'
import TerminalIcon from '@mui/icons-material/Terminal'
import VerticalAlignBottomIcon from '@mui/icons-material/VerticalAlignBottom'

import { parseAnsi, stripAnsi } from '../modules/ansiParser'
import { downloadLog, formatTime } from '../modules/exportLog'
import type { LogFormat } from '../modules/exportLog'
import { SIGNAL_ACTIONS } from '../modules/signals'
import useShortcuts from '../hooks/useShortcuts'
import useVirtualWindow from '../hooks/useVirtualWindow'
import type { Line, TimerStatus, ToastSeverity } from '../types'

import './TerminalOutput.css'

export interface TerminalOutputProps {
  lines: Line[]
  pending: string
  history: string[]
  setInput: (value: string) => void
  openSettings: () => void
  clear: () => void
  notify: (value: string, severity?: ToastSeverity) => void
  echo: boolean
  time: boolean
  ansi: boolean
  wrap: boolean
  hexView: boolean
  toggleHexView: () => void
  openSendTools: () => void
  canSignal: boolean
  runSignal: (id: string) => void
  timer: TimerStatus
  stopTimer: () => void
}

/** 「还没换行的那一行」在虚拟列表里占的那个位置，用稳定对象做测量键 */
interface PendingItem {
  pending: true
}

type RowItem = Line | PendingItem

const highlight = (text: string, needle: string): React.ReactNode => {
  const lower = text.toLowerCase()
  const found = lower.indexOf(needle)
  if (found === -1) return text

  const parts: React.ReactNode[] = []
  let from = 0
  let at = found
  let key = 0

  while (at !== -1) {
    if (at > from) parts.push(text.slice(from, at))
    parts.push(<mark key={key++}>{text.slice(at, at + needle.length)}</mark>)
    from = at + needle.length
    at = lower.indexOf(needle, from)
  }

  if (from < text.length) parts.push(text.slice(from))

  return parts
}

interface LineTextProps {
  text: string
  ansi: boolean
  needle: string
}

// 按需解析 ANSI，再套上关键字高亮
const LineText = React.memo((props: LineTextProps) => {
  const { text, ansi, needle } = props

  const segments = React.useMemo(
    () => (ansi ? parseAnsi(text) : [{ text: stripAnsi(text), style: null }]),
    [text, ansi]
  )

  return (
    <React.Fragment>
      {segments.map((segment, i) => {
        const content = needle ? highlight(segment.text, needle) : segment.text

        // 没有样式就不额外套 span，省一层 DOM
        return segment.style
          ? <span key={i} style={segment.style}>{content}</span>
          : <React.Fragment key={i}>{content}</React.Fragment>
      })}
    </React.Fragment>
  )
})

LineText.displayName = 'LineText'

type MeasureFn<T> = (index: number, item: T, height: number) => void

// 在渲染后量一次真实高度，交给虚拟滚动修正偏移
const useRowMeasure = <T extends object>(index: number, item: T, onMeasure: MeasureFn<T>) => {
  const ref = React.useRef<HTMLParagraphElement | null>(null)

  React.useLayoutEffect(() => {
    const node = ref.current
    if (!node) return undefined

    const report = () => onMeasure(index, item, node.offsetHeight)

    report()

    if (typeof ResizeObserver === 'undefined') return undefined

    const observer = new ResizeObserver(report)
    observer.observe(node)

    return () => observer.disconnect()
  }, [index, item, onMeasure])

  return ref
}

interface LineRowProps {
  line: Line
  index: number
  time: boolean
  ansi: boolean
  needle: string
  current: boolean
  onMeasure: MeasureFn<RowItem>
}

const LineRow = React.memo(function LineRow(props: LineRowProps) {
  const { line, index, time, ansi, needle, current, onMeasure } = props
  const ref = useRowMeasure<RowItem>(index, line, onMeasure)

  // 发送空行时整行下划线会变成一条没有说明的黄线，补个符号表明这是一次回车
  const emptyEcho = line.type === 'userInput' && line.value.trim() === ''

  return (
    <p ref={ref} data-index={index} className={current ? 'matchCurrent' : undefined}>
      <span className='time'>{time && `${formatTime(line.time)} `}</span>
      <span className={line.type}>
        {emptyEcho
          ? <span className='emptyEcho'>↵</span>
          : <LineText text={line.value} ansi={ansi && line.type === 'output'} needle={needle} />}
      </span>
    </p>
  )
})

interface PendingRowProps {
  item: PendingItem
  index: number
  text: string
  time: boolean
  ansi: boolean
  needle: string
  onMeasure: MeasureFn<RowItem>
}

const PendingRow = React.memo(function PendingRow(props: PendingRowProps) {
  const { item, index, time, ansi, needle, onMeasure, text } = props
  const ref = useRowMeasure<RowItem>(index, item, onMeasure)

  return (
    <p ref={ref} data-index={index}>
      <span className='time'>{time && `${formatTime(new Date())} `}</span>
      <span className='output pending'>
        <LineText text={text} ansi={ansi} needle={needle} />
      </span>
    </p>
  )
})

const EXPORT_FORMATS: { value: LogFormat; label: string }[] = [
  { value: 'txt', label: '纯文本（.txt）' },
  { value: 'csv', label: '表格（.csv，可用 Excel 打开）' },
  { value: 'json', label: 'JSON（.json，方便脚本处理）' },
  { value: 'md', label: 'Markdown（.md，方便贴到文档）' },
]

interface TipProps {
  title: string
  disabled?: boolean
  children: React.ReactElement
}

/**
 * disabled 的按钮不触发鼠标事件，Tooltip 既不会显示还会在控制台报错。
 * 这类按钮干脆不套 Tooltip。
 */
const Tip = (props: TipProps) => (
  props.disabled ? props.children : <Tooltip title={props.title}>{props.children}</Tooltip>
)

// 距离底部多少像素以内算「贴着底」
const BOTTOM_GAP = 32

const TerminalOutput = (props: TerminalOutputProps) => {
  const [historyOpen, setHistoryOpen] = React.useState(false)
  const [exportOpen, setExportOpen] = React.useState(false)
  const [clearOpen, setClearOpen] = React.useState(false)

  const [signalAnchor, setSignalAnchor] = React.useState<HTMLElement | null>(null)

  const [searchOpen, setSearchOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [activeQuery, setActiveQuery] = React.useState('')
  const [current, setCurrent] = React.useState(0)

  // 自动滚动：滚上去自动暂停，滚回底部自动恢复
  const [autoScroll, setAutoScroll] = React.useState(true)
  const pausedCountRef = React.useRef(0)

  const scrollRef = React.useRef<HTMLDivElement | null>(null)

  const [format, setFormat] = React.useState<LogFormat>('txt')
  const [withTime, setWithTime] = React.useState(props.time)
  const [withInput, setWithInput] = React.useState(true)

  // echo 打开时整份列表都要显示：直接复用同一个数组，下游的 memo 才能命中
  const visibleLines = React.useMemo(
    () => (props.echo ? props.lines : props.lines.filter(line => line.type === 'output')),
    [props.lines, props.echo]
  )

  const pendingItem = React.useMemo<PendingItem>(() => ({ pending: true }), [])
  const hasPending = props.pending !== ''

  const items = React.useMemo(
    () => (hasPending ? [...visibleLines, pendingItem] : visibleLines),
    [visibleLines, hasPending, pendingItem]
  )

  // 折行开关会改变每一行的高度，之前的测量结果作废
  const viewport = useVirtualWindow<RowItem>({
    items: items,
    scrollRef: scrollRef,
    estimate: 21,
    resetKey: props.wrap,
  })

  // 搜索防抖：50k 行时每敲一个字都全量扫一遍会卡
  React.useEffect(() => {
    if (query === '') {
      setActiveQuery('')
      return undefined
    }

    const id = window.setTimeout(() => setActiveQuery(query), 180)
    return () => window.clearTimeout(id)
  }, [query])

  const needle = activeQuery.trim().toLowerCase()

  const matches = React.useMemo(() => {
    if (!needle) return []

    const found: number[] = []
    for (let i = 0; i < visibleLines.length; i++) {
      const value = visibleLines[i].value
      if (value && stripAnsi(value).toLowerCase().includes(needle)) found.push(i)
    }
    return found
  }, [visibleLines, needle])

  const safeCurrent = matches.length === 0 ? 0 : Math.min(current, matches.length - 1)
  const currentIndex = matches.length === 0 ? -1 : matches[safeCurrent]

  const closeSearch = React.useCallback(() => {
    setSearchOpen(false)
    setQuery('')
    setActiveQuery('')
    setCurrent(0)
  }, [])

  // Esc 关闭搜索（弹窗打开时交给弹窗自己处理）
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !searchOpen) return
      if (document.querySelector('.MuiDialog-container')) return
      closeSearch()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [searchOpen, closeSearch])

  // 自动贴底。搜索期间不抢滚动，否则跳转会被一直拉回底部
  React.useEffect(() => {
    if (!autoScroll || needle) return

    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [autoScroll, needle, viewport.totalHeight, visibleLines.length, props.pending, props.wrap])

  // 命中行滚动到视口中间。只在命中项变化时滚一次，避免新日志把视图拽走
  const lastMatchRef = React.useRef('')
  React.useEffect(() => {
    if (!needle || matches.length === 0) {
      lastMatchRef.current = ''
      return
    }

    const key = `${needle}:${safeCurrent}:${matches.length}`
    if (lastMatchRef.current === key) return
    lastMatchRef.current = key

    viewport.scrollToIndex(matches[safeCurrent])
  }, [needle, matches, safeCurrent, viewport])

  const handleScroll = () => {
    viewport.handleScroll()

    const el = scrollRef.current
    if (!el) return

    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= BOTTOM_GAP

    if (!atBottom && autoScroll) pausedCountRef.current = visibleLines.length
    setAutoScroll(prev => (prev === atBottom ? prev : atBottom))
  }

  const scrollToBottom = () => {
    viewport.scrollToBottom()
    setAutoScroll(true)
  }

  const toggleAutoScroll = () => {
    if (autoScroll) {
      pausedCountRef.current = visibleLines.length
      setAutoScroll(false)
    } else {
      scrollToBottom()
    }
  }

  const newCount = autoScroll ? 0 : Math.max(0, visibleLines.length - pausedCountRef.current)

  const gotoMatch = (step: number) => {
    if (matches.length === 0) return
    const next = (safeCurrent + step + matches.length) % matches.length
    setCurrent(next)
  }

  const onSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      gotoMatch(e.shiftKey ? -1 : 1)
    }
  }

  const openExport = () => {
    setWithTime(props.time)
    setExportOpen(true)
  }

  const doExport = () => {
    const name = downloadLog(props.lines, { format: format, time: withTime, input: withInput })
    setExportOpen(false)
    props.notify(`已导出 ${name}`, 'success')
  }

  const doClear = () => {
    props.clear()
    setClearOpen(false)
    closeSearch()
  }

  // 全局快捷键：Ctrl+F 搜索 / Ctrl+K 清空（先确认）/ Ctrl+S 导出
  useShortcuts({
    f: () => setSearchOpen(true),
    k: () => {
      if (props.lines.length > 0) setClearOpen(true)
    },
    s: () => {
      if (props.lines.length > 0) openExport()
    },
  })

  // 只渲染视口内的行，几万行也不会把 DOM 撑爆
  const rows: React.ReactNode[] = []
  for (let i = viewport.start; i < viewport.end; i++) {
    if (i < visibleLines.length) {
      rows.push(
        <LineRow
          key={i}
          index={i}
          line={visibleLines[i]}
          time={props.time}
          ansi={props.ansi}
          needle={needle}
          current={i === currentIndex}
          onMeasure={viewport.measure}
        />
      )
    } else {
      rows.push(
        <PendingRow
          key='pending'
          index={i}
          item={pendingItem}
          text={props.pending}
          time={props.time}
          ansi={props.ansi}
          needle={needle}
          onMeasure={viewport.measure}
        />
      )
    }
  }

  return (
    <Box className='terminalOutput'>

      { /* 搜索条 */ }
      {searchOpen &&
        <Box className='searchBar'>
          <TextField
            size='small'
            variant='outlined'
            placeholder='搜索终端输出'
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setCurrent(0)
            }}
            onKeyDown={onSearchKeyDown}
            autoFocus
            className='searchField'
          />

          <span className='searchCount'>
            {needle
              ? (matches.length === 0 ? '无匹配' : `${safeCurrent + 1} / ${matches.length}`)
              : ''}
          </span>

          <IconButton size='small' onClick={() => gotoMatch(-1)} disabled={matches.length === 0} title='上一个（Shift+Enter）'>
            <KeyboardArrowUpIcon fontSize='small' />
          </IconButton>
          <IconButton size='small' onClick={() => gotoMatch(1)} disabled={matches.length === 0} title='下一个（Enter）'>
            <KeyboardArrowDownIcon fontSize='small' />
          </IconButton>
          <IconButton size='small' onClick={closeSearch} title='关闭（Esc）'>
            <CloseIcon fontSize='small' />
          </IconButton>
        </Box>
      }

      <Box className={[
        'contentWrap',
        autoScroll ? '' : 'paused',
        props.timer.running ? 'withTimer' : '',
      ].filter(Boolean).join(' ')}>

        { /* 工具栏 */ }
        <ButtonGroup variant='text' className='terminalButtons'>

          { /* 搜索 */ }
          <Tooltip title='搜索输出（Ctrl+F）'>
            <Button
              aria-label='搜索输出'
              onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
              className={searchOpen ? 'active' : ''}
            >
              <SearchIcon color='inherit' />
            </Button>
          </Tooltip>

          { /* HEX 视图 */ }
          <Tooltip title={props.hexView ? '切回文本视图' : '切换到 HEX 视图（按字节查看）'}>
            <Button
              aria-label='HEX 视图'
              onClick={props.toggleHexView}
              className={props.hexView ? 'active' : ''}
            >
              <CodeIcon color='inherit' />
            </Button>
          </Tooltip>

          { /* 定时发送与命令宏 */ }
          <Tooltip title='定时发送与命令宏'>
            <Button aria-label='定时发送与命令宏' onClick={props.openSendTools}>
              <ScheduleSendIcon color='inherit' />
            </Button>
          </Tooltip>

          { /* DTR / RTS */ }
          <Tip title='DTR / RTS 信号' disabled={!props.canSignal}>
            <Button
              aria-label='DTR RTS 信号'
              onClick={(e) => setSignalAnchor(e.currentTarget)}
              disabled={!props.canSignal}
            >
              <RestartAltIcon color='inherit' />
            </Button>
          </Tip>

          { /* 导出 */ }
          <Tip title='导出日志' disabled={props.lines.length === 0}>
            <Button aria-label='导出日志' onClick={openExport} disabled={props.lines.length === 0}>
              <FileDownloadIcon color='inherit' />
            </Button>
          </Tip>

          { /* 自动滚动 */ }
          <Tooltip title={autoScroll ? '暂停自动滚动' : '回到底部并继续滚动'}>
            <Button aria-label={autoScroll ? '暂停自动滚动' : '回到底部'} onClick={toggleAutoScroll}>
              {autoScroll ? <PauseIcon color='inherit' /> : <VerticalAlignBottomIcon color='inherit' />}
            </Button>
          </Tooltip>

          { /* 清空 */ }
          <Tip title='清空终端' disabled={props.lines.length === 0}>
            <Button aria-label='清空终端' onClick={() => setClearOpen(true)} disabled={props.lines.length === 0}>
              <HighlightOffIcon color='inherit' />
            </Button>
          </Tip>

          { /* 历史记录 */ }
          <Tooltip title='发送历史'>
            <Button aria-label='发送历史' onClick={() => setHistoryOpen(true)}>
              <HistoryIcon color='inherit' />
            </Button>
          </Tooltip>

          { /* 设置 */ }
          <Tooltip title='设置'>
            <Button aria-label='设置' onClick={props.openSettings}>
              <SettingsIcon color='inherit' />
            </Button>
          </Tooltip>
        </ButtonGroup>

        { /* 终端内容 */ }
        <Box className='codeContainer' ref={scrollRef} onScroll={handleScroll}>
          <code className={props.wrap ? 'codeBody' : 'codeBody nowrap'}>
            { /* 上方占位：撑出被窗口裁掉部分的高度 */ }
            {viewport.padTop > 0 && <div className='virtualPad' style={{ height: viewport.padTop }} />}

            {rows}

            { /* 下方占位 */ }
            {viewport.padBottom > 0 && <div className='virtualPad' style={{ height: viewport.padBottom }} />}
          </code>
        </Box>

        { /* 定时发送进行中的角标 */ }
        {props.timer.running &&
          <Box className='timerBadge'>
            <ScheduleSendIcon fontSize='small' />
            <span>定时 {props.timer.intervalMs}ms · 已发 {props.timer.count} 次</span>
            <Button size='small' onClick={props.stopTimer}>停止</Button>
          </Box>
        }

        { /* 暂停时浮出来的「回到底部」 */ }
        {!autoScroll &&
          <Button
            className='gotoBottom'
            size='small'
            variant='contained'
            disableElevation
            onClick={scrollToBottom}
            startIcon={<VerticalAlignBottomIcon />}
          >
            {newCount > 0 ? `回到底部 · 新增 ${newCount} 行` : '回到底部'}
          </Button>
        }

      </Box>

      { /* 信号菜单 */ }
      <Menu
        anchorEl={signalAnchor}
        open={Boolean(signalAnchor)}
        onClose={() => setSignalAnchor(null)}
      >
        {SIGNAL_ACTIONS.map(action =>
          <MenuItem
            key={action.id}
            onClick={() => {
              setSignalAnchor(null)
              props.runSignal(action.id)
            }}
            sx={{ maxWidth: 320 }}
          >
            <ListItemText primary={action.label} secondary={action.hint} />
          </MenuItem>
        )}
      </Menu>

      { /* 发送历史弹窗 */ }
      <Dialog
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
      >
        <DialogTitle>
          发送历史
        </DialogTitle>
        <List sx={{ minWidth: '18em' }}>
          {props.history.length === 0 &&
            <ListItem>
              <ListItemText primary='还没有发送过内容' sx={{ color: '#888' }} />
            </ListItem>
          }

          {props.history.map((value, i) => (
            <ListItem key={i} disablePadding>
              <ListItemButton onClick={() => {
                props.setInput(value)
                setHistoryOpen(false)
              }}>
                <ListItemIcon>
                  <TerminalIcon />
                </ListItemIcon>
                <ListItemText primary={value} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Dialog>

      { /* 导出弹窗 */ }
      <Dialog open={exportOpen} onClose={() => setExportOpen(false)}>
        <DialogTitle>导出日志</DialogTitle>

        <DialogContent>
          <DialogContentText>
            当前终端共 {props.lines.length} 行{props.hexView ? '（HEX 视图，导出的是 dump 文本）' : ''}，
            导出后可用任意文本编辑器打开。
          </DialogContentText>

          <FormControl variant='filled' fullWidth sx={{ mt: 2, minWidth: '20em' }}>
            <InputLabel>格式</InputLabel>
            <Select
              value={format}
              label='格式'
              onChange={(e) => setFormat(e.target.value as LogFormat)}
            >
              {EXPORT_FORMATS.map(item =>
                <MenuItem value={item.value} key={item.value}>{item.label}</MenuItem>
              )}
            </Select>
          </FormControl>

          <FormGroup sx={{ mt: 1 }}>
            <FormControlLabel control={
              <Checkbox
                checked={withTime}
                onChange={(e) => setWithTime(e.target.checked)}
              />
            } label='包含时间戳' />

            <FormControlLabel control={
              <Checkbox
                checked={withInput}
                onChange={(e) => setWithInput(e.target.checked)}
              />
            } label='包含我发送的内容' />
          </FormGroup>

          <DialogContentText sx={{ mt: 1, fontSize: '.8rem' }}>
            颜色控制符会自动去掉，导出的是纯文本。
          </DialogContentText>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setExportOpen(false)} color='secondary'>取消</Button>
          <Button onClick={doExport} color='primary'>导出</Button>
        </DialogActions>
      </Dialog>

      { /* 清空二次确认 */ }
      <Dialog open={clearOpen} onClose={() => setClearOpen(false)}>
        <DialogTitle>清空终端？</DialogTitle>

        <DialogContent>
          <DialogContentText>
            当前 {props.lines.length} 行输出将被清除，且无法恢复。
            如果这些日志还有用，建议先导出。
          </DialogContentText>
        </DialogContent>

        <DialogActions>
          <Button
            color='secondary'
            onClick={() => {
              setClearOpen(false)
              openExport()
            }}
          >
            先导出
          </Button>
          <Button onClick={() => setClearOpen(false)} color='secondary'>取消</Button>
          <Button onClick={doClear} color='error'>清空</Button>
        </DialogActions>
      </Dialog>

    </Box>
  )
}

export default TerminalOutput
