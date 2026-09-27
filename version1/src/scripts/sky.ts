// Engraved star atlas for the midnight bands (title page, contact).
//
// The sky is a plate from a celestial atlas, slowly coming alive. One rigid
// chart carries everything engraved on it: a polar graticule (declination
// arcs and hour lines radiating from a pole above the band, the arcs
// lettered where they leave the right edge), unlinked field stars, and a few
// named figures (Cassiopeia, Cygnus, Lyra, Ursa Major) set in the clear
// spaces around the text, the crest plate and the headline figures. The
// whole plate sways a hair about its pole, like a pendulum, and never turns.
//
// Lighter things move around it: faint far stars twinkle behind the chart;
// gold-leaf flecks turn and glint as they rise (soft motes at night); the
// odd shooting star crosses the upper right; the name lets fall a few flakes
// of gold as it lands; an armillary ring with three beads passes behind the
// crest. The pointer brings a nearby figure up in gold and letters its Latin
// name; a click charts a new star and rules it in to its two nearest
// neighbours, where it stays. The far stars, the chart and the near flecks
// shift with the pointer and with scroll at different depths (parallax).
//
// Two inks, chosen by the band's CSS custom property --sky: 'ink' is
// copperplate navy on warm paper with gold accents (light theme); 'night'
// is the same atlas in pale stars and gilt lines on midnight (dark theme).
// The palette follows theme changes live.
//
// Runs only while its band is on screen and the tab is visible. Under
// reduced motion, or while the page's motion toggle reads 'still', a single
// still frame is drawn (graticule, stars, figures, ring) and nothing moves.

export interface SkyOptions {
  /** Area in px² per field star on the chart. */
  nodeArea?: number;
  /** Area in px² per faint far star. */
  starArea?: number;
  /** Number of soft gold motes (night palette). */
  motes?: number;
  /** Number of gold-leaf flecks (ink palette). Default 8. */
  flecks?: number;
  /** Seconds between shooting stars as [min, max]; false for none. */
  meteors?: [number, number] | false;
  /** Element that lets fall gold dust (the name on the title page). */
  dustFrom?: Element | null;
  /** Element circled by the armillary ring (the crest plate); figures keep clear of it. */
  orbit?: Element | null;
  /** Figure names on hover, pointer parallax, click-to-chart and the dust puff. */
  interactive?: boolean;
  /** Which named figures to set: the title page's or the closing band's. */
  asterisms?: 'hero' | 'contact';
  /** The chart's pole in fractions of the canvas [w, h]. Default [0.86, -0.55]. */
  pole?: [number, number];
  /** Element whose top edge bounds the chart below the crest (the headline figures). */
  floor?: Element | null;
  /** Elements whose boxes (plus 16px) figures and their names keep clear of. */
  avoid?: Element[];
}

type RGB = readonly [number, number, number];
type Box = { x0: number; y0: number; x1: number; y1: number };
type Star = { x: number; y: number; s: number; a: number; tw: number; sp: number };
type Field = { x: number; y: number; r: number; a: number; tw: number; sp: number; bright: boolean; hid: boolean };
type Mote = {
  x: number;
  y: number;
  vy: number;
  sway: number;
  ph: number;
  r: number;
  a: number;
  ai: number;
  rot: number;
  vr: number;
  tilt: number;
};
type Flake = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  g: number;
  drag: number;
  age: number;
  life: number;
  r: number;
  rot: number;
  vr: number;
  kind: 'leaf' | 'dot' | 'glow';
};
type Meteor = { x: number; y: number; vx: number; vy: number; len: number; age: number; life: number };
type Charted = { x: number; y: number; born: number; links: number[] };

type AsterName = 'Cassiopeia' | 'Cygnus' | 'Lyra' | 'Ursa Major';
type AsterDef = { aspect: number; pts: [number, number, number][]; edges: [number, number][] };
type FigStar = { x: number; y: number; r: number; mag: number };
type Fig = { name: AsterName; pts: FigStar[]; segs: number[]; box: Box; label: { x: number; y: number } | null; hv: number };

type Palette = {
  ink: boolean;
  star: string;
  starScale: number;
  twBase: number;
  twSp: [number, number];
  node: string;
  nodeAlpha: number;
  figAlpha: number;
  line: RGB;
  lineS: string;
  lineAlpha: number;
  grid: string;
  gridAlpha: number;
  label: string;
  pointer: RGB;
  pointerS: string;
  bright: string;
  brightAlpha: number;
  bead: string;
  beadRing: string;
  meteor: [string, string, string];
  meteorWidth: number;
  meteorHead: boolean;
  gold: HTMLCanvasElement;
};

const TAU = Math.PI * 2;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const wrap = (v: number, m: number) => ((v % m) + m) % m;
const SERIF = '"Cormorant Garamond Variable", "Cormorant Garamond", Georgia, serif';
const GRID_FONT = `italic 10px ${SERIF}`;
const NAME_FONT = `italic 500 14px ${SERIF}`;
/** Clearance kept around `avoid` boxes (the plate gets a little more). */
const PAD = 16;
/** Figures stay this far inside the canvas. */
const EDGE = 12;
/** How far a figure may be stretched from its natural proportions. */
const STRETCH = 1.25;
const RING_TILT = -0.14;

// The named figures, normalised to a unit box: [x, y, magnitude] per star
// and the pairs of stars the engraver ruled together. `aspect` is the box
// proportion (w / h) at which the figure looks like itself.
const ASTERISMS: Record<AsterName, AsterDef> = {
  Cassiopeia: {
    aspect: 1.9,
    pts: [[0, 0.35, 2.2], [0.24, 0.8, 2.3], [0.5, 0.42, 2.2], [0.74, 0.9, 2.7], [1, 0.2, 2.4]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4]],
  },
  Cygnus: {
    aspect: 0.9,
    pts: [[0.5, 0, 1.3], [0.5, 0.42, 2.2], [0.5, 1, 3.1], [0.08, 0.3, 2.5], [0.92, 0.56, 2.5], [0.28, 0.36, 3.2], [0.72, 0.49, 2.9]],
    edges: [[0, 1], [1, 2], [3, 5], [5, 1], [1, 6], [6, 4]],
  },
  Lyra: {
    aspect: 1.2,
    pts: [[0.2, 0, 0], [0.34, 0.34, 4.3], [0.58, 0.3, 4.3], [0.7, 0.92, 3.5], [0.46, 0.98, 3.2]],
    edges: [[0, 1], [0, 2], [1, 4], [2, 3], [3, 4]],
  },
  'Ursa Major': {
    aspect: 1.7,
    pts: [[0, 0.12, 1.9], [0.2, 0.2, 1.8], [0.36, 0.32, 1.8], [0.52, 0.42, 3.3], [0.56, 0.8, 2.4], [0.9, 0.86, 1.8], [0.95, 0.46, 2.4]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]],
  },
};

/* ---- Colour and box helpers -------------------------------------------- */
const rgb = (c: RGB) => `rgb(${c[0]},${c[1]},${c[2]})`;
const mix = (a: RGB, b: RGB, t: number) =>
  `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;

const bw = (b: Box) => b.x1 - b.x0;
const bh = (b: Box) => b.y1 - b.y0;
const grow = (b: Box, p: number): Box => ({ x0: b.x0 - p, y0: b.y0 - p, x1: b.x1 + p, y1: b.y1 + p });
const hits = (a: Box, b: Box) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

/** The largest box of the figure's proportions (within STRETCH) centred in `b`, capped in size. */
function fit(b: Box, aspect: number): Box {
  let fw = Math.min(bw(b), 300);
  let fh = Math.min(bh(b), 280);
  if (fw <= 0 || fh <= 0) return { x0: b.x0, y0: b.y0, x1: b.x0, y1: b.y0 };
  const a = fw / fh;
  if (a > aspect * STRETCH) fw = fh * aspect * STRETCH;
  else if (a < aspect / STRETCH) fh = (fw / aspect) * STRETCH;
  const cx = (b.x0 + b.x1) / 2;
  const cy = (b.y0 + b.y1) / 2;
  return { x0: cx - fw / 2, y0: cy - fh / 2, x1: cx + fw / 2, y1: cy + fh / 2 };
}

/** Shrink `b` to its largest side of the obstacle `r` (the side that fits the figure best). */
function clipAway(b: Box, r: Box, aspect: number): Box | null {
  if (!hits(b, r)) return b;
  const sides: Box[] = [
    { ...b, x1: Math.min(b.x1, r.x0) },
    { ...b, x0: Math.max(b.x0, r.x1) },
    { ...b, y1: Math.min(b.y1, r.y0) },
    { ...b, y0: Math.max(b.y0, r.y1) },
  ];
  let best: Box | null = null;
  let bestArea = 0;
  for (const s of sides) {
    if (bw(s) <= 0 || bh(s) <= 0) continue;
    const f = fit(s, aspect);
    const area = bw(f) * bh(f);
    if (area > bestArea) {
      bestArea = area;
      best = s;
    }
  }
  return best;
}

/** A radial sprite rendered once and stamped with drawImage. */
function sprite(stops: [number, string][]): HTMLCanvasElement {
  const size = 64;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  if (g) {
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    for (const [at, col] of stops) grd.addColorStop(at, col);
    g.fillStyle = grd;
    g.fillRect(0, 0, size, size);
  }
  return c;
}

function makePalette(scheme: 'ink' | 'night'): Palette {
  if (scheme === 'ink') {
    // Copperplate: navy ink on warm paper, gold used sparingly and hard-edged
    // (a soft glow on paper reads as a smudge).
    const navy: RGB = [26, 48, 86];
    const gold: RGB = [176, 141, 62];
    return {
      ink: true,
      star: 'rgb(34,56,96)',
      starScale: 0.7,
      twBase: 0.85,
      twSp: [0.2, 0.6],
      node: rgb(navy),
      nodeAlpha: 0.75,
      figAlpha: 0.9,
      line: navy,
      lineS: rgb(navy),
      lineAlpha: 0.26,
      grid: rgb(navy),
      gridAlpha: 0.07,
      label: rgb(navy),
      pointer: gold,
      pointerS: rgb(gold),
      bright: 'rgb(166,128,48)',
      brightAlpha: 0.5,
      bead: rgb(gold),
      beadRing: rgb(navy),
      meteor: ['rgba(122,90,24,.85)', 'rgba(176,141,62,.4)', 'rgba(176,141,62,0)'],
      meteorWidth: 0.9,
      meteorHead: false,
      gold: sprite([
        [0, 'rgba(150,115,40,1)'],
        [0.42, 'rgba(150,115,40,1)'],
        [0.5, 'rgba(150,115,40,0)'],
        [1, 'rgba(0,0,0,0)'],
      ]),
    };
  }
  // Night: pale stars, gilt lines, and light that may glow.
  const ivory: RGB = [246, 232, 196];
  const gilt: RGB = [222, 190, 120];
  const pale: RGB = [246, 226, 166];
  return {
    ink: false,
    star: 'rgb(246,236,210)',
    starScale: 1,
    twBase: 0.55,
    twSp: [0.6, 2.2],
    node: rgb(ivory),
    nodeAlpha: 1,
    figAlpha: 1,
    line: gilt,
    lineS: rgb(gilt),
    lineAlpha: 0.38,
    grid: rgb(gilt),
    gridAlpha: 0.09,
    label: 'rgb(246,236,210)',
    pointer: pale,
    pointerS: rgb(pale),
    bright: rgb(pale),
    brightAlpha: 0.55,
    bead: 'rgb(226,194,125)',
    beadRing: 'rgb(252,248,236)',
    meteor: ['rgba(255,248,228,1)', 'rgba(240,210,140,.55)', 'rgba(226,194,125,0)'],
    meteorWidth: 1.2,
    meteorHead: true,
    gold: sprite([
      [0, 'rgba(255,248,226,1)'],
      [0.16, 'rgba(246,226,166,.9)'],
      [0.42, 'rgba(226,194,125,.24)'],
      [1, 'rgba(226,194,125,0)'],
    ]),
  };
}

export function mountSky(host: HTMLElement, canvas: HTMLCanvasElement, options: SkyOptions = {}): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const opt = {
    nodeArea: options.nodeArea ?? 10500,
    starArea: options.starArea ?? 2600,
    motes: options.motes ?? 16,
    flecks: options.flecks ?? 8,
    meteors: options.meteors ?? ([18, 40] as [number, number]),
    dustFrom: options.dustFrom ?? null,
    orbit: options.orbit ?? null,
    interactive: options.interactive ?? true,
    asterisms: options.asterisms,
    pole: options.pole ?? ([0.86, -0.55] as [number, number]),
    floor: options.floor ?? null,
    avoid: (options.avoid ?? []).filter((el): el is Element => !!el),
  };
  const root = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const wide = window.matchMedia('(min-width: 901px)');
  const roomy = window.matchMedia('(min-width: 741px)');
  const isStill = () => reduce.matches || root.dataset.motion === 'still';

  const schemeOf = (): 'ink' | 'night' =>
    getComputedStyle(host).getPropertyValue('--sky').trim() === 'night' ? 'night' : 'ink';
  let scheme = schemeOf();
  let pal = makePalette(scheme);

  let w = 0;
  let h = 0;
  let dpr = 1;
  let stars: Star[] = [];
  let field: Field[] = [];
  let motes: Mote[] = [];
  let figs: Fig[] = [];
  const flakes: Flake[] = [];
  const meteors: Meteor[] = [];
  const charted: Charted[] = [];
  let raf = 0;
  let last = 0;
  let clock = 0;
  let onScreen = true;
  let nextMeteor = rand(4500, 9000);
  let dustDebt = 0;
  let lastPuff = -1e9;
  const pointer = { cx: 0, cy: 0, x: 0, y: 0, on: false };
  const par = { x: 0, y: 0 };
  // The chart transform used for the last frame (for mapping the pointer
  // and clicks back into chart space).
  const view = { nx: 0, ny: 0, th: 0 };

  // Cached geometry, all relative to the canvas. Layout boxes (placement)
  // are measured on resize and when fonts settle; the live boxes (scroll
  // shift, the crest as it leans and drifts) on scroll and now and then.
  let restPlate: Box | null = null;
  let floorTop = 0;
  let avoidBoxes: Box[] = [];
  let dustBox: Box | null = null;
  let livePlate: Box | null = null;
  let cLeft = 0;
  let cTop = 0;
  let shift = 0;
  let dirty = true;
  let liveAt = -1e9;
  let leanUntil = 0;

  // The graticule is engraved to an offscreen plate and stamped each frame.
  // Its geometry is worked out on resize; the plate is re-engraved on
  // resize, on a palette change, and when the chart has moved by more than
  // a third of a pixel (see bakeGrid).
  const grid = document.createElement('canvas');
  const gctx = grid.getContext('2d');
  let gridRadii: number[] = [];
  let gridNear = 0;
  let gridFar = 0;
  let gridLabels: { text: string; x: number; y: number; box: Box }[] = [];
  const baked = { nx: 0, ny: 0, th: 0, ok: false };

  const poleX = () => opt.pole[0] * w;
  const poleY = () => opt.pole[1] * h;

  /* ---- Population ------------------------------------------------------ */
  const seed = () => {
    const area = w * h;
    stars = Array.from({ length: Math.min(420, Math.round(area / opt.starArea)) }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      s: rand(0.5, 1.4),
      a: rand(0.18, 0.7),
      tw: Math.random() * TAU,
      sp: Math.random(),
    }));
    field = Array.from({ length: Math.max(24, Math.min(130, Math.round(area / opt.nodeArea))) }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: rand(0.5, 1.4),
      a: rand(0.4, 0.85),
      tw: Math.random() * TAU,
      sp: Math.random(),
      bright: Math.random() < 0.07,
      hid: false,
    }));
    motes = Array.from({ length: Math.max(opt.motes, opt.flecks) }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vy: rand(-0.22, -0.05),
      sway: rand(0.15, 0.6),
      ph: Math.random() * TAU,
      r: rand(1.4, 4.2),
      a: rand(0.05, 0.16),
      ai: rand(0.5, 0.85),
      rot: Math.random() * TAU,
      vr: rand(0.015, 0.04) * (Math.random() < 0.5 ? -1 : 1),
      tilt: rand(-0.7, 0.7),
    }));
    flakes.length = 0;
    meteors.length = 0;
    charted.length = 0;
  };

  /* ---- Graticule --------------------------------------------------------- */
  // Declination arcs about the pole every 220px, from the first that reaches
  // into the canvas; 24 hour lines every 15° (each sixth solid, the rest
  // dotted); arcs lettered +60°, +45°, ... where they meet the right edge.
  const layoutGrid = () => {
    baked.ok = false;
    const px = poleX();
    const py = poleY();
    gridFar = Math.max(Math.hypot(px, py), Math.hypot(px - w, py), Math.hypot(px, py - h), Math.hypot(px - w, py - h));
    gridNear = Math.hypot(px - Math.max(0, Math.min(w, px)), py - Math.max(0, Math.min(h, py)));
    gridRadii = [];
    for (let R = gridNear + 60; R < gridFar + 60; R += 220) gridRadii.push(R);
    gridLabels = [];
    ctx.font = GRID_FONT;
    const lx = w - 24;
    const dx = lx - px;
    gridRadii.forEach((R, i) => {
      const dec = 60 - 15 * i;
      if (dec < -75 || R <= Math.abs(dx)) return;
      const y = py + Math.sqrt(R * R - dx * dx);
      if (y < 16 || y > h - 10) return;
      const text = dec > 0 ? `+${dec}°` : dec === 0 ? '0°' : `-${-dec}°`;
      const tw = ctx.measureText(text).width;
      gridLabels.push({ text, x: lx, y: y - 4, box: { x0: lx - tw, y0: y - 14, x1: lx, y1: y } });
    });
  };

  // Engrave the graticule into `g`, whose transform is already chart space.
  const strokeGrid = (g: CanvasRenderingContext2D) => {
    const px = poleX();
    const py = poleY();
    const reach = gridFar + 60;
    g.strokeStyle = pal.grid;
    g.globalAlpha = pal.gridAlpha;
    g.lineWidth = 0.6;
    g.setLineDash([]);
    g.beginPath();
    for (const R of gridRadii) {
      g.moveTo(px + R, py);
      g.arc(px, py, R, 0, TAU);
    }
    g.stroke();
    const r0 = Math.max(0, gridNear - 24);
    for (let k = 0; k < 24; k++) {
      const a = (k * TAU) / 24;
      const c = Math.cos(a);
      const s = Math.sin(a);
      // Skip the hour lines that never reach the canvas.
      const ex = px + c * reach;
      const ey = py + s * reach;
      if ((ex < -60 && px < 0) || (ex > w + 60 && px > w) || (ey < -60 && py < 0) || (ey > h + 60 && py > h)) continue;
      g.setLineDash(k % 6 === 0 ? [] : [1, 5]);
      g.beginPath();
      g.moveTo(px + c * r0, py + s * r0);
      g.lineTo(ex, ey);
      g.stroke();
    }
    g.setLineDash([]);
    g.font = GRID_FONT;
    g.fillStyle = pal.label;
    g.globalAlpha = 0.35;
    g.textAlign = 'right';
    g.textBaseline = 'alphabetic';
    for (const l of gridLabels) g.fillText(l.text, l.x, l.y);
    g.globalAlpha = 1;
  };

  // The offscreen plate is engraved already turned and shifted to the
  // chart's current position, so stamping it is a plain 1:1 copy; stamping
  // a rotated full-size image every frame is slow where canvas is drawn in
  // software. The sway moves the far corner about a pixel a second, so the
  // plate is re-engraved a few times a second at most (every frame only
  // while the pointer or a scroll is moving the parallax).
  const bakeGrid = () => {
    if (!gctx) return;
    if (grid.width !== canvas.width || grid.height !== canvas.height) {
      grid.width = canvas.width;
      grid.height = canvas.height;
    }
    gctx.setTransform(1, 0, 0, 1, 0, 0);
    gctx.clearRect(0, 0, grid.width, grid.height);
    gctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const px = poleX();
    const py = poleY();
    gctx.translate(view.nx + px, view.ny + py);
    gctx.rotate(view.th);
    gctx.translate(-px, -py);
    strokeGrid(gctx);
    baked.nx = view.nx;
    baked.ny = view.ny;
    baked.th = view.th;
    baked.ok = true;
  };

  /* ---- Geometry ---------------------------------------------------------- */
  // Page position of an element's border box through the offsetParent chain.
  // This ignores CSS transforms (entrance animations, the crest's lean and
  // drift), so figures are placed for the page at rest.
  const pagePos = (el: HTMLElement): [number, number] => {
    let x = 0;
    let y = 0;
    let n: HTMLElement | null = el;
    while (n) {
      x += n.offsetLeft;
      y += n.offsetTop;
      const p: Element | null = n.offsetParent;
      if (p) {
        x += p.clientLeft;
        y += p.clientTop;
      }
      n = p instanceof HTMLElement ? p : null;
    }
    return [x, y];
  };

  const restRect = (el: Element | null): Box | null => {
    if (!el) return null;
    if (el instanceof HTMLElement && el.offsetParent && canvas.offsetParent) {
      if (!el.offsetWidth && !el.offsetHeight) return null;
      const [ex, ey] = pagePos(el);
      const [cx, cy] = pagePos(canvas);
      return { x0: ex - cx, y0: ey - cy, x1: ex - cx + el.offsetWidth, y1: ey - cy + el.offsetHeight };
    }
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) return null;
    const c = canvas.getBoundingClientRect();
    return { x0: r.left - c.left, y0: r.top - c.top, x1: r.right - c.left, y1: r.bottom - c.top };
  };

  const measureLayout = () => {
    restPlate = restRect(opt.orbit);
    floorTop = restRect(opt.floor)?.y0 ?? h;
    avoidBoxes = [];
    for (const el of opt.avoid) {
      const b = restRect(el);
      if (b) avoidBoxes.push(b);
    }
    dustBox = null;
    if (opt.dustFrom) {
      const r = opt.dustFrom.getBoundingClientRect();
      const c = canvas.getBoundingClientRect();
      if (r.width) dustBox = { x0: r.left - c.left, y0: r.top - c.top, x1: r.right - c.left, y1: r.bottom - c.top };
    }
    place();
  };

  const measureLive = () => {
    dirty = false;
    liveAt = clock;
    const c = canvas.getBoundingClientRect();
    cLeft = c.left;
    cTop = c.top;
    shift = Math.max(0, Math.min(h, -c.top));
    livePlate = null;
    if (opt.orbit && wide.matches) {
      const r = opt.orbit.getBoundingClientRect();
      if (r.width) livePlate = { x0: r.left - c.left, y0: r.top - c.top, x1: r.right - c.left, y1: r.bottom - c.top };
    }
  };

  /* ---- Figures ------------------------------------------------------------ */
  // Set one figure in `box0`: keep it inside the canvas, shrink it clear of
  // every blocked box, fit it to its proportions, then find a place for its
  // name (below, right, above, left) that is clear too.
  const build = (name: AsterName, box0: Box, blocked: Box[]): Fig | null => {
    const def = ASTERISMS[name];
    let b: Box | null = {
      x0: Math.max(EDGE, box0.x0),
      y0: Math.max(EDGE, box0.y0),
      x1: Math.min(w - EDGE, box0.x1),
      y1: Math.min(h - EDGE, box0.y1),
    };
    if (bw(b) <= 0 || bh(b) <= 0) return null;
    for (const r of blocked) {
      b = clipAway(b, r, def.aspect);
      if (!b) return null;
    }
    const f = fit(b, def.aspect);
    if (bw(f) < 36 || bh(f) < 36 || bw(f) * bh(f) < 3000) return null;

    const pts: FigStar[] = def.pts.map(([u, v, mag]) => ({
      x: f.x0 + u * bw(f),
      y: f.y0 + v * bh(f),
      mag,
      r: Math.max(0.8, 2.6 - 0.45 * mag),
    }));
    const box: Box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    for (const p of pts) {
      box.x0 = Math.min(box.x0, p.x - p.r);
      box.y0 = Math.min(box.y0, p.y - p.r);
      box.x1 = Math.max(box.x1, p.x + p.r);
      box.y1 = Math.max(box.y1, p.y + p.r);
    }
    // Rules stop short of the stars, as an engraver leaves them.
    const segs: number[] = [];
    for (const [i, j] of def.edges) {
      const a = pts[i];
      const c = pts[j];
      const dx = c.x - a.x;
      const dy = c.y - a.y;
      const d = Math.hypot(dx, dy);
      const ga = a.r + 2.2;
      const gc = c.r + 2.2;
      if (d <= ga + gc + 2) continue;
      segs.push(a.x + (dx / d) * ga, a.y + (dy / d) * ga, c.x - (dx / d) * gc, c.y - (dy / d) * gc);
    }

    ctx.font = NAME_FONT;
    const tw = ctx.measureText(name).width;
    const mx = (box.x0 + box.x1) / 2;
    const my = (box.y0 + box.y1) / 2;
    const spots: [number, number][] = [
      [mx - tw / 2, box.y1 + 16],
      [box.x1 + 10, my + 4],
      [mx - tw / 2, box.y0 - 9],
      [box.x0 - 10 - tw, my + 4],
    ];
    const clear = (x: number, y: number) => {
      const lb: Box = { x0: x - 2, y0: y - 10, x1: x + tw + 2, y1: y + 4 };
      return !hits(lb, box) && !blocked.some((r) => hits(lb, r));
    };
    let label: { x: number; y: number } | null = null;
    for (const [x, y] of spots) {
      if (x - 2 >= EDGE && x + tw + 2 <= w - EDGE && y - 10 >= EDGE && y + 4 <= h - EDGE && clear(x, y)) {
        label = { x, y };
        break;
      }
    }
    if (!label) {
      // Nothing clear as it stands: try each spot pulled inside the canvas.
      for (const [x0, y0] of spots) {
        const x = Math.max(EDGE + 2, Math.min(w - EDGE - tw - 2, x0));
        const y = Math.max(EDGE + 10, Math.min(h - EDGE - 4, y0));
        if (clear(x, y)) {
          label = { x, y };
          break;
        }
      }
    }
    return { name, pts, segs, box, label, hv: 0 };
  };

  // Which figures go where. Boxes come from the cached layout rects; each
  // figure has one or more candidate boxes, tried in order.
  const place = () => {
    figs = [];
    for (const f of field) f.hid = false;
    if (!opt.asterisms || !w) return;
    const blocked = avoidBoxes.map((b) => grow(b, PAD));
    const p = restPlate;
    if (p) blocked.push(grow(p, PAD + 6));
    // The graticule's own lettering stays legible too.
    for (const l of gridLabels) blocked.push(grow(l.box, 6));
    const plan: [AsterName, Box[]][] = [];

    if (opt.asterisms === 'hero') {
      if (p && wide.matches) {
        const pw = bw(p);
        plan.push(['Cassiopeia', [{ x0: p.x0 + 0.1 * pw, y0: p.y0 - 130, x1: p.x0 + 0.6 * pw, y1: p.y0 - 30 }]]);
        plan.push(['Cygnus', [{ x0: p.x1 - 20, y0: p.y0 - 150, x1: Math.min(w - 16, p.x1 + 150), y1: p.y0 + 110 }]]);
        if (floorTop - 24 - (p.y1 + 30) >= 60) {
          plan.push(['Lyra', [{ x0: p.x0 + 0.55 * pw, y0: p.y1 + 30, x1: p.x1, y1: floorTop - 24 }]]);
        }
      } else {
        const boxes: Box[] = [];
        if (p) {
          const pw = bw(p);
          boxes.push({ x0: p.x0 + 0.2 * pw, y0: p.y0 - 120, x1: p.x1 - 0.2 * pw, y1: p.y0 - 24 });
        }
        boxes.push({ x0: w * 0.58, y0: EDGE, x1: w - 16, y1: EDGE + Math.min(110, h * 0.16) });
        if (p) {
          // Tablet widths leave room beside the centred plate.
          const y0 = p.y0 + 0.12 * bh(p);
          boxes.push({ x0: p.x1 + 20, y0, x1: Math.min(w - 16, p.x1 + 200), y1: y0 + 110 });
          boxes.push({ x0: Math.max(16, p.x0 - 200), y0, x1: p.x0 - 20, y1: y0 + 110 });
        }
        plan.push(['Cassiopeia', boxes]);
      }
    } else if (roomy.matches) {
      plan.push(['Ursa Major', [{ x0: w * 0.03, y0: h * 0.1, x1: w * 0.2, y1: h * 0.32 }]]);
      plan.push(['Lyra', [{ x0: w * 0.84, y0: h * 0.1, x1: w * 0.95, y1: h * 0.36 }]]);
    } else {
      plan.push(['Lyra', [{ x0: w * 0.78, y0: EDGE, x1: w - 14, y1: EDGE + Math.min(100, h * 0.12) }]]);
    }

    for (const [name, boxes] of plan) {
      for (const b of boxes) {
        const fig = build(name, b, blocked);
        if (!fig) continue;
        figs.push(fig);
        blocked.push(grow(fig.box, 18));
        if (fig.label) {
          ctx.font = NAME_FONT;
          const tw = ctx.measureText(name).width;
          blocked.push({ x0: fig.label.x - 8, y0: fig.label.y - 16, x1: fig.label.x + tw + 8, y1: fig.label.y + 10 });
        }
        break;
      }
    }
    // Field stars that would crowd a figure are left off the plate.
    for (const f of field) {
      f.hid = figs.some((g) => f.x > g.box.x0 - 10 && f.x < g.box.x1 + 10 && f.y > g.box.y0 - 10 && f.y < g.box.y1 + 10);
    }
  };

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const nw = Math.max(1, rect.width);
    const nh = Math.max(1, rect.height);
    dpr = Math.min(window.devicePixelRatio || 1, nw < 700 ? 1.5 : 2);
    const cw = Math.round(nw * dpr);
    const ch = Math.round(nh * dpr);
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!w || Math.abs(nw - w) > 80 || Math.abs(nh - h) > 160) {
      w = nw;
      h = nh;
      seed();
    } else if (nw !== w || nh !== h) {
      // Small changes (fonts settling, a scrollbar) keep the sky and rescale it.
      const sx = nw / w;
      const sy = nh / h;
      for (const p of [...stars, ...field, ...motes, ...charted, ...flakes]) {
        p.x *= sx;
        p.y *= sy;
      }
      w = nw;
      h = nh;
    }
    layoutGrid();
    measureLive();
    measureLayout();
  };

  /* ---- Spawners ---------------------------------------------------------- */
  // Ink: flakes of gold leaf that settle (a gentle fall). Night: motes of
  // light that rise from the name as before.
  const addFlake = (b: Box) => {
    const x = rand(b.x0, b.x1);
    const y = b.y0 + rand(0.3, 0.85) * bh(b);
    if (pal.ink) {
      flakes.push({
        x,
        y,
        vx: rand(-0.1, 0.1),
        vy: 0.05,
        g: 0.004,
        drag: 0.985,
        age: 0,
        life: rand(1800, 3200),
        r: rand(0.8, 1.3),
        rot: Math.random() * TAU,
        vr: rand(0.04, 0.1) * (Math.random() < 0.5 ? -1 : 1),
        kind: Math.random() < 0.72 ? 'leaf' : 'dot',
      });
    } else {
      flakes.push({
        x,
        y,
        vx: rand(-0.12, 0.12),
        vy: rand(-0.42, -0.12),
        g: -0.0015,
        drag: 1,
        age: 0,
        life: rand(2400, 4600),
        r: rand(0.5, 1.4),
        rot: 0,
        vr: 0,
        kind: 'glow',
      });
    }
    if (flakes.length > 160) flakes.splice(0, flakes.length - 160);
  };

  const shedDust = (dt: number) => {
    if (!dustBox) return;
    if (pal.ink) {
      // Only while the name lands; afterwards the pointer can shake some loose.
      if (clock > 2500) return;
      dustDebt += dt * 0.006;
    } else {
      dustDebt += dt * 0.00225;
    }
    while (dustDebt >= 1) {
      dustDebt -= 1;
      addFlake(dustBox);
    }
  };

  const puff = () => {
    if (!dustBox || !raf || clock - lastPuff < 1200) return;
    lastPuff = clock;
    for (let i = 0; i < 12; i++) addFlake(dustBox);
  };

  const launchMeteor = () => {
    const a = rand(0.5, 0.75);
    const v = rand(10, 15);
    meteors.push({
      x: rand(w * 0.62, w * 1.02),
      y: rand(-h * 0.04, h * 0.18),
      vx: -Math.cos(a) * v,
      vy: Math.sin(a) * v,
      len: rand(110, 200),
      age: 0,
      life: rand(450, 700),
    });
  };

  // A click charts a new star at the point under the pointer (in chart
  // space) and rules it in to its two nearest field stars.
  const chart = (clientX: number, clientY: number) => {
    if (isStill() || !raf || !w) return;
    if (dirty) measureLive();
    const px = poleX();
    const py = poleY();
    const dx = clientX - cLeft - view.nx - px;
    const dy = clientY - cTop - view.ny - py;
    const c = Math.cos(view.th);
    const s = Math.sin(view.th);
    const qx = dx * c + dy * s + px;
    const qy = -dx * s + dy * c + py;
    let a = -1;
    let b = -1;
    let da = Infinity;
    let db = Infinity;
    field.forEach((f, i) => {
      if (f.hid) return;
      const d = (f.x - qx) ** 2 + (f.y - qy) ** 2;
      if (d < da) {
        b = a;
        db = da;
        a = i;
        da = d;
      } else if (d < db) {
        b = i;
        db = d;
      }
    });
    charted.push({ x: qx, y: qy, born: clock, links: [a, b].filter((i) => i >= 0) });
    if (charted.length > 6) charted.shift();
  };

  /* ---- Drawing ---------------------------------------------------------- */
  // A gold-leaf rhombus, half-width hw and half-height hh, turned by `ang`.
  const leaf = (x: number, y: number, hw: number, hh: number, ang: number, alpha: number) => {
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.moveTo(x + hh * s, y - hh * c);
    ctx.lineTo(x + hw * c, y + hw * s);
    ctx.lineTo(x - hh * s, y + hh * c);
    ctx.lineTo(x - hw * c, y - hw * s);
    ctx.closePath();
    ctx.fill();
  };

  const twinkle = (sp: number, ph: number, live: boolean) => {
    const depth = 1 - pal.twBase;
    if (!live) return pal.twBase + depth * 0.5;
    const speed = pal.twSp[0] + sp * (pal.twSp[1] - pal.twSp[0]);
    return pal.twBase + depth * Math.sin(clock * 0.001 * speed + ph);
  };

  const drawField = (live: boolean) => {
    ctx.fillStyle = pal.node;
    for (const f of field) {
      if (f.hid) continue;
      ctx.globalAlpha = f.a * twinkle(f.sp, f.tw, live) * pal.nodeAlpha;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, TAU);
      ctx.fill();
    }
    // A few brighter stars carry a small fixed cross that breathes.
    ctx.strokeStyle = pal.bright;
    ctx.lineWidth = 0.7;
    for (const f of field) {
      if (!f.bright || f.hid) continue;
      ctx.globalAlpha = pal.brightAlpha + (live ? 0.15 * Math.sin(clock / 1300 + f.tw) : 0);
      ctx.beginPath();
      ctx.moveTo(f.x - 3.5, f.y);
      ctx.lineTo(f.x + 3.5, f.y);
      ctx.moveTo(f.x, f.y - 3.5);
      ctx.lineTo(f.x, f.y + 3.5);
      ctx.stroke();
    }
  };

  const drawFigures = (dt: number, live: boolean) => {
    if (!figs.length) return;
    // The pointer, taken back into chart space.
    const hover = live && pointer.on;
    let qx = 0;
    let qy = 0;
    if (hover) {
      const px = poleX();
      const py = poleY();
      const dx = pointer.x - view.nx - px;
      const dy = pointer.y - view.ny - py;
      const c = Math.cos(view.th);
      const s = Math.sin(view.th);
      qx = dx * c + dy * s + px;
      qy = -dx * s + dy * c + py;
    }
    for (const g of figs) {
      if (live) {
        let near = false;
        if (hover) {
          for (const p of g.pts) {
            if ((p.x - qx) ** 2 + (p.y - qy) ** 2 < 8100) {
              near = true;
              break;
            }
          }
        }
        g.hv = Math.max(0, Math.min(1, g.hv + (near ? dt : -dt) / 350));
      }
      const e = live ? g.hv * g.hv * (3 - 2 * g.hv) : 0;

      ctx.lineWidth = 0.6;
      ctx.strokeStyle = e > 0.001 ? mix(pal.line, pal.pointer, e) : pal.lineS;
      ctx.globalAlpha = pal.lineAlpha + (0.6 - pal.lineAlpha) * e;
      ctx.beginPath();
      for (let i = 0; i < g.segs.length; i += 4) {
        ctx.moveTo(g.segs[i], g.segs[i + 1]);
        ctx.lineTo(g.segs[i + 2], g.segs[i + 3]);
      }
      ctx.stroke();

      ctx.fillStyle = pal.node;
      ctx.globalAlpha = pal.figAlpha;
      ctx.beginPath();
      for (const p of g.pts) {
        ctx.moveTo(p.x + p.r, p.y);
        ctx.arc(p.x, p.y, p.r, 0, TAU);
      }
      ctx.fill();

      // The brightest stars get four short engraved rays.
      ctx.strokeStyle = pal.node;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      for (const p of g.pts) {
        if (p.mag >= 1.6) continue;
        const l = p.r * 3;
        ctx.moveTo(p.x - l, p.y);
        ctx.lineTo(p.x + l, p.y);
        ctx.moveTo(p.x, p.y - l);
        ctx.lineTo(p.x, p.y + l);
      }
      ctx.stroke();

      if (e > 0.01) {
        ctx.strokeStyle = pal.pointerS;
        ctx.globalAlpha = 0.6 * e;
        ctx.beginPath();
        for (const p of g.pts) {
          ctx.moveTo(p.x + p.r + 3, p.y);
          ctx.arc(p.x, p.y, p.r + 3, 0, TAU);
        }
        ctx.stroke();
        if (g.label) {
          ctx.font = NAME_FONT;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'alphabetic';
          ctx.fillStyle = pal.label;
          ctx.globalAlpha = 0.82 * e;
          ctx.fillText(g.name, g.label.x, g.label.y);
        }
      }
    }
  };

  const drawCharted = (live: boolean) => {
    for (const c of charted) {
      const age = live ? clock - c.born : 1e9;
      const t = 1 - (1 - Math.min(1, age / 650)) ** 3;
      const fade = Math.min(1, age / 4000);
      ctx.strokeStyle = pal.pointerS;
      ctx.lineWidth = 0.6;
      ctx.globalAlpha = 0.7 - 0.44 * fade;
      ctx.beginPath();
      for (const j of c.links) {
        const f = field[j];
        if (!f) continue;
        const dx = f.x - c.x;
        const dy = f.y - c.y;
        const d = Math.hypot(dx, dy);
        const len = (d - 3.5 - f.r - 2.2) * t;
        if (len <= 0) continue;
        const ux = dx / d;
        const uy = dy / d;
        ctx.moveTo(c.x + ux * 3.5, c.y + uy * 3.5);
        ctx.lineTo(c.x + ux * (3.5 + len), c.y + uy * (3.5 + len));
      }
      ctx.stroke();
      ctx.globalAlpha = 0.95 - 0.25 * fade;
      ctx.drawImage(pal.gold, c.x - 5, c.y - 5, 10, 10);
      if (t < 1) {
        ctx.globalAlpha = 0.5 * (1 - t);
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.arc(c.x, c.y, 4 + 26 * t, 0, TAU);
        ctx.stroke();
      }
    }
  };

  // The armillary ring: a flat, tilted ellipse about the crest, dotted, with
  // 24 ticks and three beads. It is clipped out where the plate stands, so
  // it reads as a ring passing behind it.
  const drawRing = (live: boolean) => {
    const p = livePlate;
    if (!p) return;
    const pw = bw(p);
    const ph = bh(p);
    const cx = (p.x0 + p.x1) / 2;
    const cy = (p.y0 + p.y1) / 2;
    const rx = pw * 0.72;
    const ry = ph * 0.7 * 0.34;
    const ct = Math.cos(RING_TILT);
    const st = Math.sin(RING_TILT);
    const at = (phi: number, out: number): [number, number] => {
      const c = Math.cos(phi);
      const s = Math.sin(phi);
      let ex = rx * c;
      let ey = ry * s;
      if (out) {
        const nx = c / rx;
        const ny = s / ry;
        const n = Math.hypot(nx, ny) || 1;
        ex += (out * nx) / n;
        ey += (out * ny) / n;
      }
      return [cx + ex * ct - ey * st, cy + ex * st + ey * ct];
    };
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.rect(p.x0 - 1, p.y0 - 1, pw + 2, ph + 2);
    ctx.clip('evenodd');
    ctx.strokeStyle = pal.lineS;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 0.6;
    ctx.setLineDash([1, 6]);
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, RING_TILT, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    for (let k = 0; k < 24; k++) {
      const phi = (k * TAU) / 24;
      const [x0, y0] = at(phi, 0);
      const [x1, y1] = at(phi, 2);
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
    }
    ctx.stroke();
    const base = live ? (clock * TAU) / 90000 : 0.6;
    ctx.globalAlpha = 1;
    ctx.lineWidth = 0.5;
    ctx.fillStyle = pal.bead;
    ctx.strokeStyle = pal.beadRing;
    for (let j = 0; j < 3; j++) {
      const [x, y] = at(base + (j * TAU) / 3, 0);
      ctx.beginPath();
      ctx.arc(x, y, 1.6, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  };

  // Nearest layer. Ink: gold-leaf flecks that rise slowly and turn, glinting
  // as they face the light. Night: soft motes of light.
  const drawMotes = (k: number, px: number, py: number, sh: number) => {
    const mx = -px * 26;
    const my = -py * 16 + sh * 0.32;
    const n = Math.min(motes.length, pal.ink ? opt.flecks : opt.motes);
    if (pal.ink) ctx.fillStyle = pal.bright;
    for (let i = 0; i < n; i++) {
      const m = motes[i];
      m.y += m.vy * k * (pal.ink ? 0.55 : 1);
      m.ph += 0.01 * k;
      m.rot += m.vr * k;
      if (m.y < -20) {
        m.y = h + 20;
        m.x = Math.random() * w;
      }
      const x = wrap(m.x + Math.sin(m.ph) * 18 * m.sway + mx, w);
      const y = wrap(m.y + my, h);
      if (pal.ink) {
        const c = Math.cos(m.rot);
        const glint = Math.max(0, c) ** 6;
        leaf(x, y, 1 * (0.3 + 0.7 * Math.abs(c)), 1.5, m.tilt + Math.sin(m.ph) * 0.4, m.ai * (0.25 + 0.75 * glint));
      } else {
        ctx.globalAlpha = Math.min(1, m.a * (0.7 + 0.3 * Math.sin(m.ph * 2)));
        ctx.drawImage(pal.gold, x - m.r * 5, y - m.r * 5, m.r * 10, m.r * 10);
      }
    }
  };

  const drawMeteors = (dt: number, k: number) => {
    if (!meteors.length) return;
    // On the title page they keep to the upper right, clear of the name.
    const clip = opt.asterisms === 'hero' && wide.matches;
    if (clip) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(w * 0.46, 0, w * 0.54, h * 0.62);
      ctx.clip();
    }
    ctx.lineWidth = pal.meteorWidth;
    for (let i = meteors.length - 1; i >= 0; i--) {
      const m = meteors[i];
      m.age += dt;
      if (m.age >= m.life) {
        meteors.splice(i, 1);
        continue;
      }
      m.x += m.vx * k;
      m.y += m.vy * k;
      const env = Math.min(1, m.age / 110) * (1 - Math.max(0, (m.age - m.life * 0.55) / (m.life * 0.45)));
      const sp = Math.hypot(m.vx, m.vy);
      const tx = m.x - (m.vx / sp) * m.len;
      const ty = m.y - (m.vy / sp) * m.len;
      const grd = ctx.createLinearGradient(m.x, m.y, tx, ty);
      grd.addColorStop(0, pal.meteor[0]);
      grd.addColorStop(0.25, pal.meteor[1]);
      grd.addColorStop(1, pal.meteor[2]);
      ctx.globalAlpha = env;
      ctx.strokeStyle = grd;
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      if (pal.meteorHead) {
        ctx.globalAlpha = env * 0.8;
        ctx.drawImage(pal.gold, m.x - 6, m.y - 6, 12, 12);
      }
    }
    if (clip) ctx.restore();
  };

  const drawFlakes = (dt: number, k: number) => {
    if (!flakes.length) return;
    ctx.fillStyle = pal.bright;
    for (let i = flakes.length - 1; i >= 0; i--) {
      const f = flakes[i];
      f.age += dt;
      if (f.age >= f.life) {
        flakes.splice(i, 1);
        continue;
      }
      const drag = f.drag === 1 ? 1 : 1 - (1 - f.drag) * k;
      f.vx *= drag;
      f.vy = f.vy * drag + f.g * k;
      f.rot += f.vr * k;
      f.x += (f.vx + (f.kind === 'glow' ? 0 : Math.sin(f.rot * 0.7) * 0.1)) * k;
      f.y += f.vy * k;
      if (f.kind === 'glow') {
        ctx.globalAlpha = Math.sin(Math.PI * (f.age / f.life));
        ctx.drawImage(pal.gold, f.x - f.r * 4, f.y - f.r * 4, f.r * 8, f.r * 8);
        continue;
      }
      const env = Math.min(1, f.age / 200) * Math.min(1, (f.life - f.age) / 700);
      if (f.kind === 'dot') {
        ctx.globalAlpha = 0.8 * env;
        ctx.drawImage(pal.gold, f.x - f.r * 2, f.y - f.r * 2, f.r * 4, f.r * 4);
      } else {
        const c = Math.cos(f.rot);
        const glint = Math.max(0, c) ** 6;
        leaf(f.x, f.y, 0.8 * f.r * (0.3 + 0.7 * Math.abs(c)), 1.25 * f.r, f.rot * 0.3, 0.85 * env * (0.45 + 0.55 * glint));
      }
    }
  };

  const draw = (dt: number, live: boolean) => {
    const k = dt / 16.67;
    ctx.clearRect(0, 0, w, h);
    // A still frame is drawn at rest: no parallax, no sway.
    const px = live ? par.x : 0;
    const py = live ? par.y : 0;
    const sh = live ? shift : 0;

    // Far stars.
    const fx = -px * 6;
    const fy = -py * 4 + sh * 0.06;
    ctx.fillStyle = pal.star;
    for (const s of stars) {
      ctx.globalAlpha = s.a * twinkle(s.sp, s.tw, live) * pal.starScale;
      ctx.fillRect(wrap(s.x + fx, w), wrap(s.y + fy, h), s.s, s.s);
    }

    // The chart: one engraved plate, swaying a hair about its pole.
    const polex = poleX();
    const poley = poleY();
    view.nx = -px * 14;
    view.ny = -py * 9 + sh * 0.16;
    view.th = live ? 0.012 * Math.sin((TAU * clock) / 120000) : 0;
    if (
      gctx &&
      (!baked.ok ||
        Math.abs(view.nx - baked.nx) > 0.35 ||
        Math.abs(view.ny - baked.ny) > 0.35 ||
        Math.abs(view.th - baked.th) * gridFar > 0.35)
    ) {
      bakeGrid();
    }
    if (baked.ok) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.drawImage(grid, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    ctx.save();
    ctx.translate(view.nx + polex, view.ny + poley);
    ctx.rotate(view.th);
    ctx.translate(-polex, -poley);
    if (!gctx) strokeGrid(ctx);
    drawField(live);
    drawFigures(dt, live);
    drawCharted(live);
    ctx.restore();

    drawRing(live);

    if (live) {
      drawMotes(k, px, py, sh);
      drawMeteors(dt, k);
      drawFlakes(dt, k);
    }
    ctx.globalAlpha = 1;
  };

  /* ---- Loop -------------------------------------------------------------- */
  const frame = (now: number) => {
    const dt = Math.min(50, now - last || 16.67);
    last = now;
    clock += dt;
    // Live boxes: after a scroll, while the crest leans, often during the
    // entrance (the plate rises into place), otherwise once a second.
    if (dirty || clock < leanUntil || clock - liveAt > (clock < 3000 ? 120 : 1000)) measureLive();
    if (pointer.on) {
      pointer.x = pointer.cx - cLeft;
      pointer.y = pointer.cy - cTop;
    }
    const ease = 1 - Math.pow(0.96, dt / 16.67);
    par.x += ((pointer.on ? (pointer.x / w) * 2 - 1 : 0) - par.x) * ease;
    par.y += ((pointer.on ? (pointer.y / h) * 2 - 1 : 0) - par.y) * ease;
    if (opt.meteors && clock >= nextMeteor) {
      launchMeteor();
      nextMeteor = clock + rand(opt.meteors[0], opt.meteors[1]) * 1000;
    }
    shedDust(dt);
    draw(dt, true);
    raf = requestAnimationFrame(frame);
  };

  const start = () => {
    cancelAnimationFrame(raf);
    raf = 0;
    if (!w) return;
    if (isStill()) {
      measureLive();
      draw(16.67, false);
      return;
    }
    if (onScreen && !document.hidden) {
      measureLive();
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  };

  resize();
  start();

  /* ---- Watchers ---------------------------------------------------------- */
  const relayout = () => {
    if (!w) return;
    layoutGrid();
    measureLayout();
    if (!raf) start();
  };
  if (typeof ResizeObserver === 'function') {
    let pending = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(pending);
      pending = requestAnimationFrame(() => {
        resize();
        if (!raf) start();
      });
    });
    ro.observe(host);
    // Text reflow inside the band moves the boxes the figures keep clear of.
    for (const el of [opt.orbit, opt.floor, ...opt.avoid]) if (el) ro.observe(el);
  } else {
    window.addEventListener('resize', () => {
      resize();
      start();
    });
  }
  // Webfonts reflow the text; the lettering on the chart wants them too.
  if (document.fonts) {
    document.fonts.ready.then(relayout, () => {});
    Promise.all([document.fonts.load(GRID_FONT), document.fonts.load(NAME_FONT)]).then(relayout, () => {});
  }

  // Scroll moves the band (parallax) and the crest (its drift): mark the
  // live boxes stale. A still frame is redrawn only if the crest moved.
  let stillPending = 0;
  window.addEventListener(
    'scroll',
    () => {
      dirty = true;
      if (raf || !onScreen || !opt.orbit || !isStill() || stillPending) return;
      stillPending = requestAnimationFrame(() => {
        stillPending = 0;
        const before = livePlate;
        measureLive();
        const after = livePlate;
        if (before?.x0 !== after?.x0 || before?.y0 !== after?.y0) draw(16.67, false);
      });
    },
    { passive: true },
  );

  document.addEventListener('visibilitychange', start);
  reduce.addEventListener('change', start);
  // The page's pause-motion toggle announces itself.
  window.addEventListener('motionchange', start);

  // Follow theme changes (the toggle sets data-theme; the OS can flip too)
  // and the motion toggle's data-motion.
  let wasStill = isStill();
  const repaint = () => {
    const next = schemeOf();
    if (next !== scheme) {
      scheme = next;
      pal = makePalette(scheme);
      baked.ok = false;
      if (!raf) start();
    }
    if (isStill() !== wasStill) {
      wasStill = isStill();
      start();
    }
  };
  new MutationObserver(repaint).observe(root, { attributes: true, attributeFilter: ['data-theme', 'data-motion'] });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => requestAnimationFrame(repaint));
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      onScreen = entries[entries.length - 1]?.isIntersecting ?? true;
      start();
    }).observe(host);
  }

  if (opt.interactive) {
    host.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      pointer.cx = e.clientX;
      pointer.cy = e.clientY;
      pointer.on = true;
      // The crest leans toward the pointer; follow it for a moment.
      if (livePlate) leanUntil = clock + 1200;
    });
    host.addEventListener('pointerleave', () => {
      pointer.on = false;
    });
    const ignored = (e: Event) => {
      const t = e.target;
      if (!(t instanceof Element)) return false;
      return !!t.closest('a, button, summary, input, textarea, select, label') || !!opt.orbit?.contains(t);
    };
    let mouseDownAt = -1e9;
    host.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      mouseDownAt = performance.now();
      if (ignored(e)) return;
      chart(e.clientX, e.clientY);
    });
    // Touch and pen chart on a tap (a click), so a swipe to scroll charts nothing.
    host.addEventListener('click', (e) => {
      // detail 0: a keyboard or scripted click, with no point to chart.
      if (e.detail === 0 || performance.now() - mouseDownAt < 1000) return;
      if ((e as PointerEvent).pointerType === 'mouse' || ignored(e)) return;
      chart(e.clientX, e.clientY);
    });
    opt.dustFrom?.addEventListener('pointerenter', (e) => {
      if ((e as PointerEvent).pointerType === 'mouse') puff();
    });
  }
}
