const { app, BrowserWindow } = require('electron');
const { createServer } = require('http');
const next = require('next');
const path = require('path');

const dev = !app.isPackaged;
const dir = app.getAppPath();
const nextApp = next({ dev, dir });
const handle = nextApp.getRequestHandler();

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false, // Don't show until ready-to-show
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadURL('http://localhost:3000');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

app.on('ready', () => {
  nextApp.prepare().then(() => {
    const server = createServer((req, res) => {
      handle(req, res);
    });

    server.listen(3000, (err) => {
      if (err) throw err;
      console.log('> Next.js server ready on http://localhost:3000');
      createWindow();
    });
  }).catch((err) => {
    console.error('Error starting Next.js:', err);
    app.quit();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function () {
  if (mainWindow === null) {
    createWindow();
  }
});
