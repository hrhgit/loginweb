<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Camera } from 'lucide-vue-next'
import { supabase } from '../lib/supabase'
import { useAppStore } from '../store/appStore'
import AvatarCropperModal from '../components/modals/AvatarCropperModal.vue'

const store = useAppStore()

const showAvatarCropper = ref(false)
const isEditing = ref(false)

const activeTab = ref<'profile' | 'security'>('profile')
const saveBusy = ref(false)
const saveError = ref('')
const profileErrors = ref<Record<string, string>>({})
const passwordErrors = ref<Record<string, string>>({})

const cancelEdit = () => {
  isEditing.value = false
  syncProfileForm()
  profileErrors.value = {}
  saveError.value = ''
}

const passwordBusy = ref(false)
const passwordError = ref('')
const passwordInfo = ref('')

const username = ref('')
const avatarUrl = ref('')
const phone = ref('')
const qq = ref('')
const roles = ref<string[]>([])

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')

const roleOptions = [
  { id: 'programmer', label: '程序' },
  { id: 'planner', label: '策划' },
  { id: 'artist', label: '美术' },
  { id: 'audio', label: '音乐音效' },
]

const isAuthed = computed(() => store.isAuthed)
const avatarPreview = computed(() => avatarUrl.value.trim())
const syncProfileForm = () => {
  const profile = store.profile
  const contacts = store.contacts
  username.value = profile?.username ?? ''
  avatarUrl.value = profile?.avatar_url ?? ''
  roles.value = Array.isArray(profile?.roles) ? [...(profile?.roles ?? [])] : []
  phone.value = contacts?.phone ?? ''
  qq.value = contacts?.qq ?? ''
}


const validateProfile = () => {
  const nextErrors: Record<string, string> = {}
  const name = username.value.trim()
  if (!name) {
    nextErrors.username = '用户名必填。'
  } else if (name.length < 2 || name.length > 20) {
    nextErrors.username = '用户名长度需在 2-20 个字符之间。'
  }

  const digitsPattern = /^[0-9]*$/
  if (phone.value && !digitsPattern.test(phone.value)) {
    nextErrors.phone = '电话仅允许数字。'
  }
  if (qq.value && !digitsPattern.test(qq.value)) {
    nextErrors.qq = 'QQ 仅允许数字。'
  }

  profileErrors.value = nextErrors
  return Object.keys(nextErrors).length === 0
}

const filterDigits = (event: Event) => {
  const target = event.target as HTMLInputElement
  const next = target.value.replace(/\D/g, '')
  if (target.value !== next) {
    target.value = next
  }
  return next
}

const toggleRole = (roleId: string) => {
  if (roles.value.includes(roleId)) {
    roles.value = roles.value.filter((item) => item !== roleId)
  } else {
    roles.value = [...roles.value, roleId]
  }
}

const handleSaveProfile = async () => {
  if (!validateProfile()) return
  saveBusy.value = true
  saveError.value = ''
  const profilePayload = {
    username: username.value.trim(),
    avatar_url: avatarUrl.value.trim() || null,
    roles: roles.value,
  }
  const contactsPayload = {
    phone: phone.value.trim() || null,
    qq: qq.value.trim() || null,
  }

  const { error: profileError } = await store.updateMyProfile(profilePayload)
  if (profileError) {
    saveError.value = profileError
    saveBusy.value = false
    return
  }

  const { error: contactsError } = await store.upsertMyContacts(contactsPayload)
  if (contactsError) {
    saveError.value = contactsError
    saveBusy.value = false
    return
  }

  store.setBanner('info', '个人资料已保存。')
  saveBusy.value = false
  isEditing.value = false
}

const resetPasswordState = () => {
  passwordError.value = ''
  passwordInfo.value = ''
  passwordErrors.value = {}
}

const validatePassword = () => {
  const nextErrors: Record<string, string> = {}
  if (!currentPassword.value) nextErrors.currentPassword = '请输入当前密码。'
  if (!newPassword.value) nextErrors.newPassword = '请输入新密码。'
  if (!confirmPassword.value) nextErrors.confirmPassword = '请确认新密码。'
  if (newPassword.value && newPassword.value.length < 6) {
    nextErrors.newPassword = '新密码至少 6 位。'
  }
  if (newPassword.value && confirmPassword.value && newPassword.value !== confirmPassword.value) {
    nextErrors.confirmPassword = '两次输入的新密码不一致。'
  }
  passwordErrors.value = nextErrors
  return Object.keys(nextErrors).length === 0
}

const handleUpdatePassword = async () => {
  if (!store.user?.email) {
    passwordError.value = '当前账号缺少邮箱信息。'
    return
  }
  resetPasswordState()
  if (!validatePassword()) return
  passwordBusy.value = true
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: store.user.email,
    password: currentPassword.value,
  })
  if (signInError) {
    passwordBusy.value = false
    passwordErrors.value = {
      ...passwordErrors.value,
      currentPassword: '密码错误',
    }
    return
  }

  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword.value })
  if (updateError) {
    passwordError.value = updateError.message
  } else {
    passwordInfo.value = '密码已更新。'
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
    await store.refreshUser()
  }
  passwordBusy.value = false
}

onMounted(async () => {
  await store.refreshUser()
  await store.loadMyProfile()
  await store.loadMyContacts()
  syncProfileForm()
})

watch(
  () => store.profile,
  () => {
    syncProfileForm()
  },
)

watch(
  () => store.contacts,
  () => {
    syncProfileForm()
  },
)
</script>

<template>
  <main class="main profile-page">
    <section class="page-head">
      <div>
        <h1>个人主页</h1>
        <p class="muted">管理你的个人信息与账号安全设置。</p>
      </div>
    </section>

    <section v-if="!isAuthed" class="empty-state">
      <h2>请先登录</h2>
      <p class="muted">登录后才能查看和编辑个人资料。</p>
      <div class="empty-state__actions">
        <button class="btn btn--primary" type="button" @click="store.openAuth('sign_in')">登录</button>
      </div>
    </section>

    <section v-else class="editor-panel profile-panel">
      <div class="editor-tabs editor-tabs--wide">
        <button class="editor-tab" type="button" :class="{ active: activeTab === 'profile' }" @click="activeTab = 'profile'">
          个人资料
        </button>
        <button class="editor-tab" type="button" :class="{ active: activeTab === 'security' }" @click="activeTab = 'security'">
          账号安全
        </button>
      </div>

      <div v-if="activeTab === 'profile'">
        <!-- View Mode -->
        <div v-if="!isEditing" class="profile-view">
          <div class="profile-header">
            <div class="profile-avatar-display">
              <img v-if="avatarPreview" :src="avatarPreview" alt="avatar" />
              <div v-else class="avatar-placeholder">无头像</div>
            </div>
            <div class="profile-info">
              <h2 class="profile-name">{{ username || '未设置昵称' }}</h2>
              <div class="profile-roles" v-if="roles.length">
                <span v-for="role in roles" :key="role" class="role-badge">
                  {{ roleOptions.find(r => r.id === role)?.label || role }}
                </span>
              </div>
              <p v-else class="muted text-sm">暂未选择职能</p>
            </div>
          </div>

          <div class="profile-details">
            <div class="detail-item">
              <span class="detail-label">电话</span>
              <span class="detail-value">{{ phone || '-' }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">QQ</span>
              <span class="detail-value">{{ qq || '-' }}</span>
            </div>
          </div>

          <div class="profile-actions">
            <button class="btn btn--primary" type="button" @click="isEditing = true">修改资料</button>
          </div>
        </div>

        <!-- Edit Mode -->
        <form v-else class="form" @submit.prevent="handleSaveProfile">
          <p v-if="store.profileError" class="alert error">{{ store.profileError }}</p>
          <p v-if="store.contactsError" class="alert error">{{ store.contactsError }}</p>
          
          <div class="profile-avatar">
            <div class="avatar-preview-wrapper">
              <button class="avatar-preview-btn" type="button" @click="showAvatarCropper = true">
                <div class="avatar-preview">
                  <img v-if="avatarPreview" :src="avatarPreview" alt="avatar" />
                  <div v-else class="avatar-placeholder">暂无头像</div>
                </div>
                <div class="avatar-edit-trigger">
                  <Camera :size="20" />
                  <span>更换</span>
                </div>
              </button>
            </div>
            <div class="avatar-actions">
              <p class="muted">点击左侧头像区域进行图片上传与裁剪。</p>
            </div>
          </div>

          <Teleport to="body">
            <AvatarCropperModal
              v-if="showAvatarCropper"
              :initial-image="avatarPreview"
              @close="showAvatarCropper = false"
              @save="(dataUrl) => (avatarUrl = dataUrl)"
            />
          </Teleport>

          <label class="field" :class="{ 'field--error': profileErrors.username }">
            <span>用户名</span>
            <input v-model="username" type="text" placeholder="请输入用户名" />
            <p v-if="profileErrors.username" class="help-text error-text">{{ profileErrors.username }}</p>
          </label>

          <label class="field" :class="{ 'field--error': profileErrors.phone }">
            <span>电话</span>
            <input
              v-model="phone"
              type="text"
              inputmode="numeric"
              pattern="[0-9]*"
              placeholder="仅允许数字"
              @input="phone = filterDigits($event)"
            />
            <p v-if="profileErrors.phone" class="help-text error-text">{{ profileErrors.phone }}</p>
          </label>

          <label class="field" :class="{ 'field--error': profileErrors.qq }">
            <span>QQ</span>
            <input
              v-model="qq"
              type="text"
              inputmode="numeric"
              pattern="[0-9]*"
              placeholder="仅允许数字"
              @input="qq = filterDigits($event)"
            />
            <p v-if="profileErrors.qq" class="help-text error-text">{{ profileErrors.qq }}</p>
          </label>

          <div class="field">
            <span>职能（可多选）</span>
            <div class="role-options">
              <label v-for="option in roleOptions" :key="option.id" class="role-option">
                <input
                  type="checkbox"
                  :checked="roles.includes(option.id)"
                  @change="toggleRole(option.id)"
                />
                <span>{{ option.label }}</span>
              </label>
            </div>
          </div>

          <p v-if="saveError" class="alert error">{{ saveError }}</p>
          <div class="profile-actions">
            <button class="btn" type="button" @click="cancelEdit">取消</button>
            <button
              class="btn btn--primary"
              type="submit"
              :disabled="saveBusy || store.profileLoading || store.contactsLoading"
            >
              {{ saveBusy ? '保存中...' : '保存资料' }}
            </button>
          </div>
        </form>
      </div>

      <form v-else class="form" @submit.prevent="handleUpdatePassword">
        <label class="field" :class="{ 'field--error': passwordErrors.currentPassword }">
          <span>当前密码</span>
          <input v-model="currentPassword" type="password" placeholder="请输入当前密码" />
          <p v-if="passwordErrors.currentPassword" class="help-text error-text">{{ passwordErrors.currentPassword }}</p>
        </label>

        <label class="field" :class="{ 'field--error': passwordErrors.newPassword }">
          <span>新密码</span>
          <input v-model="newPassword" type="password" placeholder="请输入新密码" />
          <p v-if="passwordErrors.newPassword" class="help-text error-text">{{ passwordErrors.newPassword }}</p>
        </label>

        <label class="field" :class="{ 'field--error': passwordErrors.confirmPassword }">
          <span>确认新密码</span>
          <input v-model="confirmPassword" type="password" placeholder="再次输入新密码" />
          <p v-if="passwordErrors.confirmPassword" class="help-text error-text">{{ passwordErrors.confirmPassword }}</p>
        </label>

        <p v-if="passwordError" class="alert error">{{ passwordError }}</p>
        <p v-if="passwordInfo" class="alert info">{{ passwordInfo }}</p>

        <div class="profile-actions">
          <button class="btn btn--primary" type="submit" :disabled="passwordBusy">
            {{ passwordBusy ? '更新中...' : '更新密码' }}
          </button>
        </div>
      </form>
    </section>

  </main>
</template>

<style scoped>
.profile-avatar {
  align-items: center;
  gap: 20px;
}

.avatar-preview-wrapper {
  flex-shrink: 0;
}

.avatar-preview-btn {
  position: relative;
  padding: 0;
  border: none;
  background: none;
  border-radius: 22px;
  cursor: pointer;
  overflow: hidden;
  display: block;
}

.avatar-preview-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.avatar-preview {
  transition: filter 0.2s ease;
}

.avatar-preview-btn:hover .avatar-preview {
  filter: brightness(0.8);
}

.avatar-edit-trigger {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: white;
  background-color: rgba(0, 0, 0, 0.4);
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;
  font-weight: 600;
  font-size: 0.9rem;
}

.avatar-preview-btn:hover .avatar-edit-trigger {
  opacity: 1;
}

.avatar-actions {
  display: grid;
  gap: 8px;
  align-self: start;
}

.avatar-actions p {
  margin: 0;
  font-size: 0.9rem;
}

/* Read-only View Styles */
.profile-view {
  display: grid;
  gap: 24px;
}

.profile-header {
  display: flex;
  align-items: center;
  gap: 20px;
}

.profile-avatar-display {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  overflow: hidden;
  border: 1px solid rgba(18, 33, 30, 0.12);
  background: var(--surface-strong);
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.profile-avatar-display img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.profile-info {
  display: grid;
  gap: 6px;
}

.profile-name {
  margin: 0;
  font-family: 'Sora', sans-serif;
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.2;
}

.profile-roles {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.role-badge {
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(31, 111, 109, 0.1);
  color: var(--accent);
  font-size: 0.8rem;
  font-weight: 600;
}

.profile-details {
  display: grid;
  gap: 12px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 16px;
  border: 1px solid rgba(18, 33, 30, 0.06);
}

.detail-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 1px dashed rgba(18, 33, 30, 0.1);
}

.detail-item:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.detail-label {
  color: var(--muted);
  font-size: 0.9rem;
}

.detail-value {
  font-weight: 600;
  color: var(--ink);
}

.role-options {
  display: flex !important;
  flex-wrap: nowrap !important;
  gap: 16px;
  overflow-x: auto;
  padding: 4px 2px 12px;
  width: 100%;
  -webkit-overflow-scrolling: touch;
}

.role-options::-webkit-scrollbar {
  height: 4px;
}

.role-options::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 10px;
}

.role-option {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--muted);
  font-size: 0.9rem;
  flex: 0 0 auto !important;
  white-space: nowrap;
  cursor: pointer;
}

/* Tab auto-fill styles */
.editor-tabs--wide {
  display: flex;
  width: calc(100% + 36px) !important; /* Offset the panel padding */
  margin: -18px -18px 24px !important;
}

.editor-tab {
  flex: 1;
  text-align: center;
}
</style>
