// The Settings window: a normal, focusable window (the island itself never takes focus).
const path = require('path');
const { BrowserWindow, ipcMain } = require('electron');

let win = null;

function open() {
  if (win && !win.isDestroyed()) {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
    win.moveTop();
    return;
  }
  win = new BrowserWindow({
    width: 760,
    height: 560,
    minWidth: 640,
    minHeight: 480,
    center: true,
    frame: false,
    show: false,
    backgroundColor: '#0f0f15',
    title: 'YOVY-NAV Settings',
    icon: path.join(__dirname, 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'prefs', 'preload.js'),
      contextIsolation: true,
      sandbox: false,
    },
  });
  win.setMenu(null);
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.loadFile(path.join(__dirname, 'prefs', 'index.html'));
  win.once('ready-to-show', () => {
    if (win && !win.isDestroyed()) {
      win.show();
      win.focus();
    }
  });
  // Fallback to guarantee window is visible and focused
  setTimeout(() => {
    if (win && !win.isDestroyed() && !win.isVisible()) {
      win.show();
      win.focus();
    }
  }, 300);
  win.on('closed', () => { win = null; });
}

function send(channel, data) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, data);
}

ipcMain.on('prefs-window', (e, action) => {
  const w = BrowserWindow.fromWebContents(e.sender);
  if (!w || w !== win) return;
  if (action === 'close') w.close();
  else if (action === 'minimize') w.minimize();
});

module.exports = { open, send };
