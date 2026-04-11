"use strict";

// ── Challenge/Puzzle Game Mode ───────────────────────────────────────────────

// Helper: draw a horizontal line of an element
function hline(grid, x1, x2, y, elem) {
  for (let x = x1; x <= x2; x++) {
    if (grid.inBounds(x, y)) grid.set(x, y, elem);
  }
}

// Helper: draw a vertical line
function vline(grid, x, y1, y2, elem) {
  for (let y = y1; y <= y2; y++) {
    if (grid.inBounds(x, y)) grid.set(x, y, elem);
  }
}

// Helper: draw a filled rectangle
function fillRect(grid, x1, y1, x2, y2, elem) {
  for (let y = y1; y <= y2; y++)
    for (let x = x1; x <= x2; x++)
      if (grid.inBounds(x, y)) grid.set(x, y, elem);
}

// Helper: count element type in a rectangular region
function countInRect(grid, x1, y1, x2, y2, elem) {
  let c = 0;
  for (let y = y1; y <= y2; y++)
    for (let x = x1; x <= x2; x++)
      if (grid.inBounds(x, y) && grid.get(x, y) === elem) c++;
  return c;
}

// Helper: count total of element type in entire grid
function countAll(grid, elem) {
  let c = 0;
  for (let i = 0; i < grid.size; i++)
    if (grid.type[i] === elem) c++;
  return c;
}

// ── Challenge Levels ─────────────────────────────────────────────────────────

const CHALLENGE_LEVELS = [
  // ── Level 1: The Container ──
  {
    name: "The Container",
    description: "Fill the pool with sand",
    elements: [E.SAND],
    starTimes: [8, 15, 30],
    setup(grid) {
      const w = grid.width;
      const h = grid.height;
      // Build a U-shaped container near the bottom center
      const poolW = Math.floor(w * 0.3);
      const poolH = Math.floor(h * 0.2);
      const poolX = Math.floor(w * 0.5 - poolW / 2);
      const poolY = Math.floor(h * 0.75);
      // Floor of the container
      hline(grid, poolX, poolX + poolW, poolY + poolH, E.WALL);
      // Left wall
      vline(grid, poolX, poolY, poolY + poolH, E.WALL);
      // Right wall
      vline(grid, poolX + poolW, poolY, poolY + poolH, E.WALL);
      // Add some decorative walls on sides
      const pillarH = Math.floor(h * 0.1);
      vline(grid, Math.floor(w * 0.15), Math.floor(h * 0.6), Math.floor(h * 0.6) + pillarH, E.WALL);
      vline(grid, Math.floor(w * 0.85), Math.floor(h * 0.6), Math.floor(h * 0.6) + pillarH, E.WALL);
    },
    check(grid) {
      const w = grid.width;
      const h = grid.height;
      const poolW = Math.floor(w * 0.3);
      const poolH = Math.floor(h * 0.2);
      const poolX = Math.floor(w * 0.5 - poolW / 2);
      const poolY = Math.floor(h * 0.75);
      // Count sand inside the pool (excluding walls)
      const count = countInRect(grid, poolX + 1, poolY + 1, poolX + poolW - 1, poolY + poolH - 1, E.SAND);
      return count >= 30;
    }
  },

  // ── Level 2: Water Works ──
  {
    name: "Water Works",
    description: "Route water to fill the pool",
    elements: [E.WATER, E.WALL],
    starTimes: [15, 30, 60],
    setup(grid) {
      const w = grid.width;
      const h = grid.height;
      // Water source at top-left
      const srcX = Math.floor(w * 0.1);
      const srcY = Math.floor(h * 0.05);
      grid.addSource(srcX, srcY, E.WATER);
      grid.addSource(srcX + 1, srcY, E.WATER);
      // Pool container at bottom-right
      const poolX = Math.floor(w * 0.65);
      const poolY = Math.floor(h * 0.75);
      const poolW = Math.floor(w * 0.25);
      const poolH = Math.floor(h * 0.15);
      hline(grid, poolX, poolX + poolW, poolY + poolH, E.WALL);
      vline(grid, poolX, poolY, poolY + poolH, E.WALL);
      vline(grid, poolX + poolW, poolY, poolY + poolH, E.WALL);
      // Obstacles in between
      const obsX = Math.floor(w * 0.4);
      const obsY1 = Math.floor(h * 0.2);
      const obsY2 = Math.floor(h * 0.55);
      vline(grid, obsX, obsY1, obsY2, E.WALL);
      // A horizontal shelf blocking direct flow
      const shelfY = Math.floor(h * 0.4);
      hline(grid, Math.floor(w * 0.2), Math.floor(w * 0.55), shelfY, E.WALL);
    },
    check(grid) {
      const w = grid.width;
      const h = grid.height;
      const poolX = Math.floor(w * 0.65);
      const poolY = Math.floor(h * 0.75);
      const poolW = Math.floor(w * 0.25);
      const poolH = Math.floor(h * 0.15);
      const count = countInRect(grid, poolX + 1, poolY + 1, poolX + poolW - 1, poolY + poolH - 1, E.WATER);
      return count >= 20;
    }
  },

  // ── Level 3: Meltdown ──
  {
    name: "Meltdown",
    description: "Melt the ice dam to free the water",
    elements: [E.LAVA, E.FIRE],
    starTimes: [10, 20, 45],
    setup(grid) {
      const w = grid.width;
      const h = grid.height;
      // Reservoir region
      const resX = Math.floor(w * 0.05);
      const resW = Math.floor(w * 0.35);
      const resY = Math.floor(h * 0.4);
      const resH = Math.floor(h * 0.5);
      // Floor spanning the whole structure
      const floorY = resY + resH;
      hline(grid, resX, Math.floor(w * 0.95), floorY, E.WALL);
      // Left wall
      vline(grid, resX, resY, floorY, E.WALL);
      // Ice dam in the middle
      const damX = resX + resW;
      const damW = Math.floor(w * 0.1);
      fillRect(grid, damX, resY, damX + damW, floorY - 1, E.ICE);
      // Fill left side with water
      fillRect(grid, resX + 1, resY + 1, damX - 1, floorY - 1, E.WATER);
      // Right side container
      const rightEnd = Math.floor(w * 0.95);
      vline(grid, rightEnd, resY, floorY, E.WALL);
    },
    check(grid) {
      const w = grid.width;
      const h = grid.height;
      const midX = Math.floor(w * 0.55);
      const count = countInRect(grid, midX, 0, w - 1, h - 1, E.WATER);
      return count >= 15;
    }
  },

  // ── Level 4: Chain Reaction ──
  {
    name: "Chain Reaction",
    description: "Destroy all the TNT",
    elements: [E.FIRE, E.FUSE],
    starTimes: [10, 25, 50],
    setup(grid) {
      const w = grid.width;
      const h = grid.height;
      // Place TNT clusters connected by fuse paths
      const tntSize = Math.max(2, Math.floor(w * 0.03));

      // Cluster 1 - top left area
      const c1x = Math.floor(w * 0.2);
      const c1y = Math.floor(h * 0.25);
      fillRect(grid, c1x, c1y, c1x + tntSize, c1y + tntSize, E.TNT);

      // Cluster 2 - top right area
      const c2x = Math.floor(w * 0.7);
      const c2y = Math.floor(h * 0.2);
      fillRect(grid, c2x, c2y, c2x + tntSize, c2y + tntSize, E.TNT);

      // Cluster 3 - center
      const c3x = Math.floor(w * 0.45);
      const c3y = Math.floor(h * 0.5);
      fillRect(grid, c3x, c3y, c3x + tntSize, c3y + tntSize, E.TNT);

      // Cluster 4 - bottom left
      const c4x = Math.floor(w * 0.25);
      const c4y = Math.floor(h * 0.75);
      fillRect(grid, c4x, c4y, c4x + tntSize, c4y + tntSize, E.TNT);

      // Cluster 5 - bottom right
      const c5x = Math.floor(w * 0.75);
      const c5y = Math.floor(h * 0.7);
      fillRect(grid, c5x, c5y, c5x + tntSize, c5y + tntSize, E.TNT);

      // Fuse from cluster 1 down to cluster 3
      const fuseY13 = c1y + tntSize + 1;
      hline(grid, c1x + tntSize, c3x, fuseY13, E.FUSE);
      vline(grid, c3x, fuseY13, c3y, E.FUSE);

      // Fuse from cluster 2 down to cluster 3
      const fuseY23 = c2y + tntSize + 1;
      hline(grid, c3x + tntSize, c2x, fuseY23, E.FUSE);
      vline(grid, c3x + tntSize, fuseY23, c3y, E.FUSE);

      // Fuse from cluster 3 down to cluster 4
      vline(grid, c3x, c3y + tntSize + 1, c4y, E.FUSE);
      hline(grid, c4x + tntSize, c3x, c4y, E.FUSE);

      // Fuse from cluster 3 down to cluster 5
      vline(grid, c3x + tntSize, c3y + tntSize + 1, c5y, E.FUSE);
      hline(grid, c3x + tntSize, c5x, c5y, E.FUSE);

      // Starting fuse tail for player to ignite (extends from cluster 1 upward)
      const fuseTopY = Math.max(2, c1y - Math.floor(h * 0.1));
      vline(grid, c1x, fuseTopY, c1y - 1, E.FUSE);
    },
    check(grid) {
      return countAll(grid, E.TNT) === 0;
    }
  },

  // ── Level 5: The Garden ──
  {
    name: "The Garden",
    description: "Grow plants to reach the goal",
    elements: [E.WATER, E.SEED],
    starTimes: [20, 40, 80],
    setup(grid) {
      const w = grid.width;
      const h = grid.height;
      // Soil (mud) bed at the bottom
      const soilY = Math.floor(h * 0.8);
      fillRect(grid, 0, soilY, w - 1, h - 1, E.MUD);
      // Goal markers in the top quarter
      const goalY = Math.floor(h * 0.15);
      const numGoals = 5;
      for (let i = 0; i < numGoals; i++) {
        const gx = Math.floor(w * (0.2 + i * 0.15));
        if (grid.inBounds(gx, goalY)) grid.set(gx, goalY, E.GOAL);
      }
      // Some wall platforms to make it interesting
      const platY = Math.floor(h * 0.55);
      hline(grid, Math.floor(w * 0.1), Math.floor(w * 0.35), platY, E.WALL);
      hline(grid, Math.floor(w * 0.5), Math.floor(w * 0.9), platY, E.WALL);
    },
    check(grid) {
      const h = grid.height;
      const w = grid.width;
      const topQuarter = Math.floor(h * 0.25);
      const count = countInRect(grid, 0, 0, w - 1, topQuarter, E.PLANT);
      return count >= 5;
    }
  },

  // ── Level 6: Oil & Water ──
  {
    name: "Oil & Water",
    description: "Burn away the oil without destroying the wood",
    elements: [E.FIRE, E.WATER],
    starTimes: [15, 30, 60],
    setup(grid) {
      const w = grid.width;
      const h = grid.height;
      // Wood structure: a table/platform shape
      const tableY = Math.floor(h * 0.6);
      const tableX1 = Math.floor(w * 0.2);
      const tableX2 = Math.floor(w * 0.8);
      const tableThick = Math.max(2, Math.floor(h * 0.03));
      // Table top
      fillRect(grid, tableX1, tableY, tableX2, tableY + tableThick - 1, E.WOOD);
      // Table legs
      const legW = Math.max(2, Math.floor(w * 0.03));
      const legH = Math.floor(h * 0.2);
      fillRect(grid, tableX1, tableY + tableThick, tableX1 + legW - 1, tableY + tableThick + legH, E.WOOD);
      fillRect(grid, tableX2 - legW + 1, tableY + tableThick, tableX2, tableY + tableThick + legH, E.WOOD);
      // Center leg
      const cLegX = Math.floor(w * 0.5) - Math.floor(legW / 2);
      fillRect(grid, cLegX, tableY + tableThick, cLegX + legW - 1, tableY + tableThick + legH, E.WOOD);
      // Oil pooled on top of the table
      const oilH = Math.max(3, Math.floor(h * 0.06));
      fillRect(grid, tableX1 + 1, tableY - oilH, tableX2 - 1, tableY - 1, E.OIL);
      // Walls on sides to contain oil
      vline(grid, tableX1 - 1, tableY - oilH - 1, tableY, E.WALL);
      vline(grid, tableX2 + 1, tableY - oilH - 1, tableY, E.WALL);
    },
    check(grid) {
      const oilCount = countAll(grid, E.OIL);
      const woodCount = countAll(grid, E.WOOD);
      return oilCount === 0 && woodCount >= 10;
    }
  },

  // ── Level 7: Acid Test ──
  {
    name: "Acid Test",
    description: "Use acid to dissolve a path to the goal",
    elements: [E.ACID],
    starTimes: [15, 35, 70],
    setup(grid) {
      const w = grid.width;
      const h = grid.height;
      // Stone barrier in the middle
      const barrierX = Math.floor(w * 0.4);
      const barrierW = Math.floor(w * 0.2);
      const barrierY1 = Math.floor(h * 0.2);
      const barrierY2 = Math.floor(h * 0.8);
      fillRect(grid, barrierX, barrierY1, barrierX + barrierW, barrierY2, E.STONE);
      // Metal walls on top and bottom to guide player toward the stone
      hline(grid, barrierX - 2, barrierX + barrierW + 2, barrierY1 - 1, E.METAL);
      hline(grid, barrierX - 2, barrierX + barrierW + 2, barrierY2 + 1, E.METAL);
      // Goal marker on the right side behind the barrier
      const goalX = Math.floor(w * 0.75);
      const goalY = Math.floor(h * 0.5);
      grid.set(goalX, goalY, E.GOAL);
      grid.set(goalX, goalY + 1, E.GOAL);
      grid.set(goalX + 1, goalY, E.GOAL);
      grid.set(goalX + 1, goalY + 1, E.GOAL);
      // Floor
      hline(grid, 0, w - 1, Math.floor(h * 0.85), E.WALL);
    },
    check(grid) {
      const w = grid.width;
      const h = grid.height;
      const barrierX = Math.floor(w * 0.4);
      const barrierW = Math.floor(w * 0.2);
      const barrierY1 = Math.floor(h * 0.2);
      const barrierY2 = Math.floor(h * 0.8);
      // Check if stone is gone from the barrier region
      const stoneRemaining = countInRect(grid, barrierX, barrierY1, barrierX + barrierW, barrierY2, E.STONE);
      return stoneRemaining === 0;
    }
  },

  // ── Level 8: Avalanche ──
  {
    name: "Avalanche",
    description: "Bury the targets under sand",
    elements: [E.SAND, E.GUNPOWDER, E.FIRE],
    starTimes: [10, 20, 40],
    setup(grid) {
      const w = grid.width;
      const h = grid.height;
      // Cliff/ledge on the left side
      const cliffX = Math.floor(w * 0.15);
      const cliffW = Math.floor(w * 0.4);
      // Cliff floor (wood support)
      const supportY = Math.floor(h * 0.45);
      hline(grid, cliffX, cliffX + cliffW, supportY, E.WOOD);
      // Thin wood support pillar holding the cliff
      const pillarX = Math.floor(w * 0.35);
      vline(grid, pillarX, supportY + 1, Math.floor(h * 0.85), E.WOOD);
      // Sand pile on top of the support
      const sandH = Math.floor(h * 0.2);
      fillRect(grid, cliffX + 1, supportY - sandH, cliffX + cliffW - 1, supportY - 1, E.SAND);
      // Left wall to contain sand
      vline(grid, cliffX, Math.floor(h * 0.2), supportY, E.WALL);
      // Goal markers below where sand will fall
      const goalY = Math.floor(h * 0.9);
      const goalX1 = Math.floor(w * 0.25);
      const goalX2 = Math.floor(w * 0.35);
      const goalX3 = Math.floor(w * 0.45);
      grid.set(goalX1, goalY, E.GOAL);
      grid.set(goalX2, goalY, E.GOAL);
      grid.set(goalX3, goalY, E.GOAL);
      // Floor
      hline(grid, 0, w - 1, Math.floor(h * 0.95), E.WALL);
    },
    check(grid) {
      const w = grid.width;
      const h = grid.height;
      const goalY = Math.floor(h * 0.9);
      const goalPositions = [
        [Math.floor(w * 0.25), goalY],
        [Math.floor(w * 0.35), goalY],
        [Math.floor(w * 0.45), goalY]
      ];
      // Check that each goal has sand directly above it
      for (const [gx, gy] of goalPositions) {
        let hasSandAbove = false;
        for (let checkY = gy - 1; checkY >= gy - 5; checkY--) {
          if (grid.inBounds(gx, checkY) && grid.get(gx, checkY) === E.SAND) {
            hasSandAbove = true;
            break;
          }
        }
        if (!hasSandAbove) return false;
      }
      return true;
    }
  },

  // ── Level 9: Steam Engine ──
  {
    name: "Steam Engine",
    description: "Generate steam to push sand into the goal",
    elements: [E.WATER, E.LAVA],
    starTimes: [20, 40, 80],
    setup(grid) {
      const w = grid.width;
      const h = grid.height;
      // Lava pool at the bottom inside a chamber
      const chamberX = Math.floor(w * 0.3);
      const chamberW = Math.floor(w * 0.4);
      const chamberBottom = Math.floor(h * 0.9);
      const chamberTop = Math.floor(h * 0.7);
      // Chamber walls (sides and bottom, top is open for steam to escape)
      hline(grid, chamberX, chamberX + chamberW, chamberBottom, E.WALL);
      vline(grid, chamberX, chamberTop, chamberBottom, E.WALL);
      vline(grid, chamberX + chamberW, chamberTop, chamberBottom, E.WALL);
      // Lava inside the chamber
      fillRect(grid, chamberX + 1, chamberBottom - 3, chamberX + chamberW - 1, chamberBottom - 1, E.LAVA);
      // Platform above the chamber with sand on it
      const platY = Math.floor(h * 0.55);
      const platX1 = Math.floor(w * 0.35);
      const platX2 = Math.floor(w * 0.65);
      hline(grid, platX1, platX2, platY, E.WALL);
      // Sand on the platform
      fillRect(grid, platX1 + 2, platY - 3, platX2 - 2, platY - 1, E.SAND);
      // Goal area marker at the top
      const goalY = Math.floor(h * 0.15);
      hline(grid, Math.floor(w * 0.35), Math.floor(w * 0.65), goalY, E.GOAL);
    },
    check(grid) {
      const w = grid.width;
      const h = grid.height;
      const goalRegionBottom = Math.floor(h * 0.25);
      const count = countInRect(grid, 0, 0, w - 1, goalRegionBottom, E.SAND);
      return count >= 5;
    }
  },

  // ── Level 10: The Bridge ──
  {
    name: "The Bridge",
    description: "Build a bridge for the water to cross",
    elements: [E.WALL, E.STONE, E.WOOD],
    starTimes: [12, 25, 50],
    setup(grid) {
      const w = grid.width;
      const h = grid.height;
      // Water source on the left
      const srcX = Math.floor(w * 0.1);
      const srcY = Math.floor(h * 0.35);
      grid.addSource(srcX, srcY, E.WATER);
      grid.addSource(srcX + 1, srcY, E.WATER);
      // Left platform
      const platY = Math.floor(h * 0.5);
      hline(grid, 0, Math.floor(w * 0.3), platY, E.WALL);
      // Right platform with pool
      const rightStart = Math.floor(w * 0.7);
      hline(grid, rightStart, w - 1, platY, E.WALL);
      // Right pool walls
      vline(grid, w - 1, platY - Math.floor(h * 0.15), platY, E.WALL);
      vline(grid, rightStart, platY - Math.floor(h * 0.15), platY, E.WALL);
      // Floor below the gap (so water falls if no bridge)
      hline(grid, 0, w - 1, Math.floor(h * 0.9), E.WALL);
      // Guide walls to funnel water onto the left platform
      hline(grid, 0, Math.floor(w * 0.3), Math.floor(h * 0.38), E.WALL);
      vline(grid, 0, Math.floor(h * 0.38), platY, E.WALL);
    },
    check(grid) {
      const w = grid.width;
      const h = grid.height;
      const rightStart = Math.floor(w * 0.7);
      const platY = Math.floor(h * 0.5);
      const poolTop = platY - Math.floor(h * 0.15);
      const count = countInRect(grid, rightStart + 1, poolTop + 1, w - 2, platY - 1, E.WATER);
      return count >= 15;
    }
  },

  // ── Level 11: Lava Forge ──
  {
    name: "Lava Forge",
    description: "Turn sand into glass using lava",
    elements: [E.LAVA, E.SAND],
    starTimes: [15, 30, 60],
    setup(grid) {
      const w = grid.width;
      const h = grid.height;
      // Forge container at the bottom
      const forgeX = Math.floor(w * 0.25);
      const forgeW = Math.floor(w * 0.5);
      const forgeY = Math.floor(h * 0.7);
      const forgeH = Math.floor(h * 0.2);
      // Forge floor and walls
      hline(grid, forgeX, forgeX + forgeW, forgeY + forgeH, E.WALL);
      vline(grid, forgeX, forgeY, forgeY + forgeH, E.WALL);
      vline(grid, forgeX + forgeW, forgeY, forgeY + forgeH, E.WALL);
      // Some lava already in the forge to get started
      const lavaH = Math.max(2, Math.floor(forgeH * 0.3));
      fillRect(grid, forgeX + 1, forgeY + forgeH - lavaH, forgeX + forgeW - 1, forgeY + forgeH - 1, E.LAVA);
      // Decorative walls creating a funnel above
      const funnelY = Math.floor(h * 0.5);
      const funnelLeft = Math.floor(w * 0.3);
      const funnelRight = Math.floor(w * 0.7);
      // Funnel walls angled inward (simulated with steps)
      for (let step = 0; step < 5; step++) {
        const sy = funnelY + step * 2;
        const offset = step * Math.floor(w * 0.02);
        if (grid.inBounds(funnelLeft - offset, sy)) grid.set(funnelLeft - offset, sy, E.WALL);
        if (grid.inBounds(funnelRight + offset, sy)) grid.set(funnelRight + offset, sy, E.WALL);
      }
    },
    check(grid) {
      const count = countAll(grid, E.GLASS);
      return count >= 20;
    }
  },

  // ── Level 12: Grand Finale ──
  {
    name: "Grand Finale",
    description: "Create the biggest explosion possible",
    elements: [E.TNT, E.NITRO, E.GUNPOWDER, E.FUSE, E.FIRE, E.METHANE],
    starTimes: [10, 20, 40],
    setup(grid) {
      const w = grid.width;
      const h = grid.height;
      // Open arena with wall border
      hline(grid, 0, w - 1, 0, E.WALL);
      hline(grid, 0, w - 1, h - 1, E.WALL);
      vline(grid, 0, 0, h - 1, E.WALL);
      vline(grid, w - 1, 0, h - 1, E.WALL);
      // Some internal wall pillars for visual interest
      const pillarSize = Math.max(2, Math.floor(w * 0.03));
      // Pillar 1 - top left
      const p1x = Math.floor(w * 0.25);
      const p1y = Math.floor(h * 0.25);
      fillRect(grid, p1x, p1y, p1x + pillarSize, p1y + pillarSize, E.WALL);
      // Pillar 2 - top right
      const p2x = Math.floor(w * 0.75) - pillarSize;
      const p2y = Math.floor(h * 0.25);
      fillRect(grid, p2x, p2y, p2x + pillarSize, p2y + pillarSize, E.WALL);
      // Pillar 3 - bottom left
      const p3x = Math.floor(w * 0.25);
      const p3y = Math.floor(h * 0.7);
      fillRect(grid, p3x, p3y, p3x + pillarSize, p3y + pillarSize, E.WALL);
      // Pillar 4 - bottom right
      const p4x = Math.floor(w * 0.75) - pillarSize;
      const p4y = Math.floor(h * 0.7);
      fillRect(grid, p4x, p4y, p4x + pillarSize, p4y + pillarSize, E.WALL);
      // Central cross wall
      const cx = Math.floor(w * 0.5);
      const cy = Math.floor(h * 0.5);
      hline(grid, cx - pillarSize, cx + pillarSize, cy, E.WALL);
      vline(grid, cx, cy - pillarSize, cy + pillarSize, E.WALL);
      // Pre-place some explosives to get the player started
      const tntBlock = Math.max(2, Math.floor(w * 0.04));
      // TNT cluster in center-left
      fillRect(grid, Math.floor(w * 0.15), Math.floor(h * 0.45), Math.floor(w * 0.15) + tntBlock, Math.floor(h * 0.45) + tntBlock, E.TNT);
      // Gunpowder trail connecting left TNT toward center
      hline(grid, Math.floor(w * 0.15) + tntBlock + 1, Math.floor(w * 0.35), Math.floor(h * 0.48), E.GUNPOWDER);
      // Nitro in center-right
      fillRect(grid, Math.floor(w * 0.6), Math.floor(h * 0.45), Math.floor(w * 0.6) + tntBlock, Math.floor(h * 0.45) + tntBlock, E.NITRO);
      // Methane cloud above center
      fillRect(grid, Math.floor(w * 0.35), Math.floor(h * 0.15), Math.floor(w * 0.65), Math.floor(h * 0.25), E.METHANE);
    },
    check(grid) {
      const tnt = countAll(grid, E.TNT);
      const nitro = countAll(grid, E.NITRO);
      const gunpowder = countAll(grid, E.GUNPOWDER);
      return tnt === 0 && nitro === 0 && gunpowder === 0;
    }
  }
];

// ── ChallengeManager Class ───────────────────────────────────────────────────

class ChallengeManager {
  constructor() {
    this.active = false;       // is a challenge currently running?
    this.currentLevel = null;  // current level index
    this.startTime = 0;
    this.won = false;
    this.stars = 0;
    this.particlesUsed = 0;
    this.allowedElements = null; // null = all allowed
    this.checkInterval = null;
    // Load progress
    this.progress = JSON.parse(localStorage.getItem("simChallengeProgress") || "{}");
  }

  getLevels() { return CHALLENGE_LEVELS; }

  getStars(levelIdx) {
    return this.progress[levelIdx] || 0;
  }

  getTotalStars() {
    let sum = 0;
    for (const k in this.progress) sum += this.progress[k];
    return sum;
  }

  startLevel(levelIdx, grid) {
    const level = CHALLENGE_LEVELS[levelIdx];
    if (!level) return false;
    this.active = true;
    this.currentLevel = levelIdx;
    this.won = false;
    this.stars = 0;
    this.particlesUsed = 0;
    this.startTime = Date.now();
    // Build allowed elements list: always include EMPTY + level-specific elements
    this.allowedElements = [E.EMPTY, ...(level.elements || [])];

    // Clear grid and set up the level
    grid.clear();
    level.setup(grid);
    grid.dirtyChunks.fill(1);
    grid.activeChunks.fill(1);
    return level;
  }

  checkWin(grid) {
    if (!this.active || this.won) return false;
    const level = CHALLENGE_LEVELS[this.currentLevel];
    if (!level) return false;

    const result = level.check(grid);
    if (result) {
      this.won = true;
      const elapsed = (Date.now() - this.startTime) / 1000;
      // Star rating: 3 stars if fast, 2 if moderate, 1 if slow
      const t = level.starTimes || [15, 30, 60];
      if (elapsed <= t[0]) this.stars = 3;
      else if (elapsed <= t[1]) this.stars = 2;
      else this.stars = 1;
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
