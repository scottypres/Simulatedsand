// ── Simulation Grid ───────────────────────────────────────────────
"use strict";

class SimGrid {
  constructor(w, h) {
    this.width  = w;
    this.height = h;
    this.size   = w * h;

    // Core data arrays
    this.type     = new Uint8Array(this.size);   // element type
    this.colorR   = new Uint8Array(this.size);
    this.colorG   = new Uint8Array(this.size);
    this.colorB   = new Uint8Array(this.size);
    this.temp     = new Float32Array(this.size);  // temperature
    this.moved    = new Uint8Array(this.size);    // did it move this frame?
    this.lifetime = new Int16Array(this.size);    // remaining life (-1 = infinite)
    this.extra    = new Int16Array(this.size);    // extra data (clone source, etc)

    // Dirty chunk tracking for optimized rendering
    this.chunksX = Math.ceil(w / CHUNK_SIZE);
    this.chunksY = Math.ceil(h / CHUNK_SIZE);
    this.dirtyChunks = new Uint8Array(this.chunksX * this.chunksY);
    this.activeChunks = new Uint8Array(this.chunksX * this.chunksY);
    this.nextActiveChunks = new Uint8Array(this.chunksX * this.chunksY);

    // Source spawners: Map of "x,y" -> elementId
    this.sources = new Map();

    // Undo snapshots
    this.undoStack = [];
    this.maxUndo = 5;

    // Tick counter for alternating scan direction
    this.tick = 0;

    this.clear();
  }

  clear() {
    this.type.fill(E.EMPTY);
    this.colorR.fill(26);
    this.colorG.fill(26);
    this.colorB.fill(46);
    this.temp.fill(AMBIENT_TEMP);
    this.moved.fill(0);
    this.lifetime.fill(-1);
    this.extra.fill(0);
    this.dirtyChunks.fill(1);
    this.activeChunks.fill(1);
    this.nextActiveChunks.fill(0);
    this.sources.clear();
  }

  addSource(x, y, elemId) {
    const key = x + "," + y;
    this.sources.set(key, elemId);
    this.markDirty(x, y);
    this.markActive(x, y);
  }

  removeSource(x, y) {
    const key = x + "," + y;
    this.sources.delete(key);
    this.markDirty(x, y);
  }

  removeSourcesInRadius(cx, cy, r) {
    const keysToRemove = [];
    for (const [key, _] of this.sources) {
      const parts = key.split(",");
      const sx = parseInt(parts[0]), sy = parseInt(parts[1]);
      const dx = sx - cx, dy = sy - cy;
      if (dx * dx + dy * dy <= r * r) {
        keysToRemove.push(key);
        this.markDirty(sx, sy);
      }
    }
    for (const k of keysToRemove) this.sources.delete(k);
  }

  idx(x, y) {
    return y * this.width + x;
  }

  inBounds(x, y) {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  get(x, y) {
    return this.type[y * this.width + x];
  }

  set(x, y, elemId) {
    const i = y * this.width + x;
    this.type[i] = elemId;
    const c = getElemColor(elemId);
    this.colorR[i] = c[0];
    this.colorG[i] = c[1];
    this.colorB[i] = c[2];
    this.temp[i] = elemId === E.LAVA ? 1200 :
                   elemId === E.FIRE ? 600 :
                   elemId === E.EMBER ? 400 :
                   elemId === E.ICE ? -10 :
                   elemId === E.SNOW ? -5 :
                   elemId === E.LIGHTNING ? 3000 :
                   elemId === E.PLASMA ? 2000 :
                   AMBIENT_TEMP;
    const el = ELEMENTS[elemId];
    this.lifetime[i] = el && el.lifetime > 0 ? el.lifetime + ((Math.random() * el.lifetime * 0.4) | 0) : -1;
    this.extra[i] = 0;
    this.markDirty(x, y);
    this.markActive(x, y);
  }

  swap(i1, i2) {
    let tmp;
    tmp = this.type[i1]; this.type[i1] = this.type[i2]; this.type[i2] = tmp;
    tmp = this.colorR[i1]; this.colorR[i1] = this.colorR[i2]; this.colorR[i2] = tmp;
    tmp = this.colorG[i1]; this.colorG[i1] = this.colorG[i2]; this.colorG[i2] = tmp;
    tmp = this.colorB[i1]; this.colorB[i1] = this.colorB[i2]; this.colorB[i2] = tmp;
    tmp = this.temp[i1]; this.temp[i1] = this.temp[i2]; this.temp[i2] = tmp;
    tmp = this.lifetime[i1]; this.lifetime[i1] = this.lifetime[i2]; this.lifetime[i2] = tmp;
    tmp = this.extra[i1]; this.extra[i1] = this.extra[i2]; this.extra[i2] = tmp;
  }

  markDirty(x, y) {
    const cx = (x / CHUNK_SIZE) | 0;
    const cy = (y / CHUNK_SIZE) | 0;
    this.dirtyChunks[cy * this.chunksX + cx] = 1;
  }

  markActive(x, y) {
    const cx = (x / CHUNK_SIZE) | 0;
    const cy = (y / CHUNK_SIZE) | 0;
    const ci = cy * this.chunksX + cx;
    this.nextActiveChunks[ci] = 1;
    // Also mark neighbors active
    if (cx > 0) this.nextActiveChunks[ci - 1] = 1;
    if (cx < this.chunksX - 1) this.nextActiveChunks[ci + 1] = 1;
    if (cy > 0) this.nextActiveChunks[ci - this.chunksX] = 1;
    if (cy < this.chunksY - 1) this.nextActiveChunks[ci + this.chunksX] = 1;
  }

  saveUndo() {
    if (this.undoStack.length >= this.maxUndo) this.undoStack.shift();
    this.undoStack.push({
      type: new Uint8Array(this.type),
      colorR: new Uint8Array(this.colorR),
      colorG: new Uint8Array(this.colorG),
      colorB: new Uint8Array(this.colorB),
      temp: new Float32Array(this.temp),
      lifetime: new Int16Array(this.lifetime),
      extra: new Int16Array(this.extra),
      sources: new Map(this.sources),
    });
  }

  popUndo() {
    const snap = this.undoStack.pop();
    if (!snap) return false;
    this.type.set(snap.type);
    this.colorR.set(snap.colorR);
    this.colorG.set(snap.colorG);
    this.colorB.set(snap.colorB);
    this.temp.set(snap.temp);
    this.lifetime.set(snap.lifetime);
    this.extra.set(snap.extra);
    this.sources = new Map(snap.sources);
    this.dirtyChunks.fill(1);
    this.activeChunks.fill(1);
    return true;
  }

  serialize() {
    // Pack grid state into a compact object for saving
    // We save: dimensions, type array, color arrays, temp, lifetime, extra, sources
    const sources = [];
    for (const [key, elemId] of this.sources) {
      sources.push(key + ":" + elemId);
    }
    // Compress type array with RLE for smaller saves
    const rle = [];
    let run = this.type[0], count = 1;
    for (let i = 1; i < this.size; i++) {
      if (this.type[i] === run && count < 255) {
        count++;
      } else {
        rle.push(run, count);
        run = this.type[i];
        count = 1;
      }
    }
    rle.push(run, count);

    return {
      v: 1,
      w: this.width,
      h: this.height,
      rle: rle,
      colorR: Array.from(this.colorR),
      colorG: Array.from(this.colorG),
      colorB: Array.from(this.colorB),
      temp: Array.from(this.temp),
      lifetime: Array.from(this.lifetime),
      extra: Array.from(this.extra),
      sources: sources,
    };
  }

  deserialize(data) {
    if (!data || data.v !== 1) return false;
    if (data.w !== this.width || data.h !== this.height) return false;

    // Decompress RLE
    let idx = 0;
    for (let i = 0; i < data.rle.length; i += 2) {
      const val = data.rle[i];
      const cnt = data.rle[i + 1];
      for (let j = 0; j < cnt && idx < this.size; j++) {
        this.type[idx++] = val;
      }
    }

    if (data.colorR) this.colorR.set(data.colorR);
    if (data.colorG) this.colorG.set(data.colorG);
    if (data.colorB) this.colorB.set(data.colorB);
    if (data.temp) this.temp.set(data.temp);
    if (data.lifetime) this.lifetime.set(new Int16Array(data.lifetime));
    if (data.extra) this.extra.set(new Int16Array(data.extra));

    this.sources.clear();
    if (data.sources) {
      for (const s of data.sources) {
        const sep = s.lastIndexOf(":");
        const key = s.substring(0, sep);
        const elemId = parseInt(s.substring(sep + 1));
        this.sources.set(key, elemId);
      }
    }

    this.dirtyChunks.fill(1);
    this.activeChunks.fill(1);
    return true;
  }

  beginFrame() {
    this.moved.fill(0);
    // Swap active chunk buffers
    const tmp = this.activeChunks;
    this.activeChunks = this.nextActiveChunks;
    this.nextActiveChunks = tmp;
    this.nextActiveChunks.fill(0);
    this.tick++;
  }
}
