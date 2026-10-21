import React from 'react'

import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Tooltip from '@mui/material/Tooltip'
import AddBoxIcon from '@mui/icons-material/AddBox'
import LinkOffIcon from '@mui/icons-material/LinkOff'

import logo from '../assets/logo768.png'

export interface HeaderProps {
    connected: boolean
    disconnect: () => void
}

const Header = (props: HeaderProps) => {
    return (
        <AppBar
            position='static'
            sx={{
                background: '#2c387e',
            }}
        >
            <Toolbar>
                <img
                    src={logo}
                    alt='图标'
                    height='30px'
                />

                <Typography
                    variant='h6'
                    component='h1'
                    noWrap
                    sx={{
                        flexGrow: 1,
                        fontFamily: 'Bungee',
                    }}
                >
                    &nbsp;&nbsp;串口终端
                </Typography>

                {props.connected &&
                    <Tooltip title='断开当前串口'>
                        <Button
                            sx={{ color: '#fff' }}
                            onClick={props.disconnect}
                            startIcon={<LinkOffIcon />}>
                            断开
                        </Button>
                    </Tooltip>
                }

                <Tooltip title='在新标签页打开一个终端'>
                    <Button
                        sx={{ color: '#fff' }}
                        href='./'
                        target='_blank'
                        rel='noopener noreferrer'
                    >
                        <AddBoxIcon />
                    </Button>
                </Tooltip>
            </Toolbar>
        </AppBar>
    )
}

export default React.memo(Header)
