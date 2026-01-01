<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Home, LogOut, Activity } from 'lucide-vue-next'
import { useAppStore } from '../../store/appStore'
import { generateAvatarUrl } from '../../utils/imageUrlGenerator'

const store = useAppStore()
const route = useRoute()
const router = useRouter()

// Generate avatar URL with cache busting
const avatarUrl = computed(() => {
  return generateAvatarUrl(store.profile?.avatar_url)
})

const handleBack = () => {
  const viewQuery = Array.isArray(route.query.view) ? route.query.view[0] : route.query.view
  if (route.name === 'event-edit' && viewQuery === 'preview') {
    const nextQuery = { ...route.query }
    delete nextQuery.view
    router.replace({ path: route.path, query: nextQuery })
    return
  }
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push('/events')
  }
}
</script>

<template>
  <header class="app-header">
    <div class="app-header__inner">
      <div class="header-left">
        <button class="btn btn--flat btn--icon" type="button" @click="handleBack" aria-label="返回" title="返回">
          <ArrowLeft :size="20" />
        </button>
        <RouterLink class="btn btn--flat btn--icon" to="/events" aria-label="主页" title="主页">
          <Home :size="20" />
        </RouterLink>
      </div>

      <div class="header-actions">
        <div v-if="!store.isAuthed" class="auth-actions">
          <button class="btn btn--flat" type="button" @click="store.openAuth('sign_in')">登录</button>
          <button class="btn btn--flat" type="button" @click="store.openAuth('sign_up')">注册</button>
        </div>

        <div v-else class="user-actions">
          <RouterLink class="user-pill" to="/me">
            <div class="user-pill__avatar-container">
              <img
                v-if="avatarUrl"
                :src="avatarUrl"
                alt="Avatar"
                class="user-pill__avatar"
              />
              <div v-else class="user-pill__avatar-placeholder">
                {{ store.displayName.charAt(0).toUpperCase() }}
              </div>
            </div>
            <p class="user-pill__name">{{ store.displayName }}</p>
            <span v-if="store.hasAnyNotification" class="user-pill__dot"></span>
          </RouterLink>
          <span v-if="store.isAdmin" class="pill-badge">admin</span>
          <button class="btn btn--flat btn--icon-text" type="button" @click="store.handleSignOut" title="退出登录">
            <LogOut :size="18" />
            <span>退出</span>
          </button>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
.btn--icon-text {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
}
</style>
