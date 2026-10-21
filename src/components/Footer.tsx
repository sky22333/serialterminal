import React from 'react'

import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

// 构建号由 CI 通过 VITE_VERSION 注入，本地开发时显示 dev
const version = `${import.meta.env.VITE_VERSION || 'dev'}`.slice(0, 7)

const Footer = () => {
    return (
        <Box sx={{ marginTop: 'auto', py: 1 }}>
            <Typography
                variant='caption'
                sx={{ display: 'block', textAlign: 'center', color: 'text.secondary' }}>
                {version}
            </Typography>
        </Box>
    )
}

export default React.memo(Footer)
