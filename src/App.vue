<script setup lang="ts">
import { onMounted, defineAsyncComponent } from 'vue'
import { RouterView } from 'vue-router'
import AppFooter from './components/layout/AppFooter.vue'
import AppHeader from './components/layout/AppHeader.vue'
import GlobalBanner from './components/feedback/GlobalBanner.vue'
import OfflineIndicator from './components/feedback/OfflineIndicator.vue'
import { useAppStore } from './store/appStore'

// Lazy load modal components for better initial bundle size
const AuthModal = defineAsyncComponent(() => import('./components/modals/AuthModal.vue'))
const CreateEventModal = defineAsyncComponent(() => import('./components/modals/CreateEventModal.vue'))

const store = useAppStore()

onMounted(async () => {
  await store.init()
})
</script>

<template>
  <div class="app-shell">
    <AppHeader />
    <GlobalBanner />
    <OfflineIndicator 
      context="general" 
      :show-when-online="true"
      :dismissible="true"
      :auto-hide="5000"
    />
    <RouterView />
    <AppFooter />
  </div>

  <AuthModal />
  <CreateEventModal />
</template>

