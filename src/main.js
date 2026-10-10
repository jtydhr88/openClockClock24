import './style.css'
import { COLS, ROWS, X, layoutText, timeText } from './glyphs.js'
import { mod } from './motion.js'
import { CHOREOGRAPHIES, buildPlan, randomKey } from './choreographies.js'
import { BOARD_ASPECT, draw } from './render.js'
import { createRenderer3D } from './render3d.js'

const $ = sel => document.querySelector(sel)
const canvas = $('#board')
const ctx = canvas.getContext('2d')
const ui = {
  mode: $('#mode'),
  text: $('#text'),
  choreo: $('#choreo'),
  speed: $('#speed'),
  speedOut: $('#speed-out'),
  hour12: $('#hour12'),
  play: $('#play'),
  status: $('#status'),
  view: $('#view'),
  resetView: $('#reset-view'),
  ao: $('#ao'),
  aoLabel: $('#ao').parentElement,
}

const board3d = $('#board3d')
const r3d = createRenderer3D(board3d)
const is3d = () => ui.view.value === 'skeu'

for (const [key, c] of Object.entries(CHOREOGRAPHIES)) {
  ui.choreo.add(new Option(c.name, key))
}

// Resting angles of all 48 hands, used whenever nothing is animating.
let angles = Array.from({ length: COLS * ROWS }, () => X.slice())
let shown = '    ' // what the board currently spells
let anim = null // { plan, text, start }
let pending = null // clock mode: the plan queued for the next minute
let demoNextAt = 0

const speed = () => Number(ui.speed.value)
const pickKey = () => (ui.choreo.value === 'random' ? randomKey() : ui.choreo.value)

function makePlan(text, key) {
  const targets = layoutText(text)
  const cells = targets.map((to, i) => ({
    col: i % COLS,
    row: Math.floor(i / COLS),
    from: angles[i],
    to,
  }))
  return { ...buildPlan(key, cells), text }
}

function start(plan) {
  anim = { plan, start: performance.now() }
  pending = null
}

function finish() {
  angles = anim.plan.tracks.map(([a, b]) => [mod(a.angle), mod(b.angle)])
  shown = anim.plan.text
  anim = null
}

function clockTick() {
  const now = Date.now()
  const current = timeText(new Date(now), ui.hour12.checked)
  const boundary = (Math.floor(now / 60000) + 1) * 60000

  // Wrong time on the board (first load, mode switch): catch up right away.
  if (shown !== current && (!pending || pending.startAt - now > 3000)) {
    start(makePlan(current, 'direct'))
    return
  }

  // Queue the next minute so the motion *ends* exactly on the boundary.
  if (!pending || pending.boundary !== boundary) {
    const plan = makePlan(timeText(new Date(boundary), ui.hour12.checked), pickKey())
    pending = { plan, boundary, startAt: boundary - plan.duration / speed() }
  }
  if (now >= pending.startAt) start(pending.plan)
}

function demoTick() {
  const now = performance.now()
  if (now < demoNextAt) return
  const text = String(Math.floor(Math.random() * 10000)).padStart(4, '0')
  start(makePlan(text, pickKey()))
}

function frame(now) {
  if (anim) {
    const t = (now - anim.start) * speed()
    if (t >= anim.plan.duration) {
      finish()
      demoNextAt = now + 1500
    }
  }
  if (!anim) {
    if (ui.mode.value === 'clock') clockTick()
    else if (ui.mode.value === 'demo') demoTick()
  }

  let live = angles
  if (anim) {
    const t = (now - anim.start) * speed()
    live = anim.plan.tracks.map(([a, b]) => [a.at(t), b.at(t)])
  }

  if (is3d()) r3d.draw(live)
  else draw(ctx, canvas.clientWidth, canvas.clientHeight, live, theme)
  updateStatus(now)
  requestAnimationFrame(frame)
}

let lastStatus = ''
function updateStatus(now) {
  const fmt = s => `${s.slice(0, 2)}:${s.slice(2)}`
  let msg
  if (anim) {
    const name = CHOREOGRAPHIES[anim.plan.key].name
    const left = Math.max(0, (anim.plan.duration - (now - anim.start) * speed()) / 1000 / speed())
    msg = `正在转到 ${fmt(anim.plan.text)}（${name}），还剩 ${left.toFixed(1)} 秒`
  } else if (ui.mode.value === 'clock' && pending) {
    const name = CHOREOGRAPHIES[pending.plan.key].name
    const wait = Math.max(0, (pending.startAt - Date.now()) / 1000)
    msg = `显示 ${fmt(shown)}，${wait.toFixed(0)} 秒后开始转到 ${fmt(pending.plan.text)}（${name}）`
  } else {
    msg = `显示 ${fmt(shown)}`
  }
  if (msg !== lastStatus) ui.status.textContent = lastStatus = msg
}

function resize() {
  canvas.hidden = is3d()
  board3d.hidden = !is3d()
  ui.resetView.hidden = !is3d()
  ui.aoLabel.hidden = !is3d()
  // Pure mode: the board takes the whole window; both renderers fit it inside.
  const pure = isPure()
  if (is3d()) return pure ? r3d.resize(innerWidth, innerHeight) : r3d.resize()
  const dpr = window.devicePixelRatio || 1
  const w = pure ? innerWidth : canvas.parentElement.clientWidth
  const h = pure ? innerHeight : Math.round(w / BOARD_ASPECT)
  canvas.style.height = h + 'px'
  canvas.width = Math.round(w * dpr)
  canvas.height = Math.round(h * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}

let theme
function readTheme() {
  const css = getComputedStyle(document.documentElement)
  const v = name => css.getPropertyValue(name).trim()
  theme = {
    board: v('--board'),
    dialCenter: v('--dial-center'),
    dialEdge: v('--dial-edge'),
    dialRim: v('--dial-rim'),
    hand: v('--hand'),
  }
  r3d.setBackground(v('--bg'))
}

ui.mode.addEventListener('change', () => {
  pending = null
  ui.text.disabled = ui.mode.value !== 'custom'
  demoNextAt = 0
})
ui.choreo.addEventListener('change', () => (pending = null))
ui.hour12.addEventListener('change', () => (pending = null))
ui.speed.addEventListener('input', () => {
  ui.speedOut.textContent = speed() + '×'
  pending = null
})
ui.text.addEventListener('input', () => {
  ui.text.value = ui.text.value.replace(/[^0-9 ]/g, '').slice(0, 4)
})
ui.play.addEventListener('click', () => {
  if (anim) {
    // Freeze the hands where they are and plan the new motion from there.
    const t = (performance.now() - anim.start) * speed()
    angles = anim.plan.tracks.map(([a, b]) => [mod(a.at(t)), mod(b.at(t))])
    shown = ''
    anim = null
  }
  const text =
    ui.mode.value === 'custom' ? ui.text.value.padEnd(4, ' ') :
    ui.mode.value === 'clock' ? timeText(new Date(), ui.hour12.checked) :
    String(Math.floor(Math.random() * 10000)).padStart(4, '0')
  // In clock mode this replays a choreography and lands back on the current time.
  start(makePlan(text, ui.choreo.value === 'random' ? randomKey() : ui.choreo.value))
})

// Pure mode hides everything but the board. The exit and fullscreen buttons
// fade in while the pointer moves; Esc also leaves.
const isPure = () => document.body.classList.contains('pure')
let idleTimer = 0

function setPure(on) {
  document.body.classList.toggle('pure', on)
  if (!on && document.fullscreenElement) document.exitFullscreen()
  wake()
  resize()
}

function wake() {
  document.body.classList.add('awake')
  clearTimeout(idleTimer)
  idleTimer = setTimeout(() => document.body.classList.remove('awake'), 2500)
}

$('#pure').addEventListener('click', () => setPure(true))
$('#exit-pure').addEventListener('click', () => setPure(false))
$('#fullscreen').addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen()
  else document.documentElement.requestFullscreen?.()
})
window.addEventListener('pointermove', () => isPure() && wake())
window.addEventListener('pointerdown', () => isPure() && wake())
window.addEventListener('keydown', e => {
  if (e.key === 'Escape' && isPure() && !document.fullscreenElement) setPure(false)
})
if (new URLSearchParams(location.search).has('pure')) document.body.classList.add('pure')

ui.view.addEventListener('change', resize)
ui.resetView.addEventListener('click', () => r3d.resetView())
ui.ao.addEventListener('change', () => r3d.setAO(ui.ao.checked))

matchMedia('(prefers-color-scheme: dark)').addEventListener('change', readTheme)
window.addEventListener('resize', resize)
readTheme()
resize()
ui.text.disabled = true
requestAnimationFrame(frame)
