
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'

import TuneIcon from '@mui/icons-material/Tune'

import type { Macro } from '../types'

export interface MacroBarProps {
  macros: Macro[]
  send: (macro: Macro) => void
  manage: () => void
}

/** 终端下方的宏快捷条：只在有宏时出现，点一下直接发送 */
const MacroBar = (props: MacroBarProps) => {
  return (
    <Box className='macroBar'>
      <Box className='macroList'>
        {props.macros.map(macro =>
          <Tooltip
            key={macro.id}
            title={`${macro.hex ? 'HEX' : '文本'}：${macro.payload.slice(0, 120)}`}
            placement='top'
          >
            <Chip
              size='small'
              label={macro.name}
              className='macroChip'
              onClick={() => props.send(macro)}
            />
          </Tooltip>
        )}
      </Box>

      <Button
        size='small'
        className='macroManage'
        startIcon={<TuneIcon fontSize='small' />}
        onClick={props.manage}
      >
        管理
      </Button>
    </Box>
  )
}

export default MacroBar
