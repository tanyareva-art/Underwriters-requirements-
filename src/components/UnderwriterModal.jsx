import { useState } from 'react'

const FIELDS = [
  { key: 'Underwriter Name',                   label: 'Underwriter Name',          required: true },
  { key: 'Agency / Brokerage',                  label: 'Agency / Brokerage' },
  { key: 'Email',                               label: 'Email',                     type: 'email' },
  { key: 'Submission Method',                   label: 'Submission Method',         placeholder: 'Email QQ / Self Quote / Website' },
  { key: 'States (Abbrev)',                     label: 'States (comma-separated)',  placeholder: 'OR, WA, NC  or  ALL STATES' },
  { key: 'Lines Written (AL/GL/PD/MTC/WC)',     label: 'Lines Written',             placeholder: 'ALL or AL, GL, PD…' },
  { key: 'Business Types Accepted',             label: 'Business Types Accepted',   placeholder: 'Dry Van, Reefer, Flatbed…' },
  { key: 'New Venture OK (Yes/No)',             label: 'New Venture OK?',           type: 'select', opts: ['', 'YES', 'NO'] },
  { key: 'Min Years in Business',               label: 'Min Years in Business',     type: 'number' },
  { key: 'Loss Runs Required (Yes/No)',         label: 'Loss Runs Required?',       type: 'select', opts: ['', 'YES', 'NO'] },
  { key: 'IFTA Required (Yes/No)',              label: 'IFTA Required?',            type: 'select', opts: ['', 'YES', 'NO'] },
  { key: 'MVR Required (Yes/No)',               label: 'MVR Required?',             type: 'select', opts: ['', 'YES', 'NO'] },
  { key: 'Driver Experience Minimum (Years)',   label: 'Driver Exp Min (yrs)',      type: 'number' },
  { key: 'Special Restrictions',               label: 'Special Restrictions',      type: 'textarea' },
  { key: 'Insurance Company names',             label: 'Insurance Company Names' },
  { key: 'Other Insurance Company names',       label: 'Other Carrier Names' },
  { key: 'Notes',                               label: 'Notes',                     type: 'textarea' },
]

export default function UnderwriterModal({ underwriter, sheetId, onSave, onClose }) {
  const [form,    setForm]    = useState(underwriter || {})
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }))

  const handleSave = async () => {
    if (!form['Underwriter Name']?.trim()) { setError('Underwriter Name is required.'); return }
    setError('')
    setSaving(true)
    try {
      await window.api.saveUnderwriter(sheetId, form, underwriter?._rowIndex || null)
      onSave()
    } catch (e) {
      setError(e.message || 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">
            {underwriter ? 'Edit Underwriter' : 'Add Underwriter'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        <div className="overflow-y-auto flex-1 p-6">
          <div className="grid grid-cols-2 gap-4">
            {FIELDS.map(f => (
              <div key={f.key} className={f.type === 'textarea' ? 'col-span-2' : ''}>
                <label className="label">{f.label}{f.required && <span className="text-red-500 ml-0.5">*</span>}</label>
                {f.type === 'select' ? (
                  <select className="input" value={form[f.key] || ''} onChange={set(f.key)}>
                    {f.opts.map(o => <option key={o} value={o}>{o || '— Select —'}</option>)}
                  </select>
                ) : f.type === 'textarea' ? (
                  <textarea className="input resize-none" rows={3} value={form[f.key] || ''} onChange={set(f.key)} placeholder={f.placeholder} />
                ) : (
                  <input type={f.type || 'text'} className="input" value={form[f.key] || ''} onChange={set(f.key)} placeholder={f.placeholder} />
                )}
              </div>
            ))}
          </div>

          {error && <div className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button onClick={onClose}    className="btn-secondary">Cancel</button>
          <button onClick={handleSave} className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
