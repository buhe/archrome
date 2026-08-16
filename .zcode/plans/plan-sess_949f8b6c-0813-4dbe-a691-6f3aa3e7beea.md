# 修复「创建新 space 导致 Chrome crash」

## 根因回顾

`switchSpace` 采用「先关旧、后开新」顺序（`SpaceManager.ts:214-230`），而新 space 的占位标签 `createTab('about:blank')` 被 `isValidUrl`（拒绝 `about:` 前缀，`helpers.ts:113`）拦截**必然返回 null**。于是：点确定 → 批量关闭当前全部已追踪标签 → 无任何新标签补位 → 窗口最后一个标签被 `chrome.tabs.remove` 关闭 → **Chrome 关闭窗口**（等价于 Ctrl+W 到最后一个标签）→ side panel 随窗口销毁 → 单窗口场景整个浏览器消失，感知为 crash。触发概率取决于窗口里是否存在未追踪标签（chrome:// 页、pinned、prompt 阻塞期间新开的标签等）。

## 修复 1（核心）：switchSpace 改为先开后关 + 占位标签放行 + 兜底

**`src/managers/TabManager.ts` — `createTab`**
- 签名改为 `createTab(url: string, active = true, options?: { allowInternal?: boolean })`
- `options.allowInternal` 为 true 时跳过 `isValidUrl` 校验（`ensureChromeApiReady`、try/catch 不变）
- `restoreTabSafely` 恢复路径不变，继续拦截 `about:blank`

**`src/managers/SpaceManager.ts` — `switchSpace`**
新顺序：
1. **先**恢复新 space 标签（`restoreNewSpaceTabs`，恢复的标签均为 inactive）
2. 恢复数为 0 时创建占位标签：`createTab('about:blank', false, { allowInternal: true })`
3. 仍为 0 → `throw`（catch 分支已有的 currentSpaceId 回滚逻辑兜住），**旧标签一个都不关**
4. 然后 `closeOldSpaceTabs(oldSpace)`
5. 激活 `restoredTabs[0]`
6. openTabs 覆盖、storeTabsImmediate、事件发射、setLastActiveSpace 均维持原状

效果：窗口内始终保有标签，从结构上杜绝窗口关闭；普通切换 space 的同类风险一并消除。

## 修复 2：`isCreatingSpace` 防护窗口失效

- `createSpace` 移除内部的标志设置/重置（`SpaceManager.ts:382`、`412-414`）
- `createAndSwitchSpace` 用 try/finally 全程持有 `isCreatingSpace`（覆盖 300ms sleep + switchSpace 全程，使迟到的 `bookmarks.onCreated` 事件落在保护窗口内）
- SpaceManager 暴露 `isCreatingSpace(): boolean`
- `UIManager.handleBookmarkChanged`（`UIManager.ts:414`）增加 `isCreatingSpace()` 检查，杜绝创建期间的 `reloadBookmarks` 与 `switchSpace` 并发

## 修复 3：尾部 `onRemoved` 误删旧 space 存储数据

- SpaceManager 增加 `recentlyClosedTabIds: Map<number, number>`（tabId → 关闭时间戳），`closeOldSpaceTabs` 记录实际关闭的 id
- 暴露 `isTabClosedDuringSwitch(tabId): boolean`（10 秒有效窗口），`cleanup()` 定时清理过期项
- `sidebar.ts:139` 的 `onTabRemoved` 处理器开头检查并跳过这些 id，避免切换结束后迟到的关闭事件把旧 space 存储的标签数据删掉

## 修复 4：用 HTML UI 替换全部原生对话框（8 处）

原生 `prompt/alert/confirm` 在 side panel 中不受支持，是次要崩溃风险。

- 新组件 `src/ui/components/DialogManager.ts`：
  - `prompt(title, defaultValue?): Promise<string | null>`（Enter 确认 / Esc 或点遮罩取消，自动 focus）
  - `confirm(message): Promise<boolean>`
  - `toast(message): void`（数秒后自动消失）
- `src/sidebar.html` 增加三个模态/提示的 DOM（结构仿照现有 LogViewer modal）
- `src/styles/sidebar.css` 增加对应样式（构建管线已自动输出为 style.css，无需改 vite 配置）
- 替换点：
  - `UIManager.handleNewSpace`：`prompt()` → `dialogManager.prompt()`；3 处 `alert()` → `toast()`
  - `UIManager.handleDeleteSpace`：`confirm()` → `dialogManager.confirm()`；2 处 `alert()` → `toast()`
  - `LogViewer`（`LogViewer.ts:219,227`）：`LogViewerOptions` 增加可选 `confirm?: (msg) => Promise<boolean>`、`notify?: (msg) => void` 注入，UIManager 构造时传入；未注入时回退到现有行为以保证独立可用

## 测试计划

- `tests/managers/TabManager.test.ts`：`createTab` 默认仍拦截 `about:blank`；`allowInternal` 放行
- `tests/managers/SpaceManager.test.ts`：
  - 空 space 切换 → `chrome.tabs.create` 收到 `about:blank` 且 active=false
  - 顺序断言：`tabs.create` 的 `invocationCallOrder` 早于 `tabs.remove`
  - 恢复与占位全部失败 → `tabs.remove` 未被调用、currentSpaceId 回滚
  - `createAndSwitchSpace` 期间 `isCreatingSpace()` 为 true
  - `isTabClosedDuringSwitch` 记录与过期行为
- `tests/ui/UIManager.test.ts` / 新增 DialogManager 测试：prompt/confirm/toast DOM 交互、`handleNewSpace` 走新对话框
- `tests/ui/components/LogViewer.test.ts`：适配注入参数
- 全量 `npm test`、`npm run typecheck`、`npm run lint` 通过

## 验收方式

自动：测试/类型/ lint 全绿。手动（用户侧）：`npm run build` 后重新加载扩展，在单窗口、所有标签均被追踪的场景下创建新 space——窗口不再消失，新 space 正常切入；旧 space 切回后标签数据完整。