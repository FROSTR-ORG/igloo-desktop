const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const shareManagerModule = require('./lib/shareManager');

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // Load the index.html from the app bundle
  win.loadFile(path.join(__dirname, '..', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();
  
  // Initialize share manager
  const shareManager = new shareManagerModule.ShareManager();
  
  // Set up IPC handlers for share operations
  ipcMain.handle('get-shares', async () => {
    return shareManagerModule.getAllShares();
  });
  
  ipcMain.handle('save-share', async (_: any, share: any) => {
    return shareManager.saveShare(share);
  });
  
  ipcMain.handle('delete-share', async (_: any, shareId: string) => {
    return shareManager.deleteShare(shareId);
  });

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
