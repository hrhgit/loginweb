<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import { Upload, Link as LinkIcon, Loader2, RotateCcw } from 'lucide-vue-next'
import * as tus from 'tus-js-client'
import { supabase } from '../lib/supabase'
import { useAppStore } from '../store/appStore'

const route = useRoute()
const router = useRouter()
const store = useAppStore()

const eventId = computed(() => String(route.params.id ?? ''))
const eventPath = computed(() => `/events/${eventId.value}`)
const submitting = ref(false)
const submitError = ref('')
const submitInfo = ref('')

const projectName = ref('')
const teamId = ref('')
const coverFile = ref<File | null>(null)
const coverPreview = ref('')
const intro = ref('')
const videoLink = ref('')
const linkMode = ref<'link' | 'file'>('link')
const submissionLink = ref('')
const submissionPassword = ref('')
const submissionFile = ref<File | null>(null)
const teamOptions = ref<Array<{ id: string; name: string }>>([])

type FieldErrors = {
  projectName?: string
  teamId?: string
  coverFile?: string
  intro?: string
  submissionLink?: string
  submissionFile?: string
  videoLink?: string
}

const fieldErrors = ref<FieldErrors>({})
const emptyFieldErrors: FieldErrors = {}

const projectNameField = ref<HTMLElement | null>(null)
const teamField = ref<HTMLElement | null>(null)
const coverField = ref<HTMLElement | null>(null)
const introField = ref<HTMLElement | null>(null)
const videoField = ref<HTMLElement | null>(null)
const submissionLinkField = ref<HTMLElement | null>(null)
const submissionFileField = ref<HTMLElement | null>(null)

const scrollToField = (field: HTMLElement | null) => {
  if (!field) return
  field.scrollIntoView({ behavior: 'smooth', block: 'center' })
  const focusable = field.querySelector<HTMLElement>('input, textarea, select, button')
  focusable?.focus()
}

const resetFieldErrors = () => {
  fieldErrors.value = { ...emptyFieldErrors }
}

const setFieldError = (key: keyof FieldErrors, message: string, field: HTMLElement | null) => {
  fieldErrors.value[key] = message
  // Note: Setting field errors should not affect dirty state tracking
  scrollToField(field)
}

const coverUploadProgress = ref(0)
const fileUploadProgress = ref(0)

const uploadedCoverPath = ref('') // Relative path in bucket
const uploadedCoverUrl = ref('')  // Public URL
const uploadedSubmissionPath = ref('') // Relative path in bucket
const uploadedSubmissionUrl = ref('') // Public URL

const isUploadingCover = ref(false)
const isUploadingFile = ref(false)
const isSubmitted = ref(false)

// Image preview sizing
const previewImage = ref<HTMLImageElement | null>(null)
const imageAspectRatio = ref<number | null>(null)

const onImageLoad = () => {
  if (previewImage.value) {
    const img = previewImage.value
    imageAspectRatio.value = img.naturalWidth / img.naturalHeight
  }
}

// Form change detection state
const savedSnapshot = ref('')
const allowNavigation = ref(false)

const hasChanges = computed(() => {
  return projectName.value.trim() !== '' || 
         intro.value.trim() !== '' || 
         coverFile.value !== null ||
         submissionFile.value !== null ||
         submissionLink.value.trim() !== '' ||
         videoLink.value.trim() !== ''
})

// Form serialization for change detection
const serializeFormState = () => JSON.stringify({
  projectName: projectName.value,
  teamId: teamId.value,
  intro: intro.value,
  videoLink: videoLink.value,
  linkMode: linkMode.value,
  submissionLink: submissionLink.value,
  submissionPassword: submissionPassword.value,
  coverFileName: coverFile.value?.name || '',
  submissionFileName: submissionFile.value?.name || ''
})

// Snapshot-based change detection
const isDirty = computed(() => {
  if (!savedSnapshot.value) return false
  return savedSnapshot.value !== serializeFormState()
})

// Helper function to sync saved snapshot
const syncSavedSnapshot = () => {
  savedSnapshot.value = serializeFormState()
}

onBeforeRouteLeave(async (_, __, next) => {
  if ((isDirty.value || hasChanges.value) && !allowNavigation.value && !isSubmitted.value) {
    const answer = window.confirm('当前修改尚未保存，确定要离开吗？已上传的文件将被清理。')
    if (answer) {
      // Cleanup files if user chooses to leave
      if (uploadedCoverPath.value) {
        await deleteFile('public-assets', uploadedCoverPath.value)
      }
      if (uploadedSubmissionPath.value) {
        await deleteFile('submission-files', uploadedSubmissionPath.value)
      }
      next()
    } else {
      next(false)
    }
  } else {
    // Also cleanup if leaving without submission (e.g. no changes but file uploaded? 
    // actually hasChanges covers file upload too)
    if (!isSubmitted.value && !allowNavigation.value) {
       if (uploadedCoverPath.value) await deleteFile('public-assets', uploadedCoverPath.value)
       if (uploadedSubmissionPath.value) await deleteFile('submission-files', uploadedSubmissionPath.value)
    }
    next()
  }
})

// Browser beforeunload event handler
const handleBeforeUnload = (event: BeforeUnloadEvent) => {
  if ((isDirty.value || hasChanges.value) && !allowNavigation.value && !isSubmitted.value) {
    event.preventDefault()
    event.returnValue = ''
    return ''
  }
}

const deleteFile = async (bucket: string, path: string) => {
  if (!path) return
  await supabase.storage.from(bucket).remove([path]).catch(() => undefined)
}

const MAX_FILE_SIZE = 500 * 1024 * 1024 // 500MB
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string

const isValidUrl = (value: string) => {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

const loadMyTeams = async () => {
  if (!store.user || !eventId.value) return []
  const userId = store.user.id
  // Only fetch teams where user is the leader
  const { data, error } = await supabase
    .from('teams')
    .select('id,name,event_id,leader_id')
    .eq('leader_id', userId)
    .eq('event_id', eventId.value)

  if (error) {
    submitError.value = error.message
    return []
  }

  const options = (data ?? []).map(t => ({ id: t.id, name: t.name }))
  teamOptions.value = options
  if (!teamId.value && options.length) teamId.value = options[0].id
  return options
}

// Update pickCover to upload immediately
const pickCover = async (files: FileList | null) => {
  coverUploadProgress.value = 0
  const file = files?.[0] ?? null
  
  if (!file) {
    if (uploadedCoverPath.value) await deleteFile('public-assets', uploadedCoverPath.value)
    coverFile.value = null
    coverPreview.value = ''
    uploadedCoverPath.value = ''
    uploadedCoverUrl.value = ''
    imageAspectRatio.value = null // Reset aspect ratio
    syncSavedSnapshot() // Update snapshot after file removal
    return
  }

  // Type validation
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allowedTypes.includes(file.type)) {
    setFieldError('coverFile', '仅支持 JPG, PNG, WebP 或 GIF 格式的图片', coverField.value)
    return
  }

  // Delete old file if exists before uploading new one
  if (uploadedCoverPath.value) {
    void deleteFile('public-assets', uploadedCoverPath.value)
  }

  coverFile.value = file
  if (coverPreview.value) URL.revokeObjectURL(coverPreview.value)
  coverPreview.value = URL.createObjectURL(file)
  
  isUploadingCover.value = true
  try {
    const ext = file.name.split('.').pop() || 'png'
    const path = `covers/${eventId.value}/${store.user?.id}-${Date.now()}.${ext}`
    uploadedCoverPath.value = path
    
    await uploadWithFallback('public-assets', path, file, (pct) => (coverUploadProgress.value = pct))
    
    const { data } = supabase.storage.from('public-assets').getPublicUrl(path)
    uploadedCoverUrl.value = data.publicUrl
    syncSavedSnapshot() // Update snapshot after successful file upload
  } catch (err: any) {
    console.error('Cover upload failed', err)
    setFieldError('coverFile', '封面上传失败: ' + err.message, coverField.value)
  } finally {
    isUploadingCover.value = false
  }
}

// Update pickSubmissionFile to upload immediately
const pickSubmissionFile = async (files: FileList | null) => {
  fileUploadProgress.value = 0
  const file = files?.[0] ?? null
  
  if (!file) {
    if (uploadedSubmissionPath.value) await deleteFile('submission-files', uploadedSubmissionPath.value)
    submissionFile.value = null
    uploadedSubmissionPath.value = ''
    uploadedSubmissionUrl.value = ''
    syncSavedSnapshot() // Update snapshot after file removal
    return
  }

  // Type validation (compressed files)
  const allowedMimeTypes = [
    'application/zip', 
    'application/x-zip-compressed', 
    'application/x-rar-compressed', 
    'application/vnd.rar', 
    'application/x-7z-compressed',
    'application/x-tar',
    'application/gzip'
  ]
  const allowedExts = ['.zip', '.rar', '.7z', '.tar', '.gz']
  const fileExt = '.' + (file.name.split('.').pop() || '').toLowerCase()
  
  if (!allowedMimeTypes.includes(file.type) && !allowedExts.includes(fileExt)) {
    setFieldError('submissionFile', '仅支持 ZIP, RAR, 7Z, TAR 或 GZIP 格式的压缩包', submissionFileField.value)
    return
  }

  if (file.size > MAX_FILE_SIZE) {
    setFieldError('submissionFile', '文件不能大于 500MB', submissionFileField.value)
    submissionFile.value = null
    return
  }

  // Delete old file if exists before uploading new one
  if (uploadedSubmissionPath.value) {
    void deleteFile('submission-files', uploadedSubmissionPath.value)
  }
  
  submissionFile.value = file
  isUploadingFile.value = true
  try {
    const ext = file.name.split('.').pop() || 'zip'
    const safeId = teamId.value || store.user?.id || 'temp'
    const path = `files/${eventId.value}/${safeId}-${Date.now()}.${ext}`
    
    uploadedSubmissionPath.value = path
    
    await uploadWithFallback('submission-files', path, file, (pct) => (fileUploadProgress.value = pct))
    
    const { data } = supabase.storage.from('submission-files').getPublicUrl(path)
    uploadedSubmissionUrl.value = data.publicUrl
    syncSavedSnapshot() // Update snapshot after successful file upload
  } catch (err: any) {
    console.error('File upload failed', err)
    setFieldError('submissionFile', '文件上传失败: ' + err.message, submissionFileField.value)
  } finally {
    isUploadingFile.value = false
  }
}

const uploadResumable = async (bucket: string, path: string, file: File, onProgress: (pct: number) => void) => {
  return new Promise<void>(async (resolve, reject) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      reject(new Error('请先登录'))
      return
    }

    const endpoint = `${SUPABASE_URL}/storage/v1/upload/resumable`

    const upload = new tus.Upload(file, {
      endpoint,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        authorization: `Bearer ${session.access_token}`,
        'x-upsert': 'true',
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: bucket,
        objectName: path,
        contentType: file.type,
        cacheControl: '3600',
      },
      chunkSize: 6 * 1024 * 1024,
      onError: function (error) {
        console.error('Upload failed:', error)
        reject(error)
      },
      onProgress: function (bytesUploaded, bytesTotal) {
        const percentage = (bytesUploaded / bytesTotal) * 100
        onProgress(percentage)
      },
      onSuccess: function () {
        resolve()
      },
    })

    upload.findPreviousUploads().then(function (previousUploads) {
      if (previousUploads.length) {
        upload.resumeFromPreviousUpload(previousUploads[0])
      }
      upload.start()
    })
  })
}

const uploadSimple = async (bucket: string, path: string, file: File, onProgress: (pct: number) => void) => {
  const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: true,
  })
  if (error) throw error
  onProgress(100)
  return data
}

const uploadWithFallback = async (
  bucket: string,
  path: string,
  file: File,
  onProgress: (pct: number) => void,
) => {
  try {
    await uploadResumable(bucket, path, file, onProgress)
  } catch (err) {
    onProgress(0)
    await uploadSimple(bucket, path, file, onProgress)
  }
}

const handleCancel = () => {
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push(eventPath.value)
  }
}

const submit = async () => {
  submitError.value = ''
  submitInfo.value = ''
  resetFieldErrors() // Clear previous error messages, but preserve dirty state

  // Note: Validation errors should not clear dirty state - only successful submission should
  if (!store.user) {
    store.openAuth('sign_in')
    store.authInfo = '请先登录后提交作品'
    return
  }

  if (!projectName.value.trim()) {
    setFieldError('projectName', '请填写作品名', projectNameField.value)
    return
  }
  if (!teamId.value) {
    setFieldError('teamId', '请选择所属队伍', teamField.value)
    return
  }
  if (!coverFile.value) {
    setFieldError('coverFile', '请上传作品封面', coverField.value)
    return
  }
  if (!intro.value.trim()) {
    setFieldError('intro', '请填写作品简介', introField.value)
    return
  }
  if (linkMode.value === 'link') {
    if (!submissionLink.value.trim() || !isValidUrl(submissionLink.value.trim())) {
      setFieldError('submissionLink', '请输入有效的作品链接', submissionLinkField.value)
      return
    }
  } else {
    if (!submissionFile.value) {
      setFieldError('submissionFile', '请选择要上传的作品文件', submissionFileField.value)
      return
    }
    if (submissionFile.value.size > MAX_FILE_SIZE) {
      setFieldError('submissionFile', '文件不能大于 500MB', submissionFileField.value)
      return
    }
  }
  if (videoLink.value && !isValidUrl(videoLink.value.trim())) {
    setFieldError('videoLink', '视频链接不是有效的网页地址', videoField.value)
    return
  }

  submitting.value = true
  try {
    let coverPath = ''
    if (coverFile.value) {
      const ext = coverFile.value.name.split('.').pop() || 'png'
      const path = `covers/${eventId.value}/${teamId.value}-${Date.now()}.${ext}`
      await uploadWithFallback('public-assets', path, coverFile.value, (pct) => (coverUploadProgress.value = pct))
      // 保存存储路径而不是公共URL
      coverPath = path
    }

    let submissionPath: string | null = null
    let submissionUrl: string | null = null

    if (linkMode.value === 'link') {
      submissionUrl = submissionLink.value.trim()
    } else if (submissionFile.value) {
      const ext = submissionFile.value.name.split('.').pop() || 'zip'
      const path = `files/${eventId.value}/${teamId.value}-${Date.now()}.${ext}`
      await uploadWithFallback('submission-files', path, submissionFile.value, (pct) => (fileUploadProgress.value = pct))
      submissionPath = path
      const { data } = supabase.storage.from('submission-files').getPublicUrl(path)
      submissionUrl = data.publicUrl
    }

    const submissionPayload = {
      event_id: eventId.value,
      team_id: teamId.value,
      submitted_by: store.user.id,
      project_name: projectName.value.trim(),
      intro: intro.value.trim(),
      cover_path: coverPath,
      video_link: videoLink.value.trim() || null,
      link_mode: linkMode.value,
      submission_url: submissionUrl,
      submission_storage_path: submissionPath,
      submission_password: linkMode.value === 'link' ? submissionPassword.value.trim() || null : null,
    }

    const { error: dbError } = await supabase
      .from('submissions')
      .upsert(submissionPayload, { onConflict: 'event_id,team_id' })

    if (dbError) {
      throw new Error(dbError.message)
    }

    isSubmitted.value = true
    allowNavigation.value = true
    syncSavedSnapshot() // Clear dirty state by updating saved snapshot
    submitInfo.value = '提交成功！'
    store.setBanner('info', '作品提交成功。')

    await router.push(eventPath.value)
  } catch (err: any) {
    submitError.value = err?.message || '提交失败'
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  console.log('SubmissionPage mounted')
  await store.refreshUser()
  await store.ensureEventsLoaded()
  const options = await loadMyTeams()
  if (store.user && eventId.value && options.length === 0) {
    store.setBanner('error', '仅队长可以提交作品')
    await router.replace(`/events/${eventId.value}`)
    return
  }
  
  // Add beforeunload event listener
  window.addEventListener('beforeunload', handleBeforeUnload)
  
  // Initialize saved snapshot after component setup and team loading
  syncSavedSnapshot()
})

onUnmounted(() => {
  if (coverPreview.value) URL.revokeObjectURL(coverPreview.value)
  imageAspectRatio.value = null
  
  // Remove beforeunload event listener
  window.removeEventListener('beforeunload', handleBeforeUnload)
})
</script>

<template>
  <main class="detail-page">
    <section class="detail-hero">
      <div class="detail-hero__main">
        <div class="detail-hero__head-row">
          <p class="detail-eyebrow">作品提交</p>
          <button class="btn btn--ghost" type="button" @click="handleCancel">返回活动</button>
        </div>
        <h1>提交作品</h1>
        <p class="detail-lead">填写项目信息，上传或提供链接</p>
      </div>
    </section>

    <section class="detail-section">
      <div class="detail-section__head">
        <h2>作品信息</h2>
        <p class="muted">作品名、所属队伍、封面、简介、视频链接</p>
      </div>

      <form class="form" @submit.prevent="submit">
        <div class="field" ref="projectNameField" :class="{ 'field--error': fieldErrors.projectName }">
          <label>作品名 <span class="required">*</span></label>
          <input v-model="projectName" type="text" placeholder="输入作品名" />
          <p v-if="fieldErrors.projectName" class="help-text error-text">{{ fieldErrors.projectName }}</p>
        </div>

        <div class="field" ref="teamField" :class="{ 'field--error': fieldErrors.teamId }">
          <label>选择队伍 <span class="required">*</span></label>
          <select v-model="teamId">
            <option v-for="team in teamOptions" :key="team.id" :value="team.id">{{ team.name }}</option>
            <option v-if="!teamOptions.length" value="" disabled>暂无可选队伍</option>
          </select>
          <p v-if="fieldErrors.teamId" class="help-text error-text">{{ fieldErrors.teamId }}</p>
        </div>

        <div class="field" ref="coverField" :class="{ 'field--error': fieldErrors.coverFile }">
          <label>作品封面 <span class="required">*</span></label>
          <div class="upload-field">
            <label class="upload-trigger" :class="{ 'has-preview': coverPreview }">
              <img 
                v-if="coverPreview" 
                :src="coverPreview" 
                class="upload-preview" 
                alt="Cover preview"
                @load="onImageLoad"
                ref="previewImage"
              />
              <div class="upload-trigger__content">
                <RotateCcw v-if="coverPreview" :size="40" />
                <Upload v-else :size="40" />
                <span>{{ coverPreview ? '重新上传' : (coverFile?.name || '选择图片') }}</span>
              </div>
              <input
                class="upload-trigger__input"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                @change="(e) => pickCover((e.target as HTMLInputElement).files)"
              />
            </label>
            <p class="muted">建议 2MB 内，支持 JPG/PNG/WebP/GIF</p>
            <div v-if="coverUploadProgress" class="progress">
              <div class="progress__bar" :style="{ width: `${coverUploadProgress}%` }"></div>
            </div>
          </div>
          <p v-if="fieldErrors.coverFile" class="help-text error-text">{{ fieldErrors.coverFile }}</p>
        </div>

        <div class="field" ref="introField" :class="{ 'field--error': fieldErrors.intro }">
          <label>作品简介 <span class="required">*</span></label>
          <textarea v-model="intro" rows="3" placeholder="一句话描述作品亮点"></textarea>
          <p v-if="fieldErrors.intro" class="help-text error-text">{{ fieldErrors.intro }}</p>
        </div>

        <div class="field" ref="videoField" :class="{ 'field--error': fieldErrors.videoLink }">
          <label>视频链接（可选）</label>
          <div class="input-with-icon">
            <LinkIcon :size="16" />
            <input v-model="videoLink" :class="{ 'input-error': fieldErrors.videoLink }" type="url" placeholder="https://..." />
          </div>
          <p v-if="fieldErrors.videoLink" class="help-text error-text">{{ fieldErrors.videoLink }}</p>
          <p class="help-text">提交网盘或其他链接</p>
        </div>

        <div class="field">
          <label>提交方式 <span class="required">*</span></label>
          <div class="submission-modes">
            <label class="mode-card" :class="{ active: linkMode === 'link' }">
              <input type="radio" value="link" v-model="linkMode" class="sr-only" />
              <div class="mode-card__icon">
                <LinkIcon :size="20" />
              </div>
              <div class="mode-card__info">
                <span class="mode-card__title">提交链接</span>
              </div>
            </label>
            <label class="mode-card" :class="{ active: linkMode === 'file' }">
              <input type="radio" value="file" v-model="linkMode" class="sr-only" />
              <div class="mode-card__icon">
                <Upload :size="20" />
              </div>
              <div class="mode-card__info">
                <span class="mode-card__title">上传文件</span>
              </div>
            </label>
          </div>
        </div>

        <div
          v-if="linkMode === 'link'"
          class="field"
          ref="submissionLinkField"
          :class="{ 'field--error': fieldErrors.submissionLink }"
        >
          <label>作品链接 <span class="required">*</span></label>
          <div class="input-with-icon input-with-password">
            <LinkIcon :size="16" />
            <input
              v-model="submissionLink"
              class="link-input"
              :class="{ 'input-error': fieldErrors.submissionLink }"
              type="url"
              placeholder="https://..."
            />
            <input v-model="submissionPassword" class="link-password" type="text" placeholder="密码(可选)" />
          </div>
          <p v-if="fieldErrors.submissionLink" class="help-text error-text">{{ fieldErrors.submissionLink }}</p>
          <p class="help-text">提交网盘或其他链接</p>
        </div>

        <div v-else class="field" ref="submissionFileField" :class="{ 'field--error': fieldErrors.submissionFile }">
          <label>作品文件 <span class="required">*</span></label>
          <div class="upload-field">
            <label class="upload-trigger" :class="{ 'has-file': submissionFile }">
              <div class="upload-trigger__content">
                <Upload v-if="!submissionFile" :size="40" />
                <div v-if="submissionFile" class="file-info">
                  <span class="file-name">{{ submissionFile.name }}</span>
                  <button type="button" class="reupload-btn">
                    <RotateCcw :size="16" />
                    重新上传
                  </button>
                </div>
                <span v-if="!submissionFile">{{ '选择文件' }}</span>
              </div>
              <input
                class="upload-trigger__input"
                type="file"
                accept=".zip,.rar,.7z,.tar,.gz,application/zip,application/x-zip-compressed,application/x-rar-compressed,application/vnd.rar,application/x-7z-compressed,application/x-tar,application/gzip"
                @change="(e) => pickSubmissionFile((e.target as HTMLInputElement).files)"
              />
            </label>
            <div v-if="fileUploadProgress" class="progress">
              <div class="progress__bar" :style="{ width: `${fileUploadProgress}%` }"></div>
            </div>
          </div>
          <p v-if="fieldErrors.submissionFile" class="help-text error-text">{{ fieldErrors.submissionFile }}</p>
          <p class="help-text">请提交压缩文件，不得超过500MB</p>
        </div>

        <p v-if="submitError" class="alert error">{{ submitError }}</p>
        <p v-if="submitInfo" class="alert info">{{ submitInfo }}</p>

        <div class="detail-form-actions">
          <button class="btn btn--ghost" type="button" @click="handleCancel">取消</button>
          <button class="btn btn--primary" type="submit" :disabled="submitting">
            <Loader2 v-if="submitting" class="spin" :size="16" />
            {{ submitting ? '提交中...' : '提交作品' }}
          </button>
        </div>
      </form>
    </section>
  </main>
</template>

<style scoped>
.detail-page .detail-hero .detail-lead {
  margin-top: 8px;
  font-size: 0.95rem;
}
.detail-page .upload-field > .muted {
  font-size: 0.95rem;
}
.detail-page .help-text {
  font-size: 0.95rem;
}
.required {
  color: var(--danger);
  margin-left: 4px;
}
.upload-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.upload-trigger {
  position: relative;
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 20px;
  padding: 36px 14px;
  border: 1px dashed #d4d4d8;
  border-radius: 12px;
  background: #f8fafc;
  color: #111827;
  cursor: pointer;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
  min-height: 168px;
  width: 100%;
  font-size: 2.5rem;
  font-weight: 700;
  overflow: hidden;
}

.upload-trigger.has-preview {
  padding: 0;
  min-height: auto;
  height: auto;
  aspect-ratio: v-bind(imageAspectRatio);
  max-height: 400px;
}

.upload-preview {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  z-index: 1;
}
.upload-trigger__content {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 20px;
}
.upload-trigger.has-preview .upload-trigger__content {
  background: rgba(0, 0, 0, 0.4);
  color: white;
  padding: 12px 24px;
  border-radius: 16px;
  backdrop-filter: blur(4px);
}

.upload-trigger.has-preview .upload-trigger__content span {
  color: white;
  font-weight: 600;
}

.upload-trigger.has-file {
  padding: 24px;
  min-height: auto;
  font-size: 1rem;
  font-weight: 400;
  background: #f5f5f5;
  border: 1px solid var(--border);
  border-style: solid;
}

.upload-trigger.has-file .upload-trigger__content {
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.file-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  align-items: center;
}

.file-name {
  font-size: 1rem;
  font-weight: 400;
  color: var(--ink);
  word-break: break-all;
  text-align: center;
}

.reupload-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: var(--accent-soft);
  color: var(--accent);
  border: 1px solid var(--accent);
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  align-self: flex-start;
}

.reupload-btn:hover {
  background: var(--accent);
  color: white;
}
.upload-trigger > span {
  font-size: inherit;
  font-weight: inherit;
}
.upload-trigger :deep(svg) {
  width: 1.6rem;
  height: 1.6rem;
}
.upload-trigger:hover {
  border-color: #111827;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  background: #eef2ff;
}
.upload-trigger__input {
  display: none;
}
.input-with-icon {
  display: flex;
  align-items: center;
  gap: 12px;
  background: transparent;
  border: none;
  padding: 0;
  min-height: auto;
}
.input-with-icon input {
  background: #ffffffeb;
  border: 1px solid rgba(18, 33, 30, 0.14);
  border-radius: 12px;
  padding: 12px 16px;
  font: inherit;
  color: inherit;
  min-width: 0;
  flex: 1;
  height: 56px;
  transition: all 0.2s ease;
}
.input-with-icon input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 4px var(--accent-soft);
}
.input-with-password {
  flex-wrap: nowrap;
}
.input-with-password .link-input {
  flex: 1 1 220px;
}
.input-with-password .link-password {
  flex: 0 0 120px;
  max-width: 140px;
  margin-left: 0;
  padding: 12px 16px;
  border: 1px solid rgba(18, 33, 30, 0.14);
}
.input-with-password .link-password:focus {
  border-color: var(--accent) !important;
  box-shadow: 0 0 0 4px var(--accent-soft);
}

.progress {
  height: 8px;
  background: #f1f5f9;
  border-radius: 999px;
  overflow: hidden;
}
.progress__bar {
  height: 100%;
  background: linear-gradient(90deg, #22c55e, #16a34a);
  transition: width 0.2s ease;
}
.submission-modes {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}
.mode-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--surface-strong);
  cursor: pointer;
  transition: all 0.2s ease;
}
.mode-card:hover {
  border-color: var(--accent);
  background: var(--surface);
  transform: translateY(-2px);
}
.mode-card.active {
  border-color: var(--accent);
  background: rgba(31, 111, 109, 0.04);
  box-shadow: 0 8px 20px rgba(31, 111, 109, 0.08);
}
.mode-card__icon {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: var(--surface-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--muted);
  transition: all 0.2s ease;
  flex-shrink: 0;
}
.mode-card.active .mode-card__icon {
  background: var(--accent);
  color: white;
}
.mode-card__info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.mode-card__title {
  font-weight: 700;
  font-size: 0.92rem;
  color: var(--ink);
}
.mode-card__desc {
  font-size: 0.72rem;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
.spin {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>