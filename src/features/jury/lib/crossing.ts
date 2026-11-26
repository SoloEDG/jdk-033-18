import { axis, dot, pointAt, subtract } from '../../../shared/math'
import type { Gate, Point } from '../../../shared/race'

export interface GateLineHit {
  fraction: number
  point: Point
  across: number
  along: number
}

export function gateLineCrossing(
  gate: Pick<Gate, 'center' | 'bearing'>,
  from: Point,
  to: Point,
): GateLineHit | null {
  const forward = axis(gate.bearing)
  const start = dot(subtract(from, gate.center), forward)
  const end = dot(subtract(to, gate.center), forward)
  if (start >= 0 || end < 0 || start === end) return null
  const fraction = -start / (end - start)
  const point = pointAt(from, to, fraction)
  const acrossAxis = axis(gate.bearing + 90)
  return {
    fraction,
    point,
    across: dot(subtract(point, gate.center), acrossAxis),
    along: dot(subtract(point, gate.center), forward),
  }
}

export function gateCrossing(gate: Pick<Gate, 'center' | 'bearing' | 'width'>, from: Point, to: Point): { fraction: number; point: Point } | null {
  const hit = gateLineCrossing(gate, from, to)
  if (!hit || Math.abs(hit.across) > gate.width / 2) return null
  return { fraction: hit.fraction, point: hit.point }
}
