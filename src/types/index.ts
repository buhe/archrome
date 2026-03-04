/**
 * Chrome extension type definitions for Archrome
 */

/**
 * Log level enumeration
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  CRITICAL = 4,
}

/**
 * Log entry structure
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  data?: unknown;
}

/**
 * Space switch status
 */
export type SwitchStatus = 'started' | 'success' | 'failed';

/**
 * Space switch metrics
 */
export interface SwitchMetric {
  startTime: number;
  endTime?: number;
  duration?: number;
  fromSpace?: string;
  toSpace: string;
  tabCount?: number;
  closedTabCount?: number;
  restoredTabCount?: number;
  status: SwitchStatus;
  details?: SwitchMetricDetails;
}

/**
 * Additional details for switch metrics
 */
export interface SwitchMetricDetails {
  totalDuration?: number;
  closedTabCount?: number;
  restoredTabCount?: number;
  error?: string;
}

/**
 * Tab data structure
 */
export interface TabData {
  id: number;
  url: string;
  title: string;
  favIconUrl?: string | null;
  pendingUrl?: string;
}

/**
 * Bookmark data structure
 */
export interface BookmarkData {
  id: string;
  title: string;
  url: string;
  dateAdded?: number;
  dateGroupModified?: number;
  index?: number;
  parentId?: string;
}

/**
 * Space data structure
 */
export interface Space {
  id: string;
  icon: string;
  name: string;
  bookmarks: BookmarkData[];
  openTabs: TabData[];
}

/**
 * Chrome bookmark tree node
 */
export interface BookmarkTreeNode {
  id: string;
  parentId?: string;
  index?: number;
  url?: string;
  title: string;
  dateAdded?: number;
  dateGroupModified?: number;
  children?: BookmarkTreeNode[];
}

/**
 * Chrome tab object
 */
export interface ChromeTab {
  id: number;
  url?: string;
  pendingUrl?: string;
  title?: string;
  favIconUrl?: string | null;
  status?: string;
  active?: boolean;
  pinned?: boolean;
  hidden?: boolean;
  index?: number;
  windowId?: number;
}

/**
 * Storage keys used by the extension
 */
export const STORAGE_KEYS = {
  LOGS: 'archrome_logs',
  SWITCH_METRICS: 'archrome_switch_metrics',
  LAST_ACTIVE_SPACE: 'last_active_space_id',
  LAST_HEARTBEAT: 'last_heartbeat',
  SPACE_TABS_PREFIX: 'space_',
  SPACE_TABS_SUFFIX: '_tabs',
} as const;

export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];

/**
 * Configuration options
 */
export interface Config {
  maxLogs: number;
  maxMetrics: number;
  maxStoredTabs: number;
  maxRestoreTabs: number;
  batchSize: number;
  batchDelay: number;
  heartbeatInterval: number;
  storageDebounceMs: number;
  switchDebounceMs: number;
  cleanupInterval: number;
  staleTimeout: number;
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Config = {
  maxLogs: 500,
  maxMetrics: 50,
  maxStoredTabs: 100,
  maxRestoreTabs: 30,
  batchSize: 5,
  batchDelay: 100,
  heartbeatInterval: 120000,
  storageDebounceMs: 300,
  switchDebounceMs: 300,
  cleanupInterval: 300000,
  staleTimeout: 30000,
} as const;

/**
 * Event types for state management
 */
export enum EventType {
  SPACE_CHANGED = 'space_changed',
  TABS_UPDATED = 'tabs_updated',
  BOOKMARKS_UPDATED = 'bookmarks_updated',
  SPACE_CREATED = 'space_created',
  SPACE_DELETED = 'space_deleted',
  SPACE_RENAMED = 'space_renamed',
}

/**
 * Base event structure
 */
export interface BaseEvent {
  type: EventType;
  timestamp: number;
}

/**
 * Space changed event
 */
export interface SpaceChangedEvent extends BaseEvent {
  type: EventType.SPACE_CHANGED;
  spaceId: string;
  previousSpaceId?: string;
}

/**
 * Tabs updated event
 */
export interface TabsUpdatedEvent extends BaseEvent {
  type: EventType.TABS_UPDATED;
  spaceId: string;
  tabs: TabData[];
}

/**
 * Bookmarks updated event
 */
export interface BookmarksUpdatedEvent extends BaseEvent {
  type: EventType.BOOKMARKS_UPDATED;
  spaceId: string;
  bookmarks: BookmarkData[];
}

/**
 * Space created event
 */
export interface SpaceCreatedEvent extends BaseEvent {
  type: EventType.SPACE_CREATED;
  space: Space;
}

/**
 * Space deleted event
 */
export interface SpaceDeletedEvent extends BaseEvent {
  type: EventType.SPACE_DELETED;
  spaceId: string;
}

/**
 * Space renamed event
 */
export interface SpaceRenamedEvent extends BaseEvent {
  type: EventType.SPACE_RENAMED;
  spaceId: string;
  oldName: string;
  newName: string;
}

/**
 * Union type of all events
 */
export type AppEvent =
  | SpaceChangedEvent
  | TabsUpdatedEvent
  | BookmarksUpdatedEvent
  | SpaceCreatedEvent
  | SpaceDeletedEvent
  | SpaceRenamedEvent;

/**
 * Event listener function type
 */
export type EventListener<T extends AppEvent = AppEvent> = (event: T) => void;

/**
 * UI component state
 */
export interface UIState {
  currentSpaceId: string | null;
  spaces: Space[];
  pinnedBookmarks: BookmarkData[];
  isLoading: boolean;
  isSwitching: boolean;
  logViewerOpen: boolean;
}

/**
 * Filter options for log viewer
 */
export type LogFilter = 'all' | 'error' | 'warn' | 'switch';

/**
 * Context menu item configuration
 */
export interface ContextMenuItem {
  label: string;
  action: () => void | Promise<void>;
  icon?: string;
  items?: ContextMenuItem[];
}

/**
 * Fallback options for tab restoration
 */
export interface TabRestoreOptions {
  retries?: number;
  delay?: number;
  skipInvalid?: boolean;
}
