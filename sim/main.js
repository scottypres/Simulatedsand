// ── Main Entry Point ──────────────────────────────────────────────
"use strict";

(function() {
  // Initialize simulation
  const grid = new SimGrid(SIM_WIDTH, SIM_HEIGHT);
  const canvas = document.getElementById("simCanvas");
  const renderer = new Renderer(canvas, grid);
  const physics = new PhysicsEngine(grid);
  const input = new InputManager(canvas, renderer, physics);
  const ui = new UIController(input);

  // FPS tracking
  let frameCount = 0;
  let lastFpsTime = performance.now();
  const fpsDisplay = document.getElementById("fps-counter");

  // Resize handler
  function onResize() {
    renderer.fitToContainer();
  }
  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", () => setTimeout(onResize, 100));

  // Interaction checking pass — runs neighbor interactions
  function runInteractions() {
    const g = grid;
    const w = g.width, h = g.height;

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
            const t = g.type[i];
            if (t === E.EMPTY) continue;

            // Check right and below neighbors for interactions
            if (x < w - 1) {
              const ni = i + 1;
              if (g.type[ni] !== E.EMPTY && g.type[ni] !== t) {
                physics.checkInteractions(x, y, i, x + 1, y, ni);
              }
            }
            if (y < h - 1) {
              const ni = i + w;
              if (g.type[ni] !== E.EMPTY && g.type[ni] !== t) {
                physics.checkInteractions(x, y, i, x, y + 1, ni);
              }
            }
          }
        }
      }
    }
  }

  // Main loop
  function loop(now) {
    requestAnimationFrame(loop);

    if (!ui.paused) {
      physics.update();
      runInteractions();
    }

    renderer.render();

    // FPS counter
    frameCount++;
    if (now - lastFpsTime >= 500) {
      const fps = Math.round(frameCount * 1000 / (now - lastFpsTime));
      fpsDisplay.textContent = fps + " fps";
      frameCount = 0;
      lastFpsTime = now;
    }
  }

  // Auto-save undo snapshot periodically
  let lastAutoSave = 0;
  setInterval(() => {
    const now = performance.now();
    if (now - lastAutoSave > 10000) {
      grid.saveUndo();
      lastAutoSave = now;
    }
  }, 10000);

  // Start
  requestAnimationFrame(loop);

  // Prevent default iOS behaviors
  document.addEventListener("gesturestart", (e) => e.preventDefault());
  document.addEventListener("gesturechange", (e) => e.preventDefault());
  document.addEventListener("gestureend", (e) => e.preventDefault());

  // Prevent pull-to-refresh
  document.body.addEventListener("touchmove", (e) => {
    if (e.target === canvas || e.target.closest("#canvas-container")) {
      e.preventDefault();
    }
  }, { passive: false });
})();
