<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Home, LogOut } from 'lucide-vue-next'
import { useAppStore } from '../../store/appStore'
import { useCurrentUserData } from '../../composables/useUsers'
import { generateAvatarUrl } from '../../utils/imageUrlGenerator'

const store = useAppStore()
const route = useRoute()
const router = useRouter()

// 使用 Vue Query 获取用户数据
const { profile } = useCurrentUserData()

// Generate avatar URL with cache busting
const avatarUrl = computed(() => {
  // 优先使用乐观头像，然后是 profile 数据中的头像
  const avatarPath = store.optimisticAvatarUrl || profile.data.value?.avatar_url || null
  return generateAvatarUrl(avatarPath)
})

// 获取显示名称 - 优先使用 profile 中的 username，否则使用 user_metadata 中的 full_name
const displayName = computed(() => {
  const profileUsername = profile.data.value?.username
  if (profileUsername) return profileUsername
  
  return store.displayName
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
                {{ displayName.charAt(0).toUpperCase() }}
              </div>
            </div>
            <p class="user-pill__name">{{ displayName }}</p>
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
