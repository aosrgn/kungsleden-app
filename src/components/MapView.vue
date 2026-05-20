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

const LM_USER = import.meta.env.VITE_LM_USER as string | undefined
const LM_PASS = import.meta.env.VITE_LM_PASS as string | undefined
const LM_AUTH = LM_USER && LM_PASS ? 'Basic ' + btoa(`${LM_USER}:${LM_PASS}`) : undefined
const LM_LAYER = 'topowebbkartan'

type BasemapKey = 'lantmateriet' | 'opentopo'
const activeBasemap = ref<BasemapKey>(LM_AUTH ? 'lantmateriet' : 'opentopo')

function buildStyle(key: BasemapKey): maplibregl.StyleSpecification {
  if (key === 'lantmateriet' && LM_AUTH) {
    const url =
      `https://maps.lantmateriet.se/open/topowebb-ccby/v1/wmts` +
      `?service=WMTS&request=GetTile&version=1.0.0&layer=${LM_LAYER}` +
      `&style=default&tilematrixset=3857&tilematrix={z}&tilerow={y}&tilecol={x}&format=image/png`
    return {
      version: 8,
      sources: {
        lantmateriet: {
          type: 'raster',
          tiles: [url],
          tileSize: 256,
          attribution: '© Lantmäteriet',
          maxzoom: 14,
        },
      },
      layers: [{ id: 'lantmateriet', type: 'raster', source: 'lantmateriet' }],
    }
  }
  return {
    version: 8,
    sources: {
      opentopo: {
        type: 'raster',
        tiles: [
          'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
          'https://b.tile.opentopomap.org/{z}/{x}/{y}.png',
          'https://c.tile.opentopomap.org/{z}/{x}/{y}.png',
        ],
        tileSize: 256,
        attribution:
          'Map data: &copy; OpenStreetMap contributors, SRTM | Style: &copy; OpenTopoMap (CC-BY-SA)',
        maxzoom: 17,
      },
    },
    layers: [{ id: 'opentopo', type: 'raster', source: 'opentopo' }],
  }
}

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

function switchBasemap() {
  if (!map) return
  activeBasemap.value = activeBasemap.value === 'lantmateriet' ? 'opentopo' : 'lantmateriet'
  map.setStyle(buildStyle(activeBasemap.value))
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
    style: buildStyle(activeBasemap.value),
    center: KUNGSLEDEN_MID,
    zoom: 6,
    attributionControl: { compact: true },
    transformRequest: (url) => {
      if (LM_AUTH && url.startsWith('https://maps.lantmateriet.se/')) {
        return { url, headers: { Authorization: LM_AUTH } }
      }
      return { url }
    },
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
      <div class="actions">
        <button v-if="status !== 'located' && status !== 'locating'" @click="locate">
          {{ status === 'idle' ? 'Locate me' : 'Retry' }}
        </button>
        <button v-if="LM_AUTH" @click="switchBasemap">
          {{ activeBasemap === 'lantmateriet' ? 'Switch to OpenTopo' : 'Switch to Lantmäteriet' }}
        </button>
      </div>
      <div class="basemap-tag">basemap: {{ activeBasemap }}{{ LM_AUTH ? '' : ' (no LM creds)' }}</div>
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

.actions {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
  margin-top: 0.4rem;
}

.basemap-tag {
  margin-top: 0.25rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.7rem;
  opacity: 0.55;
}

button {
  padding: 0.3rem 0.6rem;
  border: 1px solid #0a3d2e;
  background: #0a3d2e;
  color: #f4f1ea;
  border-radius: 0.3rem;
  font-size: 0.8rem;
  cursor: pointer;
}
</style>
