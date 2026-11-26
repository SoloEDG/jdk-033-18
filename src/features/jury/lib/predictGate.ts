import { distance } from '../../../shared/math'
import type { Boat, Gate, Point, Wind } from '../../../shared/race'
import { advanceHeading, advanceMotion } from '../../sail/lib/dynamics'
import { stepRig } from '../../sail/lib/reefing'
import { gateLineCrossing } from './crossing'

export interface GateForecast {
  willPass: boolean
  crossesLine: boolean
  eta: number | null
  lateral: number
  clearance: number | null
  missBy: number | null
  distanceToGate: number
  projectedPoint: Point | null
  reason: 'on-course' | 'outside-gate' | 'no-forward-crossing'
}

export interface PredictOptions {
  horizon?: number
  dt?: number
  startTime?: number
}

/**
 * Rolls the current helm, winch and reef controls forward. Wind may be a
 * constant sample or a race-time sampler when the caller has a forecast.
 */
export function predictGatePassage(
  boat: Boat,
  gate: Pick<Gate, 'center' | 'bearing' | 'width'>,
  wind: Wind | ((raceTime: number) => Wind),
  options: PredictOptions = {},
): GateForecast {
  const horizon = options.horizon ?? 18
  const dt = options.dt ?? .08
  const startTime = options.startTime ?? 0
  const sampleWind = typeof wind === 'function' ? wind : () => wind
  let current: Boat = { ...boat, position: { ...boat.position } }
  let elapsed = 0

  while (elapsed < horizon - 1e-9) {
    const step = Math.min(dt, horizon - elapsed)
    const weather = sampleWind(startTime + elapsed)
    let next = advanceHeading(current, step)
    next = stepRig(next, weather, step)
    next = advanceMotion(next, weather, step)

    const hit = gateLineCrossing(gate, current.position, next.position)
    if (hit) {
      const lateral = Math.abs(hit.across)
      const halfWidth = gate.width / 2
      const willPass = lateral <= halfWidth
      return {
        willPass,
        crossesLine: true,
        eta: elapsed + step * hit.fraction,
        lateral,
        clearance: halfWidth - lateral,
        missBy: willPass ? 0 : lateral - halfWidth,
        distanceToGate: distance(boat.position, gate.center),
        projectedPoint: hit.point,
        reason: willPass ? 'on-course' : 'outside-gate',
      }
    }

    current = next
    elapsed += step
  }

  const forward = { x: Math.cos(gate.bearing * Math.PI / 180), y: Math.sin(gate.bearing * Math.PI / 180) }
  const acrossAxis = { x: Math.cos((gate.bearing + 90) * Math.PI / 180), y: Math.sin((gate.bearing + 90) * Math.PI / 180) }
  const rel = { x: boat.position.x - gate.center.x, y: boat.position.y - gate.center.y }
  const lateral = Math.abs(rel.x * acrossAxis.x + rel.y * acrossAxis.y)
  const along = rel.x * forward.x + rel.y * forward.y
  return {
    willPass: false,
    crossesLine: false,
    eta: null,
    lateral,
    clearance: null,
    missBy: null,
    distanceToGate: distance(boat.position, gate.center),
    projectedPoint: null,
    reason: along < 0 ? 'no-forward-crossing' : 'no-forward-crossing',
  }
}
