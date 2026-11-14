// Game data for Margin. All numbers are simplified, rounded and approximate. They are tuned
// so the trade-offs behave like real mission design (same direction, similar size), not to
// match any specific spacecraft. Money is in millions of US dollars ($M).

export const G0 = 9.80665;               // standard gravity, m/s²
export const ARRAY_W_PER_M2 = 229;        // solar array output at 1 AU after cell efficiency and losses
export const SOLAR_DEGRADE_PER_YEAR = 0.015; // array power lost per year at radiation level 1
export const RTG_DECAY_PER_YEAR = 0.03;   // RTG power lost per year
export const LINK_K = 5e4;                // data-rate constant, bps per watt at 2,000 km with baseline gains
export const LINK_REF_KM = 2000;
export const BATTERY_DOD = 0.5;           // usable fraction of a battery for long life
export const DV_MARGIN = 0.10;            // extra delta-v carried as margin
export const TANK_FRACTION = 0.10;        // tank and plumbing mass per kg of propellant
export const LAUNCH_ADAPTER = 0.05;       // launch adapter mass as a fraction of spacecraft mass
export const ION_POWER_W = 1300;          // power an ion engine needs while thrusting
export const ELECTRONICS_FAULT = 0.03;    // yearly chance of a serious electronics fault at radiation level 1
export const INSTRUMENT_WEAR = 0.02;      // yearly chance an instrument fails
export const ENGINE_FAULT = 0.03;         // chance the main engine fails during orbit insertion
export const DEPLOY_FAULT = 0.08;         // chance a folding antenna fails to open

export const ROLES = [
  { id: 'planner', name: 'Mission Planner', short: 'Planner', owns: 'Budget, time, orbit and launch',
    goal: 'Finish with at least 15% of the budget unspent.', colour: '#f2b84b' },
  { id: 'engineer', name: 'Spacecraft Engineer', short: 'Engineer', owns: 'Mass, power and survival',
    goal: 'Keep mass and power margins at 15% or more.', colour: '#5fb3ff' },
  { id: 'science', name: 'Science Lead', short: 'Science', owns: 'Instruments and science return',
    goal: 'Deliver at least 125% of the science target.', colour: '#8be08b' },
  { id: 'comms', name: 'Communications Lead', short: 'Comms', owns: 'Radio, ground stations and data',
    goal: 'Get every bit of data home, with 20% spare capacity.', colour: '#d58cff' },
];

export const DIFFICULTY = [
  { id: 'cadet', name: 'Cadet', text: 'More money, fewer surprises. Good for a first mission.',
    budgetMult: 1.25, riskMult: 0.5, launchFailure: false, missionEvents: 1, solarStorm: false, scoreMult: 0.8 },
  { id: 'engineer', name: 'Engineer', text: 'Realistic budgets and the occasional surprise.',
    budgetMult: 1.0, riskMult: 1.0, launchFailure: true, missionEvents: 2, solarStorm: false, scoreMult: 1.0 },
  { id: 'director', name: 'Flight Director', text: 'Tight budgets, more things go wrong.',
    budgetMult: 0.85, riskMult: 1.5, launchFailure: true, missionEvents: 2, solarStorm: true, scoreMult: 1.3 },
  { id: 'sandbox', name: 'Sandbox', text: 'Unlimited money and no random failures. Experiment freely; scores are not saved.',
    budgetMult: 20, riskMult: 0, launchFailure: false, missionEvents: 2, solarStorm: true, scoreMult: 0 },
];

export const MISSIONS = [
  {
    id: 'wildfire', name: 'Wildfire Watch', body: 'earth', place: 'Earth orbit', level: 'Beginner',
    tagline: 'Spot wildfires from space before they spread.',
    budget: 120, opsYears: 3, sunAU: 1, heaterW: 5, launcher: 'rideshare',
    cruiseYears: { direct: 0 }, window: null, disposal: 'deorbit',
    orbits: ['sso700', 'leo400', 'geo'], events: ['debris', 'fireSeason'],
    keyChallenge: 'Cheap and close, but the budget is small and space junk is real.',
    objectives: [
      { id: 'detect', name: 'Catch fires early',
        text: 'Find new wildfires within hours, so crews can reach them while they are small.',
        required: ['thermal'],
        requiredText: 'Carry a thermal infrared imager. A fire is a hot spot, and heat shows up in infrared even through smoke.',
        target: 7, orbitBonus: { geo: 1.6 },
        weights: { widecam: 2, hirescam: 1, thermal: 5, spectro: 2, neutron: 0, radar: 0, mag: 0 } },
      { id: 'map', name: 'Map the damage',
        text: 'Map burned land after each fire season, so forests can be restored.',
        required: ['widecam', 'hirescam'],
        requiredText: 'Carry a camera that can map burned land.',
        target: 7, orbitBonus: { leo400: 1.1 },
        weights: { widecam: 3, hirescam: 4, thermal: 3, spectro: 1, neutron: 0, radar: 1, mag: 0 } },
    ],
  },
  {
    id: 'moon', name: 'Lunar Ice Hunter', body: 'moon', place: 'Moon orbit', level: 'Intermediate',
    tagline: 'Find water ice for the first lunar base.',
    budget: 300, opsYears: 2, sunAU: 1, heaterW: 25, launcher: 'medium',
    cruiseYears: { direct: 0.1 }, window: null, disposal: 'impact',
    orbits: ['polar100', 'llo50', 'nrho'], events: ['eclipse', 'budgetCut'],
    keyChallenge: 'Lower orbits see more, but cost fuel to keep.',
    objectives: [
      { id: 'find', name: 'Find the ice',
        text: 'Map where hydrogen and ice hide in craters near the poles that never see sunlight.',
        required: ['neutron', 'radar', 'thermal'],
        requiredText: 'Carry an instrument that can sense ice or hydrogen: a neutron spectrometer, a radar, or a thermal imager to find the coldest craters.',
        target: 9, orbitBonus: {},
        weights: { widecam: 1, hirescam: 2, thermal: 3, spectro: 1, neutron: 5, radar: 4, mag: 0 } },
      { id: 'landing', name: 'Scout landing sites',
        text: 'Map flat, sunlit, safe landing sites near the south pole for astronauts.',
        required: ['hirescam'],
        requiredText: 'Carry a high-resolution camera. Boulders that could tip a lander are only a metre or two across.',
        target: 8, orbitBonus: {},
        weights: { widecam: 2, hirescam: 5, thermal: 3, spectro: 0, neutron: 1, radar: 2, mag: 0 } },
    ],
  },
  {
    id: 'mars', name: 'Mars Weather Station', body: 'mars', place: 'Mars orbit', level: 'Intermediate',
    tagline: 'Forecast dust storms for future Mars explorers.',
    budget: 350, opsYears: 2, sunAU: 1.52, heaterW: 30, launcher: 'medium',
    cruiseYears: { direct: 0.6 }, window: { first: 3.0, every: 2.14 }, disposal: 'orbit',
    orbits: ['mars_low_aero', 'mars_low_burn', 'mars_ellip'], events: ['dustStorm', 'conjunction'],
    keyChallenge: 'Less sunlight, a long radio link, and a launch window every 26 months.',
    objectives: [
      { id: 'weather', name: 'Daily weather report',
        text: 'Track clouds, dust storms and temperature across the whole planet every day.',
        required: ['spectro', 'widecam'],
        requiredText: 'Carry an atmospheric spectrometer or a wide-field camera to watch the whole atmosphere.',
        target: 9, orbitBonus: { mars_ellip: 1.3 },
        weights: { widecam: 4, hirescam: 1, thermal: 3, spectro: 5, neutron: 0, radar: 0, mag: 1 } },
      { id: 'water', name: 'Hunt for buried ice',
        text: 'Find ice under the surface that future crews could mine for water.',
        required: ['radar', 'neutron'],
        requiredText: 'Carry a radar sounder or a neutron spectrometer to see below the surface.',
        target: 9, orbitBonus: {},
        weights: { widecam: 1, hirescam: 2, thermal: 2, spectro: 1, neutron: 4, radar: 5, mag: 1 } },
    ],
  },
  {
    id: 'europa', name: 'Europa Ocean Explorer', body: 'jupiter', place: 'Jupiter system', level: 'Advanced',
    tagline: 'Find out if the ocean under Europa\'s ice could support life.',
    budget: 1000, opsYears: 4, sunAU: 5.2, heaterW: 60, launcher: 'heavy',
    cruiseYears: { direct: 2.5, ga: 5.5 }, window: { first: 3.0, every: 1.1 }, disposal: 'jupiter',
    orbits: ['flybys', 'highJupiter', 'europaOrbit'], events: ['radiation', 'plume'],
    keyChallenge: 'Weak sunlight, a huge distance, and radiation that destroys electronics.',
    objectives: [
      { id: 'ocean', name: 'Confirm the ocean',
        text: 'Measure how deep the ice is and prove there is salty liquid water beneath it.',
        required: ['mag', 'radar'],
        requiredText: 'Carry a magnetometer or an ice-penetrating radar. A salty ocean bends Jupiter\'s magnetic field, and radar can see through ice.',
        target: 9, orbitBonus: {},
        weights: { widecam: 1, hirescam: 2, thermal: 2, spectro: 2, neutron: 0, radar: 5, mag: 5 } },
      { id: 'surface', name: 'Map the surface',
        text: 'Map cracks, ridges and fresh material that came up from the ocean.',
        required: ['hirescam', 'thermal'],
        requiredText: 'Carry a high-resolution camera or a thermal imager to find fresh, warm material.',
        target: 10, orbitBonus: {},
        weights: { widecam: 3, hirescam: 5, thermal: 4, spectro: 3, neutron: 0, radar: 2, mag: 1 } },
    ],
  },
];

// sci: how well each instrument type works from this orbit (1 = normal).
export const ORBITS = [
  { id: 'sso700', name: 'Sun-synchronous orbit, 700 km', body: 'earth',
    text: 'Passes over every place at the same local time each day, so pictures are easy to compare. The usual choice for watching Earth.',
    dv: 0, dvPerYear: 0.005, disposalDv: 0.15, periodH: 1.65, eclipseH: 0.58, distanceKm: 2000, contactMult: 1,
    radiation: 0.6, launchClass: 'sso', noEngine: 'debris',
    sci: { imaging: 1, survey: 1.1, sounding: 1, field: 1 }, altitudeKm: 700 },
  { id: 'leo400', name: 'Low orbit, 400 km', body: 'earth',
    text: 'Closer means sharper pictures. But the thin air up here drags the satellite down, so it needs thrusters to stay up.',
    dv: 0, dvPerYear: 0.05, disposalDv: 0.05, periodH: 1.54, eclipseH: 0.6, distanceKm: 1500, contactMult: 1,
    radiation: 0.4, launchClass: 'leo', noEngine: 'decay',
    sci: { imaging: 1.25, survey: 1, sounding: 1.1, field: 1 }, altitudeKm: 400 },
  { id: 'geo', name: 'Geostationary orbit, 35,786 km', body: 'earth',
    text: 'Matches Earth\'s spin, so it hovers over one region and watches it all the time. So far away that pictures are blurry, and getting there needs a big engine burn.',
    dv: 1.5, dvPerYear: 0.05, disposalDv: 0.012, periodH: 24, eclipseH: 1.2, distanceKm: 38000, contactMult: 6,
    radiation: 1.2, launchClass: 'gto', noEngine: 'fail',
    sci: { imaging: 0.6, survey: 0.8, sounding: 0.3, field: 1 }, altitudeKm: 35786 },

  { id: 'polar100', name: 'Polar orbit, 100 km', body: 'moon',
    text: 'Passes over both poles every two hours. A good balance of detail and fuel.',
    dv: 0.9, dvPerYear: 0.05, disposalDv: 0.02, periodH: 2.0, eclipseH: 0.8, distanceKm: 384400, contactMult: 1,
    radiation: 1, launchClass: 'tli', noEngine: 'fail',
    sci: { imaging: 1, survey: 1, sounding: 1, field: 1 }, altitudeKm: 100 },
  { id: 'llo50', name: 'Very low polar orbit, 50 km', body: 'moon',
    text: 'The sharpest view and the strongest signal for instruments that count particles. Lumpy lunar gravity tugs the orbit out of shape, so it burns fuel every month.',
    dv: 0.95, dvPerYear: 0.15, disposalDv: 0.02, periodH: 1.9, eclipseH: 0.8, distanceKm: 384400, contactMult: 1,
    radiation: 1, launchClass: 'tli', noEngine: 'fail',
    sci: { imaging: 1.3, survey: 1.3, sounding: 1.2, field: 1 }, altitudeKm: 50 },
  { id: 'nrho', name: 'Near-rectilinear halo orbit', body: 'moon',
    text: 'The long, looping orbit chosen for the Gateway station. Cheap to reach and keep, almost always in view of Earth, but far from the surface most of the time.',
    dv: 0.45, dvPerYear: 0.01, disposalDv: 0.05, periodH: 156, eclipseH: 0.1, distanceKm: 384400, contactMult: 2,
    radiation: 1, launchClass: 'tli', noEngine: 'fail',
    sci: { imaging: 0.45, survey: 0.3, sounding: 0.3, field: 1 }, altitudeKm: 3000 },

  { id: 'mars_low_aero', name: 'Low orbit using aerobraking', body: 'mars',
    text: 'Arrive in a loose orbit, then dip into the thin upper atmosphere hundreds of times to slow down. Saves half the fuel but takes about six months, with a small risk of overheating.',
    dv: 1.0, dvPerYear: 0.02, disposalDv: 0, periodH: 1.95, eclipseH: 0.7, distanceKm: 2.25e8, contactMult: 1,
    radiation: 1, launchClass: 'mars', noEngine: 'fail', aeroYears: 0.5,
    sci: { imaging: 1, survey: 1, sounding: 1, field: 1 }, altitudeKm: 300 },
  { id: 'mars_low_burn', name: 'Low orbit using the engine only', body: 'mars',
    text: 'Brake straight into a low orbit with one long engine burn. Quick and simple, but it needs twice the fuel.',
    dv: 2.0, dvPerYear: 0.02, disposalDv: 0, periodH: 1.95, eclipseH: 0.7, distanceKm: 2.25e8, contactMult: 1,
    radiation: 1, launchClass: 'mars', noEngine: 'fail',
    sci: { imaging: 1, survey: 1, sounding: 1, field: 1 }, altitudeKm: 300 },
  { id: 'mars_ellip', name: 'High elliptical orbit', body: 'mars',
    text: 'Cheaper to reach. Swings high above the planet to see the whole globe at once, then dips closer. Good for weather, poor for close-up detail.',
    dv: 0.8, dvPerYear: 0.01, disposalDv: 0, periodH: 12, eclipseH: 0.6, distanceKm: 2.25e8, contactMult: 1,
    radiation: 1, launchClass: 'mars', noEngine: 'fail',
    sci: { imaging: 0.6, survey: 0.9, sounding: 0.4, field: 1.1 }, altitudeKm: 4000 },

  { id: 'flybys', name: 'Jupiter orbit with dozens of Europa flybys', body: 'jupiter',
    text: 'Dive past Europa, collect data, then swing back out of the worst radiation to send it home. This is how Europa Clipper works.',
    dv: 0.9, dvPerYear: 0.05, disposalDv: 0.05, periodH: 336, eclipseH: 0.5, distanceKm: 7.8e8, contactMult: 1,
    radiation: 4, launchClass: 'jupiter', noEngine: 'fail',
    sci: { imaging: 1, survey: 1, sounding: 1, field: 1 }, altitudeKm: 50 },
  { id: 'highJupiter', name: 'Distant Jupiter orbit', body: 'jupiter',
    text: 'Stays far out where the radiation is milder. Safe, but Europa is always seen from far away.',
    dv: 0.6, dvPerYear: 0.02, disposalDv: 0.05, periodH: 1000, eclipseH: 0.5, distanceKm: 7.8e8, contactMult: 1,
    radiation: 1.5, launchClass: 'jupiter', noEngine: 'fail',
    sci: { imaging: 0.5, survey: 0.6, sounding: 0.2, field: 0.7 }, altitudeKm: 600000 },
  { id: 'europaOrbit', name: 'Orbit around Europa', body: 'jupiter',
    text: 'Circle Europa itself for the most science per day. Getting captured takes a lot of fuel, and the radiation there is brutal.',
    dv: 2.0, dvPerYear: 0.08, disposalDv: 0.4, periodH: 2.2, eclipseH: 0.7, distanceKm: 7.8e8, contactMult: 1,
    radiation: 10, launchClass: 'jupiter', noEngine: 'fail',
    sci: { imaging: 1.4, survey: 1.4, sounding: 1.4, field: 1.5 }, altitudeKm: 100 },
];

export const BUSES = [
  { id: 'cubesat', name: '12U CubeSat', text: 'A shoebox-sized satellite built from standard 10 cm units. Very cheap, very little room.',
    dryMass: 8, maxAdd: 16, maxProp: 2, basePower: 6, cost: 2, opsPerYear: 0.5, redundancyMass: 1, rank: 0 },
  { id: 'small', name: 'Small satellite', text: 'About the size of a washing machine. Room for a few instruments.',
    dryMass: 90, maxAdd: 200, maxProp: 300, basePower: 35, cost: 25, opsPerYear: 3, redundancyMass: 8, rank: 1 },
  { id: 'medium', name: 'Medium spacecraft', text: 'About the size of a car. Can carry big antennas, a radiation vault and large fuel tanks.',
    dryMass: 350, maxAdd: 650, maxProp: 1500, basePower: 90, cost: 90, opsPerYear: 8, redundancyMass: 20, rank: 2 },
  { id: 'large', name: 'Large spacecraft', text: 'About the size of a small bus. Carries almost anything, at a big price.',
    dryMass: 1100, maxAdd: 2500, maxProp: 4000, basePower: 200, cost: 250, opsPerYear: 20, redundancyMass: 40, rank: 3 },
];

export const POWER = [
  { id: 'solar_s', name: 'Small solar array (1 m²)', kind: 'solar', area: 1, mass: 4, cost: 0.6,
    text: 'Enough for a small satellite near Earth.' },
  { id: 'solar_m', name: 'Medium solar array (5 m²)', kind: 'solar', area: 5, mass: 18, cost: 3,
    text: 'Two folding wings. Plenty near Earth, less at Mars.' },
  { id: 'solar_l', name: 'Large solar array (15 m²)', kind: 'solar', area: 15, mass: 55, cost: 9, minBus: 'small',
    text: 'Big wings for power-hungry instruments or distant targets.' },
  { id: 'solar_xl', name: 'Giant solar array (60 m²)', kind: 'solar', area: 60, mass: 220, cost: 35, minBus: 'medium',
    text: 'Wings as long as a basketball court. The only way to run on sunlight at Jupiter.' },
  { id: 'rtg1', name: 'Nuclear power source (1 RTG)', kind: 'rtg', watts: 110, mass: 45, cost: 70, minBus: 'small',
    text: 'Turns heat from decaying plutonium into steady electricity. Works anywhere, even in the dark. Scarce and expensive.' },
  { id: 'rtg3', name: 'Nuclear power source (3 RTGs)', kind: 'rtg', watts: 330, mass: 135, cost: 200, minBus: 'medium',
    text: 'Three generators for a big outer-planet spacecraft.' },
];

export const BATTERIES = [
  { id: 'bat40', name: 'Tiny battery (40 Wh)', wh: 40, mass: 0.5, cost: 0.1 },
  { id: 'bat200', name: 'Small battery (200 Wh)', wh: 200, mass: 2, cost: 0.4 },
  { id: 'bat1000', name: 'Medium battery (1,000 Wh)', wh: 1000, mass: 8, cost: 1.5 },
  { id: 'bat4000', name: 'Large battery (4,000 Wh)', wh: 4000, mass: 30, cost: 4, minBus: 'small' },
];

export const PROPULSION = [
  { id: 'none', name: 'No propulsion', isp: 0, dryMass: 0, cost: 0,
    text: 'Lighter and cheaper. The spacecraft goes wherever the rocket leaves it, and stays there.' },
  { id: 'coldgas', name: 'Cold-gas thrusters', isp: 65, dryMass: 3, cost: 0.8,
    text: 'Puffs of compressed gas. Simple and safe, but weak. Fine for small nudges.' },
  { id: 'mono', name: 'Monopropellant thrusters', isp: 220, dryMass: 15, cost: 4,
    text: 'The workhorse for small orbit changes and dodging debris.' },
  { id: 'biprop', name: 'Bipropellant main engine', isp: 318, dryMass: 60, cost: 14, minBus: 'small',
    text: 'Two chemicals that ignite on contact. Strong enough to brake into orbit around another world.' },
  { id: 'ion', name: 'Ion engine', isp: 3000, dryMass: 45, cost: 25, minBus: 'small', lowThrust: true,
    text: 'Ten times more fuel-efficient than chemical engines, but its push is gentle: trips take longer and it needs 1.3 kW of electricity.' },
];

export const SHIELDING = [
  { id: 'none', name: 'No extra shielding', factor: 1, mass: 0, cost: 0, text: 'Electronics rely on their own small protection.' },
  { id: 'light', name: 'Light shielding', factor: 0.6, mass: 10, cost: 1, text: 'Aluminium plates around the most sensitive parts.' },
  { id: 'vault', name: 'Radiation vault', factor: 0.15, mass: 150, cost: 15, minBus: 'medium',
    text: 'A thick titanium box around the computer and electronics, like the one on Juno.' },
];

export const ANTENNAS = [
  { id: 'lga', name: 'Low-gain antenna', gain: 1, txW: 2, power: 7, mass: 1, cost: 0.3, maxBps: 1e6,
    text: 'Sends a weak signal in all directions. No pointing needed.' },
  { id: 'mga', name: 'Medium-gain antenna (0.5 m)', gain: 316, txW: 10, power: 30, mass: 6, cost: 2, maxBps: 25e6,
    text: 'A small dish. Focuses the signal about 300 times better.' },
  { id: 'hga1', name: 'High-gain dish (1 m)', gain: 5000, txW: 20, power: 60, mass: 18, cost: 8, maxBps: 50e6, minBus: 'small',
    text: 'A focused beam that must point accurately at Earth.' },
  { id: 'hga25', name: 'High-gain dish (2.5 m)', gain: 31600, txW: 25, power: 80, mass: 45, cost: 20, maxBps: 100e6, minBus: 'medium', deployable: true,
    text: 'A big dish for the outer planets. Folds up for launch and opens in space.' },
];

export const GROUND = [
  { id: 'uni', name: 'University ground station', g: 1, hours: 1, costPerYear: 0.2,
    text: 'A small dish on a campus roof. Cheap, but only a few short passes a day.' },
  { id: 'commercial', name: 'Commercial ground network', g: 3162, hours: 4, costPerYear: 2,
    text: 'Rent time on 7 m dishes around the world.' },
  { id: 'dsn34', name: 'Deep Space Network, 34 m dishes', g: 316000, hours: 6, costPerYear: 6,
    text: 'NASA\'s giant dishes in California, Spain and Australia. One is always facing your spacecraft.' },
  { id: 'dsn70', name: 'Deep Space Network, 70 m dish', g: 1580000, hours: 3, costPerYear: 10,
    text: 'The biggest dishes on the network. Hard to book, so you get fewer hours.' },
];

// type decides which orbit multiplier applies.
export const INSTRUMENTS = [
  { id: 'widecam', name: 'Wide-field camera', type: 'imaging', mass: 8, power: 12, cost: 6, data: 600,
    text: 'Sees a wide area at once. Good for clouds, smoke and big patterns.' },
  { id: 'hirescam', name: 'High-resolution camera', type: 'imaging', mass: 35, power: 35, cost: 30, data: 4000, minBus: 'small',
    text: 'A telescope that sees details a metre across. Produces huge pictures.' },
  { id: 'thermal', name: 'Thermal infrared imager', type: 'imaging', mass: 12, power: 20, cost: 15, data: 900,
    text: 'Sees heat. Spots fires, warm cracks and the coldest craters.' },
  { id: 'spectro', name: 'Atmospheric spectrometer', type: 'survey', mass: 20, power: 25, cost: 18, data: 300,
    text: 'Splits light into colours to measure gases, dust and temperature in an atmosphere.' },
  { id: 'neutron', name: 'Neutron spectrometer', type: 'survey', mass: 12, power: 8, cost: 10, data: 5,
    text: 'Counts particles bouncing off the surface. Hydrogen, and so water ice, changes the count.' },
  { id: 'radar', name: 'Radar sounder', type: 'sounding', mass: 45, power: 70, cost: 40, data: 3000, minBus: 'small',
    text: 'Sends radio pulses that pass through ice and rock and echo back from layers below.' },
  { id: 'mag', name: 'Magnetometer', type: 'field', mass: 5, power: 4, cost: 4, data: 2,
    text: 'Measures magnetic fields. A salty ocean under ice disturbs the field around it.' },
];

// capacity in kg to each orbit class. jupiter_ga = with gravity assists.
export const LAUNCHERS = [
  { id: 'rideshare', name: 'Rideshare slot', example: 'shares a rocket with dozens of other satellites',
    perKg: 0.0065, minCost: 0.5, failRate: 0.03,
    cap: { leo: 200, sso: 200, gto: 0, tli: 0, mars: 0, jupiter: 0, jupiter_ga: 0 } },
  { id: 'small', name: 'Small launcher', example: 'a dedicated rocket for small satellites',
    cost: 8, failRate: 0.06,
    cap: { leo: 300, sso: 250, gto: 0, tli: 30, mars: 0, jupiter: 0, jupiter_ga: 0 } },
  { id: 'medium', name: 'Medium launcher', example: 'the most common size of rocket',
    cost: 70, failRate: 0.02,
    cap: { leo: 15000, sso: 12000, gto: 5500, tli: 3500, mars: 1800, jupiter: 0, jupiter_ga: 1500 } },
  { id: 'heavy', name: 'Heavy launcher', example: 'several rocket cores strapped together',
    cost: 150, failRate: 0.03,
    cap: { leo: 60000, sso: 50000, gto: 20000, tli: 12000, mars: 9000, jupiter: 3000, jupiter_ga: 6000 } },
  { id: 'superheavy', name: 'Super-heavy launcher', example: 'the class of rocket built for crewed Moon missions',
    cost: 2000, failRate: 0.05,
    cap: { leo: 95000, sso: 80000, gto: 35000, tli: 27000, mars: 20000, jupiter: 8000, jupiter_ga: 16000 } },
];

export const TESTING = [
  { id: 'minimal', name: 'Minimal testing', devYears: 2, wrapMult: 0.7, risk: 2.0,
    text: 'Test only the essentials. Fast and cheap, but problems are found in space.' },
  { id: 'standard', name: 'Standard testing', devYears: 3, wrapMult: 1, risk: 1,
    text: 'Shake, heat, cool and vacuum-test the whole spacecraft.' },
  { id: 'thorough', name: 'Thorough testing', devYears: 4, wrapMult: 1.5, risk: 0.5,
    text: '"Test like you fly": rehearse the entire mission on the ground. Slow and expensive, far fewer surprises.' },
];

export const TRAJECTORIES = [
  { id: 'direct', name: 'Direct route', text: 'Fly straight there. Quicker, but the rocket must do all the work.' },
  { id: 'ga', name: 'Gravity assists', text: 'Swing past Mars and Earth to steal some of their orbital speed. The rocket can lift twice the mass, but the trip takes three years longer.' },
];

// Short, true background facts used in tips and debriefs.
export const FACTS = {
  data: 'Galileo\'s big antenna never unfolded after it left Earth in 1989. The team rewrote the software to squeeze its science through a backup low-gain antenna at a tiny fraction of the planned rate.',
  power: 'Juno is the first spacecraft to run on sunlight at Jupiter. Its three solar wings are each about 9 metres long, because sunlight there is about 25 times weaker than at Earth.',
  rtg: 'New Horizons and both Voyagers run on nuclear power sources, because sunlight is far too weak where they fly.',
  radiation: 'Juno and Europa Clipper keep their most sensitive electronics inside a thick titanium vault to survive Jupiter\'s radiation.',
  fuel: 'Cassini launched weighing about 5.7 tonnes, and more than half of that was propellant.',
  aerobraking: 'Mars Reconnaissance Orbiter spent about five months in 2006 dipping into the Martian atmosphere to lower its orbit, instead of carrying the fuel to do it.',
  window: 'Earth and Mars line up for an efficient trip only about once every 26 months. Miss the window and you wait for the next one.',
  units: 'Mars Climate Orbiter was lost in 1999 because one team used imperial units and another used metric. Careful checks and reviews exist to catch errors like that.',
  testing: 'Engineers say "test like you fly": rehearse the mission on the ground exactly as it will happen in space, so surprises are found where they can still be fixed.',
  extension: 'Opportunity was built to drive on Mars for 90 days. It kept working for almost 15 years.',
  debris: 'Satellites in low orbit are expected to be removed after their mission, by burning up in the atmosphere, so they do not become space junk.',
  fires: 'NASA\'s FIRMS service uses thermal sensors on polar-orbiting satellites to map active fires around the world, usually within hours.',
  ice: 'In 1998 Lunar Prospector\'s neutron spectrometer found extra hydrogen at the Moon\'s poles, a strong hint of water ice in permanently dark craters.',
  eclipse: 'During a lunar eclipse in 2014, NASA\'s Lunar Reconnaissance Orbiter switched off its instruments to save battery power while it sat in Earth\'s shadow.',
  marsIce: 'Radar sounders orbiting Mars have found thick sheets of buried ice in its middle latitudes.',
  ocean: 'Galileo\'s magnetometer found that Europa disturbs Jupiter\'s magnetic field the way a salty ocean would, one of the best clues that the ocean exists.',
  europaDisposal: 'In 2003 Galileo was steered into Jupiter on purpose, so it could never crash into Europa and carry Earth microbes into its ocean.',
  conjunction: 'Every two years or so Mars passes behind the Sun as seen from Earth. Mission teams stop sending commands for about two weeks, because the Sun scrambles the signal.',
  nrho: 'The CAPSTONE CubeSat was the first spacecraft to fly the near-rectilinear halo orbit planned for the Gateway station, in 2022.',
  ion: 'Dawn used ion engines to orbit two different worlds, the asteroid Vesta and the dwarf planet Ceres.',
  plume: 'The Hubble Space Telescope has spotted possible plumes of water vapour above Europa, though they have not been confirmed.',
  margin: 'Early in a project, NASA teams typically carry 20 to 30 percent spare mass and power, because designs almost always grow.',
};
