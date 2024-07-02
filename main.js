const { app, BrowserWindow, Tray, Menu, ipcMain, clipboard } = require('electron');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

let mainWindow;
let tray;
const dbPath = path.join(__dirname, 'passwords.db');
const db = new sqlite3.Database(dbPath);

function createDatabase() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS password_manager (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label VARCHAR(255) NOT NULL,
      description VARCHAR(255),
      is_active BOOLEAN DEFAULT 1
    )`);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 500,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
  createDatabase();
  createWindow();
  createTray();
});

function createTray() {
  tray = new Tray(path.join(__dirname, 'tray-icon.png'));
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open Password Manager', click: () => mainWindow.show() },
    { label: 'Quit', click: () => app.quit() }
  ]);
  tray.setToolTip('Password Manager');
  tray.setContextMenu(contextMenu);
}

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

// IPC Handlers for interacting with the database
ipcMain.handle('add-password', (event, password) => {
  return new Promise((resolve, reject) => {
    const { label, description, is_active } = password;
    db.run(`INSERT INTO password_manager (label, description, is_active) VALUES (?, ?, ?)`, [label, description, is_active], function (err) {
      if (err) {
        reject(err);
      } else {
        resolve(this.lastID);
      }
    });
  });
});

ipcMain.handle('update-password', (event, password) => {
  return new Promise((resolve, reject) => {
    const { id, label, description, is_active } = password;
    db.run(`UPDATE password_manager SET label = ?, description = ?, is_active = ? WHERE id = ?`, [label, description, is_active, id], function (err) {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
});

ipcMain.handle('get-passwords', (event, query) => {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM password_manager WHERE label LIKE ? ORDER BY id DESC LIMIT 5`, [`%${query}%`], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
});

ipcMain.handle('get-password-by-id', (event, id) => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM password_manager WHERE id = ?`, [id], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
});

ipcMain.handle('copy-to-clipboard', (event, text) => {
  clipboard.writeText(text);
});
