'use strict';

/* ═══════════════════════════════════════════════════════════════════════════
   ARC DATA
   Verified: One Piece Wiki + animefillerlist.com · March 2026
   ═══════════════════════════════════════════════════════════════════════════ */
export const ARCS = [
  // ── East Blue Saga ────────────────────────────────────────────────────────
  { name: 'Romance Dawn',       saga: 'East Blue',         eps: [1,    3   ], icon: '🏴‍☠️', type: 'canon'    },
  { name: 'Orange Town',        saga: 'East Blue',         eps: [4,    8   ], icon: '🐱',  type: 'canon'    },
  { name: 'Syrup Village',      saga: 'East Blue',         eps: [9,    18  ], icon: '🦅',  type: 'canon'    },
  { name: 'Baratie',            saga: 'East Blue',         eps: [19,   30  ], icon: '🦵',  type: 'canon'    },
  { name: 'Arlong Park',        saga: 'East Blue',         eps: [31,   44  ], icon: '🐟',  type: 'canon'    },
  { name: 'Loguetown',          saga: 'East Blue',         eps: [45,   53  ], icon: '⚔️',  type: 'canon',   note: 'Eps 50–51 are filler within the arc' },
  { name: 'Warship Island',     saga: 'East Blue',         eps: [54,   61  ], icon: '🐉',  type: 'filler',  note: 'Apis Arc — fun & watchable intro filler' },

  // ── Alabasta Saga ─────────────────────────────────────────────────────────
  { name: 'Reverse Mountain',   saga: 'Alabasta',          eps: [62,   63  ], icon: '🌊',  type: 'canon'    },
  { name: 'Whisky Peak',        saga: 'Alabasta',          eps: [64,   67  ], icon: '🍺',  type: 'canon'    },
  { name: 'Koby & Helmeppo',    saga: 'Alabasta',          eps: [68,   69  ], icon: '⚓',  type: 'filler',  note: 'Cover story adaptation — short & worth a watch' },
  { name: 'Little Garden',      saga: 'Alabasta',          eps: [70,   77  ], icon: '🦕',  type: 'canon'    },
  { name: 'Drum Island',        saga: 'Alabasta',          eps: [78,   91  ], icon: '❄️',  type: 'canon'    },
  { name: 'Alabasta',           saga: 'Alabasta',          eps: [92,   130 ], icon: '🏜️',  type: 'canon',   note: 'Eps 93, 98–99, 101–102 are filler within' },
  { name: 'Post-Alabasta',      saga: 'Alabasta',          eps: [131,  135 ], icon: '🎭',  type: 'filler',  note: 'Character spotlight mini-arcs, fun & short' },

  // ── Skypiea Saga ──────────────────────────────────────────────────────────
  { name: 'Goat Island',        saga: 'Skypiea',           eps: [136,  138 ], icon: '🐐',  type: 'filler',  note: 'Skippable' },
  { name: 'Ruluka Island',      saga: 'Skypiea',           eps: [139,  143 ], icon: '🌈',  type: 'filler',  note: 'Skippable' },
  { name: 'Jaya',               saga: 'Skypiea',           eps: [144,  152 ], icon: '🏝️',  type: 'canon'    },
  { name: 'Skypiea',            saga: 'Skypiea',           eps: [153,  195 ], icon: '☁️',  type: 'canon'    },
  { name: 'G-8',                saga: 'Skypiea',           eps: [196,  206 ], icon: '🪖',  type: 'filler',  note: '⭐ Fan-favorite — one of the best filler arcs ever' },

  // ── Water 7 Saga ──────────────────────────────────────────────────────────
  { name: 'Long Ring Long Land',saga: 'Water 7',           eps: [207,  219 ], icon: '🦒',  type: 'canon',   note: 'Eps 213–216 are filler within' },
  { name: "Ocean's Dream",      saga: 'Water 7',           eps: [220,  224 ], icon: '💤',  type: 'filler',  note: 'Memory-loss story, fun standalone watch' },
  { name: "Foxy's Return",      saga: 'Water 7',           eps: [225,  228 ], icon: '🦊',  type: 'filler',  note: '2 filler + 2 transition eps' },
  { name: 'Water 7',            saga: 'Water 7',           eps: [229,  263 ], icon: '🚤',  type: 'canon'    },
  { name: 'Enies Lobby',        saga: 'Water 7',           eps: [264,  312 ], icon: '⚖️',  type: 'canon'    },
  { name: 'Post-Enies Lobby',   saga: 'Water 7',           eps: [313,  325 ], icon: '🎉',  type: 'canon',   note: 'Eps 317–319 are filler within' },
  { name: 'Ice Hunter',         saga: 'Water 7',           eps: [326,  336 ], icon: '🧊',  type: 'filler',  note: 'Skippable' },

  // ── Thriller Bark Saga ────────────────────────────────────────────────────
  { name: 'Thriller Bark',      saga: 'Thriller Bark',     eps: [337,  381 ], icon: '💀',  type: 'canon'    },
  { name: 'Spa Island',         saga: 'Thriller Bark',     eps: [382,  384 ], icon: '♨️',  type: 'filler',  note: 'Skippable' },

  // ── Marineford Saga ───────────────────────────────────────────────────────
  { name: 'Sabaody Archipelago',saga: 'Marineford',        eps: [385,  405 ], icon: '🫧',  type: 'canon',   note: 'Eps 406–407 are filler' },
  { name: 'Amazon Lily',        saga: 'Marineford',        eps: [408,  421 ], icon: '🏹',  type: 'canon'    },
  { name: 'Impel Down',         saga: 'Marineford',        eps: [422,  456 ], icon: '🔒',  type: 'canon',   note: 'Little East Blue filler (eps 426–429) inserted mid-arc' },
  { name: 'Little East Blue',   saga: 'Marineford',        eps: [426,  429 ], icon: '🌏',  type: 'filler',  movie: 'Film Strong World tie-in' },
  { name: 'Marineford',         saga: 'Marineford',        eps: [457,  489 ], icon: '🌋',  type: 'canon',   note: 'Eps 457–458 are recap/filler' },

  // ── Post-War Saga ─────────────────────────────────────────────────────────
  { name: 'Post-War',           saga: 'Post-War',           eps: [490,  516 ], icon: '😢',  type: 'canon',   note: 'Ep 492 is Toriko crossover filler' },

  // ── Fish-Man Island Saga ──────────────────────────────────────────────────
  { name: 'Return to Sabaody', saga: 'Fish-Man Island',   eps: [517,  522 ], icon: '🐠',  type: 'canon'    },
  { name: 'Fish-Man Island',   saga: 'Fish-Man Island',   eps: [523,  574 ], icon: '🐙',  type: 'canon',   note: 'Ep 542 is Toriko/Dragon Ball Z crossover' },

  // ── Dressrosa Saga ────────────────────────────────────────────────────────
  { name: "Z's Ambition",       saga: 'Dressrosa',         eps: [575,  578 ], icon: '🎖️',  type: 'filler',  movie: 'Film Z tie-in' },
  { name: 'Punk Hazard',        saga: 'Dressrosa',         eps: [579,  625 ], icon: '🔥',  type: 'canon',   note: 'Ep 590 is Toriko/DBZ crossover' },
  { name: 'Caesar Retrieval',   saga: 'Dressrosa',         eps: [626,  628 ], icon: '🧪',  type: 'filler',  note: 'Ep 628 is mixed canon/filler' },
  { name: 'Dressrosa',          saga: 'Dressrosa',         eps: [629,  746 ], icon: '🌹',  type: 'canon',   note: 'No filler — but pacing is slow' },

  // ── Whole Cake Island Saga ───────────────────────────────────────────────
  { name: 'Silver Mine',        saga: 'Whole Cake Island', eps: [747,  750 ], icon: '⛏️',  type: 'filler',  movie: 'Film Gold tie-in' },
  { name: 'Zou',                saga: 'Whole Cake Island', eps: [751,  779 ], icon: '🐘',  type: 'canon'    },
  { name: 'Marine Rookie',      saga: 'Whole Cake Island', eps: [780,  782 ], icon: '🎖️',  type: 'filler',  note: 'Skippable' },
  { name: 'Whole Cake Island',  saga: 'Whole Cake Island', eps: [783,  877 ], icon: '🎂',  type: 'canon'    },
  { name: 'Levely',             saga: 'Whole Cake Island', eps: [878,  889 ], icon: '👑',  type: 'canon',   note: 'Eps 881–885, 887–890 are mixed/filler' },

  // ── Wano Saga ─────────────────────────────────────────────────────────────
  { name: 'Cidre Guild',        saga: 'Wano',              eps: [895,  896 ], icon: '🍾',  type: 'filler',  movie: 'Film Stampede tie-in' },
  { name: 'Wano Country',       saga: 'Wano',              eps: [890,  1085], icon: '⛩️',  type: 'canon',   note: 'Ep 907 filler; eps 1029–1030 filler; ep 1084 anime-original' },

  // ── Final Saga ────────────────────────────────────────────────────────────
  { name: 'Egghead',            saga: 'Final Saga',        eps: [1086, 1155], icon: '🤖',  type: 'canon',   },
  { name: 'Elbaf',              saga: 'Final Saga',        eps: [1156, null], icon: '🏔️',  type: 'canon',    note: 'Part 2 ongoing · Part 1: Episodes 1156–1168' },

];
