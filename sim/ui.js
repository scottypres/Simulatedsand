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

    for (const el of ELEMENTS) {
      if (!el || el.category !== this.activeCategory) continue;

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
    const btnSettings = document.getElementById("btn-settings");
    const overlay = document.getElementById("settings-overlay");
    const bg = document.getElementById("overlay-bg");
    const scaleSlider = document.getElementById("setting-scale");
    const scaleValue = document.getElementById("scale-value");
    const gridLabel = document.getElementById("grid-size-label");
    const applyBtn = document.getElementById("btn-apply-settings");
    const closeBtn = document.getElementById("settings-close");

    const scaleNames = { 1: "Max", 2: "High", 3: "Medium", 4: "Low", 5: "Lowest" };
    let pendingScale = currentPixelScale;

    function updatePreview(scale) {
      const dims = computeSimDimensions(scale);
      const total = dims.width * dims.height;
      scaleValue.textContent = scaleNames[scale] || scale;
      gridLabel.textContent = dims.width + " x " + dims.height + " = " + total.toLocaleString() + " particles";
    }

    function openSettings() {
      pendingScale = currentPixelScale;
      scaleSlider.value = currentPixelScale;
      updatePreview(currentPixelScale);
      // Highlight active preset
      document.querySelectorAll(".preset-btn").forEach(b => {
        b.classList.toggle("active", parseInt(b.dataset.scale) === currentPixelScale);
      });
      overlay.classList.add("visible");
      bg.classList.add("visible");
    }

    function closeSettings() {
      overlay.classList.remove("visible");
      bg.classList.remove("visible");
    }

    btnSettings.addEventListener("click", openSettings);
    closeBtn.addEventListener("click", closeSettings);

    // Slider updates preview
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

    // Apply
    applyBtn.addEventListener("click", () => {
      if (window.rebuildSim) {
        window.rebuildSim(pendingScale);
      }
      closeSettings();
    });
  }
}
