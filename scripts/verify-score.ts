import { course } from '../src/features/chart/model/course'
import { useJury } from '../src/features/jury/model/useJury'
import { sampleAt } from '../src/features/logbook/lib/replay'
import { useSail } from '../src/features/sail/model/useSail'
import { useWind } from '../src/features/wind/model/useWind'
import { angleDelta, axis, clamp } from '../src/shared/math'
import type { Sample } from '../src/shared/race'

const dt = .025

async function runRace(reefScenario: boolean) {
  const sail = useSail(course)
  const wind = useWind()
  const jury = useJury(course)
  const gate = course.gates[course.gates.length - 1]
  const back = axis(gate.bearing)
  sail.placeAt({ x: gate.center.x - back.x * 205, y: gate.center.y - back.y * 205 }, gate.bearing, 5.8)
  jury.nextGate.value = course.gates.length - 1
  let time = 184.5
  let finishTime: number | null = null
  let releaseAt = Number.POSITIVE_INFINITY
  let phase: 'haul' | 'unload' | 'resume' | 'released' = 'haul'
  const samples: Sample[] = []
  let recordIn = 0

  for (let i = 0; i < 2400; i++) {
    if (reefScenario) {
      if (i === 4) sail.haulWinch()
      if (time > 186.05 && phase === 'haul') {
        sail.holdWinch()
        sail.steer(-1)
        phase = 'unload'
      }
      if (time > 186.78 && phase === 'unload') {
        sail.steer(0)
        sail.haulWinch()
        phase = 'resume'
      }
      if (time > 186.92 && wind.gustStart.value === null) wind.triggerGust(time)
      if (time > 187.18 && phase === 'resume') {
        sail.releaseWinch()
        releaseAt = time
        phase = 'released'
      }
      if (time > 188.25 && phase === 'released') {
        const across = axis(gate.bearing + 90)
        const target = { x: gate.center.x + across.x * 16, y: gate.center.y + across.y * 16 }
        const desired = (Math.atan2(target.y - sail.boat.value.position.y, target.x - sail.boat.value.position.x) * 180 / Math.PI + 360) % 360
        const delta = angleDelta(sail.boat.value.heading, desired)
        sail.steer(clamp(delta / 18, -1, 1))
      }
    } else {
      const across = axis(gate.bearing + 90)
      const target = { x: gate.center.x + across.x * 16, y: gate.center.y + across.y * 16 }
      const desired = (Math.atan2(target.y - sail.boat.value.position.y, target.x - sail.boat.value.position.x) * 180 / Math.PI + 360) % 360
      const delta = angleDelta(sail.boat.value.heading, desired)
      sail.steer(clamp(delta / 18, -1, 1))
    }

    const from = sail.boat.value
    const next = sail.step(wind.sample(time), dt)
    const verdict = jury.inspect(from.position, next.position, time, dt)
    const resolved = verdict.blocked ? { ...next, position: from.position, knots: 0 } : next
    sail.boat.value = resolved
    time += dt
    if (verdict.finish) {
      finishTime = verdict.finish.time
      break
    }
    recordIn += dt
    if (recordIn >= .2 || i === 0) {
      recordIn = 0
      samples.push({
        time,
        boat: sail.boat.value,
        wind: wind.sample(time),
        nextGate: jury.nextGate.value,
        penalty: jury.penalty.value,
      })
    }
  }

  if (finishTime === null) {
    return {
      finished: false,
      finalTime: time,
      position: sail.boat.value.position,
      distanceToGate: Math.hypot(sail.boat.value.position.x - gate.center.x, sail.boat.value.position.y - gate.center.y),
      heading: sail.boat.value.heading,
      knots: sail.boat.value.knots,
      events: jury.events.value.map(event => event.label),
    } as any
  }
  const replay = sampleAt(samples, Math.min(finishTime, samples.at(-1)?.time ?? finishTime))
  const releaseSample = sampleAt(samples, releaseAt + .8)
  return {
    finishTime,
    score: finishTime + jury.penalty.value,
    penalty: jury.penalty.value,
    releaseAt,
    finalReefReturn: sail.boat.value.reefReturn,
    replayLocked: replay?.boat.reefLocked ?? -1,
    replayReturn: releaseSample?.boat.reefReturn ?? -1,
    replayKnots: releaseSample?.boat.knots ?? -1,
  }
}

const baseline = await runRace(false)
const reef = await runRace(true)
console.log({ baseline, reef })
const checks: Array<[string, boolean]> = [
  ['baseline finishes with no penalty', baseline.penalty === 0],
  ['reef scenario finishes and is scored slower than baseline', Number.isFinite(reef.score) && reef.score > baseline.score],
  ['replay preserves locked area', reef.replayLocked >= .079],
  ['replay contains slipback', reef.replayReturn > .015],
  ['replay contains speed state', reef.replayKnots >= 0],
]
let failed = false
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
  if (!ok) failed = true
}
process.exit(failed ? 1 : 0)
