import { angleDelta, clamp } from '../../../shared/math'
import type { Boat, Wind } from '../../../shared/race'

export interface SailAerodynamics {
  fromWind: number
  preferredSheet: number
  trim: number
  lift: number
  trimError: number
}

/** Existing sail force curve, shared by motion, winch load and instruments. */
export function sailAerodynamics(boat: Pick<Boat, 'heading' | 'sheet'>, wind: Wind): SailAerodynamics {
  const fromWind = Math.abs(angleDelta(boat.heading, wind.bearing))
  const preferredSheet = clamp((fromWind - 37) * .55, 9, 78)
  const trimError = Math.abs(boat.sheet - preferredSheet)
  const trim = Math.max(.08, 1 - trimError / 69)
  const lift = clamp((fromWind - 32) / 45, 0, 1) * (1 - Math.max(0, fromWind - 110) / 180)
  return { fromWind, preferredSheet, trim, lift, trimError }
}

/** Normalized working load on the sheet/reef winch. */
export function sailLoad(boat: Pick<Boat, 'heading' | 'sheet' | 'rudder'>, wind: Wind): number {
  const aero = sailAerodynamics(boat, wind)
  const pressure = clamp(wind.knots / 17, .15, 1.45)
  const trimPower = clamp(1 - aero.trimError / 58, 0, 1)
  const gust = wind.gust ?? 0
  // Hard rudder also briefly unloads the working sheet while the hull rotates.
  const helmRelief = 1 - .12 * Math.abs(boat.rudder)
  const load = (.14 + pressure * (.26 + .64 * aero.lift) * (.32 + .68 * trimPower))
    * (1 + .34 * gust) * helmRelief
  return clamp(load, .05, 1.45)
}
