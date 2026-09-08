'use strict';

import { state } from '../state/state.js';
import { ARCS } from '../data/arcs.js';
import { MOVIES } from '../data/movies.js';
import { SPECIALS } from '../data/specials.js';
import { arcStatus, arcProgress, arcEnd } from '../utils/arc-helpers.js';
import { watchFillerArc, skipFillerArc, unwatchFillerArc, unskipFillerArc } from './filler-actions.js';
import { toggleMovieWatched } from './movie-grid.js';
import { toggleSpecialWatched } from './special-grid.js';
import { showToast } from './toast.js';

/* ═══════════════════════════════════════════════════════════════════════════
   ARC GRID COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * PERFORMANCE: Instead of clearing innerHTML and rebuilding every node
 * on each update, we use a two-pass keyed diffing approach:
 *
 *  Pass 1 — Build a desired node map from current filter/search/episode state.
 *  Pass 2 — Walk the live DOM.  For nodes that already exist, patch only the
 *            attributes/classes/text that changed (progress bar width, status
 *            class, badge emoji). For new nodes, create and insert them.  For
 *            obsolete nodes (filter changed), remove them.
 *
 * Each arc item gets a stable data-key attribute so we can look it up in O(1).
 */
export function renderArcGrid() {
  const ep      = state.episode;
  const grid    = document.getElementById('arcGrid');
  if (!grid) return;

  // Prevent scroll jump by locking height
  const currentHeight = grid.offsetHeight;
  if (currentHeight > 0) grid.style.minHeight = currentHeight + 'px';

  const query   = state.searchQuery.toLowerCase().trim();

  const desired = [];
  let lastSaga = '';
  const placedMovies = new Set();
  const placedSpecials = new Set();

  const isTimeline = state.mainView === 'all';
  const activeView = isTimeline ? state.timelineView : state.seriesView;

  for (const a of ARCS) {
    const st = arcStatus(a, ep);
    const isCompleted = st === 'completed';

    // 1. Tab-Specific Filtering logic
    let matchesView = false;
    if (isTimeline) {
      if (activeView === 'all') matchesView = true;
      else if (activeView === 'unwatched') matchesView = !isCompleted;
      else if (activeView === 'watched')   matchesView = isCompleted;
    } else {
      matchesView = (activeView === 'all') ||
                    (activeView === 'canon' && a.type !== 'filler') ||
                    (activeView === 'filler' && a.type === 'filler') ||
                    (activeView === 'ongoing' && a.eps[1] === null && a.type === 'canon');
    }

    const matchesSearch = !query || a.name.toLowerCase().includes(query) || a.saga.toLowerCase().includes(query);
    
    // Hide toggles only apply in their specific tab, NOT in the All (Timeline) tab
    const matchesHide = isTimeline ? true : (!state.hideCompletedArcs || !isCompleted);

    if (matchesView && matchesSearch && matchesHide) {
      if (a.saga !== lastSaga) {
        desired.push({ kind: 'divider', saga: a.saga });
        lastSaga = a.saga;
      }
      desired.push({ kind: 'arc', data: a });
    }

    // INJECT MOVIES & SPECIALS
    if (isTimeline) {
      const mediaToPlace = [];

      for (const m of MOVIES) {
        const isWatched = state.watchedMovies.has(m.id);
        
        // Use timeline filters for movies/specials too
        let matchesMediaView = false;
        if (activeView === 'all') matchesMediaView = true;
        else if (activeView === 'unwatched') matchesMediaView = !isWatched;
        else if (activeView === 'watched')   matchesMediaView = isWatched;

        if (!placedMovies.has(m.id) && m.requiredEpisode <= arcEnd(a)) {
          placedMovies.add(m.id);
          if (matchesMediaView && (!query || m.name.toLowerCase().includes(query))) mediaToPlace.push({ kind: 'movie', data: m });
        }
      }
      for (const s of SPECIALS) {
        const isWatched = state.watchedSpecials.has(s.id);

        let matchesMediaView = false;
        if (activeView === 'all') matchesMediaView = true;
        else if (activeView === 'unwatched') matchesMediaView = !isWatched;
        else if (activeView === 'watched')   matchesMediaView = isWatched;

        if (!placedSpecials.has(s.id) && s.requiredEpisode <= arcEnd(a)) {
          placedSpecials.add(s.id);
          if (matchesMediaView && (!query || s.name.toLowerCase().includes(query))) mediaToPlace.push({ kind: 'special', data: s });
        }
      }

      mediaToPlace.sort((x, y) => x.data.requiredEpisode - y.data.requiredEpisode);
      for (const item of mediaToPlace) {
        if (a.saga !== lastSaga) {
          desired.push({ kind: 'divider', saga: a.saga });
          lastSaga = a.saga;
        }
        desired.push(item);
      }
    }
  }

  const existingNodes = new Map();
  for (const child of Array.from(grid.children)) {
    const key = child.dataset.key;
    if (key) existingNodes.set(key, child);
  }

  const fragment = document.createDocumentFragment();

  if (desired.length === 0) {
    let msg = existingNodes.get('no-results');
    if (!msg) {
      msg = document.createElement('div');
      msg.className    = 'no-results';
      msg.dataset.key  = 'no-results';
      msg.textContent  = '🌊 No results match your search.';
    }
    existingNodes.delete('no-results');
    fragment.appendChild(msg);
  } else {
    for (const item of desired) {
      if (item.kind === 'divider') {
        const key = 'divider-' + item.saga;
        let node  = existingNodes.get(key);
        if (!node) {
          node = document.createElement('div');
          node.className    = 'saga-divider';
          node.dataset.key  = key;
          node.innerHTML    = `<span>${item.saga.endsWith('Saga') ? item.saga : item.saga + ' Saga'}</span>`;
        }
        existingNodes.delete(key);
        fragment.appendChild(node);

      } else if (item.kind === 'arc') {
        const a   = item.data;
        const key = 'arc-' + a.name.replace(/\s+/g, '-');
        let node  = existingNodes.get(key);
        const st = arcStatus(a, ep);
        const pg = arcProgress(a, ep);

        if (!node) { node = buildArcNode(a, st, pg, key); }
        else       { patchArcNode(node, a, st, pg); }

        existingNodes.delete(key);
        fragment.appendChild(node);

      } else if (item.kind === 'movie') {
        const m = item.data;
        const key = 'movie-' + m.id;
        let node = existingNodes.get(key);

        // NEW TIMELINE LOCK LOGIC
        let st = 'unwatched';
        if (ep < m.requiredEpisode) st = 'locked';
        else if (state.watchedMovies.has(m.id)) st = 'watched';

        if (!node) { node = buildMovieNodeInline(m, st, key); }
        else       { patchMovieNodeInline(node, m, st); }

        existingNodes.delete(key);
        fragment.appendChild(node);

      } else if (item.kind === 'special') {
        const s = item.data;
        const key = 'special-' + s.id;
        let node = existingNodes.get(key);

        // NEW TIMELINE LOCK LOGIC
        let st = 'unwatched';
        if (ep < s.requiredEpisode) st = 'locked';
        else if (state.watchedSpecials.has(s.id)) st = 'watched';

        if (!node) { node = buildSpecialNodeInline(s, st, key); }
        else       { patchSpecialNodeInline(node, s, st); }

        existingNodes.delete(key);
        fragment.appendChild(node);
      }
    }
  }

  for (const obsolete of existingNodes.values()) obsolete.remove();
  grid.appendChild(fragment);

  // Release height lock
  requestAnimationFrame(() => {
    grid.style.minHeight = '';
  });
}

/** Build a brand-new arc item node. */
function buildArcNode(a, st, pg, key) {
  const node = document.createElement('div');
  node.dataset.key  = key;
  node.setAttribute('role', 'listitem');

  const tags = [
    a.type === 'filler'   ? `<span class="tag-base filler-tag">Filler</span>`            : '',
    a.type === 'upcoming' ? `<span class="tag-base upcoming-tag">⚡ Upcoming</span>`      : '',
    (a.eps[1] === null && a.type === 'canon') ? `<span class="tag-base ongoing-tag">🔴 Ongoing</span>` : '',
    (a.type === 'filler' && state.skippedFillers.has(a.name)) ? `<span class="tag-base skip-tag">⏭ Skipped</span>` : '',
    a.movie               ? `<span class="tag-base movie-tag">🎬 ${a.movie}</span>`       : '',
  ].join('');

  let epsLabel = '';
  if (a.type === 'upcoming') {
    epsLabel = `Episodes ${a.eps[0]}+ (est.)`;
  } else if (a.eps[1] === null) {
    const endEp = arcEnd(a);
    epsLabel = endEp > a.eps[0] ? `Episodes ${a.eps[0]}–${endEp} (ongoing)` : `Episode ${a.eps[0]} (ongoing)`;
  } else {
    epsLabel = `Episodes ${a.eps[0]}–${a.eps[1]}`;
  }
  const noteClass  = a.type === 'upcoming' ? 'arc-note note-blue' : 'arc-note';
  const pctLabel   = a.type === 'upcoming' ? 'Soon' : pg + '%';
  // NEW: Hide progress bar for skipped/unmarked fillers unless currently watching
  const isWatchedFiller = a.type === 'filler' && state.watchedFillers.has(a.name);
  const hideProgress = a.type === 'filler' && st !== 'current' && !isWatchedFiller;
  const progStyle = hideProgress ? 'style="display: none;"' : '';

  node.innerHTML = `
    <div class="arc-meta">
      <div class="arc-title-row">
        <span class="arc-title">${a.icon} ${a.name}</span>
        ${tags}
      </div>
      <div class="arc-ep-row">
        <div class="arc-eps">${epsLabel}</div>
        ${a.type === 'filler' ? `
        <div class="filler-actions" style="display: flex; gap: 8px;">
          <button class="btn-filler-action" id="filler-btn-a"></button>
          <button class="btn-filler-action" id="filler-btn-b"></button>
        </div>` : ''}
      </div>
      <div class="arc-saga">${a.saga.endsWith('Saga') ? a.saga : a.saga + ' Saga'}</div>
      ${a.note ? `<div class="arc-note-row"><div class="${noteClass}">ℹ️ ${a.note}</div></div>` : ''}
    </div>
    <div class="arc-progress-mini" ${progStyle}>
      <div class="arc-bar">
        <div class="arc-bar-fill" style="width: ${pg}%"></div>
      </div>
      <div class="arc-pct-label">${pctLabel}</div>
    </div>
    <div class="arc-badge"></div>
  `;

  // Set dynamic parts via patch (keeps the update logic in one place)
  patchArcNode(node, a, st, pg);

  // Configure filler buttons based on current watched/skipped state
  if (a.type === 'filler') {
    updateFillerButtons(node, a);
  }

  // Attach click handler
  attachArcClick(node, a);

  return node;
}

/**
 * updateFillerButtons(node, arc)
 * Called on every build AND patch so buttons always reflect current state.
 *
 * Rules:
 *   Locked (prev arc not done)  → both hidden
 *   Skipped                     → Unskip only
 *   Watched                     → Unwatch only
 *   Neither, progress === 0%    → Skip only  (episode hasn't entered arc)
 *   Neither, progress > 0%      → Watched + Skip
 */
function updateFillerButtons(node, a) {
  const btns = node.querySelectorAll('.btn-filler-action');
  if (btns.length < 2) return;
  const [btnA, btnB] = btns;

  const isWatched  = state.watchedFillers.has(a.name);
  const isSkipped  = state.skippedFillers.has(a.name);
  const st         = arcStatus(a, state.episode);
  const reachable  = st === 'unlocked' || st === 'current' || st === 'completed';
  // progress > 0% means user has at least started the arc
  const hasStarted = state.episode >= a.eps[0];

  // Reset both
  [btnA, btnB].forEach(b => {
    b.className     = 'btn-filler-action';
    b.style.display = 'none';
    b.onclick       = null;
    b.textContent   = '';
  });

  if (!reachable) return;  // locked — show nothing

  if (isSkipped) {
    // Skipped → Unskip only (no episode reversal)
    btnA.className     = 'btn-filler-action action-unskip';
    btnA.style.display = 'inline-flex';
    btnA.textContent   = '↩ Unskip';
    btnA.onclick = (e) => { e.stopPropagation(); unskipFillerArc(a); };

  } else if (isWatched) {
    // Watched → Unwatch only (no episode reversal)
    btnA.className     = 'btn-filler-action action-unwatch';
    btnA.style.display = 'inline-flex';
    btnA.textContent   = 'unmark';
    btnA.onclick = (e) => { e.stopPropagation(); unwatchFillerArc(a); };

  } else if (!hasStarted) {
    // Not started (progress 0%) → Skip only, no Watched button yet
    btnA.className     = 'btn-filler-action action-skip';
    btnA.style.display = 'inline-flex';
    btnA.textContent   = '⏭ Skip';
    btnA.onclick = (e) => { e.stopPropagation(); skipFillerArc(a); };

  } else {
    // Started (progress > 0%) → Watched + Skip
    btnA.className     = 'btn-filler-action action-watch';
    btnA.style.display = 'inline-flex';
    btnA.textContent   = '+ Watched';
    btnA.onclick = (e) => { e.stopPropagation(); watchFillerArc(a); };

    btnB.className     = 'btn-filler-action action-skip';
    btnB.style.display = 'inline-flex';
    btnB.textContent   = '⏭ Skip';
    btnB.onclick = (e) => { e.stopPropagation(); skipFillerArc(a); };
  }
}

/** Patch only the dynamic parts of an existing arc node. */
function patchArcNode(node, a, st, pg) {
  // Status classes
  const isOngoing = a.eps[1] === null && a.type === 'canon';
  const base = `arc-item type-${a.type}${isOngoing ? ' ongoing' : ''}`;
  const cls  = st === 'completed' ? `${base} completed`
             : st === 'current'   ? `${base} current`
             : st === 'unlocked'  ? `${base} unlocked`
             :                      `${base} locked`;
  if (node.className !== cls) node.className = cls;
  // NEW: Update the Episode Range text dynamically!
  const epsEl = node.querySelector('.arc-eps');
  if (epsEl) {
    let epsLabel = '';
    if (a.type === 'upcoming') {
      epsLabel = `Episodes ${a.eps[0]}+ (est.)`;
    } else if (a.eps[1] === null) {
      const endEp = arcEnd(a);
      epsLabel = endEp > a.eps[0] ? `Episodes ${a.eps[0]}–${endEp} (ongoing)` : `Episode ${a.eps[0]} (ongoing)`;
    } else {
      epsLabel = `Episodes ${a.eps[0]}–${a.eps[1]}`;
    }
    if (epsEl.textContent !== epsLabel) epsEl.textContent = epsLabel;
  }
  // NEW: Hide/show filler progress bar dynamically when patching
  const isWatchedFiller = a.type === 'filler' && state.watchedFillers.has(a.name);
  const hideProgress = a.type === 'filler' && st !== 'current' && !isWatchedFiller;
  const progMini = node.querySelector('.arc-progress-mini');
  if (progMini) {
    progMini.style.display = hideProgress ? 'none' : '';
  }

  // Progress bar width
  const fill = node.querySelector('.arc-bar-fill');
  if (fill) {
    const target = a.type === 'upcoming' ? '0%' : pg + '%';
    if (fill.style.width !== target) fill.style.width = target;
  }

  // Percentage label
  const pctEl = node.querySelector('.arc-pct-label');
  if (pctEl) {
    const label = a.type === 'upcoming' ? 'Soon' : pg + '%';
    if (pctEl.textContent !== label) pctEl.textContent = label;
  }

  // Badge
  const badge = node.querySelector('.arc-badge');
  if (badge) {
    const isWatchedFiller = a.type === 'filler' && state.watchedFillers.has(a.name);
    const isSkippedFiller = a.type === 'filler' && state.skippedFillers.has(a.name);

    const icon = a.type === 'upcoming' ? '🏔️'
               : (st === 'completed' && (a.type !== 'filler' || isWatchedFiller)) ? '✅'
               : (st === 'completed' && isSkippedFiller) ? '⏭'
               : st === 'completed' && a.type === 'filler' ? '🔓'
               : st === 'current'     ? '⚡'
               : st === 'unlocked'    ? '🔓'
               :                        '🔒';
    if (badge.textContent !== icon) badge.textContent = icon;
  }

  // Re-configure filler buttons on every patch so state changes are reflected
  if (a.type === 'filler') updateFillerButtons(node, a);
}

/** Attach click handler to an arc node (idempotent — only attaches once). */
function attachArcClick(node, a) {
  if (a.type === 'upcoming') {
    node.addEventListener('click', () => {
      showToast(`🏔️ ${a.name} begins September 2026!`, 'elbaf');
    });
    return;
  }
  node.addEventListener('click', () => {
    const st = arcStatus(a, state.episode);
    if (st === 'locked') return;

    const f = a.type === 'filler';

    // NEW: Smart text for the toast notifications!
    const endEp = arcEnd(a);
    const epRange = a.eps[1] === null
      ? (endEp > a.eps[0] ? `Ep ${a.eps[0]}–${endEp} (ongoing)` : `Ep ${a.eps[0]} (ongoing)`)
      : `Ep ${a.eps[0]}–${endEp}`;

    if (st === 'completed') {
      showToast(`${f ? '🟣' : '✅'} ${a.name} — Completed!`, f ? 'filler' : '');
    } else if (st === 'unlocked') {
      showToast(`🔓 ${a.name} unlocked — ${epRange}`, f ? 'filler' : '');
    } else {
      // If it's an ongoing arc AND you are completely caught up
      if (a.eps[1] === null && state.episode >= state.totalEps) {
        showToast(`⏳ ${a.name} — Next episode soon!`, 'elbaf');
      } else {
        showToast(`⚡ Now in: ${a.name} (${epRange})`, '');
      }
    }
  });
}

/** Build a movie node for the inline Timeline view. */
function buildMovieNodeInline(m, st, key) {
  const div = document.createElement('div');
  div.dataset.key = key;
  div.className = `movie-item ${st}`;

  const recLabel = m.rec === 'high' ? '⭐ Highly Recommended' : m.rec === 'watch' ? '👍 Worth Watching' : '⏭ Skip/Recap';
  const recClass = 'tag-base ' + (m.rec === 'high' ? 'rec-high' : m.rec === 'watch' ? 'rec-watch' : 'rec-skip');

  const isLocked = st === 'locked';
  const badgeIcon = isLocked ? '🔒' : (st === 'watched' ? '✅' : '🎬');
  const epLabel = isLocked ? `🔒 Unlocks at Ep ${m.requiredEpisode}` : `⚓ Best after Ep ${m.requiredEpisode}`;

  div.innerHTML = `
    <div class="movie-title-row">
      <span class="movie-title">${m.icon} ${m.name}</span>
    </div>
    <div class="movie-ep-row">
      <div class="movie-sub">${epLabel}</div>

      <div style="display: flex; align-items: center; gap: 8px;">
        <div class="movie-badge" style="width: 26px; height: 26px; font-size: 15px;">${badgeIcon}</div>
        <button class="movie-watch-btn ${st==='watched' ? 'btn-unmark' : 'btn-mark'}">${st==='watched' ? 'unmark' : '+ Watched'}</button>
      </div>

    </div>
    ${m.note ? `<div class="movie-info-row"><span class="${recClass}">${recLabel}</span><div class="movie-note">ℹ️ ${m.note}</div></div>` : `<div class="movie-info-row" style="margin-top:5px"><span class="${recClass}">${recLabel}</span></div>`}
  `;
  div.querySelector('.movie-watch-btn').onclick = (e) => { e.stopPropagation(); toggleMovieWatched(m); };
  return div;
}

function patchMovieNodeInline(node, m, st) {
  const cls = `movie-item ${st}`;
  if (node.className !== cls) node.className = cls;

  const isLocked = st === 'locked';
  const badge = node.querySelector('.movie-badge');
  if (badge) badge.textContent = isLocked ? '🔒' : (st === 'watched' ? '✅' : '🎬');

  const sub = node.querySelector('.movie-sub');
  if (sub) sub.textContent = isLocked ? `🔒 Unlocks at Ep ${m.requiredEpisode}` : `⚓ Best after Ep ${m.requiredEpisode}`;

  const btn = node.querySelector('.movie-watch-btn');
  if (btn) {
      btn.className = `movie-watch-btn ${st==='watched' ? 'btn-unmark' : 'btn-mark'}`;
      btn.textContent = st === 'watched' ? 'unmark' : '+ Watched';
  }
  // Re-wire button in case it's been re-created
  if (btn && !btn._wired) { btn._wired = true; btn.onclick = (e) => { e.stopPropagation(); toggleMovieWatched(m); }; }
}

/** Build a special node for the inline Timeline view. */
function buildSpecialNodeInline(s, st, key) {
  const div = document.createElement('div');
  div.dataset.key = key;
  div.className = `movie-item ${st}`;

  const recLabel = s.rec === 'high' ? '⭐ Highly Recommended' : s.rec === 'watch' ? '👍 Worth Watching' : '⏭ Skip/Recap';
  const recClass = 'tag-base ' + (s.rec === 'high' ? 'rec-high' : s.rec === 'watch' ? 'rec-watch' : 'rec-skip');

  const isLocked = st === 'locked';
  const badgeIcon = isLocked ? '🔒' : (st === 'watched' ? '✅' : '📀');
  const epLabel = isLocked ? `🔒 Unlocks at Ep ${s.requiredEpisode}` : `⚓ Best after Ep ${s.requiredEpisode}`;

  div.innerHTML = `
    <div class="movie-title-row">
      <span class="movie-title">${s.icon} ${s.name}</span>
      <span class="tag-base movie-tag">${s.type}</span>
    </div>
    <div class="movie-ep-row">
      <div class="movie-sub" style="color: var(--gold-light); font-weight: 600;">${epLabel}</div>

      <div style="display: flex; align-items: center; gap: 8px;">
        <div class="movie-badge" style="width: 26px; height: 26px; font-size: 15px;">${badgeIcon}</div>
        <button class="movie-watch-btn ${st==='watched' ? 'btn-unmark' : 'btn-mark'}">${st==='watched' ? 'unmark' : '+ Watched'}</button>
      </div>

    </div>
    ${s.note ? `<div class="movie-info-row"><span class="${recClass}">${recLabel}</span><div class="movie-note">ℹ️ ${s.note}</div></div>` : `<div class="movie-info-row" style="margin-top:5px"><span class="${recClass}">${recLabel}</span></div>`}
  `;

  div.querySelector('.movie-watch-btn').onclick = (e) => { e.stopPropagation(); toggleSpecialWatched(s); };
  return div;
}

function patchSpecialNodeInline(node, s, st) {
  const cls = `movie-item ${st}`;
  if (node.className !== cls) node.className = cls;

  const isLocked = st === 'locked';
  const badge = node.querySelector('.movie-badge');
  if (badge) badge.textContent = isLocked ? '🔒' : (st === 'watched' ? '✅' : '📀');

  const sub = node.querySelector('.movie-sub');
  if (sub) sub.textContent = isLocked ? `🔒 Unlocks at Ep ${s.requiredEpisode}` : `⚓ Best after Ep ${s.requiredEpisode}`;

  const btn = node.querySelector('.movie-watch-btn');
  if (btn) {
      btn.className = `movie-watch-btn ${st==='watched' ? 'btn-unmark' : 'btn-mark'}`;
      btn.textContent = st === 'watched' ? 'unmark' : '+ Watched';
  }
}
