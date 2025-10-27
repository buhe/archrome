# Archrome - Chrome Extension Development Guide

## Project Overview

Archrome is a Chrome browser extension inspired by the Arc browser, designed to help users organize their browsing experience with spaces, pinned tabs, and a clean sidebar interface. The extension uses Chrome's native bookmark system as the single source of truth for data storage, enabling seamless synchronization across devices.

**Key Philosophy**: Leverages existing browser infrastructure (bookmarks) rather than creating separate data storage, maximizing compatibility and data portability.

## Technology Stack

- **Platform**: Chrome Extension (Manifest V3)
- **Language**: Pure JavaScript (ES6+)
- **UI**: Vanilla HTML/CSS (no frameworks)
- **Storage**: Chrome Bookmarks API + Chrome Storage API
- **Architecture**: Service Worker + Side Panel

## Project Structure

```
archrome/
├── manifest.json          # Extension configuration (Manifest V3)
├── background.js          # Service worker (69 lines)
├── sidebar.html           # Main UI structure (51 lines)
├── sidebar.js             # Core application logic (969 lines)
├── sidebar.css            # Styling and themes (923 lines)
├── icons/                 # Extension icons and assets
│   ├── icon48.png         # Toolbar icon (48x48)
│   ├── icon128.png        # Extension icon (128x128)
│   └── default_favicon.png # Fallback favicon
├── screenshot/            # Documentation images
└── README.md              # User documentation (English)
└── README_CN.md           # User documentation (Chinese)
```

## Core Architecture

### Data Model
- **Spaces**: Represented as bookmark folders in the bookmarks bar
- **Tabs**: Stored per-space in Chrome's local storage
- **Pinned Items**: Special bookmark folder named "pin"
- **Bookmarks**: Native Chrome bookmarks within space folders

### Key APIs Used
- `chrome.bookmarks` - Space and bookmark management
- `chrome.tabs` - Tab tracking and control
- `chrome.storage` - Tab persistence across sessions
- `chrome.sidePanel` - Sidebar interface
- `chrome.action` - Toolbar icon interaction

## Development Guidelines

### Code Style
- Use modern JavaScript (ES6+) features
- Async/await for asynchronous operations
- Consistent error handling with try-catch blocks
- Meaningful variable and function names
- Add console logging for debugging (remove in production)

### CSS Conventions
- CSS custom properties (variables) for theming
- BEM-like naming for components
- Mobile-first responsive design
- Consistent spacing using rem units
- Smooth transitions for user interactions

### Error Handling
- Always include fallback mechanisms for API failures
- Use retry logic for flaky Chrome APIs (see background.js example)
- Handle edge cases (invalid URLs, missing favicons, etc.)
- Prevent extension crashes with global error handlers

## Build and Deployment

### Development Setup
1. Clone the repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the project directory
5. The extension will load with development tools enabled

### Testing
- Manual testing in Chrome browser
- Test across different Chrome versions
- Verify bookmark synchronization
- Test keyboard shortcuts (Alt+Q)
- Validate drag-and-drop functionality
- Check context menu operations

### Production Build
1. Ensure all console.log statements are removed or commented
2. Verify manifest.json version is incremented
3. Test the extension in a clean Chrome profile
4. Package as .zip file for Chrome Web Store submission

## Key Features Implementation

### Space Management
- Spaces are bookmark folders in the bookmarks bar
- First character used as icon (emoji support)
- Tab state preserved per space in chrome.storage
- Space switching saves current tabs and restores target space tabs

### Tab Operations
- Real-time tab tracking with chrome.tabs API
- Drag-and-drop to create bookmarks from tabs
- Context menu for moving tabs between spaces
- Favicon handling with fallback to default icon

### Bookmark Integration
- Direct manipulation of Chrome bookmarks
- Automatic bookmark creation from dragged tabs
- Bookmark deletion with immediate UI updates
- Pinned items from special "pin" folder

## Security Considerations

### Permissions
- `bookmarks` - Required for space and bookmark management
- `tabs` - Needed for tab tracking and control
- `storage` - For persisting tab state
- `sidePanel` - Sidebar interface access
- `scripting` - Potential future injection capabilities
- `activeTab` - Current tab operations
- `alarms` - Scheduled tasks (future use)

### Data Privacy
- All data stored locally in user's Chrome profile
- No external data transmission
- Uses existing Chrome bookmark system
- No tracking or analytics

## Performance Optimizations

### Debouncing
- Space switching includes debounce mechanism
- Prevents rapid switching causing performance issues
- Timeout-based approach (see sidebar.js)

### Lazy Loading
- UI elements rendered on-demand
- Favicon loading with error fallbacks
- Efficient DOM updates during space switches

### Storage Efficiency
- Minimal data stored (tab URLs and titles)
- Bookmark data accessed directly from Chrome APIs
- No redundant data duplication

## Common Issues and Solutions

### Favicon Loading
- Multiple fallback strategies implemented
- Google's favicon service as primary
- Default icon for chrome:// URLs and failures
- Error handling for invalid URLs

### API Reliability
- Retry mechanisms for flaky Chrome APIs
- Graceful degradation when APIs fail
- Background service worker error handling
- Fallback UI updates when listeners fail

### Space Synchronization
- Real-time bookmark change detection
- Immediate UI updates on bookmark modifications
- Proper state management during space switches
- Storage synchronization between tabs and bookmarks

## Future Enhancements

### Potential Features
- Keyboard navigation within sidebar
- Search functionality across spaces
- Theme customization options
- Export/import functionality
- Integration with other bookmark managers

### Technical Improvements
- TypeScript migration for better type safety
- Unit testing framework implementation
- Performance monitoring
- Error reporting mechanism
- Automated testing pipeline

## Contributing Guidelines

### Code Quality
- Follow existing code patterns and conventions
- Add appropriate comments for complex logic
- Test changes across different scenarios
- Ensure no breaking changes to existing functionality

### Documentation
- Update README files for user-facing changes
- Document new APIs or configuration options
- Include examples for new features
- Maintain changelog for version updates