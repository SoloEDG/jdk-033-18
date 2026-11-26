import { ref } from 'vue'
import { clamp, normalize } from '../../../shared/math'
import type { Boat, Course, WinchMode } from '../../../shared/race'
import { advanceHeading, advanceMotion } from '../lib/dynamics'
import { createRigState, stepRig } from '../lib/reefing'

const atStart = (course: Course): Boat => ({
  position: { ...course.start },
  heading: normalize(course.heading),
  knots: 0,
  sheet: 39,
  rudder: 0,
  ...createRigState(),
})

export function useSail(course: Course) {
  const boat = ref<Boat>(atStart(course))
  const reset = () => { boat.value = atStart(course) }
  const steer = (direction: number) => {
    boat.value = { ...boat.value, rudder: clamp(direction, -1, 1) }
  }
  const sheet = (value: number) => {
    // The slider is the direct-sheet side of the same winch. Touching it
    // returns the winch to sheet mode and stops an active reefing pull.
    boat.value = {
      ...boat.value,
      sheet: clamp(value, 0, 85),
      winchMode: 'sheet',
      winchDrive: 'hold',
      winchEngaged: false,
      winchStatus: 'holding',
    }
  }
  const setWinchMode = (winchMode: WinchMode) => {
    boat.value = {
      ...boat.value,
      winchMode,
      winchDrive: 'hold',
      winchEngaged: false,
      winchStatus: boat.value.winchJammed ? 'jammed' : 'holding',
    }
  }
  const haulWinch = () => {
    const wasHauling = boat.value.winchDrive === 'haul'
    boat.value = {
      ...boat.value,
      winchMode: 'reef',
      winchDrive: 'haul',
      winchEngaged: true,
      reefReturn: wasHauling ? boat.value.reefReturn : 0,
      winchStatus: boat.value.winchJammed ? 'jammed' : boat.value.reefSlack > .01 ? 'slack' : 'hauling',
    }
  }
  const holdWinch = () => {
    boat.value = {
      ...boat.value,
      winchDrive: 'hold',
      winchEngaged: false,
      winchStatus: boat.value.winchJammed ? 'jammed' : 'holding',
    }
  }
  const releaseWinch = () => {
    const slipping = boat.value.reefDraw - boat.value.reefLocked > .002
    boat.value = {
      ...boat.value,
      winchMode: 'reef',
      winchDrive: 'free',
      winchEngaged: false,
      winchJammed: false,
      winchTension: Math.min(boat.value.winchTension, .72),
      reefReturn: 0,
      winchStatus: slipping ? 'slipping' : boat.value.reefLocked > .001 ? 'locked' : 'standby',
    }
  }
  const placeAt = (position: Boat['position'], heading: number, knots: number) => {
    boat.value = { ...boat.value, position: { ...position }, heading, knots, rudder: 0 }
  }
  const step = (wind: Parameters<typeof stepRig>[1], seconds: number) => {
    const headed = advanceHeading(boat.value, seconds)
    const rigged = stepRig(headed, wind, seconds)
    return advanceMotion(rigged, wind, seconds)
  }
  return {
    boat, reset, steer, sheet, setWinchMode, haulWinch, holdWinch, releaseWinch, placeAt, step,
  }
}
