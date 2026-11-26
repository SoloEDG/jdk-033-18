import type { Boat, Wind } from '../../../shared/race'
import { axis, clamp, normalize } from '../../../shared/math'
import { sailAerodynamics } from './aerodynamics'

export function advanceHeading(boat: Boat, dt: number): Boat {
  const turn = boat.rudder * (26 + Math.min(boat.knots, 18))
  return { ...boat, heading: normalize(boat.heading + turn * dt) }
}

export function advanceMotion(boat: Boat, wind: Wind, dt: number): Boat {
  const aero = sailAerodynamics(boat, wind)
  const reef = clampReef(boat.reefDraw ?? 0)
  const slipShock = clamp(boat.slipShock ?? 0, 0, 1)
  let target = .65 + wind.knots * 1.03 * aero.lift * aero.trim
  // Retracting sail area depowers the boat. A recent uncontrolled return also
  // stalls the airflow until the sail is trimmed again.
  target *= 1 - .78 * reef
  target *= 1 - .62 * slipShock
  const knots = boat.knots
    + (target - boat.knots) * (1 - Math.exp(-dt * 1.45))
    - slipShock * 3.1 * dt
  const safeKnots = Math.max(0, knots)
  const v = axis(boat.heading)
  const travel = safeKnots * 3.65 * dt
  return {
    ...boat,
    knots: safeKnots,
    position: { x: boat.position.x + v.x * travel, y: boat.position.y + v.y * travel },
  }
}

export function advanceBoat(boat: Boat, wind: Wind, dt: number): Boat {
  return advanceMotion(advanceHeading(boat, dt), wind, dt)
}

function clampReef(value: number) {
  return Math.max(0, Math.min(.48, value))
}
