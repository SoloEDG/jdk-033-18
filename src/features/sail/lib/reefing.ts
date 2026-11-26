import { clamp } from '../../../shared/math'
import type { Boat, Wind } from '../../../shared/race'
import { sailAerodynamics, sailLoad } from './aerodynamics'

export const REEF_LOCK_STEP = .08
export const MAX_REEF = .48
export const INITIAL_SLACK = .34
export const HAUL_RATE = .17
export const SLACK_RATE = .46
export const REEF_SLIP_RATE = .23
export const JAM_TENSION = .93
export const JAM_CLEAR_TENSION = .76

export function createRigState() {
  return {
    winchMode: 'sheet' as const,
    winchDrive: 'hold' as const,
    winchEngaged: false,
    winchStatus: 'standby' as const,
    winchJammed: false,
    reefSlack: INITIAL_SLACK,
    reefDraw: 0,
    reefLocked: 0,
    reefReturn: 0,
    winchTension: .1,
    sailLoad: .25,
    sheetSlip: 0,
    slipShock: 0,
  }
}

export function lockedReefFor(draw: number): number {
  const locked = Math.floor((clamp(draw, 0, MAX_REEF) + 1e-7) / REEF_LOCK_STEP) * REEF_LOCK_STEP
  return clamp(Number(locked.toFixed(4)), 0, MAX_REEF)
}

export interface SheetRange {
  min: number
  max: number
  center: number
  supported: boolean
  violation: number
}

/**
 * Sail-angle window in which current reef friction/locks can be maintained.
 * Load and reverse gusts narrow the window; locked reef reduces load and
 * therefore widens it again.
 */
export function sheetSupportRange(boat: Pick<Boat, 'heading' | 'sheet' | 'rudder' | 'reefLocked' | 'reefDraw'>, wind: Wind): SheetRange {
  const aero = sailAerodynamics(boat, wind)
  const load = sailLoad(boat, wind)
  const gust = wind.gust ?? 0
  const halfWidth = clamp(
    30 + boat.reefLocked * 24 + boat.reefDraw * 6 - load * 8 - gust * 7,
    8,
    36,
  )
  const min = clamp(aero.preferredSheet - halfWidth, 0, 85)
  const max = clamp(aero.preferredSheet + halfWidth, 0, 85)
  const violation = boat.sheet < min ? min - boat.sheet : boat.sheet > max ? boat.sheet - max : 0
  return { min, max, center: aero.preferredSheet, supported: violation <= .5, violation }
}

export function stepRig(input: Boat, wind: Wind, dt: number): Boat {
  const boat: Boat = { ...input }
  const load = sailLoad(boat, wind)
  boat.sailLoad += (load - boat.sailLoad) * (1 - Math.exp(-dt * 7.5))
  boat.slipShock = Math.max(0, boat.slipShock - dt * .42)
  boat.sheetSlip = 0

  const gust = wind.gust ?? 0
  const slackFactor = .35 + .65 * (1 - boat.reefSlack)
  const reefRatio = boat.reefDraw / MAX_REEF
  let tensionTarget = clamp((
    .1 + load * .34
    + (1 - boat.reefSlack) * .1
    + reefRatio * .12
    + Math.pow(reefRatio, 4) * .24
    + (boat.winchDrive === 'haul' ? .1 : 0)
    + gust * .08
  ) * slackFactor, .04, 1)
  if (boat.winchDrive === 'free') tensionTarget *= .55
  boat.winchTension += (tensionTarget - boat.winchTension) * (1 - Math.exp(-dt * 4.2))

  if (boat.winchJammed && boat.winchTension < JAM_CLEAR_TENSION) boat.winchJammed = false

  if (boat.winchMode !== 'reef') {
    if (!boat.winchJammed && boat.winchStatus !== 'holding') {
      boat.winchStatus = boat.winchDrive === 'haul' ? 'hauling' : 'holding'
    }
    if (boat.winchDrive !== 'haul' && boat.winchStatus !== 'jammed' && boat.winchStatus !== 'slipping') {
      boat.winchStatus = boat.reefDraw > .001 ? 'holding' : 'standby'
    }
    return boat
  }

  if (boat.winchDrive === 'free') {
    if (boat.reefDraw - boat.reefLocked > .0005) {
      const range = sheetSupportRange(boat, wind)
      const stress = clamp(
        .28 + load * .72 + gust * .85 + range.violation / 16 - Math.abs(boat.rudder) * .08,
        .22,
        2.25,
      )
      const before = boat.reefDraw
      boat.reefDraw = Math.max(boat.reefLocked, boat.reefDraw - REEF_SLIP_RATE * stress * dt)
      const returned = before - boat.reefDraw
      boat.reefReturn += returned
      boat.slipShock = Math.max(
        boat.slipShock,
        clamp((boat.reefReturn / .16) * (.45 + .55 * Math.max(gust, .25)), .18, 1),
      )
      boat.sheetSlip = 5.5 * stress
      boat.sheet = clamp(boat.sheet + boat.sheetSlip * dt, 0, 85)
      boat.winchStatus = 'slipping'
    } else {
      boat.reefDraw = boat.reefLocked
      boat.winchStatus = boat.reefLocked > .001 ? 'locked' : 'standby'
    }
    return boat
  }

  if (boat.winchDrive === 'haul') {
    const atEnd = boat.reefDraw >= MAX_REEF - .0005
    if (!boat.winchJammed && (boat.winchTension >= JAM_TENSION || (atEnd && boat.winchTension > .8))) {
      boat.winchJammed = true
    }

    if (boat.winchJammed) {
      boat.winchStatus = 'jammed'
      return boat
    }

    if (boat.reefSlack > .001) {
      boat.reefSlack = Math.max(0, boat.reefSlack - SLACK_RATE * dt)
      boat.winchStatus = 'slack'
      return boat
    }

    const range = sheetSupportRange(boat, wind)
    const stress = clamp(
      load * .62 + boat.winchTension * .34 + gust * .55 + range.violation / 30 - Math.abs(boat.rudder) * .16,
      .12,
      1.7,
    )
    const rate = HAUL_RATE * (.72 + .28 * (1 - Math.min(load, 1)))
    boat.reefDraw = Math.min(MAX_REEF, boat.reefDraw + rate * dt)
    boat.reefLocked = lockedReefFor(boat.reefDraw)
    boat.winchStatus = 'hauling'
    boat.sheetSlip = 4.1 * stress
    boat.sheet = clamp(boat.sheet + boat.sheetSlip * dt, 0, 85)
    return boat
  }

  boat.winchStatus = boat.winchJammed ? 'jammed' : boat.reefDraw > .001 ? 'holding' : 'standby'
  return boat
}
