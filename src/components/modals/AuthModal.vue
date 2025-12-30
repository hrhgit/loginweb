<script setup lang="ts">
import { X } from 'lucide-vue-next'
import { useAppStore } from '../../store/appStore'

const store = useAppStore()
</script>

<template>
  <teleport to="body">
    <div v-if="store.authModalOpen" class="modal-backdrop">
      <div class="modal-shell">
        <div class="modal">
        <header class="modal__header">
          <h2>{{ store.authView === 'sign_in' ? '登录' : '创建账号' }}</h2>
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
          <label v-if="store.authView === 'sign_up'" class="field" :class="{ 'field--error': store.authError }">
            <span>用户名</span>
            <input v-model="store.authFullName" type="text" autocomplete="name" placeholder="例如 王大明" required />
            <small class="field-hint">用户名将用于登录，2-20个字符，支持中文、字母、数字和下划线</small>
          </label>

          <label class="field" :class="{ 'field--error': store.authError }">
            <span>{{ store.authView === 'sign_in' ? '邮箱或用户名' : '电子邮箱' }}</span>
            <input 
              v-model="store.authEmail" 
              :type="store.authView === 'sign_in' ? 'text' : 'email'" 
              :autocomplete="store.authView === 'sign_in' ? 'username' : 'email'" 
              :placeholder="store.authView === 'sign_in' ? '邮箱或用户名' : 'you@example.com'" 
              required 
            />
            <small v-if="store.authView === 'sign_in'" class="field-hint">可以使用邮箱地址或用户名登录</small>
          </label>

          <label class="field" :class="{ 'field--error': store.authError }">
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

          <div v-if="store.authError || store.authInfo" class="auth-feedback">
            <p v-if="store.authError" class="alert error">{{ store.authError }}</p>
            <p v-if="store.authInfo" class="alert info">{{ store.authInfo }}</p>
          </div>

          <button class="btn btn--primary btn--full" type="submit" :disabled="store.authBusy">
            {{ store.authBusy ? '处理中..' : store.authView === 'sign_in' ? '登录' : '立即注册' }}
          </button>
        </form>
        </div>
        <button class="icon-btn modal-close" type="button" @click="store.closeAuth" aria-label="close">
          <X :size="20" />
        </button>
      </div>
    </div>
  </teleport>
</template>

<style scoped>
.auth-feedback {
  margin: 0.75rem 0;
}

.auth-feedback .alert {
  margin: 0;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  font-size: 0.875rem;
  line-height: 1.4;
}

.auth-feedback .alert.error {
  background-color: rgba(182, 45, 28, 0.1);
  border: 1px solid rgba(182, 45, 28, 0.2);
  color: var(--danger);
}

.auth-feedback .alert.info {
  background-color: rgba(31, 111, 109, 0.1);
  border: 1px solid rgba(31, 111, 109, 0.2);
  color: var(--accent);
}

.field--error input {
  border-color: var(--danger);
  box-shadow: 0 0 0 1px rgba(182, 45, 28, 0.1);
}

.field--error input:focus {
  border-color: var(--danger);
  box-shadow: 0 0 0 2px rgba(182, 45, 28, 0.2);
}

.field-hint {
  display: block;
  margin-top: 0.25rem;
  font-size: 0.75rem;
  color: var(--muted);
  line-height: 1.3;
}

.field--error .field-hint {
  color: var(--danger);
}
</style>