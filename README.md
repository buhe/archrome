# Archrome

<p align="center">
  <img src="public/icons/icon128.png" width="128" alt="Archrome Logo">
</p>

An Arc browser-inspired tool for managing browser spaces using bookmarks.

## Features

### Spaces

* **Organize with Spaces:** Create distinct "spaces" to separate your work, personal projects, or any other context.
* **Bookmark-Powered:** Each space is powered by a bookmark folder, making it easy to manage and sync across devices.
* **Custom Icons:** Use an emoji as the first character of your bookmark folder name to serve as the space's icon.
* **Seamless Switching:** When you switch between spaces, your current tabs are saved and closed, and the tabs for the new space are automatically opened.

### Tab Management

* **Active Tabs List:** See all your open tabs for the current space in a dedicated list.
* **Quickly Close Tabs:** Close tabs directly from the sidebar.
* **Move Tabs Between Spaces:** Right-click a tab to easily move it to another space.
* **Drag and Drop:** Drag tabs to the bookmarks section to save them as bookmarks.

### Bookmarks

* **Space-Specific Bookmarks:** View all the bookmarks for the current space right in the sidebar.
* **Pinned Items:** Keep your most important links always accessible in the "Pinned" section.

### Keyboard Shortcuts

* **Toggle Sidebar:** `Alt+Q` (Windows/Linux) or `Option+Q` (Mac)
* **Open Log Viewer:** `Ctrl+Shift+L` (Windows/Linux) or `Cmd+Shift+L` (Mac)

## Architecture

This is a complete TypeScript rewrite with a modular architecture:

```
archrome/
├── src/
│   ├── types/           # TypeScript type definitions
│   ├── managers/        # Business logic modules
│   │   ├── StorageManager.ts
│   │   ├── BookmarkManager.ts
│   │   ├── TabManager.ts
│   │   └── SpaceManager.ts
│   ├── ui/              # UI components
│   │   ├── components/
│   │   └── UIManager.ts
│   ├── utils/           # Utility functions
│   ├── background.ts    # Service worker
│   ├── sidebar.ts       # Main entry point
│   └── styles/          # CSS styles
├── public/              # Static assets
├── tests/               # Test files
└── dist/                # Build output
```

### Key Improvements

1. **Type Safety:** Full TypeScript implementation for type safety and better IDE support.
2. **Modular Architecture:** Separated concerns with dedicated manager classes.
3. **State Management:** Event-driven state management with type-safe events.
4. **Error Handling:** Comprehensive error handling with retry mechanisms.
5. **Performance:** Optimized batch operations for tab management.
6. **Developer Experience:** Vite for fast builds, Vitest for testing, ESLint/Prettier for code quality.

## Development

### Prerequisites

- Node.js 18+ and npm/yarn/pnpm

### Installation

```bash
# Install dependencies
npm install

# or with yarn
yarn install

# or with pnpm
pnpm install
```

### Building

```bash
# Development build with watch mode
npm run dev

# Production build
npm run build

# Preview build
npm run preview
```

### Testing

```bash
# Run tests
npm test

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

### Linting and Formatting

```bash
# Lint code
npm run lint

# Lint and fix
npm run lint:fix

# Format code
npm run format

# Check formatting
npm run format:check

# Type check
npm run typecheck
```

### Loading the Extension

1. Build the extension: `npm run build`
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the `dist` folder

## Project Structure

### Type Definitions (`src/types/`)

Defines all TypeScript interfaces and enums used throughout the application.

### Managers (`src/managers/`)

- **StorageManager:** Handles all Chrome storage operations with debouncing.
- **BookmarkManager:** Manages Chrome bookmarks API operations.
- **TabManager:** Manages Chrome tabs API operations with batch processing.
- **SpaceManager:** Core module that ties everything together for space management.

### UI Components (`src/ui/`)

- **ListItemComponent:** Base component for list items (bookmarks, tabs).
- **ListComponent:** Base component for lists with drag-and-drop support.
- **ContextMenu:** Custom context menu for tabs and bookmarks.
- **LogViewer:** Modal for viewing logs and metrics.
- **UIManager:** Main UI controller that manages all components.

### Utilities (`src/utils/`)

- **Logger:** Persistent logging system with configurable levels.
- **Debounce:** Debounce and throttle utilities.
- **Helpers:** Common helper functions (emoji detection, URL validation, etc.).

## Data Storage

Archrome uses Chrome's local storage for persistence:

- `space_{spaceId}_tabs`: Tab data for each space
- `last_active_space_id`: Last active space
- `archrome_logs`: Application logs
- `archrome_switch_metrics`: Space switch performance metrics
- `last_heartbeat`: Service worker heartbeat timestamp

## Compatibility

This rewrite maintains backward compatibility with the original Archrome data structure, allowing seamless migration of user data.

## License

MIT License - see LICENSE file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
