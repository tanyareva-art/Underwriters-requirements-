// ═══════════════════════════════════════════════════════════════════════════════
// Underwriter Decision Tool  —  Google Apps Script Backend  (Code.gs)
// ═══════════════════════════════════════════════════════════════════════════════

var TABS = {
  UNDERWRITERS : 'Underwriters',
  SETTINGS     : 'Settings',
  LOGS         : 'SearchLogs'
};

var UW_HEADERS = [
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
  'Notes'
];

var LOG_HEADERS = [
  'Timestamp', 'Employee Email', 'State', 'LOB', 'New Venture',
  'Years in Business', 'Driver Exp', 'Loss Runs', 'IFTA', 'MVR',
  'Keywords', 'Results Count'
];

var DEFAULT_LOB_OPTIONS =
  'AL,GL,PD,MTC,WC,' +
  'Auto Haulers,Appliance Delivery,Box Truck,Cargo Vans,Contractors,' +
  'Dry Van,Dump,Equipment,Excavation,Expediters,Flatbed,For Hire,' +
  'Household Movers,Limousines,Moving,Reefer,Straight Trucks,Taxi,Towing';

// ── Custom menu ───────────────────────────────────────────────────────────────

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Underwriter Tool')
    .addItem('Open Sidebar', 'openSidebar')
    .addSeparator()
    .addItem('Setup / Initialize Tabs', 'setupTool')
    .addItem('Import underwriters.csv from Drive', 'importFromDriveFile')
    .addToUi();
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function openSidebar() {
  var html = HtmlService
    .createHtmlOutputFromFile('Sidebar')
    .setTitle('Underwriter Tool');
  SpreadsheetApp.getUi().showSidebar(html);
}

// ── Data access (called from sidebar via google.script.run) ──────────────────

/**
 * Returns all data the sidebar needs in a single server round-trip.
 */
function getInitialData() {
  var ss           = SpreadsheetApp.getActive();
  var underwriters = getUnderwriters_(ss);
  var lobOptions   = getLobOptions_(ss);
  var stateOptions = deriveStateOptions_(underwriters);
  var userEmail    = Session.getActiveUser().getEmail();

  return {
    underwriters : underwriters,
    lobOptions   : lobOptions,
    stateOptions : stateOptions,
    userEmail    : userEmail,
    setupRequired: underwriters.length === 0
  };
}

function getUnderwriters_(ss) {
  var sheet = ss.getSheetByName(TABS.UNDERWRITERS);
  if (!sheet) return [];

  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  var headers = data[0].map(function(h) { return h.toString().trim(); });

  return data.slice(1)
    .map(function(row) {
      var obj = {};
      headers.forEach(function(h, i) {
        obj[h] = (row[i] != null ? row[i].toString().trim() : '');
      });
      return obj;
    })
    .filter(function(r) { return r['Underwriter Name']; });
}

function getLobOptions_(ss) {
  var sheet = ss.getSheetByName(TABS.SETTINGS);
  if (!sheet) return DEFAULT_LOB_OPTIONS.split(',').map(function(s) { return s.trim(); });

  var data = sheet.getDataRange().getValues();
  for (var i = 0; i < data.length; i++) {
    if (data[i][0] === 'lob_options') {
      var val = data[i][1] ? data[i][1].toString() : DEFAULT_LOB_OPTIONS;
      return val.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
    }
  }
  return DEFAULT_LOB_OPTIONS.split(',').map(function(s) { return s.trim(); });
}

function deriveStateOptions_(underwriters) {
  var set = {};
  underwriters.forEach(function(u) {
    var col = (u['States (Abbrev)'] || '').toUpperCase();
    if (col.indexOf('ALL') !== -1) return;
    col.split(/[,;\n]/).forEach(function(s) {
      var t = s.trim();
      if (t) set[t] = true;
    });
  });
  return Object.keys(set).sort();
}

// ── Audit log ─────────────────────────────────────────────────────────────────

/**
 * Appends one row to SearchLogs.
 * email comes from Session server-side (authoritative, not spoofable).
 * No client PII is stored — only filter selections and result count.
 */
function logSearch(entry) {
  try {
    var ss    = SpreadsheetApp.getActive();
    var sheet = ss.getSheetByName(TABS.LOGS);
    if (!sheet) {
      sheet = ss.insertSheet(TABS.LOGS);
      sheet.appendRow(LOG_HEADERS);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, LOG_HEADERS.length)
           .setFontWeight('bold')
           .setBackground('#e8eaf6');
    }
    sheet.appendRow([
      new Date().toISOString(),
      Session.getActiveUser().getEmail(), // server-side: authoritative
      entry.state           || '',
      entry.lob             || '',
      entry.newVenture      || '',
      entry.yearsInBusiness || '',
      entry.driverExp       || '',
      entry.lossRuns        || '',
      entry.ifta            || '',
      entry.mvr             || '',
      entry.keywords        || '',
      entry.resultsCount != null ? entry.resultsCount : ''
    ]);
  } catch (e) {
    // Non-fatal — never break the sidebar over a log failure
  }
}

// ── One-time setup ────────────────────────────────────────────────────────────

/**
 * Creates missing tabs with correct headers. Safe to re-run: never overwrites data.
 */
function setupTool() {
  var ss    = SpreadsheetApp.getActive();
  var ui    = SpreadsheetApp.getUi();
  var names = ss.getSheets().map(function(s) { return s.getName(); });
  var created = [];

  // ── Underwriters tab ──────────────────────────────────────────────────────
  if (names.indexOf(TABS.UNDERWRITERS) === -1) {
    var uwSheet = ss.insertSheet(TABS.UNDERWRITERS);
    uwSheet.appendRow(UW_HEADERS);
    uwSheet.setFrozenRows(1);
    uwSheet.getRange(1, 1, 1, UW_HEADERS.length)
           .setFontWeight('bold')
           .setBackground('#e3f2fd');
    // Widen columns for readability
    uwSheet.setColumnWidth(1, 140);  // Underwriter Name
    uwSheet.setColumnWidth(5, 180);  // States
    uwSheet.setColumnWidth(7, 200);  // Business Types
    uwSheet.setColumnWidth(14, 300); // Special Restrictions
    created.push(TABS.UNDERWRITERS);
  } else {
    // Ensure header row exists
    var uwSheet = ss.getSheetByName(TABS.UNDERWRITERS);
    var firstCell = uwSheet.getRange(1, 1).getValue();
    if (!firstCell) {
      uwSheet.getRange(1, 1, 1, UW_HEADERS.length).setValues([UW_HEADERS]);
      uwSheet.setFrozenRows(1);
    }
  }

  // ── Settings tab ──────────────────────────────────────────────────────────
  if (names.indexOf(TABS.SETTINGS) === -1) {
    var sSheet = ss.insertSheet(TABS.SETTINGS);
    sSheet.appendRow(['Key', 'Value']);
    sSheet.appendRow(['lob_options', DEFAULT_LOB_OPTIONS]);
    sSheet.appendRow(['admins', '']);
    sSheet.getRange(1, 1, 1, 2).setFontWeight('bold').setBackground('#e8f5e9');
    sSheet.setColumnWidth(1, 140);
    sSheet.setColumnWidth(2, 500);
    created.push(TABS.SETTINGS);
  }

  // ── SearchLogs tab ────────────────────────────────────────────────────────
  if (names.indexOf(TABS.LOGS) === -1) {
    var lSheet = ss.insertSheet(TABS.LOGS);
    lSheet.appendRow(LOG_HEADERS);
    lSheet.setFrozenRows(1);
    lSheet.getRange(1, 1, 1, LOG_HEADERS.length)
          .setFontWeight('bold')
          .setBackground('#fce4ec');
    created.push(TABS.LOGS);
  }

  var msg = created.length > 0
    ? 'Created tabs: ' + created.join(', ') + '.\n\n'
    : 'All tabs already exist.\n\n';
  msg += 'Next steps:\n'
       + '1. If Underwriters tab is empty, use "Import underwriters.csv from Drive"\n'
       + '   (upload the CSV to your Google Drive first), OR paste data manually.\n'
       + '2. Reload the spreadsheet to see the "Underwriter Tool" menu.\n'
       + '3. Click Underwriter Tool → Open Sidebar.';

  ui.alert('Setup Complete', msg, ui.ButtonSet.OK);
}

// ── CSV importer ──────────────────────────────────────────────────────────────

/**
 * Prompts for a file name in Google Drive, parses its CSV content,
 * and appends rows into the Underwriters tab.
 * Employees should upload underwriters.csv to their shared Drive folder first.
 */
function importFromDriveFile() {
  var ui = SpreadsheetApp.getUi();

  var resp = ui.prompt(
    'Import CSV from Google Drive',
    'Enter the exact file name in your Drive (default: underwriters.csv):',
    ui.ButtonSet.OK_CANCEL
  );
  if (resp.getSelectedButton() !== ui.Button.OK) return;

  var fileName = (resp.getResponseText() || 'underwriters.csv').trim();
  if (!fileName) fileName = 'underwriters.csv';

  var files = DriveApp.getFilesByName(fileName);
  if (!files.hasNext()) {
    ui.alert(
      'File Not Found',
      'No file named "' + fileName + '" was found in your Google Drive.\n\n' +
      'Upload the CSV to your Drive and try again.',
      ui.ButtonSet.OK
    );
    return;
  }

  var file    = files.next();
  var content = file.getBlob().getDataAsString('UTF-8');
  var count   = importCSVContent_(content);

  if (count === 0) {
    ui.alert('Import Warning', 'No data rows were found in the file. Check the CSV format.', ui.ButtonSet.OK);
  } else {
    ui.alert('Import Complete', 'Imported ' + count + ' underwriter rows into the "' + TABS.UNDERWRITERS + '" tab.', ui.ButtonSet.OK);
  }
}

/**
 * Parses CSV text and appends matching rows to the Underwriters tab.
 * Handles quoted fields with commas inside them.
 * Auto-maps columns by header name (case-sensitive match to UW_HEADERS).
 */
function importCSVContent_(csvText) {
  var lines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  lines = lines.filter(function(l) { return l.trim(); });
  if (lines.length < 2) return 0;

  var parseRow = function(line) {
    var result = [], cur = '', inQ = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === ',' && !inQ) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    result.push(cur.trim());
    return result;
  };

  var fileHeaders = parseRow(lines[0]);
  var rows = [];

  for (var i = 1; i < lines.length; i++) {
    var cells = parseRow(lines[i]);
    if (!cells[0]) continue;

    var row = UW_HEADERS.map(function(h) {
      var idx = fileHeaders.indexOf(h);
      return idx >= 0 ? (cells[idx] || '') : '';
    });

    // Skip if name column is blank
    if (!row[0]) continue;
    rows.push(row);
  }

  if (rows.length === 0) return 0;

  var ss    = SpreadsheetApp.getActive();
  var sheet = ss.getSheetByName(TABS.UNDERWRITERS);
  if (!sheet) {
    sheet = ss.insertSheet(TABS.UNDERWRITERS);
    sheet.appendRow(UW_HEADERS);
    sheet.setFrozenRows(1);
  }

  var startRow = sheet.getLastRow() + 1;
  sheet.getRange(startRow, 1, rows.length, UW_HEADERS.length).setValues(rows);
  return rows.length;
}
