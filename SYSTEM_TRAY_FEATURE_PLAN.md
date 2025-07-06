# System Tray Feature Plan for Igloo Desktop

**Refined based on actual codebase analysis**

The Igloo desktop application is built with Electron, React, and TypeScript, leveraging the `@frostr/igloo-core` library for all cryptographic operations. This feature plan outlines the implementation of a cross-platform system tray that provides real-time status monitoring and quick controls for the FROSTR signing functionality.

## Current Architecture Analysis

**Technology Stack:**
- **Electron 33.0.2** with React 17.0.2 and TypeScript
- **@frostr/igloo-core 0.1.3** for cryptographic operations and node management
- **@frostr/bifrost 1.0.6** for distributed signing protocol
- **CommonJS** in main process (needs modernization)
- **Tailwind CSS** with Radix UI components

**Key Architectural Components:**
- `ShareManager` class for encrypted share file management
- `Signer` component with proper node lifecycle management using igloo-core
- IPC communication channels for main-renderer interaction
- Comprehensive event logging and state management
- File-based share storage with password encryption

## Refined System Tray Implementation Plan

### 1. Main Process Modernization and Setup

**First Priority: Modernize main.ts (src/main.ts)**

```typescript
// src/main.ts - Convert from CommonJS to ES modules
import { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage, Notification } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { ShareManager } from './lib/shareManager.js';
import { SystemTrayManager } from './lib/systemTrayManager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;
let shareManager: ShareManager | null = null;
let systemTrayManager: SystemTrayManager | null = null;

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    icon: path.join(__dirname, '..', 'src', 'assets', 'frostr-logo-transparent.png'),
    show: false // Don't show initially when tray is active
  });

  // Load appropriate file
  if (process.env.NODE_ENV === 'development') {
    win.loadFile('index.html');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(app.getAppPath(), 'index.html'));
  }

  return win;
}

app.whenReady().then(() => {
  mainWindow = createWindow();
  shareManager = new ShareManager();
  
  // Initialize system tray
  systemTrayManager = new SystemTrayManager(mainWindow, shareManager);
  systemTrayManager.createTray();
  
  setupIpcHandlers();
  
  // Show window on first launch, hide to tray on subsequent launches
  const shouldShowWindow = !app.getLoginItemSettings().wasOpenedAtLogin;
  if (shouldShowWindow) {
    mainWindow.show();
  }
});

// Prevent quit when all windows are closed (keep running in tray)
app.on('window-all-closed', (event) => {
  if (systemTrayManager?.isActive()) {
    event.preventDefault();
  } else if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createWindow();
  } else if (mainWindow) {
    mainWindow.show();
  }
});

function setupIpcHandlers() {
  // Existing IPC handlers
  ipcMain.handle('get-shares', async () => {
    return shareManager?.getShares() || [];
  });

  ipcMain.handle('save-share', async (_, share) => {
    return shareManager?.saveShare(share) || false;
  });

  ipcMain.handle('delete-share', async (_, shareId: string) => {
    return shareManager?.deleteShare(shareId) || false;
  });

  ipcMain.handle('open-share-location', async (_, shareId: string) => {
    const filePath = shareManager?.getSharePath(shareId);
    if (filePath) {
      await shell.showItemInFolder(filePath);
    }
  });

  // New tray-specific IPC handlers
  ipcMain.handle('tray:get-status', async () => {
    return systemTrayManager?.getStatus() || null;
  });

  ipcMain.handle('tray:show-window', async () => {
    systemTrayManager?.showWindow();
  });

  ipcMain.handle('tray:hide-window', async () => {
    systemTrayManager?.hideWindow();
  });

  ipcMain.handle('tray:update-signer-status', async (_, status) => {
    systemTrayManager?.updateSignerStatus(status);
  });

  ipcMain.handle('tray:show-notification', async (_, message, options = {}) => {
    systemTrayManager?.showNotification(message, options);
  });
}
```

### 2. System Tray Manager Implementation

**Create src/lib/systemTrayManager.ts**

```typescript
// src/lib/systemTrayManager.ts
import { Tray, Menu, nativeImage, BrowserWindow, Notification, app } from 'electron';
import path from 'path';
import { ShareManager } from './shareManager.js';
import type { IglooShare } from '../types/index.js';

export interface TrayStatus {
  signerActive: boolean;
  shareLoaded: boolean;
  currentShare: {
    name: string;
    id: string;
  } | null;
  lastActivity: Date | null;
  appVersion: string;
}

export interface SignerStatusUpdate {
  isRunning: boolean;
  isConnecting: boolean;
  loadedShare?: {
    name: string;
    id: string;
  };
  relayCount?: number;
  lastActivity?: Date;
}

export class SystemTrayManager {
  private tray: Tray | null = null;
  private mainWindow: BrowserWindow;
  private shareManager: ShareManager;
  private currentStatus: TrayStatus;
  private isWindowVisible: boolean = false;

  constructor(mainWindow: BrowserWindow, shareManager: ShareManager) {
    this.mainWindow = mainWindow;
    this.shareManager = shareManager;
    this.currentStatus = {
      signerActive: false,
      shareLoaded: false,
      currentShare: null,
      lastActivity: null,
      appVersion: app.getVersion()
    };

    this.setupWindowEventHandlers();
  }

  private setupWindowEventHandlers(): void {
    this.mainWindow.on('show', () => {
      this.isWindowVisible = true;
      this.updateTrayMenu();
    });

    this.mainWindow.on('hide', () => {
      this.isWindowVisible = false;
      this.updateTrayMenu();
    });

    this.mainWindow.on('close', (event) => {
      if (this.tray && !app.isQuiting) {
        event.preventDefault();
        this.hideWindow();
        this.showNotification('Igloo is still running in the system tray', {
          body: 'Click the tray icon to restore the window'
        });
      }
    });
  }

  createTray(): void {
    const trayIcon = this.getTrayIcon();
    this.tray = new Tray(trayIcon);
    
    this.tray.setToolTip('Igloo - FROSTR Signer');
    this.updateTrayMenu();
    this.setupTrayEvents();
  }

  private getTrayIcon(): nativeImage {
    const iconName = this.getIconName();
    const iconPath = path.join(__dirname, '..', 'assets', 'tray', iconName);
    
    let icon: nativeImage;
    try {
      icon = nativeImage.createFromPath(iconPath);
    } catch {
      // Fallback to main app icon if tray icons don't exist
      icon = nativeImage.createFromPath(
        path.join(__dirname, '..', 'assets', 'frostr-logo-transparent.png')
      );
    }

    // Platform-specific sizing
    if (process.platform === 'darwin') {
      icon.setTemplateImage(true);
      return icon.resize({ width: 16, height: 16 });
    } else {
      return icon.resize({ width: 16, height: 16 });
    }
  }

  private getIconName(): string {
    const { signerActive, shareLoaded } = this.currentStatus;
    const platform = process.platform;
    
    if (signerActive && shareLoaded) {
      return `tray-active-${platform}.png`;
    } else if (shareLoaded) {
      return `tray-ready-${platform}.png`;
    } else {
      return `tray-inactive-${platform}.png`;
    }
  }

  private setupTrayEvents(): void {
    if (!this.tray) return;

    // Single click to toggle window
    this.tray.on('click', () => {
      this.toggleWindow();
    });

    // Double click to show window (Windows/Linux)
    this.tray.on('double-click', () => {
      this.showWindow();
    });

    // Right click for context menu (handled by setContextMenu)
  }

  private updateTrayMenu(): void {
    if (!this.tray) return;

    const shares = this.shareManager.getShares();
    const availableShares = Array.isArray(shares) ? shares : [];
    
    const template = [
      {
        label: `Igloo ${this.currentStatus.signerActive ? '(Active)' : '(Inactive)'}`,
        enabled: false
      },
      { type: 'separator' as const },
      
      // Share status section
      {
        label: this.currentStatus.shareLoaded ? 
          `Share: ${this.currentStatus.currentShare?.name || 'Unknown'}` : 
          'No Share Loaded',
        enabled: false
      },
      
      // Quick load shares submenu
      ...(availableShares.length > 0 ? [{
        label: 'Load Share',
        submenu: availableShares.map((share: IglooShare) => ({
          label: share.name,
          click: () => this.loadShareFromTray(share)
        }))
      }] : []),
      
      { type: 'separator' as const },
      
      // Window management
      {
        label: this.isWindowVisible ? 'Hide Window' : 'Show Window',
        click: () => this.toggleWindow()
      },
      
      { type: 'separator' as const },
      
      // App actions
      {
        label: 'Create New Share',
        click: () => this.openCreateView()
      },
      {
        label: 'About',
        click: () => this.showAbout()
      },
      
      { type: 'separator' as const },
      
      // System
      {
        label: 'Quit Igloo',
        click: () => this.quit()
      }
    ];

    const contextMenu = Menu.buildFromTemplate(template);
    this.tray.setContextMenu(contextMenu);
    this.updateTrayTooltip();
  }

  private updateTrayTooltip(): void {
    if (!this.tray) return;

    let tooltip = `Igloo ${this.currentStatus.appVersion}\n`;
    
    if (this.currentStatus.shareLoaded) {
      tooltip += `Share: ${this.currentStatus.currentShare?.name}\n`;
      tooltip += `Signer: ${this.currentStatus.signerActive ? 'Active' : 'Inactive'}\n`;
      
      if (this.currentStatus.lastActivity) {
        tooltip += `Last Activity: ${this.currentStatus.lastActivity.toLocaleTimeString()}`;
      }
    } else {
      tooltip += 'No share loaded';
    }

    this.tray.setToolTip(tooltip);
  }

  // Public methods for external updates
  updateSignerStatus(status: SignerStatusUpdate): void {
    this.currentStatus.signerActive = status.isRunning;
    this.currentStatus.shareLoaded = !!status.loadedShare;
    this.currentStatus.currentShare = status.loadedShare || null;
    this.currentStatus.lastActivity = status.lastActivity || null;

    this.updateTrayIcon();
    this.updateTrayMenu();
  }

  private updateTrayIcon(): void {
    if (!this.tray) return;
    
    const newIcon = this.getTrayIcon();
    this.tray.setImage(newIcon);
  }

  showWindow(): void {
    if (this.mainWindow.isMinimized()) {
      this.mainWindow.restore();
    }
    this.mainWindow.show();
    this.mainWindow.focus();
  }

  hideWindow(): void {
    this.mainWindow.hide();
  }

  toggleWindow(): void {
    if (this.isWindowVisible) {
      this.hideWindow();
    } else {
      this.showWindow();
    }
  }

  showNotification(title: string, options: Partial<Electron.NotificationConstructorOptions> = {}): void {
    if (!Notification.isSupported()) return;

    const notification = new Notification({
      title,
      icon: this.getTrayIcon(),
      silent: false,
      ...options
    });

    notification.on('click', () => {
      this.showWindow();
    });

    notification.show();
  }

  getStatus(): TrayStatus {
    return { ...this.currentStatus };
  }

  isActive(): boolean {
    return this.tray !== null;
  }

  private loadShareFromTray(share: IglooShare): void {
    // This would need to be implemented as IPC to the renderer
    this.showWindow();
    // Send message to renderer to load this share
    this.mainWindow.webContents.send('load-share-from-tray', share);
  }

  private openCreateView(): void {
    this.showWindow();
    this.mainWindow.webContents.send('navigate-to-create');
  }

  private showAbout(): void {
    this.showNotification('About Igloo', {
      body: `Version ${this.currentStatus.appVersion}\nFROSTR distributed signing app`
    });
  }

  private quit(): void {
    app.isQuiting = true;
    app.quit();
  }

  destroy(): void {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }
}
```

### 3. Enhanced IPC Communication

**Update src/types/index.ts to include tray types:**

```typescript
// ... existing types ...

// System Tray types
export interface TrayStatus {
  signerActive: boolean;
  shareLoaded: boolean;
  currentShare: {
    name: string;
    id: string;
  } | null;
  lastActivity: Date | null;
  appVersion: string;
}

export interface SignerStatusUpdate {
  isRunning: boolean;
  isConnecting: boolean;
  loadedShare?: {
    name: string;
    id: string;
  };
  relayCount?: number;
  lastActivity?: Date;
}

export interface TrayNotificationOptions {
  body?: string;
  subtitle?: string;
  urgency?: 'normal' | 'critical' | 'low';
}

// ... rest of existing types ...
```

### 4. Integration with Existing Signer Component

**Update src/components/Signer.tsx to communicate with tray:**

```typescript
// Add to the existing Signer component

// Add after existing imports
declare global {
  interface Window {
    electronAPI?: {
      updateTrayStatus: (status: SignerStatusUpdate) => Promise<void>;
      showTrayNotification: (message: string, options?: TrayNotificationOptions) => Promise<void>;
    };
  }
}

// Add to the existing component after the current useEffect hooks
useEffect(() => {
  // Update tray status when signer state changes
  const updateTrayStatus = async () => {
    const status: SignerStatusUpdate = {
      isRunning: isSignerRunning,
      isConnecting: isConnecting,
      loadedShare: initialData ? {
        name: initialData.name || 'Unknown',
        id: initialData.share.substring(0, 8) // Use first 8 chars as ID
      } : undefined,
      lastActivity: isSignerRunning ? new Date() : undefined
    };

    try {
      await window.electronAPI?.updateTrayStatus(status);
    } catch (error) {
      console.warn('Failed to update tray status:', error);
    }
  };

  updateTrayStatus();
}, [isSignerRunning, isConnecting, initialData]);

// Add notification for significant events
const showTrayNotification = async (message: string, options?: TrayNotificationOptions) => {
  try {
    await window.electronAPI?.showTrayNotification(message, options);
  } catch (error) {
    console.warn('Failed to show tray notification:', error);
  }
};

// Update the handleStartSigner function to include notifications
const handleStartSigner = async () => {
  try {
    // ... existing logic ...
    
    // Show notification when signer starts
    await showTrayNotification('Signer Started', {
      body: `Now signing with ${getShareInfo(groupCredential, signerSecret)?.shareName || 'share'}`
    });
    
    // ... rest of existing logic ...
  } catch (error) {
    // ... existing error handling ...
    
    await showTrayNotification('Signer Failed to Start', {
      body: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Update the handleStopSigner function
const handleStopSigner = async () => {
  try {
    // ... existing logic ...
    
    await showTrayNotification('Signer Stopped', {
      body: 'Signer has been stopped'
    });
    
    // ... rest of existing logic ...
  } catch (error) {
    // ... existing error handling ...
  }
};
```

### 5. Tray Icon Assets

**Create src/assets/tray/ directory with platform-specific icons:**

```
src/assets/tray/
├── tray-active-darwin.png     (16x16, template image)
├── tray-active-win32.png      (16x16, standard)
├── tray-active-linux.png      (16x16, standard)
├── tray-ready-darwin.png      (16x16, template image)
├── tray-ready-win32.png       (16x16, standard)
├── tray-ready-linux.png       (16x16, standard)
├── tray-inactive-darwin.png   (16x16, template image)
├── tray-inactive-win32.png    (16x16, standard)
└── tray-inactive-linux.png    (16x16, standard)
```

### 6. Package.json Updates

**Add tray icon assets to electron-builder config:**

```json
{
  "build": {
    "files": [
      "dist/**/*",
      "package.json",
      "index.html",
      "globals.css",
      "src/assets/**/*"
    ],
    // ... existing config ...
  }
}
```

### 7. Enhanced ShareManager Integration

**Update src/lib/shareManager.ts to support tray operations:**

```typescript
// Add to existing ShareManager class

/**
 * Get share names for tray menu
 */
getShareNames(): Array<{id: string, name: string}> {
  const shares = this.getShares();
  if (!shares) return [];
  
  return shares.map(share => ({
    id: share.id,
    name: share.name
  }));
}

/**
 * Get share by ID for tray operations
 */
getShareById(shareId: string): IglooShare | null {
  const shares = this.getShares();
  if (!shares) return null;
  
  return shares.find(share => share.id === shareId) || null;
}
```

### 8. Security Considerations

**Add security validation to tray operations:**

```typescript
// Add to SystemTrayManager class

private validateTrayOperation(operation: string): boolean {
  // Check if main window is authenticated (basic check)
  const webContents = this.mainWindow.webContents;
  const currentUrl = webContents.getURL();
  
  // Add authentication check logic here
  if (!currentUrl.includes('file://')) {
    return false;
  }
  
  // Add rate limiting logic here
  return true;
}

private async loadShareFromTray(share: IglooShare): Promise<void> {
  if (!this.validateTrayOperation('load-share')) {
    this.showNotification('Authentication Required', {
      body: 'Please authenticate in the main window first'
    });
    this.showWindow();
    return;
  }
  
  // Proceed with loading share
  this.showWindow();
  this.mainWindow.webContents.send('load-share-from-tray', share);
}
```

### 9. Implementation Roadmap

**Phase 1: Foundation (Week 1)**
- [ ] Modernize main.ts to use ES modules
- [ ] Create basic SystemTrayManager class
- [ ] Implement basic tray icon and menu

**Phase 2: Core Integration (Week 2)**
- [ ] Integrate with existing ShareManager
- [ ] Add IPC communication channels
- [ ] Implement window show/hide functionality

**Phase 3: Advanced Features (Week 3)**
- [ ] Add status tracking and notifications
- [ ] Implement share loading from tray
- [ ] Add platform-specific optimizations

**Phase 4: Polish and Testing (Week 4)**
- [ ] Create tray icon assets
- [ ] Add comprehensive error handling
- [ ] Implement security validations
- [ ] Add automated tests

### 10. Testing Strategy

**Create test files:**
- `src/__tests__/systemTrayManager.test.ts`
- `src/__tests__/trayIntegration.test.ts`

**Test coverage:**
- Tray icon creation and updates
- Context menu functionality
- Window management
- IPC communication
- Platform-specific behaviors
- Error handling and edge cases

## Benefits of This Refined Approach

1. **Leverages Existing Architecture**: Builds on current ShareManager and IPC patterns
2. **Maintains igloo-core Integration**: Preserves existing cryptographic operations
3. **Proper TypeScript Support**: Uses existing type definitions and patterns
4. **Security First**: Implements validation and authentication checks
5. **Cross-Platform Compatibility**: Handles platform-specific behaviors
6. **Maintainable Code**: Follows established patterns and conventions
7. **Comprehensive Testing**: Includes testing strategy for reliability

This refined plan aligns with your current codebase structure and provides a practical, implementable approach to adding system tray functionality while maintaining the security and reliability of your existing FROSTR signing implementation.