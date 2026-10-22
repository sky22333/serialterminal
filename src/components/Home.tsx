import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import SettingsIcon from '@mui/icons-material/Settings'

import ChromeIcon from '../icons/Chrome'
import EdgeIcon from '../icons/Edge'
import OperaIcon from '../icons/Opera'

export interface HomeProps {
    connect: () => void
    reconnect: () => void
    /** 空串表示没有可一键重连的设备 */
    recentLabel: string
    supported: () => boolean
    openSettings: () => void
}

/** 主操作区的宽度：按钮、提示卡片共用同一条左右边界 */
const COLUMN_WIDTH = 360

const Home = (props: HomeProps) => {
    return (
        <Box sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: { xs: 2, sm: 3 },
        }}>
            {props.supported() ?
                <Stack spacing={2} sx={{ width: '100%', maxWidth: COLUMN_WIDTH }}>
                    <Button
                        variant='contained'
                        color='success'
                        size='large'
                        fullWidth
                        onClick={() => props.connect()}
                    >
                        连接设备
                    </Button>

                    { /* 已授权过的设备：跳过系统选择器，一键回到上次那台 */ }
                    {props.recentLabel &&
                        <Box>
                            <Button
                                variant='outlined'
                                size='large'
                                fullWidth
                                onClick={() => props.reconnect()}
                            >
                                继续使用 {props.recentLabel}
                            </Button>
                            <Typography
                                variant='caption'
                                sx={{
                                    display: 'block',
                                    mt: 0.75,
                                    textAlign: 'center',
                                    color: 'text.secondary',
                                }}
                            >
                                这台设备之前授权过，不用再选一次
                            </Typography>
                        </Box>
                    }

                    <Alert severity='info'>
                        <Box
                            component='ol'
                            sx={{ m: 0, pl: 2.5, '& li + li': { mt: 0.5 } }}
                        >
                            <li>点击「连接设备」</li>
                            <li>插入设备并选择串口</li>
                            <li>开始收发数据</li>
                        </Box>
                    </Alert>

                    <Button
                        size='large'
                        fullWidth
                        startIcon={<SettingsIcon />}
                        onClick={() => props.openSettings()}
                        sx={{ color: 'text.secondary' }}
                    >
                        设置
                    </Button>
                </Stack>

                :

                <Alert
                    severity='warning'
                    sx={{
                        width: '100%',
                        maxWidth: 640,
                        alignItems: 'flex-start',
                        '& a': {
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3em',
                            textDecoration: 'none',
                            '&:hover': { textDecoration: 'underline' },
                        },
                    }}
                >
                    <AlertTitle>你的浏览器不支持 Web Serial</AlertTitle>

                    <Typography variant='body2' sx={{ mb: 1 }}>
                        请使用桌面版&nbsp;
                        <a href='https://www.google.com/chrome/' target='_blank' rel='noopener noreferrer'>
                            <ChromeIcon sx={{ fontSize: '1.1em' }} /><b>Chrome</b>
                        </a>
                        &nbsp;、&nbsp;
                        <a href='https://www.microsoft.com/zh-cn/edge' target='_blank' rel='noopener noreferrer'>
                            <EdgeIcon sx={{ fontSize: '1.1em' }} /><b>Edge</b>
                        </a>
                        &nbsp;或&nbsp;
                        <a href='https://www.opera.com/zh-cn' target='_blank' rel='noopener noreferrer'>
                            <OperaIcon sx={{ fontSize: '1.1em' }} /><b>Opera</b>
                        </a>
                        &nbsp;（iOS 与 Android 浏览器暂不支持）
                    </Typography>

                    <Typography variant='body2'>
                        了解更多&nbsp;
                        <a href='https://developer.mozilla.org/zh-CN/docs/Web/API/Serial#%E6%B5%8F%E8%A7%88%E5%99%A8%E5%85%BC%E5%AE%B9%E6%80%A7' target='_blank' rel='noopener noreferrer'>
                            浏览器兼容性
                        </a>
                    </Typography>
                </Alert>
            }
        </Box>
    )
}

export default Home
