<script setup lang="ts">
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useAppStore } from '../../store/appStore'

const store = useAppStore()
const route = useRoute()
const router = useRouter()

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
          <img src="/icons/arrow-left.svg" alt="" aria-hidden="true" />
        </button>
        <RouterLink class="btn btn--flat btn--icon" to="/events" aria-label="主页" title="主页">
          <img src="/icons/home.svg" alt="" aria-hidden="true" />
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
                v-if="store.profile?.avatar_url"
                :src="store.profile.avatar_url"
                alt="Avatar"
                class="user-pill__avatar"
              />
              <div v-else class="user-pill__avatar-placeholder">
                {{ store.displayName.charAt(0).toUpperCase() }}
              </div>
            </div>
            <p class="user-pill__name">{{ store.displayName }}</p>
          </RouterLink>
          <span v-if="store.isAdmin" class="pill-badge">admin</span>
          <button class="btn btn--flat" type="button" @click="store.handleSignOut">退出</button>
        </div>
      </div>
    </div>
  </header>
</template>
