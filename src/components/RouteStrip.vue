<script setup lang="ts">
import { computed } from 'vue'
import type { DiaryRow } from '../data/trip'

const props = defineProps<{ rows: DiaryRow[] }>()

// Every located diary feature, ordered along the route. Position anchoring and
// per-node ETA are added in a later phase; for now this is a static overview.
const nodes = computed(() =>
  props.rows
    .filter((r) => r.fromStart != null)
    .slice()
    .sort((a, b) => (a.fromStart as number) - (b.fromStart as number)),
)
</script>

<template>
  <ol class="strip">
    <li
      v-for="(node, i) in nodes"
      :key="i"
      class="node"
      :class="{ overnight: node.overnight }"
    >
      <span class="km">{{ (node.fromStart as number).toFixed(1) }}</span>
      <span class="rail"><span class="dot" /></span>
      <span class="label">
        <span class="name">{{ node.icon }} {{ node.name }}</span>
        <span v-if="node.notes" class="note">{{ node.notes }}</span>
      </span>
    </li>
  </ol>
</template>

<style scoped>
.strip {
  list-style: none;
  margin: 0;
  padding: 0;
}

.node {
  display: grid;
  grid-template-columns: 3.25rem 1.25rem 1fr;
  align-items: start;
  column-gap: 0.5rem;
  min-height: 2.4rem;
}

.km {
  text-align: right;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.72rem;
  opacity: 0.6;
  padding-top: 0.1rem;
}

/* the continuous vertical line, with the node's dot centered on it */
.rail {
  position: relative;
  align-self: stretch;
  justify-self: center;
  width: 1.25rem;
}
.rail::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 2px;
  transform: translateX(-50%);
  background: color-mix(in srgb, currentColor 22%, transparent);
}
.dot {
  position: absolute;
  top: 0.35rem;
  left: 50%;
  width: 0.6rem;
  height: 0.6rem;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: color-mix(in srgb, currentColor 45%, transparent);
}

.label {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  padding-bottom: 0.6rem;
}
.name { font-size: 0.9rem; }
.note {
  font-size: 0.72rem;
  opacity: 0.6;
  line-height: 1.35;
}

/* overnight stops stand out along the line */
.overnight .dot {
  top: 0.4rem;
  width: 0.85rem;
  height: 0.85rem;
  background: #0a7d5a;
}
.overnight .name { font-weight: 650; }
</style>
