<h1 align="center">
  <img src="public/logo.png" alt="difit" width="260">
</h1>

<p align="center">
  <a href="./README.md">English</a> | <a href="./README.ja.md">日本語</a> | 简体中文 | <a href="./README.ko.md">한국어</a>
</p>

**difit** 是一个让你使用 GitHub 风格查看器查看和审查本地 git 差异的 CLI 工具。除了清晰的视觉效果外，评论还可以作为 AI 提示进行复制。AI 时代的本地代码审查工具！

## ✨ 功能

- ⚡ **零配置**：只需运行 `npx difit` 即可使用
- 💬 **本地审查**：为差异添加评论，并将其与文件路径和行号一起复制给 AI
- 🖥️ **WebUI/终端UI**：在浏览器中使用 Web UI，或使用 `--tui` 保持在终端中

## ⚡ 快速开始

```bash
npx difit    # 在 WebUI 中查看最新提交的差异
```

## 🚀 使用方法

### 基本用法

```bash
npx difit <target>                    # 查看单个提交差异
npx difit <target> [compare-with]     # 比较两个提交/分支
npx difit --pr <github-pr-url>        # 审查 GitHub 拉取请求
```

### 单个提交审查

```bash
npx difit          # HEAD（最新）提交
npx difit 6f4a9b7  # 特定提交
npx difit feature  # feature 分支上的最新提交
```

### 比较两个提交

```bash
npx difit HEAD main      # 比较 HEAD 与 main 分支
npx difit feature main   # 比较分支
npx difit . origin/main  # 比较工作目录与远程 main
```

### 特殊参数

difit 支持常见差异场景的特殊关键字：

```bash
npx difit .        # 所有未提交的更改（暂存区 + 未暂存）
npx difit staged   # 暂存区更改
npx difit working  # 仅未暂存的更改
```

### GitHub PR

```bash
npx difit --pr https://github.com/owner/repo/pull/123
```

difit 使用以下方式自动处理 GitHub 认证：

1. **GitHub CLI**（推荐）：如果您已使用 `gh auth login` 登录，difit 将使用您现有的凭据
2. **环境变量**：设置 `GITHUB_TOKEN` 环境变量
3. **无认证**：公共仓库无需认证即可工作（有速率限制）

#### GitHub Enterprise Server

对于 Enterprise Server PR，您必须设置在您的 Enterprise Server 实例上生成的令牌：

1. 转到 `https://YOUR-ENTERPRISE-SERVER/settings/tokens`
2. 生成具有适当范围的个人访问令牌
3. 将其设置为 `GITHUB_TOKEN` 环境变量

## ⚙️ CLI 选项

| 标志             | 默认值       | 描述                                                                   |
| ---------------- | ------------ | ---------------------------------------------------------------------- |
| `<target>`       | HEAD         | 提交哈希、标签、HEAD~n、分支或特殊参数                                 |
| `[compare-with]` | -            | 要比较的可选第二个提交（显示两者之间的差异）                           |
| `--pr <url>`     | -            | 要审查的 GitHub PR URL（例如：https://github.com/owner/repo/pull/123） |
| `--port`         | 3000         | 首选端口；如果被占用则回退到 +1                                        |
| `--host`         | 127.0.0.1    | 绑定服务器的主机地址（使用 0.0.0.0 进行外部访问）                      |
| `--no-open`      | false        | 不自动打开浏览器                                                       |
| `--mode`         | side-by-side | 显示模式：`inline` 或 `side-by-side`                                   |
| `--tui`          | false        | 使用终端 UI 模式而不是 WebUI                                           |
| `--clean`        | false        | 启动时清除所有现有评论                                                 |

## 💬 评论系统

difit 包含一个审查评论系统，便于向 AI 编码代理提供反馈：

1. **添加评论**：单击任何差异行上的评论按钮或拖动选择范围
2. **编辑评论**：使用编辑按钮编辑现有评论
3. **生成提示**：评论包含"复制提示"按钮，可为 AI 编码代理格式化上下文
4. **复制全部**：使用"复制所有提示"以结构化格式复制所有评论
5. **持久存储**：评论按每个提交保存在浏览器 localStorage 中

### 评论提示格式

```sh
src/components/Button.tsx:L42   # 此行自动添加
使此变量名更具描述性
```

对于范围选择：

```sh
src/components/Button.tsx:L42-L48   # 此行自动添加
此部分是不必要的
```

## 🎨 语法高亮语言

- **JavaScript/TypeScript**：`.js`、`.jsx`、`.ts`、`.tsx`
- **Web 技术**：HTML、CSS、JSON、XML、Markdown
- **Shell 脚本**：`.sh`、`.bash`、`.zsh`、`.fish`
- **后端语言**：PHP、SQL、Ruby、Java、Scala
- **系统语言**：C、C++、C#、Rust、Go
- **移动语言**：Swift、Kotlin、Dart
- **其他**：Python、YAML、Solidity、Vim 脚本

## 🛠️ 开发

```bash
# 安装依赖
pnpm install

# 启动开发服务器（带热重载）
# 这会同时运行 Vite 开发服务器和 CLI，NODE_ENV=development
pnpm run dev

# 构建并启动生产服务器
pnpm run start <target>

# 构建生产版本
pnpm run build

# 运行测试
pnpm test

# 代码检查和格式化
pnpm run lint
pnpm run format
pnpm run typecheck
```

### 开发工作流程

- **`pnpm run dev`**：同时启动 Vite 开发服务器（带热重载）和 CLI 服务器
- **`pnpm run start <target>`**：构建所有内容并启动生产服务器（用于测试最终构建）
- **开发模式**：使用 Vite 的开发服务器进行热重载和快速开发
- **生产模式**：提供构建的静态文件（供 npx 和生产构建使用）

## 🏗️ 架构

- **CLI**：使用 Commander.js 进行参数解析，具有全面的验证
- **后端**：Express 服务器配合 simple-git 进行差异处理
- **GitHub 集成**：Octokit 用于 GitHub API，具有自动认证（GitHub CLI + 环境变量）
- **前端**：React 18 + TypeScript + Vite
- **样式**：Tailwind CSS v4，带有类似 GitHub 的深色主题
- **语法高亮**：Prism.js 带动态语言加载
- **测试**：Vitest 用于单元测试，测试文件与源代码放在一起
- **质量**：ESLint、Prettier、lefthook 预提交钩子

## 📋 要求

- Node.js ≥ 21.0.0
- 包含要审查的提交的 Git 仓库

## 📄 许可证

MIT
