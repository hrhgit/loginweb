<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { Clock } from 'lucide-vue-next'
import type { DisplayEvent } from '../../store/models'
import { statusClass, statusLabel } from '../../utils/eventFormat'

const props = defineProps<{
  event: DisplayEvent
  timeLabel: string
  summary: string
}>()

const emit = defineEmits<{
  (event: 'card-dblclick', value: MouseEvent): void
}>()

const handleDblClick = (event: MouseEvent) => {
  emit('card-dblclick', event)
}
</script>

<template>
  <article class="activity-card" @dblclick="handleDblClick">
    <header class="activity-card__top">
      <p class="activity-card__time">
        <Clock :size="14" />
        <span>{{ props.timeLabel }}</span>
      </p>
      <div class="activity-card__badges">
        <span v-if="props.event.status" class="pill-badge" :class="statusClass(props.event.status)">
          {{ statusLabel(props.event.status) }}
        </span>
        <slot name="badges" />
      </div>
    </header>

    <h3 class="activity-card__title">
      <RouterLink class="activity-card__title-link" :to="`/events/${props.event.id}`">
        {{ props.event.title }}
      </RouterLink>
    </h3>

    <p class="activity-card__desc">{{ props.summary }}</p>

    <div class="activity-card__meta">
      <slot name="meta" />
    </div>

    <footer class="activity-card__actions">
      <slot name="actions" />
    </footer>
  </article>
</template>

<style scoped>
.activity-card__time {
  display: flex;
  align-items: center;
  gap: 6px;
}
</style>
