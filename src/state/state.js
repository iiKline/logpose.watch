'use strict';

/* ═══════════════════════════════════════════════════════════════════════════
   STATE
   ═══════════════════════════════════════════════════════════════════════════ */
const FALLBACK_TOTAL = 1168;  // used until API responds

export const state = {
  episode:        0,
  notes:          '',
  mainView:       'series',   // 'series' | 'movies'
  timelineView:   'all',      // 'all' | 'unwatched' | 'watched'
  seriesView:     'all',      // 'all' | 'canon' | 'filler' | 'ongoing'
  totalEps:       FALLBACK_TOTAL,
  nextEpisode:    null,
  nextAiringAt:   null,
  searchQuery:    '',
  watchedMovies:   new Set(),  // Set of movie ids marked watched
  watchedFillers:  new Set(),  // Set of filler arc names explicitly watched
  skippedFillers:  new Set(),  // Set of filler arc names explicitly skipped
  watchedSpecials: new Set(),
  specialView:    'all',
  lastWatchedDate: null,  // YYYY-MM-DD format
  streakCount:     0,       // consecutive days watched
  firstDate:       null,    // Date of first recorded progress
  firstEpisode:    0,       // Episode count when tracking started
  watchHistory:    [],      // Last 7 days of activity: [{date: 'YYYY-MM-DD', count: number}]
  themeAccent:     'auto',  // 'auto' | saga name
  hideCompletedArcs: false,
  hideWatchedMovies: false,
  hideWatchedSpecials: false,
};

export { FALLBACK_TOTAL };
