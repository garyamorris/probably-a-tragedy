// Tiny deterministic hashing / PRNG helpers. No Math.random anywhere in the stage: golden screenshots rely on it.

export function hashStr(s) {
  s = String(s);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mix32(a) {
  a = a >>> 0;
  a = (a ^ (a >>> 16)) >>> 0;
  a = Math.imul(a, 0x85ebca6b) >>> 0;
  a ^= a >>> 13;
  a = Math.imul(a, 0xc2b2ae35) >>> 0;
  a ^= a >>> 16;
  return a >>> 0;
}

/** Stable float in [0,1) from any list of labels. */
export function hash01(...parts) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < parts.length; i++) {
    const s = String(parts[i]);
    for (let j = 0; j < s.length; j++) {
      h ^= s.charCodeAt(j);
      h = Math.imul(h, 16777619);
    }
    h ^= 0x9e;
    h = Math.imul(h, 16777619);
  }
  return mix32(h) / 4294967296;
}

export function hashInt(max, ...parts) {
  return Math.floor(hash01(...parts) * max);
}

export function pick(arr, ...parts) {
  if (!arr || !arr.length) return undefined;
  return arr[Math.min(arr.length - 1, Math.floor(hash01(...parts) * arr.length))];
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  const f = function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.seed = (s) => { a = s >>> 0; };
  return f;
}

const lat = (i, seed) => hash01('n', seed, i) * 2 - 1;
const sm = (t) => t * t * (3 - 2 * t);

/** Smooth 1-D value noise in [-1,1]; a pure function of (x, seed). */
export function noise1(x, seed = 0) {
  const i = Math.floor(x);
  const f = x - i;
  return lat(i, seed) * (1 - sm(f)) + lat(i + 1, seed) * sm(f);
}

/** Cheap flicker: sum of two noise octaves, in [-1,1]. */
export function flicker(t, seed = 0) {
  return noise1(t * 7.3, seed) * 0.6 + noise1(t * 17.1 + 11, seed + 1) * 0.4;
}
