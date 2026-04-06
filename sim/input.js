// ── Input Handling (Touch + Mouse) ────────────────────────────────
"use strict";

class InputManager {
  constructor(canvas, renderer, physics) {
    this.canvas = canvas;
    this.renderer = renderer;
    this.physics = physics;
    this.grid = physics.grid;

    this.drawing = false;
    this.lastX = -1;
    this.lastY = -1;
    this.brushSize = 3;
    this.selectedElement = E.SAND;
    this.sourceMode = false;

    // For pinch-to-zoom and two-finger pan
    this.touches = new Map();
    this.initialPinchDist = 0;
    this.initialScale = 1;
    this.isPinching = false;

    // Continuous drawing flag
    this.drawInterval = null;
    this.currentSimX = -1;
    this.currentSimY = -1;

    this.setupEvents();
  }

  setupEvents() {
    const c = this.canvas;

    // Touch events
    c.addEventListener("touchstart", (e) => this.onTouchStart(e), { passive: false });
    c.addEventListener("touchmove", (e) => this.onTouchMove(e), { passive: false });
    c.addEventListener("touchend", (e) => this.onTouchEnd(e), { passive: false });
    c.addEventListener("touchcancel", (e) => this.onTouchEnd(e), { passive: false });

    // Mouse events for desktop testing
    c.addEventListener("mousedown", (e) => this.onMouseDown(e));
    c.addEventListener("mousemove", (e) => this.onMouseMove(e));
    c.addEventListener("mouseup", (e) => this.onMouseUp(e));
    c.addEventListener("mouseleave", (e) => this.onMouseUp(e));

    // Prevent context menu
    c.addEventListener("contextmenu", (e) => e.preventDefault());

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      if (e.target.tagName === "INPUT") return;
      switch(e.key.toLowerCase()) {
        case "s":
          document.getElementById("btn-source").click();
          break;
        case "g":
          document.getElementById("btn-gravity").click();
          break;
        case " ":
          e.preventDefault();
          document.getElementById("btn-play").click();
          break;
        case "z":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            document.getElementById("btn-undo").click();
          }
          break;
        case "c":
          document.getElementById("btn-clear").click();
          break;
      }
    });
  }

  onTouchStart(e) {
    e.preventDefault();

    for (const touch of e.changedTouches) {
      this.touches.set(touch.identifier, { x: touch.clientX, y: touch.clientY });
    }

    if (this.touches.size === 1) {
      // Single touch = draw
      const touch = e.changedTouches[0];
      this.startDraw(touch.clientX, touch.clientY);
    } else if (this.touches.size >= 2) {
      // Multi-touch = pinch/pan
      this.stopDraw();
      this.isPinching = true;
      const pts = Array.from(this.touches.values());
      this.initialPinchDist = this.dist(pts[0], pts[1]);
      this.initialScale = this.renderer.scale;
    }
  }

  onTouchMove(e) {
    e.preventDefault();

    for (const touch of e.changedTouches) {
      this.touches.set(touch.identifier, { x: touch.clientX, y: touch.clientY });
    }

    if (this.isPinching && this.touches.size >= 2) {
      // Pinch zoom — currently we just keep CSS scaling simple
      // Could implement proper zoom later
      return;
    }

    if (this.drawing && this.touches.size === 1) {
      const touch = e.changedTouches[0];
      this.moveDraw(touch.clientX, touch.clientY);
    }
  }

  onTouchEnd(e) {
    for (const touch of e.changedTouches) {
      this.touches.delete(touch.identifier);
    }

    if (this.touches.size < 2) {
      this.isPinching = false;
    }

    if (this.touches.size === 0) {
      this.stopDraw();
    }
  }

  onMouseDown(e) {
    if (e.button !== 0) return;
    this.startDraw(e.clientX, e.clientY);
  }

  onMouseMove(e) {
    if (!this.drawing) return;
    this.moveDraw(e.clientX, e.clientY);
  }

  onMouseUp(e) {
    this.stopDraw();
  }

  startDraw(sx, sy) {
    this.drawing = true;
    const pos = this.renderer.screenToSim(sx, sy);
    this.lastX = pos.x;
    this.lastY = pos.y;
    this.currentSimX = pos.x;
    this.currentSimY = pos.y;
    this.placeElement(pos.x, pos.y);

    // Start continuous placement for held touch
    if (this.drawInterval) clearInterval(this.drawInterval);
    this.drawInterval = setInterval(() => {
      if (this.drawing && this.currentSimX >= 0) {
        this.placeElement(this.currentSimX, this.currentSimY);
      }
    }, 32); // ~30 placements/sec while held
  }

  moveDraw(sx, sy) {
    const pos = this.renderer.screenToSim(sx, sy);
    this.currentSimX = pos.x;
    this.currentSimY = pos.y;

    // Bresenham line from last to current
    this.drawLine(this.lastX, this.lastY, pos.x, pos.y);
    this.lastX = pos.x;
    this.lastY = pos.y;
  }

  stopDraw() {
    this.drawing = false;
    this.lastX = -1;
    this.lastY = -1;
    this.currentSimX = -1;
    this.currentSimY = -1;
    if (this.drawInterval) {
      clearInterval(this.drawInterval);
      this.drawInterval = null;
    }
  }

  drawLine(x0, y0, x1, y1) {
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    while (true) {
      this.placeElement(x0, y0);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx)  { err += dx; y0 += sy; }
    }
  }

  placeElement(cx, cy) {
    const g = this.grid;
    const r = this.brushSize;
    const elem = this.selectedElement;

    if (this.sourceMode) {
      this.placeSource(cx, cy, r, elem);
      return;
    }

    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue;
        const x = cx + dx, y = cy + dy;
        if (!g.inBounds(x, y)) continue;

        if (elem === E.EMPTY) {
          // Erase
          const i = g.idx(x, y);
          if (g.type[i] !== E.EMPTY) {
            g.type[i] = E.EMPTY;
            g.colorR[i] = 26; g.colorG[i] = 26; g.colorB[i] = 46;
            g.temp[i] = AMBIENT_TEMP;
            g.lifetime[i] = -1;
            g.markDirty(x, y); g.markActive(x, y);
          }
          // Also remove sources in this area
          g.removeSourcesInRadius(cx, cy, r);
        } else {
          const i = g.idx(x, y);
          // Only place in empty cells (or replace for special tools)
          if (g.type[i] === E.EMPTY || elem === E.WALL || elem === E.VOID) {
            // Powder/liquid: add some randomness so it doesn't look like a solid block
            const el = ELEMENTS[elem];
            if ((el.state === STATE.POWDER || el.state === STATE.LIQUID || el.state === STATE.GAS)
                && Math.random() < 0.35) continue;
            g.set(x, y, elem);
          }
        }
      }
    }
  }

  placeSource(cx, cy, r, elem) {
    const g = this.grid;

    if (elem === E.EMPTY) {
      // Erase sources in radius
      g.removeSourcesInRadius(cx, cy, r);
      return;
    }

    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue;
        const x = cx + dx, y = cy + dy;
        if (!g.inBounds(x, y)) continue;
        g.addSource(x, y, elem);
      }
    }
  }
}
