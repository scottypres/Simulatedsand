// ── Simulation Constants ──────────────────────────────────────────
"use strict";

const SIM_WIDTH  = 200;
const SIM_HEIGHT = 350;
const CHUNK_SIZE = 16;
const MAX_TEMP   = 5000;
const MIN_TEMP   = -273;
const AMBIENT_TEMP = 22;
const GRAVITY    = 1;

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
