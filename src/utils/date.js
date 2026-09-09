'use strict';

import { state } from '../state/state.js';

const ELBAF_PART_2_END = 1181;

export function updateCountdown() {
  const sub   = document.querySelector('.elbaf-banner-sub');
  const value = document.getElementById('cdValue');
  const label = document.getElementById('cdLabel');

  if (!value || !label) return;

  // Part 2 has finished.
  if (state.totalEps >= ELBAF_PART_2_END) {
    if (sub) sub.textContent = 'Part 2 complete';

    value.textContent = '✅ Part 2 Complete';
    label.textContent = 'Episodes 1169–1181';
    return;
  }

  // Part 2 is currently airing.
  if (sub) sub.textContent = 'Part 2 ongoing';

  value.textContent = `🟢 Latest: Ep ${state.totalEps}`;

  // AniList schedule unavailable — retain useful static info.
  if (!state.nextEpisode || !state.nextAiringAt) {
    label.textContent = `Loading: ...`;
    return;
  }

  const diff = state.nextAiringAt - Date.now();

  if (diff <= 0) {
    label.textContent = `Episode ${state.nextEpisode} airing now`;
    return;
  }

  const totalSeconds = Math.floor(diff / 1000);

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    label.textContent =
      `Next episode in: ${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    label.textContent =
      `Next episode in: ${hours}h ${minutes}m ${seconds}s`;
  } else {
    label.textContent =
      `Next episode in: ${minutes}m ${seconds}s`;
  }
}