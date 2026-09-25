/*
 * The three reference audits, ported to the rebuilt app's DOM. This function
 * is serialised and evaluated in the page, where it installs
 * `window.__lfAudit`; nothing here runs in Node.
 *
 * Port notes (reference → rebuilt app):
 *   - Scope: every `.lf-rebuild` root on the page (the surface root and each
 *     body-level overlay host), instead of the mockup's `#app`. On a route of
 *     the real application this skips the legacy chrome around the rebuilt
 *     surface, which is not ours to audit here.
 *   - Text fit (text-fit-audit.reference.mjs): the same per-element checks —
 *     ellipsis, line-clamp, text clipped by `overflow`, text outside the
 *     viewport, a word wider than its box (canvas-measured), targets under
 *     48 px, page-level horizontal scroll — plus 02 rule 19: visible text with
 *     no declared `data-copy-role`. A scroll container that scrolls is not a
 *     clip; hiding text with `overflow: hidden` is.
 *   - +40% text: the reference's pseudo-locale (`stressify`: every string
 *     gains 40% of its own words), applied to the rendered text nodes, numbers
 *     excepted, and restored after the measurement.
 *   - Proportion (proportion-audit.reference.mjs): the same rules with the
 *     rebuilt class names (`lf-button--accent`, `lf-tabbar`).
 *   - Copy budget (copy-budget-audit.reference.mjs): declared roles first
 *     (they win, as in the reference), the heuristics only for undeclared
 *     text, the 6–9 limits from the nearest `data-age-band`, and the site
 *     budget inside the public-site shell.
 */
export function installAudit() {
  const ROOTS = () => [...document.querySelectorAll('.lf-rebuild')].filter((root) => !root.parentElement?.closest('.lf-rebuild'));
  let hiddenCache = new WeakMap();
  const fresh = () => { hiddenCache = new WeakMap(); };
  const isHidden = (el) => {
    if (!el || el === document.body || el === document.documentElement) return false;
    if (hiddenCache.has(el)) return hiddenCache.get(el);
    const cs = getComputedStyle(el);
    let hidden = false;
    if (cs.display === 'none' || cs.visibility === 'hidden' || el.hidden) hidden = true;
    else if (cs.clip === 'rect(0px, 0px, 0px, 0px)' || cs.clipPath === 'inset(50%)') hidden = true;
    else if (cs.position === 'absolute' && cs.overflow === 'hidden' && el.offsetWidth <= 1 && el.offsetHeight <= 1) hidden = true;
    else hidden = isHidden(el.parentElement);
    hiddenCache.set(el, hidden);
    return hidden;
  };
  const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !isHidden(el); };
  const label = (el) => {
    const cls = typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : el.tagName.toLowerCase();
    return `${cls} "${(el.textContent || '').trim().slice(0, 32)}"`;
  };
  const ownText = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
  const all = () => ROOTS().flatMap((root) => [root, ...root.querySelectorAll('*')]).filter((el) => !el.closest('svg') || el.tagName.toLowerCase() === 'svg');
  const words = (t) => (t.trim().match(/[\p{L}\p{N}][\p{L}\p{N}'’.,%$-]*/gu) || []).length;
  const sentences = (t) => t.replace(/\b(Dr|Mr|Mrs|Ms|Sr|Sra|Srta|St)\./g, '$1').trim()
    .split(/(?<=[\p{L}\p{N}]{2}[.!?…]|[.!?…]["”])\s+(?=[\p{Lu}¿¡"“])/u).filter((s) => words(s) > 0).length;

  /* ---------------------------------------------------------- text fit */
  function textFit() {
    fresh();
    const out = [];
    const canvas = document.createElement('canvas').getContext('2d');
    for (const el of all()) {
      if (el.closest('svg') || isHidden(el)) continue;
      const cs = getComputedStyle(el), hasText = ownText(el);
      if (cs.textOverflow === 'ellipsis') out.push(['ellipsis', label(el)]);
      if (cs.webkitLineClamp && cs.webkitLineClamp !== 'none') out.push(['line-clamp', label(el)]);
      const scrolls = (value) => value === 'auto' || value === 'scroll';
      const text = (el.textContent || '').trim();
      if (text && cs.overflowX !== 'visible' && !scrolls(cs.overflowX) && el.scrollWidth > el.clientWidth + 1) out.push(['clipped-x', `${label(el)} sw=${el.scrollWidth} cw=${el.clientWidth}`]);
      if (text && cs.overflowY !== 'visible' && !scrolls(cs.overflowY) && el.scrollHeight > el.clientHeight + 1) out.push(['clipped-y', label(el)]);
      if (hasText && visible(el)) {
        const r = el.getBoundingClientRect();
        const inScroller = (() => { for (let n = el.parentElement; n; n = n.parentElement) { const s = getComputedStyle(n); if (scrolls(s.overflowX)) return true; } return false; })();
        if (!inScroller && (r.left < -0.5 || r.right > innerWidth + 0.5)) out.push(['outside-frame-x', `${label(el)} l=${r.left.toFixed(0)} r=${(r.right - innerWidth).toFixed(0)}`]);
        // 02 rule 19: every string declares its role. Symbols and numbers alone (a stepper's minus) carry no words to budget.
        if (/\p{L}/u.test(el.textContent) && !el.closest('[data-copy-role]') && !el.closest('[aria-hidden="true"]')) out.push(['no-copy-role', label(el)]);
        let box = el; while (box && getComputedStyle(box).display === 'inline') box = box.parentElement;
        const bs = getComputedStyle(box), width = box.clientWidth - parseFloat(bs.paddingLeft) - parseFloat(bs.paddingRight);
        if (cs.overflowWrap !== 'anywhere' && cs.wordBreak !== 'break-all') {
          canvas.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
          try { canvas.letterSpacing = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing; } catch { /* older canvas */ }
          for (const node of el.childNodes) if (node.nodeType === 3) for (const word of node.textContent.split(/\s+|(?<=-)/).filter(Boolean)) {
            const w = canvas.measureText(word).width;
            if (w > width + 0.5) out.push(['word-wider-than-box', `${label(el)} word="${word}" ${w.toFixed(0)}>${width.toFixed(0)}`]);
          }
        }
      }
    }
    for (const root of ROOTS()) for (const b of root.querySelectorAll('button,a[href],input,select,textarea,[role=button],[role=switch],[role=tab],[role=menuitem],[role=option]')) {
      const target = b.matches('input[type=checkbox],input[type=radio]') ? (b.closest('label') ?? b) : b;
      if (!visible(target)) continue;
      const r = target.getBoundingClientRect();
      if (r.width < 47.5 || r.height < 47.5) out.push(['tap-target<48', `${label(target)} ${r.width.toFixed(0)}x${r.height.toFixed(0)}`]);
    }
    if (document.documentElement.scrollWidth > innerWidth + 1) out.push(['page-hscroll', `sw=${document.documentElement.scrollWidth}`]);
    return out;
  }

  /* ------------------------------------------------- +40% text (stress) */
  const stressed = [];
  function stress(on) {
    if (!on) { for (const [node, value] of stressed.splice(0)) if (node.isConnected) node.nodeValue = value; return 0; }
    for (const root of ROOTS()) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const value = node.nodeValue;
        if (!value.trim() || /^[\s\d.,:;%$+\-–−/×·()]+$/.test(value) || node.parentElement?.closest('script,style,svg')) continue;
        const parts = value.trim().split(/\s+/), extra = parts.slice(0, Math.max(1, Math.ceil(parts.length * 0.4))).join(' ');
        stressed.push([node, value]);
        node.nodeValue = `${value} ${extra}`;
      }
    }
    return stressed.length;
  }

  function spacing(on) {
    let style = document.getElementById('lf-audit-spacing');
    if (!style) { style = document.createElement('style'); style.id = 'lf-audit-spacing'; document.head.append(style); }
    style.textContent = on ? '.lf-rebuild, .lf-rebuild * { letter-spacing: .12em !important; word-spacing: .16em !important; line-height: 1.5 !important; } .lf-rebuild p { margin-bottom: 2em !important; }' : '';
  }

  /* -------------------------------------------------------- proportion */
  // Which sides of an element's margin a matching rule declares `auto` (logical sides mapped for LTR and RTL).
  let autoRules = null;
  function declaredAutoMargins() {
    if (!autoRules) {
      autoRules = [];
      const walk = (rules) => { for (const rule of rules) {
        if (rule.cssRules && !rule.selectorText) { walk(rule.cssRules); continue; }
        if (!rule.style || !rule.selectorText) continue;
        const sides = {};
        for (const prop of ['margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'margin-inline-start', 'margin-inline-end', 'margin-block-start', 'margin-block-end']) {
          if (rule.style.getPropertyValue(prop).trim() === 'auto') sides[prop] = true;
        }
        if (Object.keys(sides).length) autoRules.push({ selector: rule.selectorText, sides });
        if (rule.cssRules) walk(rule.cssRules);
      } };
      for (const sheet of document.styleSheets) { try { walk(sheet.cssRules); } catch { /* cross-origin sheet */ } }
    }
    const memo = new WeakMap();
    return (el) => {
      if (memo.has(el)) return memo.get(el);
      const rtl = getComputedStyle(el).direction === 'rtl', found = new Set();
      for (const { selector, sides } of autoRules) {
        let hit = false; try { hit = el.matches(selector); } catch { hit = false; }
        if (!hit) continue;
        for (const prop of Object.keys(sides)) {
          const side = prop.slice(7);
          found.add(side === 'inline-start' ? (rtl ? 'right' : 'left') : side === 'inline-end' ? (rtl ? 'left' : 'right') : side === 'block-start' ? 'top' : side === 'block-end' ? 'bottom' : side);
        }
      }
      memo.set(el, found);
      return found;
    };
  }

  function proportion() {
    fresh();
    const SCALE = [12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 60, 64, 72, 96];
    const els = all().filter((e) => !e.closest('svg') && visible(e));
    const out = { spacing: new Map(), font: new Map(), measure: [], uniform: [], sizes: new Set(), radii: new Set(), gaps: 0, pairs: [] };
    const offGrid = (v) => v > 2 && Math.abs(v / 4 - Math.round(v / 4)) > 0.02;
    const autoSides = declaredAutoMargins();
    const tag = (e) => e.tagName.toLowerCase() + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
    for (const e of els) {
      const cs = getComputedStyle(e);
      for (const p of ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'rowGap', 'columnGap']) {
        if (cs[p] === 'auto' || cs[p] === 'normal') continue;
        // A margin the stylesheet declares `auto` resolves to whatever space is left (the reference's autoM check).
        if (p.startsWith('margin') && autoSides(e).has(p.slice(6).toLowerCase())) continue;
        const v = Math.abs(parseFloat(cs[p]));
        if (!Number.isFinite(v)) continue;
        // Auto margins resolve to equal, arbitrary lengths on both sides of an axis (centring).
        if ((p === 'marginLeft' || p === 'marginRight') && Math.abs(parseFloat(cs.marginLeft) - parseFloat(cs.marginRight)) < 1 && v > 0) continue;
        if ((p === 'marginTop' || p === 'marginBottom') && Math.abs(parseFloat(cs.marginTop) - parseFloat(cs.marginBottom)) < 1 && v > 0) continue;
        if (offGrid(v)) { const k = `${tag(e)} ${p}=${+v.toFixed(1)}`; out.spacing.set(k, (out.spacing.get(k) || 0) + 1); }
      }
      if (ownText(e)) {
        const size = parseFloat(cs.fontSize);
        out.sizes.add(Math.round(size * 10) / 10);
        if (!SCALE.includes(Math.round(size * 100) / 100) && !SCALE.includes(Math.round(size))) { const k = `${tag(e)} ${+size.toFixed(2)}px`; out.font.set(k, (out.font.get(k) || 0) + 1); }
      }
      const radius = parseFloat(cs.borderTopLeftRadius);
      if (radius > 0 && radius < 1000 && e.getBoundingClientRect().height > 24) out.radii.add(Math.round(radius));
    }
    const cv = document.createElement('canvas').getContext('2d');
    for (const root of ROOTS()) for (const e of root.querySelectorAll('p,li')) {
      if (!visible(e) || (e.tagName === 'LI' && e.querySelector('p,h1,h2,h3,div'))) continue;
      const t = e.textContent.trim(); if (t.length < 60) continue;
      const cs = getComputedStyle(e); cv.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const avg = cv.measureText(t).width / t.length, w = e.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      if (w / avg > 75) out.measure.push(`${tag(e)} ${Math.round(w / avg)}ch`);
    }
    for (const c of els) {
      if (c.closest('[data-uniform]')) continue;
      const kids = [...c.children].filter(visible); if (kids.length < 3) continue;
      const groups = {};
      for (const k of kids) { const r = k.getBoundingClientRect(); const key = `${Math.round(r.width / 2)}x${Math.round(r.height / 2)}@${Math.round(r.top / 4)}`; (groups[key] = groups[key] || []).push(k); }
      for (const g of Object.values(groups)) if (g.length >= 3) {
        const sig = g.map((k) => [...k.children].map((x) => x.tagName).join(','));
        const r = g[0].getBoundingClientRect();
        if (new Set(sig).size === 1 && r.width > 90 && r.height > 60) out.uniform.push(`${tag(c)} x${g.length} of ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
    }
    const h1s = els.filter((e) => e.tagName === 'H1');
    const h1 = h1s[0], body = els.find((e) => e.tagName === 'P' && e.closest('main'));
    // As the reference and 03 §3.2 define it: the h1 against the 16 px body size, measured when the page has body text.
    const ratio = h1 && body ? +(parseFloat(getComputedStyle(h1).fontSize) / 16).toFixed(2) : null;
    const blocks = els.filter((e) => /^(H1|H2|H3|P)$/.test(e.tagName));
    const center = blocks.length ? +(blocks.filter((e) => getComputedStyle(e).textAlign === 'center' && e.getBoundingClientRect().height > 24).length / blocks.length).toFixed(2) : null;
    const hero = els.find((e) => e.matches('[data-layout="hero"]'));
    let split = null;
    if (hero) { const k = [...hero.children].filter(visible).map((x) => x.getBoundingClientRect().width); if (k.length === 2 && getComputedStyle(hero).gridTemplateColumns.split(' ').length > 1) split = +(Math.max(...k) / Math.min(...k)).toFixed(2); }
    const accent = els.filter((e) => e.matches('.lf-button--accent') && !e.disabled && e.getAttribute('aria-disabled') !== 'true' && !e.closest('[inert]')).length;
    const sections = els.filter((e) => e.matches('main > section, [data-section]'));
    const rhythm = sections.map((s) => { const cs = getComputedStyle(s); return [cs.paddingTop, cs.backgroundColor, [...s.children].map((c) => (typeof c.className === 'string' && c.className.split(' ')[0]) || c.tagName).join('+')].join('|'); });
    // Content behind a modal is inert: it cannot be pressed, so it has no neighbour to be pressed by mistake.
    const targets = els.filter((e) => e.matches('button,a[href],select,input:not([type=checkbox]):not([type=radio]),[role=button],[role=switch]') && !e.closest('[inert]'));
    const rects = targets.map((e) => e.getBoundingClientRect());
    for (let i = 0; i < targets.length; i++) for (let j = i + 1; j < targets.length; j++) {
      if (targets[i].closest('.lf-tabbar') !== targets[j].closest('.lf-tabbar')) continue;
      if (targets[i].contains(targets[j]) || targets[j].contains(targets[i])) continue;
      const a = rects[i], b = rects[j];
      const v = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top), h = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const hg = Math.max(a.left, b.left) - Math.min(a.right, b.right), vg = Math.max(a.top, b.top) - Math.min(a.bottom, b.bottom);
      if ((v > 8 && hg >= 0 && hg < 8) || (h > 8 && vg >= 0 && vg < 8)) { out.gaps++; if (out.pairs.length < 4) out.pairs.push(`${label(targets[i])} ~ ${label(targets[j])} ${Math.round(Math.max(hg, vg))}px`); }
    }
    const modal = !!document.querySelector('[aria-modal="true"]');
    return { h1n: h1s.filter((e) => !e.closest('[inert]') || modal).length, spacing: [...out.spacing], font: [...out.font], measure: out.measure, uniform: out.uniform,
      ratio, center, split, sizes: out.sizes.size, radii: out.radii.size, accent, rhythm, gaps: out.gaps, pairs: out.pairs };
  }

  /* ------------------------------------------------------- motion budget */
  // Read with motion allowed (the driver switches prefers-reduced-motion to no-preference first; every other
  // measurement runs with reduced motion so nothing moves under it).
  function motion() {
    // Idle motion (02 §9.4): at most three looping things per screen, each one a claimed slot (`data-idle-motion`),
    // and one breathing call to action. CSS loops are read from the running animations; the Mentor's WebGL idle
    // loop is not a CSS animation, so its claimed element counts instead.
    const loops = document.getAnimations().filter((a) => a.playState === 'running' && a.effect?.getTiming().iterations === Infinity);
    const loopTargets = new Set(loops.map((a) => a.effect?.target).filter(Boolean));
    const claimed = [...document.querySelectorAll('[data-idle-motion]')];
    const idleThings = new Set([...claimed, ...[...loopTargets].map((t) => t.closest('[data-idle-motion]') ?? t)]);
    const unbudgeted = [...loopTargets].filter((t) => !t.closest('[data-idle-motion]')).map((t) => label(t));
    const breathing = claimed.filter((e) => e.dataset.idleMotion === 'breathing-cta').length;
    // Celebration only for the closed OD-7 list (D7): no celebration root off the list that is not refused, and no
    // celebration keyframes or spring running outside a celebration root on the list.
    const milestones = ['lesson-complete', 'course-complete', 'savings-goal-reached', 'badge-earned', 'streak-7', 'streak-30', 'streak-100'];
    const onList = (e) => milestones.includes(e?.closest('.lf-celebration')?.dataset.milestone ?? '');
    const offList = [...document.querySelectorAll('.lf-celebration')].filter((e) => e.dataset.celebration !== 'refused' && !onList(e)).map((e) => label(e))
      .concat(document.getAnimations().filter((a) => /^lf-celebration/.test(a.animationName ?? '') && !onList(a.effect?.target)).map((a) => label(a.effect.target)));
    return { idle: idleThings.size, unbudgeted, breathing, offList };
  }

  /* ------------------------------------------------------- copy budget */
  function copyBudget(fold) {
    fresh();
    const blocks = [], seen = new Set();
    const isBlock = (el) => { const d = getComputedStyle(el).display; return !d.startsWith('inline') || el.matches('button,a,label'); };
    // A `display: contents` wrapper (the milestone celebration) draws no box of its own: look through it to its children.
    const hasBlockChild = (el) => [...el.children].some((c) => getComputedStyle(c).display === 'contents' ? hasBlockChild(c) : isBlock(c) && visible(c) && (c.innerText ?? '').trim());
    for (const el of all()) {
      if (seen.has(el) || el.closest('svg') || !visible(el) || el.closest('[aria-hidden="true"]')) continue;
      if (['SCRIPT', 'STYLE', 'INPUT', 'TEXTAREA', 'SELECT', 'OPTION'].includes(el.tagName)) continue;
      const declared = el.closest('[data-copy-role]')?.dataset.copyRole;
      if (declared === 'data' || declared === 'legal' || declared === 'brand') continue;
      const band = el.closest('[data-age-band]')?.dataset.ageBand ?? document.documentElement.dataset.ageBand ?? '';
      const site = !!el.closest('[data-shell="site"] main, [data-surface="site"]');
      const push = (role, text) => { const r = el.getBoundingClientRect(); blocks.push({ role, text, words: words(text), sentences: sentences(text), top: r.top, young: band === '6-9', site }); };
      if (el.dataset.copyRole) {
        const t = (el.innerText || '').replace(/\s+/g, ' ').trim();
        el.querySelectorAll('*').forEach((c) => seen.add(c));
        if (t && words(t)) push(el.dataset.copyRole, t);
        continue;
      }
      const raw = (el.innerText || '').trim();
      const pressable = el.matches('button,[role=button],a[href],[role=option]');
      const act = pressable && !raw.includes('\n');
      if (pressable && !act) continue;
      if (!act && !isBlock(el)) continue;
      if (!act && hasBlockChild(el)) continue;
      if (el.closest('td,th,table') || el.querySelector('select')) continue;
      const text = (el.innerText || '').replace(/\s+/g, ' ').trim(); if (!text || !words(text)) continue;
      if (act) el.querySelectorAll('*').forEach((c) => seen.add(c));
      const fs = parseFloat(getComputedStyle(el).fontSize);
      const heading = el.matches('h1,h2,h3') || fs >= 22;
      push(el.matches('[role=option]') ? 'option' : act ? 'action' : heading ? (text.includes('?') ? 'prompt' : 'heading') : 'body', text);
    }
    const modal = !!document.querySelector('[aria-modal="true"]');
    return { blocks: blocks.map((b) => ({ ...b, fold: b.top < fold })), modal };
  }

  function signature() {
    return ROOTS().map((root) => root.innerHTML.length + ':' + root.textContent.slice(0, 160)).join('|');
  }

  window.__lfAudit = {
    textFit, proportion, motion, copyBudget, stress, spacing, signature,
    roots: () => ROOTS().length,
  };
}
