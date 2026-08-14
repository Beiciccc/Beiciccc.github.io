# Apple-inspired redesign — implementation playbook

Engineer guide for wiring `global.css` (the new stylesheet replacing
`src/styles/global.css`) into the existing Astro project. The CSS already
targets every class your components emit — most of this is drop-in. The items
below are the small markup hooks that unlock the full Apple-grade feel
(scroll reveal, frosted-nav scroll state, full-bleed sections, bento grid).

**Originality & fonts:** 100% original CSS/JS — no Apple markup, class names,
source, marketing copy, images, icons, logos, or bundled fonts. System font
stack only. **Delete the Google Fonts `<link>` and `preconnect` block** in
`BaseLayout.astro` (the `<!-- Design fonts -->` group, currently ~lines 65–71);
the new stack uses `-apple-system` / `SF Pro` / `PingFang SC` and embeds nothing.

**Token compatibility (no component edits needed):** the existing scoped styles
in `ProjectCard.astro` reference `--accent-2`, and `Hero.astro` / `About.astro`
reference `--font-display`. The old stylesheet defined those; the new one keeps
them as **aliases** (`--accent-2: var(--accent)`, `--font-display: var(--font-sans)`)
in both light and dark `:root` blocks, so those components keep rendering
correctly with zero markup changes. (You may later drop the scoped `--accent-2`
link colour and `--font-display` tagline rule if you want the pure new look.)

---

## 1. Scroll-reveal — IntersectionObserver (vanilla, progressive enhancement)

**Principle:** elements carry `.reveal` (hidden by default *in CSS*). JS adds
`.is-visible` as they enter the viewport. Two guards make it safe:

- **No-JS fallback (required):** add this in `<head>` so non-JS visitors see
  everything (covers both `.reveal` and the `.reveal--scale` variant):
  `<noscript><style>.reveal,.reveal--scale{opacity:1!important;transform:none!important}</style></noscript>`
- **Reduced-motion:** the CSS already forces `.reveal{opacity:1;transform:none}`
  under `prefers-reduced-motion`, and the script below skips observing entirely
  (and never writes `--hero-scale`).

Inline this near `</body>` in `BaseLayout.astro` (after the existing theme
script, inside its own `<script is:inline>`):

```html
<script is:inline>
  (function () {
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var els = document.querySelectorAll('.reveal');

    // Reduced motion or no IO support: show everything, no animation.
    if (reduce || !('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('is-visible'); });
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add('is-visible');
            io.unobserve(e.target);
          }
        });
      }, { rootMargin: '0px 0px -10% 0px', threshold: 0.12 });
      els.forEach(function (el) { io.observe(el); });
    }

    // Frosted-nav: add .scrolled to <body> past a small threshold (see §4).
    var onScroll = function () {
      document.body.classList.toggle('scrolled', window.scrollY > 8);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    // OPTIONAL hero scale-on-scroll. MUST be gated on reduced-motion: when the
    // user prefers reduced motion, never write --hero-scale at all (the CSS
    // also force-resets .hero--parallax, but don't run the work either).
    var hero = document.querySelector('.hero--parallax');
    if (hero && !reduce) {
      var onHero = function () {
        var s = Math.max(0.965, 1 - window.scrollY / 4200); // very subtle
        hero.style.setProperty('--hero-scale', s.toFixed(4));
      };
      onHero();
      window.addEventListener('scroll', onHero, { passive: true });
    }
  })();
</script>
```

**Where to add `.reveal`:** the section opener block (eyebrow + h2 + lede), each
`.card`, each `.post`, the hero actions. For sequenced tiles, add
`.reveal-stagger` to the `.grid` and `style="--i:0"`, `--i:1`, … to each child
`.reveal` for an 80 ms cascade. Use `.reveal--scale` on the hero/large tiles for
a subtle scale-in. Keep it restrained — reveal the *block*, not every word.

---

## 2. Full-bleed vs contained — recommended homepage order

Apple alternates full-width grounds (white → off-white → black) with restful
whitespace. Default `.section` is contained + centered; add `.section--bleed`
(span the viewport) plus `.section--tint` (off-white `#f5f5f7`) or
`.section--dark` (pure black) for the alternation. `.section--bleed` re-caps its
direct children to `--maxw`, so wrap each bleed section's content in a single
`<div>` (or rely on the existing single child).

Recommended `index.astro` order and treatment:

| Order | Section      | Treatment                                   |
|-------|--------------|---------------------------------------------|
| 1 | **Hero**        | contained, centered, on page `--bg` (near-white) |
| 2 | **About**       | `.section--bleed .section--tint` — off-white band |
| 3 | **Research**    | contained, centered headline, bento tiles  |
| 4 | **SelectedWork**| `.section--bleed .section--dark .section--wide` — black showcase band, bento at 1280px |
| 5 | **Contact**     | contained, centered block, on page `--bg`   |

This yields white → grey → white → black → white — the signature Apple rhythm.
To apply, add the modifier classes to each component's root `<section>` (e.g.
`class="section contact"` → `class="section contact section--center"`; About's
`<section id="about" class="section section--bleed section--tint">`). Blog index,
blog post, and 404 stay contained.

---

## 3. Bento grid → real project groups

`SelectedWork.astro` renders `p.groups`, each with a `.grid` of `ProjectCard`s.
Two options:

- **Easiest (zero markup change):** the base `.grid` is already a responsive
  auto-fit tile grid (`minmax(300px,1fr)`), so cards become uniform rounded
  tiles immediately. Good default.
- **True bento (varied sizes):** add `grid--bento` to the group's grid
  (`<div class="grid grid--bento">`) and tag each `ProjectCard`'s root
  `<article>` with a span class. Map **featured** repos (already sorted to the
  front) to bigger tiles:

  ```
  featured repo  → class="card project-card tile-4 tile-tall"   (hero tile)
  2nd featured   → class="card project-card tile-2"
  remaining      → class="card project-card tile-2"
  ```

  Pass an optional `size` prop into `ProjectCard` from the `.map()` (index 0 =
  big) and append it to the `class`. On phones every tile spans full width
  automatically. Keep one large tile per group as the visual anchor; let the
  rest be equal 2-col tiles.

Research tiles (`Research.astro`) already use `.card` — leave on the plain
`.grid` for a clean even row of three.

---

## 4. Frosted nav behavior

`.site-header` is `position: sticky`, 48px tall, with
`backdrop-filter: saturate(180%) blur(20px)` and a **transparent** bottom
border at rest. The scroll script in §1 toggles `body.scrolled`, which fades in
the hairline border + a whisper of shadow once the user scrolls past 8px —
giving the translucent bar a subtle "settled" state over content. No layout
shift, no color jump. Forced-colors mode drops the blur for a solid `Canvas`
fill (already in CSS). The existing theme-toggle script is untouched; just add
the second script block beside it.

If you prefer toggling the class on the header itself rather than `<body>`, the
CSS supports both: `.site-header.scrolled` and `body.scrolled .site-header`.

---

## 5. Per-component class hooks the CSS expects

Most classes already exist. New/optional hooks to add:

| Component | Add | Effect |
|-----------|-----|--------|
| `BaseLayout.astro` | second `<script>` from §1; `<noscript>` reveal fallback in `<head>`; **remove** Google Fonts link/preconnect | reveal + frosted scroll state + system fonts |
| Section openers (About/Research/Work/Contact) | `.reveal` on the heading block; `.section--center` where centered | scroll reveal + centered Apple layout |
| `About.astro` `<section>` | `section--bleed section--tint` | off-white full-bleed band |
| `SelectedWork.astro` `<section>` | `section--bleed section--dark section--wide`; group grids → `grid grid--bento` | black showcase + bento |
| `ProjectCard.astro` `<article>` | `.reveal` + optional `tile-*` span class via a `size` prop | reveal + bento sizing |
| `Research.astro` cards | `.reveal` (+ `.reveal-stagger` on `.grid`) | staggered reveal |
| `Hero.astro` | `.reveal reveal--scale` on `.hero__actions`; optional `<span class="grad">…</span>` around a headline word | scale-in CTAs + gradient-ink accent |
| `Contact.astro` `<section>` | `.section--center` | centered contact block |
| `PostList.astro` `.post` | `.reveal` | editorial rows fade in |

**Note on component `<style>` blocks:** several components ship scoped styles
(Hero `.hero__tagline`, About `.about__body`, Work `.work__group-*`, Contact
list, blog post page, 404). Those still apply and are harmless, but two now
conflict with the cleaner Apple look and should be trimmed: remove the
`border-bottom` hairline from `.work__group-head` (the global file drops it for
a cleaner feel — the scoped rule will otherwise re-add it) and let the global
`.contact` centering win (the scoped list is fine; just ensure the section gets
`.section--center`). Everything else can stay.

---

### Quick verification checklist
- [ ] 375px: nav links scroll horizontally, no clipping; bento single-column; hero headline doesn't overflow.
- [ ] 1280px+: SelectedWork band uses the wider `--maxw-wide` inner cap; sections breathe.
- [ ] Dark mode: pure-black ground, `--accent` brightens to `#2997ff`, hairlines visible.
- [ ] `/zh/`: PingFang/Hiragino CJK stack, looser line-height, headings stay tight.
- [ ] Reduced motion: all `.reveal` visible, no transforms; smooth-scroll off.
- [ ] No-JS: `<noscript>` shows all `.reveal` content.
