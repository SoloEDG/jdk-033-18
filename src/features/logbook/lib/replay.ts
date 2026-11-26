import { mix, normalize, pointAt } from '../../../shared/math'
import type { Boat, Sample } from '../../../shared/race'

function normalizeBoat(raw: Partial<Boat> | undefined): Boat {
  return {
    position: raw?.position ?? { x: 0, y: 0 },
    heading: raw?.heading ?? 0,
    knots: raw?.knots ?? 0,
    sheet: raw?.sheet ?? 39,
    rudder: raw?.rudder ?? 0,
    winchMode: raw?.winchMode === 'reef' ? 'reef' : 'sheet',
    winchDrive: raw?.winchDrive === 'haul' || raw?.winchDrive === 'free' ? raw.winchDrive : 'hold',
    winchEngaged: Boolean(raw?.winchEngaged),
    winchStatus: raw?.winchStatus ?? 'standby',
    winchJammed: Boolean(raw?.winchJammed),
    reefSlack: Number.isFinite(raw?.reefSlack) ? Number(raw?.reefSlack) : 0,
    reefDraw: Number.isFinite(raw?.reefDraw) ? Number(raw?.reefDraw) : 0,
    reefLocked: Number.isFinite(raw?.reefLocked) ? Number(raw?.reefLocked) : 0,
    reefReturn: Number.isFinite(raw?.reefReturn) ? Number(raw?.reefReturn) : 0,
    winchTension: Number.isFinite(raw?.winchTension) ? Number(raw?.winchTension) : 0,
    sailLoad: Number.isFinite(raw?.sailLoad) ? Number(raw?.sailLoad) : 0,
    sheetSlip: Number.isFinite(raw?.sheetSlip) ? Number(raw?.sheetSlip) : 0,
    slipShock: Number.isFinite(raw?.slipShock) ? Number(raw?.slipShock) : 0,
  }
}

export function sampleAt(samples: Sample[], time: number): Sample | null {
  if (!samples.length) return null
  const next = samples.findIndex(sample => sample.time >= time)
  if (next <= 0) {
    const sample = samples[next === 0 ? 0 : samples.length - 1]
    return { ...sample, boat: normalizeBoat(sample.boat) }
  }
  const aSample = samples[next - 1], bSample = samples[next]
  const fraction = (time - aSample.time) / (bSample.time - aSample.time)
  const discrete = fraction < 1 ? aSample : bSample
  const a = normalizeBoat(aSample.boat)
  const b = normalizeBoat(bSample.boat)
  return {
    ...discrete, time,
    wind: {
      ...discrete.wind,
      bearing: normalize(aSample.wind.bearing + ((normalize(bSample.wind.bearing - aSample.wind.bearing + 180) - 180)) * fraction),
      knots: mix(aSample.wind.knots, bSample.wind.knots, fraction),
      gust: mix(aSample.wind.gust ?? 0, bSample.wind.gust ?? 0, fraction),
    },
    boat: {
      ...(fraction < 1 ? a : b),
      position: pointAt(a.position, b.position, fraction),
      heading: normalize(a.heading + ((normalize(b.heading - a.heading + 180) - 180)) * fraction),
      knots: mix(a.knots, b.knots, fraction),
      sheet: mix(a.sheet, b.sheet, fraction),
      reefSlack: mix(a.reefSlack, b.reefSlack, fraction),
      reefDraw: mix(a.reefDraw, b.reefDraw, fraction),
      reefLocked: mix(a.reefLocked, b.reefLocked, fraction),
      reefReturn: mix(a.reefReturn, b.reefReturn, fraction),
      winchTension: mix(a.winchTension, b.winchTension, fraction),
      sailLoad: mix(a.sailLoad, b.sailLoad, fraction),
      sheetSlip: mix(a.sheetSlip, b.sheetSlip, fraction),
      slipShock: mix(a.slipShock, b.slipShock, fraction),
      rudder: fraction < .5 ? a.rudder : b.rudder,
      winchMode: fraction < 1 ? a.winchMode : b.winchMode,
      winchDrive: fraction < 1 ? a.winchDrive : b.winchDrive,
      winchEngaged: fraction < 1 ? a.winchEngaged : b.winchEngaged,
      winchStatus: fraction < 1 ? a.winchStatus : b.winchStatus,
      winchJammed: fraction < 1 ? a.winchJammed : b.winchJammed,
    },
  }
}
