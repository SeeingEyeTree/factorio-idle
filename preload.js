'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('fileAPI', {
  saveGame:       (filename, json) => ipcRenderer.invoke('save-game', filename, json),
  loadGame:       (filename)       => ipcRenderer.invoke('load-game', filename),
  listSaves:      ()               => ipcRenderer.invoke('list-saves'),
  deleteSave:     (filename)       => ipcRenderer.invoke('delete-save', filename),
  showSaveDialog: (defaultName)    => ipcRenderer.invoke('show-save-dialog', defaultName),
  showOpenDialog: ()               => ipcRenderer.invoke('show-open-dialog'),
  saveScript:     (content)        => ipcRenderer.invoke('save-script', content),
  importScript:   ()               => ipcRenderer.invoke('import-script'),
  saveMeta:       (json)           => ipcRenderer.invoke('save-meta', json),
  loadMeta:       ()               => ipcRenderer.invoke('load-meta'),
  savePerf:       (text, filename) => ipcRenderer.invoke('save-perf', text, filename),
});
