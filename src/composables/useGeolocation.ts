import { onMounted, onBeforeUnmount, ref } from 'vue'

// Owns device geolocation only (no UI, no map). Exposes reactive position +
// diagnostics and a locate() that runs the iOS-18-standalone workaround: three
// getCurrentPosition strategies tried in order, then a continuous watch.
// iOS 18 standalone PWAs return code=1 with no prompt on the first attempt;
// 'low-acc' / 'delayed' recover it. Don't simplify without testing on-device.

export type GeoStatus = 'idle' | 'locating' | 'located' | 'denied' | 'unavailable' | 'error'
export type Coords = { lat: number; lng: number; acc: number }

type Strategy = 'minimal' | 'low-acc' | 'delayed'

export function useGeolocation() {
  const status = ref<GeoStatus>('idle')
  const coords = ref<Coords | null>(null)
  const lastError = ref<string>('')
  const permState = ref<string>('unknown')
  const isStandalone = ref<boolean>(false)
  // Bumped once per successful locate() call so a consumer can recenter on every
  // explicit locate/retry (not on routine watch ticks). UI-agnostic: just a counter.
  const locateFix = ref<number>(0)

  let watchId: number | null = null

  function handlePosition(pos: GeolocationPosition) {
    const { latitude, longitude, accuracy } = pos.coords
    coords.value = { lat: latitude, lng: longitude, acc: accuracy }
    status.value = 'located'
    lastError.value = ''
  }

  function onError(err: GeolocationPositionError) {
    lastError.value = `code=${err.code} msg="${err.message}"`
    status.value = err.code === 1 ? 'denied' : err.code === 2 ? 'unavailable' : 'error'
  }

  function startWatch() {
    if (watchId !== null) navigator.geolocation.clearWatch(watchId)
    watchId = navigator.geolocation.watchPosition(
      (p) => handlePosition(p),
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
        handlePosition(pos)
        startWatch()
        locateFix.value++
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
    isStandalone.value = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as unknown as { standalone?: boolean }).standalone === true
    refreshPermState()
  })

  onBeforeUnmount(() => {
    if (watchId !== null) navigator.geolocation.clearWatch(watchId)
  })

  return { status, coords, lastError, permState, isStandalone, locateFix, locate }
}
