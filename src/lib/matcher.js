// ── tokenizers ────────────────────────────────────────────────────────────────

/**
 * Split a delimited string into upper-cased tokens.
 * Handles commas, semicolons, newlines, slashes (for LOB codes like AL/GL).
 */
export function tokenize(str) {
  if (!str || !str.trim()) return []
  return str
    .split(/[,;\n/]/)
    .map(s => s.trim().toUpperCase())
    .filter(Boolean)
}

function isAllStates(tokens) {
  return tokens.includes('ALL') || tokens.includes('ALL STATES')
}

// ── individual matchers ───────────────────────────────────────────────────────

/** Returns { match, isExact } for the state filter. */
export function matchState(uwStates, userState) {
  if (!userState) return { match: true, isExact: false }
  const tokens = tokenize(uwStates)
  if (tokens.length === 0 || isAllStates(tokens)) return { match: true, isExact: false }
  const exact = tokens.includes(userState.toUpperCase().trim())
  return { match: exact, isExact: exact }
}

/**
 * Checks Lines Written AND Business Types for the LOB filter.
 * Returns { match, isExact } — isExact = true when the token was found
 * in a specific list (not ALL).
 */
export function matchLOB(uwLinesWritten, uwBusinessTypes, userLOB) {
  if (!userLOB) return { match: true, isExact: false }
  const combined = [uwLinesWritten || '', uwBusinessTypes || ''].join(',')
  const tokens = tokenize(combined)
  if (tokens.includes('ALL')) return { match: true, isExact: false }
  const exact = tokens.includes(userLOB.toUpperCase().trim())
  return { match: exact, isExact: exact }
}

/**
 * New Venture matching.
 * - userNewVenture = 'YES'  → underwriter must allow it (OK = 'YES')
 * - userNewVenture = 'NO'   → do not block
 * - blank                   → do not block
 */
export function matchNewVenture(uwOK, userNewVenture) {
  if (!userNewVenture || userNewVenture.toUpperCase() !== 'YES') return true
  return (uwOK || '').toUpperCase().trim() === 'YES'
}

/**
 * Numeric minimum — user's value must be >= underwriter's minimum.
 * Blank min = 0 (no restriction).
 */
export function matchMinimum(uwMin, userValue) {
  const min  = parseFloat(uwMin)  || 0
  const user = parseFloat(userValue) || 0
  return user >= min
}

/**
 * Requirement matching (Loss Runs / IFTA / MVR).
 * - If UW requires it (= 'YES') and user selected 'NO' → block.
 * - If UW requires it and user selected 'YES'           → pass.
 * - If UW requires it and user left blank               → pass (permissive default).
 * - If UW does not require it                           → always pass.
 */
export function matchRequirement(uwRequired, userHas) {
  if ((uwRequired || '').toUpperCase().trim() !== 'YES') return true
  if (!userHas) return true   // blank = not filtered; show the row
  return userHas.toUpperCase().trim() === 'YES'
}

// ── warning builder ───────────────────────────────────────────────────────────

export function buildWarnings(uw, filters) {
  const warnings = []

  const restrictions = (uw['Special Restrictions'] || '').trim()
  if (restrictions) warnings.push(`⚠ Restrictions: ${restrictions}`)

  if ((uw['Loss Runs Required (Yes/No)'] || '').toUpperCase().trim() === 'YES')
    warnings.push('📄 Loss runs required')
  if ((uw['IFTA Required (Yes/No)'] || '').toUpperCase().trim() === 'YES')
    warnings.push('📋 IFTA reports required')
  if ((uw['MVR Required (Yes/No)'] || '').toUpperCase().trim() === 'YES')
    warnings.push('🪪 MVR required for all drivers')

  const minYrs = parseFloat(uw['Min Years in Business']) || 0
  if (minYrs > 0) warnings.push(`🗓 Min ${minYrs} yr${minYrs !== 1 ? 's' : ''} in business`)

  const minDrv = parseFloat(uw['Driver Experience Minimum (Years)']) || 0
  if (minDrv > 0) warnings.push(`🚚 Min ${minDrv} yr${minDrv !== 1 ? 's' : ''} CDL experience`)

  const notes = (uw['Notes'] || '').trim()
  if (notes) warnings.push(`📝 ${notes}`)

  return warnings
}

// ── why-matched builder ───────────────────────────────────────────────────────

export function buildWhyMatched(uw, filters, stateResult, lobResult) {
  const reasons = []

  if (filters.state) {
    reasons.push(stateResult.isExact
      ? `✓ Covers ${filters.state} explicitly`
      : `✓ Covers all states (includes ${filters.state})`)
  }
  if (filters.lob) {
    reasons.push(lobResult.isExact
      ? `✓ Accepts: ${filters.lob}`
      : `✓ Accepts all LOBs / equipment`)
  }
  if (filters.newVenture === 'YES') reasons.push('✓ New venture OK')
  if (filters.lossRuns === 'YES')   reasons.push('✓ Loss runs available')
  if (filters.ifta     === 'YES')   reasons.push('✓ IFTA available')
  if (filters.mvr      === 'YES')   reasons.push('✓ MVR available')

  return reasons
}

// ── keyword search ────────────────────────────────────────────────────────────

function matchKeywords(uw, keywords) {
  if (!keywords || !keywords.trim()) return true
  const haystack = Object.values(uw).join(' ').toLowerCase()
  return keywords.trim().toLowerCase().split(/\s+/).every(kw => haystack.includes(kw))
}

// ── main entry point ──────────────────────────────────────────────────────────

/**
 * Filter + rank underwriters against the supplied filters.
 * Returns an array of result objects (each has _warnings, _whyMatched, _stateExact, _lobExact).
 */
export function matchUnderwriters(underwriters, filters) {
  const results = []

  for (const uw of underwriters) {
    // State
    const stateResult = matchState(uw['States (Abbrev)'], filters.state)
    if (!stateResult.match) continue

    // LOB
    const lobResult = matchLOB(
      uw['Lines Written (AL/GL/PD/MTC/WC)'],
      uw['Business Types Accepted'],
      filters.lob
    )
    if (!lobResult.match) continue

    // New Venture
    if (!matchNewVenture(uw['New Venture OK (Yes/No)'], filters.newVenture)) continue

    // Years in business
    if (!matchMinimum(uw['Min Years in Business'], filters.yearsInBusiness)) continue

    // Driver experience
    if (!matchMinimum(uw['Driver Experience Minimum (Years)'], filters.driverExp)) continue

    // Loss Runs
    if (!matchRequirement(uw['Loss Runs Required (Yes/No)'], filters.lossRuns)) continue

    // IFTA
    if (!matchRequirement(uw['IFTA Required (Yes/No)'], filters.ifta)) continue

    // MVR
    if (!matchRequirement(uw['MVR Required (Yes/No)'], filters.mvr)) continue

    // Keywords (optional full-text search)
    if (!matchKeywords(uw, filters.keywords)) continue

    const warnings    = buildWarnings(uw, filters)
    const whyMatched  = buildWhyMatched(uw, filters, stateResult, lobResult)

    results.push({
      ...uw,
      _stateExact:  stateResult.isExact,
      _lobExact:    lobResult.isExact,
      _warnings:    warnings,
      _whyMatched:  whyMatched,
    })
  }

  // ── ranking ─────────────────────────────────────────────────────────────────
  // 1. Exact state match before ALL STATES
  // 2. Exact LOB match before LOB=ALL
  // 3. Fewer warnings first
  // 4. Alphabetical by underwriter name
  results.sort((a, b) => {
    if (b._stateExact !== a._stateExact) return b._stateExact - a._stateExact
    if (b._lobExact   !== a._lobExact)   return b._lobExact   - a._lobExact
    if (a._warnings.length !== b._warnings.length) return a._warnings.length - b._warnings.length
    return (a['Underwriter Name'] || '').localeCompare(b['Underwriter Name'] || '')
  })

  return results
}
