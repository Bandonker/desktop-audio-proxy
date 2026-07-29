import { app, BrowserWindow, ipcMain } from 'electron';
import { startProxyServer } from 'desktop-audio-proxy/server';
import path from 'node:path';

const PROXY_URL_CHANNEL = 'desktop-audio-proxy:get-url';
let mainWindow;
let proxyServer;
let stoppingProxy = false;

async function createWindow() {
  proxyServer = await startProxyServer({
    host: '127.0.0.1',
    port: 0,
    corsOrigins: ['null', 'http://localhost:5173'],
    allowedHosts: ['*.somafm.com'],
    allowPrivateAddresses: false,
    enableLogging: process.env.NODE_ENV === 'development',
  });

  mainWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(app.getAppPath(), 'examples', 'electron-preload.cjs'),
    },
  });

  await mainWindow.loadFile('index.html');
}

ipcMain.handle(PROXY_URL_CHANNEL, event => {
  if (
    !mainWindow ||
    event.sender !== mainWindow.webContents ||
    event.senderFrame !== mainWindow.webContents.mainFrame ||
    !proxyServer
  ) {
    throw new Error('Untrusted proxy URL request');
  }
  return proxyServer.getProxyUrl();
});

app
  .whenReady()
  .then(createWindow)
  .catch(error => {
    console.error('Unable to start the Electron audio proxy:', error);
    app.quit();
  });

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', event => {
  if (!proxyServer || stoppingProxy) return;

  event.preventDefault();
  stoppingProxy = true;
  void proxyServer.stop().finally(() => {
    proxyServer = undefined;
    app.quit();
  });
});
