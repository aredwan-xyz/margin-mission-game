// Mission simulation. A generator that yields phases, log lines and decisions.
// Same design + same seed + same choices = same result, so missions can be replayed and shared.
import * as D from './data.js';
import { evaluate, powerAt, dataRate, scienceOf, launchWindowWait, fmtMoney, fmtData } from './model.js';

export function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSeed() { return Math.floor(Math.random() * 2 ** 31); }

const round1 = (x) => Math.round(x * 10) / 10;
const byId = (list, id) => list.find((x) => x.id === id);

export function createMission(design, seed) {
  const M = evaluate(design);
  const L = M.L;
  const ctx = {
    design, seed, M, L, diff: L.diff, rnd: makeRng(seed),
    testRisk: L.testing.risk,
    live: {
      t: 0, phase: 'development', science: 0, reserve: M.cost.reserve, health: 1,
      lost: false, lossReason: null, lossCause: null, working: new Set(design.instruments),
      redundancyUsed: false, radMult: 1, sciMult: 1, dataMult: 1, opsYears: L.mission.opsYears, yearsFlown: 0,
      extended: 0, dataHome: 0, dataMade: 0, delayed: false, disposal: null, events: [], log: [],
      antennaStuck: false,
    },
  };
  const gen = run(ctx);
  return { ctx, next: (choice) => gen.next(choice) };
}

const phase = (id, label, years = 0) => ({ type: 'phase', phase: id, label, years });

function log(ctx, text, tone = 'info', fact = null) {
  const entry = { type: 'log', text, tone, fact, t: round1(ctx.live.t), phase: ctx.live.phase };
  ctx.live.log.push(entry);
  return entry;
}

function decision(ctx, id, role, title, text, options, fact = null) {
  return { type: 'decision', id, role, title, text, options, fact, t: round1(ctx.live.t) };
}

function recordChoice(ctx, d, choiceId) {
  const opt = d.options.find((o) => o.id === choiceId && !o.disabled) || d.options.find((o) => !o.disabled);
  ctx.live.events.push({ id: d.id, role: d.role, title: d.title, choice: opt.label, t: d.t });
  return opt.id;
}

function workingInstruments(ctx) {
  return ctx.L.instruments.filter((i) => ctx.live.working.has(i.id));
}

function loseInstrument(ctx, inst) {
  ctx.live.working.delete(inst.id);
}

/** Science and data for one year of operations. */
function yearOutcome(ctx, yearIndex, mods = {}) {
  const { L, M, live } = ctx;
  const insts = workingInstruments(ctx);
  if (!insts.length) return { value: 0, produced: 0, down: 0, dataFactor: 1, powerFactor: 1 };
  const imagingMult = mods.imagingMult ?? 1;
  const potential = insts.reduce((a, i) => a + scienceOf(L, i) * (i.type === 'imaging' ? imagingMult : 1), 0);
  const req = L.objective.required.some((id) => live.working.has(id)) ? 1 : 0.5;
  const produced = insts.reduce((a, i) => a + i.data, 0) * (mods.dataProdMult ?? 1);
  const down = dataRate(L, live.dataMult).mbPerDay;
  const dataFactor = produced > 0 ? Math.min(1, down / produced) : 1;
  const load = L.bus.basePower + L.mission.heaterW + L.antenna.power + insts.reduce((a, i) => a + i.power, 0);
  const required = L.power.kind === 'rtg' ? load : load * M.power.sizing;
  const gen = powerAt(L, M.cruise + M.aero + yearIndex - 0.5);
  const powerFactor = Math.min(1, gen / required);
  const battery = M.power.batteryOk ? 1 : 0.7;
  const yearMult = Math.max(0, 1 + (mods.yearBonus ?? 0));
  const value = (potential / L.mission.opsYears) * req * dataFactor * powerFactor * battery * live.sciMult * live.health * yearMult;
  return { value, produced: produced * 365, down: Math.min(produced, down) * 365, dataFactor, powerFactor };
}

function lose(ctx, reason, cause) {
  ctx.live.lost = true;
  ctx.live.lossReason = reason;
  ctx.live.lossCause = cause;
}

function* run(ctx) {
  const { L, M, diff, rnd, live } = ctx;
  const m = L.mission;
  const riskOn = diff.riskMult > 0;

  // ---------------- Development ----------------
  live.phase = 'development';
  yield phase('development', 'Development', L.testing.devYears);
  yield log(ctx, `Development begins. ${L.testing.name}: about ${L.testing.devYears} years to build and test the spacecraft.`);
  let devYears = L.testing.devYears;
  const pSupplier = diff.id === 'cadet' ? 0.35 : diff.id === 'director' ? 0.8 : 0.55;
  if (rnd() < pSupplier) {
    const overrun = round1(M.cost.dev * 0.12);
    const priciest = [...L.instruments].sort((a, b) => b.cost - a.cost)[0];
    const wrap = 1 + 0.3 * L.testing.wrapMult;
    const descopeSave = priciest ? round1(priciest.cost * wrap) : 0;
    const testSave = round1(M.cost.hardware * 0.3 * (L.testing.wrapMult - 0.7));
    const d = decision(ctx, 'supplier', 'planner', 'A supplier is late and over budget',
      `A key part is behind schedule. Finishing it on time will cost an extra ${fmtMoney(overrun)}. You have ${fmtMoney(live.reserve)} in reserve.`,
      [
        { id: 'pay', label: `Pay from the reserve (${fmtMoney(overrun)})`, detail: 'The reason reserves exist.',
          disabled: live.reserve < overrun, reason: 'Not enough reserve.' },
        { id: 'descope', label: priciest ? `Drop the ${priciest.name.toLowerCase()}` : 'Drop an instrument',
          detail: priciest ? `Saves ${fmtMoney(descopeSave)}, but you lose its science.` : '',
          disabled: L.instruments.length < 2, reason: 'You need to keep at least one instrument.' },
        { id: 'tests', label: 'Cut back on testing', detail: `Saves ${fmtMoney(testSave)}, but problems are more likely in space.`,
          disabled: L.testing.id === 'minimal', reason: 'Testing is already minimal.' },
        { id: 'delay', label: 'Delay launch by a year', detail: 'Costs nothing now, but the mission arrives later and loses points for slipping.' },
      ], D.FACTS.testing);
    const choice = recordChoice(ctx, d, yield d);
    if (choice === 'pay') { live.reserve -= overrun; yield log(ctx, `Paid ${fmtMoney(overrun)} from the reserve. The part arrives on time.`, 'warn'); }
    if (choice === 'descope') {
      live.working.delete(priciest.id); live.reserve += descopeSave - overrun;
      yield log(ctx, `Removed the ${priciest.name.toLowerCase()} to pay for the overrun.`, 'warn');
    }
    if (choice === 'tests') {
      ctx.testRisk = 2.0; live.reserve += testSave - overrun;
      yield log(ctx, 'Testing cut back. The money is found, but the spacecraft is less proven.', 'warn');
    }
    if (choice === 'delay') { devYears += 1; live.delayed = true; yield log(ctx, 'Launch delayed a year while the money is found.', 'warn'); }
  } else {
    yield log(ctx, 'Every part arrives on time and on budget. That almost never happens.', 'good');
  }

  const win = launchWindowWait(m, devYears);
  if (m.window && win.launchYear > M.timeline.launchYear + 0.01) {
    const extra = round1((win.launchYear - M.timeline.launchYear) * L.bus.opsPerYear * 1.5);
    live.reserve -= extra;
    yield log(ctx, `Missed the launch window. The next one opens ${round1(win.launchYear - M.timeline.launchYear)} years later, and keeping the team together costs ${fmtMoney(extra)}.`, 'bad', D.FACTS.window);
  } else if (M.timeline.wait > 0.01) {
    yield log(ctx, `The spacecraft is ready early and waits ${round1(M.timeline.wait)} years for the launch window.`, 'info', D.FACTS.window);
  }
  live.t = win.launchYear;

  // ---------------- Launch ----------------
  live.phase = 'launch';
  yield phase('launch', 'Launch');
  yield log(ctx, `Liftoff! A ${L.launcher.name.toLowerCase()} carries ${Math.round(M.mass.launchMass).toLocaleString('en-US')} kg toward ${m.body === 'earth' ? 'orbit' : m.body === 'jupiter' ? 'Jupiter' : m.body === 'moon' ? 'the Moon' : 'Mars'}.`);
  if (diff.launchFailure && rnd() < L.launcher.failRate) {
    lose(ctx, 'The rocket failed during launch. The spacecraft was destroyed.', 'launch');
    yield log(ctx, live.lossReason, 'bad');
    return finish(ctx);
  }
  yield log(ctx, `Separation confirmed. ${L.power.kind === 'solar' ? 'Solar arrays unfolded.' : 'Nuclear power source running.'} First signal received.`, 'good');

  if (L.antenna.deployable && riskOn && rnd() < D.DEPLOY_FAULT * ctx.testRisk * diff.riskMult) {
    live.antennaStuck = true;
    const full = dataRate(L).mbPerDay;
    const lga = dataRate({ ...L, antenna: byId(D.ANTENNAS, 'lga') }).mbPerDay;
    const ratio = Math.max(lga / full, 1e-6);
    const d = decision(ctx, 'antennaStuck', 'comms', 'The big antenna did not open',
      `The ${L.antenna.name.toLowerCase()} is stuck half-folded. Only the small backup antenna works, sending about ${fmtData(lga)} a day instead of ${fmtData(full)}.`,
      [
        { id: 'shake', label: 'Heat and cool it to shake it loose', detail: 'Might free it. Might not.' },
        { id: 'compress', label: 'Rewrite the software to compress data harder', detail: 'Gets much more through the small antenna, at some loss of quality.' },
      ], D.FACTS.data);
    const choice = recordChoice(ctx, d, yield d);
    if (choice === 'shake' && rnd() < 0.3) {
      live.antennaStuck = false;
      yield log(ctx, 'After weeks of heating and cooling, the antenna snapped open!', 'good');
    } else if (choice === 'shake') {
      live.dataMult = ratio;
      yield log(ctx, 'The antenna stays stuck. Data trickles home through the backup antenna.', 'bad');
    } else {
      live.dataMult = ratio * 8; live.sciMult *= 0.9;
      yield log(ctx, 'New compression software uploaded. Eight times more data gets through the small antenna.', 'warn');
    }
  }

  // ---------------- Cruise ----------------
  if (M.cruise > 0.05) {
    live.phase = 'cruise';
    yield phase('cruise', 'Cruise', M.cruise);
    if (L.trajectory === 'ga') yield log(ctx, 'Flying past Mars, then Earth, to borrow speed from each planet\'s gravity.');
    if (L.prop.lowThrust) yield log(ctx, 'The ion engine thrusts gently for months on end, glowing blue.', 'info', D.FACTS.ion);
    if (L.prop.lowThrust && !M.power.ionOk) {
      lose(ctx, `The ion engine needed ${D.ION_POWER_W} W but the power system made only ${Math.round(M.power.ionPower)} W. The spacecraft never reached its target.`, 'power');
      live.t += M.cruise;
      yield log(ctx, live.lossReason, 'bad', D.FACTS.power);
      return finish(ctx);
    }
    yield log(ctx, `Cruising for ${round1(M.cruise)} years. Small course corrections keep it on track.`);
    live.t += M.cruise;
  }

  // ---------------- Arrival ----------------
  live.phase = 'arrival';
  yield phase('arrival', 'Arrival');
  if (L.orbit.dv > 0) {
    if (L.prop.isp === 0) {
      lose(ctx, `With no engine to brake, the spacecraft flew straight past ${m.body === 'earth' ? 'its orbit' : m.place.replace(' orbit', '').replace('Jupiter system', 'Jupiter')}.`, 'engine');
      yield log(ctx, live.lossReason, 'bad', D.FACTS.fuel);
      return finish(ctx);
    }
    yield log(ctx, `Main engine burn: slowing down by ${L.orbit.dv.toFixed(1)} km/s to be captured into orbit.`);
    if (riskOn && rnd() < D.ENGINE_FAULT * ctx.testRisk * diff.riskMult) {
      lose(ctx, 'The engine shut down early during the orbit-insertion burn. The spacecraft could not be captured.', 'engine');
      yield log(ctx, live.lossReason, 'bad', D.FACTS.testing);
      return finish(ctx);
    }
    yield log(ctx, `Burn complete. Now in orbit: ${L.orbit.name}.`, 'good');
  } else {
    yield log(ctx, `Released into orbit: ${L.orbit.name}.`, 'good');
  }
  if (M.aero > 0) {
    yield log(ctx, 'Aerobraking: hundreds of careful dips into the upper atmosphere over about six months.', 'info', D.FACTS.aerobraking);
    if (riskOn && rnd() < 0.05 * ctx.testRisk * diff.riskMult) {
      live.health = 0.85;
      yield log(ctx, 'One dip went too deep and overheated a solar panel. Some power and pointing accuracy are lost for good.', 'bad');
    }
    live.t += M.aero;
  }

  // ---------------- Operations ----------------
  live.phase = 'operations';
  yield phase('operations', 'Science operations', live.opsYears);
  const missionEvents = m.events.slice(0, diff.missionEvents);
  const eventYear = { [missionEvents[0]]: 1 };
  if (missionEvents[1]) eventYear[missionEvents[1]] = Math.min(2, live.opsYears);
  const stormYear = diff.solarStorm ? 1 + Math.floor(rnd() * live.opsYears) : 0;

  let y = 0;
  while (y < live.opsYears) {
    y += 1;
    const mods = { yearBonus: y > L.mission.opsYears ? -0.5 : 0, imagingMult: 1, dataProdMult: 1 };
    let radThisYear = live.radMult;

    if (L.prop.isp === 0 && L.orbit.noEngine === 'decay' && y >= 2) {
      live.endedEarly = 'drag';
      yield log(ctx, 'Air drag has pulled the satellite down. It burned up harmlessly in the atmosphere, ending the mission early.', 'warn');
      break;
    }

    for (const ev of Object.keys(eventYear)) {
      if (eventYear[ev] !== y) continue;
      const r = yield* missionEvent(ctx, ev, mods);
      if (r?.radThisYear) radThisYear *= r.radThisYear;
      if (live.lost) return finish(ctx);
    }
    if (stormYear === y) {
      yield* solarStorm(ctx, mods);
    }

    // Electronics faults
    if (riskOn) {
      const p = D.ELECTRONICS_FAULT * L.orbit.radiation * L.shield.factor * ctx.testRisk * diff.riskMult * radThisYear;
      if (rnd() < p) {
        if (ctx.design.redundancy && !live.redundancyUsed) {
          live.redundancyUsed = true;
          yield log(ctx, 'Radiation scrambled the main computer. The spacecraft switched to its backup and kept working.', 'warn', D.FACTS.radiation);
        } else {
          lose(ctx, L.orbit.radiation >= 3
            ? 'Radiation damaged the flight computer beyond repair. Contact was lost.'
            : 'A critical electronics fault ended the mission. Contact was lost.', 'radiation');
          const part = yearOutcome(ctx, y, mods);
          live.science += part.value * 0.5; live.dataHome += part.down * 0.5; live.dataMade += part.produced * 0.5;
          live.t += 0.5; live.yearsFlown += 0.5;
          yield log(ctx, live.lossReason, 'bad', L.orbit.radiation >= 3 ? D.FACTS.radiation : D.FACTS.testing);
          return finish(ctx);
        }
      }
      for (const inst of workingInstruments(ctx)) {
        const pw = D.INSTRUMENT_WEAR * ctx.testRisk * diff.riskMult * Math.max(1, (L.orbit.radiation * L.shield.factor * radThisYear) / 2);
        if (rnd() < pw) {
          loseInstrument(ctx, inst);
          yield log(ctx, `The ${inst.name.toLowerCase()} stopped working.`, 'bad');
        }
      }
    }

    const out = yearOutcome(ctx, y, mods);
    live.science += out.value; live.dataHome += out.down; live.dataMade += out.produced;
    live.t += 1; live.yearsFlown += 1;
    const notes = [];
    if (out.dataFactor < 0.99) notes.push(`only ${Math.round(out.dataFactor * 100)}% of the data got home`);
    if (out.powerFactor < 0.99) notes.push(`power shortages kept instruments off ${Math.round((1 - out.powerFactor) * 100)}% of the time`);
    yield log(ctx, `Year ${y}${y > L.mission.opsYears ? ' (extended)' : ''}: ${out.value.toFixed(1)} science points, ${fmtData(out.down)} sent home${notes.length ? `; ${notes.join(', ')}` : ''}.`,
      out.value > 0 ? 'info' : 'warn');

    if (y === live.opsYears && !live.lost) {
      const cost = round1(L.bus.opsPerYear + L.ground.costPerYear);
      if (live.extended < 1 && workingInstruments(ctx).length) {
        const d = decision(ctx, 'extension', 'planner', y === L.mission.opsYears ? 'Planned mission complete!' : 'Another year done',
          `The spacecraft is still healthy. Another year costs ${fmtMoney(cost)} and, with ageing instruments and a smaller team, returns about half a normal year's science. You have ${fmtMoney(live.reserve)} left.`,
          [
            { id: 'extend', label: `Extend for one more year (${fmtMoney(cost)})`, detail: 'More science, more risk, less money left.',
              disabled: live.reserve < cost, reason: 'Not enough money left.' },
            { id: 'end', label: 'End the mission now', detail: 'Keep the money in the bank.' },
          ], D.FACTS.extension);
        const choice = recordChoice(ctx, d, yield d);
        if (choice === 'extend') {
          live.extended += 1; live.opsYears += 1; live.reserve -= cost;
          yield log(ctx, 'Mission extended for another year.', 'good');
        }
      }
    }
  }
  return finish(ctx);
}

function* missionEvent(ctx, ev, mods) {
  const { L, rnd, live, diff } = ctx;
  const has = (id) => live.working.has(id);
  if (ev === 'debris') {
    const d = decision(ctx, ev, 'engineer', 'Debris alert',
      'A dead rocket stage will pass within 150 metres in two days. At orbital speed, a collision would shatter both.',
      [
        { id: 'dodge', label: 'Fire thrusters to move out of the way', detail: 'Uses a little propellant. Safe.',
          disabled: L.prop.isp === 0, reason: 'This spacecraft has no thrusters.' },
        { id: 'hold', label: 'Hold course and hope it misses', detail: 'Most close passes miss. Not all.' },
      ], D.FACTS.debris);
    const choice = recordChoice(ctx, d, yield d);
    if (choice === 'dodge') { yield log(ctx, 'A short thruster burn moved the satellite safely out of the way.', 'good'); return null; }
    if (diff.riskMult > 0 && rnd() < 0.1 * diff.riskMult) {
      lose(ctx, 'The debris hit the satellite. It broke apart, adding even more junk to orbit.', 'debris');
      yield log(ctx, live.lossReason, 'bad', D.FACTS.debris);
      return null;
    }
    yield log(ctx, 'The debris passed by. Close, but no collision.', 'warn');
    return null;
  }
  if (ev === 'fireSeason') {
    const d = decision(ctx, ev, 'science', 'Record fire season',
      'Hundreds of new fires are burning. Everyone wants your data.',
      [
        { id: 'focus', label: 'Point every pass at the fire zones', detail: 'More fire science this year, but the instruments make 50% more data.' },
        { id: 'plan', label: 'Stick to the planned survey', detail: 'Keeps the long-term record consistent.' },
      ], D.FACTS.fires);
    const choice = recordChoice(ctx, d, yield d);
    if (choice === 'focus') {
      mods.dataProdMult = 1.5; mods.yearBonus += has('thermal') ? 0.35 : 0.1;
      yield log(ctx, has('thermal') ? 'The thermal imager tracked fire fronts hour by hour. Fire crews used the maps.' : 'Without a thermal imager, smoke hid most of the fires.', has('thermal') ? 'good' : 'warn');
    } else {
      mods.yearBonus += L.objective.id === 'map' ? 0.15 : 0;
      yield log(ctx, 'The survey continued as planned.');
    }
    return null;
  }
  if (ev === 'eclipse') {
    const insts = workingInstruments(ctx);
    const load = L.bus.basePower + L.mission.heaterW + L.antenna.power + insts.reduce((a, i) => a + i.power, 0);
    const need = Math.round((load * 3) / 0.8);
    const d = decision(ctx, ev, 'engineer', 'Lunar eclipse ahead',
      `Earth will block the Sun for about 3 hours, far longer than a normal orbit night. Keeping everything running needs about ${need} Wh. Your battery holds ${L.battery.wh} Wh.`,
      [
        { id: 'off', label: 'Switch off the instruments until the Sun returns', detail: 'Safe. Loses a day of science.' },
        { id: 'run', label: 'Keep everything running', detail: 'Risky if the battery is too small.' },
      ], D.FACTS.eclipse);
    const choice = recordChoice(ctx, d, yield d);
    if (choice === 'off') { mods.yearBonus -= 0.01; yield log(ctx, 'Instruments off, heaters on. The spacecraft rode out the eclipse safely.', 'good'); return null; }
    if (L.battery.wh >= need) {
      mods.yearBonus += has('thermal') ? 0.1 : 0;
      yield log(ctx, has('thermal') ? 'The battery held. The thermal imager measured how fast the surface cooled in the dark.' : 'The battery held, just.', 'good');
    } else {
      const victim = [...insts].sort((a, b) => b.power - a.power)[0];
      if (victim) loseInstrument(ctx, victim);
      live.health *= 0.9;
      yield log(ctx, `The battery ran flat. ${victim ? `The ${victim.name.toLowerCase()} froze and never recovered.` : 'Several parts were damaged by the cold.'}`, 'bad');
    }
    return null;
  }
  if (ev === 'budgetCut') {
    const remaining = Math.max(1, live.opsYears - live.yearsFlown);
    const cut = round1(0.3 * (L.bus.opsPerYear + L.ground.costPerYear) * remaining);
    const d = decision(ctx, ev, 'planner', 'Operations budget cut',
      `The agency is cutting operations money by 30%. That leaves a ${fmtMoney(cut)} gap.`,
      [
        { id: 'reserve', label: `Cover it from the reserve (${fmtMoney(cut)})`, detail: 'Nothing changes for the science team.',
          disabled: live.reserve < cut, reason: 'Not enough reserve.' },
        { id: 'contact', label: 'Book fewer ground-station hours', detail: 'Free, but 40% less data for the rest of the mission.' },
        { id: 'shorten', label: 'End the mission a year early', detail: 'Saves the money, loses the last year of science.',
          disabled: live.opsYears < 2, reason: 'The mission is only a year long.' },
      ]);
    const choice = recordChoice(ctx, d, yield d);
    if (choice === 'reserve') { live.reserve -= cut; yield log(ctx, 'The reserve covered the cut.', 'good'); }
    if (choice === 'contact') { live.dataMult *= 0.6; yield log(ctx, 'Ground-station time reduced. Less data will come home.', 'warn'); }
    if (choice === 'shorten') { live.opsYears -= 1; yield log(ctx, 'The mission will end a year early.', 'warn'); }
    return null;
  }
  if (ev === 'dustStorm') {
    const watchers = ['spectro', 'widecam', 'thermal'].some(has);
    const d = decision(ctx, ev, 'science', 'A planet-wide dust storm',
      'A dust storm is spreading over the whole of Mars. It will hide the surface for months.',
      [
        { id: 'study', label: 'Re-plan to study the storm', detail: 'A rare chance to watch a global storm, but makes 30% more data.' },
        { id: 'map', label: 'Keep mapping the surface', detail: 'The dust will blur most pictures.' },
      ]);
    const choice = recordChoice(ctx, d, yield d);
    if (choice === 'study') {
      mods.dataProdMult = 1.3; mods.yearBonus += watchers ? (L.objective.id === 'weather' ? 0.3 : 0.15) : 0.05;
      yield log(ctx, watchers ? 'Your instruments followed the storm from start to finish. Forecasters were thrilled.' : 'Without the right instruments there was little to see.', watchers ? 'good' : 'warn');
    } else {
      mods.imagingMult = 0.5;
      yield log(ctx, 'Months of pictures came back brown and blurry.', 'warn');
    }
    return null;
  }
  if (ev === 'conjunction') {
    const d = decision(ctx, ev, 'comms', 'Mars is passing behind the Sun',
      'For about two weeks the Sun sits between Earth and Mars and scrambles the radio signal.',
      [
        { id: 'pause', label: 'Upload two weeks of commands early, then stay quiet', detail: 'Loses two weeks of data. Safe.' },
        { id: 'push', label: 'Keep sending commands through the noise', detail: 'A garbled command could confuse the spacecraft.' },
      ], D.FACTS.conjunction);
    const choice = recordChoice(ctx, d, yield d);
    if (choice === 'pause') { mods.yearBonus -= 0.04; yield log(ctx, 'The spacecraft ran on its stored commands until Mars came back into view.', 'good'); }
    else if (rnd() < 0.35) { mods.yearBonus -= 0.17; yield log(ctx, 'A corrupted command sent the spacecraft into safe mode. It took two months to recover.', 'bad'); }
    else { yield log(ctx, 'The commands got through this time.', 'warn'); }
    return null;
  }
  if (ev === 'radiation') {
    const d = decision(ctx, ev, 'engineer', 'Radiation is stronger than expected',
      'Radiation near Europa is 40% stronger than the models predicted. Electronics are wearing out faster.',
      [
        { id: 'retreat', label: 'Fly fewer, higher flybys', detail: 'Much less radiation, but 15% less science.' },
        { id: 'stay', label: 'Keep the original plan', detail: 'Full science, more risk.' },
      ], D.FACTS.radiation);
    const choice = recordChoice(ctx, d, yield d);
    if (choice === 'retreat') { live.radMult *= 0.6; live.sciMult *= 0.85; yield log(ctx, 'The flyby plan was redesigned to spend less time in the worst radiation.', 'good'); }
    else { live.radMult *= 1.4; yield log(ctx, 'The team kept the original flybys and is watching the electronics closely.', 'warn'); }
    return null;
  }
  if (ev === 'plume') {
    const samplers = ['spectro', 'mag'].some(has);
    const d = decision(ctx, ev, 'science', 'A possible water plume',
      'A telescope on Earth has spotted what might be water erupting from Europa\'s south pole.',
      [
        { id: 'dive', label: 'Re-plan a flyby through the plume', detail: 'Could sample the ocean directly, but flies closer to Jupiter\'s radiation.' },
        { id: 'skip', label: 'Stay on the planned path', detail: 'No extra risk.' },
      ], D.FACTS.plume);
    const choice = recordChoice(ctx, d, yield d);
    if (choice === 'dive') {
      mods.yearBonus += samplers ? 0.35 : 0.1;
      yield log(ctx, samplers ? 'The spacecraft flew through the plume and measured salts and water from the ocean below!' : 'The flyby went through the plume, but no instrument could sample it.', samplers ? 'good' : 'warn');
      return { radThisYear: 1.3 };
    }
    yield log(ctx, 'The flyby plan stayed the same.');
    return null;
  }
  return null;
}

function* solarStorm(ctx, mods) {
  const { L, rnd, live, diff } = ctx;
  const d = decision(ctx, 'solarStorm', 'engineer', 'Solar storm incoming',
    'A burst of energetic particles from the Sun will hit the spacecraft tomorrow.',
    [
      { id: 'safe', label: 'Switch to safe mode for three days', detail: 'Loses a few days of science. Protects the instruments.' },
      { id: 'ride', label: 'Keep observing', detail: 'Storms can damage sensitive detectors.' },
    ]);
  const choice = recordChoice(ctx, d, yield d);
  if (choice === 'safe') { mods.yearBonus -= 0.01; yield log(ctx, 'Safe mode held. The storm passed without damage.', 'good'); return; }
  const shielded = L.mission.body === 'earth' ? 0.4 : 1;
  const insts = workingInstruments(ctx);
  if (diff.riskMult > 0 && insts.length && rnd() < 0.35 * L.shield.factor * shielded) {
    const victim = insts[Math.floor(rnd() * insts.length)];
    loseInstrument(ctx, victim);
    yield log(ctx, `The storm damaged the ${victim.name.toLowerCase()}.`, 'bad');
  } else {
    yield log(ctx, 'The storm passed. Everything still works.', 'good');
  }
}

/** Score the mission and explain what happened. */
export function finish(ctx) {
  const { L, M, live, diff } = ctx;
  live.phase = 'end';
  const target = L.objective.target;
  const ratio = live.science / target;
  const outcome = ratio >= 1 ? 'success' : ratio >= 0.5 ? 'partial' : 'failure';

  // Disposal
  const alive = !live.lost;
  let disposal = { ok: true, points: 0, text: '' };
  const d = L.mission.disposal;
  if (d === 'deorbit') {
    if (live.endedEarly === 'drag' || L.orbit.noEngine === 'decay') disposal = { ok: true, points: 100, text: 'The satellite re-entered and burned up, leaving no junk behind.' };
    else if (live.lossCause === 'debris') disposal = { ok: false, points: -150, text: 'The collision left a cloud of new debris in orbit.' };
    else if (alive && L.prop.isp > 0) disposal = { ok: true, points: 100, text: 'Thrusters lowered the orbit so the satellite will burn up in the atmosphere. Responsible.' };
    else if (live.lossCause === 'launch') disposal = { ok: true, points: 0, text: '' };
    else disposal = { ok: false, points: -150, text: 'The dead satellite will stay in orbit for decades as space junk.' };
  } else if (d === 'impact') {
    if (alive) disposal = { ok: true, points: 100, text: 'Steered into a crater at the end. Scientists studied the dust it kicked up.' };
  } else if (d === 'orbit') {
    if (alive) disposal = { ok: true, points: 100, text: 'Left in a long-lasting orbit so it cannot crash and carry Earth microbes onto Mars.' };
  } else if (d === 'jupiter') {
    if (alive) disposal = { ok: true, points: 100, text: 'Steered into Jupiter at the end, so it can never crash into Europa.' };
    else if (live.lossCause && live.lossCause !== 'launch' && live.lossCause !== 'engine' && live.lossCause !== 'power') {
      disposal = { ok: false, points: -150, text: 'Lost before it could be steered into Jupiter. There is a small chance it could one day hit Europa.' };
    }
  }
  live.disposal = disposal;

  const budget = M.cost.budget;
  const points = {
    science: Math.round(Math.min(ratio, 1.5) * 600),
    budget: live.reserve >= 0 ? Math.round((live.reserve / budget) * 400) : Math.round((live.reserve / budget) * 800),
    design: 50 * [M.mass.massMargin >= 0.15, M.power.powerMargin >= 0.15, M.data.dataFactor >= 1, M.power.batteryOk].filter(Boolean).length,
    survival: alive ? 100 : 0,
    responsibility: disposal.points,
    schedule: live.delayed ? -40 : 0,
  };
  const dataShare = live.dataMade > 0 ? live.dataHome / live.dataMade : 1;
  const goals = {
    planner: live.reserve >= 0.1 * budget,
    engineer: M.mass.massMargin >= 0.15 && M.power.powerMargin >= 0.15 && !['radiation', 'power', 'engine'].includes(live.lossCause),
    science: ratio >= 1.25,
    comms: dataShare >= 0.95 && live.dataMade > 0,
  };
  points.teamwork = 75 * Object.values(goals).filter(Boolean).length;
  const raw = Object.values(points).reduce((a, b) => a + b, 0);
  const total = Math.max(0, Math.round(raw * diff.scoreMult));
  let stars = 0;
  if (outcome === 'success') {
    stars = 1;
    if (ratio >= 1.25) stars = 2;
    if (stars === 2 && live.reserve >= 0.1 * budget && points.design >= 150) stars = 3;
  }

  return {
    outcome, ratio, science: live.science, target, lost: live.lost, lossReason: live.lossReason, lossCause: live.lossCause,
    points, total, stars, goals, dataShare, reserve: live.reserve, budget, disposal,
    yearsFlown: live.yearsFlown, extended: live.extended, events: live.events, log: live.log, redundancyUsed: live.redundancyUsed,
    lessons: lessons(ctx, { ratio, dataShare, disposal }), seed: ctx.seed, scored: diff.scoreMult > 0,
  };
}

function lessons(ctx, r) {
  const { L, M, live } = ctx;
  const out = [];
  const add = (title, text, fact) => out.push({ title, text, fact });
  if (live.lossCause === 'engine' && L.prop.isp === 0) add('Arriving takes braking', 'A spacecraft arrives at another world too fast to stay. It must fire an engine to slow down and be captured into orbit, and that takes propellant.', D.FACTS.fuel);
  if (live.lossCause === 'engine' && L.prop.isp > 0) add('Engines fail sometimes', 'Orbit insertion is a single burn that has to work. More testing makes a failure less likely.', D.FACTS.testing);
  if (live.lossCause === 'radiation') add('Radiation kills electronics', `This orbit is ${L.orbit.radiation} times harsher than near Earth. Shielding, a backup computer, and careful testing all lower the chance of a fatal fault.`, D.FACTS.radiation);
  if (live.lossCause === 'power') add('Power decides where you can go', 'Sunlight fades with the square of the distance from the Sun. Far out, you need giant arrays or a nuclear power source.', D.FACTS.power);
  if (live.lossCause === 'debris') add('Space is getting crowded', 'Thrusters let a satellite dodge debris and remove itself at the end of its life.', D.FACTS.debris);
  if (r.dataShare < 0.95 && live.dataMade > 0) add('Data that never reaches Earth is lost science', `Only ${Math.round(r.dataShare * 100)}% of your data got home. A radio signal fades with the square of the distance, so far missions need bigger dishes on the spacecraft and on the ground.`, D.FACTS.data);
  if (M.power.powerFactorEnd < 0.99) add('Power ran short', `By the end of the mission the spacecraft had ${Math.round(M.power.genEnd)} W for a ${Math.round(M.power.required)} W job. Arrays wear out over time, faster in radiation, so engineers size them for the end of the mission.`, L.mission.sunAU > 2 ? D.FACTS.power : D.FACTS.margin);
  if (!M.power.batteryOk) add('Orbit nights need batteries', 'Every orbit passes through shadow. The battery must carry the whole spacecraft until the Sun returns.', null);
  if (r.disposal && !r.disposal.ok) add('Leave space clean', r.disposal.text, L.mission.id === 'europa' ? D.FACTS.europaDisposal : D.FACTS.debris);
  if (live.reserve < 0) add('Budgets are real constraints', 'The mission spent more than it had. On a real project that means cancelled instruments, delays, or a cancelled mission.', null);
  if (M.timeline.wait > 0.01 || live.delayed) add('Time is a resource', 'Launch windows, testing and delays all cost time, and time costs money because the team must be paid while they wait.', D.FACTS.window);
  if (live.extended) add('Healthy spacecraft keep working', 'Extending a mission that is still healthy is one of the cheapest ways to get more science.', D.FACTS.extension);
  if (!out.length || r.ratio >= 1) add('Margins are what saved the mission', 'Spare mass, power and money absorb the surprises that every mission meets.', D.FACTS.margin);
  const special = { wildfire: D.FACTS.fires, moon: L.orbit.id === 'nrho' ? D.FACTS.nrho : D.FACTS.ice, mars: L.objective.id === 'water' ? D.FACTS.marsIce : D.FACTS.aerobraking, europa: D.FACTS.ocean }[L.mission.id];
  add('The real thing', '', special);
  return out;
}
