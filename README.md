<div align="center">

<img src="./assets/brand/icon-512.png" alt="流畅阅读 Lite" width="96" />

# 流畅阅读 Lite（FluentRead Lite）

**轻量、专注的自用双语翻译浏览器扩展**

基于 [FluentRead](https://github.com/FluentRead/FluentRead) 深度瘦身定制，专为 Chrome & Edge（MV3）打造，聚焦**全文双语翻译、悬浮球与视频双语字幕**。

[核心功能](#核心功能) · [翻译服务](#保留的翻译服务) · [精简清单](#相对原版的精简内容) · [下载与安装](#下载与安装) · [开发说明](#开发与目录结构) · [GPL-3.0 协议](./LICENSE)

</div>

---

## 核心功能

| 模块 | 说明 |
| --- | --- |
| **全文双语翻译** | 支持双语对照 / 仅译文切换、按阅读进度或整页翻译、右键菜单与快捷键触发、AI 上下文与多段合批；内置本地缓存（24 小时过期 + 10 MB / 10,000 条 LRU 自动清理）。 |
| **悬浮球** | 贴边半透明收起、悬停展开快捷翻译与设置入口，支持位置、垂直高度、边距、不透明度、快捷键及按域名禁用。 |
| **视频双语字幕** | 支持 YouTube、X、Bilibili、Udemy、edX、Coursera、HTML5 原生视频及网页会议字幕；支持双语 / 仅译文 / 仅原文显示、时间轴微调、外观自定义与字幕导出（默认按需手动开启，不自动触发）。 |
| **网站规则** | 支持按域名设置自动翻译、仅译文显示、禁用扩展与隐藏悬浮球，保留内置及自定义站点 DOM 适配规则。 |
| **界面与译文外观** | 保留 4 套精选译文样式（加粗显示、优雅斜体、模糊遮罩、学习标记）、5 套逐句高亮、11 套界面皮肤、12 套加载动效（含无动效）及完整界面字体选择。 |

## 保留的翻译服务

仅保留以下 5 类内置服务，并支持新增多个自定义 OpenAI 兼容接口：

| 类别 | 服务 | 说明 |
| --- | --- | --- |
| 机器翻译 | **微软翻译**（默认） | 免配置开箱即用，支持原生批量翻译 |
| 机器翻译 | **谷歌翻译** | 免配置开箱即用，支持原生批量翻译 |
| AI 翻译 | **DeepSeek** | 支持模型选择、Thinking 开关、API 格式切换、多 Key 轮换与连接测试 |
| AI 翻译 | **OpenRouter** | 支持多模型切换、自定义模型、提示词模板与多 Key 轮换 |
| AI 翻译 | **自定义接口** | 兼容 OpenAI 协议，可自由添加多个独立端点、自定义请求头与请求体 |

## 相对原版的精简内容

为了降低长期自维护成本、减少权限面与安装包体积，本分支相对上游 FluentRead 做了两轮深度瘦身：

- **体积缩减约 78%**：解压产物从 **52.7 MB** 降至 **约 11.6 MB**（Chrome `11.58 MB` / Edge `11.56 MB`）。
- **权限更精简**：移除 `offscreen` 权限与 `wasm-unsafe-eval` CSP 策略，仅面向 Chrome / Edge MV3，不再维护 Firefox、Safari 与油猴脚本产物。
- **移除低频业务模块**：移除划词翻译、鼠标悬浮翻译、输入框翻译、文档（PDF / ePub / DOCX）翻译、图片 / 漫画翻译、圈选翻译、词书 / 单词本、AI 阅读卡片与写作助手、翻译中心、本地离线模型与本地语音转写。
- **移除多余翻译引擎与重型依赖**：删除其余 30+ 翻译服务（含免费聚合池、本地 WASM/ONNX 模型、Chrome 内置翻译、ChatGPT 订阅登录、组合翻译与各类云厂商），卸载 `onnxruntime-web`、`@wllama/wllama`、`@huggingface/transformers`、`@deeplx/core`、`@ai-sdk/anthropic`、`@ai-sdk/google`、`crypto-js`、`mathml-to-latex` 等依赖。
- **精简界面与设置项**：
  - 锁定**简体中文**（仅保留 `_locales/zh_CN`），移除七国语言切换与首次弹窗引导。
  - 删除弹窗底部栏（翻译计数与清除缓存按钮）、菜单栏布局自定义及重复的“按功能分配服务”卡片。
  - 译文样式由 71 套收敛至 4 套；逐句高亮移除细线聚焦、暖光琥珀、点线引导；皮肤移除高对比、乌金、玄青；加载动效移除扫描线、打字光标、涟漪扩散。
  - 关闭并移除视频字幕中的“打开视频就翻译”和“会议平台自动开启双语字幕”选项。
  - 移除设置历史、后台定时自动快照、备份与恢复及云端同步。

## 下载与安装

### 直接下载（推荐）

前往 [GitHub Releases](https://github.com/Nekooo915/FluentRead/releases) 下载对应浏览器的压缩包并解压：

- Chrome：`fluentread-lite-chrome.zip`
- Edge：`fluentread-lite-edge.zip`

解压后在浏览器扩展管理页（`chrome://extensions/` 或 `edge://extensions/`）开启**开发者模式**，点击**加载已解压的扩展程序**选择解压后的文件夹即可。

### 本地自行构建

- Node.js `>= 22.23.4`（仓库根目录已通过 `.nvmrc` 指定）
- pnpm `12`（建议通过 `corepack enable` 使用 `package.json` 锁定的版本）

```sh
git clone https://github.com/Nekooo915/FluentRead.git
cd FluentRead
corepack enable
pnpm install

# 构建 Chrome MV3 解压扩展（输出至 .output/chrome-mv3）
pnpm build

# 构建 Edge MV3 解压扩展（输出至 .output/edge-mv3）
pnpm build:edge
```

构建完成后，同样在 `chrome://extensions/` 或 `edge://extensions/` 开启**开发者模式**并加载 `.output/chrome-mv3` 或 `.output/edge-mv3`。后续修改代码重新构建后，在扩展管理页点击刷新图标即可生效。

## 开发与目录结构

### 常用命令

| 命令 | 用途 |
| --- | --- |
| `pnpm dev` / `pnpm dev:edge` | 启动 Chrome / Edge 本地热更新开发模式 |
| `pnpm build` / `pnpm build:edge` | 构建 Chrome / Edge 生产解压包 |
| `pnpm zip` / `pnpm zip:edge` | 打包 Chrome / Edge ZIP 归档 |
| `pnpm test:audit` | 检查测试矩阵完整性与用例规范 |
| `pnpm test:architecture` | 运行模块边界、provider 边界、CSP 与源码头注释校验 |

### 目录边界

项目沿用 WXT 0.21 + Vue 3 + TypeScript + Element Plus 技术栈与单向分层架构：

- `entrypoints/`：WXT 文件式入口（`background`、`content`、`popup`、`options` 及各视频/框架桥接脚本）
- `src/app/`：各运行上下文的静态组装入口
- `src/features/`：全文翻译、悬浮球、视频双语字幕、设置面板等业务模块
- `src/core/`：无浏览器副作用的配置模型、语言识别、译文外观、网站规则与协议算法
- `src/services/`：翻译编排、缓存、配置持久化与消息路由
- `src/providers/` & `src/platform/`：5 类翻译供应商适配与浏览器/存储/HTTP 边界
- `src/ui/` & `src/shared/`：公共组件、样式令牌与基础工具

## 致谢与协议

- 本项目基于开源项目 [FluentRead](https://github.com/FluentRead/FluentRead) 二次定制精简，感谢原作者及所有社区贡献者的出色工作。
- 本项目继续遵循原项目的 [GNU General Public License v3.0](./LICENSE) 协议开源。
