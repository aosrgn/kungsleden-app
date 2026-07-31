import { onMounted, onBeforeUnmount, ref } from 'vue'

// A single shared wall clock that ticks on an interval, so time-derived displays
// (daylight-left, ETAs) stay live while stationary without each owning a timer.
export function useNow(intervalMs = 60000) {
  const now = ref(new Date())
  let timer: ReturnType<typeof setInterval> | undefined
  onMounted(() => { timer = setInterval(() => (now.value = new Date()), intervalMs) })
  onBeforeUnmount(() => clearInterval(timer))
  return now
}
