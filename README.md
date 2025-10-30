# Electron Git GUI

一个基于 Electron 的 Git 图形界面工具，提供直观的用户界面来管理 Git 仓库。支持本地仓库操作和远程 GitHub 仓库操作。

## 功能特性

- **仓库管理**：打开现有仓库或初始化新仓库
- **文件状态跟踪**：查看文件更改状态（已修改、已暂存等）
- **Git 操作**：提交、推送、拉取、查看历史记录
- **分支管理**：查看和切换分支
- **GitHub 集成**：设置远程仓库、克隆仓库、GitHub 操作
- **用户友好界面**：现代化 UI，直观的操作流程

## 技术栈

- **Electron**：桌面应用框架
- **React 18**：用户界面
- **simple-git**：Git 命令执行
- **Webpack**：模块打包

## 安装和运行

1. 确保系统已安装 Node.js 和 Git

2. 克隆项目
```bash
git clone <repository-url>
cd electron-git-gui
```

3. 安装依赖
```bash
npm install
```

4. 构建渲染器应用
```bash
npm run build-renderer
```

5. 启动应用
```bash
npm start
```

## 开发

在开发模式下运行：
```bash
npm run dev
```

构建渲染器应用（监听模式）：
```bash
npm run dev-renderer
```

## 使用说明

### 启动应用
- 应用启动后显示欢迎界面
- 可选择打开现有 Git 仓库或初始化新仓库

### 基本操作
1. **打开仓库**：通过菜单栏"文件" -> "打开仓库"选择本地 Git 仓库
2. **查看更改**：在"文件变更"标签页查看文件状态
3. **提交更改**：在提交面板输入提交信息并点击"提交"
4. **推送/拉取**：使用顶部工具栏的"推送"和"拉取"按钮

### GitHub 集成
1. **设置远程仓库**：在"GitHub 操作"标签页输入远程仓库 URL
2. **克隆仓库**：使用克隆功能克隆远程仓库到本地
3. **推送/拉取**：使用相应按钮与远程仓库同步

## 项目结构

```
electron-git-gui/
├── main/                 # Electron 主进程
│   ├── main.js          # 主进程逻辑
│   └── preload.js       # 预加载脚本
├── renderer/             # React 渲染器进程
│   ├── public/          # 静态资源
│   ├── src/             # React 源码
│   │   ├── components/  # React 组件
│   │   └── utils/       # 工具函数
│   └── utils/           # 渲染器工具函数
├── assets/              # 应用资源
└── webpack.renderer.config.js  # Webpack 配置
```

## 构建发布

构建可分发的应用程序：
```bash
npm run dist
```

## 贡献

欢迎提交 Issue 和 Pull Request 来改进项目。

## 自定义图标

要为应用程序设置自定义图标，请按以下步骤操作：

1. 将适当的图标文件放入 `assets/` 目录：
   - Windows: `icon.ico` (尺寸至少 256x256 像素)
   - macOS: `icon.icns` 
   - Linux: `icon.png` (尺寸至少 512x512 像素)

2. 重新构建应用程序：
```bash
npm run dist
```

## 许可证

MIT