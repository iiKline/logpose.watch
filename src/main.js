'use strict';

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN ENTRY POINT - Initialization & Event Binding
   ═══════════════════════════════════════════════════════════════════════════ */

// ── Data Imports ───────────────────────────────────────────────────────────
import { ARCS } from './data/arcs.js';

// ── State Imports ─────────────────────────────────────────────────────────
import { state } from './state/state.js';
import { loadState, saveState } from './state/persistence.js';
import { trySetEpisode, tryWatchNext } from './state/mutations.js';

// ── Utils Imports ─────────────────────────────────────────────────────────
import { fetchTotalEpisodes, fetchAiringSchedule } from './utils/api.js';
import { updateCountdown } from './utils/date.js';
import { exportSave, importSave } from './utils/export-import.js';
import { customSmoothScroll, centerElementSmart } from './utils/scroll.js';
import { getCurrentArc, arcEnd } from './utils/arc-helpers.js';

// ── Component Imports ─────────────────────────────────────────────────────
import { renderHero } from './components/hero.js';
import { renderArcGrid } from './components/arc-grid.js';
import { renderMovieGrid } from './components/movie-grid.js';
import { renderSpecialGrid, setSpecialView } from './components/special-grid.js';
import { renderStats, renderRank } from './components/stats.js';
import { openProgressModal, closeProgressModal, updateProgressNavSub } from './components/progress-modal.js';
import { loadTheme, applyTheme, toggleTheme } from './components/theme.js';
import { updateSagaTheme } from './components/saga-theme.js';
import { showToast } from './components/toast.js';
import { openResetDialog, closeResetDialog, confirmReset, initInfoButton, closeInfoModal, openInfoModal } from './components/dialogs.js';
import './components/bottom-sheet.js';
import './components/music.js';

/* ═══════════════════════════════════════════════════════════════════════════
   UI RENDER
   ═══════════════════════════════════════════════════════════════════════════ */

export function renderAll() {
  updateSagaTheme(state.episode);
  renderHero();
  renderStats();
  renderRank();
  renderArcGrid();
  renderMovieGrid();
  renderSpecialGrid();
  updateProgressNavSub();
  syncInput();
  const notesEl = document.getElementById('notes');
  if (notesEl) notesEl.value = state.notes || '';
  _applyMainViewVisibility();
}

// ── Global Listeners ───────────────────────────────────────────────────────
document.addEventListener('episodeChanged', () => {
  updateSagaTheme(state.episode);
  saveState();
});

function syncInput() {
  const input = document.getElementById('epInput');
  if (input) input.value = state.episode || '';
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN VIEW TOGGLE
   ═══════════════════════════════════════════════════════════════════════════ */

function _applyMainViewVisibility() {
  const v = state.mainView || 'all';
  state.mainView = v;

  const ss = document.getElementById('seriesSection');
  const ms = document.getElementById('moviesSection');
  const sp = document.getElementById('specialsSection');
  const th = document.getElementById('timelineFilterHeader');
  const sh = document.getElementById('seriesFilterHeader');
  const sf = document.getElementById('seriesFilters');
  const mh = document.getElementById('moviesFilterHeader');
  const sph = document.getElementById('specialsFilterHeader');
  const legend = document.querySelector('.legend');
  const searchInput = document.getElementById('arcSearch');

  if (ss) ss.style.display   = (v === 'series' || v === 'all') ? '' : 'none';
  if (ms) ms.style.display   = (v === 'movies') ? '' : 'none';
  if (sp) sp.style.display   = (v === 'specials') ? '' : 'none';

  if (th) th.style.display   = (v === 'all') ? 'flex' : 'none';
  if (sh) sh.style.display   = (v === 'series') ? 'flex' : 'none';
  if (sf) sf.style.display   = (v === 'series') ? 'flex' : 'none';
  if (mh) mh.style.display   = (v === 'movies') ? '' : 'none';
  if (sph) sph.style.display = (v === 'specials') ? '' : 'none';

  if (legend) legend.style.display = (v === 'series' || v === 'all') ? 'flex' : 'none';

  if (searchInput) {
    if (v === 'all') searchInput.placeholder = 'Search timeline...';
    else if (v === 'series') searchInput.placeholder = 'Search arcs...';
    else if (v === 'movies') searchInput.placeholder = 'Search movies...';
    else if (v === 'specials') searchInput.placeholder = 'Search specials...';
  }

  ['all', 'series', 'movies', 'specials'].forEach(id => {
    const btn = document.getElementById('navbtn-' + id);
    if (!btn) return;
    const isActive = (id === v);
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });

  // Sync Pill Buttons (Active Classes)
  if (v === 'all') {
    ['all', 'unwatched', 'watched'].forEach(x => {
      const btn = document.getElementById('toggle-tl-' + x);
      if (btn) {
        btn.className = 'toggle-option' + (x === state.timelineView ? ' active-all' : '');
        btn.setAttribute('aria-pressed', x === state.timelineView ? 'true' : 'false');
      }
    });
  } else if (v === 'series') {
    ['all', 'canon', 'filler', 'ongoing'].forEach(x => {
      const btn = document.getElementById('toggle-' + x);
      if (btn) {
        btn.className = 'toggle-option' + (x === state.seriesView ? ' active-' + (x==='all'?'all':x) : '');
        btn.setAttribute('aria-pressed', x === state.seriesView ? 'true' : 'false');
      }
    });
  }

  // Handle Tab-specific Toggles Visibility
  const seriesTr = document.getElementById('seriesToggleRow');
  const movieTr  = document.getElementById('movieToggleRow');
  const specialTr = document.getElementById('specialToggleRow');
  const tabExtraFilters = document.getElementById('tabExtraFilters');

  if (seriesTr) seriesTr.style.display = (v === 'series') ? 'flex' : 'none';
  if (movieTr)  movieTr.style.display  = (v === 'movies') ? 'flex' : 'none';
  if (specialTr) specialTr.style.display = (v === 'specials') ? 'flex' : 'none';
  
  if (tabExtraFilters) {
    tabExtraFilters.style.display = (v === 'all') ? 'none' : 'block';
  }

  // Sync Checkbox States
  const arcT = document.getElementById('arcHideToggle');
  const movT = document.getElementById('movieHideToggle');
  const spT  = document.getElementById('specialHideToggle');
  if (arcT) arcT.checked = state.hideCompletedArcs;
  if (movT) movT.checked = state.hideWatchedMovies;
  if (spT)  spT.checked  = state.hideWatchedSpecials;
}

export function setMainView(view) {
  const prevView = state.mainView;
  if (prevView === view) return;

  const currentHeight = document.documentElement.scrollHeight;
  document.body.style.minHeight = currentHeight + 'px';

  state.mainView = view;
  saveState();
  _applyMainViewVisibility();

  const headers = {
    all: 'timelineFilterHeader',
    series: 'seriesFilterHeader',
    movies: 'moviesFilterHeader',
    specials: 'specialsFilterHeader'
  };
  const targetHeader = document.getElementById(headers[view]);

  if (targetHeader) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const rect = targetHeader.getBoundingClientRect();
        if (rect.top < 10 || rect.top > 120) {
          customSmoothScroll(targetHeader, 550, 'start');
        }
      });
    });
  }

  const sectionIds = { all: 'seriesSection', series: 'seriesSection', movies: 'moviesSection', specials: 'specialsSection' };
  const sId = sectionIds[view];
  if (sId) {
    const sec = document.getElementById(sId);
    if (sec) {
      sec.classList.remove('animate-in');
      void sec.offsetWidth;
      sec.classList.add('animate-in');
    }
  }

  if (view === 'movies') renderMovieGrid();
  else if (view === 'specials') renderSpecialGrid();
  else renderArcGrid();

  setTimeout(() => {
    document.body.style.minHeight = '';
  }, 750);
}

/* ═══════════════════════════════════════════════════════════════════════════
   EVENT HANDLERS
   ═══════════════════════════════════════════════════════════════════════════ */

export function commitEpisode() {
  const val    = parseInt(document.getElementById('epInput').value, 10);
  const result = trySetEpisode(val);
  notifyAfterSet(result);
  if (result.ok) {
    saveState();
    renderHero();
    renderStats();
    renderRank();
    renderArcGrid();
    renderMovieGrid();
    renderSpecialGrid();
    updateProgressNavSub();
  }
}

export function watchNextEp() {
  const result = tryWatchNext();
  if (!result.ok && result.atMax) {
    showToast('🏔️ Caught up! Next episode soon!!', 'elbaf');
    return;
  }
  notifyAfterSet(result);
  if (result.ok) {
    saveState();
    syncInput();
    renderHero();
    renderStats();
    renderRank();
    renderArcGrid();
    renderMovieGrid();
    renderSpecialGrid();
    updateProgressNavSub();
  }
}

export function adjustEp(delta) {
  const input = document.getElementById('epInput');
  const cur   = parseInt(input.value, 10);
  const base  = isNaN(cur) ? state.episode : cur;
  input.value = Math.max(0, Math.min(state.totalEps, base + delta));
}

export function setTimelineView(v) {
  state.timelineView = v;
  saveState();
  _applyMainViewVisibility();
  renderArcGrid();
}

export function setView(v) {
  state.seriesView = v;
  saveState();
  _applyMainViewVisibility();
  renderArcGrid();
}

export function toggleArcHide(checked) {
  state.hideCompletedArcs = checked;
  saveState();
  renderArcGrid();
}

export function toggleMovieHide(checked) {
  state.hideWatchedMovies = checked;
  saveState();
  renderMovieGrid();
}

export function toggleSpecialHide(checked) {
  state.hideWatchedSpecials = checked;
  saveState();
  renderSpecialGrid();
}

export function handleSearch() {
  const input             = document.getElementById('arcSearch');
  state.searchQuery       = input.value;
  const clearBtn          = document.getElementById('searchClear');
  if (clearBtn) clearBtn.classList.toggle('visible', input.value.length > 0);
  renderArcGrid();
  renderMovieGrid();
  renderSpecialGrid();
}

export function clearSearch() {
  const input       = document.getElementById('arcSearch');
  if (!input) return;
  input.value       = '';
  state.searchQuery = '';
  const clearBtn = document.getElementById('searchClear');
  if (clearBtn) clearBtn.classList.remove('visible');
  input.focus();
  renderArcGrid();
  renderMovieGrid();
  renderSpecialGrid();
}

export function saveNotes() {
  const notesEl = document.getElementById('notes');
  if (notesEl) {
    state.notes = notesEl.value;
    saveState();
  }
}

export function goToCurrentArc() {
  if (state.episode === 0) {
    showToast('⚓ Set an episode first to find your arc!', '');
    return;
  }

  state.mainView = 'all';
  state.timelineView = 'all';
  state.seriesView   = 'all';
  saveState();
  _applyMainViewVisibility();
  setTimelineView('all');
  renderArcGrid();

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const cur = document.querySelector('.arc-item.current');
      if (cur) {
        showToast('⚡ Jumping to your current arc…', '');
        centerElementSmart(cur);
        cur.style.transition = 'box-shadow .4s ease';
        cur.style.boxShadow  = '0 0 0 3px var(--gold), 0 0 40px rgba(240,168,50,0.4)';
        setTimeout(() => { cur.style.boxShadow = ''; }, 2000);
      }
    });
  });
}

function notifyAfterSet(result) {
  if (!result.ok) {
    showToast(`⚠️ ${result.reason}`, '');
    return;
  }
  const oldArc = getCurrentArc(result.oldEp);
  const newArc = getCurrentArc(result.newEp);
  const enteredNewArc = newArc && (!oldArc || newArc.name !== oldArc.name) && result.newEp > result.oldEp;

  if (result.milestones.length > 0 && result.newEp === arcEnd(result.milestones[result.milestones.length - 1])) {
    const last = result.milestones[result.milestones.length - 1];
    const f    = last.type === 'filler';
    showToast(`${f ? '🟣' : '🎉'} ${f ? 'Filler' : 'Arc'} Complete: ${last.name}!`, f ? 'filler' : '');
    return;
  }

  if (enteredNewArc) {
    const f = newArc.type === 'filler';
    showToast(`⚡ Entered ${newArc.name} Arc!`, f ? 'filler' : '');
    return;
  }

  if (result.milestones.length > 0) {
    const last = result.milestones[result.milestones.length - 1];
    const f    = last.type === 'filler';
    showToast(`${f ? '🟣' : '🎉'} ${f ? 'Filler' : 'Arc'} Complete: ${last.name}!`, f ? 'filler' : '');
    return;
  }

  showToast(`⚓ Episode ${result.newEp} set!`, '');
}

/* ═══════════════════════════════════════════════════════════════════════════
   INITIALIZATION
   ═══════════════════════════════════════════════════════════════════════════ */

// Event Listeners set up immediately
const epInput = document.getElementById('epInput');
if (epInput) {
  epInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); commitEpisode(); }
  });
}

const progressBar = document.getElementById('progressBar');
if (progressBar) {
  let isDragging = false;
  function setEpFromBar(e) {
    const rect = progressBar.getBoundingClientRect();
    const x    = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const pct  = Math.max(0, Math.min(1, x / rect.width));
    const ep   = Math.round(pct * state.totalEps);
    const input = document.getElementById('epInput');
    if (input) input.value = ep;
    const barFill = document.getElementById('mainBar');
    if (barFill) barFill.style.width = (pct * 100) + '%';
  }
  function commitFromBar() {
    isDragging = false;
    progressBar.style.cursor = 'pointer';
    commitEpisode();
  }
  progressBar.addEventListener('mousedown',  e => { isDragging = true; progressBar.style.cursor = 'ew-resize'; setEpFromBar(e); });
  progressBar.addEventListener('touchstart', e => { isDragging = true; setEpFromBar(e); }, { passive: true });
  document.addEventListener('mousemove',  e => { if (isDragging) setEpFromBar(e); });
  document.addEventListener('touchmove',  e => { if (isDragging) setEpFromBar(e); }, { passive: true });
  document.addEventListener('mouseup',    () => { if (isDragging) commitFromBar(); });
  document.addEventListener('touchend',   () => { if (isDragging) commitFromBar(); });
  progressBar.addEventListener('click', e => { if (!isDragging) { setEpFromBar(e); commitEpisode(); } });
}

const arcGrid = document.getElementById('arcGrid');
if (arcGrid) {
  arcGrid.addEventListener('click', e => {
    const item = e.target.closest('.arc-item');
    if (!item || item.classList.contains('locked')) return;
    if (e.target.closest('.btn-filler-action')) return;
    item.classList.toggle('expanded');
  });
}

// Ripple effect
document.addEventListener('pointerdown', e => {
  const btn = e.target.closest('.btn, .movie-watch-btn, .bottom-nav-btn, .btn-filler-action, .toggle-option, .view-btn, .theme-toggle, .hamburger-btn, .info-toggle, .scroll-top-btn');
  if (!btn) return;
  const rect   = btn.getBoundingClientRect();
  const size   = Math.max(rect.width, rect.height) * 1.4;
  const x      = e.clientX - rect.left;
  const y      = e.clientY - rect.top;
  const circle = document.createElement('span');
  circle.className = 'ripple-circle';
  Object.assign(circle.style, { width: size + 'px', height: size + 'px', left: x + 'px', top: y + 'px' });
  if (window.getComputedStyle(btn).position === 'static') btn.style.position = 'relative';
  btn.style.overflow = 'hidden';
  btn.appendChild(circle);
  setTimeout(() => circle.remove(), 520);
});

// Detail injection
(function patchBuildArcNode() {
  const observer = new MutationObserver(() => {
    document.querySelectorAll('.arc-item:not([data-detail-injected])').forEach(item => {
      item.setAttribute('data-detail-injected', '1');
      const key = item.dataset.key || '';
      const arcName = key.replace(/^arc-/, '').replace(/-/g, ' ');
      const arc = ARCS.find(a => a.name.replace(/\s+/g, ' ') === arcName || ('arc-' + a.name.replace(/\s+/g, '-')) === key);
      if (!arc) return;
      const detail = document.createElement('div');
      detail.className = 'arc-detail';
      const parts = [];
      parts.push(`🗺 ${arc.saga.endsWith('Saga') ? arc.saga : arc.saga + ' Saga'} · Eps ${arc.eps[0]}–${arc.eps[1] ?? 'ongoing'}`);
      if (arc.note) parts.push(`📌 ${arc.note}`);
      if (arc.movie) parts.push(`🎬 ${arc.movie}`);
      detail.textContent = parts.join('   ·   ');
      item.appendChild(detail);
    });
  });
  const target = document.getElementById('arcGrid') || document.body;
  observer.observe(target, { childList: true, subtree: true });
})();

// Swipe gestures
(function initSwipeGestures() {
  let touchStartX = 0;
  let touchStartY = 0;
  document.addEventListener('touchstart', e => {
    if (e.touches.length > 1) return;
    if (e.target.closest('input, textarea, .progress-bar-wrap, .dialog')) return;
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
  }, { passive: true });
  document.addEventListener('touchend', e => {
    if (e.changedTouches.length > 1) return;
    const touchEndX = e.changedTouches[0].screenX;
    const touchEndY = e.changedTouches[0].screenY;
    const deltaX = touchStartX - touchEndX;
    const deltaY = Math.abs(touchStartY - touchEndY);
    if (Math.abs(deltaX) > 70 && deltaY < 45) {
      const views = ['all', 'series', 'movies', 'specials'];
      const currentIndex = views.indexOf(state.mainView);
      if (currentIndex === -1) return;
      if (deltaX > 0 && currentIndex < views.length - 1) setMainView(views[currentIndex + 1]);
      else if (deltaX < 0 && currentIndex > 0) setMainView(views[currentIndex - 1]);
    }
  }, { passive: true });
})();

// Scroll to top
(function initScrollToTop() {
  const scrollTopBtn = document.getElementById('scrollToTopBtn');
  if (!scrollTopBtn) return;
  function onScrollTopVisibility() {
    const rankCard  = document.getElementById('rankCard');
    const threshold = rankCard ? (rankCard.offsetTop + rankCard.offsetHeight) : 600;
    const isVisible = window.scrollY > threshold;
    scrollTopBtn.classList.toggle('visible', isVisible);

    // Update circular progress
    const scrollTotal = document.documentElement.scrollHeight - window.innerHeight;
    const scrollProgress = scrollTotal > 0 ? (window.scrollY / scrollTotal) : 0;
    const circleFill = scrollTopBtn.querySelector('.scroll-progress-fill');
    if (circleFill) {
      const circumference = 2 * Math.PI * 22; // r=22
      const offset = circumference - (scrollProgress * circumference);
      circleFill.style.strokeDashoffset = offset;
    }
  }
  window.addEventListener('scroll', onScrollTopVisibility, { passive: true });
  scrollTopBtn.addEventListener('click', () => {
    const currentY = window.scrollY;
    if (currentY <= 0) return;
    const FAR_DISTANCE = Math.max(900, window.innerHeight * 1.5);
    if (currentY > FAR_DISTANCE) {
      window.scrollTo({ top: Math.max(120, Math.round(window.innerHeight * 0.38)), behavior: 'auto' });
      requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    } else window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();

// ── BOOT ───────────────────────────────────────────────────────────────────
loadTheme();
loadState();
renderAll();
setTimelineView(state.timelineView || 'all');
setView(state.seriesView || 'all');
setSpecialView(state.specialView || 'all');
setMainView(state.mainView || 'series');
initInfoButton();

updateCountdown();
setInterval(updateCountdown, 1000);
fetchTotalEpisodes();
fetchAiringSchedule();

setInterval(() => {
  fetchTotalEpisodes();
  fetchAiringSchedule();
}, 30 * 60 * 1000);

// Global exports for HTML handlers
window.adjustEp = adjustEp;
window.commitEpisode = commitEpisode;
window.watchNextEp = watchNextEp;
window.setView = setView;
window.setMainView = setMainView;
window.handleSearch = handleSearch;
window.clearSearch = clearSearch;
window.saveNotes = saveNotes;
window.exportSave = exportSave;
window.importSave = importSave;
window.openResetDialog = openResetDialog;
window.closeResetDialog = closeResetDialog;
window.confirmReset = confirmReset;
window.openProgressModal = openProgressModal;
window.closeProgressModal = closeProgressModal;
window.goToCurrentArc = goToCurrentArc;
window.closeInfoModal = closeInfoModal;
window.openInfoModal = openInfoModal;
window.setSpecialView = setSpecialView;
window.setTimelineView = setTimelineView;
window.toggleArcHide = toggleArcHide;
window.toggleMovieHide = toggleMovieHide;
window.toggleSpecialHide = toggleSpecialHide;
