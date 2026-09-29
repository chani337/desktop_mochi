const { contextBridge, ipcRenderer, webUtils } = require('electron');
const calls = ['motions','get-installed-apps','pick-file','state','size','save','open','menu','settings','timer-start','timer-stop','walk','drag-start','drag-end','hold','release','drop','ignore','quit'];
contextBridge.exposeInMainWorld('mochi', {
  call: (name, payload) => { if (!calls.includes(name)) throw new Error('Invalid action'); return ipcRenderer.invoke('mochi:'+name, payload); },
  on: callback => { const listener = (_event, data) => callback(data); ipcRenderer.on('mochi:update', listener); return () => ipcRenderer.removeListener('mochi:update', listener); },
  filePath: file => webUtils.getPathForFile(file)
});
