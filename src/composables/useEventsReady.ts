import { onMounted } from 'vue'
import { useEvents } from './useEvents'
import { useAppStore } from '../store/appStore'

/**
 * Composable to ensure events and registrations are loaded on component mount
 * Updated to work with Vue Query composables
 */
export const useEventsReady = () => {
  const store = useAppStore()
  
  onMounted(async () => {
    // Vue Query composables will automatically handle events loading
    // We just need to ensure registrations are loaded from the store
    await store.ensureRegistrationsLoaded()
  })
  
  // Return the events composables for use in components
  return useEvents(store.user?.id || null, store.isAdmin)
}
