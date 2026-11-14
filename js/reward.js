// Mission patches and badges.
const BODY = { earth: ['#2a6fb3', '#4c9a5b'], moon: ['#9aa3ad', '#7d8691'], mars: ['#b5532e', '#7f3519'], jupiter: ['#c9a77c', '#8f6040'] };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const BADGES = [
  { id: 'first', name: 'First flight', text: 'Fly any mission.' },
  { id: 'success', name: 'Mission accomplished', text: 'Reach a science goal.' },
  { id: 'stars3', name: 'Three stars', text: 'Earn all three stars on a mission.' },
  { id: 'over', name: 'Overachiever', text: 'Deliver 150% of the science goal.' },
  { id: 'penny', name: 'Penny pincher', text: 'Finish with 30% of the budget left.' },
  { id: 'team', name: 'Dream team', text: 'Meet all four role goals in one mission.' },
  { id: 'fuel', name: 'Mostly fuel', text: 'Launch a spacecraft that is more than half propellant.' },
  { id: 'nuclear', name: 'Nuclear option', text: 'Fly with a nuclear power source.' },
  { id: 'surfer', name: 'Gravity surfer', text: 'Reach Jupiter using gravity assists.' },
  { id: 'tiny', name: 'Small but mighty', text: 'Succeed with a CubeSat.' },
  { id: 'backup', name: 'Saved by the backup', text: 'Survive a computer fault by switching to the spare.' },
  { id: 'lucky', name: 'Lucky dodge', text: 'Hold course through a debris alert and survive.' },
  { id: 'galileo', name: 'Better than Galileo', text: 'Shake a stuck antenna loose.' },
  { id: 'overtime', name: 'Overtime', text: 'Extend a healthy mission.' },
  { id: 'director', name: 'Flight Director', text: 'Succeed on Flight Director difficulty.' },
  { id: 'tour', name: 'Grand tour', text: 'Succeed at Earth, the Moon, Mars and Europa.' },
];

/** Which badges this flight earned. worlds = set of mission ids already succeeded, including this one. */
export function earnedBadges(rep, design, M, worlds) {
  const ok = rep.outcome === 'success';
  const has = (id, choice) => rep.events.some((e) => e.id === id && (!choice || e.choice.startsWith(choice)));
  const got = {
    first: true,
    success: ok,
    stars3: rep.stars === 3,
    over: rep.ratio >= 1.5,
    penny: rep.reserve >= 0.3 * rep.budget,
    team: Object.values(rep.goals).every(Boolean),
    fuel: isFinite(M.mass.propMass) && M.mass.propMass > 0.5 * M.mass.wetMass && !rep.lossCause?.match(/launch/),
    nuclear: M.L.power.kind === 'rtg' && rep.lossCause !== 'launch',
    surfer: M.L.trajectory === 'ga' && rep.yearsFlown > 0,
    tiny: ok && design.busId === 'cubesat',
    backup: rep.redundancyUsed,
    lucky: has('debris', 'Hold') && !rep.lost,
    galileo: rep.log.some((l) => l.text.includes('snapped open')),
    overtime: rep.extended > 0,
    director: ok && design.difficulty === 'director',
    tour: ['wildfire', 'moon', 'mars', 'europa'].every((m) => worlds.has(m)),
  };
  return BADGES.filter((b) => got[b.id]);
}

export function badgeSvg(id, on = true) {
  const i = BADGES.findIndex((b) => b.id === id);
  const hue = (i * 47) % 360;
  const fill = on ? `hsl(${hue} 55% 42%)` : '#1a2e4a';
  const ring = on ? '#d9a441' : '#2a4166';
  const glyphs = ['M12 6l2 5h5l-4 3 2 5-5-3-5 3 2-5-4-3h5z', 'M7 12l3 3 7-7', 'M12 5l2 4 4 1-3 3 1 4-4-2-4 2 1-4-3-3 4-1z',
    'M6 16l4-4 3 3 5-6', 'M12 6v12M8 9h6a2 2 0 010 4H10a2 2 0 000 4h6', 'M8 10a1.5 1.5 0 103 0 1.5 1.5 0 10-3 0M13 10a1.5 1.5 0 103 0 1.5 1.5 0 10-3 0M7.5 14.5c2 3 7 3 9 0',
    'M10 5h4v4l2 9H8l2-9z', 'M12 7a5 5 0 110 10 5 5 0 010-10M12 10v2', 'M5 15c4-8 10-8 14 0', 'M9 9h6v6H9z', 'M8 8h8v8H8zM5 11h3M16 11h3',
    'M6 12h12M12 6l6 6-6 6', 'M6 16a8 8 0 0112 0M12 16V9', 'M12 7v5l3 2', 'M7 17V7l10 5z', 'M5 12a7 7 0 1014 0 7 7 0 10-14 0M5 12h14'][i] || 'M12 8v8';
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="${fill}" stroke="${ring}" stroke-width="1.5"/><path d="${glyphs}" fill="none" stroke="${on ? '#f6efe0' : '#3a5276'}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

/** An embroidered-style mission patch. */
export function patchSvg({ missionName, body, team, objective, stars, year = 2026, success }) {
  const [c1, c2] = BODY[body];
  const top = esc(missionName.toUpperCase());
  const bottom = esc((team ? team : 'Solo flight').toUpperCase() + ` · ${year}`);
  const starRow = [0, 1, 2].map((i) => `<path transform="translate(${136 + i * 24} 238) scale(0.9)" d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.8-6.2 3.8 1.6-7L2 9.2l7.1-.6z" fill="${i < stars ? '#f0c46a' : 'none'}" stroke="#f0c46a" stroke-width="1.2"/>`).join('');
  const planet = body === 'jupiter'
    ? `<circle cx="160" cy="196" r="62" fill="${c1}"/><g clip-path="url(#pc)"><rect x="90" y="166" width="140" height="10" fill="${c2}"/><rect x="90" y="190" width="140" height="13" fill="${c2}"/><rect x="90" y="218" width="140" height="8" fill="${c2}"/></g><circle cx="222" cy="128" r="10" fill="#e7dccb"/>`
    : body === 'mars'
      ? `<circle cx="160" cy="196" r="62" fill="${c1}"/><g clip-path="url(#pc)"><ellipse cx="150" cy="190" rx="44" ry="9" fill="${c2}"/><ellipse cx="160" cy="138" rx="24" ry="7" fill="#efe6dc"/></g>`
      : body === 'moon'
        ? `<circle cx="160" cy="196" r="62" fill="${c1}"/><circle cx="140" cy="178" r="11" fill="${c2}"/><circle cx="182" cy="206" r="15" fill="${c2}"/><circle cx="158" cy="226" r="7" fill="${c2}"/>`
        : `<circle cx="160" cy="196" r="62" fill="${c1}"/><g clip-path="url(#pc)"><path d="M120 170 q22 -14 40 4 t34 6 q-8 18 -34 14 t-34 8 q-14 -12 -6 -32z" fill="${c2}"/><path d="M108 206 q52 18 104 -4" stroke="#e8edf4" stroke-width="5" fill="none" opacity=".6"/></g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" role="img" aria-label="Mission patch for ${esc(missionName)}">
<defs>
  <radialGradient id="bg" cx="50%" cy="38%" r="70%"><stop offset="0" stop-color="#1d3558"/><stop offset="1" stop-color="#0b1524"/></radialGradient>
  <clipPath id="pc"><circle cx="160" cy="196" r="62"/></clipPath>
  <clipPath id="inner"><circle cx="160" cy="160" r="112"/></clipPath>
  <path id="arcTop" d="M 40 160 A 120 120 0 0 1 280 160"/>
  <path id="arcBottom" d="M 30 160 A 130 130 0 0 0 290 160"/>
</defs>
<circle cx="160" cy="160" r="156" fill="#d9a441"/>
<circle cx="160" cy="160" r="150" fill="none" stroke="#8a6420" stroke-width="2" stroke-dasharray="4 3"/>
<circle cx="160" cy="160" r="136" fill="#13233a"/>
<circle cx="160" cy="160" r="112" fill="url(#bg)" stroke="#d9a441" stroke-width="3"/>
<g clip-path="url(#inner)">
  ${Array.from({ length: 26 }, (_, i) => `<circle cx="${60 + ((i * 67) % 200)}" cy="${60 + ((i * 41) % 110)}" r="${(i % 3) * 0.5 + 0.7}" fill="#e8edf4" opacity=".7"/>`).join('')}
  ${planet}
  <ellipse cx="160" cy="180" rx="104" ry="34" fill="none" stroke="#f0c46a" stroke-width="2" stroke-dasharray="6 5" transform="rotate(-14 160 180)"/>
  <g transform="translate(110 112) rotate(-14)">
    <rect x="-9" y="-9" width="18" height="18" fill="#f0c46a" stroke="#fff3c4"/>
    <rect x="-34" y="-4" width="22" height="8" fill="#5fb3ff"/><rect x="12" y="-4" width="22" height="8" fill="#5fb3ff"/>
    <path d="M-7 -11 Q0 -20 7 -11" fill="none" stroke="#e8edf4" stroke-width="2"/>
  </g>
  ${success ? '' : '<rect x="0" y="0" width="320" height="320" fill="#0b1524" opacity=".35"/>'}
</g>
<text font-family="'Barlow Condensed','Arial Narrow',sans-serif" font-weight="700" font-size="22" fill="#f6efe0" letter-spacing="3" text-anchor="middle"><textPath href="#arcTop" startOffset="50%">${top}</textPath></text>
<text font-family="'Barlow Condensed','Arial Narrow',sans-serif" font-weight="600" font-size="15" fill="#f6efe0" letter-spacing="2.5" text-anchor="middle" dominant-baseline="hanging"><textPath href="#arcBottom" startOffset="50%">${bottom}</textPath></text>
${starRow}
<title>${esc(objective)}</title>
</svg>`;
}

export function downloadSvg(svg, name) {
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  trigger(URL.createObjectURL(blob), `${name}.svg`);
}

export function downloadPng(svg, name, size = 1024) {
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  img.onload = () => {
    const c = document.createElement('canvas'); c.width = size; c.height = size;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0, size, size);
    URL.revokeObjectURL(url);
    c.toBlob((b) => trigger(URL.createObjectURL(b), `${name}.png`), 'image/png');
  };
  img.src = url;
}

function trigger(href, filename) {
  const a = document.createElement('a'); a.href = href; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 2000);
}
