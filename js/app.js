import * as D from './data.js';
import {
  evaluate, newDesign, sanitize, compat, lookup, encodeDesign, decodeDesign, dataRate, scienceOf, powerAt,
  launcherCapacity, cruiseYears, fmtMoney, fmtData, fmtRate, mission as getMission, CATEGORIES,
} from './model.js';
import { createMission, randomSeed } from './sim.js';
import { craftSvg, destinationSvg } from './craft.js';
import { createViz } from './viz.js';

// ---------------------------------------------------------------- state
const app = {
  screen: 'home', mode: 'solo', difficulty: 'engineer', design: null, tab: 'planner',
  team: { name: '', owners: { planner: '', engineer: '', science: '', comms: '' } },
  signoff: {}, seed: null, report: null, speed: 1, skipping: false, runId: 0, viz: null, saved: false,
};
const root = document.getElementById('app');
const dialog = document.getElementById('dialog');
const byId = (list, id) => list.find((x) => x.id === id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pct = (x) => `${Math.round(x * 100)}%`;
const kg = (x) => `${Math.round(x).toLocaleString('en-US')} kg`;
const ROLE = Object.fromEntries(D.ROLES.map((r) => [r.id, r]));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const store = {
  get(k, fallback) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage may be blocked */ } },
};
const SCORE_KEY = 'margin.scores.v1';

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.timer); toast.timer = setTimeout(() => t.classList.remove('show'), 2600);
}

function go(screen) {
  if (app.viz) { app.viz.destroy(); app.viz = null; }
  if (screen !== 'sim') app.runId++;
  app.screen = screen;
  render();
  window.scrollTo(0, 0);
  const h = root.querySelector('h1, h2');
  if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
}

function ownerName(role) {
  if (app.mode !== 'team') return '';
  return app.team.owners[role] || '';
}

// ---------------------------------------------------------------- render
function render() {
  const screens = { home, team, missions, design, review, sim, debrief };
  root.innerHTML = screens[app.screen]();
  if (app.screen === 'sim') startSim();
}

const logo = `<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="10" y="10" width="12" height="12" fill="#d9a441"/><rect x="1" y="14" width="8" height="4" fill="#5fb3ff"/><rect x="23" y="14" width="8" height="4" fill="#5fb3ff"/><path d="M11 9 Q16 4 21 9" fill="none" stroke="#e8edf4" stroke-width="1.6"/></svg>`;

function topbar(extra = '') {
  const m = app.design ? getMission(app.design.missionId) : null;
  const diff = byId(D.DIFFICULTY, app.difficulty);
  return `<header class="topbar"><div class="wrap">
    <button class="wordmark" data-act="home" aria-label="Margin, back to the start">${logo}Margin</button>
    ${m ? `<span class="where"><strong>${esc(m.name)}</strong>, ${esc(diff.name)}${app.mode === 'team' && app.team.name ? `, team ${esc(app.team.name)}` : ''}</span>` : ''}
    <span class="spacer"></span>
    ${extra}
    <button class="btn small ghost" data-act="learn">How it works</button>
  </div></header>`;
}

// ---------------------------------------------------------------- home
function home() {
  const sample = newDesign('europa');
  Object.assign(sample, { busId: 'medium', powerId: 'solar_xl', antennaId: 'hga25', propulsionId: 'biprop', shieldingId: 'vault', instruments: ['mag', 'radar', 'hirescam', 'thermal'] });
  const diff = byId(D.DIFFICULTY, app.difficulty);
  return `<section class="home"><div class="wrap">
    <div class="home-grid">
      <div>
        <h1>Margin</h1>
        <p class="lede">Design a space mission, fly it, and find out what your choices did.</p>
        <p class="sub">Every part you add costs mass, power, money and data. Plan the orbit, build the spacecraft, choose the instruments and the radio, then launch. Play alone, or as a team of up to four with each person in a different role.</p>
        <div class="start">
          <button class="btn primary big" data-act="solo">Play solo</button>
          <button class="btn big" data-act="team">Play as a team</button>
        </div>
        <fieldset class="difficulty">
          <legend>Difficulty</legend>
          <div class="seg" role="radiogroup">
            ${D.DIFFICULTY.map((d) => `<label><input type="radio" name="diff" value="${d.id}" ${d.id === app.difficulty ? 'checked' : ''}><span>${d.name}</span></label>`).join('')}
          </div>
          <p class="seg-note" id="diff-note">${esc(diff.text)}</p>
        </fieldset>
      </div>
      <div class="home-craft">${craftSvg(lookup(sample), { title: 'A Europa explorer with giant solar wings, a large dish and a radiation vault', hint: false })}</div>
    </div>
    <div class="home-how">
      <div><span class="stepnum">1</span><h3>Pick a mission</h3><p>From watching wildfires on Earth to exploring the ocean under Europa's ice.</p></div>
      <div><span class="stepnum">2</span><h3>Design it</h3><p>Choose the orbit, rocket, spacecraft, power, instruments and radio. Every gauge updates as you go.</p></div>
      <div><span class="stepnum">3</span><h3>Pass the review</h3><p>Each role checks its numbers and signs off, just like a real design review.</p></div>
      <div><span class="stepnum">4</span><h3>Fly it</h3><p>Launch, cruise and operate. Handle the surprises, then read the mission report.</p></div>
    </div>
  </div></section>`;
}

// ---------------------------------------------------------------- team
function team() {
  return `${topbar()}<section class="page"><div class="wrap">
    <h2>Set up your team</h2>
    <p class="intro">Up to four people. Each role owns part of the design and has its own goal, and the goals pull against each other, so you will need to negotiate. One person can take two roles.</p>
    <div class="field team-name"><label for="team-name">Team name</label><input id="team-name" maxlength="40" value="${esc(app.team.name)}" placeholder="For example, Iceberg Alley"></div>
    <div class="roles-form">
      ${D.ROLES.map((r) => `<div class="role-card" style="--role:${r.colour}">
        <h3>${r.name}</h3>
        <p>Owns ${r.owns.toLowerCase()}.</p>
        <p class="goal">Goal: ${r.goal}</p>
        <div class="field"><label for="owner-${r.id}">Who takes this role?</label><input id="owner-${r.id}" data-owner="${r.id}" maxlength="30" value="${esc(app.team.owners[r.id])}" placeholder="Name"></div>
      </div>`).join('')}
    </div>
    <div class="actions"><button class="btn primary big" data-act="team-done">Choose a mission</button><button class="btn" data-act="home">Back</button></div>
  </div></section>`;
}

// ---------------------------------------------------------------- missions
function missions() {
  const diff = byId(D.DIFFICULTY, app.difficulty);
  const scores = store.get(SCORE_KEY, {});
  return `${topbar()}<section class="page"><div class="wrap">
    <h2>Choose a mission</h2>
    <p class="intro">Each one has two possible objectives and several ways to succeed. Start with Wildfire Watch if this is your first time.</p>
    <div class="missions">
      ${D.MISSIONS.map((m) => {
        const best = Object.entries(scores).filter(([k]) => k.startsWith(`${m.id}.`)).flatMap(([, v]) => v).sort((a, b) => b.score - a.score)[0];
        return `<button class="mission" data-mission="${m.id}">
          ${destinationSvg(m.body, `${m.place}`)}
          <span class="body">
            <span class="level">${m.level}</span>
            <h3>${m.name}</h3>
            <span class="tag">${m.tagline}</span>
            <dl>
              <dt>Budget</dt><dd>${fmtMoney(m.budget * diff.budgetMult)}${diff.id === 'sandbox' ? ' (sandbox)' : ''}</dd>
              <dt>Science</dt><dd>${m.opsYears} years</dd>
              <dt>Watch out</dt><dd>${m.keyChallenge}</dd>
            </dl>
            ${best ? `<span class="best">Best score here: ${best.score.toLocaleString('en-US')} by ${esc(best.name)}</span>` : ''}
          </span>
        </button>`;
      }).join('')}
    </div>
    <div class="actions"><button class="btn" data-act="home">Back</button></div>
  </div></section>`;
}

// ---------------------------------------------------------------- design
const TABS = [
  { id: 'planner', label: 'Mission plan' },
  { id: 'engineer', label: 'Spacecraft' },
  { id: 'science', label: 'Science' },
  { id: 'comms', label: 'Communications' },
];

function design() {
  const s = app.design;
  const M = evaluate(s);
  const L = M.L;
  const role = ROLE[app.tab];
  const counts = Object.fromEntries(TABS.map((t) => [t.id, M.checks.filter((c) => c.role === t.id && c.level !== 'ok')]));
  return `${topbar(`<button class="btn small ghost" data-act="share">Copy share link</button>`)}
  <div class="wrap"><div class="design">
    <div>
      <div class="tabs" role="tablist" aria-label="Roles">
        ${TABS.map((t) => {
          const issues = counts[t.id];
          const fails = issues.filter((c) => c.level === 'fail').length;
          return `<button class="tab" role="tab" id="tab-${t.id}" aria-controls="panel" aria-selected="${t.id === app.tab}" data-tab="${t.id}" style="--role:${ROLE[t.id].colour}">
            <span class="dot" aria-hidden="true"></span>${t.label}${ownerName(t.id) ? `<span class="visually-hidden">, ${esc(ownerName(t.id))}</span>` : ''}
            ${issues.length ? `<span class="count ${fails ? '' : 'warn'}" aria-label="${issues.length} issues">${issues.length}</span>` : ''}
          </button>`;
        }).join('')}
      </div>
      <div id="panel" role="tabpanel" aria-labelledby="tab-${app.tab}">
        <div class="role-head" style="--role:${role.colour}">
          <h2>${TABS.find((t) => t.id === app.tab).label}</h2>
          <p>${role.name}${ownerName(app.tab) ? `: ${esc(ownerName(app.tab))}` : ''}. Owns ${role.owns.toLowerCase()}.</p>
          <p class="goal ${M.roleGoals[app.tab] ? 'met' : ''}">Role goal: ${role.goal} ${M.roleGoals[app.tab] ? 'Met right now.' : 'Not met yet.'}</p>
        </div>
        ${tabContent(s, M)}
      </div>
      <div class="design-foot">
        <button class="btn" data-act="missions">Change mission</button>
        <button class="btn primary big" data-act="review">Go to the design review</button>
      </div>
    </div>
    ${sheet(s, M)}
  </div></div>
  ${miniStatus(M)}`;
}

function miniStatus(M) {
  const items = [
    ['Budget', statusOf(M, ['budget']), fmtMoney(M.cost.total)],
    ['Mass', statusOf(M, ['launch', 'bus', 'fuel']), isFinite(M.mass.launchMass) ? kg(M.mass.launchMass) : 'too heavy'],
    ['Power', statusOf(M, ['power', 'battery', 'ion']), `${Math.round(M.power.genEnd)} W`],
    ['Data', statusOf(M, ['data']), M.data.produced ? pct(M.data.dataFactor) : 'none'],
    ['Science', statusOf(M, ['science', 'requirement', 'engine']), `${M.science.expected.toFixed(1)}/${M.science.target}`],
  ];
  return `<a class="mini-status" href="#status" aria-label="Jump to the mission status">${items.map(([k, st, v]) => `<span class="${st}"><span class="k">${k}</span>${v}</span>`).join('')}</a>`;
}

function chips(list) {
  return `<span class="chips">${list.filter(Boolean).map(([k, v, hi]) => `<span><span class="k">${k}</span> <span class="${hi ? 'hi' : ''}">${v}</span></span>`).join('')}</span>`;
}

function optCard(cat, opt, selected, chipList, multi = false) {
  const c = compat(app.design, cat === 'instruments' ? 'instrument' : cat, opt);
  const roleAttr = multi ? `aria-pressed="${selected}"` : `role="radio" aria-checked="${selected}"`;
  return `<button class="opt" ${roleAttr} data-cat="${cat}" data-id="${opt.id}" ${c.ok ? '' : 'disabled'}>
    <span class="name">${esc(opt.name)}<span class="tick" aria-hidden="true"></span></span>
    ${opt.text ? `<span class="desc">${esc(opt.text)}</span>` : ''}
    ${chips(chipList)}
    ${c.ok ? '' : `<span class="why">${esc(c.reason)}</span>`}
  </button>`;
}

function group(title, text, inner, radio = true) {
  return `<section class="group"><h3>${title}</h3>${text ? `<p>${text}</p>` : ''}<div class="opts" ${radio ? `role="radiogroup" aria-label="${esc(title)}"` : ''}>${inner}</div></section>`;
}

function tabContent(s, M) {
  const L = M.L;
  const m = L.mission;
  const what = (patch) => evaluate({ ...s, ...patch });
  if (app.tab === 'planner') {
    const objectives = m.objectives.map((o) => `<button class="opt" role="radio" aria-checked="${o.id === s.objectiveId}" data-cat="objective" data-id="${o.id}">
      <span class="name">${esc(o.name)}<span class="tick" aria-hidden="true"></span></span>
      <span class="desc">${esc(o.text)}</span>
      ${chips([['Science goal', `${o.target} points`]])}
      <span class="desc">Requirement: ${esc(o.requiredText)}</span>
    </button>`).join('');
    const orbits = m.orbits.map((id) => byId(D.ORBITS, id)).map((o) => optCard('orbit', o, o.id === s.orbitId, [
      ['Arrival burn', o.dv ? `${o.dv.toFixed(1)} km/s` : 'none'],
      ['Radiation', `${o.radiation}× low Earth orbit`],
      ['Pictures', o.sci.imaging >= 1.2 ? 'sharp' : o.sci.imaging >= 0.9 ? 'normal' : 'blurry'],
    ])).join('');
    const traj = m.cruiseYears.ga !== undefined ? group('Route to Jupiter', '', D.TRAJECTORIES.map((t) => optCard('trajectory', t, t.id === L.trajectory, [
      ['Travel time', `${m.cruiseYears[t.id]} years`],
      ['Rocket can lift', t.id === 'ga' ? '2× more' : 'normal'],
    ])).join('')) : '';
    const launchers = D.LAUNCHERS.map((l) => {
      const cap = launcherCapacity(l, L.orbit, L.trajectory);
      return optCard('launcher', l, l.id === s.launcherId, [
        ['Can carry here', cap ? kg(cap) : 'cannot reach', cap && cap >= M.mass.launchMass],
        ['Cost', l.perKg ? `${fmtMoney(Math.max(l.minCost, M.mass.launchMass * l.perKg))} for your mass` : fmtMoney(l.cost)],
        ['Success rate', pct(1 - l.failRate)],
      ]);
    }).join('');
    const tests = D.TESTING.map((t) => optCard('testing', t, t.id === s.testingId, [
      ['Build time', `${t.devYears} years`],
      ['Chance of faults', t.risk > 1 ? 'higher' : t.risk < 1 ? 'lower' : 'normal'],
      ['Extra cost', `${Math.round(30 * t.wrapMult)}% of hardware`],
    ])).join('');
    return group('Objective', 'What is this mission for? The objective decides which instruments matter.', objectives)
      + group('Orbit', 'Where the spacecraft will work. Closer means sharper data but usually more fuel, drag or radiation.', orbits)
      + traj
      + group('Launcher', `The rocket must be able to lift your whole spacecraft, fuel included (${kg(M.mass.launchMass)} right now).`, launchers)
      + group('Testing', 'More testing costs time and money and catches problems on the ground.', tests);
  }
  if (app.tab === 'engineer') {
    const buses = D.BUSES.map((b) => optCard('bus', b, b.id === s.busId, [
      ['Room for parts', kg(b.maxAdd)], ['Fuel tanks', kg(b.maxProp)], ['Uses', `${b.basePower} W`], ['Cost', fmtMoney(b.cost)],
    ])).join('');
    const powers = D.POWER.map((p) => {
      const out = powerAt({ ...L, power: p }, cruiseYears(L));
      return optCard('power', p, p.id === s.powerId, [
        ['Makes here', `${Math.round(out)} W`, out >= M.power.required], ['Mass', kg(p.mass)], ['Cost', fmtMoney(p.cost)],
      ]);
    }).join('');
    const batts = D.BATTERIES.map((b) => optCard('battery', b, b.id === s.batteryId, [
      ['Holds', `${b.wh.toLocaleString('en-US')} Wh`, b.wh >= M.power.batteryNeed], ['Mass', kg(b.mass)], ['Cost', fmtMoney(b.cost)],
    ])).join('');
    const props = D.PROPULSION.map((p) => {
      const W = p.id === s.propulsionId ? M : what({ propulsionId: p.id });
      const fuel = p.isp === 0 ? 'cannot change orbit' : !W.mass.rocketOk ? 'impossible' : kg(W.mass.propMass);
      return optCard('propulsion', p, p.id === s.propulsionId, [
        ['Fuel for this trip', fuel, p.isp > 0 && W.mass.rocketOk && W.mass.propMass <= W.mass.maxProp], ['Efficiency', p.isp ? `${p.isp} s` : 'none'], ['Cost', fmtMoney(p.cost)],
      ]);
    }).join('');
    const shields = D.SHIELDING.map((sh) => optCard('shielding', sh, sh.id === s.shieldingId, [
      ['Blocks', `${Math.round((1 - sh.factor) * 100)}% of radiation damage`], ['Mass', kg(sh.mass)], ['Cost', fmtMoney(sh.cost)],
    ])).join('');
    const backup = `<button class="opt" aria-pressed="${!!s.redundancy}" data-cat="redundancy" data-id="toggle">
      <span class="name">Backup computer and radio<span class="tick" aria-hidden="true"></span></span>
      <span class="desc">If the main computer fails, the spacecraft switches to the spare and carries on.</span>
      ${chips([['Mass', kg(L.bus.redundancyMass)], ['Cost', fmtMoney(L.bus.cost * 0.1 + 1)]])}
    </button>`;
    return group('Spacecraft size', 'The bus is the body: structure, computer, pointing control and heaters. Bigger carries more and costs more to build and run.', buses)
      + group('Power', `The spacecraft needs about ${Math.round(M.power.required)} W. ${L.mission.sunAU > 1.1 ? `At ${L.mission.place} sunlight is ${(L.mission.sunAU ** 2).toFixed(1)} times weaker than at Earth.` : ''}`, powers)
      + group('Battery', `Carries the spacecraft through orbit nights. Needs about ${Math.round(M.power.batteryNeed)} Wh.`, batts)
      + group('Propulsion', `This mission needs ${M.mass.dvNeed.toFixed(2)} km/s of speed changes: braking into orbit, keeping it, and a safe ending.`, props)
      + group('Radiation protection', `Radiation here is ${L.orbit.radiation} times what a satellite meets in low Earth orbit.`, shields)
      + group('Backup systems', '', backup, false);
  }
  if (app.tab === 'science') {
    const insts = D.INSTRUMENTS.map((i) => optCard('instruments', i, s.instruments.includes(i.id), [
      ['Science here', scienceOf(L, i).toFixed(1), scienceOf(L, i) >= 3], ['Mass', kg(i.mass)], ['Power', `${i.power} W`], ['Data', `${fmtData(i.data)}/day`], ['Cost', fmtMoney(i.cost)],
    ], true)).join('');
    return group('Instruments', `Pick any combination. "Science here" is how useful each one is for <strong>${esc(L.objective.name.toLowerCase())}</strong> from this orbit. You need ${L.objective.target} points. Requirement: ${esc(L.objective.requiredText)}`, insts, false);
  }
  const ants = D.ANTENNAS.map((a) => {
    const r = dataRate({ ...L, antenna: a });
    return optCard('antenna', a, a.id === s.antennaId, [
      ['Gets home', `${fmtData(r.mbPerDay)}/day`, r.mbPerDay >= M.data.produced && M.data.produced > 0], ['Uses', `${a.power} W`], ['Mass', kg(a.mass)], ['Cost', fmtMoney(a.cost)],
    ]);
  }).join('');
  const grounds = D.GROUND.map((g) => {
    const r = dataRate({ ...L, ground: g });
    return optCard('ground', g, g.id === s.groundId, [
      ['Gets home', `${fmtData(r.mbPerDay)}/day`, r.mbPerDay >= M.data.produced && M.data.produced > 0], ['Contact', `${Math.min(24, g.hours * (L.orbit.contactMult || 1))} h/day`], ['Cost', `${fmtMoney(g.costPerYear)} a year`],
    ]);
  }).join('');
  const dist = L.orbit.distanceKm >= 1e6 ? `${Math.round(L.orbit.distanceKm / 1e6).toLocaleString('en-US')} million km` : `${Math.round(L.orbit.distanceKm).toLocaleString('en-US')} km`;
  return group('Spacecraft antenna', `Your instruments make ${fmtData(M.data.produced)} a day. The signal travels about ${dist}, and its strength falls with the square of the distance.`, ants)
    + group('Ground stations', 'Bigger dishes on Earth catch weaker signals. Contact time is how many hours a day you can talk to the spacecraft.', grounds);
}

function gauge(label, used, limit, status, valueHtml, note, opts = {}) {
  const max = Math.max(used, limit, 1e-9) * 1.08;
  const fw = Math.max(0, Math.min(100, (used / max) * 100));
  const lw = Math.max(0, Math.min(100, (limit / max) * 100));
  const marginBand = !opts.moreIsBetter && used < limit ? `<span class="margin" style="left:${fw}%;width:${lw - fw}%"></span>` : '';
  return `<div class="gauge ${status}">
    <div class="top"><span class="label">${label}</span><span class="value">${valueHtml}</span></div>
    <div class="bar" aria-hidden="true"><span class="fill" style="width:${fw}%"></span>${marginBand}<span class="limit" style="left:calc(${lw}% - 1px)"></span></div>
    ${note ? `<div class="note">${note}</div>` : ''}
  </div>`;
}

const statusOf = (M, ids) => {
  const cs = M.checks.filter((c) => ids.includes(c.id));
  return cs.some((c) => c.level === 'fail') ? 'fail' : cs.some((c) => c.level === 'warn') ? 'warn' : 'ok';
};

function sheet(s, M) {
  const L = M.L;
  const c = M.cost, ms = M.mass, p = M.power, d = M.data, sc = M.science, tl = M.timeline;
  const issues = M.checks.filter((x) => x.level !== 'ok').sort((a, b) => (a.level === 'fail' ? -1 : 1) - (b.level === 'fail' ? -1 : 1));
  const total = tl.end;
  const seg = (cls, yrs, label) => (yrs > 0.01 ? `<span class="${cls}" style="flex:${yrs}" title="${label}: ${yrs.toFixed(1)} years">${yrs / total > 0.12 ? label : ''}</span>` : '');
  return `<aside class="sheet" id="status" aria-label="Mission status">
    <div class="sheet-craft">${craftSvg(L, { massLabel: isFinite(ms.launchMass) ? `${kg(ms.launchMass)} at launch` : 'too heavy to launch', redundancy: s.redundancy })}</div>
    <div class="sheet-body">
      <div class="sheet-title"><h3>${esc(L.mission.name)}</h3><span class="objective">${esc(L.objective.name)}, ${esc(L.orbit.name)}</span></div>
      <div class="gauges">
        ${gauge('Budget', c.total, c.budget, statusOf(M, ['budget']), `<strong>${fmtMoney(c.total)}</strong> of ${fmtMoney(c.budget)}`, c.reserve >= 0 ? `${fmtMoney(c.reserve)} in reserve` : `${fmtMoney(-c.reserve)} over`)}
        ${gauge('Launch mass', isFinite(ms.launchMass) ? ms.launchMass : ms.capacity * 2, ms.capacity || 1, statusOf(M, ['launch']), `<strong>${isFinite(ms.launchMass) ? kg(ms.launchMass) : '∞'}</strong> of ${kg(ms.capacity)}`, ms.propMass > 0 && isFinite(ms.propMass) ? `${pct(ms.propMass / ms.wetMass)} of it is propellant` : '')}
        ${gauge('Room in the spacecraft', ms.added, ms.maxAdd, statusOf(M, ['bus', 'fuel']), `<strong>${kg(ms.added)}</strong> of ${kg(ms.maxAdd)}`, '')}
        ${gauge('Power at end of mission', p.required, p.genEnd, statusOf(M, ['power', 'battery', 'ion']), `needs <strong>${Math.round(p.required)} W</strong>, makes ${Math.round(p.genEnd)} W`, '')}
        ${d.produced > 0 ? gauge('Data per day', d.produced, d.mbPerDay, statusOf(M, ['data']), `makes <strong>${fmtData(d.produced)}</strong>, sends ${fmtData(d.mbPerDay)}`, `${fmtRate(d.bps)} for ${d.hours} h a day`) : ''}
        ${gauge('Expected science', sc.expected, sc.target, statusOf(M, ['science', 'requirement', 'engine']), `<strong>${sc.expected.toFixed(1)}</strong> of ${sc.target} points`, '', { moreIsBetter: true })}
      </div>
      <dl class="spec">
        <div><dt>Risk of loss</dt><dd>${M.risk.level}, ${pct(M.risk.lossChance)}</dd></div>
        <div><dt>Propellant</dt><dd>${isFinite(ms.propMass) ? kg(ms.propMass) : 'impossible'}</dd></div>
        <div><dt>Mission ends</dt><dd>year ${tl.end.toFixed(1)}</dd></div>
      </dl>
      <div>
        <div class="timeline-strip" aria-label="Timeline in years">
          ${seg('ts-dev', tl.devYears, 'Build')}${seg('ts-wait', tl.wait, 'Wait')}${seg('ts-cruise', tl.cruise, 'Cruise')}${seg('ts-aero', tl.aero, 'Brake')}${seg('ts-ops', tl.ops, 'Science')}
        </div>
      </div>
      <div class="issues" aria-live="polite">
        ${issues.length ? issues.slice(0, 6).map((x) => `<div class="issue ${x.level}"><span class="ico" aria-hidden="true"></span><div><button class="linkbtn" data-tab="${x.role}">${esc(x.title)}</button> <span class="role-tag">${ROLE[x.role].short}</span></div></div>`).join('') : '<div class="issue ok"><span class="ico" aria-hidden="true"></span><div>No problems found. Time for the review.</div></div>'}
        ${issues.length > 6 ? `<p class="role-tag">And ${issues.length - 6} more in the review.</p>` : ''}
      </div>
    </div>
  </aside>`;
}

// ---------------------------------------------------------------- review
function review() {
  const M = evaluate(app.design);
  const team = app.mode === 'team';
  const allSigned = D.ROLES.every((r) => app.signoff[r.id]);
  const canGo = M.canLaunch && (!team || allSigned);
  const hard = M.checks.filter((c) => c.hard && c.level === 'fail');
  return `${topbar()}<section class="page"><div class="wrap">
    <h2>Design review</h2>
    <p class="intro">Real missions pass a series of reviews before they are allowed to fly. Read each role's findings. Red items will hurt the mission; a few of them stop it from launching at all.${team ? ' Every role must sign off before launch.' : ''}</p>
    <div class="verdict">
      <p>${hard.length ? `<strong>Cannot launch yet.</strong> ${hard.map((h) => esc(h.title)).join('. ')}.` : M.checks.some((c) => c.level === 'fail')
        ? '<strong>Cleared to launch, with serious concerns.</strong> The board would send this back. You can fly it anyway and see what happens.'
        : M.checks.some((c) => c.level === 'warn') ? '<strong>Cleared to launch.</strong> A few concerns are worth a second look.' : '<strong>Cleared to launch.</strong> The board has no concerns.'}
        Expected science ${M.science.expected.toFixed(1)} of ${M.science.target} points, ${fmtMoney(M.cost.reserve)} in reserve, ${M.risk.level.toLowerCase()} risk.</p>
      <div class="actions" style="margin:0">
        <button class="btn" data-act="design">Back to design</button>
        <button class="btn primary big" data-act="launch" ${canGo ? '' : 'disabled'}>Launch the mission</button>
      </div>
    </div>
    <div class="review">
      ${D.ROLES.map((r) => {
        const cs = M.checks.filter((c) => c.role === r.id);
        return `<section class="review-role" style="--role:${r.colour}">
          <h3>${r.name}<span class="owner">${esc(ownerName(r.id))}</span></h3>
          <div class="issues">${cs.length ? cs.map((c) => `<div class="issue ${c.level}"><span class="ico" aria-hidden="true"></span><div><strong>${esc(c.title)}.</strong> ${esc(c.detail)}</div></div>`).join('') : '<p class="role-tag">Nothing to report.</p>'}</div>
          <p class="${M.roleGoals[r.id] ? '' : 'role-tag'}">Role goal: ${r.goal} ${M.roleGoals[r.id] ? '<strong style="color:var(--ok)">On track.</strong>' : 'Not on track.'}</p>
          ${team ? `<label class="signoff"><input type="checkbox" data-sign="${r.id}" ${app.signoff[r.id] ? 'checked' : ''}> ${esc(ownerName(r.id) || r.short)} approves this design</label>` : ''}
        </section>`;
      }).join('')}
    </div>
  </div></section>`;
}

// ---------------------------------------------------------------- simulation
function sim() {
  const L = lookup(app.design);
  const phases = [['development', 'Build'], ['launch', 'Launch'], ...(cruiseYears(L) > 0.05 ? [['cruise', 'Cruise']] : []), ['arrival', 'Arrival'], ['operations', 'Science']];
  return `${topbar()}<div class="wrap"><div class="sim">
    <div>
      <div class="stage">
        <canvas id="viz" aria-label="Animation of the mission" role="img"></canvas>
        <div class="phase-label" id="phase-label">Development</div>
        <div class="clock" id="clock">Year 0.0</div>
        <div class="phases" id="phases">${phases.map(([id, label]) => `<span data-phase="${id}">${label}</span>`).join('')}</div>
      </div>
      <dl class="dash">
        <div><dt>Science</dt><dd id="d-sci">0.0 / ${L.objective.target}</dd></div>
        <div><dt>Money left</dt><dd id="d-res">${fmtMoney(evaluate(app.design).cost.reserve)}</dd></div>
        <div><dt>Data home</dt><dd id="d-data">0 MB</dd></div>
        <div><dt>Instruments working</dt><dd id="d-inst">${app.design.instruments.length}</dd></div>
      </dl>
      <div class="sim-controls no-print">
        <span>Speed</span>
        ${[1, 2, 4].map((v) => `<button class="btn small ${app.speed === v ? 'primary' : ''}" data-speed="${v}" aria-pressed="${app.speed === v}">${v}×</button>`).join('')}
        <button class="btn small" data-act="skip">Skip to the next decision</button>
      </div>
    </div>
    <section aria-labelledby="log-h">
      <h2 id="log-h" style="font-size:28px;margin-bottom:12px">Mission log</h2>
      <ol class="loglist" id="log" aria-live="polite"></ol>
    </section>
  </div></div>`;
}

async function startSim() {
  const runId = ++app.runId;
  const alive = () => runId === app.runId && app.screen === 'sim';
  const canvas = document.getElementById('viz');
  const L = lookup(app.design);
  app.viz = createViz(canvas);
  app.viz.set({ scene: 'development', body: L.mission.body, orbitId: L.orbit.id, progress: 0 });
  const mission = createMission(app.design, app.seed);
  const live = mission.ctx.live;
  const logEl = document.getElementById('log');
  const delay = (ms) => (app.skipping ? wait(30) : wait(ms / app.speed));
  const dash = () => {
    document.getElementById('d-sci').textContent = `${live.science.toFixed(1)} / ${L.objective.target}`;
    document.getElementById('d-res').textContent = fmtMoney(live.reserve);
    document.getElementById('d-data').textContent = fmtData(live.dataHome);
    document.getElementById('d-inst').textContent = live.working.size;
    document.getElementById('clock').textContent = `Year ${live.t.toFixed(1)}`;
  };
  const addLog = (text, tone, fact, t) => {
    const li = document.createElement('li');
    li.className = tone;
    li.innerHTML = `<span class="t">Year ${t.toFixed(1)}</span>${esc(text)}${fact ? `<div class="fact">${esc(fact)}</div>` : ''}`;
    logEl.prepend(li);
  };
  const animate = async (ms, scene) => {
    const steps = 30;
    for (let i = 1; i <= steps; i++) {
      if (!alive()) return;
      app.viz.set({ scene, progress: i / steps });
      await delay(ms / steps);
    }
  };
  const labels = { development: 'Development', launch: 'Launch', cruise: 'Cruise', arrival: 'Arrival', operations: 'Science operations' };

  let r = mission.next();
  while (!r.done) {
    if (!alive()) return;
    const v = r.value;
    if (v.type === 'phase') {
      document.getElementById('phase-label').textContent = labels[v.phase];
      const order = [...document.querySelectorAll('#phases span')].map((x) => x.dataset.phase);
      const idx = order.indexOf(v.phase);
      document.querySelectorAll('#phases span').forEach((el, i) => { el.className = i < idx ? 'done' : i === idx ? 'now' : ''; });
      if (v.phase === 'development') await animate(1400, 'development');
      if (v.phase === 'launch') { app.viz.set({ scene: 'launch', progress: 0 }); await animate(2200, 'launch'); }
      if (v.phase === 'cruise') { app.viz.set({ scene: 'cruise', progress: 0 }); await animate(2600, 'cruise'); }
      if (v.phase === 'arrival' || v.phase === 'operations') app.viz.set({ scene: 'orbit' });
      r = mission.next();
    } else if (v.type === 'log') {
      addLog(v.text, v.tone, v.fact, v.t);
      dash();
      if (live.lost) app.viz.set({ lost: true });
      await delay(v.tone === 'bad' ? 1800 : 1100);
      r = mission.next();
    } else {
      dash();
      app.skipping = false;
      const choice = await askDecision(v);
      if (!alive()) return;
      const opt = v.options.find((o) => o.id === choice);
      const li = document.createElement('li');
      li.className = 'choice';
      li.innerHTML = `<span class="t">Year ${v.t.toFixed(1)}, ${esc(ROLE[v.role].name)} decided</span>${esc(opt.label)}.`;
      logEl.prepend(li);
      r = mission.next(choice);
    }
  }
  if (!alive()) return;
  dash();
  app.report = r.value;
  app.saved = false;
  app.viz.set({ scene: 'end', lost: live.lost });
  document.getElementById('phase-label').textContent = live.lost ? 'Contact lost' : 'Mission complete';
  await wait(1400);
  if (alive()) go('debrief');
}

function askDecision(d) {
  return new Promise((resolve) => {
    const role = ROLE[d.role];
    dialog.className = '';
    dialog.style.setProperty('--role', role.colour);
    dialog.innerHTML = `<div class="dhead"><p class="who">Decision for the ${role.name}${ownerName(d.role) ? `, ${esc(ownerName(d.role))}` : ''}</p><h2 id="dialog-title" style="font-size:30px">${esc(d.title)}</h2></div>
      <div class="dbody">
        <p>${esc(d.text)}</p>
        <div class="choices">${d.options.map((o) => `<button class="choice" data-choice="${o.id}" ${o.disabled ? 'disabled' : ''}><strong>${esc(o.label)}</strong>${o.detail ? `<span>${esc(o.detail)}</span>` : ''}${o.disabled ? `<span>${esc(o.reason)}</span>` : ''}</button>`).join('')}</div>
        ${d.fact ? `<p class="factbox">${esc(d.fact)}</p>` : ''}
      </div>`;
    const onClick = (e) => {
      const b = e.target.closest('[data-choice]');
      if (!b || b.disabled) return;
      dialog.removeEventListener('click', onClick);
      dialog.removeEventListener('cancel', onCancel);
      dialog.close();
      resolve(b.dataset.choice);
    };
    const onCancel = (e) => e.preventDefault();
    dialog.addEventListener('click', onClick);
    dialog.addEventListener('cancel', onCancel);
    dialog.showModal();
    dialog.querySelector('.choice:not(:disabled)')?.focus();
  });
}

// ---------------------------------------------------------------- debrief
function starSvg(on) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.8-6.2 3.8 1.6-7L2 9.2l7.1-.6z" fill="${on ? '#d9a441' : 'none'}" stroke="${on ? '#d9a441' : '#2a4166'}" stroke-width="1.5"/></svg>`;
}

function debrief() {
  const rep = app.report;
  const L = lookup(app.design);
  const titles = { success: 'Mission success', partial: 'Partial success', failure: rep.lost ? 'Mission lost' : 'Mission failed' };
  const why = rep.lost ? rep.lossReason
    : rep.outcome === 'success' ? `You delivered ${rep.science.toFixed(1)} science points against a goal of ${rep.target}.`
      : `You delivered ${rep.science.toFixed(1)} of the ${rep.target} science points needed.`;
  const key = `${L.mission.id}.${L.objective.id}`;
  const board = (store.get(SCORE_KEY, {})[key] || []).slice(0, 5);
  const rows = [
    ['Science', `${Math.round(rep.ratio * 100)}% of the goal`, rep.points.science],
    ['Money left', fmtMoney(rep.reserve), rep.points.budget],
    ['Design margins', 'mass, power, data, battery', rep.points.design],
    ['Spacecraft survived', rep.lost ? 'no' : 'yes', rep.points.survival],
    ['Clean ending', rep.disposal.text ? (rep.disposal.ok ? 'yes' : 'no') : 'not applicable', rep.points.responsibility],
    ['Schedule', rep.points.schedule ? 'slipped a year' : 'on time', rep.points.schedule],
    ['Role goals met', `${Object.values(rep.goals).filter(Boolean).length} of 4`, rep.points.teamwork],
  ];
  const diff = byId(D.DIFFICULTY, app.difficulty);
  return `${topbar()}<div class="wrap">
    <section class="verdict-hero">
      <p class="kicker">${esc(L.mission.name)}, ${esc(L.objective.name.toLowerCase())}. ${rep.yearsFlown ? `${rep.yearsFlown.toFixed(1)} years of operations.` : ''}</p>
      <h2 class="${rep.outcome}">${titles[rep.outcome]}</h2>
      <div class="stars" aria-label="${rep.stars} of 3 stars">${[1, 2, 3].map((i) => starSvg(i <= rep.stars)).join('')}</div>
      <p>${esc(why)} ${rep.disposal.text ? esc(rep.disposal.text) : ''}</p>
    </section>
    <div class="debrief">
      <div>
        <section class="panel">
          <h3>What this mission teaches</h3>
          ${rep.lessons.map((l) => `<div class="lesson"><h4>${esc(l.title)}</h4>${l.text ? `<p>${esc(l.text)}</p>` : ''}${l.fact ? `<p class="fact">${esc(l.fact)}</p>` : ''}</div>`).join('')}
        </section>
        <section class="panel">
          <h3>Decisions</h3>
          ${rep.events.length ? `<ul class="board">${rep.events.map((e) => `<li><span>${esc(e.title)}</span><span>${esc(e.choice)}</span></li>`).join('')}</ul>` : '<p class="role-tag">No decisions were needed.</p>'}
          <details><summary>Full mission log</summary><ol class="loglist" style="max-height:none;margin-top:10px">${rep.log.map((l) => `<li class="${l.tone}"><span class="t">Year ${l.t.toFixed(1)}</span>${esc(l.text)}</li>`).join('')}</ol></details>
        </section>
      </div>
      <div>
        <section class="panel">
          <h3>Score</h3>
          <table class="score-table"><tbody>
            ${rows.map(([a, b, n]) => `<tr><td>${a}<br><span class="role-tag">${esc(b)}</span></td><td>${n > 0 ? '+' : ''}${n}</td></tr>`).join('')}
            <tr><td>Difficulty</td><td>× ${diff.scoreMult}</td></tr>
            <tr class="total"><td>Total</td><td>${rep.scored ? rep.total.toLocaleString('en-US') : 'not scored'}</td></tr>
          </tbody></table>
        </section>
        <section class="panel">
          <h3>Role goals</h3>
          <div class="goals">${D.ROLES.map((r) => `<div class="goal-row" style="--role:${r.colour}"><span class="dot" aria-hidden="true"></span><span>${r.name}${ownerName(r.id) ? ` (${esc(ownerName(r.id))})` : ''}<br><span class="role-tag">${r.goal}</span></span><span class="res ${rep.goals[r.id] ? 'met' : 'miss'}">${rep.goals[r.id] ? 'Met' : 'Missed'}</span></div>`).join('')}</div>
        </section>
        ${rep.scored ? `<section class="panel no-print">
          <h3>Best scores for this mission</h3>
          ${board.length ? `<ol class="board">${board.map((b) => `<li class="${b.id === app.lastSavedId ? 'me' : ''}"><span>${esc(b.name)} ${'★'.repeat(b.stars)}</span><span>${b.score.toLocaleString('en-US')}</span></li>`).join('')}</ol>` : '<p class="role-tag">No scores saved on this device yet.</p>'}
          ${app.saved ? '<p>Saved.</p>' : `<form class="save-row" data-form="save"><label class="visually-hidden" for="save-name">Name for the scoreboard</label><input id="save-name" maxlength="30" value="${esc(app.mode === 'team' ? app.team.name : '')}" placeholder="Your name" required><button class="btn">Save score</button></form>`}
        </section>` : ''}
        <section class="panel no-print">
          <h3>Next</h3>
          <div class="actions" style="margin:0">
            <button class="btn primary" data-act="redesign">Improve the design</button>
            <button class="btn" data-act="refly">Fly the same design again</button>
            <button class="btn" data-act="missions">Try another mission</button>
            <button class="btn" data-act="share">Copy share link</button>
            <button class="btn" data-act="print">Print the report</button>
          </div>
        </section>
      </div>
    </div>
  </div>`;
}

// ---------------------------------------------------------------- learn
function learn() {
  dialog.className = 'learn';
  dialog.style.removeProperty('--role');
  dialog.innerHTML = `<div class="dhead"><h2 id="dialog-title" style="font-size:32px">How it works</h2></div>
  <div class="dbody learn">
    <p>Margin is a simplified model of how space missions are designed. The numbers are rounded and approximate, but they move the way real ones do: double the distance and the radio signal gets four times weaker; go five times farther from the Sun and sunlight is 25 times weaker.</p>
    <h3>The resources</h3>
    <ul>
      <li><strong>Mass.</strong> The rocket must lift everything, fuel included. Fuel follows the rocket equation: the fuel needed grows exponentially with the speed change, because fuel has to push fuel.</li>
      <li><strong>Power.</strong> Solar arrays make power in proportion to their area and to 1 ÷ (distance from the Sun)². They wear out over time, faster in radiation. They must also recharge the battery for the dark part of each orbit.</li>
      <li><strong>Data.</strong> Data rate ∝ transmitter power × antenna gain × ground dish size ÷ distance², up to what the radio can handle. Data that never reaches Earth is lost science.</li>
      <li><strong>Budget.</strong> Cost = hardware + testing + launch + operations for every year in space. Anything left at the end counts toward your score.</li>
      <li><strong>Time.</strong> Building, testing, waiting for a launch window, cruising and operating all take years, and the team must be paid the whole time.</li>
      <li><strong>Risk.</strong> Launches can fail, engines can fail on arrival, radiation damages electronics. Testing, shielding and backups lower the odds.</li>
    </ul>
    <h3>Margins</h3>
    <p>A margin is the gap between what you need and what you have. Every gauge shows it as a hatched band. Real teams keep 20 to 30% spare mass and power early in a design, and 20 to 30% of the budget in reserve, because surprises always come.</p>
    <h3>Scoring</h3>
    <p>Science delivered (up to 150% of the goal), money left, design margins, keeping the spacecraft alive, ending the mission cleanly, and each role goal met. Harder difficulty multiplies the score. Success means reaching the science goal.</p>
    <h3>Playing as a team</h3>
    <p>Each of the four roles owns part of the design and has a goal that pulls against the others: the Science Lead wants more instruments, the Planner wants to save money, the Engineer wants margins, and Communications wants every bit of data home. Agree, then sign off together.</p>
    <h3>For teachers</h3>
    <p>Each mission takes 15 to 30 minutes. Good discussion questions: why does the Europa spacecraft need wings 25 times larger than at Earth? Why did your mission need fuel at all? What would you cut if the budget dropped by a quarter?</p>
    <h3>Sources and further reading</h3>
    <ul>
      <li><a href="https://www.spaceappschallenge.org/2026/challenges/space-mission-design-game/" target="_blank" rel="noopener">NASA Space Apps 2026: Space Mission Design Game challenge</a></li>
      <li><a href="https://www.nasa.gov/wp-content/uploads/2025/04/250323-design-and-develop-science-mission.pdf" target="_blank" rel="noopener">NASA: Design and Develop Science Missions</a></li>
      <li><a href="https://www3.nasa.gov/sites/default/files/atoms/files/nasa_csli_cubesat_101_508.pdf" target="_blank" rel="noopener">NASA: CubeSat 101</a></li>
      <li><a href="https://dataverse.jpl.nasa.gov/dataset.xhtml?persistentId=hdl:2014/44299" target="_blank" rel="noopener">JPL: Concept Maturity Levels</a></li>
      <li><a href="https://www.nasa.gov/reference/systems-engineering-handbook/" target="_blank" rel="noopener">NASA Systems Engineering Handbook</a></li>
    </ul>
    <p>Margin is an independent educational project, not an official NASA product.</p>
    <div class="close-row"><button class="btn primary" data-act="close-dialog">Close</button></div>
  </div>`;
  dialog.showModal();
}

// ---------------------------------------------------------------- events
function setDesign(next, focusSel) {
  const [clean, notes] = sanitize(next);
  app.design = clean;
  if (notes.length) toast(notes[0]);
  const y = window.scrollY;
  render();
  window.scrollTo(0, y);
  if (focusSel) root.querySelector(focusSel)?.focus({ preventScroll: true });
}

function shareLink() {
  const url = `${location.origin}${location.pathname}#d=${encodeDesign(app.design)}`;
  const done = () => toast('Link copied. Anyone who opens it gets this design.');
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).then(done, () => window.prompt('Copy this link', url));
  else window.prompt('Copy this link', url);
}

root.addEventListener('click', (e) => {
  const t = e.target.closest('[data-act],[data-tab],[data-cat],[data-mission],[data-speed]');
  if (!t) return;
  if (t.dataset.tab) {
    app.tab = t.dataset.tab;
    if (app.screen === 'design') { render(); root.querySelector(`#tab-${app.tab}`)?.focus(); }
    return;
  }
  if (t.dataset.mission) {
    app.design = newDesign(t.dataset.mission, app.difficulty);
    app.tab = 'planner'; app.signoff = {};
    go('design');
    return;
  }
  if (t.dataset.speed) {
    app.speed = Number(t.dataset.speed);
    root.querySelectorAll('[data-speed]').forEach((b) => { const on = Number(b.dataset.speed) === app.speed; b.classList.toggle('primary', on); b.setAttribute('aria-pressed', on); });
    return;
  }
  if (t.dataset.cat) {
    const cat = t.dataset.cat, id = t.dataset.id;
    const s = { ...app.design, instruments: [...app.design.instruments] };
    const focusSel = `[data-cat="${cat}"][data-id="${id}"]`;
    if (cat === 'objective') s.objectiveId = id;
    else if (cat === 'instruments') s.instruments = s.instruments.includes(id) ? s.instruments.filter((x) => x !== id) : [...s.instruments, id];
    else if (cat === 'redundancy') s.redundancy = !s.redundancy;
    else s[CATEGORIES[cat].key] = id;
    app.signoff = {};
    setDesign(s, focusSel);
    return;
  }
  const act = t.dataset.act;
  if (act === 'home') go('home');
  if (act === 'solo') { app.mode = 'solo'; go('missions'); }
  if (act === 'team') { app.mode = 'team'; go('team'); }
  if (act === 'team-done') {
    app.team.name = document.getElementById('team-name').value.trim();
    root.querySelectorAll('[data-owner]').forEach((i) => { app.team.owners[i.dataset.owner] = i.value.trim(); });
    go('missions');
  }
  if (act === 'missions') go('missions');
  if (act === 'learn') learn();
  if (act === 'share') shareLink();
  if (act === 'review') go('review');
  if (act === 'design') go('design');
  if (act === 'launch') { app.seed = randomSeed(); app.skipping = false; go('sim'); }
  if (act === 'skip') app.skipping = true;
  if (act === 'redesign') { app.signoff = {}; go('design'); }
  if (act === 'refly') { app.seed = randomSeed(); go('sim'); }
  if (act === 'print') window.print();
});

root.addEventListener('change', (e) => {
  if (e.target.name === 'diff') {
    app.difficulty = e.target.value;
    document.getElementById('diff-note').textContent = byId(D.DIFFICULTY, app.difficulty).text;
  }
  if (e.target.dataset.sign) {
    app.signoff[e.target.dataset.sign] = e.target.checked;
    const y = window.scrollY; render(); window.scrollTo(0, y);
    root.querySelector(`[data-sign="${e.target.dataset.sign}"]`)?.focus();
  }
});

root.addEventListener('submit', (e) => {
  if (e.target.dataset.form !== 'save') return;
  e.preventDefault();
  const name = document.getElementById('save-name').value.trim().slice(0, 30) || 'Anonymous';
  const L = lookup(app.design);
  const key = `${L.mission.id}.${L.objective.id}`;
  const all = store.get(SCORE_KEY, {});
  const id = `${Date.now()}`;
  all[key] = [...(all[key] || []), { id, name, score: app.report.total, stars: app.report.stars, difficulty: app.difficulty, date: new Date().toISOString().slice(0, 10) }]
    .sort((a, b) => b.score - a.score).slice(0, 10);
  store.set(SCORE_KEY, all);
  app.saved = true; app.lastSavedId = id;
  const y = window.scrollY; render(); window.scrollTo(0, y);
  toast('Score saved on this device.');
});

dialog.addEventListener('click', (e) => {
  if (e.target.closest('[data-act="close-dialog"]')) dialog.close();
  if (e.target === dialog && dialog.classList.contains('learn')) dialog.close();
});

// ---------------------------------------------------------------- start
function loadSharedDesign() {
  const m = location.hash.match(/^#d=([A-Za-z0-9_-]+)/);
  if (!m) return false;
  const d = decodeDesign(m[1]);
  history.replaceState(null, '', location.pathname);
  if (!d) { toast('That share link could not be read.'); return false; }
  if (dialog.open) dialog.close();
  app.design = d; app.difficulty = d.difficulty; app.tab = 'planner'; app.signoff = {};
  go('design');
  toast('Shared design loaded. Check it, then fly it.');
  return true;
}
window.addEventListener('hashchange', loadSharedDesign);
if (!loadSharedDesign()) go('home');

// Exposed for debugging in the browser console.
window.__margin = { app, evaluate, powerAt };
