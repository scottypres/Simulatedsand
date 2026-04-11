// ── Main Entry Point ──────────────────────────────────────────────
"use strict";

(function() {
  // Mutable sim state
  let grid, renderer, physics, input, ui;
  let canvas = document.getElementById("simCanvas");
  const challengeManager = new ChallengeManager();
  window.challengeManager = challengeManager;

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
    const oldScale = currentPixelScale;
    currentPixelScale = newScale;
    localStorage.setItem("simScale", newScale);
    const dims = computeSimDimensions(newScale);
    SIM_WIDTH = dims.width;
    SIM_HEIGHT = dims.height;
    initSim();
    // Scale brush size proportionally so it feels the same physical size
    const ratio = oldScale / newScale;
    const newBrush = Math.max(1, Math.round(input.brushSize * ratio));
    input.brushSize = newBrush;
    // Sync the brush UI
    const brushDisplay = document.getElementById("brush-size-display");
    const brushSlider = document.getElementById("brush-slider");
    // Scale slider max so larger grids can use bigger brushes
    const newMax = Math.max(20, Math.round(20 * ratio));
    if (brushSlider) {
      brushSlider.max = newMax;
      brushSlider.value = newBrush;
    }
    if (brushDisplay) brushDisplay.textContent = newBrush;
    const brushLabel = document.getElementById("brush-label");
    if (brushLabel) brushLabel.textContent = newBrush;
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
      // Challenge win check
      if (challengeManager.active && !challengeManager.won) {
        if (challengeManager.checkWin(grid)) {
          showChallengeWin();
        }
      }
    }

    // Always update challenge HUD (even when paused) so timer stays visible
    if (challengeManager.active && !challengeManager.won) {
      updateChallengeHud();
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

  // ── Challenge HUD & Win ──
  function updateChallengeHud() {
    const hud = document.getElementById("challenge-hud");
    if (!challengeManager.active) {
      hud.classList.remove("visible");
      return;
    }
    hud.classList.add("visible");
    const level = CHALLENGE_LEVELS[challengeManager.currentLevel];
    document.getElementById("ch-level-name").textContent = level.name;
    document.getElementById("ch-desc").textContent = level.description || "";
    const elapsed = ((Date.now() - challengeManager.startTime) / 1000) | 0;
    const mins = (elapsed / 60) | 0;
    const secs = elapsed % 60;
    document.getElementById("ch-timer").textContent = mins + ":" + (secs < 10 ? "0" : "") + secs;
  }

  function showChallengeWin() {
    const win = document.getElementById("challenge-win");
    const bg = document.getElementById("overlay-bg");
    const stars = challengeManager.stars;
    document.getElementById("win-stars").textContent =
      (stars >= 1 ? "\u2B50" : "\u2606") + (stars >= 2 ? "\u2B50" : "\u2606") + (stars >= 3 ? "\u2B50" : "\u2606");
    const elapsed = ((Date.now() - challengeManager.startTime) / 1000) | 0;
    document.getElementById("win-time").textContent =
      "Time: " + elapsed + "s | Particles: " + challengeManager.particlesUsed;
    win.classList.add("visible");
    bg.classList.add("visible");
  }

  window.showChallengeWin = showChallengeWin;
  window.updateChallengeHud = updateChallengeHud;

  document.getElementById("btn-win-next").addEventListener("click", () => {
    const next = challengeManager.currentLevel + 1;
    document.getElementById("challenge-win").classList.remove("visible");
    document.getElementById("overlay-bg").classList.remove("visible");
    if (next < CHALLENGE_LEVELS.length) {
      challengeManager.startLevel(next, grid);
      if (ui) ui.onChallengeStart();
    } else {
      challengeManager.quit();
      grid.clear();
      if (ui) ui.onChallengeEnd();
    }
  });

  document.getElementById("btn-win-retry").addEventListener("click", () => {
    document.getElementById("challenge-win").classList.remove("visible");
    document.getElementById("overlay-bg").classList.remove("visible");
    challengeManager.startLevel(challengeManager.currentLevel, grid);
    if (ui) ui.onChallengeStart();
  });

  document.getElementById("btn-win-quit").addEventListener("click", () => {
    document.getElementById("challenge-win").classList.remove("visible");
    document.getElementById("overlay-bg").classList.remove("visible");
    challengeManager.quit();
    grid.clear();
    document.getElementById("challenge-hud").classList.remove("visible");
    if (ui) ui.onChallengeEnd();
  });

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
