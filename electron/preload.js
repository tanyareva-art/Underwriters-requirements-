'use strict'

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  // ── auth / settings ─────────────────────────────────────────────────────────
  getLocalSettings:   ()           => ipcRenderer.invoke('get-local-settings'),
  saveLocalSettings:  (s)          => ipcRenderer.invoke('save-local-settings', s),
  startOAuth:         (cfg)        => ipcRenderer.invoke('start-oauth', cfg),
  logout:             ()           => ipcRenderer.invoke('logout'),

  // ── sheet setup (first run) ─────────────────────────────────────────────────
  setupSheet:         (sheetId)    => ipcRenderer.invoke('setup-sheet', sheetId),
  importCSV:          (sheetId)    => ipcRenderer.invoke('import-csv', sheetId),

  // ── underwriters ─────────────────────────────────────────────────────────────
  getUnderwriters:    (sheetId)    => ipcRenderer.invoke('get-underwriters', sheetId),
  saveUnderwriter:    (s, d, r)    => ipcRenderer.invoke('save-underwriter', s, d, r),
  deleteUnderwriter:  (s, r)       => ipcRenderer.invoke('delete-underwriter', s, r),

  // ── sheet settings tab ──────────────────────────────────────────────────────
  getSheetSettings:   (sheetId)    => ipcRenderer.invoke('get-sheet-settings', sheetId),
  upsertSheetSetting: (s, k, v)    => ipcRenderer.invoke('upsert-sheet-setting', s, k, v),

  // ── audit log ───────────────────────────────────────────────────────────────
  logSearch:          (s, entry)   => ipcRenderer.invoke('log-search', s, entry),
})
