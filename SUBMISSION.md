# Space Apps 2026 project page: draft

Paste these into the team's project page on spaceappschallenge.org. The site's field names
may differ slightly; match each section to the closest field. Check the Project Submission
Guide (published Nov 13) for required fields and the deadline set by the St. John's event.

**Challenge:** Space Mission Design Game

## Project name

Margin

## High-level summary

Margin is a browser game where students design a whole space mission and fly it. Players
start by choosing an objective. They then pick an orbit and a rocket, build the spacecraft,
choose instruments, and set up the radio link. Every choice costs mass, power, money, data
and time, and live gauges show how much margin is left. A design review checks the plan
before launch. The mission then plays out with real-world surprises and decisions, and ends
with a report explaining why it succeeded or failed.

It works alone or for teams of four. Each team member takes a role with a goal that pulls
against the others: the Planner guards the budget, the Engineer the margins, the Science
Lead the science, and Communications the data.

## Links

- Play: https://aredwan-xyz.github.io/margin-mission-game/
- Code: https://github.com/aredwan-xyz/margin-mission-game
- Demo video: (record a 30-second screen capture: pick Europa, add instruments, watch the power gauge go red, fix it with giant solar wings, launch, make one decision, show the report)

## Project details

**What it does.** There are four missions of rising difficulty, each with two possible
objectives:

- Wildfire Watch, in Earth orbit
- Lunar Ice Hunter, at the Moon
- Mars Weather Station, at Mars
- Europa Ocean Explorer, in the Jupiter system

Players design across four roles:

- **Mission Planner:** objective, orbit, route, rocket and testing
- **Spacecraft Engineer:** spacecraft size, power, battery, propulsion, radiation shielding and backups
- **Science Lead:** seven instruments
- **Communications Lead:** antenna and ground stations

Each option shows its consequence before it is chosen. Examples: how much fuel this engine
needs for this trip, how much power these solar arrays make at Mars, how much data this dish
gets home from Jupiter.

**How it works.** A simplified engineering model ties the resources together, so changing one
part moves the others:

- **Power:** solar power falls with the square of the distance from the Sun.
- **Data:** radio data rate falls with the square of the distance and rises with antenna size.
- **Propellant:** follows the rocket equation.
- **Launch:** each rocket has a capacity to each orbit, and gravity assists double what
  reaches Jupiter.
- **Cost:** includes development, testing, launch, operations and waiting for launch windows.
- **Risk:** comes from the launch, the engine burn on arrival, and radiation, and is reduced
  by shielding, backups and testing.

The mission simulation is seeded, so a run can be replayed and compared. It includes
decisions drawn from real missions:

- a supplier overrun
- dodging debris
- powering down through a lunar eclipse
- a global dust storm on Mars
- solar conjunction
- a stuck antenna, as happened to Galileo
- radiation stronger than expected
- a possible plume at Europa
- whether to extend a healthy mission

**Why it matters.** Students usually meet orbits, power, communications and budgets as
separate topics. Margin makes them interact. Students see why a Europa spacecraft needs
solar wings 27 times larger than one at Earth, why most of a deep-space spacecraft is fuel,
and why real teams keep 20 to 30% in reserve. Every failure comes with a plain-language
explanation and a true story from a real mission.

**Design choices.**

- No single right answer: an automated search confirms each mission has several different
  winning designs.
- Learning by failing: most problems do not block launch. Players can fly a flawed design
  and see exactly why it failed.
- Accessible: it runs in any browser with no install and works on phones. It supports
  keyboard use and reduced motion.
- Difficulty: Cadet, Engineer, Flight Director, or Sandbox for free experimentation.
- Sharing: designs can be shared as links. A printable mission report suits classrooms.

**Tools.** Plain HTML, CSS and JavaScript with no frameworks or build step. Automated tests
run in Node. It is hosted on GitHub Pages.

## NASA data and resources used

- Space Apps challenge resources:
  - Design and Develop Science Missions, for the mission lifecycle and review structure
  - CubeSat 101, for small-satellite constraints
  - Concept Maturity Levels
  - NASA Mission Viz
  - the General Mission Analysis Tool, for trajectory and Δv concepts
- NASA Systems Engineering Handbook, for margins and reserves
- Deep Space Network, for ground-station capability in the communications model
- Public NASA mission histories, for the in-game lessons: Galileo, Juno, Cassini, Mars
  Reconnaissance Orbiter, Mars Climate Orbiter, Lunar Prospector, Lunar Reconnaissance
  Orbiter, Dawn, Opportunity, CAPSTONE and FIRMS

## Space Agency Partner resources used

- CSA, Digital Games and Activities, as a reference for educational game format

## Use of AI

The game was designed and built with help from Claude, an AI assistant made by Anthropic.
Claude:

- drafted the game design and wrote the code, automated tests and in-game text
- tuned the numbers using an automated search that checks every mission has several
  winning designs

The team directed the work, made the design decisions, reviewed the output, and played and
tested the game. Mission facts were limited to well-documented public history. All numbers
are simplified for teaching, and the game says so.

## References

- https://www.spaceappschallenge.org/2026/challenges/space-mission-design-game/
- https://www.nasa.gov/wp-content/uploads/2025/04/250323-design-and-develop-science-mission.pdf
- https://www3.nasa.gov/sites/default/files/atoms/files/nasa_csli_cubesat_101_508.pdf
- https://dataverse.jpl.nasa.gov/dataset.xhtml?persistentId=hdl:2014/44299
- https://www.nasa.gov/reference/systems-engineering-handbook/
- https://nasa.github.io/mission-viz/
- https://www.asc-csa.gc.ca/eng/youth-educators/digital-games-and-activities.asp

## Before submitting

- [ ] Play each mission once yourself and adjust anything that feels off.
- [ ] Record the 30-second demo video.
- [ ] Rewrite the summary in your own voice if you want; it is a draft.
- [ ] Confirm the event's submission deadline with the St. John's Local Lead.
