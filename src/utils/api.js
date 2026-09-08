'use strict';

import { state, FALLBACK_TOTAL } from '../state/state.js';
import { renderAll } from '../main.js';

/* ═══════════════════════════════════════════════════════════════════════════
   DYNAMIC EPISODE COUNT  (Jikan → AniList fallback)
   ═══════════════════════════════════════════════════════════════════════════ */
// AbortSignal.timeout() polyfill — not available in iOS Safari < 16.4
function fetchWithTimeout(url, options = {}, ms = 6000) {
  const ctrl = new AbortController();
  const id   = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...options, signal: ctrl.signal }).finally(() => clearTimeout(id));
}

export async function fetchTotalEpisodes() {
  // Clear any previous status while we attempt the fetch.
  // We intentionally show nothing on failure — the fallback value (last manually verified aired episode) is
  // the correct known total, so displaying an "offline" warning would just be
  // noise for users in sandboxed / restricted-network environments.
  setFetchStatus('', '');

  // ── 1. Try Jikan (MyAnimeList proxy) ─────────────────────────────────────
  try {
    const res = await fetchWithTimeout('https://api.jikan.moe/v4/anime/21/full', {}, 6000);
    if (res.ok) {
      const { data } = await res.json();
      const count = data.episodes ?? null;
      if (count && count > 0) {
        applyLiveCount(count, 'MyAnimeList');
        return;
      }
    }
  } catch (_) { /* network blocked or timed out — try next source */ }

  // ── 2. Fallback: AniList GraphQL ─────────────────────────────────────────
  try {
    const query = `{ Media(id: 21, type: ANIME) { episodes nextAiringEpisode { episode } } }`;
    const res   = await fetchWithTimeout('https://graphql.anilist.co', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ query }),
    }, 6000);
    if (res.ok) {
      const { data } = await res.json();
      const media    = data?.Media;
      // For an airing series, nextAiringEpisode.episode is the *next* episode
      // to air, so subtract 1 to get the most recent aired episode number.
      const count =
        (media?.nextAiringEpisode?.episode != null
          ? media.nextAiringEpisode.episode - 1
          : null)
        ?? media?.episodes
        ?? null;
      if (count && count > 0) {
        applyLiveCount(count, 'AniList');
        return;
      }
    }
  } catch (_) { /* both sources unreachable — fall through to silent fallback */ }

  // ── 3. Both APIs unreachable ──────────────────────────────────────────────
  // FALLBACK_TOTAL is the last manually verified aired episode count.  
  // We silently use it — no error banner needed since the data is accurate.
  state.totalEps = FALLBACK_TOTAL;
  updateTotalDependentUI();
}

export async function fetchAiringSchedule() {
  state.nextEpisode = null;
  state.nextAiringAt = null;

  try {
    const query = `{
      Media(id: 21, type: ANIME) {
        nextAiringEpisode {
          episode
          airingAt
        }
      }
    }`;

    const res = await fetchWithTimeout('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    }, 6000);

    if (!res.ok) return;

    const { data } = await res.json();
    const next = data?.Media?.nextAiringEpisode;

    if (!next?.episode || !next?.airingAt) return;

    state.nextEpisode = next.episode;

    // AniList gives Unix seconds; Date.now() uses milliseconds.
    state.nextAiringAt = next.airingAt * 1000;
  } catch (_) {
    // If AniList is unavailable, the banner simply falls back
    // to the static Part 2 information.
  }
}

/**
 * Apply a live episode count from an API response.
 * Only surfaces the status line when the API returns a count *higher* than
 * the hardcoded fallback — meaning new episodes have aired since the last
 * code update. Otherwise stays silent.
 */
function applyLiveCount(count, source) {
  state.totalEps = count;
  if (count > FALLBACK_TOTAL) {
    setFetchStatus(`Updated: ${count} eps now aired (via ${source})`, 'ok');
  } else {
    setFetchStatus('', '');
  }
  updateTotalDependentUI();
}

function setFetchStatus(msg, cls) {
  const el   = document.getElementById('fetchStatus');
  el.textContent = msg;
  el.className   = 'fetch-status' + (cls ? ' ' + cls : '');
}

function updateTotalDependentUI() {
  renderAll();
  // Update input max attribute
  const input = document.getElementById('epInput');
  if (input) input.max = state.totalEps;
}
