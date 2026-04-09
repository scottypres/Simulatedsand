// ── Simulation Constants ──────────────────────────────────────────
"use strict";

const CHUNK_SIZE = 16;
const MAX_TEMP   = 5000;
const MIN_TEMP   = -273;
const AMBIENT_TEMP = 22;
const GRAVITY    = 1;

// Pixel density for sim — how many screen pixels per sim pixel.
// Lower = more sim pixels = more detail but slower on weak devices.
// We target ~3px per sim cell on phones, ~2px on tablets/desktop.
const SIM_PIXEL_SCALE = 3;

// Compute sim dimensions from device screen and available space.
// Toolbar ~44px, element panel ~180px, safe areas ~40px each.
function computeSimDimensions() {
  const screenW = window.innerWidth;
  const screenH = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);

  // Estimate chrome height (toolbar + panel + safe areas)
  const chromeH = 230;
  const availW = screenW;
  const availH = Math.max(screenH - chromeH, 200);

  // Scale determines how many sim cells we get
  const scale = SIM_PIXEL_SCALE;
  let simW = Math.floor(availW / scale);
  let simH = Math.floor(availH / scale);

  // Round to chunk size for clean tiling
  simW = Math.max(CHUNK_SIZE * 4, Math.floor(simW / CHUNK_SIZE) * CHUNK_SIZE);
  simH = Math.max(CHUNK_SIZE * 4, Math.floor(simH / CHUNK_SIZE) * CHUNK_SIZE);

  // Clamp to reasonable limits for performance
  simW = Math.min(simW, 320);
  simH = Math.min(simH, 560);

  return { width: simW, height: simH };
}

const SIM_DIMS = computeSimDimensions();
const SIM_WIDTH  = SIM_DIMS.width;
const SIM_HEIGHT = SIM_DIMS.height;

// Element type IDs
const E = Object.freeze({
  EMPTY:      0,
  SAND:       1,
  WATER:      2,
  STONE:      3,
  WOOD:       4,
  FIRE:       5,
  SMOKE:      6,
  STEAM:      7,
  LAVA:       8,
  ICE:        9,
  SNOW:       10,
  OIL:        11,
  ACID:       12,
  GUNPOWDER:  13,
  METAL:      14,
  RUST:       15,
  PLANT:      16,
  SEED:       17,
  SALT:       18,
  SALTWATER:  19,
  MUD:        20,
  CLAY:       21,
  GLASS:      22,
  DIAMOND:    23,
  TNT:        24,
  NAPALM:     25,
  VIRUS:      26,
  CLONE:      27,
  VOID:       28,
  FUSE:       29,
  ASH:        30,
  EMBER:      31,
  METHANE:    32,
  NITRO:      33,
  LIGHTNING:  34,
  PLASMA:     35,
  WAX:        36,
  DUST:       37,
  CEMENT:     38,
  CONCRETE:   39,
  CHARCOAL:   40,
  WALL:       41,
});

// State types
const STATE = Object.freeze({
  SOLID:   0,
  POWDER:  1,
  LIQUID:  2,
  GAS:     3,
  PLASMA:  4,
  STATIC:  5,   // immovable solids
  SPECIAL: 6,
});
