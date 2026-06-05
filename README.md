# 解语花 · AI 划词解释

> 在网页上划选文字,光标旁会绽放一朵山茶花;轻点即可让 AI 就地解释,并能继续追问。

解语花是一个轻量的 Chrome 扩展(Manifest V3)。它会在你选中文字后显示一个山茶花按钮,点击后在当前页面弹出解释气泡,并以流式输出展示回答。你也可以打开侧边栏进行手动提问和模型设置。

## 功能

- 划词后在光标旁显示山茶花按钮
- 在当前页面就地展示解释气泡,无需切换窗口
- 支持在气泡中继续追问,保留当前上下文
- 侧边栏支持手动对话、服务商选择、模型名和系统提示词设置
- 支持 OpenAI、DeepSeek、Moonshot/Kimi、智谱 GLM、豆包、通义千问、OpenRouter、Anthropic Claude,以及自定义 OpenAI 兼容接口
- 无远程后台服务、无统计脚本、无构建步骤

## 安装

### 从源码安装

1. 下载本仓库,或执行 `git clone`。
2. Chrome 打开 `chrome://extensions/`。
3. 开启右上角的「开发者模式」。
4. 点击「加载已解压的扩展程序」。
5. 选择包含 `manifest.json` 的项目文件夹。
6. 点浏览器工具栏中的扩展图标,打开侧边栏设置服务商、模型和 API Key。

### 使用

1. 在任意网页选中文字。
2. 点击光标旁出现的山茶花按钮。
3. 在弹出的解释气泡中查看回答,也可以继续追问。

你也可以选中文字后使用右键菜单「用解语花解释」。

## 服务商预设

| 服务商 | 接口地址 | 默认模型 |
| --- | --- | --- |
| OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini` |
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` |
| Moonshot/Kimi | `https://api.moonshot.cn/v1` | `moonshot-v1-8k` |
| 智谱 GLM | `https://open.bigmodel.cn/api/paas/v4` | `glm-4-plus` |
| 豆包(火山方舟) | `https://ark.cn-beijing.volces.com/api/v3` | `doubao-seed-1-6-251015` |
| 通义千问(百炼) | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-plus` |
| OpenRouter | `https://openrouter.ai/api/v1` | `openai/gpt-4o-mini` |
| Anthropic | `https://api.anthropic.com/v1` | `claude-3-5-sonnet-20241022` |

豆包的模型名可能需要按火山方舟控制台里的接入点或模型填写,也可以使用 `ep-` 开头的接入点 ID。

## 权限说明

本扩展使用以下 Chrome 权限:

- `contextMenus`: 添加划词右键菜单。
- `storage`: 在本地浏览器保存服务商、模型、接口地址、系统提示词和 API Key。
- `sidePanel`: 提供侧边栏设置和手动问答界面。
- `host_permissions`: 允许向已配置的 AI 服务商接口发起请求。

`manifest.json` 中包含 `https://*/*`,用于支持自定义 OpenAI 兼容接口。如果你不需要自定义接口,可以删除这一项,只保留你实际使用的服务商域名。

## 隐私与安全

代码中不包含任何 API Key。API Key 由用户在运行时填写,保存在 Chrome 本地存储中。

当你使用划词解释或继续追问时,选中的文本、提问内容和对话上下文会发送给你在设置中选择的 AI 服务商接口。项目没有自建服务器,也没有统计或追踪脚本。更多说明见 [PRIVACY.md](./PRIVACY.md)。

请不要把真实 API Key、私有配置、测试日志或打包后的压缩文件提交到仓库。

## 常见问题

### 气泡一直转圈怎么办?

多发生在更新扩展后,网页里仍然运行旧版本内容脚本。请在 `chrome://extensions/` 点击本扩展的「刷新」,再刷新正在使用的网页。

### 为什么有些站点刚更新后不能弹出?

请先刷新当前网页。本扩展使用内容脚本注入,网页需要重新加载后才会运行最新版本。

### 这个项目需要构建吗?

不需要。所有文件都是原生 HTML、CSS 和 JavaScript,加载包含 `manifest.json` 的目录即可。

## 开源发布建议

发布到 GitHub 前建议确认:

- `LICENSE` 中的版权署名已经改成你的名字、组织名或项目贡献者名称。
- README 中的功能、模型名、权限说明与当前代码一致。
- 仓库里没有真实 API Key、私密截图、`.DS_Store`、日志文件或压缩包。
- 如果要发布到 Chrome Web Store,再单独补充商店截图、隐私政策链接和更严格的权限说明。

## 许可证

本项目基于 [MIT License](./LICENSE) 开源。
