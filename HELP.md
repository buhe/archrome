# Archrome Help

Archrome is an Arc browser–inspired Chrome extension that manages browser **spaces** with **bookmark folders**, so you can keep work, study, personal, and other contexts separate.

Your data lives in Chrome’s native bookmarks—not locked inside the extension—so your spaces and links remain yours even if you uninstall Archrome.

---

## Open the Sidebar

- Click the extension icon, or
- Shortcut: `Alt + Q` (`Option + Q` on Mac)

---

## Spaces

| Action | Description |
|--------|-------------|
| Create a space | Click the **+** button at the bottom |
| Switch space | Click the space icon at the bottom |
| Custom icon | Rename the bookmark folder so it starts with an emoji, e.g. `💼 Work` |
| Delete space | Right-click a space → Delete (confirmation required) |

**What happens on switch:** Open tabs in the current space are saved and closed, then the target space’s tabs are restored automatically.

---

## Tabs & Bookmarks

The sidebar has three main sections:

1. **Pinned** — From a dedicated bookmark-bar folder named **`pin`**. Links placed there stay fixed at the top of the sidebar and **do not change when you switch spaces**; they are the same in every space.
2. **Bookmarks** — Saved links for the current space (change with the space)
3. **Tabs** — Currently open tabs

Common actions:

- **Close a tab:** Use the tabs list
- **Move to another space:** Right-click a tab → choose the target space
- **Save as bookmark:** Drag a tab into the bookmarks area
- **Pin a link:** Put it in the bookmark bar’s **`pin`** folder so it appears fixed at the top (shared across spaces)

---

## Theme

Toggle **dark / light** at the bottom of the sidebar. Your preference is saved; on first use it follows the system theme.

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt + Q` / `Option + Q` | Toggle the sidebar |
| `Ctrl + Shift + L` / `Cmd + Shift + L` | Open the log viewer (for debugging) |

---

## How Data Is Stored

- Each **space** is a folder under the bookmarks bar
- **Bookmarks** in a space are the links inside that folder
- **Pinned** maps to the **`pin`** folder on the bookmarks bar and is independent of any space
- **Open-tab** state per space is stored by the extension via Chrome storage; the bookmarks themselves always stay in the browser
