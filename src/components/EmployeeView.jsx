import { useState, useEffect, useCallback, useRef } from 'react'
import { matchUnderwriters } from '../lib/matcher'
import { copyResultsToClipboard, downloadCSV } from '../lib/export'

const REQ = ['', 'YES', 'NO']
const NV  = ['', 'YES', 'NO']

const EMPTY_FILTERS = {
  state: '', lob: '', newVenture: '', yearsInBusiness: '',
  driverExp: '', lossRuns: '', ifta: '', mvr: '', keywords: '',
}

function ToggleGroup({ label, value, onChange, options = REQ }) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex gap-1">
        {options.map(opt => (
          <button
            key={opt}
            onClick={() => onChange(value === opt ? '' : opt)}
            className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors ${
              value === opt
                ? opt === 'NO' ? 'bg-red-100 border-red-400 text-red-700'
                  : opt === 'YES' ? 'bg-green-100 border-green-400 text-green-700'
                  : 'bg-blue-100 border-blue-400 text-blue-700'
                : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}
          >
            {opt || 'Any'}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function EmployeeView({ sheetId, userEmail }) {
  const [allUW,    setAllUW]    = useState([])
  const [lobOpts,  setLobOpts]  = useState([])
  const [stateOpts, setStateOpts] = useState([])
  const [filters,  setFilters]  = useState(EMPTY_FILTERS)
  const [results,  setResults]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [copied,   setCopied]   = useState(false)
  const [expanded, setExpanded] = useState({})
  const debounceRef = useRef(null)

  // Load data once on mount
  useEffect(() => {
    (async () => {
      try {
        const [uw, settings] = await Promise.all([
          window.api.getUnderwriters(sheetId),
          window.api.getSheetSettings(sheetId),
        ])
        setAllUW(uw)

        // Derive state options from data
        const stateSet = new Set()
        uw.forEach(u => {
          const col = (u['States (Abbrev)'] || '').toUpperCase()
          if (!col.includes('ALL')) col.split(/[,;\n]/).forEach(s => { const t = s.trim(); if (t) stateSet.add(t) })
        })
        setStateOpts([...stateSet].sort())

        // LOB options from Settings tab
        if (settings.lob_options) setLobOpts(settings.lob_options.split(',').map(s => s.trim()).filter(Boolean))
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    })()
  }, [sheetId])

  // Re-run matcher whenever filters or data change (debounced for keywords)
  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const res = matchUnderwriters(allUW, filters)
      setResults(res)

      // Async audit log — fire and forget
      if (sheetId) {
        window.api.logSearch(sheetId, {
          timestamp:    new Date().toISOString(),
          email:        userEmail || '',
          ...filters,
          resultsCount: res.length,
        }).catch(() => {})
      }
    }, 250)
  }, [filters, allUW, sheetId, userEmail])

  const setF = (key) => (val) => setFilters(f => ({ ...f, [key]: val }))
  const clearFilters = () => setFilters(EMPTY_FILTERS)
  const toggleExpand = (idx) => setExpanded(e => ({ ...e, [idx]: !e[idx] }))

  const handleCopy = () => {
    copyResultsToClipboard(results)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return <div className="flex h-full items-center justify-center text-gray-400">Loading underwriters…</div>
  if (error)   return <div className="flex h-full items-center justify-center text-red-500">{error}</div>

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Sidebar filters ─────────────────────────────────────────────────── */}
      <aside className="w-72 shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-y-auto">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <span className="font-semibold text-gray-800">Filters</span>
          <button onClick={clearFilters} className="text-xs text-blue-600 hover:underline">Clear all</button>
        </div>

        <div className="p-4 space-y-4">
          {/* State */}
          <div>
            <label className="label">State</label>
            <select className="input" value={filters.state} onChange={e => setF('state')(e.target.value)}>
              <option value="">— Any state —</option>
              {stateOpts.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* LOB / Equipment */}
          <div>
            <label className="label">Equipment / LOB</label>
            <select className="input" value={filters.lob} onChange={e => setF('lob')(e.target.value)}>
              <option value="">— Any —</option>
              {lobOpts.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>

          {/* New Venture */}
          <ToggleGroup label="New Venture?" value={filters.newVenture} onChange={setF('newVenture')} options={NV} />

          {/* Years in Business */}
          <div>
            <label className="label">Years in Business</label>
            <input type="number" min="0" className="input" placeholder="e.g. 2"
              value={filters.yearsInBusiness} onChange={e => setF('yearsInBusiness')(e.target.value)} />
          </div>

          {/* Driver Experience */}
          <div>
            <label className="label">Driver CDL Experience (yrs)</label>
            <input type="number" min="0" className="input" placeholder="e.g. 2"
              value={filters.driverExp} onChange={e => setF('driverExp')(e.target.value)} />
          </div>

          <hr className="border-gray-100" />

          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Client has available:</p>

          {/* Loss Runs */}
          <ToggleGroup label="Loss Runs" value={filters.lossRuns} onChange={setF('lossRuns')} />

          {/* IFTA */}
          <ToggleGroup label="IFTA Reports" value={filters.ifta} onChange={setF('ifta')} />

          {/* MVR */}
          <ToggleGroup label="MVRs (all drivers)" value={filters.mvr} onChange={setF('mvr')} />

          <hr className="border-gray-100" />

          {/* Keywords */}
          <div>
            <label className="label">Keywords</label>
            <input type="text" className="input" placeholder="e.g. Canal, flatbed…"
              value={filters.keywords} onChange={e => setF('keywords')(e.target.value)} />
          </div>
        </div>
      </aside>

      {/* ── Results area ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="px-5 py-3 bg-white border-b border-gray-200 flex items-center justify-between">
          <span className="text-sm text-gray-600">
            <strong className="text-gray-900">{results.length}</strong> underwriter{results.length !== 1 ? 's' : ''} matched
          </span>
          <div className="flex gap-2">
            <button onClick={handleCopy}      className="btn-secondary text-xs" disabled={!results.length}>
              {copied ? '✓ Copied!' : '📋 Copy CSV'}
            </button>
            <button onClick={() => downloadCSV(results)} className="btn-secondary text-xs" disabled={!results.length}>
              ⬇ Export CSV
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {results.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
              <span className="text-4xl">🔎</span>
              <p>No underwriters match the current filters.</p>
              <button onClick={clearFilters} className="text-blue-500 text-sm hover:underline">Clear all filters</button>
            </div>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  {['Underwriter / Contact','Method','States','LOBs / Equipment','Requirements','Why Matched','Warnings'].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 border-b border-gray-200 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((r, idx) => (
                  <tr key={idx} className={`border-b border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors`}>
                    {/* Underwriter */}
                    <td className="px-4 py-3 align-top">
                      <div className="font-semibold text-gray-900">{r['Underwriter Name']}</div>
                      {r['Agency / Brokerage'] && <div className="text-xs text-gray-500">{r['Agency / Brokerage']}</div>}
                      {r['Email'] && <a href={`mailto:${r['Email']}`} className="text-xs text-blue-600 hover:underline">{r['Email']}</a>}
                    </td>
                    {/* Method */}
                    <td className="px-4 py-3 align-top text-xs text-gray-600 whitespace-nowrap">{r['Submission Method']}</td>
                    {/* States */}
                    <td className="px-4 py-3 align-top text-xs text-gray-700 max-w-[120px]">
                      <span title={r['States (Abbrev)']}>{r['States (Abbrev)']}</span>
                    </td>
                    {/* LOBs */}
                    <td className="px-4 py-3 align-top text-xs text-gray-700 max-w-[160px]">
                      <div>{r['Lines Written (AL/GL/PD/MTC/WC)']}</div>
                      {r['Business Types Accepted'] && <div className="text-gray-400 mt-0.5">{r['Business Types Accepted']}</div>}
                    </td>
                    {/* Requirements summary */}
                    <td className="px-4 py-3 align-top text-xs whitespace-nowrap">
                      <div className="space-y-0.5">
                        <div>NV: <strong>{r['New Venture OK (Yes/No)'] || '—'}</strong></div>
                        <div>Min Yrs: <strong>{r['Min Years in Business'] || '0'}</strong></div>
                        <div>Loss: {r['Loss Runs Required (Yes/No)'] || 'NO'} | IFTA: {r['IFTA Required (Yes/No)'] || 'NO'} | MVR: {r['MVR Required (Yes/No)'] || 'NO'}</div>
                        {r['Driver Experience Minimum (Years)'] && <div>CDL: {r['Driver Experience Minimum (Years)']} yrs</div>}
                      </div>
                    </td>
                    {/* Why Matched */}
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-wrap gap-1">
                        {r._whyMatched.map((w, i) => <span key={i} className="pill-green">{w}</span>)}
                      </div>
                    </td>
                    {/* Warnings */}
                    <td className="px-4 py-3 align-top max-w-[200px]">
                      {r._warnings.length > 0 ? (
                        <>
                          <div className="flex flex-wrap gap-1">
                            {(expanded[idx] ? r._warnings : r._warnings.slice(0, 2)).map((w, i) => (
                              <span key={i} className="pill-amber block w-full">{w}</span>
                            ))}
                          </div>
                          {r._warnings.length > 2 && (
                            <button onClick={() => toggleExpand(idx)} className="text-xs text-blue-500 hover:underline mt-1">
                              {expanded[idx] ? 'Show less' : `+${r._warnings.length - 2} more`}
                            </button>
                          )}
                        </>
                      ) : (
                        <span className="text-green-600 text-xs">✓ No warnings</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
