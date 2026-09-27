// Pointer and scroll ornament shared by every page:
//   · a soft spotlight that follows the pointer across entries, arches, the
//     folio, the imprint and the crest;
//   · a slight 3-D lean on the research arches;
//   · gently magnetic call-to-action buttons on the title page;
//   · the scroll-lit thesis (words ink in as it is read, then stay inked);
//   · a pen-stipple of gilt dust behind the cursor — over the open sky of
//     the title page and the closing band only, never over reading text.
// All of it is enhancement: the page is complete without it, touch devices
// get none of the pointer effects, and nothing moves under reduced motion
// or while motion is paused (html[data-motion="still"], header button).

const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const mouse = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const root = document.documentElement;
const still = () => reduceQuery.matches || root.dataset.motion === 'still';
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/* ---- Spotlight and tilt --------------------------------------------------- */
if (mouse) {
  const LIT = '.pub, .theme, .pub--review, .folio, .imprint, .crest__plate';
  const TILT = '.theme';
  document.querySelectorAll<HTMLElement>(LIT).forEach((el) => {
    const spot = document.createElement('span');
    spot.className = 'spot';
    spot.setAttribute('aria-hidden', 'true');
    el.prepend(spot);
    const tilts = el.matches(TILT);
    let frame = 0;
    let px = 0;
    let py = 0;
    const paint = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      const x = px - r.left;
      const y = py - r.top;
      el.style.setProperty('--mx', `${x.toFixed(1)}px`);
      el.style.setProperty('--my', `${y.toFixed(1)}px`);
      if (tilts && !still()) {
        el.style.setProperty('--ry', `${((x / r.width - 0.5) * 3).toFixed(2)}deg`);
        el.style.setProperty('--rx', `${((0.5 - y / r.height) * 2.4).toFixed(2)}deg`);
      }
    };
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      px = e.clientX;
      py = e.clientY;
      el.classList.add('is-lit');
      if (!frame) frame = requestAnimationFrame(paint);
    });
    el.addEventListener('pointerleave', () => {
      el.classList.remove('is-lit');
      el.style.removeProperty('--rx');
      el.style.removeProperty('--ry');
    });
  });
}

/* ---- Magnetic buttons ----------------------------------------------------- */
if (mouse) {
  document.querySelectorAll<HTMLElement>('.hero__actions .btn').forEach((b) => {
    b.addEventListener('pointermove', (e) => {
      if (still()) return;
      const r = b.getBoundingClientRect();
      const dx = clamp((e.clientX - r.left - r.width / 2) * 0.08, -6, 6);
      const dy = clamp((e.clientY - r.top - r.height / 2) * 0.12, -6, 6);
      b.style.translate = `${dx.toFixed(1)}px ${dy.toFixed(1)}px`;
    });
    b.addEventListener('pointerleave', () => {
      b.style.translate = '';
    });
  });
}

/* ---- Scroll-lit thesis ---------------------------------------------------- */
// --p runs 0 → 1 as the passage rises through the viewport; once it is
// nearly all read it latches (.is-read) and never un-inks on scroll-back.
let lit = Array.from(document.querySelectorAll<HTMLElement>('[data-scroll-lit]'));
if (lit.length) {
  let frame = 0;
  const latch = (el: HTMLElement) => {
    el.style.setProperty('--p', '1');
    el.classList.add('is-read');
  };
  const update = () => {
    frame = 0;
    if (still()) {
      lit.forEach(latch);
      lit = [];
      return;
    }
    const vh = window.innerHeight;
    lit = lit.filter((el) => {
      const r = el.getBoundingClientRect();
      const p = clamp((vh - r.top) / (r.height + vh * 0.1), 0, 1);
      el.style.setProperty('--p', p.toFixed(3));
      if (p >= 0.92) {
        latch(el);
        return false;
      }
      return true;
    });
  };
  const onScroll = () => {
    if (lit.length && !frame) frame = requestAnimationFrame(update);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  window.addEventListener('motionchange', onScroll);
  window.addEventListener('beforeprint', () => document.querySelectorAll<HTMLElement>('[data-scroll-lit]').forEach(latch));
  update();
}

/* ---- Gilt stipple behind the cursor, over the sky bands only -------------- */
const bands = Array.from(document.querySelectorAll<HTMLElement>('.hero, .section--contact'));
if (mouse && bands.length) {
  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;

  type Mote = { x: number; y: number; vx: number; vy: number; age: number; life: number; r: number; star: boolean; rot: number; vr: number; dark: boolean };
  const motes: Mote[] = [];
  const darkScheme = window.matchMedia('(prefers-color-scheme: dark)');
  const pageIsDark = () => {
    const t = root.getAttribute('data-theme');
    return t === 'dark' || (t !== 'light' && darkScheme.matches);
  };
  const glow = document.createElement('canvas');
  glow.width = glow.height = 32;
  const g = glow.getContext('2d');
  if (g) {
    const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grd.addColorStop(0, 'rgba(255,248,226,1)');
    grd.addColorStop(0.2, 'rgba(246,226,166,.85)');
    grd.addColorStop(0.5, 'rgba(226,194,125,.2)');
    grd.addColorStop(1, 'rgba(226,194,125,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 32, 32);
  }

  let w = 0;
  let h = 0;
  const size = () => {
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  const mount = () => {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.className = 'cursor-dust';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');
    size();
  };
  const unmount = () => {
    motes.length = 0;
    canvas?.remove();
    canvas = null;
    ctx = null;
  };
  window.addEventListener('resize', size, { passive: true });

  const star = (c: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number) => {
    c.save();
    c.translate(x, y);
    c.rotate(rot);
    c.beginPath();
    for (let i = 0; i < 8; i++) {
      const rr = i % 2 === 0 ? r * 2.6 : r * 0.55;
      const a = (i * Math.PI) / 4;
      c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    c.closePath();
    c.fill();
    c.restore();
  };

  let raf = 0;
  let last = 0;
  let lx = -1;
  let ly = -1;
  const tick = (now: number) => {
    const c = ctx;
    if (!c) {
      raf = 0;
      return;
    }
    const dt = Math.min(48, now - last);
    last = now;
    const k = dt / 16.67;
    c.clearRect(0, 0, w, h);
    for (let i = motes.length - 1; i >= 0; i--) {
      const m = motes[i];
      m.age += dt;
      if (m.age >= m.life) {
        motes.splice(i, 1);
        continue;
      }
      // Dark: gilt dust that falls; light: a pen stipple that just fades.
      if (m.dark) m.vy += 0.016 * k;
      m.vx *= 0.985;
      m.x += m.vx * k;
      m.y += m.vy * k;
      m.rot += m.vr * k;
      const a = 1 - m.age / m.life;
      const r = m.r * (0.55 + 0.45 * a);
      if (m.dark) {
        c.globalCompositeOperation = 'lighter';
        c.globalAlpha = a;
        c.drawImage(glow, m.x - r * 5, m.y - r * 5, r * 10, r * 10);
        if (m.star) {
          c.fillStyle = 'rgb(255,244,214)';
          star(c, m.x, m.y, r, m.rot);
        }
      } else {
        c.globalCompositeOperation = 'source-over';
        c.globalAlpha = a * 0.85;
        c.fillStyle = m.star ? 'rgb(150,112,40)' : 'rgb(176,141,62)';
        if (m.star) star(c, m.x, m.y, r * 0.75, m.rot);
        else {
          c.beginPath();
          c.arc(m.x, m.y, r * 0.8, 0, Math.PI * 2);
          c.fill();
        }
      }
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
    raf = motes.length ? requestAnimationFrame(tick) : 0;
  };

  // Text, links and the plates stay clean: no dust over them.
  const CLEAN = '.hero__text, .sec-head, .section-lede, .imprint, a, button';
  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || still()) return;
    if ((e.target as Element | null)?.closest(CLEAN)) {
      lx = -1;
      return;
    }
    const x = e.clientX;
    const y = e.clientY;
    if (lx < 0) {
      lx = x;
      ly = y;
      return;
    }
    const d = Math.hypot(x - lx, y - ly);
    if (d < 14) return;
    mount();
    const dark = pageIsDark();
    const n = Math.min(2, Math.floor(d / 14));
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      motes.push({
        x: lx + (x - lx) * t + (Math.random() - 0.5) * 5,
        y: ly + (y - ly) * t + (Math.random() - 0.5) * 5,
        vx: (Math.random() - 0.5) * 0.5,
        vy: dark ? (Math.random() - 0.5) * 0.7 - 0.35 : -0.08,
        age: 0,
        life: dark ? 600 + Math.random() * 700 : 380 + Math.random() * 140,
        r: dark ? 0.7 + Math.random() * 1.6 : 0.5 + Math.random() * 0.6,
        star: Math.random() < 0.15,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.12,
        dark,
      });
    }
    if (motes.length > 160) motes.splice(0, motes.length - 160);
    lx = x;
    ly = y;
    if (!raf) {
      last = performance.now();
      raf = requestAnimationFrame(tick);
    }
  };
  bands.forEach((band) => {
    band.addEventListener('pointermove', onMove, { passive: true });
    band.addEventListener('pointerleave', () => {
      lx = -1;
    });
  });

  // Motion switched off (OS setting or the header button): drop the canvas.
  const settle = () => {
    if (still()) {
      unmount();
      document.querySelectorAll<HTMLElement>('.theme').forEach((el) => {
        el.style.removeProperty('--rx');
        el.style.removeProperty('--ry');
      });
    }
  };
  reduceQuery.addEventListener('change', settle);
  window.addEventListener('motionchange', settle);
}
