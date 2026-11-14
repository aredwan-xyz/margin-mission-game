import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../js/data.js';
import { evaluate, newDesign, sanitize, encodeDesign, decodeDesign, dataRate, lookup, launcherCapacity, compat } from '../js/model.js';

const good = {
  wildfire: { orbitId: 'sso700', propulsionId: 'mono', instruments: ['thermal', 'widecam'], antennaId: 'mga', groundId: 'commercial', launcherId: 'rideshare' },
  moon: { orbitId: 'polar100', propulsionId: 'mono', instruments: ['neutron', 'radar', 'thermal'], antennaId: 'mga', groundId: 'commercial', batteryId: 'bat1000' },
  mars: { orbitId: 'mars_ellip', propulsionId: 'mono', instruments: ['spectro', 'widecam', 'thermal'], antennaId: 'hga1', groundId: 'dsn34', batteryId: 'bat1000', shieldingId: 'light' },
  europa: { orbitId: 'flybys', busId: 'medium', powerId: 'solar_xl', propulsionId: 'mono', shieldingId: 'vault', antennaId: 'hga25', groundId: 'dsn70', launcherId: 'heavy', instruments: ['mag', 'radar'], batteryId: 'bat1000', redundancy: true },
};
const design = (id, extra = {}) => sanitize({ ...newDesign(id, 'engineer'), ...good[id], ...extra })[0];

test('every number is finite for every mission default', () => {
  for (const m of D.MISSIONS) for (const diff of D.DIFFICULTY) {
    const M = evaluate(newDesign(m.id, diff.id));
    for (const v of [M.cost.total, M.mass.launchMass, M.power.genEnd, M.data.mbPerDay, M.risk.lossChance]) assert.ok(Number.isFinite(v), `${m.id} ${diff.id}`);
  }
});

test('a known good design can launch and meets its science target', () => {
  for (const id of Object.keys(good)) {
    const M = evaluate(design(id));
    assert.ok(M.canLaunch, `${id}: ${M.checks.filter((c) => c.hard && c.level === 'fail').map((c) => c.title)}`);
    assert.ok(M.science.expected >= M.science.target, `${id} science ${M.science.expected}`);
    assert.ok(M.cost.reserve > 0, `${id} reserve`);
  }
});

test('the starting design shows problems to fix', () => {
  for (const m of D.MISSIONS) {
    const M = evaluate(newDesign(m.id));
    assert.ok(M.checks.some((c) => c.level === 'fail'), m.id);
  }
});

test('solar power falls with the square of the distance from the Sun', () => {
  const near = evaluate(design('wildfire')).power.genStart;
  const far = evaluate(design('mars', { powerId: 'solar_m' })).power.genStart;
  const ratio = near / far;
  assert.ok(Math.abs(ratio - 1.52 ** 2) < 0.15, `ratio ${ratio}`);
});

test('data rate falls with the square of distance and rises with antenna gain', () => {
  const L = lookup(design('moon'));
  const base = dataRate({ ...L, antenna: D.ANTENNAS[0], ground: D.GROUND[0] }).bps;
  const bigger = dataRate({ ...L, antenna: D.ANTENNAS[1], ground: D.GROUND[0] }).bps;
  assert.ok(bigger > base * 100);
  const twiceFar = dataRate({ ...L, antenna: D.ANTENNAS[0], ground: D.GROUND[0], orbit: { ...L.orbit, distanceKm: L.orbit.distanceKm * 2 } }).bps;
  assert.ok(Math.abs(base / twiceFar - 4) < 1e-6);
});

test('the rocket equation: a weaker engine needs much more propellant', () => {
  const mono = evaluate(design('europa', { propulsionId: 'mono' })).mass.propMass;
  const biprop = evaluate(design('europa', { propulsionId: 'biprop' })).mass;
  assert.ok(mono > biprop.propMass, 'monopropellant should need more fuel than bipropellant for the same trip');
});

test('no engine on a mission that must brake into orbit is flagged and scores zero science', () => {
  const M = evaluate(design('mars', { propulsionId: 'none' }));
  assert.ok(M.checks.some((c) => c.id === 'engine' && c.level === 'fail'));
  assert.equal(M.science.expected, 0);
});

test('a launcher that cannot reach the orbit is a hard stop', () => {
  const M = evaluate({ ...design('europa'), launcherId: 'medium', trajectory: 'direct' });
  assert.equal(M.canLaunch, false);
  // sanitize swaps it for a launcher that can get there
  assert.notEqual(sanitize({ ...design('europa'), launcherId: 'medium', trajectory: 'direct' })[0].launcherId, 'medium');
});

test('gravity assists double what a heavy launcher can send to Jupiter', () => {
  const heavy = D.LAUNCHERS.find((l) => l.id === 'heavy');
  const orbit = D.ORBITS.find((o) => o.id === 'flybys');
  assert.equal(launcherCapacity(heavy, orbit, 'ga'), 2 * launcherCapacity(heavy, orbit, 'direct'));
});

test('parts too big for the bus are not allowed', () => {
  const s = { ...newDesign('wildfire'), busId: 'cubesat' };
  assert.equal(compat(s, 'antenna', D.ANTENNAS.find((a) => a.id === 'hga25')).ok, false);
  const [clean] = sanitize({ ...s, antennaId: 'hga25', instruments: ['hirescam', 'widecam'] });
  assert.notEqual(clean.antennaId, 'hga25');
  assert.ok(!clean.instruments.includes('hirescam'));
});

test('a radiation vault and backup computer cut the risk at Europa', () => {
  const bare = evaluate(design('europa', { shieldingId: 'none', redundancy: false })).risk.lossChance;
  const safe = evaluate(design('europa')).risk.lossChance;
  assert.ok(safe < bare / 2, `${safe} vs ${bare}`);
});

test('share links round-trip and reject junk', () => {
  const s = design('mars');
  assert.deepEqual(decodeDesign(encodeDesign(s)), s);
  assert.equal(decodeDesign('not-a-design'), null);
});
