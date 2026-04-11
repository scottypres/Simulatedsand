// ── Element Definitions ───────────────────────────────────────────
"use strict";

// Each element: { name, category, state, density, flammability, meltPoint, boilPoint,
//   colors (array of rgb), conductivity, hardness, corrosionResist, lifetime }

const CATEGORIES = [
  { id: "basic",     label: "Basic" },
  { id: "liquid",    label: "Liquids" },
  { id: "gas",       label: "Gas" },
  { id: "explosive", label: "Boom" },
  { id: "nature",    label: "Nature" },
  { id: "material",  label: "Material" },
  { id: "special",   label: "Special" },
  { id: "tools",     label: "Tools" },
];

function rgb(r,g,b){ return (255<<24)|(b<<16)|(g<<8)|r; }
function rgbArr(r,g,b){ return [r,g,b]; }

const ELEMENTS = [];

function defElem(id, name, cat, state, opts) {
  ELEMENTS[id] = {
    id, name, category: cat, state,
    density:    opts.density    ?? 1,
    flammability: opts.flammability ?? 0,
    meltPoint:  opts.meltPoint  ?? 9999,
    boilPoint:  opts.boilPoint  ?? 99999,
    freezePoint: opts.freezePoint ?? -9999,
    colors:     opts.colors     || [[128,128,128]],
    conductivity: opts.conductivity ?? 0.1,
    hardness:   opts.hardness   ?? 1,
    corrosionResist: opts.corrosionResist ?? 0.5,
    lifetime:   opts.lifetime   ?? 0,  // 0 = infinite
    emitLight:  opts.emitLight  ?? 0,
    explosionPower: opts.explosionPower ?? 0,
    meltsTo:    opts.meltsTo    ?? E.EMPTY,
    boilsTo:    opts.boilsTo    ?? E.EMPTY,
    freezesTo:  opts.freezesTo  ?? -1,
    burnsTo:    opts.burnsTo    ?? E.EMPTY,
  };
}

// ── Basic ─────────────────────────────────────────
defElem(E.EMPTY, "Erase", "tools", STATE.SPECIAL, {
  colors: [[26,26,46]], density: 0
});

defElem(E.SAND, "Sand", "basic", STATE.POWDER, {
  colors: [[218,194,130],[210,180,120],[225,200,140],[200,175,115]],
  density: 4, meltPoint: 1700, meltsTo: E.GLASS, hardness: 2,
});

defElem(E.WATER, "Water", "liquid", STATE.LIQUID, {
  colors: [[30,100,200],[35,110,210],[25,90,195],[40,105,215]],
  density: 2, boilPoint: 100, boilsTo: E.STEAM, freezePoint: 0, freezesTo: E.ICE,
  conductivity: 0.5,
});

defElem(E.STONE, "Stone", "basic", STATE.STATIC, {
  colors: [[120,120,130],[115,115,125],[125,125,135],[110,110,120]],
  density: 6, meltPoint: 1200, meltsTo: E.LAVA, hardness: 8, corrosionResist: 0.7,
});

defElem(E.WOOD, "Wood", "nature", STATE.STATIC, {
  colors: [[120,80,40],[110,72,35],[130,85,45],[115,75,38]],
  density: 3, flammability: 0.8, hardness: 3, burnsTo: E.CHARCOAL,
  corrosionResist: 0.3,
});

defElem(E.FIRE, "Fire", "basic", STATE.GAS, {
  colors: [[255,100,20],[255,160,30],[255,60,10],[255,200,50]],
  density: 0.1, lifetime: 30, emitLight: 3,
});

defElem(E.SMOKE, "Smoke", "gas", STATE.GAS, {
  colors: [[60,60,70],[70,70,80],[55,55,65],[65,65,75]],
  density: 0.05, lifetime: 120,
});

defElem(E.STEAM, "Steam", "gas", STATE.GAS, {
  colors: [[180,200,220],[190,210,230],[175,195,215],[185,205,225]],
  density: 0.03, lifetime: 200, freezePoint: 80, freezesTo: E.WATER,
});

defElem(E.LAVA, "Lava", "liquid", STATE.LIQUID, {
  colors: [[220,60,20],[240,80,10],[200,40,5],[255,100,30]],
  density: 5, emitLight: 4, freezePoint: 700, freezesTo: E.STONE,
  conductivity: 0.8, flammability: 0,
});

defElem(E.ICE, "Ice", "basic", STATE.STATIC, {
  colors: [[160,210,240],[170,215,245],[155,205,235],[165,220,250]],
  density: 2.5, meltPoint: 5, meltsTo: E.WATER, hardness: 3,
  conductivity: 0.4,
});

defElem(E.SNOW, "Snow", "nature", STATE.POWDER, {
  colors: [[235,240,250],[230,235,245],[240,245,255],[225,230,240]],
  density: 1, meltPoint: 3, meltsTo: E.WATER, hardness: 1,
});

defElem(E.OIL, "Oil", "liquid", STATE.LIQUID, {
  colors: [[50,30,10],[55,35,15],[45,25,8],[60,38,18]],
  density: 1.5, flammability: 0.95, boilPoint: 300, boilsTo: E.SMOKE,
  burnsTo: E.SMOKE,
});

defElem(E.ACID, "Acid", "liquid", STATE.LIQUID, {
  colors: [[100,220,40],[110,230,50],[90,210,30],[120,240,60]],
  density: 2.2, boilPoint: 200, boilsTo: E.SMOKE,
});

defElem(E.GUNPOWDER, "Gunpowder", "explosive", STATE.POWDER, {
  colors: [[50,50,50],[55,55,55],[45,45,45],[60,58,55]],
  density: 3, flammability: 1.0, explosionPower: 2, burnsTo: E.SMOKE,
});

defElem(E.METAL, "Metal", "material", STATE.STATIC, {
  colors: [[160,165,175],[155,160,170],[165,170,180],[150,155,165]],
  density: 8, meltPoint: 1500, meltsTo: E.LAVA, hardness: 9,
  conductivity: 0.95, corrosionResist: 0.6,
});

defElem(E.RUST, "Rust", "material", STATE.POWDER, {
  colors: [[160,80,30],[150,70,25],[170,85,35],[145,75,28]],
  density: 5, hardness: 2,
});

defElem(E.PLANT, "Plant", "nature", STATE.STATIC, {
  colors: [[30,140,40],[40,150,50],[25,130,35],[35,145,45]],
  density: 2, flammability: 0.7, hardness: 2, burnsTo: E.ASH,
  corrosionResist: 0.2,
});

defElem(E.SEED, "Seed", "nature", STATE.POWDER, {
  colors: [[80,60,20],[85,65,25],[75,55,15],[90,68,28]],
  density: 1.5, flammability: 0.6,
});

defElem(E.SALT, "Salt", "basic", STATE.POWDER, {
  colors: [[230,230,235],[225,225,230],[235,235,240],[220,220,225]],
  density: 3.5, meltPoint: 800, hardness: 3,
});

defElem(E.SALTWATER, "Saltwater", "liquid", STATE.LIQUID, {
  colors: [[30,90,170],[35,95,175],[25,85,165],[40,100,180]],
  density: 2.3, boilPoint: 105, boilsTo: E.STEAM, freezePoint: -5, freezesTo: E.ICE,
});

defElem(E.MUD, "Mud", "nature", STATE.POWDER, {
  colors: [[80,55,30],[75,50,25],[85,60,35],[70,48,22]],
  density: 3.5, hardness: 1,
});

defElem(E.CLAY, "Clay", "material", STATE.POWDER, {
  colors: [[170,110,70],[165,105,65],[175,115,75],[160,100,60]],
  density: 4, meltPoint: 1100, meltsTo: E.LAVA, hardness: 3,
});

defElem(E.GLASS, "Glass", "material", STATE.STATIC, {
  colors: [[200,220,230,150],[195,215,225,150],[205,225,235,150],[190,210,220,150]],
  density: 5, meltPoint: 1500, meltsTo: E.LAVA, hardness: 6,
  corrosionResist: 0.3,
});

defElem(E.DIAMOND, "Diamond", "material", STATE.STATIC, {
  colors: [[180,230,255],[185,235,255],[175,225,250],[190,240,255]],
  density: 7, hardness: 10, corrosionResist: 1.0, conductivity: 0.9,
});

defElem(E.TNT, "TNT", "explosive", STATE.STATIC, {
  colors: [[200,40,30],[190,35,25],[210,45,35],[180,30,20]],
  density: 3, flammability: 1.0, explosionPower: 8, burnsTo: E.SMOKE,
});

defElem(E.NAPALM, "Napalm", "explosive", STATE.LIQUID, {
  colors: [[200,100,20],[210,110,25],[190,90,15],[220,120,30]],
  density: 2.1, flammability: 1.0, boilPoint: 400, burnsTo: E.FIRE,
  explosionPower: 1,
});

defElem(E.VIRUS, "Virus", "special", STATE.SPECIAL, {
  colors: [[180,30,180],[190,40,190],[170,20,170],[200,50,200]],
  density: 2, lifetime: 300,
});

defElem(E.CLONE, "Clone", "special", STATE.STATIC, {
  colors: [[255,220,50],[250,215,45],[255,225,55],[245,210,40]],
  density: 10, hardness: 10, corrosionResist: 1.0,
});

defElem(E.VOID, "Void", "special", STATE.STATIC, {
  colors: [[10,0,20],[15,5,25],[8,0,18],[12,2,22]],
  density: 10, hardness: 10, corrosionResist: 1.0,
});

defElem(E.FUSE, "Fuse", "explosive", STATE.STATIC, {
  colors: [[140,100,60],[135,95,55],[145,105,65],[130,90,50]],
  density: 2, flammability: 1.0, burnsTo: E.EMBER,
});

defElem(E.ASH, "Ash", "basic", STATE.POWDER, {
  colors: [[90,90,95],[85,85,90],[95,95,100],[80,80,85]],
  density: 1.5, hardness: 1,
});

defElem(E.EMBER, "Ember", "basic", STATE.POWDER, {
  colors: [[200,80,20],[210,90,25],[190,70,15],[220,100,30]],
  density: 1.8, lifetime: 60, emitLight: 2, flammability: 0,
});

defElem(E.METHANE, "Methane", "gas", STATE.GAS, {
  colors: [[100,140,100],[105,145,105],[95,135,95],[110,150,110]],
  density: 0.04, flammability: 1.0, explosionPower: 3, lifetime: 400,
});

defElem(E.NITRO, "Nitro", "explosive", STATE.LIQUID, {
  colors: [[180,180,60],[175,175,55],[185,185,65],[170,170,50]],
  density: 2.5, flammability: 1.0, explosionPower: 12, burnsTo: E.SMOKE,
});

defElem(E.LIGHTNING, "Lightning", "special", STATE.PLASMA, {
  colors: [[200,200,255],[220,220,255],[180,180,255],[240,240,255]],
  density: 0.01, lifetime: 4, emitLight: 5,
});

defElem(E.PLASMA, "Plasma", "special", STATE.PLASMA, {
  colors: [[180,100,255],[200,120,255],[160,80,240],[220,140,255]],
  density: 0.02, lifetime: 20, emitLight: 4,
});

defElem(E.WAX, "Wax", "material", STATE.STATIC, {
  colors: [[240,220,180],[235,215,175],[245,225,185],[230,210,170]],
  density: 2.5, flammability: 0.6, meltPoint: 60, meltsTo: E.OIL, burnsTo: E.SMOKE,
});

defElem(E.DUST, "Dust", "basic", STATE.POWDER, {
  colors: [[170,160,140],[165,155,135],[175,165,145],[160,150,130]],
  density: 1.2, flammability: 0.9, explosionPower: 1,
});

defElem(E.CEMENT, "Cement", "material", STATE.POWDER, {
  colors: [[145,145,140],[140,140,135],[150,150,145],[135,135,130]],
  density: 4.5, hardness: 4,
});

defElem(E.CONCRETE, "Concrete", "material", STATE.STATIC, {
  colors: [[155,155,150],[150,150,145],[160,160,155],[145,145,140]],
  density: 6, hardness: 8, corrosionResist: 0.6,
});

defElem(E.CHARCOAL, "Charcoal", "nature", STATE.POWDER, {
  colors: [[35,30,25],[40,35,30],[30,25,20],[45,38,32]],
  density: 2, flammability: 0.9, burnsTo: E.ASH, hardness: 2,
});

defElem(E.WALL, "Wall", "tools", STATE.STATIC, {
  colors: [[80,80,90],[75,75,85],[85,85,95],[70,70,80]],
  density: 100, hardness: 10, corrosionResist: 1.0, meltPoint: 99999,
});

defElem(E.ANT, "Ant", "nature", STATE.SPECIAL, {
  colors: [[140,50,30],[130,45,25],[150,55,35],[135,48,28]],
  density: 2, lifetime: 0, hardness: 1,
});

defElem(E.FIREWORK, "Firework", "explosive", STATE.POWDER, {
  colors: [[200,50,50],[50,50,200],[50,200,50],[200,200,50]],
  density: 1.5, lifetime: 0,
});

defElem(E.SPARK, "Spark", "explosive", STATE.GAS, {
  colors: [[255,255,200],[255,240,150],[255,255,180],[255,230,130]],
  density: 0.08, lifetime: 15, emitLight: 3,
});

defElem(E.BATTERY, "Battery", "special", STATE.STATIC, {
  colors: [[80,80,40],[75,75,35],[85,85,45],[70,70,30]],
  density: 8, hardness: 9, corrosionResist: 1.0,
});

defElem(E.WIRE, "Wire", "special", STATE.STATIC, {
  colors: [[200,120,40],[190,110,35],[210,130,45],[185,105,30]],
  density: 6, hardness: 5, conductivity: 1.0,
});

defElem(E.TORCH, "Torch", "tools", STATE.STATIC, {
  colors: [[180,100,30],[170,90,25],[190,110,35],[175,95,28]],
  density: 3, hardness: 5, corrosionResist: 1.0, emitLight: 3,
});

defElem(E.GOAL, "Goal", "tools", STATE.STATIC, {
  colors: [[50,255,100],[60,255,110],[40,245,90],[70,255,120]],
  density: 100, hardness: 10, corrosionResist: 1.0,
});

// Utility to get a random color for an element
function getElemColor(id) {
  const el = ELEMENTS[id];
  if (!el) return [0,0,0];
  const colors = el.colors;
  return colors[(Math.random() * colors.length) | 0];
}
