const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("ipcRenderer", {
  on: (channel, callback) =>
    ipcRenderer.on(channel, (event, argv) => callback(event, argv)),
  action: (action, args) => ipcRenderer.invoke(action, args),
  openUrl: (url) => ipcRenderer.invoke("openUrl", url),
  saveLoginData: (userName, password) =>
    ipcRenderer.invoke("saveLoginData", userName, password),
});
