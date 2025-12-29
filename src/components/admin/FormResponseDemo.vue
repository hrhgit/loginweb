<template>
  <div class="demo-container">
    <h3>表单回答解析演示</h3>
    
    <div class="demo-section">
      <h4>示例数据</h4>
      <p class="muted">这是你提到的 JSONB 数据结构示例：</p>
      
      <div class="demo-data">
        <pre>{{ JSON.stringify(sampleFormResponse, null, 2) }}</pre>
      </div>
    </div>

    <div class="demo-section">
      <h4>解析结果</h4>
      <FormResponseViewer 
        :form-response="sampleFormResponse"
        :questions="sampleQuestions"
        :show-raw-data="true"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import FormResponseViewer from './FormResponseViewer.vue'
import type { RegistrationQuestion } from '../../utils/eventDetails'

// 你提到的示例数据
const sampleFormResponse = ref({
  "921a4f26-8ca7-4aec-ae89-0a87d8644a29": [
    "9bb17550-6a8a-4213-87a1-46c98180fd22", 
    "e66a0656-28c2-4e2a-8472-0cc92edcec08", 
    "b2cb706f-7ec9-4c66-aac2-7ccf129119eb"
  ]
})

// 模拟的问题定义
const sampleQuestions = ref<RegistrationQuestion[]>([
  {
    id: "921a4f26-8ca7-4aec-ae89-0a87d8644a29",
    type: "multi",
    title: "你擅长哪些技能？",
    required: true,
    options: [
      { id: "9bb17550-6a8a-4213-87a1-46c98180fd22", label: "程序开发" },
      { id: "e66a0656-28c2-4e2a-8472-0cc92edcec08", label: "UI/UX 设计" },
      { id: "b2cb706f-7ec9-4c66-aac2-7ccf129119eb", label: "游戏策划" },
      { id: "other-option-id", label: "音效制作" }
    ]
  }
])
</script>

<style scoped>
.demo-container {
  padding: 2rem;
  max-width: 800px;
  margin: 0 auto;
}

.demo-section {
  margin-bottom: 2rem;
}

.demo-section h4 {
  margin: 0 0 0.75rem;
  color: var(--ink);
}

.demo-data {
  background: var(--surface-muted);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 1rem;
  margin: 1rem 0;
}

.demo-data pre {
  margin: 0;
  font-size: 0.85rem;
  color: var(--muted);
  overflow-x: auto;
}
</style>