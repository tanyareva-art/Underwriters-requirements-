const EXPORT_COLUMNS = [
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
  'Why Matched',
  'Warnings',
]

function escapeCSV(val) {
  const s = String(val ?? '')
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function resultsToCSV(results) {
  const header = EXPORT_COLUMNS.map(escapeCSV).join(',')
  const rows = results.map(r => {
    return EXPORT_COLUMNS.map(col => {
      if (col === 'Why Matched') return escapeCSV((r._whyMatched || []).join('; '))
      if (col === 'Warnings')   return escapeCSV((r._warnings   || []).join('; '))
      return escapeCSV(r[col] ?? '')
    }).join(',')
  })
  return [header, ...rows].join('\r\n')
}

export function copyResultsToClipboard(results) {
  const csv = resultsToCSV(results)
  navigator.clipboard.writeText(csv)
}

export function downloadCSV(results, filename = 'underwriter-results.csv') {
  const csv = resultsToCSV(results)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
