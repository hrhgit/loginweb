<script setup lang="ts">
import { useAppStore } from '../../store/appStore'

const store = useAppStore()
</script>

<template>
  <Transition name="toast" appear>
    <div v-if="store.bannerInfo || store.bannerError" class="toast-notification">
      {{ store.bannerInfo || store.bannerError }}
    </div>
  </Transition>
</template>

