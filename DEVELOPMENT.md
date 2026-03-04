# Archrome Development Guide

## Development Setup

### Prerequisites

- Node.js 18 or higher
- npm, yarn, or pnpm
- Chrome browser (for testing the extension)

### Initial Setup

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd archrome
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the extension:
   ```bash
   npm run build
   ```

4. Load in Chrome:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` folder

### Development Workflow

#### Watch Mode

For development with automatic rebuilds:
```bash
npm run dev
```

This builds the extension and watches for file changes. Reload the extension in Chrome after changes.

#### Manual Build

For production builds:
```bash
npm run build
```

## Project Architecture

### Module Structure

```
src/
├── types/           # Type definitions
│   └── index.ts     # All interfaces and enums
├── managers/        # Business logic
│   ├── StorageManager.ts
│   ├── BookmarkManager.ts
│   ├── TabManager.ts
│   └── SpaceManager.ts
├── ui/              # User interface
│   ├── components/  # Reusable UI components
│   └── UIManager.ts
├── utils/           # Utility functions
│   ├── logger.ts
│   ├── debounce.ts
│   └── helpers.ts
├── background.ts    # Service worker
├── sidebar.ts       # Main entry point
├── sidebar.html     # HTML template
└── styles/          # CSS styles
```

### Key Design Patterns

#### Singleton Pattern

All managers use the singleton pattern for a single source of truth:

```typescript
export const storageManager = new StorageManager();
export const bookmarkManager = new BookmarkManager();
export const tabManager = new TabManager();
export const spaceManager = new SpaceManager();
```

#### Event-Driven Architecture

The SpaceManager emits events that other parts of the app can listen to:

```typescript
spaceManager.on(EventType.SPACE_CHANGED, (event) => {
  // Handle space change
});
```

#### Debouncing

Storage operations are debounced to prevent excessive writes:

```typescript
// Debounced storage (300ms delay)
await storageManager.storeTabs(spaceId, tabs);
```

### State Management

State is managed through the SpaceManager:

1. **Current Space:** The active space ID
2. **Spaces:** Array of all space objects
3. **Pinned Bookmarks:** Array of pinned bookmarks
4. **Switching State:** Flag indicating if a space switch is in progress

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm run test:coverage

# Run tests with UI
npm run test:ui
```

### Writing Tests

Tests are located in the `tests/` directory and use Vitest:

```typescript
import { describe, it, expect } from 'vitest';
import { isEmoji } from '@utils/index';

describe('isEmoji', () => {
  it('should detect emojis', () => {
    expect(isEmoji('😀')).toBe(true);
    expect(isEmoji('A')).toBe(false);
  });
});
```

### Mocking Chrome APIs

When testing managers that use Chrome APIs, mock the APIs:

```typescript
vi.mock('chrome.storage.local', () => ({
  get: vi.fn(() => Promise.resolve({})),
  set: vi.fn(() => Promise.resolve()),
}));
```

## Code Style

### Linting

```bash
# Check for lint errors
npm run lint

# Fix lint errors
npm run lint:fix
```

### Formatting

```bash
# Format code
npm run format

# Check formatting
npm run format:check
```

### Type Checking

```bash
# Run TypeScript compiler
npm run typecheck
```

## Debugging

### Log Viewer

Press `Ctrl+Shift+L` (Windows/Linux) or `Cmd+Shift+L` (Mac) to open the log viewer.

### Console Logs

The extension uses a custom logger that writes to both console and persistent storage:

```typescript
import { logger } from '@utils/index';

logger.info('Category', 'Message', { data: 'optional' });
logger.error('Category', 'Error message', error);
```

### Chrome DevTools

1. Open the sidebar
2. Right-click and select "Inspect"
3. Use the DevTools as normal

## Performance Considerations

### Batch Operations

Tab operations are batched to reduce memory pressure:

```typescript
// Default batch size: 5 tabs
const BATCH_SIZE = 5;
const BATCH_DELAY = 100;
```

### Storage Debouncing

Storage writes are debounced by 300ms to prevent excessive operations.

### Tab Limits

- Maximum tabs stored per space: 100
- Maximum tabs restored on switch: 30

## Troubleshooting

### Extension Not Loading

1. Check for errors in `chrome://extensions/`
2. Verify the build completed successfully
3. Reload the extension

### Tabs Not Switching

1. Check the log viewer for errors
2. Verify the bookmark folder structure
3. Ensure the space ID matches a bookmark folder ID

### Build Errors

1. Clear node_modules and reinstall: `rm -rf node_modules && npm install`
2. Clear the build output: `rm -rf dist`
3. Rebuild: `npm run build`

## Release Process

1. Update version in `package.json` and `public/manifest.json`
2. Build the extension: `npm run build`
3. Test the build thoroughly
4. Create a ZIP of the `dist` folder
5. Upload to the Chrome Web Store

## Additional Resources

- [Chrome Extension Documentation](https://developer.chrome.com/docs/extensions/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Vite Documentation](https://vitejs.dev/)
- [Vitest Documentation](https://vitest.dev/)
