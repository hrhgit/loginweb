import { onMounted } from 'vue'

type EventsReadyStore = {
  ensureEventsLoaded: () => Promise<void> | void
  ensureRegistrationsLoaded: () => Promise<void> | void
}

export const useEventsReady = (store: EventsReadyStore) => {
  onMounted(async () => {
    await store.ensureEventsLoaded()
    await store.ensureRegistrationsLoaded()
  })
}
