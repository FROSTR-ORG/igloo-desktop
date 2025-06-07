// eslint-disable-next-line @typescript-eslint/no-require-imports
const { app, BrowserWindow, ipcMain, shell } = require('electron');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const shareManagerModule = require('./lib/shareManager');

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    icon: path.join(__dirname, '..', 'src', 'assets', 'frostr-logo-transparent.png')
  });

  // In development, use the local file
  if (process.env.NODE_ENV === 'development') {
    win.loadFile('index.html');
  } else {
    // In production, use the path relative to the app bundle
    win.loadFile(path.join(app.getAppPath(), 'index.html'));
  }

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    win.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  createWindow();
  
  // Initialize share manager
  const shareManager = new shareManagerModule.ShareManager();
  
  // Set up IPC handlers for share operations
  ipcMain.handle('get-shares', async () => {
    return shareManagerModule.getAllShares();
  });
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ipcMain.handle('save-share', async (_: any, share: any) => {
    return shareManager.saveShare(share);
  });
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ipcMain.handle('delete-share', async (_: any, shareId: string) => {
    return shareManager.deleteShare(shareId);
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ipcMain.handle('open-share-location', async (_: any, shareId: string) => {
    const filePath = shareManager.getSharePath(shareId);
    await shell.showItemInFolder(filePath);
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
