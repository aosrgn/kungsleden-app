<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, useTemplateRef } from 'vue'
import maplibregl, { type Map as MLMap, Marker } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

const mapEl = useTemplateRef<HTMLDivElement>('mapEl')
const status = ref<'idle' | 'locating' | 'located' | 'denied' | 'unavailable' | 'error'>('idle')
const coords = ref<{ lat: number; lng: number; acc: number } | null>(null)
const lastError = ref<string>('')
const permState = ref<string>('unknown')
const isStandalone = ref<boolean>(false)

let map: MLMap | null = null
let userMarker: Marker | null = null
let watchId: number | null = null

const KUNGSLEDEN_MID: [number, number] = [17.5, 67.5]
const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'

function makeMarkerEl(): HTMLDivElement {
  const el = document.createElement('div')
  el.style.cssText = `
    width: 18px; height: 18px;
    background: #1a7fff;
    border: 3px solid #fff;
    border-radius: 50%;
    box-shadow: 0 0 0 2px rgba(26,127,255,0.3);
  `
  return el
}

function onPosition(pos: GeolocationPosition, recenter: boolean) {
  if (!map) return
  const { latitude, longitude, accuracy } = pos.coords
  coords.value = { lat: latitude, lng: longitude, acc: accuracy }
  status.value = 'located'
  lastError.value = ''

  const lngLat: [number, number] = [longitude, latitude]
  if (!userMarker) {
    userMarker = new maplibregl.Marker({ element: makeMarkerEl() }).setLngLat(lngLat).addTo(map)
  } else {
    userMarker.setLngLat(lngLat)
  }
  if (recenter) map.flyTo({ center: lngLat, zoom: 13, duration: 800 })
}

function onError(err: GeolocationPositionError) {
  lastError.value = `code=${err.code} msg="${err.message}"`
  status.value = err.code === 1 ? 'denied' : err.code === 2 ? 'unavailable' : 'error'
}

type Strategy = 'minimal' | 'low-acc' | 'delayed'

function startWatch() {
  if (watchId !== null) navigator.geolocation.clearWatch(watchId)
  watchId = navigator.geolocation.watchPosition(
    (p) => onPosition(p, false),
    (err) => onError(err),
    { enableHighAccuracy: true, maximumAge: 5000 },
  )
}

function tryGet(strategy: Strategy): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    const success = (p: GeolocationPosition) => resolve(p)
    const fail = (e: GeolocationPositionError) => reject(e)
    if (strategy === 'minimal') {
      navigator.geolocation.getCurrentPosition(success, fail)
    } else if (strategy === 'low-acc') {
      navigator.geolocation.getCurrentPosition(success, fail, { enableHighAccuracy: false })
    } else {
      setTimeout(() => navigator.geolocation.getCurrentPosition(success, fail), 0)
    }
  })
}

async function locate() {
  if (!('geolocation' in navigator)) {
    status.value = 'unavailable'
    lastError.value = 'navigator.geolocation undefined'
    return
  }
  status.value = 'locating'
  lastError.value = ''

  const strategies: Strategy[] = ['minimal', 'low-acc', 'delayed']
  for (const s of strategies) {
    try {
      const pos = await tryGet(s)
      lastError.value = `ok via ${s}`
      onPosition(pos, true)
      startWatch()
      return
    } catch (e) {
      const err = e as GeolocationPositionError
      lastError.value = `${s}: code=${err.code} "${err.message}"`
      if (err.code !== 1) break
    }
  }
  status.value = lastError.value.includes('code=1') ? 'denied' : 'error'
}

async function refreshPermState() {
  if (!('permissions' in navigator)) {
    permState.value = 'permissions API unavailable'
    return
  }
  try {
    const p = await navigator.permissions.query({ name: 'geolocation' as PermissionName })
    permState.value = p.state
    p.onchange = () => { permState.value = p.state }
  } catch (e) {
    permState.value = `query failed: ${(e as Error).message}`
  }
}

onMounted(() => {
  if (!mapEl.value) return
  isStandalone.value = window.matchMedia('(display-mode: standalone)').matches
    || (navigator as unknown as { standalone?: boolean }).standalone === true
  refreshPermState()

  map = new maplibregl.Map({
    container: mapEl.value,
    style: STYLE_URL,
    center: KUNGSLEDEN_MID,
    zoom: 6,
    attributionControl: { compact: true },
  })
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right')
})

onBeforeUnmount(() => {
  if (watchId !== null) navigator.geolocation.clearWatch(watchId)
  userMarker?.remove()
  map?.remove()
  map = null
})

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
      <div class="diag">
        <div>standalone: {{ isStandalone ? 'yes' : 'no' }}</div>
        <div>permission: {{ permState }}</div>
        <div v-if="lastError">err: {{ lastError }}</div>
      </div>
      <button v-if="status !== 'located' && status !== 'locating'" @click="locate">
        {{ status === 'idle' ? 'Locate me' : 'Retry' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.map-wrap { position: fixed; inset: 0; }
.map { position: absolute; inset: 0; }

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

.row { display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; }
.status { opacity: 0.6; font-size: 0.75rem; }

.coords {
  margin-top: 0.25rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.75rem;
  opacity: 0.7;
}

.diag {
  margin-top: 0.35rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.7rem;
  opacity: 0.6;
  line-height: 1.4;
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
