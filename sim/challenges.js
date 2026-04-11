// ── Challenge Mode ────────────────────────────────────────────────
"use strict";

class ChallengeManager {
  constructor() {
    this.active = false;
    this.currentLevel = null;
    this.startTime = 0;
    this.won = false;
    this.stars = 0;
    this.particlesUsed = 0;
    this.allowedElements = null; // null = all allowed
    this.progress = JSON.parse(localStorage.getItem("simChallengeProgress") || "{}");
  }

  getLevels() { return CHALLENGE_LEVELS; }

  getStars(idx) { return this.progress[idx] || 0; }

  getTotalStars() {
    let s = 0;
    for (const k in this.progress) s += this.progress[k];
    return s;
  }

  startLevel(idx, grid) {
    const level = CHALLENGE_LEVELS[idx];
    if (!level) return false;
    this.active = true;
    this.currentLevel = idx;
    this.won = false;
    this.stars = 0;
    this.particlesUsed = 0;
    this.startTime = Date.now();
    this.allowedElements = level.allowed || null;

    grid.clear();
    level.setup(grid);
    grid.dirtyChunks.fill(1);
    grid.activeChunks.fill(1);
    return true;
  }

  checkWin(grid) {
    if (!this.active || this.won) return false;
    const level = CHALLENGE_LEVELS[this.currentLevel];
    if (!level) return false;

    if (level.checkWin(grid)) {
      this.won = true;
      const elapsed = (Date.now() - this.startTime) / 1000;
      // Star rating based on time and particles used
      const t3 = level.star3time || 30;
      const t2 = level.star2time || 60;
      if (elapsed <= t3 && this.particlesUsed <= (level.star3particles || 500)) {
        this.stars = 3;
      } else if (elapsed <= t2) {
        this.stars = 2;
      } else {
        this.stars = 1;
      }
      // Save best
      const prev = this.progress[this.currentLevel] || 0;
      if (this.stars > prev) {
        this.progress[this.currentLevel] = this.stars;
        localStorage.setItem("simChallengeProgress", JSON.stringify(this.progress));
      }
      return true;
    }
    return false;
  }

  quit() {
    this.active = false;
    this.currentLevel = null;
    this.allowedElements = null;
    this.won = false;
  }

  countParticle() {
    this.particlesUsed++;
  }
}

// ── Helper functions for level setup ──

function _hline(grid, x1, x2, y, elem) {
  for (let x = x1; x <= x2; x++) {
    if (grid.inBounds(x, y)) grid.set(x, y, elem);
  }
}

function _vline(grid, x, y1, y2, elem) {
  for (let y = y1; y <= y2; y++) {
    if (grid.inBounds(x, y)) grid.set(x, y, elem);
  }
}

function _fillRect(grid, x1, y1, x2, y2, elem) {
  for (let y = y1; y <= y2; y++) {
    for (let x = x1; x <= x2; x++) {
      if (grid.inBounds(x, y)) grid.set(x, y, elem);
    }
  }
}

function _hollowRect(grid, x1, y1, x2, y2, elem) {
  _hline(grid, x1, x2, y1, elem);
  _hline(grid, x1, x2, y2, elem);
  _vline(grid, x1, y1, y2, elem);
  _vline(grid, x2, y1, y2, elem);
}

function _countType(grid, elemId) {
  let c = 0;
  for (let i = 0; i < grid.size; i++) {
    if (grid.type[i] === elemId) c++;
  }
  return c;
}

function _countInRect(grid, x1, y1, x2, y2, elemId) {
  let c = 0;
  for (let y = y1; y <= y2; y++) {
    for (let x = x1; x <= x2; x++) {
      if (grid.inBounds(x, y) && grid.get(x, y) === elemId) c++;
    }
  }
  return c;
}

function _countNonEmpty(grid) {
  let c = 0;
  for (let i = 0; i < grid.size; i++) {
    if (grid.type[i] !== E.EMPTY) c++;
  }
  return c;
}

// ── Level Definitions ──

const CHALLENGE_LEVELS = [
  // ── Level 1: Fill the Pool ──
  {
    name: "Fill the Pool",
    desc: "Fill the basin with water until it reaches the line.",
    hint: "Just draw water!",
    allowed: [E.EMPTY, E.WATER],
    star3time: 15, star2time: 30, star3particles: 300,
    setup(grid) {
      const w = grid.width, h = grid.height;
      const floorY = h - 2;
      const poolL = Math.floor(w * 0.2);
      const poolR = Math.floor(w * 0.8);
      const poolD = Math.floor(h * 0.15);
      // Pool walls
      _hline(grid, poolL, poolR, floorY, E.WALL);
      _vline(grid, poolL, floorY - poolD, floorY, E.WALL);
      _vline(grid, poolR, floorY - poolD, floorY, E.WALL);
      // Goal line (marker)
      const goalY = floorY - Math.floor(poolD * 0.6);
      _hline(grid, poolL + 1, poolR - 1, goalY, E.GOAL);
    },
    checkWin(grid) {
      const w = grid.width, h = grid.height;
      const floorY = h - 2;
      const poolL = Math.floor(w * 0.2);
      const poolR = Math.floor(w * 0.8);
      const poolD = Math.floor(h * 0.15);
      const goalY = floorY - Math.floor(poolD * 0.6);
      // Check: water above the goal line
      let waterAbove = 0;
      const needed = Math.floor((poolR - poolL - 1) * 0.8);
      for (let x = poolL + 1; x < poolR; x++) {
        if (grid.inBounds(x, goalY - 1) && grid.get(x, goalY - 1) === E.WATER) waterAbove++;
      }
      return waterAbove >= needed;
    }
  },

  // ── Level 2: Burn It Down ──
  {
    name: "Burn It Down",
    desc: "Destroy all the wood structures using fire.",
    hint: "Fire spreads to flammable things.",
    allowed: [E.EMPTY, E.FIRE, E.TORCH],
    star3time: 20, star2time: 45, star3particles: 50,
    setup(grid) {
      const w = grid.width, h = grid.height;
      const floorY = h - 2;
      _hline(grid, 0, w - 1, floorY, E.STONE);
      // Build wood structures
      const cx = Math.floor(w / 2);
      // House shape
      _fillRect(grid, cx - 8, floorY - 8, cx + 8, floorY - 1, E.WOOD);
      // Small shed left
      _fillRect(grid, cx - 20, floorY - 5, cx - 14, floorY - 1, E.WOOD);
      // Tall tower right
      _fillRect(grid, cx + 12, floorY - 14, cx + 15, floorY - 1, E.WOOD);
    },
    checkWin(grid) {
      return _countType(grid, E.WOOD) <= 3;
    }
  },

  // ── Level 3: Bridge Builder ──
  {
    name: "Bridge Builder",
    desc: "Build a bridge so sand can flow from left to right pool.",
    hint: "Use stone or wall to bridge the gap.",
    allowed: [E.EMPTY, E.STONE, E.WALL, E.SAND],
    star3time: 30, star2time: 60, star3particles: 200,
    setup(grid) {
      const w = grid.width, h = grid.height;
      const floorY = h - 2;
      const gapL = Math.floor(w * 0.35);
      const gapR = Math.floor(w * 0.65);
      const platY = Math.floor(h * 0.5);
      // Left platform with sand pile
      _hline(grid, 0, gapL, platY, E.WALL);
      _fillRect(grid, 2, platY - 10, gapL - 2, platY - 1, E.SAND);
      // Right collection basin
      _hline(grid, gapR, w - 1, platY, E.WALL);
      _vline(grid, w - 1, platY - 8, platY, E.WALL);
      // Goal markers in right basin
      _hline(grid, gapR + 2, w - 3, platY - 1, E.GOAL);
      // Floor
      _hline(grid, 0, w - 1, floorY, E.WALL);
    },
    checkWin(grid) {
      const w = grid.width, h = grid.height;
      const gapR = Math.floor(w * 0.65);
      const platY = Math.floor(h * 0.5);
      // Need sand on the right platform
      const sandRight = _countInRect(grid, gapR + 1, platY - 7, w - 2, platY - 1, E.SAND);
      return sandRight >= 15;
    }
  },

  // ── Level 4: Melt the Ice ──
  {
    name: "Melt the Ice",
    desc: "Melt the ice wall to free the trapped water.",
    hint: "Fire and lava generate heat. Heat melts ice.",
    allowed: [E.EMPTY, E.FIRE, E.LAVA, E.TORCH],
    star3time: 25, star2time: 50, star3particles: 80,
    setup(grid) {
      const w = grid.width, h = grid.height;
      const floorY = h - 2;
      _hline(grid, 0, w - 1, floorY, E.WALL);
      const cx = Math.floor(w / 2);
      // Left chamber with water
      _vline(grid, cx - 15, floorY - 20, floorY, E.WALL);
      _fillRect(grid, cx - 14, floorY - 12, cx - 2, floorY - 1, E.WATER);
      // Ice wall in the middle
      _fillRect(grid, cx - 1, floorY - 20, cx + 1, floorY - 1, E.ICE);
      // Right chamber with goal at bottom
      _vline(grid, cx + 15, floorY - 20, floorY, E.WALL);
      _hline(grid, cx + 2, cx + 14, floorY - 1, E.GOAL);
    },
    checkWin(grid) {
      const w = grid.width, h = grid.height;
      const cx = Math.floor(w / 2);
      const floorY = h - 2;
      // Water in the right chamber
      const water = _countInRect(grid, cx + 2, floorY - 10, cx + 14, floorY - 1, E.WATER);
      return water >= 20;
    }
  },

  // ── Level 5: Chain Reaction ──
  {
    name: "Chain Reaction",
    desc: "Trigger a chain reaction to destroy all TNT blocks.",
    hint: "Light the fuse! Fire travels along fuse to TNT.",
    allowed: [E.EMPTY, E.FIRE, E.EMBER],
    star3time: 15, star2time: 30, star3particles: 10,
    setup(grid) {
      const w = grid.width, h = grid.height;
      const floorY = h - 2;
      _hline(grid, 0, w - 1, floorY, E.WALL);
      const startX = 3;
      const fuseY = Math.floor(h * 0.5);
      // Fuse trail with TNT clusters
      _hline(grid, startX, startX + 12, fuseY, E.FUSE);
      _fillRect(grid, startX + 14, fuseY - 2, startX + 17, fuseY + 1, E.TNT);
      _hline(grid, startX + 18, startX + 28, fuseY, E.FUSE);
      _fillRect(grid, startX + 30, fuseY - 3, startX + 34, fuseY + 2, E.TNT);
      _hline(grid, startX + 35, startX + 42, fuseY - 1, E.FUSE);
      _fillRect(grid, startX + 44, fuseY - 4, startX + 48, fuseY + 1, E.TNT);
      // Some gunpowder sprinkled around
      for (let i = 0; i < 30; i++) {
        const rx = startX + 14 + ((Math.random() * 35) | 0);
        const ry = fuseY - 6 + ((Math.random() * 4) | 0);
        if (grid.inBounds(rx, ry) && grid.get(rx, ry) === E.EMPTY) {
          grid.set(rx, ry, E.GUNPOWDER);
        }
      }
    },
    checkWin(grid) {
      return _countType(grid, E.TNT) === 0;
    }
  },

  // ── Level 6: Water Purifier ──
  {
    name: "Water Purifier",
    desc: "Convert all the saltwater into fresh water using heat.",
    hint: "Boil saltwater into steam, then cool it to get fresh water.",
    allowed: [E.EMPTY, E.FIRE, E.LAVA, E.ICE, E.STONE, E.WALL, E.TORCH],
    star3time: 45, star2time: 90, star3particles: 200,
    setup(grid) {
      const w = grid.width, h = grid.height;
      const floorY = h - 2;
      _hline(grid, 0, w - 1, floorY, E.WALL);
      const cx = Math.floor(w / 2);
      // Saltwater pool
      _vline(grid, cx - 12, floorY - 15, floorY, E.WALL);
      _vline(grid, cx + 12, floorY - 15, floorY, E.WALL);
      _fillRect(grid, cx - 11, floorY - 8, cx + 11, floorY - 1, E.SALTWATER);
      // Goal: collection basin on the side
      _hline(grid, 2, cx - 15, floorY - 3, E.WALL);
      _vline(grid, 2, floorY - 6, floorY, E.WALL);
      _hline(grid, 2, cx - 15, floorY - 1, E.GOAL);
    },
    checkWin(grid) {
      const w = grid.width, h = grid.height;
      const cx = Math.floor(w / 2);
      const floorY = h - 2;
      const waterInBasin = _countInRect(grid, 3, floorY - 5, cx - 16, floorY - 1, E.WATER);
      return waterInBasin >= 10;
    }
  },

  // ── Level 7: Ant Maze ──
  {
    name: "Ant Escape",
    desc: "Help the ants dig through sand to reach the goal.",
    hint: "Ants dig through sand automatically. Guide their path!",
    allowed: [E.EMPTY, E.ANT, E.WALL],
    star3time: 30, star2time: 60, star3particles: 40,
    setup(grid) {
      const w = grid.width, h = grid.height;
      const floorY = h - 2;
      _hline(grid, 0, w - 1, floorY, E.WALL);
      _hline(grid, 0, w - 1, 2, E.WALL);
      _vline(grid, 0, 2, floorY, E.WALL);
      _vline(grid, w - 1, 2, floorY, E.WALL);
      // Fill with sand
      _fillRect(grid, 1, 3, w - 2, floorY - 1, E.SAND);
      // Create starting chamber (top-left)
      _fillRect(grid, 2, 3, 10, 8, E.EMPTY);
      // Goal chamber (bottom-right)
      _fillRect(grid, w - 12, floorY - 6, w - 2, floorY - 1, E.EMPTY);
      _fillRect(grid, w - 10, floorY - 4, w - 3, floorY - 1, E.GOAL);
    },
    checkWin(grid) {
      const w = grid.width, h = grid.height;
      const floorY = h - 2;
      // Ants in the goal zone
      const ants = _countInRect(grid, w - 12, floorY - 6, w - 2, floorY - 1, E.ANT);
      return ants >= 3;
    }
  },

  // ── Level 8: Lava Forge ──
  {
    name: "Lava Forge",
    desc: "Use lava to melt sand into glass. Fill the mold with glass.",
    hint: "Sand melts into glass at extreme heat. Lava provides enough.",
    allowed: [E.EMPTY, E.SAND, E.LAVA, E.WALL, E.STONE],
    star3time: 40, star2time: 80, star3particles: 400,
    setup(grid) {
      const w = grid.width, h = grid.height;
      const floorY = h - 2;
      _hline(grid, 0, w - 1, floorY, E.WALL);
      const cx = Math.floor(w / 2);
      // Glass mold at bottom
      const moldL = cx - 6, moldR = cx + 6;
      const moldTop = floorY - 6;
      _vline(grid, moldL, moldTop, floorY, E.WALL);
      _vline(grid, moldR, moldTop, floorY, E.WALL);
      _hline(grid, moldL, moldR, moldTop, E.WALL);
      // Goal inside mold
      _fillRect(grid, moldL + 1, moldTop + 1, moldR - 1, floorY - 1, E.GOAL);
    },
    checkWin(grid) {
      const w = grid.width, h = grid.height;
      const cx = Math.floor(w / 2);
      const floorY = h - 2;
      const moldL = cx - 6, moldR = cx + 6;
      const moldTop = floorY - 6;
      const glass = _countInRect(grid, moldL + 1, moldTop + 1, moldR - 1, floorY - 1, E.GLASS);
      return glass >= 20;
    }
  },

  // ── Level 9: The Great Flood ──
  {
    name: "The Great Flood",
    desc: "Protect the diamond from the rising water using walls.",
    hint: "Build walls around the diamond before water fills the area.",
    allowed: [E.EMPTY, E.WALL, E.STONE],
    star3time: 20, star2time: 40, star3particles: 200,
    setup(grid) {
      const w = grid.width, h = grid.height;
      const floorY = h - 2;
      _hline(grid, 0, w - 1, floorY, E.WALL);
      _vline(grid, 0, 0, floorY, E.WALL);
      _vline(grid, w - 1, 0, floorY, E.WALL);
      const cx = Math.floor(w / 2);
      const cy = Math.floor(h * 0.6);
      // Diamond in the center
      grid.set(cx, cy, E.DIAMOND);
      grid.set(cx - 1, cy, E.DIAMOND);
      grid.set(cx + 1, cy, E.DIAMOND);
      grid.set(cx, cy - 1, E.DIAMOND);
      // Water sources at top
      grid.addSource(Math.floor(w * 0.25), 3, E.WATER);
      grid.addSource(Math.floor(w * 0.75), 3, E.WATER);
    },
    checkWin(grid) {
      // Win if diamond still exists after water level rises past it
      const w = grid.width, h = grid.height;
      const waterCount = _countType(grid, E.WATER);
      const diamondCount = _countType(grid, E.DIAMOND);
      // Need significant water AND diamond still intact
      return waterCount >= Math.floor(grid.size * 0.15) && diamondCount >= 3;
    }
  },

  // ── Level 10: Fireworks Show ──
  {
    name: "Fireworks Show",
    desc: "Launch 5 fireworks to create a spectacular display!",
    hint: "Place fireworks and they'll launch automatically.",
    allowed: [E.EMPTY, E.FIREWORK, E.WALL, E.FUSE, E.FIRE],
    star3time: 20, star2time: 40, star3particles: 30,
    setup(grid) {
      const w = grid.width, h = grid.height;
      const floorY = h - 2;
      _hline(grid, 0, w - 1, floorY, E.WALL);
      // Launch platforms
      const spacing = Math.floor(w / 6);
      for (let p = 1; p <= 5; p++) {
        const px = spacing * p;
        _fillRect(grid, px - 1, floorY - 2, px + 1, floorY - 1, E.STONE);
        // Mark with goal
        grid.set(px, floorY - 3, E.GOAL);
      }
    },
    checkWin(grid) {
      // Win when enough sparks have been created (fireworks exploded)
      return _countType(grid, E.SPARK) >= 15;
    }
  },

  // ── Level 11: Acid Rain ──
  {
    name: "Acid Rain",
    desc: "Use acid to dissolve the stone barrier protecting the goal.",
    hint: "Acid eats through most materials. Stone has some resistance.",
    allowed: [E.EMPTY, E.ACID, E.WATER],
    star3time: 35, star2time: 70, star3particles: 300,
    setup(grid) {
      const w = grid.width, h = grid.height;
      const floorY = h - 2;
      _hline(grid, 0, w - 1, floorY, E.WALL);
      const cx = Math.floor(w / 2);
      // Stone barrier
      _fillRect(grid, cx - 10, floorY - 15, cx + 10, floorY - 12, E.STONE);
      // Goal underneath the barrier
      _hline(grid, cx - 5, cx + 5, floorY - 1, E.GOAL);
      // Walls on sides to contain acid
      _vline(grid, cx - 15, floorY - 20, floorY, E.WALL);
      _vline(grid, cx + 15, floorY - 20, floorY, E.WALL);
    },
    checkWin(grid) {
      const w = grid.width, h = grid.height;
      const cx = Math.floor(w / 2);
      const floorY = h - 2;
      // Check if any liquid (acid or water) reached the goal area
      let liquid = 0;
      for (let x = cx - 5; x <= cx + 5; x++) {
        for (let y = floorY - 5; y < floorY - 1; y++) {
          const t = grid.get(x, y);
          if (t === E.ACID || t === E.WATER) liquid++;
        }
      }
      return liquid >= 8;
    }
  },

  // ── Level 12: Ecosystem ──
  {
    name: "Garden of Life",
    desc: "Grow a garden! Create at least 50 plant particles.",
    hint: "Seeds grow into plants when they land. Water makes plants grow faster.",
    allowed: [E.EMPTY, E.SEED, E.WATER, E.SAND, E.MUD, E.WALL],
    star3time: 40, star2time: 80, star3particles: 200,
    setup(grid) {
      const w = grid.width, h = grid.height;
      const floorY = h - 2;
      // Soil layer
      _fillRect(grid, 0, floorY - 2, w - 1, floorY, E.MUD);
      _hline(grid, 0, w - 1, floorY, E.WALL);
      // A few starting seeds
      for (let i = 0; i < 5; i++) {
        const sx = 10 + ((Math.random() * (w - 20)) | 0);
        grid.set(sx, floorY - 5, E.SEED);
      }
    },
    checkWin(grid) {
      return _countType(grid, E.PLANT) >= 50;
    }
  },
];
