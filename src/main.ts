const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const profileManagerModule = require('./lib/profileManager');

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();
  
  // Initialize profile manager
  const profileManager = new profileManagerModule.ProfileManager();
  
  // Set up IPC handlers for profile operations
  ipcMain.handle('get-profiles', async () => {
    return profileManagerModule.getAllProfiles();
  });
  
  ipcMain.handle('save-profile', async (_: any, profile: any) => {
    return profileManager.saveProfile(profile);
  });
  
  ipcMain.handle('delete-profile', async (_: any, profileId: string) => {
    return profileManager.deleteProfile(profileId);
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
