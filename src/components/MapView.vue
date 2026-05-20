<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, useTemplateRef } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

const mapEl = useTemplateRef<HTMLDivElement>('mapEl')
const status = ref<'idle' | 'locating' | 'located' | 'denied' | 'unavailable' | 'error'>('idle')
const coords = ref<{ lat: number; lng: number; acc: number } | null>(null)

let map: L.Map | null = null
let userMarker: L.Marker | null = null
let userCircle: L.Circle | null = null
let watchId: number | null = null

const defaultIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

const KUNGSLEDEN_MID: L.LatLngTuple = [67.5, 17.5]

function updateUserPosition(pos: GeolocationPosition, recenter: boolean) {
  if (!map) return
  const { latitude, longitude, accuracy } = pos.coords
  coords.value = { lat: latitude, lng: longitude, acc: accuracy }
  status.value = 'located'

  const latlng: L.LatLngTuple = [latitude, longitude]
  if (!userMarker) {
    userMarker = L.marker(latlng, { icon: defaultIcon }).addTo(map)
    userCircle = L.circle(latlng, { radius: accuracy, color: '#0a3d2e', fillOpacity: 0.1 }).addTo(map)
  } else {
    userMarker.setLatLng(latlng)
    userCircle?.setLatLng(latlng).setRadius(accuracy)
  }
  if (recenter) map.setView(latlng, 13)
}

function locate() {
  if (!('geolocation' in navigator)) {
    status.value = 'unavailable'
    return
  }
  status.value = 'locating'
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      updateUserPosition(pos, true)
      watchId = navigator.geolocation.watchPosition(
        (p) => updateUserPosition(p, false),
        () => {},
        { enableHighAccuracy: true, maximumAge: 5000 },
      )
    },
    (err) => {
      status.value = err.code === err.PERMISSION_DENIED ? 'denied' : 'error'
    },
    { enableHighAccuracy: true, timeout: 10000 },
  )
}

onMounted(() => {
  if (!mapEl.value) return
  map = L.map(mapEl.value, { zoomControl: true }).setView(KUNGSLEDEN_MID, 7)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map)
  locate()
})

onBeforeUnmount(() => {
  if (watchId !== null) navigator.geolocation.clearWatch(watchId)
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
      <button v-if="status === 'denied' || status === 'error'" @click="locate">Retry</button>
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
  right: 0;
  margin: 0.75rem;
  padding: 0.6rem 0.8rem;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(8px);
  border-radius: 0.5rem;
  font-size: 0.85rem;
  color: #1a1a1a;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  pointer-events: auto;
  z-index: 1000;
}

.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
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
