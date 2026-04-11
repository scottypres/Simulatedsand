// ── UI Controller ─────────────────────────────────────────────────
"use strict";

class UIController {
  constructor(input) {
    this.input = input;
    this.paused = false;
    this.activeCategory = "basic";
    this.brushSliderVisible = false;
    this.panelCollapsed = false;

    this.buildCategoryTabs();
    this.buildElementGrid();
    this.setupToolbar();
    this.setupPanel();
    this.setupBrushSlider();
    this.setupSettings();
    this.setupSaveLoad();
    this.setupChallengeUI();
    this.setupWind();

    // Select sand by default
    this.selectElement(E.SAND);
  }

  buildCategoryTabs() {
    const container = document.getElementById("category-tabs");
    container.innerHTML = "";

    for (const cat of CATEGORIES) {
      const btn = document.createElement("button");
      btn.className = "cat-tab" + (cat.id === this.activeCategory ? " active" : "");
      btn.textContent = cat.label;
      btn.dataset.cat = cat.id;
      btn.addEventListener("click", () => {
        this.activeCategory = cat.id;
        this.buildCategoryTabs();
        this.buildElementGrid();
      });
      container.appendChild(btn);
    }
  }

  buildElementGrid() {
    const container = document.getElementById("element-grid");
    container.innerHTML = "";

    const cm = window.challengeManager;
    const allowed = cm && cm.active ? cm.allowedElements : null;

    for (const el of ELEMENTS) {
      if (!el || el.category !== this.activeCategory) continue;
      if (allowed && !allowed.includes(el.id)) continue;

      const btn = document.createElement("div");
      btn.className = "elem-btn" + (this.input.selectedElement === el.id ? " selected" : "");
      btn.dataset.elemId = el.id;

      const swatch = document.createElement("div");
      swatch.className = "swatch";
      const c = el.colors[0];
      swatch.style.backgroundColor = `rgb(${c[0]},${c[1]},${c[2]})`;

      const label = document.createElement("div");
      label.className = "label";
      label.textContent = el.name;

      btn.appendChild(swatch);
      btn.appendChild(label);

      btn.addEventListener("click", () => {
        this.selectElement(el.id);
      });

      container.appendChild(btn);
    }
  }

  selectElement(id) {
    this.input.selectedElement = id;
    // Update visual selection
    document.querySelectorAll(".elem-btn").forEach(btn => {
      btn.classList.toggle("selected", parseInt(btn.dataset.elemId) === id);
    });

    // Switch to the category of the selected element
    const el = ELEMENTS[id];
    if (el && el.category !== this.activeCategory) {
      this.activeCategory = el.category;
      this.buildCategoryTabs();
      this.buildElementGrid();
    }

    // Haptic feedback on supported devices
    if (navigator.vibrate) navigator.vibrate(10);
  }

  setupToolbar() {
    const btnPlay = document.getElementById("btn-play");
    const btnClear = document.getElementById("btn-clear");
    const btnUndo = document.getElementById("btn-undo");
    const btnSource = document.getElementById("btn-source");
    const btnGravity = document.getElementById("btn-gravity");
    const btnInfo = document.getElementById("btn-info");

    btnSource.addEventListener("click", () => {
      this.input.sourceMode = !this.input.sourceMode;
      btnSource.classList.toggle("active", this.input.sourceMode);
      document.getElementById("simCanvas").classList.toggle("source-active", this.input.sourceMode);
      document.getElementById("source-banner").classList.toggle("visible", this.input.sourceMode);
      if (navigator.vibrate) navigator.vibrate(this.input.sourceMode ? [15, 30, 15] : 10);
    });

    btnPlay.addEventListener("click", () => {
      this.paused = !this.paused;
      btnPlay.textContent = this.paused ? "▶" : "⏸";
      btnPlay.classList.toggle("active", this.paused);
    });
    // Start in play mode
    btnPlay.textContent = "⏸";

    btnClear.addEventListener("click", () => {
      this.input.grid.saveUndo();
      this.input.grid.clear();
    });

    btnUndo.addEventListener("click", () => {
      this.input.grid.popUndo();
    });

    btnGravity.addEventListener("click", () => {
      this.input.physics.gravityDir *= -1;
      btnGravity.classList.toggle("active", this.input.physics.gravityDir < 0);
    });

    btnInfo.addEventListener("click", () => {
      document.getElementById("info-overlay").classList.add("visible");
      document.getElementById("overlay-bg").classList.add("visible");
    });

    document.getElementById("info-close").addEventListener("click", () => {
      document.getElementById("info-overlay").classList.remove("visible");
      document.getElementById("overlay-bg").classList.remove("visible");
    });
    document.getElementById("overlay-bg").addEventListener("click", () => {
      document.getElementById("info-overlay").classList.remove("visible");
      document.getElementById("settings-overlay").classList.remove("visible");
      document.getElementById("savelist-overlay").classList.remove("visible");
      document.getElementById("level-select-overlay").classList.remove("visible");
      document.getElementById("challenge-win").classList.remove("visible");
      document.getElementById("overlay-bg").classList.remove("visible");
    });
  }

  setupPanel() {
    const toggle = document.getElementById("panel-toggle");
    const panel = document.getElementById("element-panel");

    toggle.addEventListener("click", () => {
      this.panelCollapsed = !this.panelCollapsed;
      panel.classList.toggle("collapsed", this.panelCollapsed);
    });
  }

  setupBrushSlider() {
    const btn = document.getElementById("btn-brush");
    const container = document.getElementById("brush-slider-container");
    const slider = document.getElementById("brush-slider");
    const label = document.getElementById("brush-label");
    const display = document.getElementById("brush-size-display");
    let hideTimeout;

    slider.value = this.input.brushSize;
    label.textContent = this.input.brushSize;
    display.textContent = this.input.brushSize;

    btn.addEventListener("click", () => {
      this.brushSliderVisible = !this.brushSliderVisible;
      container.classList.toggle("visible", this.brushSliderVisible);
      if (this.brushSliderVisible) {
        clearTimeout(hideTimeout);
        hideTimeout = setTimeout(() => {
          this.brushSliderVisible = false;
          container.classList.remove("visible");
        }, 4000);
      }
    });

    slider.addEventListener("input", () => {
      const v = parseInt(slider.value);
      this.input.brushSize = v;
      label.textContent = v;
      display.textContent = v;
      clearTimeout(hideTimeout);
      hideTimeout = setTimeout(() => {
        this.brushSliderVisible = false;
        container.classList.remove("visible");
      }, 3000);
    });
  }

  setupSettings() {
    const self = this;
    const btnSettings = document.getElementById("btn-settings");
    const overlay = document.getElementById("settings-overlay");
    const bg = document.getElementById("overlay-bg");
    const scaleSlider = document.getElementById("setting-scale");
    const scaleValue = document.getElementById("scale-value");
    const gridLabel = document.getElementById("grid-size-label");
    const applyBtn = document.getElementById("btn-apply-settings");
    const closeBtn = document.getElementById("settings-close");
    const speedSlider = document.getElementById("setting-speed");
    const speedValue = document.getElementById("speed-value");
    const openBottomBtn = document.getElementById("setting-open-bottom");

    const scaleNames = { 1: "Max", 2: "High", 3: "Medium", 4: "Low", 5: "Lowest" };
    let pendingScale = currentPixelScale;

    function updatePreview(scale) {
      const dims = computeSimDimensions(scale);
      const total = dims.width * dims.height;
      scaleValue.textContent = scaleNames[scale] || scale;
      gridLabel.textContent = dims.width + " x " + dims.height + " = " + total.toLocaleString() + " particles";
    }

    function syncOpenBottomBtn() {
      const on = self.input.physics.openBottom;
      openBottomBtn.textContent = on ? "ON" : "OFF";
      openBottomBtn.classList.toggle("active", on);
    }

    function openSettings() {
      pendingScale = currentPixelScale;
      scaleSlider.value = currentPixelScale;
      updatePreview(currentPixelScale);
      document.querySelectorAll(".preset-btn").forEach(b => {
        b.classList.toggle("active", parseInt(b.dataset.scale) === currentPixelScale);
      });
      // Sync speed
      speedSlider.value = self.input.physics.simSpeed;
      speedValue.textContent = self.input.physics.simSpeed + "x";
      // Sync open bottom
      syncOpenBottomBtn();
      overlay.classList.add("visible");
      bg.classList.add("visible");
    }

    function closeSettings() {
      overlay.classList.remove("visible");
      bg.classList.remove("visible");
    }

    btnSettings.addEventListener("click", openSettings);
    closeBtn.addEventListener("click", closeSettings);

    // Resolution slider
    scaleSlider.addEventListener("input", () => {
      pendingScale = parseInt(scaleSlider.value);
      updatePreview(pendingScale);
      document.querySelectorAll(".preset-btn").forEach(b => {
        b.classList.toggle("active", parseInt(b.dataset.scale) === pendingScale);
      });
    });

    // Preset buttons
    document.querySelectorAll(".preset-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        pendingScale = parseInt(btn.dataset.scale);
        scaleSlider.value = pendingScale;
        updatePreview(pendingScale);
        document.querySelectorAll(".preset-btn").forEach(b => {
          b.classList.toggle("active", parseInt(b.dataset.scale) === pendingScale);
        });
      });
    });

    // Speed slider — applies instantly
    speedSlider.addEventListener("input", () => {
      const v = parseInt(speedSlider.value);
      self.input.physics.simSpeed = v;
      speedValue.textContent = v + "x";
      localStorage.setItem("simSpeed", v);
    });

    // Open bottom toggle — applies instantly
    openBottomBtn.addEventListener("click", () => {
      self.input.physics.openBottom = !self.input.physics.openBottom;
      localStorage.setItem("simOpenBottom", self.input.physics.openBottom);
      syncOpenBottomBtn();
    });

    // Apply (resolution only — needs restart)
    applyBtn.addEventListener("click", () => {
      if (window.rebuildSim) {
        window.rebuildSim(pendingScale);
      }
      closeSettings();
    });
  }

  setupChallengeUI() {
    const self = this;
    const btnChallenge = document.getElementById("btn-challenge");
    const overlay = document.getElementById("level-select-overlay");
    const bg = document.getElementById("overlay-bg");
    const closeBtn = document.getElementById("level-select-close");
    const levelGrid = document.getElementById("level-grid");
    const totalStars = document.getElementById("level-total-stars");
    const backBtn = document.getElementById("btn-back-sandbox");

    function renderLevelSelect() {
      const cm = window.challengeManager;
      if (!cm) return;
      const levels = cm.getLevels();
      levelGrid.innerHTML = "";
      for (let i = 0; i < levels.length; i++) {
        const card = document.createElement("div");
        card.className = "level-card";
        const stars = cm.getStars(i);
        card.innerHTML =
          '<div class="lv-num">' + (i + 1) + '</div>' +
          '<div class="lv-name">' + levels[i].name + '</div>' +
          '<div class="lv-stars">' + (stars >= 1 ? "\u2B50" : "\u2606") + (stars >= 2 ? "\u2B50" : "\u2606") + (stars >= 3 ? "\u2B50" : "\u2606") + '</div>';
        card.addEventListener("click", () => startLevel(i));
        levelGrid.appendChild(card);
      }
      totalStars.textContent = "Total Stars: " + cm.getTotalStars() + " / " + (levels.length * 3);
    }

    function startLevel(idx) {
      const cm = window.challengeManager;
      const grid = self.input.grid;
      cm.startLevel(idx, grid);
      self.onChallengeStart();
      closeOverlay();
    }

    function openOverlay() {
      renderLevelSelect();
      overlay.classList.add("visible");
      bg.classList.add("visible");
    }

    function closeOverlay() {
      overlay.classList.remove("visible");
      bg.classList.remove("visible");
    }

    btnChallenge.addEventListener("click", openOverlay);
    closeBtn.addEventListener("click", closeOverlay);
    backBtn.addEventListener("click", () => {
      const cm = window.challengeManager;
      if (cm && cm.active) {
        cm.quit();
        self.input.grid.clear();
        document.getElementById("challenge-hud").classList.remove("visible");
        self.onChallengeEnd();
      }
      closeOverlay();
    });
  }

  onChallengeStart() {
    // Rebuild palette for allowed elements
    this.buildCategoryTabs();
    this.buildElementGrid();
    // Select first allowed non-empty element
    const cm = window.challengeManager;
    if (cm && cm.allowedElements) {
      const first = cm.allowedElements.find(id => id !== E.EMPTY) || E.EMPTY;
      this.selectElement(first);
    }
  }

  onChallengeEnd() {
    this.buildCategoryTabs();
    this.buildElementGrid();
    this.selectElement(E.SAND);
  }

  setupWind() {
    const self = this;
    const btnWind = document.getElementById("btn-wind");
    const windIndicator = document.getElementById("wind-indicator");
    // Wind states: 0, 1, 2, -1, -2
    const windStates = [0, 1, 2, -1, -2];
    let windIdx = 0;

    function updateWindDisplay() {
      const w = self.input.physics.wind;
      if (w === 0) {
        btnWind.classList.remove("active");
        windIndicator.classList.remove("visible");
      } else {
        btnWind.classList.add("active");
        windIndicator.classList.add("visible");
        const arrow = w > 0 ? "\u2192" : "\u2190";
        const strength = Math.abs(w) > 1 ? " Strong" : "";
        windIndicator.textContent = "Wind: " + arrow + strength;
      }
    }

    btnWind.addEventListener("click", () => {
      windIdx = (windIdx + 1) % windStates.length;
      self.input.physics.wind = windStates[windIdx];
      updateWindDisplay();
      if (navigator.vibrate) navigator.vibrate(10);
    });
  }

  setupSaveLoad() {
    const self = this;
    const STORAGE_KEY = "simSand_saves";
    const btnSaves = document.getElementById("btn-saves");
    const overlay = document.getElementById("savelist-overlay");
    const bg = document.getElementById("overlay-bg");
    const closeBtn = document.getElementById("savelist-close");
    const nameInput = document.getElementById("save-name-input");
    const btnSaveNew = document.getElementById("btn-save-new");
    const btnExport = document.getElementById("btn-export-file");
    const btnImport = document.getElementById("btn-import-file");
    const fileInput = document.getElementById("file-import-input");
    const slotList = document.getElementById("slot-list");

    function getSaves() {
      try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
      } catch(e) { return []; }
    }

    function putSaves(saves) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saves));
    }

    function formatDate(ts) {
      const d = new Date(ts);
      const pad = n => String(n).padStart(2, "0");
      return d.getFullYear() + "-" + pad(d.getMonth()+1) + "-" + pad(d.getDate())
        + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
    }

    function renderSlots() {
      const saves = getSaves();
      slotList.innerHTML = "";
      if (saves.length === 0) {
        slotList.innerHTML = '<div class="slot-empty">No saved maps yet</div>';
        return;
      }
      // Show newest first
      for (let si = saves.length - 1; si >= 0; si--) {
        const save = saves[si];
        const item = document.createElement("div");
        item.className = "slot-item";

        const info = document.createElement("div");
        info.className = "slot-info";
        const name = document.createElement("div");
        name.className = "slot-name";
        name.textContent = save.name || "Untitled";
        const meta = document.createElement("div");
        meta.className = "slot-meta";
        meta.textContent = save.w + "x" + save.h + " \u2022 " + formatDate(save.ts);
        info.appendChild(name);
        info.appendChild(meta);

        const actions = document.createElement("div");
        actions.className = "slot-actions";

        const loadBtn = document.createElement("button");
        loadBtn.className = "btn";
        loadBtn.textContent = "Load";
        loadBtn.addEventListener("click", () => loadSlot(si));

        const overwriteBtn = document.createElement("button");
        overwriteBtn.className = "btn";
        overwriteBtn.textContent = "Save";
        overwriteBtn.addEventListener("click", () => overwriteSlot(si));

        const delBtn = document.createElement("button");
        delBtn.className = "btn btn-del";
        delBtn.textContent = "Del";
        delBtn.addEventListener("click", () => deleteSlot(si));

        actions.appendChild(loadBtn);
        actions.appendChild(overwriteBtn);
        actions.appendChild(delBtn);

        item.appendChild(info);
        item.appendChild(actions);
        slotList.appendChild(item);
      }
    }

    function saveNew() {
      const grid = self.input.grid;
      const data = grid.serialize();
      const name = nameInput.value.trim() || ("Save " + (getSaves().length + 1));
      const saves = getSaves();
      saves.push({ name: name, ts: Date.now(), w: grid.width, h: grid.height, data: data });
      putSaves(saves);
      nameInput.value = "";
      renderSlots();
    }

    function overwriteSlot(idx) {
      const grid = self.input.grid;
      const data = grid.serialize();
      const saves = getSaves();
      if (!saves[idx]) return;
      saves[idx].data = data;
      saves[idx].ts = Date.now();
      saves[idx].w = grid.width;
      saves[idx].h = grid.height;
      putSaves(saves);
      renderSlots();
    }

    function loadSlot(idx) {
      const saves = getSaves();
      if (!saves[idx]) return;
      const data = saves[idx].data;
      const grid = self.input.grid;
      // Check if dimensions match; if not, rebuild
      if (data.w !== grid.width || data.h !== grid.height) {
        // Find scale that produces these dimensions, or rebuild to match
        SIM_WIDTH = data.w;
        SIM_HEIGHT = data.h;
        if (window.rebuildSim) {
          // Rebuild at current scale, then override dimensions
          window.rebuildSim(currentPixelScale);
        }
        // Dimensions may not match after rebuild, try direct deserialize
        const newGrid = self.input.grid;
        if (data.w !== newGrid.width || data.h !== newGrid.height) {
          alert("Map size (" + data.w + "x" + data.h + ") doesn't match current grid (" + newGrid.width + "x" + newGrid.height + "). Change resolution to match.");
          return;
        }
      }
      self.input.grid.saveUndo();
      self.input.grid.deserialize(data);
      closeOverlay();
    }

    function deleteSlot(idx) {
      const saves = getSaves();
      saves.splice(idx, 1);
      putSaves(saves);
      renderSlots();
    }

    function exportFile() {
      const grid = self.input.grid;
      const data = grid.serialize();
      const name = nameInput.value.trim() || "sandbox";
      const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name + ".sand";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    function importFile(file) {
      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const data = JSON.parse(e.target.result);
          if (!data || data.v !== 1) {
            alert("Invalid save file.");
            return;
          }
          const grid = self.input.grid;
          if (data.w !== grid.width || data.h !== grid.height) {
            alert("Map size (" + data.w + "x" + data.h + ") doesn't match current grid (" + grid.width + "x" + grid.height + "). Change resolution to match, then import again.");
            return;
          }
          grid.saveUndo();
          grid.deserialize(data);
          closeOverlay();
        } catch(err) {
          alert("Failed to load file: " + err.message);
        }
      };
      reader.readAsText(file);
    }

    function openOverlay() {
      renderSlots();
      nameInput.value = "";
      overlay.classList.add("visible");
      bg.classList.add("visible");
    }

    function closeOverlay() {
      overlay.classList.remove("visible");
      bg.classList.remove("visible");
    }

    btnSaves.addEventListener("click", openOverlay);
    closeBtn.addEventListener("click", closeOverlay);
    btnSaveNew.addEventListener("click", saveNew);
    btnExport.addEventListener("click", exportFile);
    btnImport.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => {
      if (fileInput.files.length > 0) {
        importFile(fileInput.files[0]);
        fileInput.value = "";
      }
    });
  }
}
