export interface Point { x: number; y: number }

export interface Gate {
  id: string
  name: string
  center: Point
  bearing: number
  width: number
  buoySide: -1 | 1
  approach?: { center: Point; bearing: number; width: number }
}

export interface Course {
  id: string
  name: string
  size: Point
  start: Point
  heading: number
  gates: Gate[]
  hazards: { id: string; center: Point; radius: number }[]
}

export type WindMode = 'steady' | 'shifting'
export interface Wind { bearing: number; knots: number; gust?: number }
export type WinchMode = 'sheet' | 'reef'
export type WinchDrive = 'haul' | 'hold' | 'free'
export type WinchStatus = 'standby' | 'slack' | 'hauling' | 'holding' | 'jammed' | 'slipping' | 'locked'
export interface Boat {
  position: Point
  heading: number
  knots: number
  sheet: number
  rudder: number
  winchMode: WinchMode
  winchDrive: WinchDrive
  winchEngaged: boolean
  winchStatus: WinchStatus
  winchJammed: boolean
  /** Remaining idle travel in the reef line, from 1 (all slack) to 0. */
  reefSlack: number
  /** Current total reef reduction, including work not yet locked. */
  reefDraw: number
  /** Reef reduction secured by a lock/pawl; release can never reduce this. */
  reefLocked: number
  /** Amount returned during the latest release event. */
  reefReturn: number
  winchTension: number
  sailLoad: number
  sheetSlip: number
  slipShock: number
}
export type RaceStatus = 'ready' | 'running' | 'paused' | 'finished' | 'abandoned'
export type EventKind = 'start' | 'mark' | 'collision' | 'deviation' | 'finish' | 'abandon' | 'reef'
export interface RaceEvent {
  id: string
  time: number
  kind: EventKind
  position: Point
  label: string
  penalty: number
}
export interface Sample {
  time: number
  boat: Boat
  wind: Wind
  nextGate: number
  penalty: number
}
export interface Voyage {
  id: string
  date: string
  courseId: string
  windMode: WindMode
  status: 'finished' | 'abandoned'
  duration: number
  penalty: number
  samples: Sample[]
  events: RaceEvent[]
}
