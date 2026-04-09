// ── Main Entry Point ──────────────────────────────────────────────
"use strict";

(function() {
  // Mutable sim state
  let grid, renderer, physics, input, ui;
  let canvas = document.getElementById("simCanvas");

  function initSim() {
    grid = new SimGrid(SIM_WIDTH, SIM_HEIGHT);
    renderer = new Renderer(canvas, grid);
    physics = new PhysicsEngine(grid);
    input = new InputManager(canvas, renderer, physics);
    // Only create UI once
    if (!ui) {
      ui = new UIController(input);
    } else {
      // Reconnect existing UI to new input
      ui.input = input;
    }
  }

  initSim();

  // Expose rebuild function for settings
  window.rebuildSim = function(newScale) {
    currentPixelScale = newScale;
    localStorage.setItem("simScale", newScale);
    const dims = computeSimDimensions(newScale);
    SIM_WIDTH = dims.width;
    SIM_HEIGHT = dims.height;
    initSim();
    renderer.fitToContainer();
  };

  // Expose getter for settings UI
  window.getSimInfo = function() {
    return { width: SIM_WIDTH, height: SIM_HEIGHT, scale: currentPixelScale };
  };

  // FPS tracking
  let frameCount = 0;
  let lastFpsTime = performance.now();
  const fpsDisplay = document.getElementById("fps-counter");

  // Resize handler
  function onResize() {
    if (renderer) renderer.fitToContainer();
  }
  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", () => {
    // iPad rotation fix: wait for layout to settle then refit
    setTimeout(onResize, 50);
    setTimeout(onResize, 200);
    setTimeout(onResize, 500);
  });
  // Also handle visualViewport resize (more reliable on iOS/iPad)
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", onResize);
  }

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
      const steps = physics.simSpeed || 1;
      for (let s = 0; s < steps; s++) {
        physics.update();
        runInteractions();
      }
    }

    renderer.render();

    frameCount++;
    if (now - lastFpsTime >= 500) {
      const fps = Math.round(frameCount * 1000 / (now - lastFpsTime));
      fpsDisplay.textContent = fps + " fps";
      frameCount = 0;
      lastFpsTime = now;
    }
  }

  // Auto-save undo snapshot periodically
  setInterval(() => {
    if (grid) grid.saveUndo();
  }, 10000);

  // Start
  requestAnimationFrame(loop);

  // Prevent default iOS behaviors
  document.addEventListener("gesturestart", (e) => e.preventDefault());
  document.addEventListener("gesturechange", (e) => e.preventDefault());
  document.addEventListener("gestureend", (e) => e.preventDefault());

  document.body.addEventListener("touchmove", (e) => {
    if (e.target === canvas || e.target.closest("#canvas-container")) {
      e.preventDefault();
    }
  }, { passive: false });
})();
