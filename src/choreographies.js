import { Track } from './motion.js'
import { COLS, ROWS } from './glyphs.js'

// Every choreography gets the 24 cells ({ col, row, from: [a, b], to: [a, b] })
// and returns two Tracks per cell. Whatever happens in between, each track
// must end on its `to` angle (mod 360).

const CX = (COLS - 1) / 2
const CY = (ROWS - 1) / 2

const dist = c => Math.hypot(c.col - CX, c.row - CY)
// Direction from the grid center to this cell, in clock degrees. Rounded so
// hand angles stay whole numbers and land exactly on their targets.
const outward = c => Math.round((Math.atan2(c.col - CX, -(c.row - CY)) * 180) / Math.PI)

const tracks = cells => cells.map(c => [new Track(c.from[0]), new Track(c.from[1])])

// Hold every hand until the slowest one has finished the current phase.
function sync(all, pause = 0) {
  const end = Math.max(...all.flat().map(t => t.t)) + pause
  all.flat().forEach(t => t.waitUntil(end))
}

export const CHOREOGRAPHIES = {
  direct: {
    name: '直接转到',
    build(cells) {
      const all = tracks(cells)
      cells.forEach((c, i) => {
        const [a, b] = all[i]
        a.wait(c.col * 60).cw(c.to[0], 2200)
        b.wait(c.col * 60).cw(c.to[1], 2200)
      })
      return all
    },
  },

  sweep: {
    name: '对向扫过',
    build(cells) {
      const all = tracks(cells)
      cells.forEach((c, i) => {
        const [a, b] = all[i]
        a.wait(c.col * 180).cw(c.to[0], 4500, 1)
        b.wait(c.col * 180).ccw(c.to[1], 4500, 1)
      })
      return all
    },
  },

  alignSpin: {
    name: '斜线齐转',
    build(cells) {
      const all = tracks(cells)
      // 1. Every clock becomes the same diagonal line.
      cells.forEach((c, i) => {
        all[i][0].wait(c.col * 90).near(45, 2000)
        all[i][1].wait(c.col * 90).near(225, 2000)
      })
      sync(all, 200)
      // 2. The whole field spins one turn, rippling along the diagonals.
      cells.forEach((c, i) => {
        all[i][0].wait((c.col + c.row) * 110).turn(360, 3000)
        all[i][1].wait((c.col + c.row) * 110).turn(360, 3000)
      })
      sync(all, 200)
      // 3. Split into the digits, hands going opposite ways.
      cells.forEach((c, i) => {
        all[i][0].wait((COLS - 1 - c.col) * 90).cw(c.to[0], 2600)
        all[i][1].wait((COLS - 1 - c.col) * 90).ccw(c.to[1], 2600)
      })
      return all
    },
  },

  ripple: {
    name: '中心涟漪',
    build(cells) {
      const all = tracks(cells)
      cells.forEach((c, i) => {
        const delay = dist(c) * 380
        all[i][0].wait(delay).cw(c.to[0], 3800, 1)
        all[i][1].wait(delay).ccw(c.to[1], 3800, 1)
      })
      return all
    },
  },

  bloom: {
    name: '放射绽放',
    build(cells) {
      const all = tracks(cells)
      // 1. Hands line up with the ray from the grid center: a starburst.
      cells.forEach((c, i) => {
        all[i][0].near(outward(c), 2200)
        all[i][1].near(outward(c) + 180, 2200)
      })
      sync(all, 300)
      // 2. Every line flips over together.
      all.forEach(([a, b]) => {
        a.turn(180, 1800)
        b.turn(180, 1800)
      })
      sync(all, 200)
      // 3. Unfold into the time from the center out.
      cells.forEach((c, i) => {
        all[i][0].wait(dist(c) * 220).cw(c.to[0], 2600)
        all[i][1].wait(dist(c) * 220).ccw(c.to[1], 2600)
      })
      return all
    },
  },

  cascade: {
    name: '垂落瀑布',
    build(cells) {
      const all = tracks(cells)
      // 1. Everything droops to 6 o'clock, column after column.
      cells.forEach((c, i) => {
        all[i][0].wait(c.col * 120 + c.row * 60).near(180, 1600)
        all[i][1].wait(c.col * 120 + c.row * 60).near(180, 1600)
      })
      sync(all, 400)
      // 2. Both hands swing up through a full turn into place.
      cells.forEach((c, i) => {
        all[i][0].wait(c.col * 140).cw(c.to[0], 3600, 1)
        all[i][1].wait(c.col * 140 + 250).cw(c.to[1], 3600, 1)
      })
      return all
    },
  },
}

export function buildPlan(key, cells) {
  const all = CHOREOGRAPHIES[key].build(cells)
  const duration = Math.max(...all.flat().map(t => t.duration))
  return { key, tracks: all, duration }
}

export function randomKey(exclude = 'direct') {
  const keys = Object.keys(CHOREOGRAPHIES).filter(k => k !== exclude)
  return keys[Math.floor(Math.random() * keys.length)]
}
