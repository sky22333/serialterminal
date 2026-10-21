# 网页串口终端

在浏览器里调试串口，免安装。基于 [SpacehuhnTech/serial](https://github.com/spacehuhntech/serial) 修改，功能实现参考 [NanashiTheNameless/SerialTerminal](https://github.com/NanashiTheNameless/SerialTerminal)。

## 功能

- **连接**：Web Serial 直连；波特率可调（50 ~ 4000000）；行尾符可选（无 / LF / CR / CRLF）；授权过的设备一键重连；DTR / RTS 脉冲与 ESP 下载模式
- **发送**：文本与 HEX（`48 65 6C 6C 6F`、`0x48,0x65`、连续串都认）；定时循环发送；命令宏快捷按钮；发送历史（弹窗回填或按 `↑` `↓`）；本地回显；Ctrl+C / Ctrl+D；大段内容自动分片限速，不会灌爆设备 RX 缓冲
- **显示**：HEX 视图（带偏移与 ASCII 列，与文本视图并存，切换不丢内容）；时间戳与自动折行；ANSI 16 / 256 / 真彩色；虚拟滚动，几万行不卡；`Ctrl+F` 搜索；上翻自动暂停滚动；日志导出 txt / csv / json / md；清空有二次确认
- **兜底**：兼容 `\r\n`、`\n`、单独 `\r`；渲染异常不白屏

## 快捷键

| 快捷键 | 作用 |
|---|---|
| `Ctrl` / `⌘` + `F` | 搜索输出 |
| `Ctrl` / `⌘` + `K` | 清空终端（弹确认） |
| `Ctrl` / `⌘` + `S` | 导出日志 |
| `Ctrl` / `⌘` + `L` | 回到输入框 |
| `Ctrl` / `⌘` + `C` | 发送 SIGINT（有选中文字时是复制） |
| `Ctrl` / `⌘` + `D` | 发送 EOF |
| `↑` / `↓` | 翻发送历史 |
| `Enter` / `Shift` + `Enter` | 搜索时跳到下一个 / 上一个命中 |
| `Esc` | 关闭搜索 |

## 浏览器要求

需要支持 **Web Serial API** 的桌面浏览器：Chrome / Edge 89+、Opera 75+ 及其他 Chromium 内核浏览器。Safari、Firefox 和移动端暂不支持。

## 开发

需要 Node >= 22.12。

```bash
npm install
npm run dev        # http://localhost:5173
```

| 命令 | 作用 |
|---|---|
| `npm run build` | 生产构建到 `dist/`（相对路径，可放子目录） |
| `npm test` | Vitest 单元测试 |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run check` | 以上四项依次跑完 |

技术栈：Vite 7 + React 19 + MUI 9 + TypeScript 5；Vitest + Testing Library + jsdom；ESLint 9 flat config。

## 目录结构

```
src/
  types.ts            跨模块共享的数据类型
  App.tsx             串口会话状态、接收管线、定时发送
  components/         终端输出、输入、发送工具、设置等
  hooks/              useVirtualWindow、useShortcuts
  modules/            Serial、lineBuffer、hex、hexBuffer、macros、
                      signals、settings、storage、ansiParser、exportLog
  assets/             字体与图标（由 Vite 打包，带内容哈希）
```

## 许可证

MIT，详见 [LICENSE](LICENSE)。原始版本版权归 [Spacehuhn](https://spacehuhn.com) 所有。
