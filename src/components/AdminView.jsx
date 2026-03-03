import { useState, useEffect, useCallback } from 'react'
import UnderwriterModal from './UnderwriterModal'

export default function AdminView({ sheetId, userEmail }) {
  const [underwriters,  setUnderwriters]  = useState([])
  const [filtered,      setFiltered]      = useState([])
  const [search,        setSearch]        = useState('')
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState('')
  const [modalUW,       setModalUW]       = useState(null)  // null = closed, {} = new, {…} = edit
  const [showModal,     setShowModal]     = useState(false)
  const [deleting,      setDeleting]      = useState(null)
  const [lobText,       setLobText]       = useState('')
  const [adminsText,    setAdminsText]    = useState('')
  const [settingsSaved, setSettingsSaved] = useState(false)
  const [activeTab,     setActiveTab]     = useState('underwriters')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [uw, settings] = await Promise.all([
        window.api.getUnderwriters(sheetId),
        window.api.getSheetSettings(sheetId),
      ])
      setUnderwriters(uw)
      setLobText(settings.lob_options || '')
      setAdminsText(settings.admins || '')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [sheetId])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(q
      ? underwriters.filter(u => JSON.stringify(u).toLowerCase().includes(q))
      : underwriters
    )
  }, [search, underwriters])

  const openAdd  = () => { setModalUW({});    setShowModal(true) }
  const openEdit = (uw) => { setModalUW(uw); setShowModal(true) }
  const closeModal = () => { setShowModal(false); setModalUW(null) }

  const handleSaved = async () => {
    closeModal()
    await loadData()
  }

  const handleDelete = async (uw) => {
    if (!window.confirm(`Delete "${uw['Underwriter Name']}"? This cannot be undone.`)) return
    setDeleting(uw._rowIndex)
    try {
      await window.api.deleteUnderwriter(sheetId, uw._rowIndex)
      await loadData()
    } catch (e) {
      setError(e.message)
    } finally {
      setDeleting(null)
    }
  }

  const saveSheetSettings = async () => {
    try {
      await Promise.all([
        window.api.upsertSheetSetting(sheetId, 'lob_options', lobText),
        window.api.upsertSheetSetting(sheetId, 'admins', adminsText),
      ])
      setSettingsSaved(true)
      setTimeout(() => setSettingsSaved(false), 2500)
    } catch (e) {
      setError(e.message)
    }
  }

  if (loading) return <div className="flex h-full items-center justify-center text-gray-400">Loading…</div>

  return (
    <div className="flex h-full overflow-hidden flex-col">
      {/* Tab bar */}
      <div className="bg-white border-b border-gray-200 px-6 flex gap-4 text-sm font-medium">
        {[['underwriters', 'Underwriters'], ['settings', 'Settings']].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`py-3 border-b-2 transition-colors ${activeTab === id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* ── Underwriters tab ──────────────────────────────────────────────── */}
      {activeTab === 'underwriters' && (
        <div className="flex-1 flex flex-col overflow-hidden p-6 gap-4">
          <div className="flex items-center gap-3">
            <input
              type="text"
              className="input flex-1"
              placeholder="Search underwriters…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <span className="text-sm text-gray-500 whitespace-nowrap">{filtered.length} / {underwriters.length}</span>
            <button onClick={openAdd} className="btn-primary whitespace-nowrap">+ Add Underwriter</button>
          </div>

          <div className="flex-1 overflow-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  {['Name', 'Agency', 'Email', 'States', 'New Venture', 'Min Yrs', 'Requirements', 'Actions'].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 border-b border-gray-200 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-12 text-gray-400">No underwriters found.</td></tr>
                )}
                {filtered.map((uw, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-blue-50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-gray-900 align-top">{uw['Underwriter Name']}</td>
                    <td className="px-4 py-3 text-gray-600 align-top">{uw['Agency / Brokerage']}</td>
                    <td className="px-4 py-3 text-gray-600 align-top text-xs">
                      {uw['Email'] && <a href={`mailto:${uw['Email']}`} className="text-blue-600 hover:underline">{uw['Email']}</a>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 align-top max-w-[130px]">{uw['States (Abbrev)']}</td>
                    <td className="px-4 py-3 text-xs align-top">
                      <span className={`inline-block px-2 py-0.5 rounded-full font-medium ${uw['New Venture OK (Yes/No)'] === 'YES' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {uw['New Venture OK (Yes/No)'] || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 align-top">{uw['Min Years in Business'] || '0'}</td>
                    <td className="px-4 py-3 text-xs text-gray-600 align-top whitespace-nowrap">
                      LR:{uw['Loss Runs Required (Yes/No)']||'—'} IFTA:{uw['IFTA Required (Yes/No)']||'—'} MVR:{uw['MVR Required (Yes/No)']||'—'}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(uw)} className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium">Edit</button>
                        <button
                          onClick={() => handleDelete(uw)}
                          disabled={deleting === uw._rowIndex}
                          className="btn-danger"
                        >
                          {deleting === uw._rowIndex ? '…' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Settings tab ──────────────────────────────────────────────────── */}
      {activeTab === 'settings' && (
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-2xl space-y-6">
            <div className="card">
              <h3 className="font-semibold text-gray-800 mb-3">Equipment / LOB Dropdown Options</h3>
              <p className="text-xs text-gray-500 mb-3">
                Comma-separated list shown in the Equipment/LOB filter dropdown for all employees.
              </p>
              <textarea
                className="input resize-none font-mono text-xs"
                rows={5}
                value={lobText}
                onChange={e => setLobText(e.target.value)}
              />
            </div>

            <div className="card">
              <h3 className="font-semibold text-gray-800 mb-3">Admin Emails</h3>
              <p className="text-xs text-gray-500 mb-3">
                Comma-separated list of email addresses that have Admin access (can add/edit/delete underwriters and modify settings).
              </p>
              <textarea
                className="input resize-none text-sm"
                rows={3}
                placeholder="admin@company.com, another@company.com"
                value={adminsText}
                onChange={e => setAdminsText(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-3">
              <button onClick={saveSheetSettings} className="btn-primary">Save Settings</button>
              {settingsSaved && <span className="text-green-600 text-sm font-medium">✓ Saved to Google Sheet</span>}
            </div>

            <div className="card bg-amber-50 border-amber-200">
              <p className="text-xs text-amber-800">
                <strong>Note:</strong> After adding a new admin, they must sign out and sign back in for the change to take effect.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <UnderwriterModal
          underwriter={Object.keys(modalUW).length > 0 ? modalUW : null}
          sheetId={sheetId}
          onSave={handleSaved}
          onClose={closeModal}
        />
      )}
    </div>
  )
}
