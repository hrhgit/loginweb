﻿<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { Users } from 'lucide-vue-next'
import { useAppStore } from '../store/appStore'
import { getRoleTagClass, sortRoleLabels } from '../utils/roleTags'
import { 
  handleSuccessWithBanner
} from '../store/enhancedErrorHandling'

import { useEvent } from '../composables/useEvents'
import { useCurrentUserData } from '../composables/useUsers'
import { useTeams, useCreateTeam, useUpdateTeam } from '../composables/useTeams'

const store = useAppStore()
const route = useRoute()
const router = useRouter()

const eventId = computed(() => String(route.params.id ?? ''))
const teamId = computed(() => String(route.params.teamId ?? ''))
const { data: event } = useEvent(eventId.value)
const { contacts: contactsQuery } = useCurrentUserData()
const { teams } = useTeams(eventId.value)
const createTeamMutation = useCreateTeam()
const updateTeamMutation = useUpdateTeam()
const isEdit = computed(() => Boolean(route.params.teamId))
const editingTeam = computed(() =>
  teams.value?.find((team: any) => team.id === teamId.value) ?? null
)

const busy = ref(false)
const loading = ref(true) // 添加页面加载状态
const error = ref('')
const fieldErrors = ref<Record<string, string>>({})

// Form change detection state
const savedSnapshot = ref('')
const allowNavigation = ref(false)

const teamName = ref('')
const leaderQq = ref('')
const teamIntro = ref('')
const teamNeeds = ref<string[]>([])
const displayTeamNeeds = computed(() => sortRoleLabels(teamNeeds.value))
const teamNeedInput = ref('')
const teamNeedError = ref('')
const teamExtra = ref('')

const sanitizeDigits = (value: string) => value.replace(/\D/g, '')

// Form serialization for change detection
const serializeFormState = () => JSON.stringify({
  teamName: teamName.value,
  leaderQq: leaderQq.value,
  teamIntro: teamIntro.value,
  teamNeeds: teamNeeds.value,
  teamExtra: teamExtra.value
})

// Sync saved snapshot with current form state
const syncSavedSnapshot = () => {
  savedSnapshot.value = serializeFormState()
}

const syncLeaderQq = () => {
  if (leaderQq.value.trim()) return
  const qq = contactsQuery.data.value?.qq?.trim()
  if (qq) {
    leaderQq.value = sanitizeDigits(qq)
  }
}

watch(
  () => contactsQuery.data.value?.qq,
  () => {
    syncLeaderQq()
  },
)

const handleQqInput = (event: Event) => {
  const target = event.target as HTMLInputElement | null
  const raw = target?.value ?? ''
  const next = sanitizeDigits(raw)
  if (target && raw !== next) target.value = next
  leaderQq.value = next
}

const canCreate = computed(() => {
  if (!store.isAuthed) return false
  if (!event.value) return false
  if (store.isDemoEvent(event.value)) return false
  if (event.value.status !== 'published') return false
  if (isEdit.value && (!editingTeam.value || editingTeam.value.leader_id !== store.user?.id)) return false
  return true
})

// Change detection computed property
const isDirty = computed(() => {
  if (!savedSnapshot.value) return false
  return savedSnapshot.value !== serializeFormState()
})

const validate = () => {
  const next: Record<string, string> = {}
  // Note: This function only sets field errors and should not affect dirty state tracking
  const name = teamName.value.trim()
  if (!name) {
    next.teamName = '请填写队伍名称'
  } else if (name.length < 2 || name.length > 20) {
    next.teamName = '队伍名称长度需在 2-20 个字符之间'
  }
  
  const qq = sanitizeDigits(leaderQq.value)
  if (!qq) next.leaderQq = '请填写队长QQ（仅数字）'
  if (teamNeeds.value.length === 0) {
    delete next.teamNeeds
  }
  fieldErrors.value = next
  const isValid = Object.keys(next).length === 0
  if (!isValid) {
    nextTick(() => {
      const firstError = document.querySelector('.field--error')
      firstError?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }
  return isValid
}

const addNeedTag = (raw: string) => {
  const value = raw.trim()
  if (!value) return
  const exists = teamNeeds.value.some((tag) => tag === value)
  if (exists) return
  if (teamNeeds.value.length >= 6) {
    teamNeedError.value = '最多添加 6 个标签'
    return
  }
  teamNeeds.value = [...teamNeeds.value, value]
  teamNeedError.value = ''
}

const removeNeedTag = (tag: string) => {
  teamNeeds.value = teamNeeds.value.filter((item) => item !== tag)
  teamNeedError.value = ''
}

const handleNeedInput = (event: Event) => {
  const target = event.target as HTMLInputElement | null
  const value = target?.value ?? ''
  if (value.includes(',') || value.includes('，') || value.includes('、')) {
    const parts = value.split(/[,，、]/)
    parts.slice(0, -1).forEach((part) => addNeedTag(part))
    teamNeedInput.value = parts[parts.length - 1].trimStart()
  } else {
    teamNeedInput.value = value
  }
}

const handleNeedKeydown = (event: KeyboardEvent) => {
  if (event.key !== 'Enter') return
  event.preventDefault()
  addNeedTag(teamNeedInput.value)
  teamNeedInput.value = ''
}

const suggestionTags = ['缺策划', '缺程序', '缺美术', '缺音乐音效', '缺关卡设计', '缺叙事']
const canAddSuggestion = (tag: string) => !teamNeeds.value.includes(tag)

const submit = async () => {
  error.value = ''
  teamNeedError.value = ''
  // Note: Validation errors should not clear dirty state - only successful submission should
  if (!store.isAuthed) {
    store.openAuth('sign_in')
    store.authInfo = '请先登录后创建队伍'
    return
  }
  if (!validate()) return
  if (!event.value) {
    error.value = '活动不存在'
    return
  }
  if (store.isDemoEvent(event.value)) {
    error.value = '展示活动不支持创建队伍'
    return
  }
  if (event.value.status !== 'published') {
    error.value = '仅进行中活动支持创建队伍'
    return
  }

  busy.value = true
  const payload = {
    name: teamName.value.trim(),
    leader_qq: sanitizeDigits(leaderQq.value),
    intro: teamIntro.value.trim(),
    needs: [...teamNeeds.value],
    extra: teamExtra.value.trim(),
  }

  try {
    if (isEdit.value) {
      await updateTeamMutation.mutateAsync({
        teamId: teamId.value,
        eventId: eventId.value,
        teamData: payload
      })
      handleSuccessWithBanner('队伍已更新', store.setBanner, { 
        operation: 'updateTeam',
        component: 'team' 
      })
    } else {
      await createTeamMutation.mutateAsync({
        eventId: eventId.value,
        teamData: payload
      })
      handleSuccessWithBanner('队伍已创建', store.setBanner, { 
        operation: 'createTeam',
        component: 'team' 
      })
    }
    
    // Allow navigation after successful submission
    allowNavigation.value = true
    // Clear dirty state by updating saved snapshot
    savedSnapshot.value = serializeFormState()
    await router.push(`/events/${eventId.value}/team`)
  } catch (submitError: any) {
    error.value = submitError.message || (isEdit.value ? '更新队伍失败' : '创建队伍失败')
  } finally {
    busy.value = false
  }
}

// Navigation guard to prevent losing unsaved changes
onBeforeRouteLeave(() => {
  if (allowNavigation.value) {
    allowNavigation.value = false
    return true
  }
  if (!isDirty.value) return true
  return window.confirm('当前修改尚未保存，确定要离开吗？')
})

// Browser beforeunload handler
const handleBeforeUnload = (event: BeforeUnloadEvent) => {
  if (!isDirty.value) return
  event.preventDefault()
  // Modern browsers ignore the returnValue, but we still prevent default
  return ''
}

onMounted(async () => {
  // Add beforeunload event listener
  window.addEventListener('beforeunload', handleBeforeUnload)
  
  try {
    // 先检查基础状态，避免显示错误的初始状态
    await store.refreshUser()
    
    if (!store.isAuthed) {
      error.value = '请先登录后创建队伍'
      return
    }
    
    // Data is now loaded via Vue Query composables automatically
    // Just ensure user is authenticated
    await store.refreshUser()

    // 检查活动状态
    if (!event.value) {
      error.value = '活动不存在'
      return
    }
    if (store.isDemoEvent(event.value)) {
      error.value = '展示活动不支持创建队伍'
      return
    }
    if (event.value.status !== 'published') {
      error.value = '仅进行中活动支持创建队伍'
      return
    }

    // 填充表单数据（编辑模式或新建模式）
    if (isEdit.value && editingTeam.value) {
      teamName.value = editingTeam.value.name
      leaderQq.value = editingTeam.value.leader_qq
      teamIntro.value = editingTeam.value.intro
      teamNeeds.value = [...editingTeam.value.needs]
      teamExtra.value = editingTeam.value.extra
    } else {
      syncLeaderQq()
    }
    
    // Initialize saved snapshot after all data is loaded and form is populated
    syncSavedSnapshot()
  } finally {
    loading.value = false
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload)
})
</script>

<template>
  <main class="main">
    <!-- 加载状态 -->
    <section v-if="loading" class="detail-loading">
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
    </section>

    <!-- 主要内容 -->
    <template v-else>
      <section class="page-head">
      <div>
        <h1>{{ isEdit ? '编辑队伍' : '创建队伍' }}</h1>
        <p class="muted">填写队伍信息，用于组队大厅展示</p>
      </div>
      <div class="page-head__actions">
        <RouterLink class="btn btn--ghost" :to="`/events/${eventId}/team`">返回组队大厅</RouterLink>
      </div>
    </section>

    <section v-if="!canCreate" class="empty-state">
      <h2>暂时无法创建队伍</h2>
      <p class="muted">{{ error }}</p>
      <div class="empty-state__actions">
        <button v-if="!store.isAuthed" class="btn btn--primary" type="button" @click="store.openAuth('sign_in')">
          登录
        </button>
        <RouterLink class="btn btn--ghost" :to="`/events/${eventId}/team`">返回</RouterLink>
      </div>
    </section>

    <section v-else class="editor-panel">
      <div class="editor-panel__head">
        <h2 class="panel-title">
          <Users :size="18" />
          队伍信息
        </h2>
        <span v-if="event?.title" class="pill-badge pill-badge--draft">{{ event.title }}</span>
      </div>

      <form class="form" @submit.prevent="submit">
        <label class="field" :class="{ 'field--error': fieldErrors.teamName }">
          <span>队伍名称</span>
          <input v-model="teamName" type="text" placeholder="例如：霓虹守夜人" />
          <p v-if="fieldErrors.teamName" class="help-text error-text">{{ fieldErrors.teamName }}</p>
        </label>

        <label class="field" :class="{ 'field--error': fieldErrors.leaderQq }">
          <span>队长QQ</span>
          <input
            :value="leaderQq"
            type="text"
            inputmode="numeric"
            pattern="[0-9]*"
            placeholder="仅数字"
            @input="handleQqInput"
          />
          <p v-if="fieldErrors.leaderQq" class="help-text error-text">{{ fieldErrors.leaderQq }}</p>
        </label>

        <label class="field">
          <span>队伍介绍</span>
          <textarea v-model="teamIntro" rows="3" placeholder="介绍一下队伍目标与风格（可选）"></textarea>
        </label>

        <div class="field" :class="{ 'field--error': fieldErrors.teamNeeds || teamNeedError }">
          <span>队伍需求</span>
          <div class="tag-input">
            <div class="tag-list">
              <span v-for="tag in displayTeamNeeds" :key="tag" :class="['tag-pill', getRoleTagClass(tag)]">
                {{ tag }}
                <button type="button" class="tag-pill__remove" @click="removeNeedTag(tag)">×</button>
              </span>
              <input
                v-model="teamNeedInput"
                type="text"
                placeholder="输入需求并回车"
                @input="handleNeedInput"
                @keydown="handleNeedKeydown"
              />
            </div>
            <div class="tag-input__meta">
              <span class="muted">点击回车或输入逗号创建标签</span>
              <span class="muted">还可以添加 {{ Math.max(0, 6 - teamNeeds.length) }} 个标签</span>
            </div>
          </div>
          <div class="tag-suggestions">
            <span v-if="suggestionTags.some(canAddSuggestion)" class="muted">推荐标签：</span>
            <template v-for="tag in suggestionTags" :key="tag">
              <button
                v-if="canAddSuggestion(tag)"
                type="button"
                :class="['tag-suggestion', getRoleTagClass(tag)]"
                @click="addNeedTag(tag)"
              >
                {{ tag }}
              </button>
            </template>
          </div>
          <p v-if="fieldErrors.teamNeeds" class="help-text error-text">{{ fieldErrors.teamNeeds }}</p>
          <p v-else-if="teamNeedError" class="help-text error-text">{{ teamNeedError }}</p>
        </div>

        <label class="field">
          <span>补充</span>
          <textarea v-model="teamExtra" rows="3" placeholder="例如：协作方式、时间安排、工具偏好（可选）"></textarea>
        </label>

        <p v-if="error" class="alert error">{{ error }}</p>

        <div class="profile-actions">
          <RouterLink class="btn btn--ghost" :to="`/events/${eventId}/team`">取消</RouterLink>
          <button class="btn btn--primary" type="submit" :disabled="busy">
            {{ busy ? (isEdit ? '保存中...' : '创建中...') : isEdit ? '保存修改' : '创建队伍' }}
          </button>
        </div>
      </form>
    </section>
    </template>
  </main>
</template>




