// ── Renderer ──────────────────────────────────────────────────────
"use strict";

class Renderer {
  constructor(canvas, grid) {
    this.canvas = canvas;
    this.grid = grid;
    this.ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });

    // Match canvas to sim size
    this.canvas.width = grid.width;
    this.canvas.height = grid.height;

    // Image data for direct pixel manipulation
    this.imageData = this.ctx.createImageData(grid.width, grid.height);
    this.pixels = new Uint32Array(this.imageData.data.buffer);

    // Camera transform
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;

    // Compute CSS sizing to fill container while maintaining aspect
    this.fitToContainer();
  }

  fitToContainer() {
    const container = this.canvas.parentElement;
    if (!container) return;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const aspect = this.grid.width / this.grid.height;
    const containerAspect = cw / ch;

    let displayW, displayH;
    if (containerAspect > aspect) {
      displayH = ch;
      displayW = ch * aspect;
    } else {
      displayW = cw;
      displayH = cw / aspect;
    }

    this.displayW = displayW;
    this.displayH = displayH;
    this.canvas.style.width = displayW + "px";
    this.canvas.style.height = displayH + "px";
    this.containerW = cw;
    this.containerH = ch;
  }

  // Convert screen coordinates to sim coordinates
  screenToSim(sx, sy) {
    const rect = this.canvas.getBoundingClientRect();
    const rx = (sx - rect.left) / rect.width;
    const ry = (sy - rect.top) / rect.height;
    return {
      x: (rx * this.grid.width) | 0,
      y: (ry * this.grid.height) | 0
    };
  }

  render() {
    const g = this.grid;
    const pixels = this.pixels;
    const w = g.width, h = g.height;

    // Only render dirty chunks
    for (let cy = 0; cy < g.chunksY; cy++) {
      for (let cx = 0; cx < g.chunksX; cx++) {
        const ci = cy * g.chunksX + cx;
        if (!g.dirtyChunks[ci]) continue;
        g.dirtyChunks[ci] = 0;

        const x0 = cx * CHUNK_SIZE;
        const y0 = cy * CHUNK_SIZE;
        const x1 = Math.min(x0 + CHUNK_SIZE, w);
        const y1 = Math.min(y0 + CHUNK_SIZE, h);

        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            const i = y * w + x;
            const r = g.colorR[i];
            const gv = g.colorG[i];
            const b = g.colorB[i];

            // Temperature glow effect for hot particles
            let fr = r, fg = gv, fb = b;
            const temp = g.temp[i];
            if (temp > 200 && g.type[i] !== E.EMPTY) {
              const glow = Math.min((temp - 200) / 800, 1);
              fr = Math.min(255, fr + glow * 100) | 0;
              fg = Math.min(255, fg + glow * 40) | 0;
            } else if (temp < -10 && g.type[i] !== E.EMPTY) {
              const cold = Math.min((-10 - temp) / 200, 1);
              fb = Math.min(255, fb + cold * 80) | 0;
              fg = Math.min(255, fg + cold * 30) | 0;
            }

            // Pack ABGR for little-endian
            pixels[i] = (255 << 24) | (fb << 16) | (fg << 8) | fr;
          }
        }
      }
    }

    this.ctx.putImageData(this.imageData, 0, 0);

    // Draw source markers on top
    if (g.sources.size > 0) {
      this.renderSources();
    }
  }

  renderSources() {
    const g = this.grid;
    const pixels = this.pixels;
    const w = g.width;
    // Pulsing brightness
    const pulse = Math.sin(performance.now() * 0.006) * 0.3 + 0.7;

    for (const [key, elemId] of g.sources) {
      const parts = key.split(",");
      const sx = parseInt(parts[0]), sy = parseInt(parts[1]);
      const i = sy * w + sx;

      // Get element color and brighten it with a white pulsing border
      const el = ELEMENTS[elemId];
      if (!el) continue;
      const c = el.colors[0];
      const bright = pulse;

      // Blend a white diamond marker over the pixel
      const r = Math.min(255, (c[0] * 0.5 + 255 * 0.5 * bright) | 0);
      const gv = Math.min(255, (c[1] * 0.5 + 255 * 0.5 * bright) | 0);
      const b = Math.min(255, (c[2] * 0.5 + 255 * 0.5 * bright) | 0);
      pixels[i] = (255 << 24) | (b << 16) | (gv << 8) | r;

      // Mark dirty so it redraws each frame while sources exist
      g.markDirty(sx, sy);
    }

    // Re-push the modified pixels
    this.ctx.putImageData(this.imageData, 0, 0);
  }
}
