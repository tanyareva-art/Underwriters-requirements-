import { useState } from 'react'

export default function Login({ onSuccess, globalError }) {
  const [clientId,     setClientId]     = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [domain,       setDomain]       = useState('')
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState(globalError || '')

  const handleSignIn = async () => {
    if (!clientId.trim() || !clientSecret.trim() || !domain.trim()) {
      setError('All three fields are required.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const result = await window.api.startOAuth({
        clientId:     clientId.trim(),
        clientSecret: clientSecret.trim(),
        domain:       domain.trim().replace(/^@/, ''),
      })
      onSuccess(result)
    } catch (e) {
      setError(e.message || 'Authentication failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-full items-center justify-center bg-gradient-to-br from-blue-900 to-blue-700 p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🔍</div>
          <h1 className="text-2xl font-bold text-gray-900">Underwriter Decision Tool</h1>
          <p className="text-sm text-gray-500 mt-1">Sign in with your company Google account</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">Google Workspace Domain</label>
            <input
              type="text"
              className="input"
              placeholder="yourcompany.com"
              value={domain}
              onChange={e => setDomain(e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-1">Only accounts from this domain can sign in</p>
          </div>

          <div>
            <label className="label">OAuth Client ID</label>
            <input
              type="text"
              className="input font-mono text-xs"
              placeholder="123456789-abc…apps.googleusercontent.com"
              value={clientId}
              onChange={e => setClientId(e.target.value)}
            />
          </div>

          <div>
            <label className="label">OAuth Client Secret</label>
            <input
              type="password"
              className="input font-mono text-xs"
              placeholder="GOCSPX-…"
              value={clientSecret}
              onChange={e => setClientSecret(e.target.value)}
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <button
            onClick={handleSignIn}
            disabled={loading}
            className="btn-primary w-full justify-center py-3 text-base"
          >
            {loading ? 'Opening browser…' : 'Sign in with Google'}
          </button>

          <p className="text-xs text-center text-gray-400">
            A browser window will open for secure Google authentication.
            <br />See <strong>SETUP_GUIDE.md</strong> for credential setup instructions.
          </p>
        </div>
      </div>
    </div>
  )
}
