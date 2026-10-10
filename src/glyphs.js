// Angles are degrees clockwise from 12 o'clock.
export const U = 0
export const R = 90
export const D = 180
export const L = 270
// "Off" cell: both hands parked together pointing to 7:30, as on the real clock.
export const X = [225, 225]

// Each digit is 2 columns x 3 rows of clocks, listed row by row:
// [topLeft, topRight, midLeft, midRight, bottomLeft, bottomRight].
// Every clock has two equal-length hands, so a cell can draw at most two
// half-strokes from its center. Shapes that would need three (the middle of
// 3, 4, 6, 8, 9) leave a gap, same as the physical clock does.
export const GLYPHS = {
  '0': [[R, D], [L, D],
        [U, D], [U, D],
        [U, R], [U, L]],
  '1': [X, [D, D],
        X, [U, D],
        X, [U, U]],
  '2': [[R, R], [L, D],
        [R, D], [U, L],
        [U, R], [L, L]],
  '3': [[R, R], [L, D],
        [R, R], [U, D],
        [R, R], [U, L]],
  '4': [[D, D], [D, D],
        [U, R], [U, D],
        X, [U, U]],
  '5': [[R, D], [L, L],
        [U, R], [L, D],
        [R, R], [U, L]],
  '6': [[R, D], [L, L],
        [U, D], [L, D],
        [U, R], [U, L]],
  '7': [[R, R], [L, D],
        X, [U, D],
        X, [U, U]],
  '8': [[R, D], [L, D],
        [U, R], [U, L],
        [U, R], [U, L]],
  '9': [[R, D], [L, D],
        [U, R], [U, D],
        [R, R], [U, L]],
  ' ': [X, X, X, X, X, X],
}

export const COLS = 8
export const ROWS = 3

// Turn a 4-character string ("1850") into 24 [hand0, hand1] targets,
// row-major over the 8 x 3 grid.
export function layoutText(text) {
  const chars = String(text).padEnd(4, ' ').slice(0, 4).split('')
  const cells = new Array(COLS * ROWS)
  chars.forEach((ch, d) => {
    const glyph = GLYPHS[ch] ?? GLYPHS[' ']
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < 2; c++) {
        cells[r * COLS + d * 2 + c] = glyph[r * 2 + c].slice()
      }
    }
  })
  return cells
}

export function timeText(date, hour12 = false) {
  let h = date.getHours()
  if (hour12) h = h % 12 || 12
  return String(h).padStart(2, '0') + String(date.getMinutes()).padStart(2, '0')
}
