<script setup lang="ts">
import { useAppStore } from '../../store/appStore'

const store = useAppStore()
</script>

<template>
  <teleport to="body">
    <div v-if="store.authModalOpen" class="modal-backdrop">
      <div class="modal">
        <header class="modal__header">
          <h2>{{ store.authView === 'sign_in' ? '登录' : '创建账号' }}</h2>
          <button class="icon-btn" type="button" @click="store.closeAuth" aria-label="close">×</button>
        </header>

        <div class="segmented">
          <button
            class="segmented__btn"
            type="button"
            :class="{ active: store.authView === 'sign_in' }"
            @click="store.authView = 'sign_in'"
          >
            登录
          </button>
          <button
            class="segmented__btn"
            type="button"
            :class="{ active: store.authView === 'sign_up' }"
            @click="store.authView = 'sign_up'"
          >
            注册
          </button>
        </div>

        <form class="form" @submit.prevent="store.submitAuth">
          <label v-if="store.authView === 'sign_up'" class="field">
            <span>全名</span>
            <input v-model="store.authFullName" type="text" autocomplete="name" placeholder="例如 王大明" required />
          </label>

          <label class="field">
            <span>电子邮箱</span>
            <input v-model="store.authEmail" type="email" autocomplete="email" placeholder="you@example.com" required />
          </label>

          <label class="field">
            <span>密码</span>
            <input
              v-model="store.authPassword"
              type="password"
              autocomplete="current-password"
              minlength="6"
              placeholder="至少 6 个字符"
              required
            />
          </label>

          <p v-if="store.authError" class="alert error">{{ store.authError }}</p>
          <p v-if="store.authInfo" class="alert info">{{ store.authInfo }}</p>

          <button class="btn btn--primary btn--full" type="submit" :disabled="store.authBusy">
            {{ store.authBusy ? '处理中..' : store.authView === 'sign_in' ? '登录' : '立即注册' }}
          </button>
        </form>
      </div>
    </div>
  </teleport>
</template>

