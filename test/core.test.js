import test from 'node:test'
import assert from 'node:assert/strict'
import { GLYPHS, layoutText, timeText } from '../src/glyphs.js'
import { cwTo, ccwTo, mod } from '../src/motion.js'
import { CHOREOGRAPHIES, buildPlan } from '../src/choreographies.js'

test('every glyph has 6 cells of two hands', () => {
  for (const [ch, g] of Object.entries(GLYPHS)) {
    assert.equal(g.length, 6, ch)
    g.forEach(cell => assert.equal(cell.length, 2, ch))
  }
})

test('layoutText places digits two columns apart, row-major', () => {
  const cells = layoutText('1850')
  assert.equal(cells.length, 24)
  assert.deepEqual(cells[0], [225, 225]) // '1' left column is parked
  assert.deepEqual(cells[1], [180, 180]) // '1' top-right points down
  assert.deepEqual(cells[2], [90, 180]) // '8' top-left
  assert.deepEqual(cells[8 + 4], [0, 90]) // '5' middle-left
})

test('timeText', () => {
  const d = new Date(2026, 9, 10, 18, 5)
  assert.equal(timeText(d), '1805')
  assert.equal(timeText(d, true), '0605')
})

test('cw/ccw land on the target and move the right way', () => {
  assert.equal(cwTo(350, 10), 370)
  assert.equal(cwTo(10, 350), 350)
  assert.equal(cwTo(0, 0, 1), 360)
  assert.equal(ccwTo(10, 350), -10)
  assert.equal(ccwTo(90, 90, 2), -630)
})

test('every choreography ends exactly on the target angles', () => {
  const from = layoutText('1234')
  const to = layoutText('5678')
  const cells = to.map((t, i) => ({ col: i % 8, row: Math.floor(i / 8), from: from[i], to: t }))
  for (const key of Object.keys(CHOREOGRAPHIES)) {
    const plan = buildPlan(key, cells)
    assert.ok(plan.duration > 0 && plan.duration < 15000, key)
    plan.tracks.forEach(([a, b], i) => {
      assert.equal(mod(a.at(plan.duration)), to[i][0], `${key} cell ${i} hand 0`)
      assert.equal(mod(b.at(plan.duration)), to[i][1], `${key} cell ${i} hand 1`)
      assert.equal(a.at(0), from[i][0])
    })
  }
})
