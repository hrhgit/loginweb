<template>
  <main class="not-found-page">
    <div class="not-found-content">
      <div class="not-found-icon">
        <FileX :size="80" aria-hidden="true" />
      </div>
      
      <h1 class="not-found-title">页面未找到</h1>
      
      <p class="not-found-message">
        {{ message || '抱歉，您访问的页面不存在或已被删除。' }}
      </p>
      
      <div class="not-found-actions">
        <button 
          v-if="backRoute"
          class="btn btn--primary" 
          @click="handleBack"
          @keydown.enter="handleBack"
          @keydown.space.prevent="handleBack"
          :aria-label="backLabel || '返回上一页'"
        >
          <ArrowLeft :size="16" aria-hidden="true" />
          {{ backLabel || '返回' }}
        </button>
        
        <router-link 
          to="/events" 
          class="btn btn--ghost"
          aria-label="返回活动列表"
        >
          <Home :size="16" aria-hidden="true" />
          返回首页
        </router-link>
      </div>
      
      <div class="not-found-help">
        <p class="not-found-help-text">
          如果您认为这是一个错误，请联系管理员或稍后重试。
        </p>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { FileX, ArrowLeft, Home } from 'lucide-vue-next'

interface Props {
  message?: string
  backRoute?: string
  backLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  message: '',
  backRoute: '',
  backLabel: ''
})

const router = useRouter()

const handleBack = () => {
  if (props.backRoute) {
    router.push(props.backRoute)
  } else {
    router.back()
  }
}
</script>

<style scoped>
.not-found-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 70vh;
  padding: 2rem;
}

.not-found-content {
  text-align: center;
  max-width: 500px;
  width: 100%;
}

.not-found-icon {
  color: var(--muted);
  margin-bottom: 2rem;
  opacity: 0.7;
}

.not-found-title {
  font-family: 'Sora', sans-serif;
  font-size: clamp(1.75rem, 4vw, 2.25rem);
  font-weight: 600;
  color: var(--ink);
  margin: 0 0 1rem 0;
  line-height: 1.2;
}

.not-found-message {
  color: var(--muted);
  font-size: 1rem;
  line-height: 1.5;
  margin: 0 0 2rem 0;
}

.not-found-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-bottom: 2rem;
  flex-wrap: wrap;
}

.not-found-help {
  padding-top: 1.5rem;
  border-top: 1px solid var(--border);
}

.not-found-help-text {
  color: var(--muted);
  font-size: 0.875rem;
  margin: 0;
  font-style: italic;
}

/* Responsive Design */
@media (max-width: 640px) {
  .not-found-page {
    padding: 1.5rem;
    min-height: 60vh;
  }
  
  .not-found-icon {
    margin-bottom: 1.5rem;
  }
  
  .not-found-actions {
    flex-direction: column;
    gap: 0.75rem;
  }
  
  .btn {
    width: 100%;
    justify-content: center;
  }
}

@media (max-width: 480px) {
  .not-found-page {
    padding: 1rem;
  }
  
  .not-found-title {
    font-size: clamp(1.5rem, 5vw, 1.75rem);
  }
  
  .not-found-message {
    font-size: 0.875rem;
  }
}

/* Accessibility */
.btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* Print styles */
@media print {
  .not-found-page {
    background: white;
    color: black;
  }
  
  .not-found-actions {
    display: none;
  }
}
</style>