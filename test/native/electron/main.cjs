const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');

let completed = false;

function finish(result) {
  if (completed) return;
  completed = true;
  process.stdout.write(`DAP_NATIVE_SMOKE:${JSON.stringify(result)}\n`);
  app.exit(result && result.ok ? 0 : 1);
}

ipcMain.on('native-smoke:report', (_event, result) => finish(result));

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    show: false,
    width: 640,
    height: 480,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });
  window.webContents.on('did-fail-load', (_event, code, description) => {
    finish({ ok: false, host: 'electron', error: `${code}: ${description}` });
  });
  window.webContents.on('console-message', details => {
    process.stderr.write(
      `ELECTRON_RENDERER[${details.level}]: ${details.message}\n`
    );
  });
  const query = {
    host: 'electron',
    proxy: process.env.DAP_SMOKE_PROXY,
    upstream: process.env.DAP_SMOKE_UPSTREAM,
  };
  await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), {
    query,
  });
});

setTimeout(
  () =>
    finish({
      ok: false,
      host: 'electron',
      error: 'Electron smoke timed out after 30 seconds',
    }),
  30_000
).unref();
