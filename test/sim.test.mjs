import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../js/data.js';
import { newDesign, sanitize } from '../js/model.js';
import { createMission } from '../js/sim.js';

const good = {
  wildfire: { orbitId: 'sso700', propulsionId: 'mono', instruments: ['thermal', 'widecam'], antennaId: 'mga', groundId: 'commercial', launcherId: 'rideshare' },
  moon: { orbitId: 'polar100', propulsionId: 'mono', instruments: ['neutron', 'radar', 'thermal'], antennaId: 'mga', groundId: 'commercial', batteryId: 'bat1000' },
  mars: { orbitId: 'mars_ellip', propulsionId: 'mono', instruments: ['spectro', 'widecam', 'thermal'], antennaId: 'hga1', groundId: 'dsn34', batteryId: 'bat1000', shieldingId: 'light' },
  europa: { orbitId: 'flybys', busId: 'medium', powerId: 'solar_xl', propulsionId: 'mono', shieldingId: 'vault', antennaId: 'hga25', groundId: 'dsn70', launcherId: 'heavy', instruments: ['mag', 'radar'], batteryId: 'bat1000', redundancy: true },
};
const design = (id, diff = 'engineer', extra = {}) => sanitize({ ...newDesign(id, diff), ...good[id], ...extra })[0];

/** Play a mission to the end. pick(decision) chooses an option id. */
function play(s, seed, pick = (d) => d.options.find((o) => !o.disabled).id) {
  const sim = createMission(s, seed);
  const steps = [];
  let r = sim.next();
  let guard = 0;
  while (!r.done) {
    steps.push(r.value);
    r = r.value.type === 'decision' ? sim.next(pick(r.value)) : sim.next();
    if (++guard > 500) throw new Error('simulation did not finish');
  }
  return { report: r.value, steps };
}

test('missions always finish with a valid report', () => {
  for (const m of D.MISSIONS) for (const diff of D.DIFFICULTY) for (let seed = 1; seed <= 40; seed++) {
    const { report } = play(design(m.id, diff.id), seed);
    assert.ok(['success', 'partial', 'failure'].includes(report.outcome));
    assert.ok(Number.isFinite(report.total) && report.total >= 0);
    assert.ok(report.stars >= 0 && report.stars <= 3);
  }
});

test('the same seed and choices give the same result', () => {
  const a = play(design('europa'), 1234).report;
  const b = play(design('europa'), 1234).report;
  assert.equal(a.total, b.total);
  assert.deepEqual(a.log.map((l) => l.text), b.log.map((l) => l.text));
});

test('a good design usually succeeds on Engineer difficulty', () => {
  for (const id of Object.keys(good)) {
    let wins = 0;
    for (let seed = 1; seed <= 200; seed++) if (play(design(id), seed).report.outcome === 'success') wins++;
    assert.ok(wins >= 120, `${id}: ${wins}/200`);
  }
});

test('no engine at Mars always fails at arrival', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const { report } = play(design('mars', 'engineer', { propulsionId: 'none' }), seed);
    assert.equal(report.outcome, 'failure');
    assert.ok(report.lost);
  }
});

test('sandbox has no random failures', () => {
  for (const id of Object.keys(good)) for (let seed = 1; seed <= 50; seed++) {
    const { report } = play(design(id, 'sandbox'), seed);
    assert.equal(report.lost, false, `${id} seed ${seed}: ${report.lossReason}`);
    assert.equal(report.scored, false);
  }
});

test('every decision offers at least one available option', () => {
  for (const m of D.MISSIONS) for (let seed = 1; seed <= 30; seed++) {
    const { steps } = play(design(m.id, 'director'), seed);
    for (const st of steps.filter((x) => x.type === 'decision')) assert.ok(st.options.some((o) => !o.disabled), st.id);
  }
});
