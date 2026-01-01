<!--
  队伍管理组件 - 使用 Vue Query 版本
  展示如何使用 Vue Query 进行队伍数据管理
-->
<template>
  <div class="teams-container">
    <!-- 加载状态 -->
    <div v-if="isLoading" class="loading-state">
      <div class="loading-spinner"></div>
      <p>正在加载队伍数据...</p>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="error" class="error-state">
      <p class="error-message">{{ error.message }}</p>
      <button @click="refetch" class="btn btn--primary">重试</button>
    </div>

    <!-- 数据展示 -->
    <div v-else class="teams-content">
      <!-- 队伍统计 -->
      <div class="teams-stats">
        <div class="stat-item">
          <span class="stat-label">队伍数量</span>
          <span class="stat-value">{{ teams?.length || 0 }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">求组队</span>
          <span class="stat-value">{{ seekers?.length || 0 }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">缓存状态</span>
          <span class="stat-value" :class="{ 'fresh': isFresh, 'stale': !isFresh }">
            {{ isFresh ? '新鲜' : '过期' }}
          </span>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="teams-actions">
        <button 
          @click="refetch" 
          class="btn btn--ghost"
          :disabled="isFetching"
        >
          {{ isFetching ? '刷新中...' : '刷新数据' }}
        </button>
        
        <button 
          @click="showCreateModal = true" 
          class="btn btn--primary"
          v-if="store.isAuthed"
        >
          <Plus :size="16" />
          创建队伍
        </button>
      </div>

      <!-- 队伍列表 -->
      <div class="teams-grid">
        <div 
          v-for="team in teams" 
          :key="team.id"
          class="team-card"
          :class="{ 'is-closed': team.is_closed }"
        >
          <div class="team-header">
            <h3 class="team-name">{{ team.name }}</h3>
            <div class="team-meta">
              <span class="member-count">
                <Users :size="14" />
                {{ team.members }}人
              </span>
              <span v-if="team.is_closed" class="closed-badge">已满员</span>
            </div>
          </div>

          <div class="team-content">
            <p v-if="team.intro" class="team-intro">{{ team.intro }}</p>
            
            <div v-if="team.needs?.length" class="team-needs">
              <span class="needs-label">需要：</span>
              <div class="needs-tags">
                <span 
                  v-for="need in team.needs" 
                  :key="need"
                  class="need-tag"
                >
                  {{ need }}
                </span>
              </div>
            </div>
          </div>

          <div class="team-actions">
            <button 
              v-if="!team.is_closed && !isTeamMember(team.id)"
              @click="handleJoinRequest(team.id)"
              class="btn btn--primary btn--compact"
              :disabled="joinTeamMutation.isPending.value"
            >
              {{ joinTeamMutation.isPending.value ? '申请中...' : '申请加入' }}
            </button>
            
            <button 
              v-if="isTeamLeader(team)"
              @click="handleEditTeam(team)"
              class="btn btn--ghost btn--compact"
            >
              <Edit :size="14" />
              编辑
            </button>
          </div>
        </div>
      </div>

      <!-- 求组队列表 -->
      <div v-if="seekers?.length" class="seekers-section">
        <h3>求组队</h3>
        <div class="seekers-grid">
          <div 
            v-for="seeker in seekers" 
            :key="seeker.id"
            class="seeker-card"
          >
            <div class="seeker-header">
              <div class="seeker-avatar">
                <img 
                  v-if="seeker.profile?.avatar_url" 
                  :src="generateAvatarUrl(seeker.profile.avatar_url)" 
                  :alt="seeker.profile.username || '用户'"
                />
                <div v-else class="avatar-placeholder">
                  {{ (seeker.profile?.username || '?')[0].toUpperCase() }}
                </div>
              </div>
              <div class="seeker-info">
                <h4>{{ seeker.profile?.username || '匿名用户' }}</h4>
                <div class="seeker-roles">
                  <span 
                    v-for="role in seeker.roles" 
                    :key="role"
                    class="role-tag"
                  >
                    {{ role }}
                  </span>
                </div>
              </div>
            </div>
            
            <p v-if="seeker.intro" class="seeker-intro">{{ seeker.intro }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 创建队伍模态框 -->
    <div v-if="showCreateModal" class="modal-overlay" @click="showCreateModal = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>创建队伍</h3>
          <button @click="showCreateModal = false" class="modal-close">
            <X :size="20" />
          </button>
        </div>
        
        <form @submit.prevent="handleCreateTeam" class="modal-body">
          <div class="field">
            <label class="field__label">队伍名称</label>
            <input 
              v-model="createForm.name"
              type="text" 
              class="field__input"
              placeholder="输入队伍名称"
              required
            />
          </div>
          
          <div class="field">
            <label class="field__label">队长QQ</label>
            <input 
              v-model="createForm.leader_qq"
              type="text" 
              class="field__input"
              placeholder="输入QQ号码"
            />
          </div>
          
          <div class="field">
            <label class="field__label">队伍介绍</label>
            <textarea 
              v-model="createForm.intro"
              class="field__input"
              placeholder="介绍一下你的队伍..."
              rows="3"
            ></textarea>
          </div>
          
          <div class="field">
            <label class="field__label">需要的角色</label>
            <input 
              v-model="needsInput"
              type="text" 
              class="field__input"
              placeholder="例如：程序员,美术,策划（用逗号分隔）"
            />
          </div>
        </form>
        
        <div class="modal-footer">
          <button 
            type="button" 
            @click="showCreateModal = false"
            class="btn btn--ghost"
          >
            取消
          </button>
          <button 
            @click="handleCreateTeam"
            class="btn btn--primary"
            :disabled="createTeamMutation.isPending.value || !createForm.name"
          >
            {{ createTeamMutation.isPending.value ? '创建中...' : '创建队伍' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Plus, Users, Edit, X } from 'lucide-vue-next'
import { useTeamData, useCreateTeam, useJoinTeamRequest } from '../../composables/useTeams'
import { useAppStore } from '../../store/appStore'
import { generateAvatarUrl } from '../../utils/imageUrlGenerator'
import type { TeamLobbyTeam } from '../../store/models'

const props = defineProps<{
  eventId: string
}>()

const store = useAppStore()

// 使用 Vue Query hooks
const { teams, seekers, isLoading, error, refetch } = useTeamData(props.eventId)
const createTeamMutation = useCreateTeam()
const joinTeamMutation = useJoinTeamRequest()

// 组件状态
const showCreateModal = ref(false)
const createForm = ref({
  name: '',
  leader_qq: '',
  intro: '',
  extra: '',
})
const needsInput = ref('')

// 计算属性
const isFresh = computed(() => {
  // Vue Query 提供的数据新鲜度状态
  return teams.value?.isFresh ?? false
})

const isFetching = computed(() => {
  return teams.value?.isFetching ?? false
})

// 辅助函数
const isTeamMember = (teamId: string) => {
  // 这里可以添加检查用户是否为队伍成员的逻辑
  return false
}

const isTeamLeader = (team: TeamLobbyTeam) => {
  return store.user?.id === team.leader_id
}

// 事件处理
const handleCreateTeam = async () => {
  if (!createForm.value.name.trim()) return

  const needs = needsInput.value
    .split(/[,，、\n]/)
    .map(item => item.trim())
    .filter(Boolean)

  try {
    await createTeamMutation.mutateAsync({
      eventId: props.eventId,
      teamData: {
        ...createForm.value,
        needs,
      }
    })
    
    // 重置表单
    createForm.value = {
      name: '',
      leader_qq: '',
      intro: '',
      extra: '',
    }
    needsInput.value = ''
    showCreateModal.value = false
  } catch (error) {
    // 错误已在 mutation 中处理
  }
}

const handleJoinRequest = async (teamId: string) => {
  try {
    await joinTeamMutation.mutateAsync({
      teamId,
      message: '希望加入你们的队伍！'
    })
  } catch (error) {
    // 错误已在 mutation 中处理
  }
}

const handleEditTeam = (team: TeamLobbyTeam) => {
  // 实现编辑队伍逻辑
  console.log('编辑队伍:', team)
}

// 监听 eventId 变化，自动重新获取数据
watch(() => props.eventId, () => {
  if (props.eventId) {
    refetch()
  }
})
</script>

<style scoped>
.teams-container {
  padding: 1rem;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem;
  gap: 1rem;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border);
  border-top: 3px solid var(--accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-state {
  text-align: center;
  padding: 2rem;
}

.error-message {
  color: var(--danger);
  margin-bottom: 1rem;
}

.teams-stats {
  display: flex;
  gap: 2rem;
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: var(--surface);
  border-radius: var(--radius-lg);
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.stat-label {
  font-size: var(--text-sm);
  color: var(--muted);
}

.stat-value {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
}

.stat-value.fresh {
  color: var(--accent);
}

.stat-value.stale {
  color: var(--accent-2);
}

.teams-actions {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.teams-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.team-card {
  background: var(--surface);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  border: 1px solid var(--border);
  transition: var(--transition-all);
}

.team-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

.team-card.is-closed {
  opacity: 0.7;
}

.team-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.team-name {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  margin: 0;
}

.team-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.25rem;
}

.member-count {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: var(--text-sm);
  color: var(--muted);
}

.closed-badge {
  font-size: var(--text-xs);
  padding: 0.25rem 0.5rem;
  background: var(--accent-2);
  color: white;
  border-radius: var(--radius-sm);
}

.team-intro {
  color: var(--muted);
  margin-bottom: 1rem;
  line-height: var(--leading-relaxed);
}

.team-needs {
  margin-bottom: 1rem;
}

.needs-label {
  font-size: var(--text-sm);
  color: var(--muted);
  margin-bottom: 0.5rem;
  display: block;
}

.needs-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.need-tag {
  font-size: var(--text-xs);
  padding: 0.25rem 0.5rem;
  background: var(--accent-soft);
  color: var(--accent);
  border-radius: var(--radius-sm);
}

.team-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

.seekers-section {
  margin-top: 2rem;
}

.seekers-section h3 {
  margin-bottom: 1rem;
}

.seekers-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

.seeker-card {
  background: var(--surface);
  border-radius: var(--radius-lg);
  padding: 1rem;
  border: 1px solid var(--border);
}

.seeker-header {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.seeker-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
}

.seeker-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  background: var(--accent-soft);
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: var(--font-semibold);
}

.seeker-info h4 {
  margin: 0 0 0.25rem 0;
  font-size: var(--text-base);
}

.seeker-roles {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.role-tag {
  font-size: var(--text-xs);
  padding: 0.125rem 0.375rem;
  background: var(--surface-muted);
  border-radius: var(--radius-sm);
}

.seeker-intro {
  color: var(--muted);
  font-size: var(--text-sm);
  line-height: var(--leading-relaxed);
  margin: 0;
}

/* 模态框样式 */
.modal-overlay {
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
}

.modal-content {
  background: var(--surface-strong);
  border-radius: var(--radius-xl);
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid var(--border);
}

.modal-header h3 {
  margin: 0;
}

.modal-close {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: var(--radius-sm);
  transition: var(--transition-colors);
}

.modal-close:hover {
  background: var(--surface-muted);
}

.modal-body {
  padding: 1.5rem;
}

.modal-footer {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  padding: 1.5rem;
  border-top: 1px solid var(--border);
}

@media (max-width: 640px) {
  .teams-stats {
    flex-direction: column;
    gap: 1rem;
  }
  
  .teams-grid,
  .seekers-grid {
    grid-template-columns: 1fr;
  }
  
  .teams-actions {
    flex-direction: column;
  }
}
</style>