// Canvas view of the mission while it flies.
const COLORS = {
  earth: ['#2a6fb3', '#4c9a5b'], moon: ['#9aa3ad', '#7d8691'], mars: ['#b5532e', '#7f3519'], jupiter: ['#c9a77c', '#8f6040'],
};

export function createViz(canvas) {
  const ctx = canvas.getContext('2d');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let state = { scene: 'development', body: 'earth', progress: 0, lost: false, orbitId: '', ga: false };
  let w = 0, h = 0, raf = 0, t0 = performance.now(), running = true;
  const starList = Array.from({ length: 140 }, () => [Math.random(), Math.random(), Math.random() * 1.3 + 0.2, Math.random()]);

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

  function starsBg() {
    ctx.fillStyle = '#08111e';
    ctx.fillRect(0, 0, w, h);
    for (const [x, y, r, a] of starList) {
      ctx.globalAlpha = 0.25 + a * 0.6;
      ctx.fillStyle = '#e8edf4';
      ctx.beginPath(); ctx.arc(x * w, y * h, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function planet(x, y, r, body) {
    const [c1, c2] = COLORS[body];
    const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.4, r * 0.1, x, y, r);
    g.addColorStop(0, c1); g.addColorStop(1, shade(c1, -0.45));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = c2; ctx.globalAlpha = 0.75;
    if (body === 'jupiter') {
      for (const [dy, hh] of [[-0.45, 0.12], [-0.12, 0.16], [0.22, 0.1], [0.5, 0.08]]) ctx.fillRect(x - r, y + dy * r, r * 2, hh * r);
      ctx.fillStyle = '#b4523a'; ctx.beginPath(); ctx.ellipse(x + r * 0.25, y + r * 0.3, r * 0.16, r * 0.09, 0, 0, Math.PI * 2); ctx.fill();
    } else if (body === 'earth') {
      ctx.beginPath(); ctx.ellipse(x - r * 0.25, y - r * 0.15, r * 0.38, r * 0.26, 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x + r * 0.35, y + r * 0.3, r * 0.22, r * 0.3, -0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e8edf4'; ctx.globalAlpha = 0.45; ctx.fillRect(x - r, y + r * 0.05, r * 2, r * 0.07);
    } else if (body === 'moon') {
      for (const [dx, dy, rr] of [[-0.3, -0.3, 0.17], [0.3, 0.2, 0.24], [0.1, -0.45, 0.09], [-0.2, 0.45, 0.12]]) { ctx.beginPath(); ctx.arc(x + dx * r, y + dy * r, rr * r, 0, Math.PI * 2); ctx.fill(); }
    } else if (body === 'mars') {
      ctx.fillRect(x - r, y - r * 0.1, r * 2, r * 0.18);
      ctx.fillStyle = '#efe6dc'; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.ellipse(x, y - r * 0.92, r * 0.38, r * 0.14, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function craft(x, y, lost) {
    ctx.fillStyle = lost ? '#f0605a' : '#d9a441';
    ctx.fillRect(x - 4, y - 4, 8, 8);
    if (!lost) { ctx.fillStyle = '#5fb3ff'; ctx.fillRect(x - 14, y - 2, 9, 4); ctx.fillRect(x + 5, y - 2, 9, 4); }
  }

  function label(text, x, y, align = 'left') {
    ctx.font = '500 13px Barlow, system-ui, sans-serif';
    ctx.fillStyle = '#9aabc2'; ctx.textAlign = align;
    ctx.fillText(text, x, y);
  }

  function draw(now) {
    if (!w) return;
    const t = (now - t0) / 1000;
    starsBg();
    const s = state;
    if (s.scene === 'development') {
      ctx.strokeStyle = '#1f3352'; ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 24) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (let y = 0; y < h; y += 24) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      const r = Math.min(w, h) * 0.28;
      ctx.lineWidth = 10; ctx.strokeStyle = '#24395a';
      ctx.beginPath(); ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#d9a441';
      ctx.beginPath(); ctx.arc(w / 2, h / 2, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.02, s.progress)); ctx.stroke();
      ctx.font = '600 22px "Barlow Condensed", sans-serif'; ctx.fillStyle = '#e8edf4'; ctx.textAlign = 'center';
      ctx.fillText('Building and testing', w / 2, h / 2 + 7);
    } else if (s.scene === 'launch') {
      planet(w / 2, h * 1.9, h * 1.15, 'earth');
      const p = reduced ? 0.6 : Math.min(1, s.progress);
      const ry = h * 0.85 - p * h * 0.75;
      ctx.strokeStyle = 'rgba(232,237,244,0.35)'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(w / 2, h * 0.92); ctx.lineTo(w / 2, ry + 26); ctx.stroke();
      if (!s.lost) {
        ctx.fillStyle = '#f0c46a'; ctx.beginPath(); ctx.moveTo(w / 2 - 6, ry + 22); ctx.lineTo(w / 2, ry + 44 + Math.sin(t * 30) * 4); ctx.lineTo(w / 2 + 6, ry + 22); ctx.fill();
        ctx.fillStyle = '#e8edf4'; ctx.fillRect(w / 2 - 6, ry - 18, 12, 40);
        ctx.beginPath(); ctx.moveTo(w / 2 - 6, ry - 18); ctx.lineTo(w / 2, ry - 30); ctx.lineTo(w / 2 + 6, ry - 18); ctx.fill();
      } else {
        ctx.fillStyle = '#f0605a'; ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.arc(w / 2, ry, 30, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
      }
    } else if (s.scene === 'cruise') {
      const cx = w / 2, cy = h / 2;
      const sun = ctx.createRadialGradient(cx, cy, 2, cx, cy, 22); sun.addColorStop(0, '#fff3c4'); sun.addColorStop(1, 'rgba(240,196,106,0)');
      ctx.fillStyle = sun; ctx.beginPath(); ctx.arc(cx, cy, 22, 0, Math.PI * 2); ctx.fill();
      const rE = Math.min(w, h) * 0.18;
      const rT = s.body === 'jupiter' ? Math.min(w, h) * 0.44 : s.body === 'mars' ? Math.min(w, h) * 0.3 : rE * 1.15;
      ctx.strokeStyle = '#24395a'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, rE, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, rT, 0, Math.PI * 2); ctx.stroke();
      // Hohmann-like half ellipse from Earth (left) to target (right)
      const a = (rE + rT) / 2, c = (rT - rE) / 2;
      ctx.strokeStyle = '#d9a441'; ctx.setLineDash([5, 5]);
      ctx.beginPath(); ctx.ellipse(cx + c, cy, a, Math.sqrt(rE * rT), 0, Math.PI, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      planet(cx - rE, cy, 7, 'earth');
      planet(cx + rT, cy, s.body === 'jupiter' ? 14 : 8, s.body);
      label('Earth', cx - rE, cy + 24, 'center');
      const p = Math.min(1, s.progress);
      const ang = Math.PI + p * Math.PI;
      craft(cx + c + a * Math.cos(ang), cy + Math.sqrt(rE * rT) * Math.sin(ang), s.lost);
    } else {
      // In orbit around the target
      const cx = w * 0.55, cy = h * 0.55, R = Math.min(w, h) * (s.body === 'jupiter' ? 0.24 : 0.2);
      planet(cx, cy, R, s.body);
      let ox = R * 1.6, oy = R * 0.5, tilt = -0.25;
      if (s.orbitId === 'geo') { ox = R * 2.4; oy = R * 2.4; tilt = 0; }
      if (s.orbitId === 'nrho') { ox = R * 2.2; oy = R * 0.7; tilt = 1.1; }
      if (s.orbitId === 'mars_ellip') { ox = R * 2.3; oy = R * 1.0; tilt = 0.2; }
      if (s.body === 'jupiter') {
        ox = R * 2.1; oy = R * 0.9; tilt = -0.15;
        const ex = cx + R * 1.75, ey = cy - R * 0.55;
        ctx.fillStyle = '#e7dccb'; ctx.beginPath(); ctx.arc(ex, ey, 6, 0, Math.PI * 2); ctx.fill();
        label('Europa', ex + 10, ey + 4);
        if (s.orbitId === 'europaOrbit') { ox = 18; oy = 8; tilt = 0; }
      }
      const ocx = s.body === 'jupiter' && s.orbitId === 'europaOrbit' ? cx + R * 1.75 : cx;
      const ocy = s.body === 'jupiter' && s.orbitId === 'europaOrbit' ? cy - R * 0.55 : cy;
      ctx.strokeStyle = 'rgba(217,164,65,0.6)'; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.ellipse(ocx, ocy, ox, oy, tilt, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      const speed = s.lost || reduced ? 0 : 0.6;
      const ang = s.lost ? 1.2 : t * speed;
      const px = ocx + ox * Math.cos(ang) * Math.cos(tilt) - oy * Math.sin(ang) * Math.sin(tilt);
      const py = ocy + ox * Math.cos(ang) * Math.sin(tilt) + oy * Math.sin(ang) * Math.cos(tilt);
      // Earth marker and signal
      const ex = 26, ey = 30;
      if (s.body !== 'earth') { planet(ex, ey, 7, 'earth'); label('to Earth', ex + 14, ey + 4); }
      if (!s.lost && s.scene !== 'end') {
        const k = (t % 2) / 2;
        const tx = s.body === 'earth' ? cx - R * 0.3 : ex, ty = s.body === 'earth' ? cy - R * 0.85 : ey;
        ctx.strokeStyle = '#d58cff'; ctx.globalAlpha = 1 - k; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(px + (tx - px) * k, py + (ty - py) * k, 3 + k * 4, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
      }
      craft(px, py, s.lost);
    }
    if (running && !reduced) raf = requestAnimationFrame(draw);
  }

  function set(next) {
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
