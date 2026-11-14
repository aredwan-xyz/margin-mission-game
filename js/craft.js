// Draws the spacecraft as a blueprint-style SVG from the current design.
const BUS = { cubesat: [34, 44], small: [70, 62], medium: [96, 84], large: [126, 106] };

export function craftSvg(L, opts = {}) {
  const W = 400, H = 300, cx = 200, cy = 140;
  const [bw, bh] = BUS[L.bus.id];
  const x0 = cx - bw / 2, y0 = cy - bh / 2;
  const parts = [];
  const ids = new Set(L.instruments.map((i) => i.id));
  const title = opts.title || `Drawing of the spacecraft: ${L.bus.name}`;

  // Solar wings
  if (L.power.kind === 'solar') {
    const len = Math.min(24 + Math.sqrt(L.power.area) * 13, W / 2 - bw / 2 - 20);
    const wid = L.power.id === 'solar_xl' ? 34 : L.power.id === 'solar_l' ? 28 : L.bus.id === 'cubesat' ? 16 : 22;
    for (const side of [-1, 1]) {
      const yoke0 = side < 0 ? x0 : x0 + bw;
      const yoke1 = yoke0 + side * 14;
      const wx = side < 0 ? yoke1 - len : yoke1;
      parts.push(`<line x1="${yoke0}" y1="${cy}" x2="${yoke1}" y2="${cy}" class="c-strut"/>`);
      parts.push(`<rect x="${wx}" y="${cy - wid / 2}" width="${len}" height="${wid}" class="c-wing"/>`);
      const cells = Math.max(2, Math.round(len / 12));
      for (let i = 1; i < cells; i++) {
        const lx = wx + (len / cells) * i;
        parts.push(`<line x1="${lx}" y1="${cy - wid / 2}" x2="${lx}" y2="${cy + wid / 2}" class="c-cell"/>`);
      }
      parts.push(`<line x1="${wx}" y1="${cy}" x2="${wx + len}" y2="${cy}" class="c-cell"/>`);
    }
  }

  // RTGs on a boom
  if (L.power.kind === 'rtg') {
    const n = L.power.id === 'rtg3' ? 3 : 1;
    const bx = x0 - 46, by = y0 + bh + 18;
    parts.push(`<line x1="${x0 + 6}" y1="${y0 + bh - 6}" x2="${bx + 10}" y2="${by}" class="c-strut"/>`);
    for (let i = 0; i < n; i++) {
      const rx = bx - i * 22, ry = by - 14;
      parts.push(`<rect x="${rx}" y="${ry}" width="16" height="30" rx="3" class="c-rtg"/>`);
      for (let f = 0; f < 4; f++) parts.push(`<line x1="${rx - 4}" y1="${ry + 5 + f * 7}" x2="${rx + 20}" y2="${ry + 5 + f * 7}" class="c-fin"/>`);
    }
  }

  // Magnetometer boom
  if (ids.has('mag')) {
    parts.push(`<line x1="${x0 + bw}" y1="${y0 + 8}" x2="${x0 + bw + 70}" y2="${y0 - 34}" class="c-boom"/>`);
    parts.push(`<rect x="${x0 + bw + 66}" y="${y0 - 38}" width="8" height="8" class="c-inst"/>`);
  }
  // Radar dipoles
  if (ids.has('radar')) {
    parts.push(`<line x1="${cx - 6}" y1="${y0 + bh}" x2="${cx - 96}" y2="${y0 + bh + 62}" class="c-dipole"/>`);
    parts.push(`<line x1="${cx + 6}" y1="${y0 + bh}" x2="${cx + 96}" y2="${y0 + bh + 62}" class="c-dipole"/>`);
  }

  // Engine
  const ny = y0 + bh;
  if (L.prop.id === 'biprop') parts.push(`<path d="M${cx - 8} ${ny} L${cx - 18} ${ny + 26} L${cx + 18} ${ny + 26} L${cx + 8} ${ny} Z" class="c-nozzle"/>`);
  if (L.prop.id === 'mono' || L.prop.id === 'coldgas') {
    const s = L.prop.id === 'mono' ? 6 : 4;
    for (const dx of [-bw / 2 + 6, bw / 2 - 6]) parts.push(`<path d="M${cx + dx - 2} ${ny} L${cx + dx - s} ${ny + s + 4} L${cx + dx + s} ${ny + s + 4} L${cx + dx + 2} ${ny} Z" class="c-nozzle"/>`);
  }
  if (L.prop.id === 'ion') {
    parts.push(`<circle cx="${cx}" cy="${ny + 12}" r="13" class="c-ion"/>`);
    parts.push(`<circle cx="${cx}" cy="${ny + 12}" r="7" class="c-ion-core"/>`);
  }

  // Bus body in gold insulation foil
  parts.push(`<rect x="${x0}" y="${y0}" width="${bw}" height="${bh}" rx="2" class="c-bus"/>`);
  for (let i = 1; i < 4; i++) {
    const yy = y0 + (bh / 4) * i + (i % 2 ? 2 : -2);
    parts.push(`<path d="M${x0 + 3} ${yy} q ${bw / 4} ${i % 2 ? 4 : -4} ${bw / 2} 0 t ${bw / 2 - 6} 0" class="c-crinkle"/>`);
  }
  if (L.shield.id === 'vault') parts.push(`<rect x="${cx - bw / 4}" y="${cy - bh / 4}" width="${bw / 2}" height="${bh / 2}" class="c-vault"/>`);
  if (L.shield.id === 'light') parts.push(`<rect x="${cx - bw / 5}" y="${cy - bh / 5}" width="${(bw * 2) / 5}" height="${(bh * 2) / 5}" class="c-light"/>`);

  // Instruments on the front face
  const face = L.instruments.filter((i) => !['mag', 'radar'].includes(i.id));
  face.forEach((inst, i) => {
    const ix = x0 + 6 + i * Math.min(18, (bw - 12) / Math.max(1, face.length));
    const iy = y0 + bh - 18;
    if (inst.type === 'imaging') parts.push(`<circle cx="${ix + 6}" cy="${iy + 6}" r="${inst.id === 'hirescam' ? 7 : 5}" class="c-lens ${inst.id === 'thermal' ? 'c-thermal' : ''}"/>`);
    else parts.push(`<rect x="${ix}" y="${iy}" width="12" height="12" class="c-inst"/>`);
  });
  if (L.instruments.length === 0 && opts.hint !== false) {
    parts.push(`<text x="${cx}" y="${y0 + bh + 54}" class="c-hint" text-anchor="middle">No instruments yet</text>`);
  }

  // Antenna on top
  const ty = y0;
  if (L.antenna.id === 'lga') parts.push(`<line x1="${cx}" y1="${ty}" x2="${cx}" y2="${ty - 16}" class="c-strut"/><circle cx="${cx}" cy="${ty - 19}" r="4" class="c-dish"/>`);
  else {
    const r = { mga: 14, hga1: 24, hga25: 46 }[L.antenna.id];
    const stem = 6 + r * 0.25;
    parts.push(`<line x1="${cx}" y1="${ty}" x2="${cx}" y2="${ty - stem}" class="c-strut"/>`);
    parts.push(`<path d="M${cx - r} ${ty - stem - r * 0.45} Q ${cx} ${ty - stem + r * 0.25} ${cx + r} ${ty - stem - r * 0.45} Z" class="c-dish"/>`);
    parts.push(`<line x1="${cx - r * 0.8}" y1="${ty - stem - r * 0.35}" x2="${cx}" y2="${ty - stem - r * 0.75}" class="c-feed"/><line x1="${cx + r * 0.8}" y1="${ty - stem - r * 0.35}" x2="${cx}" y2="${ty - stem - r * 0.75}" class="c-feed"/>`);
  }
  if (opts.redundancy) parts.push(`<rect x="${x0 + bw - 14}" y="${y0 + 4}" width="10" height="7" class="c-backup"/><rect x="${x0 + bw - 14}" y="${y0 + 13}" width="10" height="7" class="c-backup"/>`);

  // Dimension line with launch mass
  if (opts.massLabel) {
    const dy = H - 18;
    parts.push(`<line x1="60" y1="${dy}" x2="340" y2="${dy}" class="c-dim"/><line x1="60" y1="${dy - 5}" x2="60" y2="${dy + 5}" class="c-dim"/><line x1="340" y1="${dy - 5}" x2="340" y2="${dy + 5}" class="c-dim"/>`);
    parts.push(`<rect x="${cx - 70}" y="${dy - 11}" width="140" height="22" class="c-dimbg"/><text x="${cx}" y="${dy + 5}" class="c-dimtext" text-anchor="middle">${opts.massLabel}</text>`);
  }

  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeAttr(title)}" xmlns="http://www.w3.org/2000/svg">
<style>
.c-bus{fill:url(#foil);stroke:#f7dfa6;stroke-width:1.2}
.c-crinkle{fill:none;stroke:#8a6420;stroke-width:.8;opacity:.6}
.c-wing{fill:#1d3d78;stroke:#9ec3ff;stroke-width:1}
.c-cell{stroke:#9ec3ff;stroke-width:.5;opacity:.55}
.c-strut,.c-boom{stroke:#c9d4e3;stroke-width:1.6}
.c-boom{stroke-dasharray:4 3}
.c-dipole{stroke:#c9d4e3;stroke-width:1}
.c-dish{fill:#e8edf4;stroke:#9aabc2;stroke-width:1}
.c-feed{stroke:#9aabc2;stroke-width:.8}
.c-nozzle{fill:#5b6b82;stroke:#c9d4e3;stroke-width:1}
.c-ion{fill:none;stroke:#7fd3ff;stroke-width:2}
.c-ion-core{fill:#7fd3ff;opacity:.55}
.c-rtg{fill:#4a5568;stroke:#c9d4e3;stroke-width:1}
.c-fin{stroke:#c9d4e3;stroke-width:1}
.c-inst{fill:#24395a;stroke:#e8edf4;stroke-width:1}
.c-lens{fill:#0e1a2b;stroke:#e8edf4;stroke-width:1.4}
.c-thermal{stroke:#f08a3c}
.c-vault{fill:none;stroke:#7a5a1c;stroke-width:2;stroke-dasharray:3 2}
.c-light{fill:none;stroke:#7a5a1c;stroke-width:1.2}
.c-backup{fill:#24395a;stroke:#4fbf8b;stroke-width:1}
.c-dim{stroke:#9aabc2;stroke-width:1}
.c-dimbg{fill:#13233a}
.c-dimtext{fill:#e8edf4;font:600 14px Barlow, system-ui, sans-serif}
.c-hint{fill:#9aabc2;font:15px Barlow, system-ui, sans-serif}
</style>
<defs><linearGradient id="foil" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f3cf7d"/><stop offset=".55" stop-color="#d9a441"/><stop offset="1" stop-color="#a87a26"/></linearGradient></defs>
${parts.join('\n')}
</svg>`;
}

function escapeAttr(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

/** Small illustration of each destination for the mission cards. */
export function destinationSvg(body, label) {
  const bodies = {
    earth: `<circle cx="200" cy="150" r="78" fill="#2a6fb3"/><path d="M150 112 q30 -18 52 4 t40 10 q-10 22 -40 18 t-40 10 q-20 -14 -12 -42z" fill="#4c9a5b"/><path d="M135 168 q40 18 90 -6" stroke="#e8edf4" stroke-width="5" fill="none" opacity=".7"/><ellipse cx="200" cy="150" rx="128" ry="34" fill="none" stroke="#d9a441" stroke-width="1.5" stroke-dasharray="5 4" transform="rotate(-18 200 150)"/>`,
    moon: `<circle cx="200" cy="150" r="80" fill="#9aa3ad"/><circle cx="172" cy="122" r="14" fill="#7d8691"/><circle cx="226" cy="170" r="20" fill="#7d8691"/><circle cx="210" cy="112" r="7" fill="#7d8691"/><circle cx="200" cy="222" r="10" fill="#3c4450"/><ellipse cx="200" cy="150" rx="30" ry="112" fill="none" stroke="#d9a441" stroke-width="1.5" stroke-dasharray="5 4"/>`,
    mars: `<circle cx="200" cy="150" r="80" fill="#b5532e"/><path d="M140 140 q30 -20 70 0 t60 -6" stroke="#7f3519" stroke-width="12" fill="none" opacity=".7"/><ellipse cx="200" cy="80" rx="30" ry="9" fill="#efe6dc"/><ellipse cx="200" cy="150" rx="132" ry="40" fill="none" stroke="#d9a441" stroke-width="1.5" stroke-dasharray="5 4" transform="rotate(12 200 150)"/>`,
    jupiter: `<circle cx="170" cy="150" r="86" fill="#c9a77c"/><rect x="84" y="112" width="172" height="12" fill="#a0714a"/><rect x="84" y="150" width="172" height="16" fill="#8f6040"/><rect x="84" y="184" width="172" height="8" fill="#a0714a"/><ellipse cx="200" cy="172" rx="14" ry="8" fill="#b4523a"/><circle cx="318" cy="96" r="13" fill="#e7dccb"/><path d="M312 92 l10 8 M314 100 l8 -6" stroke="#a0714a" stroke-width="1.2"/><ellipse cx="200" cy="140" rx="160" ry="52" fill="none" stroke="#d9a441" stroke-width="1.5" stroke-dasharray="5 4" transform="rotate(-10 200 140)"/>`,
  };
  const clip = body === 'jupiter' ? '<clipPath id="jc"><circle cx="170" cy="150" r="86"/></clipPath>' : '';
  let inner = bodies[body];
  if (body === 'jupiter') inner = inner.replace(/<rect /g, '<rect clip-path="url(#jc)" ');
  return `<svg viewBox="0 0 400 300" class="art" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${escapeAttr(label)}" xmlns="http://www.w3.org/2000/svg"><defs>${clip}</defs><rect width="400" height="300" fill="#0b1524"/>${stars()}${inner}</svg>`;
}

function stars() {
  let s = '', seed = 7;
  const r = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 40; i++) s += `<circle cx="${Math.round(r() * 400)}" cy="${Math.round(r() * 300)}" r="${(r() * 1.2 + 0.3).toFixed(1)}" fill="#e8edf4" opacity="${(r() * 0.6 + 0.2).toFixed(2)}"/>`;
  return s;
}
