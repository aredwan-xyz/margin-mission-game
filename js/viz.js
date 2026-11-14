// Canvas view of the mission while it flies.
const COLORS = {
  earth: ['#2a6fb3', '#4c9a5b'], moon: ['#9aa3ad', '#7d8691'], mars: ['#b5532e', '#7f3519'], jupiter: ['#c9a77c', '#8f6040'],
};
const FX_SECONDS = 4.5;

export function createViz(canvas) {
  const ctx = canvas.getContext('2d');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let state = { scene: 'development', body: 'earth', progress: 0, lost: false, orbitId: '', fx: null, fxAt: 0, done: false };
  let w = 0, h = 0, raf = 0, running = true;
  const t0 = performance.now();
  const starList = Array.from({ length: 160 }, () => [Math.random(), Math.random(), Math.random() * 1.3 + 0.2, Math.random()]);
  let smoke = [];
  let sparks = [];
  let lastT = 0;

  function resize() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    w = r.width; h = r.height;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(performance.now());
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  function starsBg(t, skyAlpha = 0) {
    ctx.fillStyle = '#08111e';
    ctx.fillRect(0, 0, w, h);
    for (const [x, y, r, a] of starList) {
      const tw = reduced ? 1 : 0.75 + 0.25 * Math.sin(t * 2 + a * 20);
      ctx.globalAlpha = (0.25 + a * 0.6) * tw * (1 - skyAlpha);
      ctx.fillStyle = '#e8edf4';
      ctx.beginPath(); ctx.arc(x * w, y * h, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (skyAlpha > 0) {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, `rgba(40,90,160,${skyAlpha * 0.7})`); g.addColorStop(1, `rgba(120,170,220,${skyAlpha})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
  }

  function planet(x, y, r, body, rot = 0) {
    const [c1, c2] = COLORS[body];
    ctx.save();
    if (body !== 'moon') {
      const halo = ctx.createRadialGradient(x, y, r * 0.95, x, y, r * 1.18);
      halo.addColorStop(0, body === 'earth' ? 'rgba(120,180,255,0.35)' : body === 'mars' ? 'rgba(230,140,100,0.2)' : 'rgba(230,200,150,0.18)');
      halo.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(x, y, r * 1.18, 0, Math.PI * 2); ctx.fill();
    }
    const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.4, r * 0.1, x, y, r);
    g.addColorStop(0, c1); g.addColorStop(1, shade(c1, -0.45));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = c2; ctx.globalAlpha = 0.75;
    const sx = (k) => x + ((((k + rot) % 2) + 2) % 2 - 1) * r * 1.4;
    if (body === 'jupiter') {
      for (const [dy, hh] of [[-0.45, 0.12], [-0.12, 0.16], [0.22, 0.1], [0.5, 0.08]]) ctx.fillRect(x - r, y + dy * r, r * 2, hh * r);
      ctx.fillStyle = '#b4523a'; ctx.beginPath(); ctx.ellipse(sx(0.4), y + r * 0.3, r * 0.16, r * 0.09, 0, 0, Math.PI * 2); ctx.fill();
    } else if (body === 'earth') {
      ctx.beginPath(); ctx.ellipse(sx(0.2), y - r * 0.15, r * 0.38, r * 0.26, 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(sx(1.1), y + r * 0.3, r * 0.22, r * 0.3, -0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e8edf4'; ctx.globalAlpha = 0.4;
      ctx.beginPath(); ctx.ellipse(sx(0.7), y + r * 0.05, r * 0.5, r * 0.06, 0.1, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(sx(1.5), y - r * 0.5, r * 0.35, r * 0.05, -0.1, 0, Math.PI * 2); ctx.fill();
    } else if (body === 'moon') {
      for (const [k, dy, rr] of [[0.3, -0.3, 0.17], [0.9, 0.2, 0.24], [0.6, -0.45, 0.09], [1.4, 0.45, 0.12], [1.8, -0.1, 0.14]]) { ctx.beginPath(); ctx.arc(sx(k), y + dy * r, rr * r, 0, Math.PI * 2); ctx.fill(); }
    } else if (body === 'mars') {
      ctx.beginPath(); ctx.ellipse(sx(0.5), y - r * 0.05, r * 0.6, r * 0.12, 0.15, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(sx(1.3), y + r * 0.35, r * 0.3, r * 0.15, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#efe6dc'; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.ellipse(x, y - r * 0.92, r * 0.38, r * 0.14, 0, 0, Math.PI * 2); ctx.fill();
    }
    // night side
    ctx.globalAlpha = 1;
    const night = ctx.createLinearGradient(x - r, y, x + r, y);
    night.addColorStop(0, 'rgba(0,0,0,0)'); night.addColorStop(0.55, 'rgba(0,0,0,0)'); night.addColorStop(1, 'rgba(4,8,16,0.55)');
    ctx.fillStyle = night; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.restore();
  }

  function craft(x, y, lost, t) {
    ctx.save(); ctx.translate(x, y);
    if (lost) ctx.rotate(t * 0.8);
    ctx.fillStyle = lost ? '#f0605a' : '#d9a441';
    ctx.fillRect(-4, -4, 8, 8);
    if (!lost) { ctx.fillStyle = '#5fb3ff'; ctx.fillRect(-15, -2, 10, 4); ctx.fillRect(5, -2, 10, 4); }
    ctx.restore();
  }

  function label(text, x, y, align = 'left') {
    ctx.font = '500 13px Barlow, system-ui, sans-serif';
    ctx.fillStyle = '#9aabc2'; ctx.textAlign = align;
    ctx.fillText(text, x, y);
  }

  function particles(dt) {
    smoke = smoke.filter((p) => (p.life -= dt) > 0);
    for (const p of smoke) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.r += 14 * dt;
      ctx.globalAlpha = Math.max(0, p.life / p.max) * 0.5;
      ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    sparks = sparks.filter((p) => (p.life -= dt) > 0);
    for (const p of sparks) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.c; ctx.fillRect(p.x, p.y, 2.5, 2.5);
    }
    ctx.globalAlpha = 1;
  }

  function burst(x, y, colours, n = 40, speed = 90) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = speed * (0.3 + Math.random());
      sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1.2, max: 1.2, c: colours[i % colours.length] });
    }
  }

  function drawFx(t, cx, cy, R, px, py) {
    if (!state.fx) return;
    const age = t - state.fxAt;
    if (age > FX_SECONDS) return;
    const k = Math.min(1, age / 0.8) * Math.min(1, (FX_SECONDS - age) / 1);
    const fx = state.fx;
    if (fx === 'dust') {
      const g = ctx.createRadialGradient(cx, cy, R * 0.4, cx, cy, R * 1.25);
      g.addColorStop(0, `rgba(196,140,90,${0.75 * k})`); g.addColorStop(1, 'rgba(196,140,90,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * 1.25, 0, Math.PI * 2); ctx.fill();
    } else if (fx === 'solar' || fx === 'conjunction') {
      ctx.strokeStyle = `rgba(255,214,120,${0.6 * k})`; ctx.lineWidth = 1.5;
      for (let i = 0; i < 40; i++) {
        const yy = ((i * 37) % 100) / 100 * h;
        const xx = ((age * 380 + i * 53) % (w + 200)) - 100;
        ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx + 40, yy + 2); ctx.stroke();
      }
      if (fx === 'conjunction') {
        const g = ctx.createRadialGradient(28, 30, 2, 28, 30, 120);
        g.addColorStop(0, `rgba(255,240,190,${0.9 * k})`); g.addColorStop(1, 'rgba(255,240,190,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(28, 30, 120, 0, Math.PI * 2); ctx.fill();
      }
    } else if (fx === 'debris') {
      const dx = -80 + (age / FX_SECONDS) * (w + 160);
      const dy = py - 60 + (age / FX_SECONDS) * 120;
      ctx.strokeStyle = `rgba(200,210,225,${0.5 * k})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(dx - 60, dy - 8); ctx.lineTo(dx, dy); ctx.stroke();
      ctx.save(); ctx.translate(dx, dy); ctx.rotate(age * 3);
      ctx.fillStyle = '#9aa3ad'; ctx.fillRect(-7, -3, 14, 6); ctx.restore();
    } else if (fx === 'eclipse') {
      ctx.fillStyle = `rgba(2,5,10,${0.6 * k})`; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = `rgba(2,5,10,${0.5 * k})`;
      ctx.beginPath(); ctx.moveTo(0, cy - R * 0.6); ctx.lineTo(cx + R * 1.8, cy - R * 0.9); ctx.lineTo(cx + R * 1.8, cy + R * 0.9); ctx.lineTo(0, cy + R * 0.6); ctx.fill();
    } else if (fx === 'plume') {
      const ex = cx + R * 1.75, ey = cy - R * 0.55;
      for (let i = 0; i < 14; i++) {
        const yy = ey - 6 - ((age * 40 + i * 9) % 60);
        ctx.fillStyle = `rgba(230,240,255,${0.5 * k * (1 - (ey - yy) / 70)})`;
        ctx.beginPath(); ctx.arc(ex + Math.sin(i) * 3, yy, 2 + (ey - yy) / 20, 0, Math.PI * 2); ctx.fill();
      }
    } else if (fx === 'radiation') {
      ctx.strokeStyle = `rgba(213,140,255,${0.45 * k})`; ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const rr = R * (1.3 + i * 0.35) + Math.sin(age * 3 + i) * 4;
        ctx.beginPath(); ctx.ellipse(cx, cy, rr * 1.4, rr * 0.55, 0, 0, Math.PI * 2); ctx.stroke();
      }
    } else if (fx === 'fire') {
      for (const [dx, dy] of [[-0.3, -0.1], [0.1, 0.25], [0.35, -0.3], [-0.05, 0.45]]) {
        const fl = 0.6 + 0.4 * Math.sin(age * 10 + dx * 10);
        const g = ctx.createRadialGradient(cx + dx * R, cy + dy * R, 0, cx + dx * R, cy + dy * R, R * 0.14);
        g.addColorStop(0, `rgba(255,140,60,${k * fl})`); g.addColorStop(1, 'rgba(255,90,40,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx + dx * R, cy + dy * R, R * 0.14, 0, Math.PI * 2); ctx.fill();
      }
    } else if (fx === 'antenna') {
      if (Math.floor(age * 6) % 2 === 0) { ctx.strokeStyle = `rgba(240,96,90,${k})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, py, 14, 0, Math.PI * 2); ctx.stroke(); }
    }
  }

  function draw(now) {
    if (!w) return;
    const t = (now - t0) / 1000;
    const dt = Math.min(0.05, Math.max(0, t - lastT));
    lastT = t;
    const s = state;
    ctx.save();
    if (s.scene === 'development') {
      starsBg(t);
      ctx.strokeStyle = '#1f3352'; ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 24) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (let y = 0; y < h; y += 24) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      const r = Math.min(w, h) * 0.28;
      ctx.lineWidth = 10; ctx.strokeStyle = '#24395a';
      ctx.beginPath(); ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#d9a441';
      ctx.beginPath(); ctx.arc(w / 2, h / 2, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.02, s.progress)); ctx.stroke();
      // a little spacecraft being assembled in the middle
      const sc = 1 + Math.min(1, s.progress) * 1.5;
      ctx.save(); ctx.translate(w / 2, h / 2 - 10); ctx.scale(sc, sc);
      ctx.fillStyle = '#d9a441'; ctx.fillRect(-8, -8, 16, 16);
      ctx.fillStyle = '#5fb3ff'; ctx.globalAlpha = Math.min(1, s.progress * 2);
      ctx.fillRect(-26 * Math.min(1, s.progress * 1.5), -3, 16 * Math.min(1, s.progress * 1.5), 6);
      ctx.fillRect(10, -3, 16 * Math.min(1, s.progress * 1.5), 6);
      ctx.restore(); ctx.globalAlpha = 1;
    } else if (s.scene === 'launch') {
      const p = reduced ? 0.6 : Math.min(1, s.progress);
      if (!reduced && p < 0.35 && p > 0) ctx.translate((Math.random() - 0.5) * 4 * (1 - p / 0.35), (Math.random() - 0.5) * 3 * (1 - p / 0.35));
      starsBg(t, Math.max(0, 0.9 - p * 1.4));
      planet(w / 2, h * 1.9 + p * h * 0.6, h * 1.15, 'earth');
      const ry = h * 0.82 - Math.pow(p, 1.4) * h * 0.72;
      const x = w / 2;
      if (!s.lost) {
        if (!reduced && p > 0 && p < 1) {
          for (let i = 0; i < 3; i++) smoke.push({ x: x + (Math.random() - 0.5) * 8, y: ry + 46, vx: (Math.random() - 0.5) * 40, vy: 40 + Math.random() * 40, r: 4, life: 1.6, max: 1.6, c: p < 0.4 ? '#c9d4e3' : '#7f93b0' });
        }
        particles(dt);
        // flame
        const fl = 18 + Math.sin(t * 40) * 5 + (1 - p) * 10;
        const fg = ctx.createLinearGradient(x, ry + 22, x, ry + 22 + fl);
        fg.addColorStop(0, '#fff3c4'); fg.addColorStop(0.5, '#f0a040'); fg.addColorStop(1, 'rgba(240,96,60,0)');
        ctx.fillStyle = fg; ctx.beginPath(); ctx.moveTo(x - 6, ry + 22); ctx.lineTo(x, ry + 22 + fl * 1.6); ctx.lineTo(x + 6, ry + 22); ctx.fill();
        // rocket
        ctx.fillStyle = '#e8edf4'; ctx.fillRect(x - 6, ry - 18, 12, 40);
        ctx.beginPath(); ctx.moveTo(x - 6, ry - 18); ctx.lineTo(x, ry - 32); ctx.lineTo(x + 6, ry - 18); ctx.fill();
        ctx.fillStyle = '#d9a441'; ctx.fillRect(x - 6, ry - 4, 12, 3);
        if (p < 0.55) { ctx.fillStyle = '#c9d4e3'; ctx.fillRect(x - 11, ry + 2, 5, 22); ctx.fillRect(x + 6, ry + 2, 5, 22); }
        else if (p < 0.8) {
          const fall = (p - 0.55) * 300;
          ctx.fillStyle = '#c9d4e3'; ctx.globalAlpha = 1 - (p - 0.55) * 4;
          ctx.save(); ctx.translate(x - 16 - fall * 0.3, ry + 14 + fall); ctx.rotate(-0.6 - fall / 100); ctx.fillRect(-2, -11, 5, 22); ctx.restore();
          ctx.save(); ctx.translate(x + 16 + fall * 0.3, ry + 14 + fall); ctx.rotate(0.6 + fall / 100); ctx.fillRect(-2, -11, 5, 22); ctx.restore();
          ctx.globalAlpha = 1;
        }
      } else {
        if (!s.boom) { s.boom = true; burst(x, ry, ['#f0605a', '#f0a040', '#fff3c4'], 70, 140); }
        particles(dt);
      }
    } else if (s.scene === 'cruise') {
      starsBg(t);
      const cx = w / 2, cy = h / 2;
      const sun = ctx.createRadialGradient(cx, cy, 2, cx, cy, 28); sun.addColorStop(0, '#fff3c4'); sun.addColorStop(1, 'rgba(240,196,106,0)');
      ctx.fillStyle = sun; ctx.beginPath(); ctx.arc(cx, cy, 28, 0, Math.PI * 2); ctx.fill();
      const rE = Math.min(w, h) * 0.18;
      const rT = s.body === 'jupiter' ? Math.min(w, h) * 0.44 : s.body === 'mars' ? Math.min(w, h) * 0.3 : rE * 1.15;
      ctx.strokeStyle = '#24395a'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, rE, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, rT, 0, Math.PI * 2); ctx.stroke();
      const a = (rE + rT) / 2, c = (rT - rE) / 2, b = Math.sqrt(rE * rT);
      const p = Math.min(1, s.progress);
      ctx.strokeStyle = 'rgba(217,164,65,0.35)'; ctx.setLineDash([5, 5]);
      ctx.beginPath(); ctx.ellipse(cx + c, cy, a, b, 0, Math.PI, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = '#d9a441'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(cx + c, cy, a, b, 0, Math.PI, Math.PI + p * Math.PI); ctx.stroke();
      // planets move along their orbits during the trip
      const eAng = Math.PI - p * 1.2, tAng = -0.35 * (1 - p);
      planet(cx + rE * Math.cos(eAng), cy + rE * Math.sin(eAng), 7, 'earth');
      planet(cx + rT * Math.cos(tAng), cy + rT * Math.sin(tAng), s.body === 'jupiter' ? 14 : 8, s.body === 'moon' ? 'moon' : s.body);
      label('Earth', cx + rE * Math.cos(eAng), cy + rE * Math.sin(eAng) + 22, 'center');
      const ang = Math.PI + p * Math.PI;
      craft(cx + c + a * Math.cos(ang), cy + b * Math.sin(ang), s.lost, t);
    } else {
      starsBg(t);
      const cx = w * 0.55, cy = h * 0.55, R = Math.min(w, h) * (s.body === 'jupiter' ? 0.24 : 0.2);
      planet(cx, cy, R, s.body, reduced ? 0 : t * 0.04);
      let ox = R * 1.6, oy = R * 0.5, tilt = -0.25;
      if (s.orbitId === 'geo') { ox = R * 2.4; oy = R * 2.4; tilt = 0; }
      if (s.orbitId === 'nrho') { ox = R * 2.2; oy = R * 0.7; tilt = 1.1; }
      if (s.orbitId === 'mars_ellip') { ox = R * 2.3; oy = R * 1.0; tilt = 0.2; }
      let ocx = cx, ocy = cy;
      if (s.body === 'jupiter') {
        ox = R * 2.1; oy = R * 0.9; tilt = -0.15;
        const ex = cx + R * 1.75, ey = cy - R * 0.55;
        ctx.fillStyle = '#e7dccb'; ctx.beginPath(); ctx.arc(ex, ey, 6, 0, Math.PI * 2); ctx.fill();
        label('Europa', ex + 10, ey + 4);
        if (s.orbitId === 'europaOrbit') { ox = 18; oy = 8; tilt = 0; ocx = ex; ocy = ey; }
      }
      ctx.strokeStyle = 'rgba(217,164,65,0.6)'; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.ellipse(ocx, ocy, ox, oy, tilt, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      const stopped = s.lost || s.done;
      const ang = stopped ? (s.stopAng ?? (s.stopAng = t * 0.6)) : reduced ? 1 : t * 0.6;
      const px = ocx + ox * Math.cos(ang) * Math.cos(tilt) - oy * Math.sin(ang) * Math.sin(tilt);
      const py = ocy + ox * Math.cos(ang) * Math.sin(tilt) + oy * Math.sin(ang) * Math.cos(tilt);
      const front = Math.sin(ang) > 0 || s.body === 'jupiter';
      // scan beam from the spacecraft to the surface
      if (!stopped && front && Math.hypot(px - cx, py - cy) > R) {
        const dx = cx - px, dy = cy - py, d = Math.hypot(dx, dy);
        const hx = px + (dx / d) * (d - R * 0.92), hy = py + (dy / d) * (d - R * 0.92);
        const nx = -dy / d, ny = dx / d, spread = R * 0.18;
        ctx.fillStyle = `rgba(240,196,106,${0.18 + 0.08 * Math.sin(t * 6)})`;
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(hx + nx * spread, hy + ny * spread); ctx.lineTo(hx - nx * spread, hy - ny * spread); ctx.fill();
      }
      // Earth marker and data packets
      const ex = 26, ey = 30;
      if (s.body !== 'earth') { planet(ex, ey, 7, 'earth'); label('to Earth', ex + 14, ey + 4); }
      if (!stopped) {
        const tx = s.body === 'earth' ? cx - R * 0.3 : ex, ty = s.body === 'earth' ? cy - R * 0.85 : ey;
        for (let i = 0; i < 4; i++) {
          const k = ((reduced ? 0.5 : t * 0.5) + i / 4) % 1;
          ctx.fillStyle = '#d58cff'; ctx.globalAlpha = Math.sin(k * Math.PI);
          ctx.fillRect(px + (tx - px) * k - 2, py + (ty - py) * k - 2, 4, 4);
        }
        ctx.globalAlpha = 1;
      }
      drawFx(t, cx, cy, R, px, py);
      if (s.lost && !s.boom) { s.boom = true; burst(px, py, ['#f0605a', '#f0a040', '#c9d4e3'], 40, 70); }
      particles(dt);
      if (s.done && !s.lost && !s.cheered) { s.cheered = true; burst(px, py, ['#d9a441', '#4fbf8b', '#5fb3ff', '#e8edf4'], 70, 120); }
      if (!s.lost) craft(px, py, false, t);
    }
    ctx.restore();
    if (running && !reduced) raf = requestAnimationFrame(draw);
  }

  function set(next) {
    if (next.fx) next.fxAt = (performance.now() - t0) / 1000;
    if (next.scene && next.scene !== state.scene) { smoke = []; sparks = []; next.boom = false; }
    state = { ...state, ...next };
    if (reduced || !running) draw(performance.now());
  }
  function start() { running = true; cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); }
  function destroy() { running = false; cancelAnimationFrame(raf); ro.disconnect(); }
  resize(); start();
  return { set, destroy };
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + v * amt)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
