<script setup lang="ts">
import { computed } from 'vue'
import { daylight } from '../daylight'

const props = defineProps<{
  positionKm: number | null
  totalKm: number
  lat: number | null
  lng: number | null
  now: Date
}>()

// Route sections (km ranges from the diary plan, data/src/build-diary-md.ts).
const SECTIONS = [
  { id: 'A', name: 'Hemavan → Ammarnäs', end: 78 },
  { id: 'B', name: 'Ammarnäs → Kvikkjokk', end: 254 },
  { id: 'C', name: 'Kvikkjokk → Saltoluokta', end: 324 },
  { id: 'D', name: 'Saltoluokta → Singi', end: 388 },
  { id: 'E', name: 'Singi → Abisko', end: Infinity },
]
const section = computed(() =>
  props.positionKm == null ? null : SECTIONS.find((s) => props.positionKm! < s.end) ?? null,
)

const kmToGo = computed(() =>
  props.positionKm == null ? null : Math.max(0, props.totalKm - props.positionKm),
)

const light = computed(() =>
  props.lat == null || props.lng == null ? null : daylight(props.lat, props.lng, props.now),
)

const hhmm = (date: Date) =>
  date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })

const daylightText = computed(() => {
  const l = light.value
  if (!l) return '—'
  switch (l.status) {
    case 'midnight-sun': return 'midnight sun'
    case 'polar-night': return 'polar night'
    case 'before-sunrise': return `night · sunrise ${hhmm(l.sunrise)}`
    case 'after-sunset': return `after sunset (${hhmm(l.sunset)})`
    case 'day': {
      const h = Math.floor(l.minutesLeft / 60)
      const m = l.minutesLeft % 60
      return `${h > 0 ? `${h}h ` : ''}${m}m daylight · sunset ${hhmm(l.sunset)}`
    }
  }
  return '—'
})
</script>

<template>
  <section class="now">
    <div class="stat">
      <span class="label">Now</span>
      <span v-if="positionKm != null" class="value">
        km {{ positionKm.toFixed(1) }}<span class="sub"> · {{ kmToGo!.toFixed(0) }} to go</span>
      </span>
      <span v-else class="value muted">waiting for position…</span>
    </div>
    <div v-if="section" class="stat">
      <span class="label">Section</span>
      <span class="value">{{ section.id }} · {{ section.name }}</span>
    </div>
    <div class="stat">
      <span class="label">Daylight</span>
      <span class="value">{{ daylightText }}</span>
    </div>
  </section>
</template>

<style scoped>
.now {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.8rem 0.9rem;
  border-radius: 0.6rem;
  background: color-mix(in srgb, currentColor 6%, transparent);
}

.stat {
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
}
.label {
  flex: 0 0 4.5rem;
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  opacity: 0.55;
}
.value {
  font-size: 0.95rem;
}
.value .sub {
  opacity: 0.6;
  font-size: 0.85rem;
}
.muted { opacity: 0.6; font-size: 0.85rem; }
</style>
