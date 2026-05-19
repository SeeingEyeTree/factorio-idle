const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs   = require('fs');
const path = require('path');

function getSavesDir() {
  const dir = path.join(app.getPath('userData'), 'saves');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Caff-Infinit',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      backgroundThrottling: false,
    },
  });
  win.setMenuBarVisibility(false);
  win.maximize();
  win.show();
  win.loadFile('index.html');
}

function registerIpcHandlers() {
  ipcMain.handle('save-game', (_, filename, json) => {
    const savesDir = getSavesDir();
    const safeName = path.basename(filename);
    fs.writeFileSync(path.join(savesDir, safeName), json, 'utf8');
    return { ok: true };
  });

  ipcMain.handle('load-game', (_, filename) => {
    const savesDir = getSavesDir();
    const filePath = path.join(savesDir, path.basename(filename));
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath, 'utf8');
  });

  ipcMain.handle('list-saves', () => {
    const savesDir = getSavesDir();
    const files = fs.readdirSync(savesDir).filter(f => f.endsWith('.json'));
    return files.map(f => {
      const fullPath = path.join(savesDir, f);
      let savedAt = fs.statSync(fullPath).mtime.toISOString();
      try {
        const raw = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        if (raw.savedAt) savedAt = raw.savedAt;
      } catch {}
      return { name: f, savedAt };
    }).sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
  });

  ipcMain.handle('delete-save', (_, filename) => {
    const savesDir = getSavesDir();
    const filePath = path.join(savesDir, path.basename(filename));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return { ok: true };
  });

  ipcMain.handle('show-save-dialog', async (_, defaultName) => {
    const savesDir = getSavesDir();
    const result = await dialog.showSaveDialog({
      defaultPath: path.join(savesDir, defaultName ?? 'save1.json'),
      filters: [{ name: 'Save Files', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return null;
    return path.basename(result.filePath);
  });

  ipcMain.handle('show-open-dialog', async () => {
    const result = await dialog.showOpenDialog({
      filters: [{ name: 'Save Files', extensions: ['json'] }],
      properties: ['openFile'],
    });
    if (result.canceled || !result.filePaths.length) return null;
    return fs.readFileSync(result.filePaths[0], 'utf8');
  });

  ipcMain.handle('save-script', async (_, content) => {
    const result = await dialog.showSaveDialog({
      defaultPath: 'script.fscript',
      filters: [
        { name: 'Script Files', extensions: ['fscript', 'txt'] },
        { name: 'All Files',    extensions: ['*'] },
      ],
    });
    if (result.canceled || !result.filePath) return { ok: false };
    fs.writeFileSync(result.filePath, content, 'utf8');
    return { ok: true };
  });

  ipcMain.handle('import-script', async () => {
    const result = await dialog.showOpenDialog({
      filters: [
        { name: 'Script Files', extensions: ['fscript', 'txt'] },
        { name: 'All Files',    extensions: ['*'] },
      ],
      properties: ['openFile'],
    });
    if (result.canceled || !result.filePaths.length) return null;
    return fs.readFileSync(result.filePaths[0], 'utf8');
  });

  ipcMain.handle('save-meta', (_, json) => {
    const p = path.join(app.getPath('userData'), 'meta.json');
    fs.writeFileSync(p, json, 'utf8');
    return { ok: true };
  });

  ipcMain.handle('load-meta', () => {
    const p = path.join(app.getPath('userData'), 'meta.json');
    if (!fs.existsSync(p)) return null;
    return fs.readFileSync(p, 'utf8');
  });

  ipcMain.handle('save-perf', (_, text, filename) => {
    const userData = app.getPath('userData');
    let fname;
    if (filename && filename.trim()) {
      fname = path.basename(filename.trim());
      if (!fname.endsWith('.txt')) fname += '.txt';
    } else {
      let n = 1;
      while (fs.existsSync(path.join(userData, `perf_report_${n}.txt`))) n++;
      fname = `perf_report_${n}.txt`;
    }
    const p = path.join(userData, fname);
    fs.writeFileSync(p, text, 'utf8');
    return { ok: true, path: p, filename: fname };
  });
}

// ── App Lifecycle ─────────────────────────────────────────────

app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
