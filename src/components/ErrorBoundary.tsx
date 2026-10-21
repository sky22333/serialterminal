import React from 'react'

import Box from '@mui/material/Box'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'

interface ErrorBoundaryProps {
    children: React.ReactNode
}

interface ErrorBoundaryState {
    error: Error | null
}

/**
 * 捕获渲染期异常，避免整页白屏——白屏后用户连「断开连接」都点不到。
 */
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props)
        this.state = { error: null }
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { error: error }
    }

    override componentDidCatch(error: Error, info: React.ErrorInfo): void {
        console.error('[UI] 渲染异常：', error, info)
    }

    override render(): React.ReactNode {
        if (this.state.error) {
            return (
                <Box sx={{
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    p: 2,
                }}>
                    <Alert severity='error' sx={{ maxWidth: 560 }}>
                        <AlertTitle>界面出现异常</AlertTitle>
                        <Typography sx={{ mb: 2 }}>
                            页面遇到了未预期的问题，串口连接可能已经失效。<br />
                            建议重新加载页面后再次连接。
                        </Typography>
                        <Typography variant='caption' component='div' sx={{ mb: 2, wordBreak: 'break-all', color: '#888' }}>
                            {`${this.state.error}`}
                        </Typography>
                        <Button
                            variant='contained'
                            color='error'
                            disableElevation
                            onClick={() => window.location.reload()}
                        >
                            重新加载
                        </Button>
                    </Alert>
                </Box>
            )
        }

        return this.props.children
    }
}

export default ErrorBoundary
