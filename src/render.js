import { COLS, ROWS } from './glyphs.js'

const PAD = 0.4 // board margin, in cell sizes

export const BOARD_ASPECT = (COLS + 2 * PAD) / (ROWS + 2 * PAD)

export function draw(ctx, w, h, angles, theme) {
  const s = Math.min(w / (COLS + 2 * PAD), h / (ROWS + 2 * PAD))
  const bw = s * (COLS + 2 * PAD)
  const bh = s * (ROWS + 2 * PAD)
  const ox = (w - bw) / 2
  const oy = (h - bh) / 2
  const r = s * 0.46
  const hand = r * 0.96

  ctx.clearRect(0, 0, w, h)

  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.18)'
  ctx.shadowBlur = s * 0.25
  ctx.shadowOffsetY = s * 0.06
  ctx.fillStyle = theme.board
  roundRect(ctx, ox, oy, bw, bh, s * 0.12)
  ctx.fill()
  ctx.restore()

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const cx = ox + s * (PAD + col + 0.5)
      const cy = oy + s * (PAD + row + 0.5)

      // Recessed dish.
      const g = ctx.createRadialGradient(cx, cy - r * 0.15, r * 0.2, cx, cy, r)
      g.addColorStop(0, theme.dialCenter)
      g.addColorStop(0.85, theme.dialEdge)
      g.addColorStop(1, theme.dialRim)
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fill()

      ctx.strokeStyle = theme.hand
      ctx.lineCap = 'round'
      ctx.lineWidth = r * 0.14
      for (const a of angles[row * COLS + col]) {
        const rad = (a * Math.PI) / 180
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(cx + hand * Math.sin(rad), cy - hand * Math.cos(rad))
        ctx.stroke()
      }
      ctx.fillStyle = theme.hand
      ctx.beginPath()
      ctx.arc(cx, cy, r * 0.09, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
