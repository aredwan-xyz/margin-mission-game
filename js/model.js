// The engineering model: turns a mission design into numbers, checks and explanations.
// Pure functions only, so it runs in the browser and in Node tests.
import * as D from './data.js';

export const CATEGORIES = {
  orbit: { list: D.ORBITS, key: 'orbitId', role: 'planner' },
  launcher: { list: D.LAUNCHERS, key: 'launcherId', role: 'planner' },
  testing: { list: D.TESTING, key: 'testingId', role: 'planner' },
  trajectory: { list: D.TRAJECTORIES, key: 'trajectory', role: 'planner' },
  bus: { list: D.BUSES, key: 'busId', role: 'engineer' },
  power: { list: D.POWER, key: 'powerId', role: 'engineer' },
  battery: { list: D.BATTERIES, key: 'batteryId', role: 'engineer' },
  propulsion: { list: D.PROPULSION, key: 'propulsionId', role: 'engineer' },
  shielding: { list: D.SHIELDING, key: 'shieldingId', role: 'engineer' },
  antenna: { list: D.ANTENNAS, key: 'antennaId', role: 'comms' },
  ground: { list: D.GROUND, key: 'groundId', role: 'comms' },
};

const byId = (list, id) => list.find((x) => x.id === id);
const sum = (arr, f) => arr.reduce((a, x) => a + f(x), 0);
const BUS_RANK = Object.fromEntries(D.BUSES.map((b) => [b.id, b.rank]));

export function mission(id) { return byId(D.MISSIONS, id); }

export function newDesign(missionId, difficulty = 'engineer') {
  const m = mission(missionId);
  return {
    missionId, difficulty,
    objectiveId: m.objectives[0].id,
    orbitId: m.orbits[0],
    trajectory: 'direct',
    launcherId: m.launcher || 'medium',
    testingId: 'standard',
    busId: 'small',
    powerId: 'solar_m',
    batteryId: 'bat200',
    propulsionId: 'none',
    shieldingId: 'none',
    redundancy: false,
    antennaId: 'lga',
    groundId: 'uni',
    instruments: [],
  };
}

export function lookup(s) {
  const m = mission(s.missionId);
  const objective = m.objectives.find((o) => o.id === s.objectiveId) || m.objectives[0];
  return {
    mission: m,
    objective,
    orbit: byId(D.ORBITS, s.orbitId),
    launcher: byId(D.LAUNCHERS, s.launcherId),
    testing: byId(D.TESTING, s.testingId),
    bus: byId(D.BUSES, s.busId),
    power: byId(D.POWER, s.powerId),
    battery: byId(D.BATTERIES, s.batteryId),
    prop: byId(D.PROPULSION, s.propulsionId),
    shield: byId(D.SHIELDING, s.shieldingId),
    antenna: byId(D.ANTENNAS, s.antennaId),
    ground: byId(D.GROUND, s.groundId),
    diff: byId(D.DIFFICULTY, s.difficulty) || D.DIFFICULTY[1],
    instruments: s.instruments.map((id) => byId(D.INSTRUMENTS, id)).filter(Boolean),
    trajectory: m.cruiseYears.ga !== undefined ? s.trajectory : 'direct',
  };
}

export function busName(id) { return byId(D.BUSES, id).name.toLowerCase(); }

/** Can this option be chosen with the rest of the design? */
export function compat(s, category, opt) {
  const L = lookup(s);
  if (opt.minBus && BUS_RANK[L.bus.id] < BUS_RANK[opt.minBus]) {
    return { ok: false, reason: `Needs a ${busName(opt.minBus)} or bigger.` };
  }
  if (category === 'launcher') {
    const cap = launcherCapacity(opt, L.orbit, L.trajectory);
    if (cap <= 0) return { ok: false, reason: `Cannot reach ${L.mission.place.toLowerCase()} with this orbit.` };
  }
  if (category === 'instrument' && L.bus.id === 'cubesat' && opt.mass > L.bus.maxAdd) {
    return { ok: false, reason: 'Too big for a CubeSat.' };
  }
  return { ok: true };
}

/** Replace anything the current bus or orbit can no longer carry. Returns [design, notes]. */
export function sanitize(s) {
  const out = { ...s, instruments: [...s.instruments] };
  const notes = [];
  for (const [cat, c] of Object.entries(CATEGORIES)) {
    if (cat === 'trajectory' || cat === 'orbit') continue;
    const cur = byId(c.list, out[c.key]);
    if (!cur || !compat(out, cat, cur).ok) {
      const pool = cat === 'launcher' ? [...c.list] : [...c.list].reverse();
      const pick = pool.find((o) => compat(out, cat, o).ok);
      if (pick && pick.id !== out[c.key]) {
        if (cur) notes.push(`${cur.name} does not fit; switched to ${pick.name}.`);
        out[c.key] = pick.id;
      }
    }
  }
  const kept = out.instruments.filter((id) => compat(out, 'instrument', byId(D.INSTRUMENTS, id)).ok);
  if (kept.length !== out.instruments.length) notes.push('Removed instruments that are too big for this spacecraft.');
  out.instruments = kept;
  return [out, notes];
}

export function launcherCapacity(launcher, orbit, trajectory) {
  const cls = orbit.launchClass === 'jupiter' && trajectory === 'ga' ? 'jupiter_ga' : orbit.launchClass;
  return launcher.cap[cls] || 0;
}

export function cruiseYears(L) {
  let y = L.mission.cruiseYears[L.trajectory] ?? L.mission.cruiseYears.direct;
  if (L.prop.lowThrust) y += L.mission.body === 'earth' ? 0.3 : 1.0;
  return y;
}

/** Electrical power available after a number of years in space. */
export function powerAt(L, yearsInSpace, cruise = cruiseYears(L)) {
  if (L.power.kind === 'rtg') return L.power.watts * Math.max(0, 1 - D.RTG_DECAY_PER_YEAR * yearsInSpace);
  const bol = (L.power.area * D.ARRAY_W_PER_M2) / L.mission.sunAU ** 2;
  const cruisePart = Math.min(yearsInSpace, cruise);
  const opsPart = Math.max(0, yearsInSpace - cruise);
  const degr = 1 - D.SOLAR_DEGRADE_PER_YEAR * (cruisePart + opsPart * Math.max(1, L.orbit.radiation));
  return bol * Math.max(0.2, degr);
}

export function dataRate(L, dataMult = 1) {
  const link = D.LINK_K * L.antenna.gain * L.ground.g * L.antenna.txW * (D.LINK_REF_KM / L.orbit.distanceKm) ** 2;
  const bps = Math.min(L.antenna.maxBps, link) * dataMult;
  const hours = Math.min(24, L.ground.hours * (L.orbit.contactMult || 1));
  return { bps, hours, mbPerDay: (bps * hours * 3600) / 1e6, limitedByRadio: link > L.antenna.maxBps };
}

export function scienceOf(L, inst) {
  const w = L.objective.weights[inst.id] || 0;
  const mult = L.orbit.sci[inst.type] * (L.objective.orbitBonus[L.orbit.id] || 1);
  return w * mult;
}

export function launchWindowWait(mission, readyYear) {
  if (!mission.window) return { launchYear: readyYear, wait: 0 };
  let t = mission.window.first;
  while (t < readyYear - 1e-9) t += mission.window.every;
  return { launchYear: t, wait: t - readyYear };
}

export function fmtMoney(m) {
  if (Math.abs(m) >= 1000) return `$${(m / 1000).toFixed(2)}B`;
  if (Math.abs(m) >= 10) return `$${Math.round(m)}M`;
  return `$${m.toFixed(1)}M`;
}
export function fmtData(mb) {
  if (mb >= 1e6) return `${(mb / 8e6).toFixed(1)} TB`;
  if (mb >= 8000) return `${(mb / 8000).toFixed(1)} GB`;
  if (mb >= 8) return `${Math.round(mb / 8)} MB`;
  return `${Math.round(mb * 125)} kB`;
}
export function fmtRate(bps) {
  if (bps >= 1e6) return `${(bps / 1e6).toFixed(bps >= 1e7 ? 0 : 1)} Mbps`;
  if (bps >= 1e3) return `${(bps / 1e3).toFixed(bps >= 1e4 ? 0 : 1)} kbps`;
  return `${Math.max(0, bps).toFixed(bps >= 10 ? 0 : 1)} bps`;
}
const pct = (x) => `${Math.round(x * 100)}%`;
const kg = (x) => `${Math.round(x).toLocaleString('en-US')} kg`;

/** Evaluate a design. Returns every number the UI and the simulation need. */
export function evaluate(s) {
  const L = lookup(s);
  const { mission: m, objective, orbit, bus, power, battery, prop, shield, antenna, ground, launcher, testing, diff, instruments } = L;
  const years = m.opsYears;
  const cruise = cruiseYears(L);
  const aero = orbit.aeroYears || 0;

  // ---- Mass and propellant (rocket equation) ----
  const redundancyMass = s.redundancy ? bus.redundancyMass : 0;
  const instMass = sum(instruments, (i) => i.mass);
  const added = instMass + power.mass + battery.mass + prop.dryMass + shield.mass + antenna.mass + redundancyMass;
  const dry0 = bus.dryMass + added;
  const dvNeed = orbit.dv + orbit.dvPerYear * years + orbit.disposalDv;
  const dvDesign = prop.isp > 0 ? dvNeed * (1 + D.DV_MARGIN) : 0;
  let propMass = 0, tankMass = 0, rocketOk = true, massRatio = 1;
  if (prop.isp > 0 && dvDesign > 0) {
    massRatio = Math.exp((dvDesign * 1000) / (prop.isp * D.G0));
    const denom = 1 - D.TANK_FRACTION * (massRatio - 1);
    if (denom <= 0.05) { rocketOk = false; propMass = Infinity; }
    else { propMass = (dry0 * (massRatio - 1)) / denom; tankMass = D.TANK_FRACTION * propMass; }
  }
  const dryMass = dry0 + tankMass;
  const wetMass = dryMass + propMass;
  const launchMass = wetMass * (1 + D.LAUNCH_ADAPTER);
  const capacity = launcherCapacity(launcher, orbit, L.trajectory);
  const massMargin = capacity > 0 && isFinite(launchMass) ? capacity / launchMass - 1 : -1;
  const propOk = rocketOk && propMass <= bus.maxProp;
  const engineMissing = prop.isp === 0 && orbit.dv > 0;

  // ---- Power ----
  const loadParts = {
    bus: bus.basePower, heaters: m.heaterW,
    instruments: sum(instruments, (i) => i.power), radio: antenna.power,
  };
  const load = loadParts.bus + loadParts.heaters + loadParts.instruments + loadParts.radio;
  const eclipseShare = orbit.eclipseH / orbit.periodH;
  const sizing = eclipseShare > 0.01 ? (orbit.periodH / (orbit.periodH - orbit.eclipseH)) * 1.1 : 1;
  const required = power.kind === 'rtg' ? load : load * sizing;
  const genStart = powerAt(L, cruise, cruise);
  const genEnd = powerAt(L, cruise + aero + years, cruise);
  const powerMargin = genEnd / required - 1;
  const powerFactorStart = Math.min(1, genStart / required);
  const powerFactorEnd = Math.min(1, genEnd / required);
  const eclipseLoad = power.kind === 'rtg' ? Math.max(0, load - genEnd) : load;
  const batteryNeed = (eclipseLoad * orbit.eclipseH) / D.BATTERY_DOD;
  const batteryOk = battery.wh >= batteryNeed;
  const ionPower = prop.lowThrust ? powerAt(L, 0, cruise) : null;
  const ionOk = !prop.lowThrust || powerAt(L, 0, cruise) * 1 >= D.ION_POWER_W;

  // ---- Data ----
  const link = dataRate(L);
  const produced = sum(instruments, (i) => i.data);
  const dataFactor = produced > 0 ? Math.min(1, link.mbPerDay / produced) : 1;
  const dataMargin = produced > 0 ? link.mbPerDay / produced - 1 : Infinity;

  // ---- Science (estimate with nothing going wrong) ----
  const perInstrument = instruments.map((i) => ({ id: i.id, name: i.name, value: scienceOf(L, i) }));
  const potential = sum(perInstrument, (p) => p.value);
  const requirementMet = objective.required.some((id) => s.instruments.includes(id));
  const reqFactor = requirementMet ? 1 : 0.5;
  const batteryFactor = batteryOk ? 1 : 0.7;
  const avgPowerFactor = (powerFactorStart + powerFactorEnd) / 2;
  let lifeFactor = 1;
  if (prop.isp === 0 && orbit.noEngine === 'decay') lifeFactor = Math.min(1, 1 / years);
  const reachable = !engineMissing && ionOk;
  const expected = reachable ? potential * reqFactor * dataFactor * avgPowerFactor * batteryFactor * lifeFactor : 0;
  const target = objective.target;

  // ---- Cost ----
  const instCost = sum(instruments, (i) => i.cost);
  const redundancyCost = s.redundancy ? bus.cost * 0.1 + 1 : 0;
  const hardware = bus.cost + instCost + power.cost + battery.cost + prop.cost + shield.cost + antenna.cost + redundancyCost;
  const dev = hardware * (1 + 0.3 * testing.wrapMult);
  const launchCost = launcher.perKg ? Math.max(launcher.minCost, (isFinite(launchMass) ? launchMass : 0) * launcher.perKg) : launcher.cost;
  const window = launchWindowWait(m, testing.devYears);
  const waitCost = window.wait * bus.opsPerYear * 1.5;
  const flightYears = cruise + aero + years;
  const opsCost = (bus.opsPerYear + ground.costPerYear) * flightYears;
  const total = dev + launchCost + opsCost + waitCost;
  const budget = m.budget * diff.budgetMult;
  const reserve = budget - total;

  // ---- Risk ----
  const effRadiation = orbit.radiation * shield.factor;
  const faultPerYear = D.ELECTRONICS_FAULT * effRadiation * testing.risk * diff.riskMult;
  const critPerYear = faultPerYear * (s.redundancy ? 0.3 : 1);
  const engineFault = prop.isp > 0 && orbit.dv > 0 ? D.ENGINE_FAULT * testing.risk * diff.riskMult : 0;
  const survive = (diff.launchFailure ? 1 - launcher.failRate : 1) * (1 - engineFault) * (1 - critPerYear) ** years;
  const lossChance = 1 - survive;

  const timeline = {
    devYears: testing.devYears, launchYear: window.launchYear, wait: window.wait,
    cruise, aero, ops: years, end: window.launchYear + flightYears,
  };

  const M = {
    L, years, cruise, aero,
    mass: { added, maxAdd: bus.maxAdd, dry0, dryMass, propMass, tankMass, wetMass, launchMass, capacity, massMargin,
      dvNeed, dvDesign, massRatio, rocketOk, propOk, maxProp: bus.maxProp, engineMissing },
    power: { load, loadParts, required, sizing, genStart, genEnd, powerMargin, powerFactorStart, powerFactorEnd,
      batteryNeed, batteryOk, ionPower, ionOk, kind: power.kind },
    data: { ...link, produced, dataFactor, dataMargin },
    science: { perInstrument, potential, requirementMet, expected, target, reachable, lifeFactor },
    cost: { hardware, dev, launch: launchCost, ops: opsCost, wait: waitCost, total, budget, reserve,
      reservePct: reserve / budget },
    risk: { effRadiation, faultPerYear, critPerYear, engineFault, lossChance,
      level: lossChance < 0.1 ? 'Low' : lossChance < 0.25 ? 'Medium' : 'High' },
    timeline,
  };
  M.checks = buildChecks(s, M);
  M.canLaunch = !M.checks.some((c) => c.hard && c.level === 'fail');
  M.roleGoals = roleGoals(M);
  return M;
}

function check(id, role, level, title, detail, hard = false) { return { id, role, level, title, detail, hard }; }

function buildChecks(s, M) {
  const { L } = M;
  const out = [];
  const body = L.mission.body === 'jupiter' ? 'Europa' : L.mission.body === 'earth' ? 'orbit' : L.mission.body === 'moon' ? 'the Moon' : 'Mars';

  // Budget
  const c = M.cost;
  if (c.reserve < 0) {
    out.push(check('budget', 'planner', 'fail', `Over budget by ${fmtMoney(-c.reserve)}`,
      `The mission costs ${fmtMoney(c.total)} but the agency will only pay ${fmtMoney(c.budget)}. Cut something, or choose cheaper parts.`, true));
  } else if (c.reservePct < 0.1) {
    out.push(check('budget', 'planner', 'warn', `Only ${pct(c.reservePct)} of the budget held back`,
      `Something always costs more than planned. Real projects keep 20 to 30% in reserve. You have ${fmtMoney(c.reserve)}.`));
  } else {
    out.push(check('budget', 'planner', 'ok', `${fmtMoney(c.reserve)} held in reserve (${pct(c.reservePct)})`,
      'Money set aside for surprises. Anything left at the end counts toward your score.'));
  }
  if (M.timeline.wait > 0.01) {
    out.push(check('window', 'planner', 'warn', `Waits ${M.timeline.wait.toFixed(1)} years for a launch window`,
      `${D.FACTS.window} Your spacecraft is ready after ${M.timeline.devYears} years, and keeping the team together while it waits costs ${fmtMoney(c.wait)}.`));
  }

  // Launch
  const ms = M.mass;
  if (ms.capacity <= 0) {
    out.push(check('launch', 'planner', 'fail', 'This rocket cannot reach the orbit',
      'Pick a bigger launcher, or for Jupiter try gravity assists.', true));
  } else if (!isFinite(ms.launchMass) || ms.launchMass > ms.capacity) {
    out.push(check('launch', 'planner', 'fail', `Too heavy for the ${L.launcher.name.toLowerCase()}`,
      `Launch mass is ${isFinite(ms.launchMass) ? kg(ms.launchMass) : 'impossible'}, but this rocket can only send ${kg(ms.capacity)} there.`, true));
  } else if (ms.massMargin < 0.15) {
    out.push(check('launch', 'engineer', 'warn', `Only ${pct(ms.massMargin)} spare launch capacity`,
      `Designs grow as they are built. ${D.FACTS.margin}`));
  } else {
    out.push(check('launch', 'engineer', 'ok', `${pct(ms.massMargin)} spare launch capacity`,
      `Launch mass ${kg(ms.launchMass)} of the ${kg(ms.capacity)} the rocket can carry.`));
  }
  if (ms.added > ms.maxAdd) {
    out.push(check('bus', 'engineer', 'fail', 'Too much equipment for this spacecraft',
      `The parts weigh ${kg(ms.added)} but a ${L.bus.name.toLowerCase()} can only hold ${kg(ms.maxAdd)}. Use a bigger spacecraft or remove parts.`, true));
  }

  // Propulsion
  if (!ms.rocketOk || ms.propMass > ms.maxProp) {
    out.push(check('fuel', 'engineer', 'fail', 'Not enough room for the fuel',
      !ms.rocketOk
        ? 'With this engine, the fuel needed would weigh more than the spacecraft can ever carry. That is the rocket equation: every kilogram of fuel also has to be pushed. Choose a more efficient engine.'
        : `This trip needs ${kg(ms.propMass)} of propellant, but the tanks of a ${L.bus.name.toLowerCase()} hold ${kg(ms.maxProp)}.`, true));
  } else if (ms.engineMissing) {
    out.push(check('engine', 'engineer', 'fail', `No engine to brake into orbit`,
      `Reaching this orbit needs a ${L.orbit.dv.toFixed(1)} km/s burn on arrival. Without an engine the spacecraft will fly straight past ${body}.`));
  } else if (L.prop.isp === 0 && L.orbit.noEngine === 'decay') {
    out.push(check('engine', 'engineer', 'warn', 'Air drag will pull it down in about a year',
      'At 400 km the thin upper atmosphere slowly drags satellites down. Without thrusters to boost it, the mission ends early.'));
  } else if (L.prop.isp === 0 && L.orbit.noEngine === 'debris') {
    out.push(check('engine', 'engineer', 'warn', 'Cannot remove itself at the end',
      `${D.FACTS.debris} Without thrusters it will stay up for decades.`));
  } else if (L.prop.isp > 0) {
    out.push(check('engine', 'engineer', 'ok', `${kg(ms.propMass)} of propellant on board`,
      `Enough for ${ms.dvNeed.toFixed(2)} km/s of speed changes plus 10% margin. The spacecraft is ${pct(ms.propMass / ms.wetMass)} fuel.`));
  }
  if (!M.power.ionOk) {
    out.push(check('ion', 'engineer', 'fail', 'Not enough power for the ion engine',
      `An ion engine needs about ${D.ION_POWER_W} W while it thrusts. Your power system makes ${Math.round(M.power.ionPower)} W out there. Without thrust it never arrives.`));
  }

  // Power
  const p = M.power;
  const sunNote = L.mission.sunAU > 1.1 && L.power.kind === 'solar'
    ? ` Sunlight at ${L.mission.place} is ${Math.round(L.mission.sunAU ** 2 * 10) / 10} times weaker than at Earth (it fades with the square of the distance from the Sun).` : '';
  const eclNote = p.sizing > 1 ? ' The array must also recharge the battery for the dark part of each orbit.' : '';
  if (p.powerFactorEnd < 0.85) {
    out.push(check('power', 'engineer', 'fail', `Power falls short: ${Math.round(p.genEnd)} W of ${Math.round(p.required)} W needed`,
      `By the end of the mission the power system makes ${Math.round(p.genEnd)} W, and the spacecraft needs ${Math.round(p.required)} W.${sunNote}${eclNote} Instruments will have to take turns.`));
  } else if (p.powerMargin < 0.15) {
    out.push(check('power', 'engineer', 'warn', `Tight power: ${pct(Math.max(0, p.powerMargin))} margin`,
      `${Math.round(p.genEnd)} W at end of life for ${Math.round(p.required)} W needed. Solar arrays wear out over time, faster in strong radiation.${sunNote}`));
  } else {
    out.push(check('power', 'engineer', 'ok', `${Math.round(p.genEnd)} W at end of life, ${pct(p.powerMargin)} margin`,
      `Needs ${Math.round(p.required)} W: spacecraft ${p.loadParts.bus} W, heaters ${p.loadParts.heaters} W, instruments ${p.loadParts.instruments} W, radio ${p.loadParts.radio} W.${eclNote}`));
  }
  if (!p.batteryOk) {
    out.push(check('battery', 'engineer', 'warn', `Battery too small for orbit nights`,
      `Each orbit spends ${Math.round(L.orbit.eclipseH * 60)} minutes in shadow. That needs about ${Math.round(p.batteryNeed)} Wh, and the battery holds ${L.battery.wh} Wh. Instruments will switch off in the dark.`));
  }

  // Radiation
  if (L.orbit.radiation >= 3 && L.shield.id !== 'vault') {
    out.push(check('radiation', 'engineer', L.orbit.radiation >= 6 ? 'fail' : 'warn', 'Radiation will damage the electronics',
      `This orbit is ${L.orbit.radiation} times harsher than Earth orbit. ${D.FACTS.radiation}`));
  }
  out.push(check('risk', 'engineer', M.risk.level === 'High' ? 'warn' : 'ok', `${M.risk.level} risk of losing the spacecraft (${pct(M.risk.lossChance)})`,
    `Comes from the launch, the engine burn on arrival, radiation, and how well it was tested. ${s.redundancy ? 'A backup computer and radio halve the damage from most faults.' : 'Adding a backup computer and radio lowers it.'}`));

  // Data
  const d = M.data;
  if (L.instruments.length) {
    const rateNote = `Your radio sends ${fmtRate(d.bps)} for ${d.hours} hours a day, so ${fmtData(d.mbPerDay)} a day gets home. The instruments make ${fmtData(d.produced)} a day.`;
    if (d.dataFactor < 0.5) {
      out.push(check('data', 'comms', 'fail', `Only ${pct(d.dataFactor)} of the data gets home`,
        `${rateNote} Signal strength fades with the square of the distance, so far missions need big dishes on both ends.`));
    } else if (d.dataFactor < 1) {
      out.push(check('data', 'comms', 'warn', `${pct(d.dataFactor)} of the data gets home`, rateNote));
    } else {
      out.push(check('data', 'comms', 'ok', `All data gets home, ${d.dataMargin === Infinity ? 'plenty' : pct(d.dataMargin)} spare`, rateNote));
    }
  }

  // Science
  const sc = M.science;
  if (!L.instruments.length) {
    out.push(check('science', 'science', 'fail', 'No instruments on board', 'A spacecraft with no instruments does no science. Add at least one.'));
  } else {
    if (!sc.requirementMet) {
      out.push(check('requirement', 'science', 'fail', 'Misses the mission requirement', `${L.objective.requiredText} Without it, at most half the science goal is possible.`));
    }
    const ratio = sc.expected / sc.target;
    out.push(check('science', 'science', ratio >= 1 ? 'ok' : ratio >= 0.7 ? 'warn' : 'fail',
      `Expected science: ${sc.expected.toFixed(1)} of ${sc.target} points needed`,
      ratio >= 1 ? 'Enough to meet the goal if nothing goes wrong.' : 'Not enough to meet the goal. Look at which instruments suit this objective and orbit, and whether power or data is holding them back.'));
  }
  return out;
}

function roleGoals(M) {
  return {
    planner: M.cost.reservePct >= 0.15,
    engineer: M.mass.massMargin >= 0.15 && M.power.powerMargin >= 0.15,
    science: M.science.expected >= 1.25 * M.science.target,
    comms: M.data.dataFactor >= 1 && (M.data.dataMargin >= 0.2),
  };
}

// ---- Sharing ----
const KEYS = ['missionId', 'difficulty', 'objectiveId', 'orbitId', 'trajectory', 'launcherId', 'testingId', 'busId',
  'powerId', 'batteryId', 'propulsionId', 'shieldingId', 'redundancy', 'antennaId', 'groundId', 'instruments'];

export function encodeDesign(s) {
  const json = JSON.stringify(KEYS.map((k) => s[k]));
  const b64 = typeof btoa === 'function' ? btoa(json) : Buffer.from(json).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeDesign(str) {
  try {
    const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const json = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString();
    const arr = JSON.parse(json);
    const s = Object.fromEntries(KEYS.map((k, i) => [k, arr[i]]));
    if (!mission(s.missionId)) return null;
    const base = newDesign(s.missionId, s.difficulty);
    const merged = { ...base, ...s, instruments: Array.isArray(s.instruments) ? s.instruments.filter((id) => byId(D.INSTRUMENTS, id)) : [] };
    for (const c of Object.values(CATEGORIES)) {
      if (c.key === 'trajectory') continue;
      if (!byId(c.list, merged[c.key])) merged[c.key] = base[c.key];
    }
    if (!byId(D.DIFFICULTY, merged.difficulty)) merged.difficulty = 'engineer';
    const m = mission(merged.missionId);
    if (!m.orbits.includes(merged.orbitId)) merged.orbitId = m.orbits[0];
    if (!m.objectives.some((o) => o.id === merged.objectiveId)) merged.objectiveId = m.objectives[0].id;
    return sanitize(merged)[0];
  } catch {
    return null;
  }
}
