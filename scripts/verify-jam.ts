import { course } from '../src/features/chart/model/course'
import { useSail } from '../src/features/sail/model/useSail'
import { windAt } from '../src/features/wind/lib/forecast'

const sail = useSail(course)
sail.haulWinch()
for (let i = 0; i < 400; i++) {
  sail.boat.value = sail.step(windAt(100 + i * .025, 'steady'), .025)
}
const boat = sail.boat.value
console.log({
  jammed: boat.winchJammed,
  status: boat.winchStatus,
  draw: Number(boat.reefDraw.toFixed(2)),
  locked: Number(boat.reefLocked.toFixed(2)),
  tension: Number(boat.winchTension.toFixed(2)),
})
if (!boat.winchJammed) process.exit(1)
