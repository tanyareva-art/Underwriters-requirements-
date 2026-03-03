'use strict'

const { google } = require('googleapis')
const http = require('http')
const url = require('url')
const Store = require('electron-store')

const store = new Store()

// ── helpers ──────────────────────────────────────────────────────────────────

function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = http.createServer()
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port
      srv.close(() => resolve(port))
    })
    srv.on('error', reject)
  })
}

function buildOAuth2Client(port) {
  return new google.auth.OAuth2(
    store.get('clientId'),
    store.get('clientSecret'),
    `http://127.0.0.1:${port}/callback`
  )
}

// ── public API ────────────────────────────────────────────────────────────────

/**
 * Opens system browser → waits for the OAuth callback on a localhost server.
 * Returns { url, codePromise } so the caller can open the URL and then await
 * codePromise for { tokens, userInfo }.
 */
async function createAuthServer(domain) {
  const port = await findFreePort()
  store.set('oauthPort', port)

  const oauth2Client = buildOAuth2Client(port)

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'openid',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/spreadsheets',
    ],
    prompt: 'consent',
    // restrict to the configured workspace domain
    ...(domain ? { hd: domain } : {}),
  })

  const codePromise = new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const parsed = url.parse(req.url, true)
        if (parsed.pathname !== '/callback') { res.end(''); return }

        if (parsed.query.error) {
          res.writeHead(200, { 'Content-Type': 'text/html' })
          res.end('<html><body><h2>Authentication cancelled.</h2><p>You may close this tab.</p></body></html>')
          server.close()
          reject(new Error(parsed.query.error))
          return
        }

        const code = parsed.query.code
        if (!code) { res.end(''); return }

        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end('<html><body><h2>Authentication successful!</h2><p>You may close this tab and return to the app.</p></body></html>')
        server.close()

        const { tokens } = await oauth2Client.getToken(code)
        oauth2Client.setCredentials(tokens)

        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
        const { data: userInfo } = await oauth2.userinfo.get()

        // Domain restriction check
        if (domain) {
          const userDomain = (userInfo.email || '').split('@')[1]
          if (userDomain !== domain) {
            reject(new Error(`Access restricted to @${domain} accounts. You signed in as ${userInfo.email}.`))
            return
          }
        }

        // Persist tokens
        store.set('tokens', tokens)
        store.set('userEmail', userInfo.email)

        resolve({ tokens, userInfo })
      } catch (err) {
        server.close()
        reject(err)
      }
    })

    server.listen(port, '127.0.0.1', () => {
      // server ready – caller will open the authUrl
    })
    server.on('error', reject)

    // Timeout after 5 minutes
    setTimeout(() => {
      server.close()
      reject(new Error('OAuth timed out after 5 minutes.'))
    }, 5 * 60 * 1000)
  })

  return { url: authUrl, codePromise }
}

/**
 * Returns a fully-authenticated OAuth2 client using stored tokens.
 * Auto-refreshes expired access tokens.
 */
function getAuthenticatedClient() {
  const tokens = store.get('tokens')
  const clientId = store.get('clientId')
  const clientSecret = store.get('clientSecret')
  const port = store.get('oauthPort', 4242)

  if (!tokens || !clientId || !clientSecret) return null

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    `http://127.0.0.1:${port}/callback`
  )
  oauth2Client.setCredentials(tokens)

  // Persist any refreshed tokens
  oauth2Client.on('tokens', (newTokens) => {
    const current = store.get('tokens') || {}
    store.set('tokens', { ...current, ...newTokens })
  })

  return oauth2Client
}

module.exports = { createAuthServer, getAuthenticatedClient }
