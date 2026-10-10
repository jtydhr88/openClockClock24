# openClockClock24

[中文](README.zh.md) | English

An open recreation of the ClockClock 24 kinetic clock: 24 analog clocks in an 8 × 3 grid, each with two hands of equal length. Together they spell the current time. Shortly before every minute, all hands run a choreographed motion that ends exactly on the new time.

This is the web version. Live demo: https://jtydhr88.github.io/openClockClock24/

License: MIT.

"纯净模式" (pure mode) shows only the clock; Esc leaves it. Add `?pure` to the URL to start in it, handy for a wall display.

## Run

```bash
npm install
npm run dev     # dev server
npm test        # unit tests (node --test)
npm run build   # bundle to dist/
```

## How it works

### 1. Glyphs: each digit is 2 × 3 clocks

The four digits (HHMM) take two columns each, filling all 8. Each hand points from the center up, right, down or left, drawing one half-stroke. Angles are degrees clockwise from 12: up 0, right 90, down 180, left 270.

```
"0"  ┌ ┐     [R,D] [L,D]
     │ │     [U,D] [U,D]
     └ ┘     [U,R] [U,L]
```

A cell with no stroke parks both hands together at 7:30 (225°), which reads as "off". The left column of "1" in the photo does exactly this.

A clock can draw at most two strokes, so places in 3, 4, 6, 8 and 9 that need three directions leave a gap, as on the real clock (8 is two stacked boxes). The table lives in `src/glyphs.js`.

### 2. Time to target angles

`layoutText("1850")` looks up the four characters and returns the target angles for both hands of all 24 cells.

### 3. Motion: one timeline per hand

Angles are never wrapped, so "one extra turn clockwise" is just +360. Each hand is a `Track`: a chain of waits and eased rotations.

- `cwTo(current, target, turns)`: clockwise to the target, plus whole turns
- `ccwTo`: counter-clockwise
- Turning the two hands opposite ways gives the scissor look of the real clock

A choreography schedules all 48 tracks. Delays by column, by distance from the center or along diagonals give waves and ripples. Multi-phase moves (all become the same diagonal, spin together, then split into digits) use `sync()` so every hand waits for the slowest one before the next phase. Whatever happens in between, every hand must end on its target; the tests check each one.

There are 6 choreographies in `src/choreographies.js`. Adding one means adding a `build(cells)` function.

### 4. Landing on the minute

A plan's total duration is known before it runs, so it starts at `next minute - duration` and finishes as the minute turns.

## Files

| File | Contents |
|---|---|
| `src/glyphs.js` | digit glyph table, time to cells |
| `src/motion.js` | angle math, easing, `Track` timeline |
| `src/choreographies.js` | choreographies |
| `src/render3d.js` | realistic 3D view (Three.js: drilled panel, recessed bowls, live shadows, environment reflections, orbit camera) |
| `src/render.js` | flat canvas drawing |
| `src/main.js` | scheduling (clock / custom / demo modes) and UI |
