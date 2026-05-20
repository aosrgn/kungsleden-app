<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, useTemplateRef } from 'vue'
import maplibregl, { type Map as MLMap, type GeolocateControl } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

const mapEl = useTemplateRef<HTMLDivElement>('mapEl')
const status = ref<'idle' | 'locating' | 'located' | 'denied' | 'unavailable' | 'error'>('idle')
const coords = ref<{ lat: number; lng: number; acc: number } | null>(null)

let map: MLMap | null = null
let geolocate: GeolocateControl | null = null

const KUNGSLEDEN_MID: [number, number] = [17.5, 67.5]
const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'

onMounted(() => {
  if (!mapEl.value) return

  map = new maplibregl.Map({
    container: mapEl.value,
    style: STYLE_URL,
    center: KUNGSLEDEN_MID,
    zoom: 6,
    attributionControl: { compact: true },
  })

  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right')

  geolocate = new maplibregl.GeolocateControl({
    positionOptions: { enableHighAccuracy: true, timeout: 10000 },
    trackUserLocation: true,
    showAccuracyCircle: true,
    fitBoundsOptions: { maxZoom: 13 },
  })
  map.addControl(geolocate, 'top-right')

  geolocate.on('geolocate', (e) => {
    const p = e as unknown as { coords: GeolocationCoordinates }
    coords.value = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }
    status.value = 'located'
  })

  geolocate.on('error', (err) => {
    const code = (err as unknown as { code?: number }).code
    status.value = code === 1 ? 'denied' : code === 2 ? 'unavailable' : 'error'
  })

  geolocate.on('trackuserlocationstart', () => { status.value = 'locating' })

  map.on('load', () => {
    status.value = 'locating'
    geolocate?.trigger()
  })
})

onBeforeUnmount(() => {
  map?.remove()
  map = null
})

function retry() {
  status.value = 'locating'
  geolocate?.trigger()
}

const statusLabel: Record<typeof status.value, string> = {
  idle: '',
  locating: 'locating…',
  located: 'located',
  denied: 'location denied',
  unavailable: 'geolocation unavailable',
  error: 'location error',
}
</script>

<template>
  <div class="map-wrap">
    <div ref="mapEl" class="map" />
    <div class="overlay">
      <div class="row">
        <strong>Kungsleden</strong>
        <span class="status">{{ statusLabel[status] }}</span>
      </div>
      <div v-if="coords" class="coords">
        {{ coords.lat.toFixed(5) }}, {{ coords.lng.toFixed(5) }} · ±{{ Math.round(coords.acc) }}m
      </div>
      <button v-if="status === 'denied' || status === 'error' || status === 'unavailable'" @click="retry">
        Retry
      </button>
    </div>
  </div>
</template>

<style scoped>
.map-wrap {
  position: fixed;
  inset: 0;
}

.map {
  position: absolute;
  inset: 0;
}

.overlay {
  position: absolute;
  top: env(safe-area-inset-top, 0);
  left: 0;
  margin: 0.75rem;
  padding: 0.6rem 0.8rem;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(8px);
  border-radius: 0.5rem;
  font-size: 0.85rem;
  color: #1a1a1a;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  max-width: calc(100vw - 6rem);
}

.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
}

.status {
  opacity: 0.6;
  font-size: 0.75rem;
}

.coords {
  margin-top: 0.25rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.75rem;
  opacity: 0.7;
}

button {
  margin-top: 0.4rem;
  padding: 0.3rem 0.6rem;
  border: 1px solid #0a3d2e;
  background: #0a3d2e;
  color: #f4f1ea;
  border-radius: 0.3rem;
  font-size: 0.8rem;
  cursor: pointer;
}
</style>
