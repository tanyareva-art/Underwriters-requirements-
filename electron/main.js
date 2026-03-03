'use strict'

const { app, BrowserWindow, ipcMain, shell } = require('electron')
const path = require('path')
const Store = require('electron-store')
const { createAuthServer, getAuthenticatedClient } = require('./auth')
const { SheetsService } = require('./sheets')

const store = new Store()

// ── window ───────────────────────────────────────────────────────────────────

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    titleBarStyle: 'default',
    title: 'Underwriter Decision Tool',
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })

// ── helper: get service or throw ─────────────────────────────────────────────

function getService() {
  const auth = getAuthenticatedClient()
  if (!auth) throw new Error('Not authenticated. Please sign in.')
  return new SheetsService(auth)
}

// ── local settings ────────────────────────────────────────────────────────────

ipcMain.handle('get-local-settings', () => ({
  clientId:  store.get('clientId'),
  clientSecret: store.get('clientSecret'),
  domain:    store.get('domain'),
  sheetId:   store.get('sheetId'),
  userEmail: store.get('userEmail'),
  isAdmin:   store.get('isAdmin', false),
  isSetup:   !!store.get('sheetId'),
}))

ipcMain.handle('save-local-settings', (_, settings) => {
  if (settings.clientId)     store.set('clientId',     settings.clientId)
  if (settings.clientSecret) store.set('clientSecret', settings.clientSecret)
  if (settings.domain)       store.set('domain',       settings.domain)
  if (settings.sheetId)      store.set('sheetId',      settings.sheetId)
})

// ── auth ─────────────────────────────────────────────────────────────────────

ipcMain.handle('start-oauth', async (_, { clientId, clientSecret, domain }) => {
  store.set('clientId',     clientId)
  store.set('clientSecret', clientSecret)
  if (domain) store.set('domain', domain)

  const { url, codePromise } = await createAuthServer(domain || '')
  shell.openExternal(url)

  const { userInfo } = await codePromise

  // Check admin status from sheet if sheetId already configured
  const sheetId = store.get('sheetId')
  let isAdmin = false
  if (sheetId) {
    try {
      const svc = getService()
      const settings = await svc.getSheetSettings(sheetId)
      const admins = (settings.admins || '').split(',').map(e => e.trim().toLowerCase())
      isAdmin = admins.includes(userInfo.email.toLowerCase())
    } catch (_err) { /* ignore on first run */ }
  }
  store.set('isAdmin', isAdmin)

  return { email: userInfo.email, isAdmin }
})

ipcMain.handle('logout', () => {
  store.delete('tokens')
  store.delete('userEmail')
  store.set('isAdmin', false)
})

// ── sheet setup (first run) ───────────────────────────────────────────────────

ipcMain.handle('setup-sheet', async (_, sheetId) => {
  const svc = getService()
  await svc.initializeSheet(sheetId)
  store.set('sheetId', sheetId)
  return { ok: true }
})

ipcMain.handle('import-csv', async (_, sheetId) => {
  const svc = getService()
  const csvPath = app.isPackaged
    ? path.join(process.resourcesPath, 'underwriters.csv')
    : path.join(app.getAppPath(), 'data', 'underwriters.csv')
  const count = await svc.importCSV(sheetId, csvPath)
  return { count }
})

// ── underwriters ──────────────────────────────────────────────────────────────

ipcMain.handle('get-underwriters', async (_, sheetId) => {
  return getService().getUnderwriters(sheetId)
})

ipcMain.handle('save-underwriter', async (_, sheetId, uwData, rowIndex) => {
  await getService().saveUnderwriter(sheetId, uwData, rowIndex)
  return { ok: true }
})

ipcMain.handle('delete-underwriter', async (_, sheetId, rowIndex) => {
  await getService().deleteUnderwriter(sheetId, rowIndex)
  return { ok: true }
})

// ── sheet settings tab ────────────────────────────────────────────────────────

ipcMain.handle('get-sheet-settings', async (_, sheetId) => {
  return getService().getSheetSettings(sheetId)
})

ipcMain.handle('upsert-sheet-setting', async (_, sheetId, key, value) => {
  await getService().upsertSheetSetting(sheetId, key, value)
  return { ok: true }
})

// ── audit log ─────────────────────────────────────────────────────────────────

ipcMain.handle('log-search', async (_, sheetId, entry) => {
  // No client PII — entry contains only filter values and result count
  try {
    await getService().logSearch(sheetId, entry)
  } catch (_err) {
    // Non-fatal — don't let logging break the UX
  }
  return { ok: true }
})
