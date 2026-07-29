const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', Object.freeze({}));
contextBridge.exposeInMainWorld(
  'nativeSmoke',
  Object.freeze({
    report: result => ipcRenderer.send('native-smoke:report', result),
  })
);
