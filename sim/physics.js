// ── Physics Engine ────────────────────────────────────────────────
"use strict";

class PhysicsEngine {
  constructor(grid) {
    this.grid = grid;
    this.gravityDir = 1; // 1 = down, -1 = up
    this.gravityX = 0;  // -1 to 1, horizontal gravity from accelerometer
    this.gravityStrength = 1; // 0 to 1, how strong vertical gravity is (accelerometer)
    this.openBottom = localStorage.getItem("simOpenBottom") === "true";
    this.simSpeed = parseInt(localStorage.getItem("simSpeed")) || 1;
    this.wind = 0; // -3 to 3, negative = left, positive = right
  }

  update() {
    const g = this.grid;
    g.beginFrame();
    const w = g.width, h = g.height;
    const gDir = this.gravityDir;

    // Open bottom: delete particles on the gravity-facing edge
    if (this.openBottom) {
      this.processOpenEdge(w, h, gDir);
    }

    // Alternate scan direction to prevent bias
    const leftToRight = g.tick & 1;

    // Scan bottom-to-top if gravity down, top-to-bottom if gravity up
    const yStart = gDir > 0 ? h - 1 : 0;
    const yEnd   = gDir > 0 ? -1 : h;
    const yStep  = gDir > 0 ? -1 : 1;

    for (let y = yStart; y !== yEnd; y += yStep) {
      const xStart = leftToRight ? 0 : w - 1;
      const xEnd   = leftToRight ? w : -1;
      const xStep  = leftToRight ? 1 : -1;

      for (let x = xStart; x !== xEnd; x += xStep) {
        const i = y * w + x;
        if (g.type[i] === E.EMPTY || g.moved[i]) continue;

        // Check if in active chunk
        const cx = (x / CHUNK_SIZE) | 0;
        const cy = (y / CHUNK_SIZE) | 0;
        if (!g.activeChunks[cy * g.chunksX + cx]) continue;

        this.updateParticle(x, y, i, w, h, gDir);
      }
    }

    // Spawn from sources
    this.processSources();

    // Temperature diffusion pass (simplified)
    this.diffuseTemperature();
  }

  updateParticle(x, y, i, w, h, gDir) {
    const g = this.grid;
    const t = g.type[i];
    const el = ELEMENTS[t];
    if (!el) return;

    // Lifetime
    if (g.lifetime[i] > 0) {
      g.lifetime[i]--;
      if (g.lifetime[i] <= 0) {
        this.removeParticle(x, y, i);
        return;
      }
    }

    // Temperature effects
    this.processTemperature(x, y, i, t, el);
    // Recheck type after temp (it might have changed)
    if (g.type[i] !== t) return;

    // Element-specific behavior
    switch(t) {
      case E.FIRE:    this.updateFire(x, y, i, gDir); return;
      case E.ACID:    this.updateAcid(x, y, i, gDir); break;
      case E.VIRUS:   this.updateVirus(x, y, i); break;
      case E.CLONE:   this.updateClone(x, y, i); return;
      case E.VOID:    this.updateVoid(x, y, i); return;
      case E.SEED:    this.updateSeed(x, y, i, gDir); break;
      case E.PLANT:   this.updatePlant(x, y, i); return;
      case E.LIGHTNING: this.updateLightning(x, y, i, gDir); return;
      case E.PLASMA:  this.updatePlasma(x, y, i); break;
      case E.EMBER:   this.updateEmber(x, y, i, gDir); break;
      case E.CEMENT:  this.updateCement(x, y, i, gDir); break;
      case E.ANT:      this.updateAnt(x, y, i, gDir); return;
      case E.FIREWORK:  this.updateFirework(x, y, i, gDir); break;
      case E.TORCH:    this.updateTorch(x, y, i); return;
      case E.BATTERY:  this.updateBattery(x, y, i); return;
      case E.WIRE:     this.updateWire(x, y, i); return;
    }

    // Recheck type
    if (g.type[i] !== t) return;

    // Movement based on state
    switch(el.state) {
      case STATE.POWDER: this.movePowder(x, y, i, gDir); break;
      case STATE.LIQUID: this.moveLiquid(x, y, i, gDir, el.density); break;
      case STATE.GAS:    this.moveGas(x, y, i, gDir); break;
      case STATE.PLASMA: this.moveGas(x, y, i, gDir); break;
      // SOLID and STATIC don't move
    }
  }

  processTemperature(x, y, i, t, el) {
    const g = this.grid;
    const temp = g.temp[i];

    // Melting
    if (temp >= el.meltPoint && el.meltsTo !== E.EMPTY) {
      g.type[i] = el.meltsTo;
      const c = getElemColor(el.meltsTo);
      g.colorR[i] = c[0]; g.colorG[i] = c[1]; g.colorB[i] = c[2];
      const newEl = ELEMENTS[el.meltsTo];
      g.lifetime[i] = newEl.lifetime > 0 ? newEl.lifetime : -1;
      g.markDirty(x, y); g.markActive(x, y);
      return;
    }

    // Boiling
    if (temp >= el.boilPoint && el.boilsTo !== E.EMPTY) {
      g.type[i] = el.boilsTo;
      const c = getElemColor(el.boilsTo);
      g.colorR[i] = c[0]; g.colorG[i] = c[1]; g.colorB[i] = c[2];
      const newEl = ELEMENTS[el.boilsTo];
      g.lifetime[i] = newEl.lifetime > 0 ? newEl.lifetime + ((Math.random() * newEl.lifetime * 0.4) | 0) : -1;
      g.markDirty(x, y); g.markActive(x, y);
      return;
    }

    // Freezing
    if (el.freezesTo >= 0 && temp <= el.freezePoint) {
      g.type[i] = el.freezesTo;
      const c = getElemColor(el.freezesTo);
      g.colorR[i] = c[0]; g.colorG[i] = c[1]; g.colorB[i] = c[2];
      const newEl = ELEMENTS[el.freezesTo];
      g.lifetime[i] = newEl.lifetime > 0 ? newEl.lifetime : -1;
      g.markDirty(x, y); g.markActive(x, y);
      return;
    }
  }

  diffuseTemperature() {
    const g = this.grid;
    const w = g.width, h = g.height;

    // Simple heat diffusion — only process active chunks
    for (let cy = 0; cy < g.chunksY; cy++) {
      for (let cx = 0; cx < g.chunksX; cx++) {
        if (!g.activeChunks[cy * g.chunksX + cx]) continue;

        const x0 = cx * CHUNK_SIZE;
        const y0 = cy * CHUNK_SIZE;
        const x1 = Math.min(x0 + CHUNK_SIZE, w);
        const y1 = Math.min(y0 + CHUNK_SIZE, h);

        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            const i = y * w + x;
            if (g.type[i] === E.EMPTY) {
              // Empty cells drift toward ambient
              if (g.temp[i] !== AMBIENT_TEMP) {
                g.temp[i] += (AMBIENT_TEMP - g.temp[i]) * 0.05;
                if (Math.abs(g.temp[i] - AMBIENT_TEMP) < 0.5) g.temp[i] = AMBIENT_TEMP;
              }
              continue;
            }

            const el = ELEMENTS[g.type[i]];
            if (!el) continue;
            const cond = el.conductivity;

            // Average with neighbors
            let sum = 0, count = 0;
            if (x > 0 && g.type[i-1] !== E.EMPTY) { sum += g.temp[i-1]; count++; }
            if (x < w-1 && g.type[i+1] !== E.EMPTY) { sum += g.temp[i+1]; count++; }
            if (y > 0 && g.type[i-w] !== E.EMPTY) { sum += g.temp[i-w]; count++; }
            if (y < h-1 && g.type[i+w] !== E.EMPTY) { sum += g.temp[i+w]; count++; }

            if (count > 0) {
              const avg = sum / count;
              const diff = avg - g.temp[i];
              if (Math.abs(diff) > 0.1) {
                g.temp[i] += diff * cond * 0.15;
                if (Math.abs(diff) > 5) g.markActive(x, y);
              }
            }

            // Ambient cooling
            g.temp[i] += (AMBIENT_TEMP - g.temp[i]) * 0.002;
          }
        }
      }
    }
  }

  processSources() {
    const g = this.grid;
    const w = g.width, h = g.height;

    for (const [key, elemId] of g.sources) {
      const parts = key.split(",");
      const sx = parseInt(parts[0]), sy = parseInt(parts[1]);
      const i = sy * w + sx;

      // Keep the source chunk active so it always spawns
      g.markActive(sx, sy);

      // If the source cell itself is empty, fill it directly
      if (g.type[i] === E.EMPTY) {
        g.set(sx, sy, elemId);
        continue;
      }

      // Otherwise try to spawn into an adjacent empty cell
      // Prefer downward for solids/liquids, upward for gases
      const el = ELEMENTS[elemId];
      let dirs;
      if (el && (el.state === STATE.GAS || el.state === STATE.PLASMA)) {
        dirs = [[0,-1],[-1,-1],[1,-1],[-1,0],[1,0],[0,1]];
      } else {
        dirs = [[0,1],[-1,1],[1,1],[-1,0],[1,0],[0,-1]];
      }

      for (const [dx, dy] of dirs) {
        const nx = sx + dx, ny = sy + dy;
        if (!g.inBounds(nx, ny)) continue;
        const ni = ny * w + nx;
        if (g.type[ni] === E.EMPTY) {
          g.set(nx, ny, elemId);
          break;
        }
      }
    }
  }

  processOpenEdge(w, h, gDir) {
    const g = this.grid;
    const edgeY = gDir > 0 ? h - 1 : 0;
    for (let x = 0; x < w; x++) {
      const i = edgeY * w + x;
      const t = g.type[i];
      if (t === E.EMPTY || t === E.WALL || t === E.VOID || t === E.CLONE) continue;
      const el = ELEMENTS[t];
      if (!el) continue;
      // Only remove movable particles (not static solids)
      if (el.state === STATE.STATIC) continue;
      this.removeParticle(x, edgeY, i);
    }
  }

  movePowder(x, y, i, gDir) {
    const g = this.grid;
    const w = g.width, h = g.height;
    const gStr = this.gravityStrength;

    // Skip vertical movement probabilistically based on gravity strength
    const doVertical = gStr >= 1 || Math.random() < gStr;

    if (doVertical) {
      const below = y + gDir;
      if (below >= 0 && below < h) {
        const iBelow = below * w + x;
        const tBelow = g.type[iBelow];

        // Fall straight down
        if (tBelow === E.EMPTY) {
          this.swapCells(x, y, i, x, below, iBelow);
          return;
        }

        // Fall into liquid (density check)
        const elBelow = ELEMENTS[tBelow];
        const elSelf  = ELEMENTS[g.type[i]];
        if (elBelow && elSelf && elBelow.state === STATE.LIQUID && elSelf.density > elBelow.density) {
          this.swapCells(x, y, i, x, below, iBelow);
          return;
        }

        // Slide diagonally
        const gx = this.gravityX;
        const dir = gx !== 0 ? (Math.random() < (0.5 + gx * 0.4) ? 1 : -1) : (Math.random() < 0.5 ? -1 : 1);
        for (const d of [dir, -dir]) {
          const nx = x + d;
          if (nx < 0 || nx >= w) continue;
          const ni = below * w + nx;
          const nt = g.type[ni];
          if (nt === E.EMPTY) {
            this.swapCells(x, y, i, nx, below, ni);
            return;
          }
          if (ELEMENTS[nt] && ELEMENTS[nt].state === STATE.LIQUID && elSelf && elSelf.density > ELEMENTS[nt].density) {
            this.swapCells(x, y, i, nx, below, ni);
            return;
          }
        }
      }
    }

    // Horizontal gravity drift (accelerometer)
    const gx = this.gravityX;
    if (gx !== 0 && Math.random() < Math.abs(gx) * 0.6) {
      const hdir = gx > 0 ? 1 : -1;
      const nx = x + hdir;
      if (nx >= 0 && nx < w) {
        const ni = y * w + nx;
        if (g.type[ni] === E.EMPTY) {
          this.swapCells(x, y, i, nx, y, ni);
          return;
        }
      }
    }

    // Wind drift for light powders
    if (this.wind !== 0) {
      const el = ELEMENTS[g.type[i]];
      if (el && el.density < 3) {
        const wd = this.wind > 0 ? 1 : -1;
        if (Math.random() < Math.abs(this.wind) * 0.1) {
          const nx = x + wd;
          if (nx >= 0 && nx < w && g.type[y * w + nx] === E.EMPTY) {
            this.swapCells(x, y, i, nx, y, y * w + nx);
          }
        }
      }
    }
  }

  moveLiquid(x, y, i, gDir, density) {
    const g = this.grid;
    const w = g.width, h = g.height;
    const gStr = this.gravityStrength;
    const doVertical = gStr >= 1 || Math.random() < gStr;

    if (doVertical) {
      const below = y + gDir;
      // Fall down
      if (below >= 0 && below < h) {
        const iBelow = below * w + x;
        const tBelow = g.type[iBelow];

        if (tBelow === E.EMPTY) {
          this.swapCells(x, y, i, x, below, iBelow);
          return;
        }

        // Displace lighter liquids
        const elBelow = ELEMENTS[tBelow];
        if (elBelow && elBelow.state === STATE.LIQUID && density > elBelow.density) {
          this.swapCells(x, y, i, x, below, iBelow);
          return;
        }

        // Diagonal down
        const gx = this.gravityX;
        const dir = gx !== 0 ? (Math.random() < (0.5 + gx * 0.4) ? 1 : -1) : (Math.random() < 0.5 ? -1 : 1);
        for (const d of [dir, -dir]) {
          const nx = x + d;
          if (nx < 0 || nx >= w) continue;
          const ni = below * w + nx;
          if (g.type[ni] === E.EMPTY) {
            this.swapCells(x, y, i, nx, below, ni);
            return;
          }
        }
      }
    }

    // Horizontal gravity drift (accelerometer)
    const gx = this.gravityX;
    if (gx !== 0 && Math.random() < Math.abs(gx) * 0.5) {
      const hdir = gx > 0 ? 1 : -1;
      const nx = x + hdir;
      if (nx >= 0 && nx < w) {
        const ni = y * w + nx;
        if (g.type[ni] === E.EMPTY) {
          this.swapCells(x, y, i, nx, y, ni);
          return;
        }
      }
    }

    // Spread sideways (liquid flow) — bias toward gravityX
    const spreadDist = 3 + ((Math.random() * 2) | 0);
    const dir = gx !== 0 ? (Math.random() < (0.5 + gx * 0.4) ? 1 : -1) : (Math.random() < 0.5 ? -1 : 1);
    for (const d of [dir, -dir]) {
      for (let s = 1; s <= spreadDist; s++) {
        const nx = x + d * s;
        if (nx < 0 || nx >= w) break;
        const ni = y * w + nx;
        if (g.type[ni] !== E.EMPTY) break;
        if (s === spreadDist || Math.random() < 0.3) {
          this.swapCells(x, y, i, nx, y, ni);
          return;
        }
      }
    }
  }

  moveGas(x, y, i, gDir) {
    const g = this.grid;
    const w = g.width, h = g.height;
    const gStr = this.gravityStrength;
    const doVertical = gStr >= 1 || Math.random() < gStr;

    if (doVertical) {
      const above = y - gDir; // gases go opposite to gravity
      // Rise
      if (above >= 0 && above < h) {
        const iAbove = above * w + x;
        if (g.type[iAbove] === E.EMPTY) {
          this.swapCells(x, y, i, x, above, iAbove);
          return;
        }
        // Displace liquids
        const elAbove = ELEMENTS[g.type[iAbove]];
        if (elAbove && (elAbove.state === STATE.LIQUID || elAbove.state === STATE.POWDER)) {
          this.swapCells(x, y, i, x, above, iAbove);
          return;
        }
      }
    }

    // Random lateral movement with wind + accelerometer influence
    const gx = this.gravityX;
    const windBias = this.wind > 0 ? (Math.random() < Math.abs(this.wind) * 0.2 ? 1 : 0) : (this.wind < 0 ? (Math.random() < Math.abs(this.wind) * 0.2 ? -1 : 0) : 0);
    const accelBias = gx !== 0 ? (Math.random() < Math.abs(gx) * 0.4 ? (gx > 0 ? 1 : -1) : 0) : 0;
    const dx = ((Math.random() * 3) | 0) - 1 + windBias + accelBias;
    const dy = ((Math.random() * 3) | 0) - 1;
    const nx = x + dx, ny = y + dy;
    if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
      const ni = ny * w + nx;
      if (g.type[ni] === E.EMPTY) {
        this.swapCells(x, y, i, nx, ny, ni);
        return;
      }
    }
  }

  swapCells(x1, y1, i1, x2, y2, i2) {
    const g = this.grid;
    g.swap(i1, i2);
    g.moved[i2] = 1;
    g.markDirty(x1, y1);
    g.markDirty(x2, y2);
    g.markActive(x1, y1);
    g.markActive(x2, y2);
  }

  removeParticle(x, y, i) {
    const g = this.grid;
    g.type[i] = E.EMPTY;
    g.colorR[i] = 26; g.colorG[i] = 26; g.colorB[i] = 46;
    g.temp[i] = AMBIENT_TEMP;
    g.lifetime[i] = -1;
    g.extra[i] = 0;
    g.markDirty(x, y);
    g.markActive(x, y);
  }

  setCell(x, y, elemId) {
    const g = this.grid;
    if (!g.inBounds(x, y)) return;
    g.set(x, y, elemId);
  }

  // ── Fire ──
  updateFire(x, y, i, gDir) {
    const g = this.grid;
    const w = g.width, h = g.height;

    // Fire heats surroundings and ignites flammable things
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx, ny = y + dy;
        if (!g.inBounds(nx, ny)) continue;
        const ni = ny * w + nx;
        const nt = g.type[ni];

        if (nt === E.EMPTY) continue;

        // Heat neighbors
        g.temp[ni] += 8;

        if (nt === E.WATER || nt === E.SALTWATER) {
          // Fire + water = steam
          g.type[ni] = E.STEAM;
          const c = getElemColor(E.STEAM);
          g.colorR[ni] = c[0]; g.colorG[ni] = c[1]; g.colorB[ni] = c[2];
          g.lifetime[ni] = 150 + (Math.random() * 80) | 0;
          this.removeParticle(x, y, i);
          g.markDirty(nx, ny); g.markActive(nx, ny);
          return;
        }

        const nel = ELEMENTS[nt];
        if (nel && nel.flammability > 0 && Math.random() < nel.flammability * 0.08) {
          // Check for explosion
          if (nel.explosionPower > 1) {
            this.explode(nx, ny, nel.explosionPower);
            continue;
          }
          // Ignite
          g.type[ni] = E.FIRE;
          const c = getElemColor(E.FIRE);
          g.colorR[ni] = c[0]; g.colorG[ni] = c[1]; g.colorB[ni] = c[2];
          g.lifetime[ni] = 20 + (Math.random() * 20) | 0;
          g.temp[ni] = 600;
          g.markDirty(nx, ny); g.markActive(nx, ny);
        }
      }
    }

    // Fire rises and flickers
    if (Math.random() < 0.3) {
      // Produce smoke
      const above = y - gDir;
      if (above >= 0 && above < h && g.type[above * w + x] === E.EMPTY) {
        g.set(above * w + x > -1 ? x : x, above, E.SMOKE);
      }
    }

    // Move upward
    this.moveGas(x, y, i, gDir);
  }

  // ── Acid ──
  updateAcid(x, y, i, gDir) {
    const g = this.grid;
    const w = g.width;

    // Dissolve adjacent non-acid materials
    const dirs = [[-1,0],[1,0],[0,1],[0,-1]];
    for (const [dx, dy] of dirs) {
      const nx = x + dx, ny = y + dy;
      if (!g.inBounds(nx, ny)) continue;
      const ni = ny * w + nx;
      const nt = g.type[ni];
      if (nt === E.EMPTY || nt === E.ACID || nt === E.VOID || nt === E.WALL) continue;

      const nel = ELEMENTS[nt];
      if (!nel) continue;

      // Resistance check
      if (Math.random() > nel.corrosionResist) {
        if (Math.random() < 0.15) {
          // Acid consumed, target dissolved
          this.removeParticle(nx, ny, ni);
          if (Math.random() < 0.5) {
            g.type[ni] = E.SMOKE;
            const c = getElemColor(E.SMOKE);
            g.colorR[ni] = c[0]; g.colorG[ni] = c[1]; g.colorB[ni] = c[2];
            g.lifetime[ni] = 40 + (Math.random() * 40) | 0;
          }
          this.removeParticle(x, y, i);
          g.markDirty(nx, ny); g.markActive(nx, ny);
          return;
        }
      }
    }
  }

  // ── Virus ──
  updateVirus(x, y, i) {
    const g = this.grid;
    const w = g.width;

    if (Math.random() > 0.1) return;

    const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
    const [dx, dy] = dirs[(Math.random() * 4) | 0];
    const nx = x + dx, ny = y + dy;
    if (!g.inBounds(nx, ny)) return;
    const ni = ny * w + nx;
    const nt = g.type[ni];
    if (nt !== E.EMPTY && nt !== E.VIRUS && nt !== E.VOID && nt !== E.WALL && nt !== E.CLONE) {
      g.type[ni] = E.VIRUS;
      const c = getElemColor(E.VIRUS);
      g.colorR[ni] = c[0]; g.colorG[ni] = c[1]; g.colorB[ni] = c[2];
      g.lifetime[ni] = 200 + (Math.random() * 100) | 0;
      g.markDirty(nx, ny); g.markActive(nx, ny);
    }
  }

  // ── Clone ──
  updateClone(x, y, i) {
    const g = this.grid;
    const w = g.width;
    const src = g.extra[i];

    // If no source, absorb touching element
    if (src === 0 || src === E.EMPTY) {
      const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
      for (const [dx, dy] of dirs) {
        const nx = x + dx, ny = y + dy;
        if (!g.inBounds(nx, ny)) continue;
        const nt = g.type[ny * w + nx];
        if (nt !== E.EMPTY && nt !== E.CLONE && nt !== E.VOID && nt !== E.WALL) {
          g.extra[i] = nt;
          // Tint the clone
          const c = getElemColor(nt);
          g.colorR[i] = ((255 + c[0]) / 2) | 0;
          g.colorG[i] = ((220 + c[1]) / 2) | 0;
          g.colorB[i] = ((50 + c[2]) / 2) | 0;
          g.markDirty(x, y);
          return;
        }
      }
      return;
    }

    // Produce cloned element in empty neighbor
    if (Math.random() > 0.15) return;
    const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
    const [dx, dy] = dirs[(Math.random() * 4) | 0];
    const nx = x + dx, ny = y + dy;
    if (!g.inBounds(nx, ny)) return;
    const ni = ny * w + nx;
    if (g.type[ni] === E.EMPTY) {
      g.set(nx, ny, src);
      g.markDirty(nx, ny); g.markActive(nx, ny);
    }
  }

  // ── Void ──
  updateVoid(x, y, i) {
    const g = this.grid;
    const w = g.width;
    const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
    for (const [dx, dy] of dirs) {
      const nx = x + dx, ny = y + dy;
      if (!g.inBounds(nx, ny)) continue;
      const ni = ny * w + nx;
      const nt = g.type[ni];
      if (nt !== E.EMPTY && nt !== E.VOID && nt !== E.WALL && nt !== E.CLONE) {
        this.removeParticle(nx, ny, ni);
      }
    }
  }

  // ── Seed ──
  updateSeed(x, y, i, gDir) {
    const g = this.grid;
    const w = g.width;
    const below = y + gDir;

    // If seed lands on something solid or on ground, grow into plant
    if (below >= 0 && below < g.height) {
      const nt = g.type[below * w + x];
      if (nt !== E.EMPTY && nt !== E.WATER && nt !== E.SEED) {
        if (Math.random() < 0.05) {
          g.type[i] = E.PLANT;
          const c = getElemColor(E.PLANT);
          g.colorR[i] = c[0]; g.colorG[i] = c[1]; g.colorB[i] = c[2];
          g.lifetime[i] = -1;
          g.markDirty(x, y); g.markActive(x, y);
          return;
        }
      }
    }
  }

  // ── Plant ──
  updatePlant(x, y, i) {
    const g = this.grid;
    const w = g.width;

    if (Math.random() > 0.02) return;

    // Grow towards water/light (upward bias)
    const growDirs = [[0,-1],[0,-1],[-1,-1],[1,-1],[-1,0],[1,0]];
    const [dx, dy] = growDirs[(Math.random() * growDirs.length) | 0];
    const nx = x + dx, ny = y + dy;
    if (!g.inBounds(nx, ny)) return;
    const ni = ny * w + nx;
    const nt = g.type[ni];

    // Absorb water to grow
    if (nt === E.WATER) {
      g.type[ni] = E.PLANT;
      const c = getElemColor(E.PLANT);
      // Slightly vary green
      g.colorR[ni] = c[0] + ((Math.random() * 20 - 10) | 0);
      g.colorG[ni] = c[1] + ((Math.random() * 30 - 5) | 0);
      g.colorB[ni] = c[2] + ((Math.random() * 20 - 10) | 0);
      g.lifetime[ni] = -1;
      g.markDirty(nx, ny); g.markActive(nx, ny);
    } else if (nt === E.EMPTY && Math.random() < 0.3) {
      // Slow growth into air
      g.set(nx, ny, E.PLANT);
      g.markDirty(nx, ny); g.markActive(nx, ny);
    }
  }

  // ── Lightning ──
  updateLightning(x, y, i, gDir) {
    const g = this.grid;
    const w = g.width, h = g.height;

    // Heat everything around
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const nx = x + dx, ny = y + dy;
        if (!g.inBounds(nx, ny)) continue;
        const ni = ny * w + nx;
        if (g.type[ni] !== E.EMPTY) {
          g.temp[ni] += 200;
          g.markActive(nx, ny);
          // Ignite
          const nel = ELEMENTS[g.type[ni]];
          if (nel && nel.flammability > 0 && Math.random() < 0.3) {
            if (nel.explosionPower > 1) {
              this.explode(nx, ny, nel.explosionPower);
            } else {
              g.type[ni] = E.FIRE;
              const c = getElemColor(E.FIRE);
              g.colorR[ni] = c[0]; g.colorG[ni] = c[1]; g.colorB[ni] = c[2];
              g.lifetime[ni] = 30 + (Math.random() * 20) | 0;
              g.temp[ni] = 600;
            }
          }
          // Sand -> glass
          if (g.type[ni] === E.SAND) {
            g.type[ni] = E.GLASS;
            const c = getElemColor(E.GLASS);
            g.colorR[ni] = c[0]; g.colorG[ni] = c[1]; g.colorB[ni] = c[2];
          }
        }
      }
    }

    // Bolt moves downward erratically
    const ny = y + gDir;
    const nx = x + ((Math.random() * 3) | 0) - 1;
    if (g.inBounds(nx, ny)) {
      const ni = ny * w + nx;
      if (g.type[ni] === E.EMPTY || ELEMENTS[g.type[ni]].state !== STATE.STATIC) {
        if (g.type[ni] !== E.EMPTY && g.type[ni] !== E.LIGHTNING) {
          // Destroy what it hits
          const nel = ELEMENTS[g.type[ni]];
          if (nel && nel.explosionPower > 1) {
            this.explode(nx, ny, nel.explosionPower);
          }
        }
        this.removeParticle(x, y, i);
        g.set(nx, ny, E.LIGHTNING);
      }
    }
  }

  // ── Plasma ──
  updatePlasma(x, y, i) {
    const g = this.grid;
    const w = g.width;

    // Heat everything nearby
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (!g.inBounds(nx, ny)) continue;
        const ni = ny * w + nx;
        if (g.type[ni] !== E.EMPTY && g.type[ni] !== E.PLASMA) {
          g.temp[ni] += 50;
          g.markActive(nx, ny);
        }
      }
    }
  }

  // ── Ember ──
  updateEmber(x, y, i, gDir) {
    const g = this.grid;
    const w = g.width;

    // Ignite neighbors
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx, ny = y + dy;
        if (!g.inBounds(nx, ny)) continue;
        const ni = ny * w + nx;
        const nel = ELEMENTS[g.type[ni]];
        if (nel && nel.flammability > 0 && Math.random() < nel.flammability * 0.05) {
          if (nel.explosionPower > 1) {
            this.explode(nx, ny, nel.explosionPower);
          } else {
            g.type[ni] = E.FIRE;
            const c = getElemColor(E.FIRE);
            g.colorR[ni] = c[0]; g.colorG[ni] = c[1]; g.colorB[ni] = c[2];
            g.lifetime[ni] = 20 + (Math.random() * 20) | 0;
            g.markDirty(nx, ny); g.markActive(nx, ny);
          }
        }
      }
    }
    g.temp[i] += 5; // Stays hot
  }

  // ── Cement ──
  updateCement(x, y, i, gDir) {
    const g = this.grid;
    const w = g.width;
    const below = y + gDir;

    // Cement hardens into concrete when touching water
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx, ny = y + dy;
        if (!g.inBounds(nx, ny)) continue;
        const ni = ny * w + nx;
        if (g.type[ni] === E.WATER && Math.random() < 0.03) {
          g.type[i] = E.CONCRETE;
          const c = getElemColor(E.CONCRETE);
          g.colorR[i] = c[0]; g.colorG[i] = c[1]; g.colorB[i] = c[2];
          g.lifetime[i] = -1;
          // Remove the water
          this.removeParticle(nx, ny, ni);
          g.markDirty(x, y); g.markActive(x, y);
          return;
        }
      }
    }
  }

  // ── Explosions ──
  explode(cx, cy, power) {
    const g = this.grid;
    const w = g.width, h = g.height;
    const radius = power + ((Math.random() * power * 0.5) | 0);

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > radius) continue;

        const nx = cx + dx, ny = cy + dy;
        if (!g.inBounds(nx, ny)) continue;
        const ni = ny * w + nx;
        const nt = g.type[ni];

        if (nt === E.WALL || nt === E.VOID || nt === E.CLONE) continue;

        if (nt === E.EMPTY) {
          // Create fire/smoke in blast area
          if (dist < radius * 0.6 && Math.random() < 0.4) {
            g.set(nx, ny, E.FIRE);
          } else if (Math.random() < 0.2) {
            g.set(nx, ny, E.SMOKE);
          }
          continue;
        }

        // Chain explosions
        const nel = ELEMENTS[nt];
        if (nel && nel.explosionPower > 1 && nt !== E.FIRE) {
          // Delay chain explosions slightly
          g.type[ni] = E.FIRE;
          const c = getElemColor(E.FIRE);
          g.colorR[ni] = c[0]; g.colorG[ni] = c[1]; g.colorB[ni] = c[2];
          g.lifetime[ni] = 3 + (Math.random() * 5) | 0;
          g.temp[ni] = 2000;
          g.markDirty(nx, ny); g.markActive(nx, ny);
          continue;
        }

        // Destroy or scatter
        if (dist < radius * 0.4) {
          // Inner blast - destroy
          if (Math.random() < 0.7) {
            g.type[ni] = Math.random() < 0.5 ? E.FIRE : E.SMOKE;
            const c = getElemColor(g.type[ni]);
            g.colorR[ni] = c[0]; g.colorG[ni] = c[1]; g.colorB[ni] = c[2];
            g.lifetime[ni] = g.type[ni] === E.FIRE ? 15 + (Math.random() * 15) | 0 : 60 + (Math.random() * 60) | 0;
            g.temp[ni] = 800;
          } else {
            this.removeParticle(nx, ny, ni);
          }
        } else {
          // Outer blast - heat and maybe ignite
          g.temp[ni] += 300;
          if (nel && nel.flammability > 0.5 && Math.random() < 0.5) {
            g.type[ni] = E.FIRE;
            const c = getElemColor(E.FIRE);
            g.colorR[ni] = c[0]; g.colorG[ni] = c[1]; g.colorB[ni] = c[2];
            g.lifetime[ni] = 20 + (Math.random() * 20) | 0;
          }
        }
        g.markDirty(nx, ny); g.markActive(nx, ny);
      }
    }
  }

  // ── Ant ──
  updateAnt(x, y, i, gDir) {
    const g = this.grid;
    const w = g.width, h = g.height;

    // Ants move every ~3 ticks
    if (g.tick % 3 !== 0) return;

    // Use extra[i] to store direction (0=down, 1=left, 2=right, 3=up)
    let dir = g.extra[i];

    // Occasionally change direction randomly
    if (Math.random() < 0.15) {
      dir = (Math.random() * 4) | 0;
      g.extra[i] = dir;
    }

    // Direction offsets: bias toward down and lateral
    const dirOffsets = [
      [0, gDir],   // down (with gravity)
      [-1, 0],     // left
      [1, 0],      // right
      [0, -gDir],  // up (against gravity)
    ];

    // Try preferred direction first, then others
    const tryOrder = [dir, (dir + 1) % 4, (dir + 3) % 4, (dir + 2) % 4];

    for (const d of tryOrder) {
      const [dx, dy] = dirOffsets[d];
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
      const ni = ny * w + nx;
      const nt = g.type[ni];

      // Die if touching fire/lava
      if (nt === E.FIRE || nt === E.LAVA) {
        g.type[i] = E.FIRE;
        const c = getElemColor(E.FIRE);
        g.colorR[i] = c[0]; g.colorG[i] = c[1]; g.colorB[i] = c[2];
        g.lifetime[i] = 10 + (Math.random() * 10) | 0;
        g.markDirty(x, y); g.markActive(x, y);
        return;
      }

      // Avoid dangerous elements
      if (nt === E.WATER || nt === E.ACID) continue;

      // Dig through sand/mud/snow/dirt
      if (nt === E.SAND || nt === E.MUD || nt === E.SNOW) {
        // Swap ant with the material, then remove the material (dig it)
        this.swapCells(x, y, i, nx, ny, ni);
        // Now the dug material is at (x, y), remove it
        this.removeParticle(x, y, y * w + x);
        g.extra[ni] = d; // ant keeps direction
        g.markDirty(x, y); g.markActive(x, y);
        return;
      }

      // Move into empty space
      if (nt === E.EMPTY) {
        this.swapCells(x, y, i, nx, ny, ni);
        g.extra[ni] = d;
        return;
      }
    }
  }

  // ── Firework ──
  updateFirework(x, y, i, gDir) {
    const g = this.grid;
    const w = g.width, h = g.height;

    // Initialize firework on first tick (extra starts at 0)
    if (g.extra[i] === 0) {
      // Set threshold: 40-60 ticks of flight
      g.extra[i] = 1; // counter starts at 1
      // Store threshold in lifetime (but don't use the auto-decrement)
      // We'll use a simple approach: explode when extra reaches 40-60
      // Store the threshold as 40 + random 20, encoded as extra starting at 1 and counting up
    }

    // Increment counter
    g.extra[i]++;
    const threshold = 45; // average flight time

    // Explode when counter reaches threshold or hits something above
    if (g.extra[i] >= threshold) {
      this.explodeFirework(x, y, i);
      return;
    }

    // Move upward (opposite gravity)
    const above = y - gDir;
    if (above < 0 || above >= h) {
      this.explodeFirework(x, y, i);
      return;
    }

    const iAbove = above * w + x;
    const tAbove = g.type[iAbove];

    if (tAbove === E.EMPTY) {
      this.swapCells(x, y, i, x, above, iAbove);
    } else {
      // Hit something, explode
      this.explodeFirework(x, y, i);
    }
  }

  explodeFirework(x, y, i) {
    const g = this.grid;
    const w = g.width, h = g.height;

    // Remove the firework
    this.removeParticle(x, y, i);

    // Create 20-40 sparks in a circle
    const numSparks = 20 + ((Math.random() * 20) | 0);
    for (let s = 0; s < numSparks; s++) {
      const angle = (Math.PI * 2 * s) / numSparks + (Math.random() * 0.3);
      const dist = 2 + ((Math.random() * 4) | 0);
      const sx = x + Math.round(Math.cos(angle) * dist);
      const sy = y + Math.round(Math.sin(angle) * dist);

      if (!g.inBounds(sx, sy)) continue;
      const si = sy * w + sx;
      if (g.type[si] !== E.EMPTY) continue;

      g.set(sx, sy, E.SPARK);
      g.lifetime[si] = 10 + ((Math.random() * 10) | 0);
      g.markDirty(sx, sy); g.markActive(sx, sy);
    }
  }

  // ── Torch ──
  updateTorch(x, y, i) {
    const g = this.grid;
    const w = g.width, h = g.height;
    const gDir = this.gravityDir;

    // Spawn fire in adjacent empty cells above (1 in 4 chance each tick)
    if (Math.random() < 0.25) {
      const above = y - gDir;
      if (above >= 0 && above < h) {
        // Try directly above and diagonally above
        const positions = [[x, above], [x - 1, above], [x + 1, above]];
        const [fx, fy] = positions[(Math.random() * positions.length) | 0];
        if (g.inBounds(fx, fy)) {
          const fi = fy * w + fx;
          if (g.type[fi] === E.EMPTY) {
            g.set(fx, fy, E.FIRE);
            g.lifetime[fi] = 15 + ((Math.random() * 15) | 0);
            g.temp[fi] = 500;
            g.markDirty(fx, fy); g.markActive(fx, fy);
          }
        }
      }
    }

    // Heat neighbors
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx, ny = y + dy;
        if (!g.inBounds(nx, ny)) continue;
        const ni = ny * w + nx;
        if (g.type[ni] !== E.EMPTY) {
          g.temp[ni] += 3;
        }
      }
    }

    g.markDirty(x, y); g.markActive(x, y);
  }

  // ── Battery ──
  updateBattery(x, y, i) {
    const g = this.grid;
    const w = g.width;

    // Check all 4 neighbors, energize adjacent wires
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dx, dy] of dirs) {
      const nx = x + dx, ny = y + dy;
      if (!g.inBounds(nx, ny)) continue;
      const ni = ny * w + nx;
      if (g.type[ni] === E.WIRE) {
        g.extra[ni] = 10; // fully energized
        g.markDirty(nx, ny); g.markActive(nx, ny);
      }
    }

    g.markDirty(x, y); g.markActive(x, y);
  }

  // ── Wire ──
  updateWire(x, y, i) {
    const g = this.grid;
    const w = g.width;

    if (g.extra[i] <= 0) return;

    // Wire is energized
    const energy = g.extra[i];
    g.extra[i]--; // Decrement energy

    // Brighten wire color based on energy level
    const brightness = Math.min(energy * 20, 200);
    g.colorR[i] = Math.min(200 + brightness / 4, 255) | 0;
    g.colorG[i] = Math.min(120 + brightness / 2, 255) | 0;
    g.colorB[i] = Math.min(40 + brightness, 240) | 0;

    // Spread energy to adjacent wires
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dx, dy] of dirs) {
      const nx = x + dx, ny = y + dy;
      if (!g.inBounds(nx, ny)) continue;
      const ni = ny * w + nx;
      const nt = g.type[ni];

      if (nt === E.WIRE) {
        const spreadEnergy = energy - 1;
        if (spreadEnergy > g.extra[ni]) {
          g.extra[ni] = spreadEnergy;
          g.markDirty(nx, ny); g.markActive(nx, ny);
        }
      }

      // Ignite TNT/Gunpowder/Fuse
      if (nt === E.TNT || nt === E.GUNPOWDER || nt === E.FUSE) {
        const nel = ELEMENTS[nt];
        if (nel && nel.explosionPower > 1) {
          this.explode(nx, ny, nel.explosionPower);
        } else {
          g.type[ni] = E.FIRE;
          const c = getElemColor(E.FIRE);
          g.colorR[ni] = c[0]; g.colorG[ni] = c[1]; g.colorB[ni] = c[2];
          g.lifetime[ni] = 20 + (Math.random() * 20) | 0;
          g.temp[ni] = 600;
          g.markDirty(nx, ny); g.markActive(nx, ny);
        }
      }

      // Occasionally spawn a spark in adjacent empty
      if (nt === E.EMPTY && Math.random() < 0.02) {
        g.set(nx, ny, E.SPARK);
        g.lifetime[ni] = 8 + ((Math.random() * 7) | 0);
        g.markDirty(nx, ny); g.markActive(nx, ny);
      }
    }

    // Reset color when fully de-energized
    if (g.extra[i] <= 0) {
      const c = getElemColor(E.WIRE);
      g.colorR[i] = c[0]; g.colorG[i] = c[1]; g.colorB[i] = c[2];
    }

    g.markDirty(x, y); g.markActive(x, y);
  }

  // Chemical interactions between specific element pairs
  checkInteractions(x, y, i, nx, ny, ni) {
    const g = this.grid;
    const t1 = g.type[i], t2 = g.type[ni];

    // Water + salt = saltwater
    if ((t1 === E.WATER && t2 === E.SALT) || (t1 === E.SALT && t2 === E.WATER)) {
      g.type[i] = E.SALTWATER;
      const c = getElemColor(E.SALTWATER);
      g.colorR[i] = c[0]; g.colorG[i] = c[1]; g.colorB[i] = c[2];
      this.removeParticle(nx, ny, ni);
      return true;
    }

    // Water + sand = mud (low chance)
    if ((t1 === E.WATER && t2 === E.SAND) || (t1 === E.SAND && t2 === E.WATER)) {
      if (Math.random() < 0.01) {
        g.type[i] = E.MUD;
        const c = getElemColor(E.MUD);
        g.colorR[i] = c[0]; g.colorG[i] = c[1]; g.colorB[i] = c[2];
        this.removeParticle(nx, ny, ni);
        return true;
      }
    }

    // Metal + water = rust (very low chance)
    if (t1 === E.METAL && t2 === E.WATER) {
      if (Math.random() < 0.001) {
        g.type[i] = E.RUST;
        const c = getElemColor(E.RUST);
        g.colorR[i] = c[0]; g.colorG[i] = c[1]; g.colorB[i] = c[2];
        g.markDirty(x, y);
        return true;
      }
    }

    // Lava + water = stone + steam
    if ((t1 === E.LAVA && t2 === E.WATER) || (t1 === E.WATER && t2 === E.LAVA)) {
      const lavaI = t1 === E.LAVA ? i : ni;
      const waterI = t1 === E.WATER ? i : ni;
      const lavaX = t1 === E.LAVA ? x : nx;
      const lavaY = t1 === E.LAVA ? y : ny;
      const waterX = t1 === E.WATER ? x : nx;
      const waterY = t1 === E.WATER ? y : ny;

      g.type[lavaI] = E.STONE;
      const cs = getElemColor(E.STONE);
      g.colorR[lavaI] = cs[0]; g.colorG[lavaI] = cs[1]; g.colorB[lavaI] = cs[2];
      g.temp[lavaI] = 200;

      g.type[waterI] = E.STEAM;
      const cv = getElemColor(E.STEAM);
      g.colorR[waterI] = cv[0]; g.colorG[waterI] = cv[1]; g.colorB[waterI] = cv[2];
      g.lifetime[waterI] = 120 + (Math.random() * 80) | 0;

      g.markDirty(lavaX, lavaY); g.markDirty(waterX, waterY);
      g.markActive(lavaX, lavaY); g.markActive(waterX, waterY);
      return true;
    }

    return false;
  }
}
