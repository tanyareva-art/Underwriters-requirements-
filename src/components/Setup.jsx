import { useState } from 'react'

const STEPS = ['Connect Sheet', 'Initialize Tabs', 'Import Data', 'Done']

export default function Setup({ onDone }) {
  const [step,        setStep]        = useState(0)
  const [sheetId,     setSheetId]     = useState('')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')
  const [imported,    setImported]    = useState(0)

  const handleConnect = async () => {
    if (!sheetId.trim()) { setError('Sheet ID is required.'); return }
    setError('')
    setLoading(true)
    try {
      // Save sheet ID
      await window.api.saveLocalSettings({ sheetId: sheetId.trim() })
      setStep(1)

      // Initialize tabs
      await window.api.setupSheet(sheetId.trim())
      setStep(2)

      // Import bundled CSV
      const { count } = await window.api.importCSV(sheetId.trim())
      setImported(count)
      setStep(3)
    } catch (e) {
      setError(e.message || 'Setup failed.')
    } finally {
      setLoading(false)
    }
  }

  const stepClass = (i) => {
    if (i < step) return 'bg-green-500 text-white'
    if (i === step && loading) return 'bg-blue-500 text-white animate-pulse'
    if (i === step) return 'bg-blue-600 text-white'
    return 'bg-gray-200 text-gray-400'
  }

  return (
    <div className="flex h-full items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-lg">
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-2">First-run Setup</h2>
          <p className="text-sm text-gray-500 mb-6">
            Connect a Google Sheet to use as the data source. The sheet will be initialized
            with the required tabs and the bundled underwriter data will be imported.
          </p>

          {/* Step indicator */}
          <div className="flex items-center mb-8">
            {STEPS.map((label, i) => (
              <div key={i} className="flex items-center flex-1">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${stepClass(i)}`}>
                  {i < step ? '✓' : i + 1}
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1 ${i < step ? 'bg-green-400' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>

          {step < 3 && (
            <>
              {/* Sheet ID input */}
              <div className="mb-4">
                <label className="label">Google Sheet ID</label>
                <input
                  type="text"
                  className="input font-mono text-sm"
                  placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
                  value={sheetId}
                  onChange={e => setSheetId(e.target.value)}
                  disabled={loading || step > 0}
                />
                <p className="text-xs text-gray-400 mt-1">
                  Copy from the Google Sheets URL: …/spreadsheets/d/<strong>[THIS PART]</strong>/edit
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
                  {error}
                </div>
              )}

              <button
                onClick={handleConnect}
                disabled={loading || step > 0}
                className="btn-primary w-full justify-center"
              >
                {loading ? 'Setting up…' : 'Connect & Initialize'}
              </button>

              {loading && (
                <p className="text-xs text-center text-gray-400 mt-3">
                  {step === 0 && 'Connecting to sheet…'}
                  {step === 1 && 'Creating tabs (Underwriters, Settings, SearchLogs)…'}
                  {step === 2 && 'Importing underwriter data…'}
                </p>
              )}
            </>
          )}

          {step === 3 && (
            <div className="text-center">
              <div className="text-5xl mb-3">🎉</div>
              <p className="text-lg font-semibold text-gray-800 mb-1">Setup complete!</p>
              <p className="text-sm text-gray-500 mb-6">
                Imported <strong>{imported}</strong> underwriters into your Google Sheet.
              </p>
              <button onClick={onDone} className="btn-primary justify-center px-8">
                Open the Tool
              </button>
            </div>
          )}
        </div>

        <div className="mt-4 card text-sm text-gray-600">
          <p className="font-semibold mb-1">How to create a new Google Sheet:</p>
          <ol className="list-decimal list-inside space-y-1 text-xs">
            <li>Go to <strong>sheets.google.com</strong> and click <strong>+</strong> (Blank spreadsheet)</li>
            <li>Copy the ID from the URL bar (the long string after <code>/d/</code>)</li>
            <li>Paste it above and click Connect</li>
          </ol>
        </div>
      </div>
    </div>
  )
}
