'use strict';

import { state } from '../state/state.js';
import { ARCS } from '../data/arcs.js';
import { MOVIES } from '../data/movies.js';
import { SPECIALS } from '../data/specials.js';
import { arcStatus, getCurrentArc } from '../utils/arc-helpers.js';
import { applyTheme, toggleTheme } from './theme.js';
import { updateSagaTheme } from './saga-theme.js';
import { saveState } from '../state/persistence.js';
import { toggleMute } from './music.js';

/* ═══════════════════════════════════════════════════════════════════════════
   BOTTOM SHEET COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

/** Helper to get completed arcs for progress displays */
function _getProgressArcs() {
  const ep = state.episode;
  return ARCS.filter(a => {
    if (a.type === 'upcoming') return false;
    const completed = arcStatus(a, ep) === 'completed';
    if (!completed) return false;
    // Filler: only show if the user explicitly watched it
    if (a.type === 'filler') return state.watchedFillers.has(a.name);
    // Canon / mixed: episode-based completion is enough
    return true;
  });
}

/** Update subtitle under "My Progress" nav item */
export function updateProgressNavSub() {
  const sub = document.getElementById('progressNavSub');
  if (!sub) return;
  const done  = _getProgressArcs();
  const ep    = state.episode;
  const curA  = getCurrentArc(ep);
  const curName = (curA && curA.name !== 'Between Arcs…') ? curA.name : null;
  sub.textContent = done.length === 0
    ? (curName ? 'On: ' + curName : 'Not started')
    : done.length + ' arc' + (done.length === 1 ? '' : 's') + ' done';
}

document.addEventListener('DOMContentLoaded', function initBottomSheet() {
  const sheet     = document.getElementById('bottomSheet');
  const overlay   = document.getElementById('sheetOverlay');
  const moreBtn   = document.getElementById('navbtn-more');
  const closeBtn  = document.getElementById('sheetCloseBtn');
  const bottomNav = document.querySelector('.bottom-nav');
  let isSheetOpen = false;
  let lockedScrollY = 0;

  function lockBodyScroll() {
    const doc = document.documentElement;
    const scrollbarWidth = window.innerWidth - doc.clientWidth;
    lockedScrollY = window.scrollY || window.pageYOffset || 0;

    document.body.style.position = 'fixed';
    document.body.style.top = '-' + lockedScrollY + 'px';
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
    document.body.style.paddingRight = scrollbarWidth > 0 ? scrollbarWidth + 'px' : '';
  }

  function unlockBodyScroll() {
    const restoreY = Math.abs(parseInt(document.body.style.top || '0', 10)) || lockedScrollY;
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
    window.scrollTo(0, restoreY);
    lockedScrollY = 0;
  }

  // ── Open / Close ──────────────────────────────────────────────────────────
  function openSheet() {
    if (isSheetOpen) return;
    isSheetOpen = true;
    sheet.classList.add('open');
    overlay.classList.add('open');
    sheet.setAttribute('aria-hidden', 'false');
    moreBtn.setAttribute('aria-expanded', 'true');
    moreBtn.classList.add('active');
    sheet._returnFocus = document.activeElement;
    lockBodyScroll();

    const focusable = sheet.querySelectorAll('button, [href], input, [tabindex]:not([tabindex="-1"])');
    const first = focusable[0];
    const last  = focusable[focusable.length - 1];
    sheet._trapHandler = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); closeSheet(); return; }
      if (e.key !== 'Tab') return;
      if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } }
      else            { if (document.activeElement === last)  { e.preventDefault(); first.focus(); } }
    };
    sheet.addEventListener('keydown', sheet._trapHandler);
    setTimeout(() => closeBtn && closeBtn.focus(), 50);

    updateProgressNavSub();
  }

  function closeSheet() {
    if (!isSheetOpen) return;
    isSheetOpen = false;
    sheet.classList.remove('open');
    overlay.classList.remove('open');
    sheet.setAttribute('aria-hidden', 'true');
    moreBtn.setAttribute('aria-expanded', 'false');
    moreBtn.classList.remove('active');
    unlockBodyScroll();
    
    if (sheet._trapHandler) { sheet.removeEventListener('keydown', sheet._trapHandler); sheet._trapHandler = null; }
    if (sheet._returnFocus) { sheet._returnFocus.focus(); sheet._returnFocus = null; }
    
    // Always reset to main panel on close
    const pp = document.getElementById('sheetPanelProgress');
    const pt = document.getElementById('sheetPanelTools');
    const pth = document.getElementById('sheetPanelThemes');
    const pm = document.getElementById('sheetPanelMain');
    if (pp) pp.classList.add('sheet-panel-hidden');
    if (pt) pt.classList.add('sheet-panel-hidden');
    if (pth) pth.classList.add('sheet-panel-hidden');
    if (pm) pm.classList.remove('sheet-panel-slide-left');
    activePanel = null;
    clearProgressActiveTimer();
  }

  moreBtn.addEventListener('click', openSheet);
  closeBtn.addEventListener('click',  closeSheet);
  overlay.addEventListener('click',   closeSheet);

  // ── Drag to Dismiss ───────────────────────────────────────────────────────
  let dragStartY = 0;
  let dragCurrentY = 0;
  let isDraggingSheet = false;

  sheet.addEventListener('touchstart', (e) => {
    const target = e.target;
    // Don't initiate drag if tapping a button or toggle
    if (target.closest('button') || target.closest('.toggle-switch')) return;

    // Allow dragging from header/handle, or if at top of scrollable panel
    const isHeader = target.closest('.sheet-header') || target.closest('.sheet-handle');
    const panel = target.closest('.sheet-panel');
    const isAtTop = !panel || panel.scrollTop <= 0;

    if (isHeader || isAtTop) {
      dragStartY = e.touches[0].clientY;
      dragCurrentY = dragStartY;
      isDraggingSheet = true;
      sheet.style.transition = 'none'; // Disable transition for 1:1 tracking
    }
  }, { passive: true });

  sheet.addEventListener('touchmove', (e) => {
    if (!isDraggingSheet) return;
    dragCurrentY = e.touches[0].clientY;
    const deltaY = dragCurrentY - dragStartY;
    
    const isExpanded = sheet.classList.contains('expanded');

    if (deltaY > 0) {
      // Dragging down
      if (isExpanded) {
        // Shrink from full height
        sheet.style.height = `calc(100vh - ${deltaY}px)`;
        sheet.style.transform = 'translateY(0)';
      } else {
        // Push sheet down
        sheet.style.transform = `translateY(${deltaY}px)`;
      }
    } else {
      // Dragging up
      if (isExpanded) {
        // Resist at top
        sheet.style.transform = `translateY(${deltaY * 0.15}px)`;
      } else {
        // Expand from default height
        sheet.style.height = `calc(85vh + ${Math.abs(deltaY)}px)`;
        sheet.style.transform = 'translateY(0)';
      }
    }
  }, { passive: true });

  sheet.addEventListener('touchend', () => {
    if (!isDraggingSheet) return;
    isDraggingSheet = false;
    sheet.style.transition = ''; // Restore CSS transitions

    const deltaY = dragCurrentY - dragStartY;
    const isExpanded = sheet.classList.contains('expanded');

    if (isExpanded) {
      if (deltaY > 80) {
        // Dragged down enough: go back to 85vh
        sheet.classList.remove('expanded');
        sheet.style.height = '';
        sheet.style.transform = '';
      } else {
        // Snap back to 100vh
        sheet.style.height = '100vh';
        sheet.style.transform = '';
      }
    } else {
      if (deltaY > 120) {
        // Dragged down enough: close
        sheet.style.transform = '';
        sheet.style.height = '';
        closeSheet();
      } else if (deltaY < -60) {
        // Dragged up enough: expand
        sheet.classList.add('expanded');
        sheet.style.height = '100vh';
        sheet.style.transform = '';
      } else {
        // Snap back to 85vh
        sheet.style.height = '';
        sheet.style.transform = '';
      }
    }
    dragStartY = 0;
    dragCurrentY = 0;
  });

  // ── Navigation items ──────────────────────────────────────────────────────
  document.getElementById('sheetHomeBtn').addEventListener('click', () => {
    const main = document.getElementById('mainContent');
    if (main) main.scrollIntoView({ behavior: 'smooth', block: 'start' });
    closeSheet();
  });

  document.getElementById('sheetProgressBtn').addEventListener('click', () => {
    showProgressPanel();
  });

  document.getElementById('sheetThemesBtn').addEventListener('click', () => {
    showThemesPanel();
  });

  document.getElementById('sheetToolsBtn').addEventListener('click', () => {
    showToolsPanel();
  });

  // ── Progress Panel ────────────────────────────────────────────────────────
  const panelMain     = document.getElementById('sheetPanelMain');
  const panelProgress = document.getElementById('sheetPanelProgress');
  const backBtn       = document.getElementById('sheetProgressBackBtn');
  const catArcs       = document.getElementById('progressCatArcs');
  const catSagas      = document.getElementById('progressCatSagas');
  const catMovies     = document.getElementById('progressCatMovies');
  const catSpecials    = document.getElementById('progressCatSpecials');
  let activeCategory  = 'arcs';
  let activePanel = null;
  let progressActiveTimer = null;

  function hideAllSubPanels() {
    panelProgress.classList.add('sheet-panel-hidden');
    panelTools.classList.add('sheet-panel-hidden');
    panelThemes.classList.add('sheet-panel-hidden');
  }

  function clearProgressActiveTimer() {
    if (progressActiveTimer) {
      clearTimeout(progressActiveTimer);
      progressActiveTimer = null;
    }
  }

  function updateMainSlideState() {
    if (activePanel === null) {
      panelMain.classList.remove('sheet-panel-slide-left');
      clearProgressActiveTimer();
    } else {
      clearProgressActiveTimer();
      panelMain.classList.add('sheet-panel-slide-left');
    }
  }

  function showProgressPanel() {
    hideAllSubPanels();
    activePanel = 'progress';
    updateMainSlideState();
    panelProgress.classList.remove('sheet-panel-hidden');
    
    activeCategory = 'arcs';
    setCatActive('arcs');
    renderProgressPanel();
    updateProgressNavSub();
    setTimeout(() => backBtn && backBtn.focus(), 80);
  }

  function hideProgressPanel() {
    panelProgress.classList.add('sheet-panel-hidden');
    if (activePanel === 'progress') activePanel = null;
    updateMainSlideState();
    setTimeout(() => document.getElementById('sheetProgressBtn') && document.getElementById('sheetProgressBtn').focus(), 80);
  }

  backBtn.addEventListener('click', hideProgressPanel);

  // ── Tools Panel ───────────────────────────────────────────────────────────
  const panelTools    = document.getElementById('sheetPanelTools');
  const toolsBackBtn  = document.getElementById('sheetToolsBackBtn');

  function showToolsPanel() {
    hideAllSubPanels();
    activePanel = 'tools';
    updateMainSlideState();
    panelTools.classList.remove('sheet-panel-hidden');
    setTimeout(() => toolsBackBtn && toolsBackBtn.focus(), 80);
  }

  function hideToolsPanel() {
    panelTools.classList.add('sheet-panel-hidden');
    if (activePanel === 'tools') activePanel = null;
    updateMainSlideState();
    setTimeout(() => document.getElementById('sheetToolsBtn') && document.getElementById('sheetToolsBtn').focus(), 80);
  }

  toolsBackBtn.addEventListener('click', hideToolsPanel);

  // ── Themes Panel ──────────────────────────────────────────────────────────
  const panelThemes    = document.getElementById('sheetPanelThemes');
  const themesBackBtn  = document.getElementById('sheetThemesBackBtn');

  function showThemesPanel() {
    hideAllSubPanels();
    activePanel = 'themes';
    updateMainSlideState();
    panelThemes.classList.remove('sheet-panel-hidden');
    renderThemesPanel();
    setTimeout(() => themesBackBtn && themesBackBtn.focus(), 80);
  }

  function hideThemesPanel() {
    panelThemes.classList.add('sheet-panel-hidden');
    if (activePanel === 'themes') activePanel = null;
    updateMainSlideState();
    setTimeout(() => document.getElementById('sheetThemesBtn') && document.getElementById('sheetThemesBtn').focus(), 80);
  }

  themesBackBtn.addEventListener('click', hideThemesPanel);

  function renderThemesPanel() {
    const body = document.getElementById('themesPanelBody');
    if (!body) return;
    body.innerHTML = '';

    // 1. Appearance Section
    const appLabel = document.createElement('div');
    appLabel.className = 'sheet-section-label';
    appLabel.textContent = 'Appearance';
    appLabel.style.marginTop = '0';
    appLabel.style.paddingLeft = '12px';
    body.appendChild(appLabel);

    const appGrid = document.createElement('div');
    appGrid.className = 'theme-grid';
    
    const isDark = (document.documentElement.getAttribute('data-theme') || 'dark') === 'dark';
    
    const darkBtn = createThemeOption('🌙 Dark', isDark, () => {
      applyTheme('dark');
      localStorage.setItem('op_theme', 'dark');
      renderThemesPanel();
    });
    
    const lightBtn = createThemeOption('☀️ Light', !isDark, () => {
      applyTheme('light');
      localStorage.setItem('op_theme', 'light');
      renderThemesPanel();
    });

    appGrid.appendChild(darkBtn);
    appGrid.appendChild(lightBtn);
    body.appendChild(appGrid);

    // 2. Accent Color Section
    const accLabel = document.createElement('div');
    accLabel.className = 'sheet-section-label';
    accLabel.textContent = 'Accent Color';
    accLabel.style.paddingLeft = '12px';
    body.appendChild(accLabel);

    const accGrid = document.createElement('div');
    accGrid.className = 'theme-grid';

    // Auto option
    const autoBtn = createThemeOption('✨ Auto', state.themeAccent === 'auto', () => {
      state.themeAccent = 'auto';
      updateSagaTheme(state.episode);
      saveState();
      renderThemesPanel();
    });
    accGrid.appendChild(autoBtn);

    // Saga options
    const sagas = [
      'East Blue', 'Alabasta', 'Skypiea', 'Water 7', 'Thriller Bark', 
      'Marineford', 'Post-War', 'Fish-Man Island', 'Dressrosa', 
      'Whole Cake Island', 'Wano', 'Final Saga'
    ];

    sagas.forEach(saga => {
      const btn = createThemeOption(saga, state.themeAccent === saga, () => {
        state.themeAccent = saga;
        updateSagaTheme(state.episode);
        saveState();
        renderThemesPanel();
      });
      accGrid.appendChild(btn);
    });

    body.appendChild(accGrid);
  }

  function createThemeOption(label, isActive, onClick) {
    const btn = document.createElement('button');
    btn.className = 'theme-option' + (isActive ? ' active' : '');
    btn.textContent = label;
    btn.addEventListener('click', onClick);
    return btn;
  }


  // Captain's Log Collapse
  const notesCollapseBtn = document.getElementById('notesCollapseBtn');
  const notesContent = document.getElementById('notesContent');
  if (notesCollapseBtn) {
    notesCollapseBtn.addEventListener('click', () => {
      const isOpen = notesContent.classList.contains('open');
      notesCollapseBtn.classList.toggle('active', !isOpen);
      notesContent.classList.toggle('open', !isOpen);
    });
  }

  function setCatActive(cat) {
    activeCategory = cat;
    catArcs.classList.toggle('active', cat === 'arcs');
    catArcs.setAttribute('aria-pressed', cat === 'arcs' ? 'true' : 'false');
    catSagas.classList.toggle('active', cat === 'sagas');
    catSagas.setAttribute('aria-pressed', cat === 'sagas' ? 'true' : 'false');
    catMovies.classList.toggle('active', cat === 'movies');
    catMovies.setAttribute('aria-pressed', cat === 'movies' ? 'true' : 'false');
    catSpecials.classList.toggle('active', cat === 'specials');
    catSpecials.setAttribute('aria-pressed', cat === 'specials' ? 'true' : 'false');
  }

  function renderProgressPanel() {
    const body  = document.getElementById('progressPanelBody');
    const count = document.getElementById('progressPanelCount');
    if (!body) return;

    const existingToggle = body.querySelector('.exclude-fillers-toggle');

    if (activeCategory === 'sagas') {
      if (existingToggle) {
        const existingInput = existingToggle.querySelector('#excludeFillersToggle');
        const excludeFillers = localStorage.getItem('excludeFillers') === 'true';
        if (existingInput) existingInput.checked = excludeFillers;
        let next = existingToggle.nextSibling;
        while (next) { const n = next.nextSibling; body.removeChild(next); next = n; }
      } else {
        body.innerHTML = '';
        const toggleRow = document.createElement('div');
        toggleRow.className = 'exclude-fillers-toggle';
        const excludeFillers = localStorage.getItem('excludeFillers') === 'true';
        toggleRow.innerHTML = `
          <div class="toggle" style="padding:10px 8px;margin-bottom:8px;border-bottom:1px solid var(--border);">
            <span class="toggle-label">Exclude Fillers</span>
            <label class="toggle-switch" aria-label="Exclude filler arcs">
              <input type="checkbox" id="excludeFillersToggle"${excludeFillers ? ' checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
          </div>
        `;
        toggleRow.querySelector('#excludeFillersToggle').addEventListener('change', function () {
          localStorage.setItem('excludeFillers', this.checked.toString());
          renderProgressPanel();
        });
        body.appendChild(toggleRow);
      }
    } else {
      body.innerHTML = '';
    }

    if (activeCategory === 'movies') {
      const watchedMoviesList = MOVIES.filter(m => state.watchedMovies.has(m.id));
      if (count) count.textContent = watchedMoviesList.length + ' film' + (watchedMoviesList.length === 1 ? '' : 's');
      renderPanelMovies(body, watchedMoviesList);
      return;
    }

    if (activeCategory === 'specials') {
      const watchedSpecialsList = SPECIALS.filter(s => state.watchedSpecials.has(s.id));
      if (count) count.textContent = watchedSpecialsList.length + ' special' + (watchedSpecialsList.length === 1 ? '' : 's');
      renderPanelSpecials(body, watchedSpecialsList);
      return;
    }

    const done = _getProgressArcs();
    if (count) count.textContent = done.length + (done.length === 1 ? ' arc' : ' arcs');
    if (activeCategory === 'arcs') renderPanelArcs(body, done);
    else                            renderPanelSagas(body, done);
  }

  function renderPanelMovies(body, watchedMoviesList) {
    if (watchedMoviesList.length === 0) {
      body.innerHTML = '<div class="pp-empty">🎬 No movies watched yet.<br>Mark movies as watched to see them here!</div>';
      return;
    }
    for (const m of watchedMoviesList) {
      const row = document.createElement('div');
      row.className = 'pp-arc-row';
      row.setAttribute('role', 'listitem');

      const check = document.createElement('div');
      check.className   = 'pp-arc-check';
      check.textContent = '✔';
      check.setAttribute('aria-hidden', 'true');

      const name = document.createElement('div');
      name.className   = 'pp-arc-name';
      name.textContent = (m.icon ? m.icon + ' ' : '') + m.name;

      const year = document.createElement('span');
      year.className   = 'pp-arc-badge canon';
      year.textContent = m.year;

      row.appendChild(check);
      row.appendChild(name);
      row.appendChild(year);
      body.appendChild(row);
    }
  }

  function renderPanelSpecials(body, watchedSpecialsList) {
    if (watchedSpecialsList.length === 0) {
      body.innerHTML = '<div class="pp-empty">✨ No specials watched yet.<br>Mark specials as watched to see them here!</div>';
      return;
    }
    for (const s of watchedSpecialsList) {
      const row = document.createElement('div');
      row.className = 'pp-arc-row';
      row.setAttribute('role', 'listitem');

      const check = document.createElement('div');
      check.className   = 'pp-arc-check';
      check.textContent = '✔';
      check.setAttribute('aria-hidden', 'true');

      const name = document.createElement('div');
      name.className   = 'pp-arc-name';
      name.textContent = (s.icon ? s.icon + ' ' : '') + s.name;

      const type = document.createElement('span');
      type.className   = 'pp-arc-badge filler';
      type.textContent = s.type === 'ova' ? 'OVA' : s.type === 'short' ? 'Short' : 'Special';

      row.appendChild(check);
      row.appendChild(name);
      row.appendChild(type);
      body.appendChild(row);
    }
  }

  function renderPanelArcs(body, done) {
    if (done.length === 0) {
      body.innerHTML = '<div class="pp-empty">⚓ No completed arcs yet.<br>Keep watching to build your log!</div>';
      return;
    }
    const sagaMap = new Map();
    for (const a of done) {
      if (!sagaMap.has(a.saga)) sagaMap.set(a.saga, []);
      sagaMap.get(a.saga).push(a);
    }
    for (const [saga, arcs] of sagaMap) {
      const label = document.createElement('div');
      label.className   = 'pp-saga-label';
      label.textContent = saga.endsWith('Saga') ? saga : saga + ' Saga';
      body.appendChild(label);

      for (const a of arcs) {
        const row   = document.createElement('div');
        row.className = 'pp-arc-row';
        row.setAttribute('role', 'listitem');

        const check = document.createElement('div');
        check.className   = 'pp-arc-check';
        check.textContent = '✔';
        check.setAttribute('aria-hidden', 'true');

        const name = document.createElement('div');
        name.className   = 'pp-arc-name';
        name.textContent = (a.icon ? a.icon + ' ' : '') + a.name;

        const badge = document.createElement('span');
        const bKey  = a.type === 'filler' ? 'filler' : a.type === 'mixed' ? 'mixed' : 'canon';
        badge.className   = 'pp-arc-badge ' + bKey;
        badge.textContent = bKey === 'filler' ? 'Filler' : bKey === 'mixed' ? 'Mixed' : 'Canon';

        row.appendChild(check);
        row.appendChild(name);
        row.appendChild(badge);
        body.appendChild(row);
      }
    }
  }

  function renderPanelSagas(body, done) {
    const excludeFillers = localStorage.getItem('excludeFillers') === 'true';

    if (done.length === 0 && !excludeFillers) {
      body.innerHTML = '<div class="pp-empty">⚓ No sagas started yet.<br>Keep watching to unlock them!</div>';
      return;
    }

    const filteredArcs = excludeFillers ? ARCS.filter(a => a.type !== 'filler' && a.type !== 'upcoming') : ARCS.filter(a => a.type !== 'upcoming');
    const sagaMap = new Map();
    for (const a of filteredArcs) {
      if (!sagaMap.has(a.saga)) sagaMap.set(a.saga, { total: 0, done: 0, icon: a.icon ?? '🗺️' });
      sagaMap.get(a.saga).total++;
    }

    const filteredDone = excludeFillers ? done.filter(a => a.type !== 'filler') : done;
    for (const a of filteredDone) {
      if (sagaMap.has(a.saga)) sagaMap.get(a.saga).done++;
    }

    const sagaIconMap = new Map();
    for (const a of ARCS) {
      if (!sagaIconMap.has(a.saga)) sagaIconMap.set(a.saga, a.icon ?? '🗺️');
    }

    const activeSagas = [...sagaMap.entries()].filter(([, v]) => v.done > 0);

    for (const [saga, stats] of activeSagas) {
      const row = document.createElement('div');
      row.className = 'pp-saga-row';

      const icon = document.createElement('div');
      icon.className   = 'pp-saga-icon';
      icon.textContent = sagaIconMap.get(saga) ?? '🗺️';
      icon.setAttribute('aria-hidden', 'true');

      const info = document.createElement('div');
      info.className = 'pp-saga-info';

      const nameEl = document.createElement('div');
      nameEl.className   = 'pp-saga-name';
      nameEl.textContent = saga.endsWith('Saga') ? saga : saga + ' Saga';

      const subEl = document.createElement('div');
      subEl.className   = 'pp-saga-sub';
      subEl.textContent = stats.done + ' / ' + stats.total + ' arcs completed';

      info.appendChild(nameEl);
      info.appendChild(subEl);

      const pct = document.createElement('div');
      pct.className   = 'pp-saga-pct';
      pct.textContent = Math.round((stats.done / stats.total) * 100) + '%';

      row.appendChild(icon);
      row.appendChild(info);
      row.appendChild(pct);
      body.appendChild(row);
    }
  }


  catArcs.addEventListener('click', () => {
    setCatActive('arcs');
    renderProgressPanel();
  });

  catSagas.addEventListener('click', () => {
    setCatActive('sagas');
    renderProgressPanel();
  });

  catMovies.addEventListener('click', () => {
    setCatActive('movies');
    renderProgressPanel();
  });

  catSpecials.addEventListener('click', () => {
    setCatActive('specials');
    renderProgressPanel();
  });

  // Re-render panel when it's open and episode changes
  document.addEventListener('episodeChanged', () => {
    if (isSheetOpen && !panelProgress.classList.contains('sheet-panel-hidden')) {
      renderProgressPanel();
      updateProgressNavSub();
    }
  });

  // ── Toggle sync helpers ───────────────────────────────────────────────────
  function syncMuteToggle() {
    const input  = document.getElementById('sheetMuteToggle');
    const icon   = document.getElementById('sheetMuteIcon');
    const sub    = document.getElementById('sheetMuteSub');
    const on     = localStorage.getItem('op_muted') !== 'true';
    if (input) input.checked    = on;
    if (icon)  icon.textContent = on ? '🔊' : '🔇';
    if (sub)    sub.textContent  = on ? 'Playing' : 'Muted';
  }

  // ── Mute Toggle ───────────────────────────────────────────────────────────
  const muteToggle = document.getElementById('sheetMuteToggle');
  muteToggle.addEventListener('change', () => {
    toggleMute();
    syncMuteToggle();
  });

  // Initial sync
  requestAnimationFrame(() => { 
    syncMuteToggle(); 
  });

  // ── Keyboard Navigation ────────────────────────────────────────────────────
  sheet.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSheet();
  });

  // ── Bottom Nav Sync ───────────────────────────────────────────────────────
  const navButtons = bottomNav.querySelectorAll('.bottom-nav-btn');
  navButtons.forEach(btn => {
    if (btn.id === 'navbtn-more') return;
    btn.addEventListener('click', () => {
      closeSheet();
    });
  });
});
