// Night-sky particle field for the midnight bands (title page, contact).
//
// Layers, far to near: faint background stars; a constellation of drifting
// stars joined by gold hairlines (and to the pointer); soft gold motes that
// rise like dust in lamplight. Transient light on top: shooting stars, gold
// dust shed by the name, sparks where the visitor clicks, and a slow ring of
// dust circling the crest. Layers shift with the pointer and with scroll at
// different depths (parallax).
//
// Runs only while its band is on screen and the tab is visible. With
// reduced motion a single still frame is drawn and nothing moves.

export interface SkyOptions {
  /** Area in px² per constellation star. */
  nodeArea?: number;
  /** Area in px² per faint background star. */
  starArea?: number;
  /** Number of soft gold motes. */
  motes?: number;
  /** Seconds between shooting stars as [min, max]; false for none. */
  meteors?: [number, number] | false;
  /** Element that sheds gold dust (the name on the title page). */
  dustFrom?: Element | null;
  /** Element circled by a slow ring of dust (the crest). */
  orbit?: Element | null;
  /** Pointer links, parallax and click sparks. */
  interactive?: boolean;
}

type Star = { x: number; y: number; s: number; a: number; tw: number; sp: number };
type Node = { x: number; y: number; vx: number; vy: number; r: number; tw: number; bright: boolean };
type Mote = { x: number; y: number; vy: number; sway: number; ph: number; r: number; a: number };
type Spark = { x: number; y: number; vx: number; vy: number; age: number; life: number; r: number; kind: 0 | 1 | 2; g: number };
type Meteor = { x: number; y: number; vx: number; vy: number; len: number; age: number; life: number };
type Grain = { th: number; w: number; rf: number; r: number; tw: number };

const TAU = Math.PI * 2;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const LINK_LEVELS = 8;

/** A soft radial glow rendered once and stamped with drawImage. */
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

export function mountSky(host: HTMLElement, canvas: HTMLCanvasElement, options: SkyOptions = {}): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const opt = {
    nodeArea: 10500,
    starArea: 2600,
    motes: 16,
    meteors: [3, 7] as [number, number] | false,
    interactive: true,
    ...options,
  };
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const wide = window.matchMedia('(min-width: 901px)');

  const gold = sprite([
    [0, 'rgba(255,248,226,1)'],
    [0.16, 'rgba(246,226,166,.9)'],
    [0.42, 'rgba(226,194,125,.24)'],
    [1, 'rgba(226,194,125,0)'],
  ]);
  const ember = sprite([
    [0, 'rgba(255,222,200,1)'],
    [0.2, 'rgba(222,110,110,.75)'],
    [0.5, 'rgba(160,40,50,.22)'],
    [1, 'rgba(160,40,50,0)'],
  ]);

  let w = 0;
  let h = 0;
  let stars: Star[] = [];
  let nodes: Node[] = [];
  let motes: Mote[] = [];
  let grains: Grain[] = [];
  const sparks: Spark[] = [];
  const meteors: Meteor[] = [];
  let link = 120;
  let raf = 0;
  let last = 0;
  let clock = 0;
  let onScreen = true;
  let nextMeteor = 0;
  let dustDebt = 0;
  const pointer = { x: 0, y: 0, on: false };
  const par = { x: 0, y: 0 };
  const buckets: number[][] = Array.from({ length: LINK_LEVELS }, () => []);
  let pts = new Float32Array(0);

  /* ---- Population ------------------------------------------------------ */
  const seed = () => {
    const area = w * h;
    stars = Array.from({ length: Math.min(420, Math.round(area / opt.starArea)) }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      s: rand(0.5, 1.4),
      a: rand(0.18, 0.7),
      tw: Math.random() * TAU,
      sp: rand(0.6, 2.2),
    }));
    nodes = Array.from({ length: Math.max(24, Math.min(130, Math.round(area / opt.nodeArea))) }, () => {
      const speed = rand(0.05, 0.22);
      const dir = Math.random() * TAU;
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        vx: Math.cos(dir) * speed,
        vy: Math.sin(dir) * speed,
        r: rand(0.5, 1.7),
        tw: Math.random() * TAU,
        bright: Math.random() < 0.08,
      };
    });
    motes = Array.from({ length: opt.motes }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vy: rand(-0.22, -0.05),
      sway: rand(0.15, 0.6),
      ph: Math.random() * TAU,
      r: rand(1.4, 4.2),
      a: rand(0.05, 0.16),
    }));
    grains = opt.orbit
      ? Array.from({ length: 150 }, () => ({
          th: Math.random() * TAU,
          w: rand(0.0016, 0.0042) * (Math.random() < 0.85 ? 1 : 1.6),
          rf: rand(0.92, 1.14) + (Math.random() < 0.2 ? rand(0.05, 0.14) : 0),
          r: rand(0.5, 1.6),
          tw: Math.random() * TAU,
        }))
      : [];
  };

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const nw = Math.max(1, rect.width);
    const nh = Math.max(1, rect.height);
    const dpr = Math.min(window.devicePixelRatio || 1, nw < 700 ? 1.5 : 2);
    canvas.width = Math.round(nw * dpr);
    canvas.height = Math.round(nh * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    link = Math.max(90, Math.min(150, nw / 10));
    if (!w || Math.abs(nw - w) > 80 || Math.abs(nh - h) > 160) {
      w = nw;
      h = nh;
      seed();
    } else {
      // Small changes (fonts settling, a scrollbar) keep the sky and rescale it.
      const sx = nw / w;
      const sy = nh / h;
      for (const p of [...stars, ...nodes, ...motes]) {
        p.x *= sx;
        p.y *= sy;
      }
      w = nw;
      h = nh;
    }
  };

  /* ---- Geometry helpers ------------------------------------------------- */
  const hostShift = () => {
    const top = host.getBoundingClientRect().top;
    return Math.max(0, Math.min(h, -top));
  };
  const wrap = (v: number, m: number) => ((v % m) + m) % m;

  const orbitFrame = () => {
    if (!opt.orbit || !wide.matches) return null;
    const c = canvas.getBoundingClientRect();
    const r = opt.orbit.getBoundingClientRect();
    if (!r.width) return null;
    return {
      cx: r.left - c.left + r.width / 2,
      cy: r.top - c.top + r.height / 2,
      rx: r.width * 0.72,
      ry: r.height * 0.7,
    };
  };

  /* ---- Spawners ---------------------------------------------------------- */
  const burst = (x: number, y: number) => {
    for (let i = 0; i < 36; i++) {
      const a = Math.random() * TAU;
      const v = rand(1.2, 5.4);
      const roll = Math.random();
      sparks.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 0.6,
        age: 0,
        life: rand(700, 1500),
        r: rand(0.8, 2),
        kind: roll < 0.7 ? 0 : roll < 0.9 ? 1 : 2,
        g: rand(0.035, 0.06),
      });
    }
    if (sparks.length > 400) sparks.splice(0, sparks.length - 400);
  };

  const shedDust = (dt: number) => {
    if (!opt.dustFrom) return;
    dustDebt += dt * 0.0045;
    if (dustDebt < 1) return;
    const c = canvas.getBoundingClientRect();
    const r = opt.dustFrom.getBoundingClientRect();
    while (dustDebt >= 1) {
      dustDebt -= 1;
      sparks.push({
        x: r.left - c.left + Math.random() * r.width,
        y: r.top - c.top + rand(0.3, 0.85) * r.height,
        vx: rand(-0.12, 0.12),
        vy: rand(-0.42, -0.12),
        age: 0,
        life: rand(2400, 4600),
        r: rand(0.5, 1.4),
        kind: Math.random() < 0.85 ? 0 : 1,
        g: -0.0015,
      });
    }
  };

  const launchMeteor = () => {
    if (!opt.meteors) return;
    const a = rand(0.35, 0.62);
    const v = rand(10, 15);
    meteors.push({
      x: rand(w * 0.3, w * 1.05),
      y: rand(-h * 0.05, h * 0.35),
      vx: -Math.cos(a) * v,
      vy: Math.sin(a) * v,
      len: rand(130, 260),
      age: 0,
      life: rand(750, 1150),
    });
  };

  /* ---- Drawing ---------------------------------------------------------- */
  const draw = (dt: number, moving: boolean) => {
    const k = dt / 16.67;
    ctx.clearRect(0, 0, w, h);
    const shift = hostShift();

    // Far stars.
    const fx = -par.x * 6;
    const fy = -par.y * 4 + shift * 0.06;
    ctx.fillStyle = 'rgb(246,236,210)';
    for (const s of stars) {
      const tw = moving ? 0.55 + 0.45 * Math.sin(clock * 0.001 * s.sp + s.tw) : 0.8;
      ctx.globalAlpha = s.a * tw;
      ctx.fillRect(wrap(s.x + fx, w), wrap(s.y + fy, h), s.s, s.s);
    }

    // Constellation.
    const nx = -par.x * 14;
    const ny = -par.y * 9 + shift * 0.16;
    for (const b of buckets) b.length = 0;
    if (pts.length !== nodes.length * 2) pts = new Float32Array(nodes.length * 2);
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (moving) {
        if (pointer.on) {
          const dx = pointer.x - n.x;
          const dy = pointer.y - n.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 40000 && d2 > 1) {
            n.vx += (dx / Math.sqrt(d2)) * 0.004 * k;
            n.vy += (dy / Math.sqrt(d2)) * 0.004 * k;
          }
        }
        const sp = Math.hypot(n.vx, n.vy);
        if (sp > 0.45) {
          n.vx *= 0.96;
          n.vy *= 0.96;
        }
        n.x += n.vx * k;
        n.y += n.vy * k;
        if (n.x < -30) n.x = w + 30;
        else if (n.x > w + 30) n.x = -30;
        if (n.y < -30) n.y = h + 30;
        else if (n.y > h + 30) n.y = -30;
      }
      pts[i * 2] = n.x + nx;
      pts[i * 2 + 1] = n.y + ny;
    }
    const l2 = link * link;
    for (let i = 0; i < nodes.length; i++) {
      const ax = pts[i * 2];
      const ay = pts[i * 2 + 1];
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = ax - pts[j * 2];
        const dy = ay - pts[j * 2 + 1];
        const d2 = dx * dx + dy * dy;
        if (d2 < l2) {
          const lvl = Math.min(LINK_LEVELS - 1, Math.floor((1 - Math.sqrt(d2) / link) * LINK_LEVELS));
          buckets[lvl].push(ax, ay, pts[j * 2], pts[j * 2 + 1]);
        }
      }
    }
    ctx.lineWidth = 0.6;
    ctx.strokeStyle = 'rgb(222,190,120)';
    for (let lvl = 0; lvl < LINK_LEVELS; lvl++) {
      const b = buckets[lvl];
      if (!b.length) continue;
      ctx.globalAlpha = ((lvl + 0.5) / LINK_LEVELS) * 0.34;
      ctx.beginPath();
      for (let q = 0; q < b.length; q += 4) {
        ctx.moveTo(b[q], b[q + 1]);
        ctx.lineTo(b[q + 2], b[q + 3]);
      }
      ctx.stroke();
    }
    if (pointer.on) {
      const reach = link * 1.45;
      ctx.lineWidth = 0.7;
      ctx.strokeStyle = 'rgb(246,226,166)';
      for (let i = 0; i < nodes.length; i++) {
        const dx = pts[i * 2] - pointer.x;
        const dy = pts[i * 2 + 1] - pointer.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < reach) {
          ctx.globalAlpha = (1 - d / reach) * 0.55;
          ctx.beginPath();
          ctx.moveTo(pts[i * 2], pts[i * 2 + 1]);
          ctx.lineTo(pointer.x, pointer.y);
          ctx.stroke();
        }
      }
    }
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const x = pts[i * 2];
      const y = pts[i * 2 + 1];
      const glow = moving ? 0.55 + 0.45 * Math.sin(clock / 900 + n.tw) : 0.8;
      ctx.globalAlpha = 0.35 + 0.5 * glow;
      ctx.fillStyle = 'rgb(246,232,196)';
      ctx.beginPath();
      ctx.arc(x, y, n.r, 0, TAU);
      ctx.fill();
      if (n.bright) {
        const s = 5 + 4 * glow;
        ctx.globalAlpha = 0.25 + 0.55 * glow;
        ctx.strokeStyle = 'rgb(246,226,166)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(x - s, y);
        ctx.lineTo(x + s, y);
        ctx.moveTo(x, y - s);
        ctx.lineTo(x, y + s);
        ctx.stroke();
        ctx.globalAlpha = 0.35 * glow;
        ctx.drawImage(gold, x - 9, y - 9, 18, 18);
      }
    }

    // Ring of dust around the crest.
    const orb = orbitFrame();
    if (orb) {
      // A halo of dust circling the crest; the near side (lower half) is
      // brighter and larger, which reads as depth.
      const tilt = -0.14;
      const ct = Math.cos(tilt);
      const st = Math.sin(tilt);
      for (const g of grains) {
        if (moving) g.th += g.w * k;
        const ex = Math.cos(g.th) * orb.rx * g.rf;
        const ey = Math.sin(g.th) * orb.ry * g.rf;
        const x = orb.cx + ex * ct - ey * st;
        const y = orb.cy + ex * st + ey * ct;
        const near = 0.5 + 0.5 * Math.sin(g.th);
        const tw = moving ? 0.6 + 0.4 * Math.sin(clock / 700 + g.tw) : 0.8;
        ctx.globalAlpha = (0.28 + 0.6 * near) * tw;
        const r = g.r * (0.8 + 0.5 * near);
        ctx.drawImage(gold, x - r * 3, y - r * 3, r * 6, r * 6);
      }
    }

    // Soft gold motes, nearest layer.
    const mx = -par.x * 26;
    const my = -par.y * 16 + shift * 0.32;
    for (const m of motes) {
      if (moving) {
        m.y += m.vy * k;
        m.ph += 0.01 * k;
        if (m.y < -20) {
          m.y = h + 20;
          m.x = Math.random() * w;
        }
      }
      const x = wrap(m.x + Math.sin(m.ph) * 18 * m.sway + mx, w);
      const y = wrap(m.y + my, h);
      ctx.globalAlpha = m.a * (0.7 + 0.3 * Math.sin(m.ph * 2));
      ctx.drawImage(gold, x - m.r * 5, y - m.r * 5, m.r * 10, m.r * 10);
    }

    if (moving) {
      // Shooting stars.
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
        grd.addColorStop(0, 'rgba(255,248,228,1)');
        grd.addColorStop(0.25, 'rgba(240,210,140,.55)');
        grd.addColorStop(1, 'rgba(226,194,125,0)');
        ctx.globalAlpha = env;
        ctx.strokeStyle = grd;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        ctx.drawImage(gold, m.x - 8, m.y - 8, 16, 16);
      }

      // Sparks and gold dust.
      for (let i = sparks.length - 1; i >= 0; i--) {
        const p = sparks[i];
        p.age += dt;
        if (p.age >= p.life) {
          sparks.splice(i, 1);
          continue;
        }
        p.vx *= p.g > 0 ? 0.975 : 1;
        p.vy = p.vy * (p.g > 0 ? 0.975 : 1) + p.g * k;
        p.x += p.vx * k;
        p.y += p.vy * k;
        const t = p.age / p.life;
        const a = p.g > 0 ? 1 - t : Math.sin(Math.PI * t);
        const img = p.kind === 2 ? ember : gold;
        const r = p.r * (p.g > 0 ? 1 - t * 0.5 : 1);
        if (p.g > 0) {
          ctx.globalAlpha = a * 0.7;
          ctx.strokeStyle = p.kind === 2 ? 'rgb(236,150,140)' : 'rgb(250,232,180)';
          ctx.lineWidth = r * 0.7;
          ctx.beginPath();
          ctx.moveTo(p.x - p.vx * 2.5, p.y - p.vy * 2.5);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
        }
        ctx.globalAlpha = a;
        ctx.drawImage(img, p.x - r * 4, p.y - r * 4, r * 8, r * 8);
      }
    }
    ctx.globalAlpha = 1;
  };

  /* ---- Loop -------------------------------------------------------------- */
  const frame = (now: number) => {
    const dt = Math.min(50, now - last || 16.67);
    last = now;
    clock += dt;
    par.x += ((pointer.on ? (pointer.x / w) * 2 - 1 : 0) - par.x) * 0.04;
    par.y += ((pointer.on ? (pointer.y / h) * 2 - 1 : 0) - par.y) * 0.04;
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
    if (reduce.matches) {
      draw(16.67, false);
      return;
    }
    if (onScreen && !document.hidden) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  };

  resize();
  if (opt.meteors) nextMeteor = rand(1200, 2600);
  start();

  if (typeof ResizeObserver === 'function') {
    let pending = 0;
    new ResizeObserver(() => {
      cancelAnimationFrame(pending);
      pending = requestAnimationFrame(() => {
        resize();
        if (!raf) start();
      });
    }).observe(host);
  } else {
    window.addEventListener('resize', () => {
      resize();
      start();
    });
  }
  document.addEventListener('visibilitychange', start);
  reduce.addEventListener('change', start);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      onScreen = entries[entries.length - 1]?.isIntersecting ?? true;
      start();
    }).observe(host);
  }

  if (opt.interactive) {
    host.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const c = canvas.getBoundingClientRect();
      pointer.x = e.clientX - c.left;
      pointer.y = e.clientY - c.top;
      pointer.on = true;
    });
    host.addEventListener('pointerleave', () => {
      pointer.on = false;
    });
    host.addEventListener('pointerdown', (e) => {
      if (reduce.matches || !raf) return;
      const target = e.target as Element | null;
      if (target?.closest('a, button, summary, input, textarea, select, label')) return;
      const c = canvas.getBoundingClientRect();
      burst(e.clientX - c.left, e.clientY - c.top);
    });
  }
}
