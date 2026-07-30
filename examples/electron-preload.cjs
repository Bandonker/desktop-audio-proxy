const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopAudioProxy', {
  getProxyUrl: () => ipcRenderer.invoke('desktop-audio-proxy:get-url'),
});
