// Pointer and scroll ornament shared by every page:
//   · a soft spotlight that follows the pointer across plates, arches,
//     letters, the folio and the crest;
//   · a slight 3-D tilt on the arches and the letters;
//   · magnetic call-to-action buttons on the title page;
//   · the scroll-lit pull quote (words brighten as it is read);
//   · a trail of gilded dust behind the cursor.
// All of it is enhancement: the page is complete without it, touch devices
// get none of the pointer effects, and nothing moves under reduced motion.

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const mouse = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/* ---- Spotlight and tilt --------------------------------------------------- */
if (mouse) {
  const LIT = '.pub, .theme, .letter, .pub--review, .folio, .crest__plate';
  const TILT = '.theme, .letter';
  document.querySelectorAll<HTMLElement>(LIT).forEach((el) => {
    const spot = document.createElement('span');
    spot.className = 'spot';
    spot.setAttribute('aria-hidden', 'true');
    el.prepend(spot);
    const tilt = !reduce && el.matches(TILT);
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
      if (tilt) {
        el.style.setProperty('--ry', `${((x / r.width - 0.5) * 9).toFixed(2)}deg`);
        el.style.setProperty('--rx', `${((0.5 - y / r.height) * 7).toFixed(2)}deg`);
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
if (mouse && !reduce) {
  document.querySelectorAll<HTMLElement>('.hero__actions .btn').forEach((b) => {
    b.addEventListener('pointermove', (e) => {
      const r = b.getBoundingClientRect();
      const dx = (e.clientX - r.left - r.width / 2) * 0.22;
      const dy = (e.clientY - r.top - r.height / 2) * 0.32;
      b.style.translate = `${dx.toFixed(1)}px ${dy.toFixed(1)}px`;
    });
    b.addEventListener('pointerleave', () => {
      b.style.translate = '';
    });
  });
}

/* ---- Scroll-lit pull quote ------------------------------------------------ */
const lit = Array.from(document.querySelectorAll<HTMLElement>('[data-scroll-lit]'));
if (lit.length && !reduce) {
  let frame = 0;
  const update = () => {
    frame = 0;
    const vh = window.innerHeight;
    for (const el of lit) {
      const r = el.getBoundingClientRect();
      // 0 as the quote enters at the bottom, 1 by the time it is centred.
      const p = (vh * 0.92 - r.top) / (r.height + vh * 0.22);
      el.style.setProperty('--p', Math.min(1, Math.max(0, p)).toFixed(3));
    }
  };
  window.addEventListener('scroll', () => {
    if (!frame) frame = requestAnimationFrame(update);
  }, { passive: true });
  window.addEventListener('resize', update, { passive: true });
  window.addEventListener('beforeprint', () => lit.forEach((el) => el.style.setProperty('--p', '1')));
  update();
}

/* ---- Gilded dust behind the cursor ---------------------------------------- */
if (mouse && !reduce) {
  const canvas = document.createElement('canvas');
  canvas.className = 'cursor-dust';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  if (ctx) {
    type Mote = { x: number; y: number; vx: number; vy: number; age: number; life: number; r: number; star: boolean; rot: number; vr: number; dark: boolean };
    const motes: Mote[] = [];
    const DARK = '.hero, .band, .site-header, .site-footer, .pub--review, .to-top, .skip-link';
    const darkScheme = window.matchMedia('(prefers-color-scheme: dark)');
    const pageIsDark = () => {
      const t = document.documentElement.getAttribute('data-theme');
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
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();
    window.addEventListener('resize', size, { passive: true });

    const star = (x: number, y: number, r: number, rot: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const rr = i % 2 === 0 ? r * 2.6 : r * 0.55;
        const a = (i * Math.PI) / 4;
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    let raf = 0;
    let last = 0;
    let lx = -1;
    let ly = -1;
    const tick = (now: number) => {
      const dt = Math.min(48, now - last);
      last = now;
      const k = dt / 16.67;
      ctx.clearRect(0, 0, w, h);
      for (let i = motes.length - 1; i >= 0; i--) {
        const m = motes[i];
        m.age += dt;
        if (m.age >= m.life) {
          motes.splice(i, 1);
          continue;
        }
        m.vy += 0.016 * k;
        m.vx *= 0.985;
        m.x += m.vx * k;
        m.y += m.vy * k;
        m.rot += m.vr * k;
        const a = 1 - m.age / m.life;
        const r = m.r * (0.55 + 0.45 * a);
        if (m.dark) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = a;
          ctx.drawImage(glow, m.x - r * 5, m.y - r * 5, r * 10, r * 10);
          if (m.star) {
            ctx.fillStyle = 'rgb(255,244,214)';
            star(m.x, m.y, r, m.rot);
          }
        } else {
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = a * 0.85;
          ctx.fillStyle = m.star ? 'rgb(176,128,46)' : 'rgb(196,150,70)';
          if (m.star) star(m.x, m.y, r * 0.75, m.rot);
          else {
            ctx.beginPath();
            ctx.arc(m.x, m.y, r * 0.8, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      raf = motes.length ? requestAnimationFrame(tick) : 0;
    };

    window.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const x = e.clientX;
      const y = e.clientY;
      if (lx < 0) {
        lx = x;
        ly = y;
        return;
      }
      const d = Math.hypot(x - lx, y - ly);
      if (d < 8) return;
      const target = e.target as Element | null;
      const dark = pageIsDark() || !!target?.closest?.(DARK);
      const n = Math.min(4, Math.floor(d / 8));
      for (let i = 1; i <= n; i++) {
        const t = i / n;
        motes.push({
          x: lx + (x - lx) * t + (Math.random() - 0.5) * 5,
          y: ly + (y - ly) * t + (Math.random() - 0.5) * 5,
          vx: (Math.random() - 0.5) * 0.7,
          vy: (Math.random() - 0.5) * 0.7 - 0.35,
          age: 0,
          life: 600 + Math.random() * 700,
          r: 0.7 + Math.random() * 1.6,
          star: Math.random() < 0.3,
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 0.12,
          dark,
        });
      }
      if (motes.length > 220) motes.splice(0, motes.length - 220);
      lx = x;
      ly = y;
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    }, { passive: true });
    document.documentElement.addEventListener('pointerleave', () => {
      lx = -1;
    });
  }
}
