import { course } from '../src/features/chart/model/course'
import { predictGatePassage } from '../src/features/jury/lib/predictGate'
import { useSail } from '../src/features/sail/model/useSail'
import { useWind } from '../src/features/wind/model/useWind'
import { axis, distance } from '../src/shared/math'

const dt = .025
const sail = useSail(course)
const wind = useWind()
const gate = course.gates[course.gates.length - 1]
const back = axis(gate.bearing)
sail.placeAt({ x: gate.center.x - back.x * 205, y: gate.center.y - back.y * 205 }, gate.bearing, 5.8)

let time = 184.5
const run = (seconds: number) => {
  const steps = Math.round(seconds / dt)
  for (let i = 0; i < steps; i++) {
    time += dt
    sail.boat.value = sail.step(wind.sample(time), dt)
  }
}
const snap = (label: string) => {
  const b = sail.boat.value
  const forecast = predictGatePassage(b, gate, wind.sample(time))
  console.log(label, {
    t: time.toFixed(2), kn: b.knots.toFixed(2), sheet: b.sheet.toFixed(1), rudder: b.rudder,
    slack: b.reefSlack.toFixed(2), draw: b.reefDraw.toFixed(3), locked: b.reefLocked.toFixed(3),
    unlocked: (b.reefDraw - b.reefLocked).toFixed(3), returned: b.reefReturn.toFixed(3),
    tension: b.winchTension.toFixed(2), load: b.sailLoad.toFixed(2), status: b.winchStatus,
    forecast: forecast.willPass ? 'pass' : `${forecast.reason}/${forecast.lateral.toFixed(0)}m`,
    dist: distance(b.position, gate.center).toFixed(0),
  })
}

snap('initial')
sail.haulWinch()
run(1.55)
snap('after haul')
sail.holdWinch()
sail.steer(-1)
run(.72)
snap('rudder unload')
sail.steer(0)
sail.haulWinch()
run(.12)
wind.triggerGust(time)
run(.16)
snap('resume then reverse gust')
const lockedAtRelease = sail.boat.value.reefLocked
const drawAtRelease = sail.boat.value.reefDraw
const speedAtRelease = sail.boat.value.knots
sail.releaseWinch()
run(1.05)
snap('after release/slip')
const after = sail.boat.value

const checks: Array<[string, boolean]> = [
  ['took up slack', after.reefSlack < .05],
  ['locked some reef', lockedAtRelease >= .08],
  ['had unsecured reef at release', drawAtRelease - lockedAtRelease > .015],
  ['locked area preserved', Math.abs(after.reefLocked - lockedAtRelease) < 1e-9],
  ['unsecured amount returned', after.reefDraw < drawAtRelease - .015],
  ['return amount recorded', after.reefReturn > .015],
  ['speed loss is visible', after.knots < speedAtRelease - .4],
]
let failed = false
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
  if (!ok) failed = true
}
process.exit(failed ? 1 : 0)
