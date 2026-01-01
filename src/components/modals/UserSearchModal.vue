<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { Search, X, User, UserPlus, RefreshCw } from 'lucide-vue-next'
import type { UserSearchResult } from '../../store/models'
import { useAppStore } from '../../store/appStore'
import { useSearchUsersForJudge, useAddJudge } from '../../composables/useJudges'
import { generateAvatarUrl } from '../../utils/imageUrlGenerator'

interface Props {
  eventId: string
  isOpen: boolean
}

interface Emits {
  close: []
  judgeInvited: [userId: string]
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const store = useAppStore()

// Vue Query hooks
const addJudgeMutation = useAddJudge()

const searchQuery = ref('')
const retryCount = ref(0)
const maxRetries = 3

// Use Vue Query for search with reactive query
const searchUsersQuery = useSearchUsersForJudge(searchQuery, props.eventId)

// Computed properties from Vue Query
const searchResults = computed(() => searchUsersQuery.data.value || [])
const isSearching = computed(() => searchUsersQuery.isFetching.value)
const searchError = computed(() => searchUsersQuery.error.value?.message || '')
const invitingUserId = computed(() => addJudgeMutation.isPending.value ? 'inviting' : null)

const handleKeydown = (event: KeyboardEvent) => {
  // ESC key to close modal
  if (event.key === 'Escape' && !invitingUserId.value) {
    handleClose()
  }
  
  // Enter key to search when input is focused
  if (event.key === 'Enter' && event.target === document.querySelector('.search-input')) {
    event.preventDefault()
    performSearch(false)
  }
}

// Add keyboard event listeners when modal opens
watch(() => props.isOpen, async (isOpen) => {
  if (isOpen) {
    searchQuery.value = ''
    retryCount.value = 0
    
    // Add keyboard listeners
    document.addEventListener('keydown', handleKeydown)
    
    // Focus search input after modal opens
    nextTick(() => {
      const searchInput = document.querySelector('.search-input') as HTMLInputElement
      if (searchInput) {
        searchInput.focus()
      }
    })
  } else {
    // Remove keyboard listeners
    document.removeEventListener('keydown', handleKeydown)
  }
})

// Manual search trigger and retry mechanism
const performSearch = async (isRetry = false) => {
  const query = searchQuery.value.trim()
  
  if (!query || query.length < 2) {
    return
  }

  if (!isRetry) {
    retryCount.value = 0
  }

  try {
    await searchUsersQuery.refetch()
    retryCount.value = 0
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '搜索失败'
    
    // Auto-retry for network errors
    if (retryCount.value < maxRetries && (
      errorMessage.includes('网络') || 
      errorMessage.includes('连接') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('fetch')
    )) {
      retryCount.value++
      setTimeout(() => {
        if (searchQuery.value.trim() === query) {
          performSearch(true)
        }
      }, 1000 * retryCount.value) // Exponential backoff
    }
  }
}

const retrySearch = () => {
  retryCount.value = 0
  performSearch(false)
}

const handleInviteUser = async (user: UserSearchResult) => {
  if (addJudgeMutation.isPending.value) return

  // 防止邀请已经是评委的用户
  if (user.isAlreadyJudge) {
    store.setBanner('info', `${user.username || '该用户'} 已经是评委`)
    return
  }
  
  try {
    await addJudgeMutation.mutateAsync({
      eventId: props.eventId,
      userId: user.id
    })
    
    emit('judgeInvited', user.id)
    emit('close')
  } catch (error) {
    // Error handling is done in the mutation
    console.error('Invite judge error:', error)
  }
}

const handleClose = () => {
  if (addJudgeMutation.isPending.value) return // Prevent closing while inviting
  emit('close')
}

const handleBackdropClick = (event: MouseEvent) => {
  if (event.target === event.currentTarget) {
    handleClose()
  }
}

const displayName = (user: UserSearchResult) => {
  return user.username || '未设置用户名'
}
</script>

<template>
  <div v-if="isOpen" class="modal-backdrop" @click="handleBackdropClick" role="dialog" aria-modal="true" aria-labelledby="modal-title">
    <div class="modal-content user-search-modal">
      <header class="modal-header">
        <h2 id="modal-title" class="modal-title">邀请评委</h2>
        <button 
          class="btn btn--icon btn--ghost" 
          @click="handleClose"
          :disabled="addJudgeMutation.isPending.value"
          aria-label="关闭对话框"
        >
          <X :size="18" />
        </button>
      </header>

      <div class="modal-body">
        <div class="search-section">
          <div class="field">
            <label for="user-search-input" class="sr-only">搜索用户</label>
            <div class="search-input-wrapper">
              <Search :size="16" class="search-icon" aria-hidden="true" />
              <input
                id="user-search-input"
                v-model="searchQuery"
                type="text"
                placeholder="搜索用户名..."
                class="search-input"
                :disabled="addJudgeMutation.isPending.value"
                aria-describedby="search-hint"
                autocomplete="off"
              />
            </div>
          </div>
          
          <p id="search-hint" class="search-hint">输入至少2个字符开始搜索</p>
        </div>

        <div class="search-results" role="region" aria-live="polite" aria-label="搜索结果">
          <div v-if="isSearching" class="search-loading">
            <div class="loading-spinner" aria-hidden="true"></div>
            <span>搜索中...</span>
          </div>

          <div v-else-if="searchError" class="search-error" role="alert">
            <p>{{ searchError }}</p>
            <button 
              v-if="retryCount < maxRetries" 
              class="btn btn--ghost btn--compact"
              @click="retrySearch"
              :disabled="isSearching"
              aria-label="重试搜索"
            >
              <RefreshCw :size="14" aria-hidden="true" />
              重试 {{ retryCount > 0 ? `(${retryCount}/${maxRetries})` : '' }}
            </button>
          </div>

          <div v-else-if="searchQuery.trim() && searchResults.length === 0 && !isSearching" class="no-results">
            <User :size="32" class="no-results-icon" aria-hidden="true" />
            <p>未找到匹配的用户</p>
            <p class="no-results-hint">请尝试其他搜索关键词</p>
          </div>

          <div v-else-if="searchResults.length > 0" class="results-list">
            <div 
              v-for="user in searchResults" 
              :key="user.id" 
              class="user-result-item"
            >
              <div class="user-info">
                <div class="user-avatar" :aria-label="`${displayName(user)}的头像`">
                  <img 
                    v-if="user.avatar_url" 
                    :src="generateAvatarUrl(user.avatar_url)" 
                    :alt="`${displayName(user)}的头像`"
                    class="avatar-image"
                  />
                  <User v-else :size="20" class="avatar-placeholder" aria-hidden="true" />
                </div>
                
                <div class="user-details">
                  <h4 class="user-name">{{ displayName(user) }}</h4>
                </div>
              </div>

              <button 
                class="btn btn--compact"
                :class="user.isAlreadyJudge ? 'btn--ghost btn--disabled' : 'btn--primary'"
                @click="handleInviteUser(user)"
                :disabled="addJudgeMutation.isPending.value || user.isAlreadyJudge"
                :aria-label="user.isAlreadyJudge ? `${displayName(user)} 已是评委` : `邀请 ${displayName(user)} 担任评委`"
              >
                <UserPlus v-if="!user.isAlreadyJudge && !addJudgeMutation.isPending.value" :size="14" aria-hidden="true" />
                <User v-else-if="user.isAlreadyJudge" :size="14" aria-hidden="true" />
                <span v-if="addJudgeMutation.isPending.value">邀请中...</span>
                <span v-else-if="user.isAlreadyJudge">已邀请</span>
                <span v-else>邀请</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.user-search-modal {
  width: 100%;
  max-width: 500px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

/* Mobile optimizations */
@media (max-width: 640px) {
  .modal-backdrop {
    padding: 10px;
    align-items: flex-start;
    padding-top: 5vh;
  }
  
  .user-search-modal {
    max-height: 90vh;
    max-width: 100%;
  }
}

@media (max-height: 600px) {
  .modal-backdrop {
    align-items: flex-start;
    padding-top: 20px;
  }
  
  .user-search-modal {
    max-height: calc(100vh - 40px);
  }
}

.modal-content {
  background: var(--surface-strong);
  border-radius: 16px;
  box-shadow: var(--shadow);
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border);
}

.modal-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--ink);
  margin: 0;
}

.modal-body {
  padding: 24px;
  overflow-y: auto;
  flex: 1;
}

/* Mobile header adjustments */
@media (max-width: 640px) {
  .modal-header {
    padding: 16px 20px;
  }
  
  .modal-title {
    font-size: 16px;
  }
  
  .modal-body {
    padding: 20px;
  }
}

.search-section {
  margin-bottom: 24px;
}

.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 12px;
  color: var(--muted);
  z-index: 1;
}

.search-input {
  width: 100%;
  padding: 12px 12px 12px 40px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 14px;
  background: var(--surface);
  color: var(--ink);
  transition: border-color 0.18s ease;
}

.search-input:focus {
  outline: none;
  border-color: var(--accent);
}

.search-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.search-hint {
  font-size: 12px;
  color: var(--muted);
  margin: 8px 0 0 0;
}

.search-results {
  min-height: 200px;
}

.search-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 40px 20px;
  color: var(--muted);
}

.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--border);
  border-top: 2px solid var(--accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.search-error {
  text-align: center;
  padding: 40px 20px;
  color: var(--danger);
}

.no-results {
  text-align: center;
  padding: 40px 20px;
  color: var(--muted);
}

.no-results-icon {
  margin-bottom: 12px;
  opacity: 0.5;
}

.no-results p {
  margin: 0 0 4px 0;
}

.no-results-hint {
  font-size: 12px;
  opacity: 0.7;
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.user-result-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  transition: border-color 0.18s ease;
  gap: 12px;
}

.user-result-item:hover {
  border-color: var(--accent-soft);
}

.user-result-item:focus-within {
  border-color: var(--accent);
  outline: 2px solid var(--accent-soft);
  outline-offset: 2px;
}

/* Mobile user result adjustments */
@media (max-width: 640px) {
  .user-result-item {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
    padding: 16px 12px;
  }
  
  .user-info {
    justify-content: flex-start;
  }
  
  .user-result-item .btn {
    align-self: center;
    min-width: 120px;
  }
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.user-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--accent-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  color: var(--accent);
}

.user-details {
  flex: 1;
  min-width: 0;
}

.user-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--ink);
  margin: 0;
}

.btn--disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background: var(--surface-muted);
  color: var(--muted);
  border-color: var(--border);
}

.btn--disabled:hover {
  background: var(--surface-muted);
  color: var(--muted);
  border-color: var(--border);
  transform: none;
}

.btn--loading {
  opacity: 0.7;
  cursor: not-allowed;
}

/* Screen reader only text */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>