<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch, useTemplateRef } from 'vue'
import maplibregl, { type Map as MLMap, Marker } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useGeolocation } from '../composables/useGeolocation'

const { status, coords, lastError, permState, isStandalone, locateFix, locate } = useGeolocation()

const mapEl = useTemplateRef<HTMLDivElement>('mapEl')

let map: MLMap | null = null
let userMarker: Marker | null = null

const KUNGSLEDEN_MID: [number, number] = [17.5, 67.5]

const LM_USER = import.meta.env.VITE_LM_USER as string | undefined
const LM_PASS = import.meta.env.VITE_LM_PASS as string | undefined
const LM_AUTH = LM_USER && LM_PASS ? 'Basic ' + btoa(`${LM_USER}:${LM_PASS}`) : undefined
const LM_LAYER = 'topowebb_nedtonad'

type BasemapKey = 'lantmateriet' | 'opentopo'
const activeBasemap = ref<BasemapKey>(LM_AUTH ? 'lantmateriet' : 'opentopo')
const trailsVisible = ref<boolean>(true)

const LM_TILE_URL =
  `https://maps.lantmateriet.se/open/topowebb-ccby/v1/wmts` +
  `?service=WMTS&request=GetTile&version=1.0.0&layer=${LM_LAYER}` +
  `&style=default&tilematrixset=3857&tilematrix={z}&tilerow={y}&tilecol={x}&format=image/png`

function buildStyle(): maplibregl.StyleSpecification {
  const sources: maplibregl.StyleSpecification['sources'] = {
    opentopo: {
      type: 'raster',
      tiles: [
        'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
        'https://b.tile.opentopomap.org/{z}/{x}/{y}.png',
        'https://c.tile.opentopomap.org/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution:
        'Map data: &copy; OSM contributors, SRTM | Style: &copy; OpenTopoMap (CC-BY-SA)',
      maxzoom: 17,
    },
    hiking: {
      type: 'raster',
      tiles: ['https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '&copy; <a href="https://hiking.waymarkedtrails.org">Waymarked Trails</a>',
      maxzoom: 18,
    },
  }
  const layers: maplibregl.LayerSpecification[] = [
    {
      id: 'opentopo',
      type: 'raster',
      source: 'opentopo',
      layout: { visibility: activeBasemap.value === 'opentopo' ? 'visible' : 'none' },
    },
  ]
  if (LM_AUTH) {
    sources.lantmateriet = {
      type: 'raster',
      tiles: [LM_TILE_URL],
      tileSize: 256,
      attribution: '© Lantmäteriet',
      maxzoom: 9,
    }
    layers.unshift({
      id: 'lantmateriet',
      type: 'raster',
      source: 'lantmateriet',
      layout: { visibility: activeBasemap.value === 'lantmateriet' ? 'visible' : 'none' },
    })
  }
  layers.push({
    id: 'hiking',
    type: 'raster',
    source: 'hiking',
    layout: { visibility: trailsVisible.value ? 'visible' : 'none' },
  })
  return { version: 8, sources, layers }
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

watch(coords, (c) => {
  if (!map || !c) return
  const lngLat: [number, number] = [c.lng, c.lat]
  if (!userMarker) {
    userMarker = new maplibregl.Marker({ element: makeMarkerEl() }).setLngLat(lngLat).addTo(map)
  } else {
    userMarker.setLngLat(lngLat)
  }
})

// Recenter on every explicit locate/retry, not on routine watch ticks.
watch(locateFix, () => {
  if (!map || !coords.value) return
  map.flyTo({ center: [coords.value.lng, coords.value.lat], zoom: 13, duration: 800 })
})

function switchBasemap() {
  if (!map) return
  activeBasemap.value = activeBasemap.value === 'lantmateriet' ? 'opentopo' : 'lantmateriet'
  if (map.getLayer('opentopo')) {
    map.setLayoutProperty('opentopo', 'visibility', activeBasemap.value === 'opentopo' ? 'visible' : 'none')
  }
  if (map.getLayer('lantmateriet')) {
    map.setLayoutProperty('lantmateriet', 'visibility', activeBasemap.value === 'lantmateriet' ? 'visible' : 'none')
  }
}

function toggleTrails() {
  if (!map) return
  trailsVisible.value = !trailsVisible.value
  if (map.getLayer('hiking')) {
    map.setLayoutProperty('hiking', 'visibility', trailsVisible.value ? 'visible' : 'none')
  }
}

onMounted(() => {
  if (!mapEl.value) return

  map = new maplibregl.Map({
    container: mapEl.value,
    style: buildStyle(),
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
        <button @click="toggleTrails">
          Trails: {{ trailsVisible ? 'on' : 'off' }}
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
