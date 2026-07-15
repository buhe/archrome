# Archrome

<p align="center">
  <img src="public/icons/icon128.png" width="128" alt="Archrome Logo">
</p>

灵感来自 Arc 浏览器的空间管理工具，基于书签实现。

## 功能

### 空间（Spaces）

* **空间组织：** 通过书签文件夹区分工作、个人等场景。
* **自定义图标：** 文件夹名称开头的 emoji 即为空间图标。
* **无缝切换：** 切换时保存并关闭当前标签页，自动打开目标空间标签页。
* **删除空间：** 右键空间 → 删除（需确认）。

### 标签页与书签

* **活动标签页：** 在侧边栏查看、关闭与管理当前打开的标签页。
* **移动标签页：** 右键标签页可移到其他空间。
* **拖放保存：** 将标签页拖到书签区域即可保存。
* **固定书签：** 固定常用链接以便快速访问。

### 主题

* **深色 / 浅色：** 侧边栏底部切换；偏好会保存，默认跟随系统。

### 快捷键

* **切换侧边栏：** `Alt+Q`（Windows/Linux）或 `Option+Q`（Mac）
* **打开日志查看器：** `Ctrl+Shift+L` / `Cmd+Shift+L`

## 架构

完整 TypeScript 重写，模块化架构：

```
archrome/
├── src/
│   ├── types/           # TypeScript 类型定义
│   ├── managers/        # 业务逻辑模块
│   │   ├── StorageManager.ts
│   │   ├── BookmarkManager.ts
│   │   ├── TabManager.ts
│   │   └── SpaceManager.ts
│   ├── ui/              # UI 组件
│   │   ├── components/
│   │   └── UIManager.ts
│   ├── utils/           # 工具函数
│   ├── background.ts    # Service Worker
│   ├── sidebar.ts       # 主入口
│   └── styles/          # CSS 样式
├── public/              # 静态资源
├── tests/               # 测试
└── dist/                # 构建输出
```

### 主要改进

1. **类型安全：** 全量 TypeScript，更好的 IDE 支持。
2. **模块化架构：** 职责分离，独立 Manager 类。
3. **状态管理：** 事件驱动、类型安全的状态管理。
4. **错误处理：** 完善的错误处理与重试机制。
5. **性能：** 标签页批量操作优化。
6. **开发体验：** Vite 构建、Vitest 测试、ESLint/Prettier 代码质量。

## 开发

### 环境要求

- Node.js 18+ 与 npm/yarn/pnpm

### 安装

```bash
# 安装依赖
npm install

# 或使用 yarn
yarn install

# 或使用 pnpm
pnpm install
```

### 构建

```bash
# 开发构建（watch 模式）
npm run dev

# 生产构建
npm run build

# 预览构建结果
npm run preview
```

### 测试

```bash
# 运行测试
npm test

# 带 UI 的测试
npm run test:ui

# 覆盖率
npm run test:coverage
```

### 代码检查与格式化

```bash
# Lint
npm run lint

# Lint 并自动修复
npm run lint:fix

# 格式化
npm run format

# 检查格式
npm run format:check

# 类型检查
npm run typecheck
```

### 加载扩展

1. 构建扩展：`npm run build`
2. 打开 Chrome，访问 `chrome://extensions/`
3. 开启「开发者模式」
4. 点击「加载已解压的扩展程序」
5. 选择 `dist` 目录

## 项目结构

### 类型定义（`src/types/`）

定义应用中使用的 TypeScript 接口与枚举。

### Managers（`src/managers/`）

- **StorageManager：** Chrome storage 操作（含防抖）。
- **BookmarkManager：** Chrome 书签 API。
- **TabManager：** Chrome 标签页 API（批量处理）。
- **SpaceManager：** 串联各模块的空间管理核心。

### UI 组件（`src/ui/`）

- **ListItemComponent：** 列表项基类（书签、标签页）。
- **ListComponent：** 列表基类（支持拖放）。
- **ContextMenu：** 标签页与书签的自定义右键菜单。
- **LogViewer：** 日志与指标查看弹窗。
- **UIManager：** 管理全部 UI 组件的主控制器。

### 工具（`src/utils/`）

- **Logger：** 可配置级别的持久化日志。
- **Debounce：** 防抖与节流。
- **Helpers：** 通用辅助函数（emoji 检测、URL 校验等）。

## 数据存储

Archrome 使用 Chrome 本地存储：

- `space_{spaceId}_tabs`：各空间的标签页数据
- `last_active_space_id`：上次活动空间
- `archrome_logs`：应用日志
- `archrome_switch_metrics`：空间切换性能指标
- `last_heartbeat`：Service Worker 心跳时间戳

## 兼容性

本重写版本与原有 Archrome 数据结构向后兼容，用户数据可无缝迁移。

## 许可证

MIT License — 详见 LICENSE 文件。

## 贡献

欢迎贡献！请直接提交 Pull Request。
