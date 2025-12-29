<template>
  <div class="form-response-viewer">
    <div v-if="isEmpty" class="empty-response">
      <p class="muted">此用户未填写报名表单</p>
    </div>
    
    <div v-else class="response-content">
      <!-- 统计信息 -->
      <div class="response-stats">
        <div class="stat-item">
          <span class="stat-label">填写题目</span>
          <span class="stat-value">{{ stats.answeredQuestions }}/{{ stats.totalQuestions }}</span>
        </div>
        <div v-if="parseResult.hasUnknownQuestions" class="stat-item warning">
          <span class="stat-label">未知题目</span>
          <span class="stat-value">存在</span>
        </div>
      </div>

      <!-- 问答列表 -->
      <div class="response-list">
        <div 
          v-for="(response, index) in parseResult.parsedResponses" 
          :key="response.questionId"
          class="response-item"
          :class="{ 'response-item--unknown': !questions.find(q => q.id === response.questionId) }"
        >
          <div class="response-header">
            <div class="question-info">
              <span class="question-number">Q{{ index + 1 }}</span>
              <span class="question-title">{{ response.questionTitle }}</span>
              <span class="question-type">{{ getQuestionTypeLabel(response.questionType) }}</span>
            </div>
          </div>
          
          <div class="response-answer">
            <div class="answer-content">
              {{ response.displayValue }}
            </div>
            
            <!-- 显示原始数据（调试用） -->
            <details v-if="showRawData" class="raw-data">
              <summary>原始数据</summary>
              <pre>{{ JSON.stringify(response.answer, null, 2) }}</pre>
            </details>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { RegistrationQuestion } from '../../utils/eventDetails'
import { 
  parseFormResponse, 
  getQuestionTypeLabel, 
  isFormResponseEmpty, 
  getFormResponseStats 
} from '../../utils/formResponseParser'

interface Props {
  formResponse: Record<string, any>
  questions: RegistrationQuestion[]
  showRawData?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showRawData: false
})

const isEmpty = computed(() => isFormResponseEmpty(props.formResponse))

const stats = computed(() => getFormResponseStats(props.formResponse))

const parseResult = computed(() => {
  if (isEmpty.value) {
    return {
      parsedResponses: [],
      hasUnknownQuestions: false,
      totalQuestions: 0
    }
  }
  
  return parseFormResponse(props.formResponse, props.questions)
})
</script>

<style scoped>
.form-response-viewer {
  width: 100%;
}

.empty-response {
  padding: 2rem;
  text-align: center;
  background: var(--surface-muted);
  border-radius: 8px;
  border: 1px dashed var(--border);
}

.response-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.response-stats {
  display: flex;
  gap: 1rem;
  padding: 0.75rem 1rem;
  background: var(--surface-muted);
  border-radius: 6px;
  font-size: 0.85rem;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.stat-item.warning {
  color: #f59e0b;
}

.stat-label {
  color: var(--muted);
  font-weight: 500;
}

.stat-value {
  color: var(--accent);
  font-weight: 600;
}

.stat-item.warning .stat-value {
  color: #f59e0b;
}

.response-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.response-item {
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
  background: var(--surface);
}

.response-item--unknown {
  border-color: #f59e0b;
  background: rgba(251, 191, 36, 0.05);
}

.response-header {
  padding: 0.75rem 1rem;
  background: var(--surface-muted);
  border-bottom: 1px solid var(--border);
}

.question-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.question-number {
  background: var(--accent);
  color: white;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  font-family: monospace;
}

.response-item--unknown .question-number {
  background: #f59e0b;
}

.question-title {
  font-weight: 500;
  color: var(--ink);
  flex: 1;
  min-width: 0;
}

.question-type {
  background: var(--surface);
  color: var(--muted);
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  border: 1px solid var(--border);
}

.response-answer {
  padding: 1rem;
}

.answer-content {
  color: var(--ink);
  line-height: 1.5;
  word-break: break-word;
}

.raw-data {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border);
}

.raw-data summary {
  color: var(--muted);
  font-size: 0.85rem;
  cursor: pointer;
  margin-bottom: 0.5rem;
}

.raw-data pre {
  background: var(--surface-muted);
  padding: 0.75rem;
  border-radius: 4px;
  font-size: 0.8rem;
  color: var(--muted);
  overflow-x: auto;
  margin: 0;
}

/* 响应式设计 */
@media (max-width: 640px) {
  .response-stats {
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .question-info {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
  
  .question-title {
    order: -1;
  }
}
</style>