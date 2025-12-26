<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAppStore } from '../../store/appStore'

const store = useAppStore()
const router = useRouter()

const handleCreateSubmit = async () => {
  const eventId = await store.submitCreate()
  if (eventId) {
    await router.push(`/events/${eventId}/edit`)
  }
}
</script>

<template>
  <teleport to="body">
    <div v-if="store.createModalOpen" class="modal-backdrop">
      <div class="modal">
        <header class="modal__header">
          <h2>创建新活动</h2>
          <button class="icon-btn" type="button" @click="store.closeCreateModal" aria-label="close">×</button>
        </header>

        <form class="form" @submit.prevent="handleCreateSubmit">
          <label class="field">
            <span>活动标题</span>
            <input v-model="store.createTitle" type="text" placeholder="例如 周末 Game Jam" required />
          </label>

          <label class="field">
            <span>开始时间</span>
            <input v-model="store.createStartTime" type="datetime-local" />
          </label>

          <label class="field">
            <span>结束时间</span>
            <input v-model="store.createEndTime" type="datetime-local" />
          </label>

          <label class="field">
            <span>地点</span>
            <input v-model="store.createLocation" type="text" placeholder="线上或具体地址" />
          </label>

          <label class="field">
            <span>队伍最大人数</span>
            <input
              v-model="store.createTeamMaxSize"
              type="number"
              min="0"
              placeholder="例如 30 (0 表示不限)"
            />
          </label>

          <label class="field">
            <span>简介</span>
            <textarea v-model="store.createDescription" rows="4" placeholder="介绍一下活动内容.."></textarea>
          </label>

          <p v-if="store.createError" class="alert error">{{ store.createError }}</p>

          <button class="btn btn--primary btn--full" type="submit" :disabled="store.createBusy">
            {{ store.createBusy ? '创建中..' : '确认创建' }}
          </button>
        </form>
      </div>
    </div>
  </teleport>
</template>

