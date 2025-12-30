<script setup lang="ts">
import { ref } from 'vue'
import { AlertTriangle } from 'lucide-vue-next'
import ErrorLogModal from '../modals/ErrorLogModal.vue'

const showErrorLog = ref(false)
</script>

<template>
  <footer class="footer">
    <div class="footer-content">
      <span>萌芽gamejam</span>
    </div>
    <button 
      class="error-log-trigger"
      @click="showErrorLog = true"
      title="查看错误日志"
    >
      <AlertTriangle :size="14" />
    </button>
  </footer>

  <!-- Error Log Modal -->
  <Teleport to="body">
    <ErrorLogModal
      v-if="showErrorLog"
      @close="showErrorLog = false"
    />
  </Teleport>
</template>

<style scoped>
.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: transparent;
  margin-top: auto;
  gap: 16px;
}

.footer-content {
  display: flex;
  align-items: center;
  gap: 24px;
  font-size: 0.85rem;
  color: var(--muted);
}

.error-log-trigger {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--muted);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.18s ease;
  opacity: 0.6;
}

.error-log-trigger:hover {
  background: var(--surface-muted);
  color: var(--ink);
  opacity: 1;
  transform: translateY(-1px);
}

.error-log-trigger:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

@media (max-width: 640px) {
  .footer {
    padding: 12px 16px;
  }
  
  .footer-content {
    flex-direction: column;
    gap: 8px;
    font-size: 0.8rem;
    text-align: center;
  }
}
</style>

