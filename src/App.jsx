import { useState, useEffect, useCallback } from 'react'
import Login from './components/Login'
import Setup from './components/Setup'
import EmployeeView from './components/EmployeeView'
import AdminView from './components/AdminView'

// App states
const S = { LOADING: 'loading', LOGIN: 'login', SETUP: 'setup', EMPLOYEE: 'employee', ADMIN: 'admin' }

export default function App() {
  const [screen, setScreen]     = useState(S.LOADING)
  const [settings, setSettings] = useState(null)
  const [error, setError]       = useState('')

  const load = useCallback(async () => {
    try {
      const s = await window.api.getLocalSettings()
      setSettings(s)
      if (!s.clientId || !s.userEmail || !s.domain) { setScreen(S.LOGIN);   return }
      if (!s.isSetup)                                { setScreen(S.SETUP);   return }
      setScreen(s.isAdmin ? S.ADMIN : S.EMPLOYEE)
    } catch (e) {
      setError(e.message)
      setScreen(S.LOGIN)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleAuthSuccess = async ({ email, isAdmin }) => {
    const s = await window.api.getLocalSettings()
    setSettings(s)
    if (!s.isSetup) { setScreen(S.SETUP);   return }
    setScreen(isAdmin ? S.ADMIN : S.EMPLOYEE)
  }

  const handleSetupDone = async () => {
    const s = await window.api.getLocalSettings()
    setSettings(s)
    setScreen(s.isAdmin ? S.ADMIN : S.EMPLOYEE)
  }

  const handleLogout = async () => {
    await window.api.logout()
    setSettings(null)
    setScreen(S.LOGIN)
  }

  if (screen === S.LOADING) return (
    <div className="flex h-screen items-center justify-center text-gray-500">
      Loading…
    </div>
  )

  if (error && screen === S.LOGIN) {
    // show error banner above login
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      {screen !== S.LOGIN && screen !== S.SETUP && (
        <header className="bg-blue-900 text-white px-6 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <span className="text-lg font-bold tracking-tight">Underwriter Decision Tool</span>
            {settings?.isAdmin && (
              <div className="flex gap-2 text-sm">
                <button
                  onClick={() => setScreen(S.EMPLOYEE)}
                  className={`px-3 py-1 rounded transition-colors ${screen === S.EMPLOYEE ? 'bg-blue-600' : 'hover:bg-blue-800'}`}
                >
                  Search
                </button>
                <button
                  onClick={() => setScreen(S.ADMIN)}
                  className={`px-3 py-1 rounded transition-colors ${screen === S.ADMIN ? 'bg-blue-600' : 'hover:bg-blue-800'}`}
                >
                  Admin
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 text-sm text-blue-200">
            <span>{settings?.userEmail}</span>
            {settings?.isAdmin && <span className="bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-0.5 rounded">ADMIN</span>}
            <button onClick={handleLogout} className="hover:text-white underline ml-2">Sign out</button>
          </div>
        </header>
      )}

      {/* Body */}
      <main className="flex-1 overflow-hidden">
        {screen === S.LOGIN    && <Login    onSuccess={handleAuthSuccess} globalError={error} />}
        {screen === S.SETUP    && <Setup    sheetSettings={settings} onDone={handleSetupDone} />}
        {screen === S.EMPLOYEE && <EmployeeView sheetId={settings?.sheetId} userEmail={settings?.userEmail} />}
        {screen === S.ADMIN    && <AdminView    sheetId={settings?.sheetId} userEmail={settings?.userEmail} />}
      </main>
    </div>
  )
}
