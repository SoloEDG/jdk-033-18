import { ref } from 'vue'
import type { WindMode } from '../../../shared/race'
import { windAt } from '../lib/forecast'

export function useWind() {
  const mode = ref<WindMode>('shifting')
  const gustStart = ref<number | null>(null)
  const sample = (time: number) => {
    const base = windAt(time, mode.value)
    if (gustStart.value === null) return { ...base, gust: 0 }
    const age = time - gustStart.value
    if (age < 0) return { ...base, gust: 0 }
    // Sharp reverse gust, followed by a short decay.
    const gust = Math.exp(-age / 1.05)
    return {
      ...base,
      bearing: (base.bearing + 180 * gust + 360) % 360,
      knots: base.knots + 10 * gust,
      gust,
    }
  }
  const set = (next: WindMode) => {
    mode.value = next
    gustStart.value = null
  }
  const triggerGust = (time: number) => { gustStart.value = time }
  const clearGust = () => { gustStart.value = null }
  return { mode, gustStart, sample, set, triggerGust, clearGust }
}
