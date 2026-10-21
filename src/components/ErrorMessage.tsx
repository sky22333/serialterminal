import React from 'react'

import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import Typography from '@mui/material/Typography'
import ChromeIcon from '../icons/Chrome'

export interface ErrorMessageProps {
    open: boolean
    close: () => void
    message: string
}

const ErrorMessage = (props: ErrorMessageProps) => {
    return (
        <Dialog open={props.open} onClose={props.close}>
            <DialogTitle>连接失败</DialogTitle>

            <DialogContent>
                <DialogContentText sx={{ wordBreak: 'break-all' }}>
                    {props.message}
                </DialogContentText>

                <Typography sx={{ mt: 2 }}>
                    看起来出了点问题 😢<br />
                    请确认设备已插好、没有被其他程序占用，<br />
                    并建议使用最新版的&nbsp;
                    <a href='https://www.google.com/chrome/' target='_blank' rel='noopener noreferrer'>
                        <ChromeIcon fontSize='inherit' /> <b>Chrome</b>
                    </a> 或 Edge 桌面浏览器。
                </Typography>
            </DialogContent>

            <DialogActions>
                <Button onClick={props.close} color='primary'>关闭</Button>
            </DialogActions>
        </Dialog>
    )
}

export default React.memo(ErrorMessage)
