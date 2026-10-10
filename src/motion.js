// Hand angles are kept unwrapped (they can exceed 360 or go negative) while a
// motion runs, so "two full turns clockwise" is just +720.

export const mod = (a, n = 360) => ((a % n) + n) % n

// Smallest clockwise move from `from` that lands on `target`, plus extra turns.
export function cwTo(from, target, turns = 0) {
  return from + mod(target - from) + 360 * turns
}

export function ccwTo(from, target, turns = 0) {
  return from - mod(from - target) - 360 * turns
}

export function shortestTo(from, target) {
  return from + mod(target - from + 180) - 180
}

export const easings = {
  linear: t => t,
  inOut: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  out: t => 1 - Math.pow(1 - t, 3),
  in: t => t * t * t,
}

// A Track is the timeline of one hand: a chain of rotations and pauses.
// Choreographies build two tracks per clock; the renderer samples them.
export class Track {
  constructor(angle) {
    this.start = angle
    this.angle = angle
    this.t = 0
    this.segs = []
  }

  wait(ms) {
    this.t += ms
    return this
  }

  waitUntil(t) {
    if (t > this.t) this.t = t
    return this
  }

  to(angle, ms, ease = 'inOut') {
    this.segs.push({ t0: this.t, t1: this.t + ms, a0: this.angle, a1: angle, ease: easings[ease] })
    this.t += ms
    this.angle = angle
    return this
  }

  cw(target, ms, turns = 0, ease) {
    return this.to(cwTo(this.angle, target, turns), ms, ease)
  }

  ccw(target, ms, turns = 0, ease) {
    return this.to(ccwTo(this.angle, target, turns), ms, ease)
  }

  near(target, ms, ease) {
    return this.to(shortestTo(this.angle, target), ms, ease)
  }

  turn(deg, ms, ease) {
    return this.to(this.angle + deg, ms, ease)
  }

  get duration() {
    return this.t
  }

  at(t) {
    for (const s of this.segs) {
      if (t < s.t0) return s.a0
      if (t < s.t1) return s.a0 + (s.a1 - s.a0) * s.ease((t - s.t0) / (s.t1 - s.t0))
    }
    return this.angle
  }
}
