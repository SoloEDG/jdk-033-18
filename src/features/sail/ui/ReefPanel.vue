<script setup lang="ts">
import { computed } from 'vue'
import { AlertTriangle, Anchor, Lock, LockOpen, Minimize2 } from 'lucide-vue-next'
import { clock } from '../../../shared/format'
import type { Boat, Gate, WinchMode } from '../../../shared/race'
import type { GateForecast } from '../../jury'
import { sheetSupportRange } from '../lib/reefing'

const props = defineProps<{
  boat: Boat
  wind: Parameters<typeof sheetSupportRange>[1]
  gate: Gate | null
  forecast: GateForecast | null
  disabled: boolean
}>()
const emit = defineEmits<{
  haul: []
  hold: []
  release: []
  mode: [mode: WinchMode]
  setup: []
}>()

const percent = (value: number) => `${Math.round(value * 100)}%`
const unlocked = computed(() => Math.max(0, props.boat.reefDraw - props.boat.reefLocked))
const remainingArea = computed(() => 1 - props.boat.reefDraw)
const range = computed(() => sheetSupportRange(props.boat, props.wind))
const rangeMessage = computed(() => {
  const angle = props.boat.sheet.toFixed(0)
  if (range.value.supported) return `当前帆角 ${angle}°：仍在可维持范围内`
  const violation = range.value.violation.toFixed(1)
  if (props.boat.reefDraw < .001) return `当前帆角 ${angle}° 超出建议范围 ${violation}°；尚未缩帆，收绳前可先进入该区间`
  if (unlocked.value > .002) return `当前帆角 ${angle}° 超出范围 ${violation}°，未锁定部分会滑回`
  return `当前帆角 ${angle}° 超出范围 ${violation}°；已锁定档位安全，新拉入但未锁定的部分可能滑回`
})
const haulLabel = computed(() => {
  if (props.boat.winchDrive === 'haul') return '收绳中 · 点击暂停'
  if (props.boat.winchJammed) return '卡住 · 转舵卸力后恢复收绳'
  if (props.boat.reefSlack > .01) return '收缩帆绳（先收空程）'
  return props.boat.reefDraw > .001 ? '恢复收绳 / 再锁一档' : '收缩帆绳'
})
const statusLabel = computed(() => ({
  standby: '待命',
  slack: '收空程',
  hauling: '收绳受力',
  holding: '停绞保压',
  jammed: '太紧卡住',
  slipping: '未锁定部分滑回',
  locked: '已锁定',
}[props.boat.winchStatus]))
</script>

<template>
  <section class="instrument reef" aria-label="缩帆与绞盘" data-testid="reef-panel">
    <h2><Minimize2 :size="16"/> 缩帆与绞盘</h2>

    <div class="reef-grid">
      <div class="reef-stat locked">
        <span><Lock :size="12"/> 已锁定面积</span>
        <strong data-testid="reef-locked" :data-value="boat.reefLocked.toFixed(4)" :data-locks="Math.round(boat.reefLocked / 0.08)"><span data-testid="locked-area"><span data-testid="locked-reef">{{ percent(boat.reefLocked) }}</span></span></strong>
      </div>
      <div class="reef-stat">
        <span><LockOpen :size="12"/> 未锁定拉入</span>
        <strong data-testid="reef-unlocked" :data-value="unlocked.toFixed(4)"><span data-testid="unlocked-reef">{{ percent(unlocked) }}</span></strong>
      </div>
      <div class="reef-stat return">
        <span>本次退回量</span>
        <strong data-testid="reef-return" :data-value="boat.reefReturn.toFixed(4)"><span data-testid="slipback"><span data-testid="slip-back"><span data-testid="reef-slip">{{ percent(boat.reefReturn) }}</span></span></span></strong>
      </div>
      <div class="reef-stat">
        <span>当前缩帆</span>
        <strong data-testid="reef-area" :data-value="boat.reefDraw.toFixed(4)"><span data-testid="reef"><span data-testid="reef-level">{{ percent(boat.reefDraw) }}</span></span></strong>
      </div>
    </div>
    <p class="area-line">当前剩余帆面积 <output data-testid="sail-area" :data-value="remainingArea.toFixed(4)"><span data-testid="remaining-area">{{ percent(remainingArea) }}</span></output>；“已锁定”指不会随放开绞盘退回的缩帆档位。</p>

    <label class="slider-label" for="reef-slack-meter">缩帆绳空程 <output data-testid="reef-slack" :data-value="boat.reefSlack.toFixed(3)">{{ percent(boat.reefSlack) }}</output></label>
    <div id="reef-slack-meter" class="meter" role="meter" aria-label="缩帆绳空程" :aria-valuenow="Math.round(boat.reefSlack * 100)" aria-valuemin="0" aria-valuemax="100"><i :style="{ width: percent(boat.reefSlack) }"></i></div>

    <div class="winch-readings">
      <div><span>绞盘状态</span><b data-testid="winch-status" :data-state="boat.winchStatus"><span data-testid="winch-state">{{ statusLabel }}</span></b></div>
      <div><span>张力</span><output data-testid="winch-tension" :data-value="boat.winchTension.toFixed(3)">{{ percent(boat.winchTension) }}</output></div>
      <div><span>帆负载</span><output data-testid="sail-load" :data-value="boat.sailLoad.toFixed(3)">{{ percent(Math.min(1, boat.sailLoad)) }}</output></div>
    </div>
    <div class="meter tension" role="meter" aria-label="绞盘张力" :aria-valuenow="Math.round(boat.winchTension * 100)" aria-valuemin="0" aria-valuemax="100"><i :class="{ jam: boat.winchTension > .82 }" :style="{ width: percent(boat.winchTension) }"></i></div>

    <div class="segment winch-mode" role="group" aria-label="绞盘用途">
      <button type="button" data-testid="winch-mode-sheet" :disabled="disabled" :aria-pressed="boat.winchMode === 'sheet'" @click="emit('mode', 'sheet')">同一个绞盘 · 调帆角</button>
      <button type="button" data-testid="winch-mode-reef" :disabled="disabled" :aria-pressed="boat.winchMode === 'reef'" @click="emit('mode', 'reef')">缩帆绳</button>
    </div>
    <div class="segment winch-actions">
      <button type="button" class="haul" data-testid="winch-haul" :disabled="disabled" :aria-pressed="boat.winchDrive === 'haul'" @click="emit('haul')">{{ haulLabel }}</button>
      <button type="button" data-testid="winch-hold" :disabled="disabled || boat.winchDrive !== 'haul'" @click="emit('hold')">停绞</button>
      <button type="button" class="release" data-testid="winch-release" :disabled="disabled || boat.winchDrive === 'free'" @click="emit('release')">放开绞盘</button>
    </div>
    <p v-if="boat.winchJammed" class="warning" role="alert" data-testid="winch-jam"><AlertTriangle :size="14"/> 绳太紧，绞盘已卡住；转舵改变负载，或放开绞盘卸力。</p>

    <div class="range-box" :data-supported="range.supported" data-testid="sheet-range">
      <div class="range-heading">
        <span>可维持缩帆的帆角范围</span>
        <output data-testid="safe-sheet-range"><span data-testid="reef-range"><span data-testid="safe-range"><span data-testid="maintainable-sheet-range"><span data-testid="sheet-range-min">{{ range.min.toFixed(0) }}</span>°–<span data-testid="sheet-range-max">{{ range.max.toFixed(0) }}</span>°</span></span></span></output>
      </div>
      <div class="range-visual" :style="{ '--min': `${range.min / 85 * 100}%`, '--max': `${range.max / 85 * 100}%`, '--sheet': `${boat.sheet / 85 * 100}%` }">
        <i class="safe-band"></i><i class="sheet-pin"></i>
      </div>
      <p :class="range.supported ? 'range-ok' : 'warning'" data-testid="sheet-range-status" :data-supported="String(range.supported)">
        {{ rangeMessage }}
      </p>
    </div>

    <div v-if="gate && forecast" class="forecast" :data-state="forecast.willPass ? 'pass' : 'miss'" data-testid="gate-forecast">
      <div class="range-heading"><span>继续当前操舵 / 绞盘动作</span><b>{{ gate.name }}线预测</b></div>
      <p class="forecast-meta">
        <template v-if="forecast.eta !== null">约 <output data-testid="gate-eta">{{ clock(forecast.eta) }}</output> 到线，</template>
        横距 <output data-testid="gate-lateral">{{ forecast.lateral.toFixed(0) }} m</output>
        <template v-if="forecast.clearance !== null">，余量 <output data-testid="gate-clearance">{{ forecast.clearance.toFixed(0) }} m</output></template>
      </p>
      <strong data-testid="gate-miss" :data-miss="String(!forecast.willPass)"><span data-testid="gate-prediction"><span data-testid="gate-warning">
        {{ forecast.willPass ? '可维持通过门线' : forecast.reason === 'outside-gate' ? '继续操作会使船错过门线' : '当前轨迹不会到达门线' }}
      </span></span></strong>
    </div>
    <div v-else class="forecast passed" data-testid="gate-forecast" data-state="pass">
      <strong data-testid="gate-miss" data-miss="false">当前门线已通过，成绩计入计时与罚时</strong>
    </div>

    <p class="scenario-help">验收序列：转舵卸力 → 恢复收绳 → 反向阵风 → 放开绞盘。</p>
    <button type="button" class="scenario-button" data-testid="setup-reef-check" @click="emit('setup')">
      <Anchor :size="14"/> 布置门线验证航段
    </button>
  </section>
</template>
