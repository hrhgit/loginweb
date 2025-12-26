<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import AppFooter from './components/layout/AppFooter.vue'
import AppHeader from './components/layout/AppHeader.vue'
import GlobalBanner from './components/feedback/GlobalBanner.vue'
import AuthModal from './components/modals/AuthModal.vue'
import CreateEventModal from './components/modals/CreateEventModal.vue'
import { useAppStore } from './store/appStore'

const store = useAppStore()

onMounted(async () => {
  await store.init()
})
</script>

<template>
  <div class="app-shell">
    <AppHeader />
    <GlobalBanner />
    <RouterView />
    <AppFooter />
  </div>

  <AuthModal />
  <CreateEventModal />
</template>

