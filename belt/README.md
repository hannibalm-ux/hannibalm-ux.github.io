# The Belt

An interplanetary industrial simulation that runs in the browser (desktop and iOS Safari). Easiest: open `belt_standalone.html` in the repository root by double-clicking it (one self-contained file, works offline apart from web fonts). To develop, serve the repository root, for example `python3 -m http.server`, and visit `/belt/`. After changing `belt/`, rebuild the single file with `python3 tools/build_belt_standalone.py`.

Design reference: *The Belt Game Design Document v0.1*. This is the MVP slice from section 16.

## Playing

- Tap or click a ship, asteroid or station to inspect it. Drag orbits, wheel or pinch zooms, double-tap focuses, shift-drag pans. Nothing requires a keyboard, hover or right-click.
- Loop: scan asteroids, claim one, mine it, sell ore (or refine it yourself), buy ships, hire crew, then delegate.
- Modes: Owner-operator, Company simulation (AI runs your company), Universe simulation (every company is AI). You can hand your company to AI or take it back at any time from the Menu.
- Time: 1 game hour per second at 1×, up to 10,000× for observers. The game drops back to 10× for important events (switch off in the Menu).

## Files

| File | Role |
| --- | --- |
| `sim.js` | Game rules and state (plain JSON, no DOM): orbits, ships, orders, mining, markets, refineries, payroll, contracts, bankruptcy, save/load |
| `ai.js` | Supervisors, managers and the AI executive. They plan through the same actions a player uses and log a reason for every decision |
| `render.js` | Three.js strategic camera, picking and labels |
| `views.js`, `main.js`, `belt.css`, `index.html` | Inspectors, panels, controls, new-game screen, clock |

## Tests

```
node tests/belt.test.mjs
```

Headless checks of the simulation: every starting level, determinism, save/load, scan/claim/mine, stockpile and tug logistics, refining, hiring rules, delegation, manager requests and market attribution.
