'use strict'

const { google } = require('googleapis')
const fs = require('fs')
const path = require('path')

// Exact column order matching the CSV
const UW_HEADERS = [
  'Underwriter Name',
  'Agency / Brokerage',
  'Email',
  'Submission Method',
  'States (Abbrev)',
  'Lines Written (AL/GL/PD/MTC/WC)',
  'Business Types Accepted',
  'New Venture OK (Yes/No)',
  'Min Years in Business',
  'Loss Runs Required (Yes/No)',
  'IFTA Required (Yes/No)',
  'MVR Required (Yes/No)',
  'Driver Experience Minimum (Years)',
  'Special Restrictions',
  'Insurance Company names',
  'Other Insurance Company names',
  'Notes',
]

const LOG_HEADERS = [
  'Timestamp', 'Employee Email', 'State', 'LOB', 'New Venture',
  'Years in Business', 'Driver Exp', 'Loss Runs', 'IFTA', 'MVR',
  'Keywords', 'Results Count',
]

const DEFAULT_LOB_OPTIONS = [
  'AL', 'GL', 'PD', 'MTC', 'WC',
  'Auto Haulers', 'Appliance Delivery', 'Box Truck', 'Cargo Vans',
  'Contractors', 'Dump', 'Dry Van', 'Equipment', 'Excavation',
  'Expediters', 'Flatbed', 'For Hire', 'Household Movers', 'Limousines',
  'Moving', 'Reefer', 'Straight Trucks', 'Taxi', 'Towing',
].join(',')

const TABS = {
  UNDERWRITERS: 'Underwriters',
  SETTINGS: 'Settings',
  SEARCH_LOGS: 'SearchLogs',
}

// ── helper ───────────────────────────────────────────────────────────────────

function rowToObj(headers, row) {
  const obj = {}
  headers.forEach((h, i) => { obj[h] = (row[i] ?? '').toString().trim() })
  return obj
}

// ── SheetsService ─────────────────────────────────────────────────────────────

class SheetsService {
  constructor(auth) {
    this.auth = auth
    this.api = google.sheets({ version: 'v4', auth })
  }

  // ── sheet init ──────────────────────────────────────────────────────────────

  async initializeSheet(sheetId) {
    // Discover existing tabs
    const { data: meta } = await this.api.spreadsheets.get({ spreadsheetId: sheetId })
    const existingTabs = meta.sheets.map(s => s.properties.title)

    // Create any missing tabs
    const toCreate = Object.values(TABS).filter(t => !existingTabs.includes(t))
    if (toCreate.length) {
      await this.api.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: {
          requests: toCreate.map(title => ({ addSheet: { properties: { title } } })),
        },
      })
    }

    // Write headers
    await this._batchSetValues(sheetId, [
      { range: `${TABS.UNDERWRITERS}!A1`, values: [UW_HEADERS] },
      {
        range: `${TABS.SETTINGS}!A1`,
        values: [
          ['Key', 'Value'],
          ['domain', ''],
          ['admins', ''],
          ['lob_options', DEFAULT_LOB_OPTIONS],
        ],
      },
      { range: `${TABS.SEARCH_LOGS}!A1`, values: [LOG_HEADERS] },
    ])
  }

  async _batchSetValues(sheetId, entries) {
    await this.api.spreadsheets.values.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        valueInputOption: 'RAW',
        data: entries.map(e => ({ range: e.range, values: e.values })),
      },
    })
  }

  // ── CSV import ──────────────────────────────────────────────────────────────

  async importCSV(sheetId, csvPath) {
    if (!fs.existsSync(csvPath)) throw new Error(`CSV not found: ${csvPath}`)
    const content = fs.readFileSync(csvPath, 'utf-8')

    // Minimal CSV parser (handles quoted commas)
    const lines = content.split(/\r?\n/).filter(l => l.trim())
    const parseRow = (line) => {
      const result = []
      let cur = '', inQ = false
      for (let i = 0; i < line.length; i++) {
        const ch = line[i]
        if (ch === '"') { inQ = !inQ }
        else if (ch === ',' && !inQ) { result.push(cur.trim()); cur = '' }
        else { cur += ch }
      }
      result.push(cur.trim())
      return result
    }

    const fileHeaders = parseRow(lines[0])
    const rows = lines.slice(1).map(l => {
      const cells = parseRow(l)
      const mapped = UW_HEADERS.map(h => {
        const idx = fileHeaders.findIndex(fh => fh.trim() === h)
        return idx >= 0 ? (cells[idx] || '') : ''
      })
      return mapped
    }).filter(r => r[0]) // skip blank rows

    await this.api.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `${TABS.UNDERWRITERS}!A2`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: rows },
    })

    return rows.length
  }

  // ── underwriters CRUD ───────────────────────────────────────────────────────

  async getUnderwriters(sheetId) {
    const { data } = await this.api.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${TABS.UNDERWRITERS}!A:Z`,
    })
    const rows = data.values || []
    if (rows.length < 2) return []
    const headers = rows[0]
    return rows.slice(1).map((row, idx) => ({
      ...rowToObj(headers, row),
      _rowIndex: idx + 2, // 1-indexed sheet row (row 1 = header)
    }))
  }

  async saveUnderwriter(sheetId, uwData, rowIndex) {
    const values = [UW_HEADERS.map(h => uwData[h] || '')]
    if (rowIndex) {
      await this.api.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${TABS.UNDERWRITERS}!A${rowIndex}`,
        valueInputOption: 'RAW',
        requestBody: { values },
      })
    } else {
      await this.api.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: `${TABS.UNDERWRITERS}!A:A`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values },
      })
    }
  }

  async deleteUnderwriter(sheetId, rowIndex) {
    const { data } = await this.api.spreadsheets.get({ spreadsheetId: sheetId })
    const uwSheet = data.sheets.find(s => s.properties.title === TABS.UNDERWRITERS)
    if (!uwSheet) throw new Error('Underwriters tab not found')
    const tabId = uwSheet.properties.sheetId

    await this.api.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId: tabId,
              dimension: 'ROWS',
              startIndex: rowIndex - 1, // 0-indexed inclusive
              endIndex: rowIndex,       // 0-indexed exclusive
            },
          },
        }],
      },
    })
  }

  // ── settings ────────────────────────────────────────────────────────────────

  async getSheetSettings(sheetId) {
    const { data } = await this.api.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${TABS.SETTINGS}!A:B`,
    })
    const rows = data.values || []
    const settings = {}
    rows.slice(1).forEach(row => { if (row[0]) settings[row[0]] = row[1] || '' })
    return settings
  }

  async upsertSheetSetting(sheetId, key, value) {
    const { data } = await this.api.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${TABS.SETTINGS}!A:A`,
    })
    const keys = (data.values || []).map(r => r[0])
    const rowIdx = keys.indexOf(key) // 0-indexed

    if (rowIdx >= 1) { // found (skip header at idx 0)
      await this.api.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${TABS.SETTINGS}!B${rowIdx + 1}`,
        valueInputOption: 'RAW',
        requestBody: { values: [[value]] },
      })
    } else {
      await this.api.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: `${TABS.SETTINGS}!A:B`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [[key, value]] },
      })
    }
  }

  // ── search logs (no PII beyond employee email) ───────────────────────────────

  async logSearch(sheetId, entry) {
    await this.api.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `${TABS.SEARCH_LOGS}!A:L`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [[
          entry.timestamp,
          entry.email,
          entry.state || '',
          entry.lob || '',
          entry.newVenture || '',
          entry.yearsInBusiness || '',
          entry.driverExp || '',
          entry.lossRuns || '',
          entry.ifta || '',
          entry.mvr || '',
          entry.keywords || '',
          entry.resultsCount ?? '',
        ]],
      },
    })
  }
}

module.exports = { SheetsService, UW_HEADERS }
