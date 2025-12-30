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

const eventId = computed(() => String(route.params.id ?? route.params.eventId ?? ''))
const submissionId = computed(() => String(route.params.submissionId ?? ''))
const isEditMode = computed(() => Boolean(submissionId.value))
const eventPath = computed(() => `/events/${eventId.value}`)
const submitting = ref(false)
const submitError = ref('')
const submitInfo = ref('')
const showSubmitModal = ref(false)
const submitStatus = ref<'submitting' | 'success' | 'error'>('submitting')

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

// 编辑模式相关状态
const originalSubmission = ref<any>(null)
const isLoadingSubmission = ref(false)
const loadSubmissionError = ref('')

// 文件状态标记
const hasExistingCover = ref(false)
const hasExistingSubmissionFile = ref(false)
const existingCoverUrl = ref('')
const existingSubmissionFileName = ref('')

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

// 加载现有作品数据（编辑模式）
const loadExistingSubmission = async () => {
  if (!isEditMode.value || !submissionId.value) return
  
  // 先检查缓存，避免不必要的加载状态
  await store.loadSubmissions(eventId.value)
  const submissions = store.getSubmissionsForEvent(eventId.value)
  const cachedSubmission = submissions.find(s => s.id === submissionId.value)
  
  if (cachedSubmission) {
    // 有缓存数据时直接使用，不显示加载状态
    loadSubmissionError.value = ''
    
    // 检查权限：只有提交者可以编辑
    if (cachedSubmission.submitted_by !== store.user?.id) {
      loadSubmissionError.value = '您没有权限编辑此作品'
      return
    }
    
    // 直接填充数据，不显示加载状态
    await populateFormData(cachedSubmission)
    return
  }

  // 只有在没有缓存数据时才显示加载状态
  isLoadingSubmission.value = true
  loadSubmissionError.value = ''
  
  try {
    // 重新加载数据
    await store.loadSubmissions(eventId.value)
    const submissions = store.getSubmissionsForEvent(eventId.value)
    const submission = submissions.find(s => s.id === submissionId.value)
    
    if (!submission) {
      loadSubmissionError.value = '未找到要编辑的作品'
      return
    }
    
    // 检查权限：只有提交者可以编辑
    if (submission.submitted_by !== store.user?.id) {
      loadSubmissionError.value = '您没有权限编辑此作品'
      return
    }
    
    await populateFormData(submission)
    
  } catch (err: any) {
    console.error('Failed to load submission:', err)
    loadSubmissionError.value = err.message || '加载作品数据失败'
  } finally {
    isLoadingSubmission.value = false
  }
}

// 提取表单数据填充逻辑
const populateFormData = async (submission: any) => {
  originalSubmission.value = submission
  
  // 预填充表单数据
  projectName.value = submission.project_name || ''
  teamId.value = submission.team_id || ''
  intro.value = submission.intro || ''
  videoLink.value = submission.video_link || ''
  linkMode.value = submission.link_mode || 'link'
  submissionLink.value = submission.submission_url || ''
  submissionPassword.value = submission.submission_password || ''
  
  // 处理封面
  if (submission.cover_path) {
    hasExistingCover.value = true
    uploadedCoverPath.value = submission.cover_path
    
    // 生成封面预览URL
    if (submission.cover_path.startsWith('http')) {
      existingCoverUrl.value = submission.cover_path
      coverPreview.value = submission.cover_path
    } else {
      const { data } = supabase.storage.from('public-assets').getPublicUrl(submission.cover_path)
      existingCoverUrl.value = data.publicUrl
      coverPreview.value = data.publicUrl
    }
  }
  
  // 处理作品文件
  if (submission.link_mode === 'file' && submission.submission_storage_path) {
    hasExistingSubmissionFile.value = true
    uploadedSubmissionPath.value = submission.submission_storage_path
    uploadedSubmissionUrl.value = submission.submission_url || ''
    
    // 提取文件名
    const pathParts = submission.submission_storage_path.split('/')
    existingSubmissionFileName.value = pathParts[pathParts.length - 1] || '已有文件'
  }
  
  // 更新快照以避免误报更改
  syncSavedSnapshot()
}

// Update pickCover to upload immediately
const pickCover = async (files: FileList | null) => {
  coverUploadProgress.value = 0
  const file = files?.[0] ?? null
  
  if (!file) {
    if (uploadedCoverPath.value && !hasExistingCover.value) {
      await deleteFile('public-assets', uploadedCoverPath.value)
    }
    
    // 如果是编辑模式且有现有封面，恢复到现有封面
    if (isEditMode.value && hasExistingCover.value) {
      coverFile.value = null
      coverPreview.value = existingCoverUrl.value
      uploadedCoverPath.value = originalSubmission.value?.cover_path || ''
      uploadedCoverUrl.value = existingCoverUrl.value
    } else {
      // 完全清除
      coverFile.value = null
      coverPreview.value = ''
      uploadedCoverPath.value = ''
      uploadedCoverUrl.value = ''
      hasExistingCover.value = false
    }
    
    imageAspectRatio.value = null
    syncSavedSnapshot()
    return
  }

  // Type validation
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allowedTypes.includes(file.type)) {
    setFieldError('coverFile', '仅支持 JPG, PNG, WebP 或 GIF 格式的图片', coverField.value)
    return
  }

  // Delete old file if exists before uploading new one (but not existing file in edit mode)
  if (uploadedCoverPath.value && !hasExistingCover.value) {
    void deleteFile('public-assets', uploadedCoverPath.value)
  }

  coverFile.value = file
  if (coverPreview.value) URL.revokeObjectURL(coverPreview.value)
  coverPreview.value = URL.createObjectURL(file)
  
  // 标记不再使用现有封面
  hasExistingCover.value = false
  
  isUploadingCover.value = true
  try {
    const ext = file.name.split('.').pop() || 'png'
    const safeId = store.user?.id || 'temp'
    
    // 路径结构: covers/{eventId}/{userId-timestamp}.{ext}
    const path = `covers/${eventId.value}/${safeId}-${Date.now()}.${ext}`
    uploadedCoverPath.value = path
    
    await uploadWithFallback('public-assets', path, file, (pct) => (coverUploadProgress.value = pct))
    
    const { data } = supabase.storage.from('public-assets').getPublicUrl(path)
    uploadedCoverUrl.value = data.publicUrl
    syncSavedSnapshot()
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
    if (uploadedSubmissionPath.value && !hasExistingSubmissionFile.value) {
      await deleteFile('submission-files', uploadedSubmissionPath.value)
    }
    
    // 如果是编辑模式且有现有文件，恢复到现有文件
    if (isEditMode.value && hasExistingSubmissionFile.value) {
      submissionFile.value = null
      uploadedSubmissionPath.value = originalSubmission.value?.submission_storage_path || ''
      uploadedSubmissionUrl.value = originalSubmission.value?.submission_url || ''
    } else {
      // 完全清除
      submissionFile.value = null
      uploadedSubmissionPath.value = ''
      uploadedSubmissionUrl.value = ''
      hasExistingSubmissionFile.value = false
    }
    
    syncSavedSnapshot()
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

  // Delete old file if exists before uploading new one (but not existing file in edit mode)
  if (uploadedSubmissionPath.value && !hasExistingSubmissionFile.value) {
    void deleteFile('submission-files', uploadedSubmissionPath.value)
  }
  
  submissionFile.value = file
  
  // 标记不再使用现有文件
  hasExistingSubmissionFile.value = false
  
  isUploadingFile.value = true
  try {
    const ext = file.name.split('.').pop() || 'zip'
    const safeId = teamId.value || store.user?.id || 'temp'
    
    // 路径结构: files/{eventId}/{teamId-timestamp}.{ext}
    const path = `files/${eventId.value}/${safeId}-${Date.now()}.${ext}`
    
    uploadedSubmissionPath.value = path
    
    await uploadWithFallback('submission-files', path, file, (pct) => (fileUploadProgress.value = pct))
    
    const { data } = supabase.storage.from('submission-files').getPublicUrl(path)
    uploadedSubmissionUrl.value = data.publicUrl
    syncSavedSnapshot()
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
  if (isEditMode.value && originalSubmission.value) {
    // 编辑模式：返回作品详情页
    router.push(`/events/${eventId.value}/submissions/${originalSubmission.value.id}`)
  } else if (window.history.length > 1) {
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
  if (!coverFile.value && !hasExistingCover.value && !coverPreview.value) {
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
    if (!submissionFile.value && !hasExistingSubmissionFile.value) {
      setFieldError('submissionFile', '请选择要上传的作品文件', submissionFileField.value)
      return
    }
    if (submissionFile.value && submissionFile.value.size > MAX_FILE_SIZE) {
      setFieldError('submissionFile', '文件不能大于 500MB', submissionFileField.value)
      return
    }
  }
  if (videoLink.value && !isValidUrl(videoLink.value.trim())) {
    setFieldError('videoLink', '视频链接不是有效的网页地址', videoField.value)
    return
  }

  // 显示提交弹窗
  showSubmitModal.value = true
  submitStatus.value = 'submitting'
  submitting.value = true

  try {
    let coverPath = uploadedCoverPath.value || ''
    
    // 只有在上传了新封面时才使用已上传的路径
    // 不需要重新上传，因为在 pickCover 时已经上传了

    let submissionPath: string | null = uploadedSubmissionPath.value || null
    let submissionUrl: string | null = uploadedSubmissionUrl.value || null

    if (linkMode.value === 'link') {
      submissionUrl = submissionLink.value.trim()
      submissionPath = null // 清除文件路径
    }
    // 文件模式：使用已经在 pickSubmissionFile 中上传的文件
    // 不需要重新上传，因为文件已经在选择时上传了

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

    // 如果是编辑模式，添加ID进行更新
    if (isEditMode.value && originalSubmission.value) {
      (submissionPayload as any).id = originalSubmission.value.id
    }

    const { error: dbError } = await supabase
      .from('submissions')
      .upsert(submissionPayload, { onConflict: isEditMode.value ? 'id' : 'event_id,team_id' })

    if (dbError) {
      throw new Error(dbError.message)
    }

    // 验证提交是否真正成功 - 从数据库重新查询确认
    const { data: verifyData, error: verifyError } = await supabase
      .from('submissions')
      .select('id, project_name, created_at')
      .eq('event_id', eventId.value)
      .eq('team_id', teamId.value)
      .single()

    if (verifyError || !verifyData) {
      throw new Error('提交验证失败，请重试')
    }

    // 确认提交成功
    submitStatus.value = 'success'
    isSubmitted.value = true
    allowNavigation.value = true
    syncSavedSnapshot() // Clear dirty state by updating saved snapshot
    
    const successMessage = isEditMode.value ? '作品更新成功！' : '作品提交成功！'
    submitInfo.value = successMessage
    store.setBanner('info', successMessage)

    // 3秒后自动跳转
    setTimeout(() => {
      showSubmitModal.value = false
      if (isEditMode.value) {
        // 编辑模式跳转到作品详情页
        router.push(`/events/${eventId.value}/submissions/${originalSubmission.value.id}`)
      } else {
        // 新建模式跳转到活动页
        router.push(eventPath.value)
      }
    }, 3000)

  } catch (err: any) {
    submitStatus.value = 'error'
    submitError.value = err?.message || '提交失败'
  } finally {
    submitting.value = false
  }
}

const closeSubmitModal = () => {
  if (submitStatus.value === 'success') {
    showSubmitModal.value = false
    if (isEditMode.value) {
      router.push(`/events/${eventId.value}/submissions/${originalSubmission.value.id}`)
    } else {
      router.push(eventPath.value)
    }
  } else if (submitStatus.value === 'error') {
    showSubmitModal.value = false
  }
  // 如果是 submitting 状态，不允许关闭
}

onMounted(async () => {
  await store.refreshUser()
  await store.ensureEventsLoaded()
  
  if (isEditMode.value) {
    // 编辑模式：先加载现有作品数据
    await loadExistingSubmission()
    if (loadSubmissionError.value) {
      store.setBanner('error', loadSubmissionError.value)
      await router.replace(`/events/${eventId.value}`)
      return
    }
  }
  
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
  <main class="submission-page">
    <!-- 编辑模式加载状态 -->
    <section v-if="isLoadingSubmission" class="detail-loading">
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
    </section>

    <!-- 加载错误状态 -->
    <section v-else-if="loadSubmissionError" class="empty-state">
      <h2>无法加载作品</h2>
      <p class="muted">{{ loadSubmissionError }}</p>
      <button class="btn btn--ghost" type="button" @click="handleCancel">返回活动</button>
    </section>

    <!-- 正常内容 -->
    <template v-else>
      <section class="submission-hero">
      <div class="submission-hero__main">
        <div class="submission-hero__head-row">
          <p class="detail-eyebrow">{{ isEditMode ? '编辑作品' : '作品提交' }}</p>
          <button class="btn btn--ghost" type="button" @click="handleCancel">
            {{ isEditMode ? '返回作品详情' : '返回活动' }}
          </button>
        </div>
        <h1>{{ isEditMode ? '编辑作品' : '提交作品' }}</h1>
        <p class="detail-lead">{{ isEditMode ? '修改项目信息和文件' : '填写项目信息，上传或提供链接' }}</p>
      </div>
    </section>

    <section class="submission-section">
      <div class="submission-section__head">
        <h2>作品信息</h2>
        <p class="muted">作品名、所属队伍、封面、简介、视频链接</p>
      </div>

      <form class="submission-form" @submit.prevent="submit">
        <div class="field" ref="projectNameField" :class="{ 'field--error': fieldErrors.projectName }">
          <label>作品名 <span class="required">*</span></label>
          <input v-model="projectName" type="text" placeholder="输入作品名" />
          <p v-if="fieldErrors.projectName" class="help-text error-text">{{ fieldErrors.projectName }}</p>
        </div>

        <div class="field" ref="teamField" :class="{ 'field--error': fieldErrors.teamId }">
          <label>选择队伍 <span class="required">*</span></label>
          <div class="form-question__field">
            <select v-model="teamId">
              <option v-for="team in teamOptions" :key="team.id" :value="team.id">{{ team.name }}</option>
              <option v-if="!teamOptions.length" value="" disabled>暂无可选队伍</option>
            </select>
          </div>
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
                <span>
                  {{ coverPreview ? (hasExistingCover ? '更换封面' : '重新上传') : (coverFile?.name || '选择图片') }}
                </span>
              </div>
              <input
                class="upload-trigger__input"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                @change="(e) => pickCover((e.target as HTMLInputElement).files)"
              />
            </label>
            <p class="muted">建议 2MB 内，比例16:9，支持 JPG/PNG/WebP/GIF</p>
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
            <label class="upload-trigger" :class="{ 'has-file': submissionFile || hasExistingSubmissionFile }">
              <div class="upload-trigger__content">
                <Upload v-if="!submissionFile && !hasExistingSubmissionFile" :size="40" />
                <div v-if="submissionFile || hasExistingSubmissionFile" class="file-info">
                  <span class="file-name">
                    {{ submissionFile?.name || existingSubmissionFileName }}
                  </span>
                  <button type="button" class="reupload-btn">
                    <RotateCcw :size="16" />
                    {{ hasExistingSubmissionFile && !submissionFile ? '更换文件' : '重新上传' }}
                  </button>
                </div>
                <span v-if="!submissionFile && !hasExistingSubmissionFile">{{ '选择文件' }}</span>
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

        <div class="submission-form-actions">
          <button class="btn btn--ghost" type="button" @click="handleCancel">取消</button>
          <button class="btn btn--primary" type="submit" :disabled="submitting">
            <Loader2 v-if="submitting" class="spin" :size="16" />
            {{ submitting ? (isEditMode ? '更新中...' : '提交中...') : (isEditMode ? '更新作品' : '提交作品') }}
          </button>
        </div>
      </form>
    </section>

    <!-- 提交状态弹窗 -->
    <div v-if="showSubmitModal" class="submit-modal-overlay" @click.self="closeSubmitModal">
      <div class="submit-modal">
        <div class="submit-modal__content">
          <!-- 提交中状态 -->
          <div v-if="submitStatus === 'submitting'" class="submit-status submit-status--loading">
            <div class="submit-status__icon">
              <Loader2 class="spin" :size="48" />
            </div>
            <h3>{{ isEditMode ? '正在更新作品...' : '正在提交作品...' }}</h3>
            <p>请稍候，正在上传文件并保存到云端</p>
          </div>

          <!-- 提交成功状态 -->
          <div v-else-if="submitStatus === 'success'" class="submit-status submit-status--success">
            <div class="submit-status__icon">
              <div class="success-checkmark">
                <svg viewBox="0 0 52 52" class="checkmark">
                  <circle class="checkmark__circle" cx="26" cy="26" r="25" fill="none"/>
                  <path class="checkmark__check" fill="none" d="m14.1 27.2l7.1 7.2 16.7-16.8"/>
                </svg>
              </div>
            </div>
            <h3>{{ isEditMode ? '更新成功！' : '提交成功！' }}</h3>
            <p>{{ isEditMode ? '作品已成功更新，3秒后自动返回作品详情页面' : '作品已成功提交到云端，3秒后自动返回活动页面' }}</p>
            <button class="btn btn--primary" @click="closeSubmitModal">
              立即返回
            </button>
          </div>

          <!-- 提交失败状态 -->
          <div v-else-if="submitStatus === 'error'" class="submit-status submit-status--error">
            <div class="submit-status__icon">
              <svg :size="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
            </div>
            <h3>{{ isEditMode ? '更新失败' : '提交失败' }}</h3>
            <p v-if="submitError">{{ submitError }}</p>
            <p v-else>网络连接异常，请检查网络后重试</p>
            <div class="submit-modal__actions">
              <button class="btn btn--ghost" @click="closeSubmitModal">
                关闭
              </button>
              <button class="btn btn--primary" @click="submit">
                {{ isEditMode ? '重新更新' : '重新提交' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    </template>
  </main>
</template>

<style scoped>
/* Submission Page - Fixed Layout */
.submission-page {
  width: min(1120px, 92vw);
  margin: 0 auto;
  padding: 96px 0 40px;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.submission-hero {
  position: relative;
  padding: 32px;
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
  border-radius: 30px;
  border: 1px solid rgba(18, 33, 30, 0.12);
  background: linear-gradient(135deg, #1f6f6d2e, #e07a5f2e);
  box-shadow: var(--shadow);
  overflow: hidden;
}

.submission-hero:after {
  content: "";
  position: absolute;
  inset: 0;
  background: radial-gradient(
    circle at top right,
    rgba(255, 255, 255, 0.7),
    transparent 60%
  );
  pointer-events: none;
}

.submission-hero__main {
  position: relative;
  z-index: 1;
  display: grid;
  gap: 16px;
}

.submission-hero__head-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.submission-hero h1 {
  margin: 0;
  font-family: Sora, sans-serif;
  font-size: clamp(2.2rem, 3vw, 3rem);
  line-height: 1.1;
}

.submission-section {
  display: grid;
  gap: 24px;
}

.submission-section__head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
}

.submission-section__head h2 {
  margin: 0;
  font-family: Sora, sans-serif;
  font-size: 1.8rem;
}

.submission-form {
  display: grid;
  gap: 24px;
  width: 100%;
}

.submission-form .field {
  display: grid;
  gap: 10px;
}

.submission-form .field label {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--ink);
}

/* 提交表单的输入框样式 */
.submission-form .field input,
.submission-form .field textarea {
  font-size: 1.05rem;
  padding: 16px 18px;
  border-radius: 16px !important;
  min-height: 56px;
  border: 1px solid rgba(18, 33, 30, 0.14) !important;
  background: #ffffffeb !important;
}

.submission-form .field textarea {
  min-height: 120px;
  resize: vertical;
}

.submission-form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 16px;
  flex-wrap: wrap;
  margin-top: 20px;
  padding-top: 24px;
  border-top: 1px solid var(--border);
}

.submission-form-actions .btn {
  padding: 14px 24px;
  font-size: 1.05rem;
  min-width: 140px;
}

/* Enhanced Upload Areas */
.upload-trigger {
  min-height: 200px;
  padding: 48px 20px;
  font-size: 1.1rem;
}

.upload-trigger.has-preview {
  max-height: 500px;
}

.upload-trigger__content {
  gap: 24px;
}

.upload-trigger :deep(svg) {
  width: 2rem;
  height: 2rem;
}

/* Enhanced Mode Cards */
.submission-modes {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin: 8px 0;
}

.mode-card {
  padding: 20px;
  border-radius: 18px;
  min-height: 80px;
}

.mode-card__icon {
  width: 48px;
  height: 48px;
  border-radius: 14px;
}

.mode-card__title {
  font-size: 1.1rem;
}

/* Enhanced Input with Icon */
.input-with-icon input {
  font-size: 1.05rem;
  padding: 16px 18px;
  height: 60px;
}

.input-with-password .link-input {
  flex: 1 1 300px;
}

.input-with-password .link-password {
  flex: 0 0 160px;
  max-width: 180px;
  padding: 16px 18px;
  height: 60px;
}

/* Progress Bar */
.progress {
  height: 10px;
  margin-top: 8px;
}

/* Help Text */
.help-text {
  font-size: 1rem;
  margin-top: 4px;
}

/* Error States */
.error-text {
  font-size: 0.95rem;
  margin-top: 2px;
}

/* Alert Messages */
.alert {
  padding: 16px 20px;
  border-radius: 18px;
  font-size: 1.05rem;
  margin: 8px 0;
}

/* Required Indicator */
.required {
  color: var(--danger);
  margin-left: 6px;
  font-size: 1.1rem;
}

/* Responsive Design */
@media (max-width: 1200px) {
  .submission-page {
    width: min(1120px, 92vw);
  }
}

@media (max-width: 980px) {
  .submission-page {
    width: min(980px, 92vw);
    gap: 24px;
  }
  
  .submission-hero {
    padding: 24px;
  }
  
  .submission-hero h1 {
    font-size: clamp(1.8rem, 4vw, 2.4rem);
  }
  
  .submission-section__head h2 {
    font-size: 1.5rem;
  }
  
  .submission-form {
    gap: 20px;
  }
  
  .submission-modes {
    grid-template-columns: 1fr;
  }
  
  .input-with-password {
    flex-direction: column;
    align-items: stretch;
  }
  
  .input-with-password .link-input,
  .input-with-password .link-password {
    flex: 1;
    max-width: none;
  }
}

@media (max-width: 640px) {
  .submission-page {
    width: min(100%, 92vw);
    padding: 120px 0 40px;
  }
  
  .submission-hero__head-row {
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
  }
  
  .submission-form-actions {
    flex-direction: column;
    align-items: stretch;
  }
  
  .submission-form-actions .btn {
    width: 100%;
    min-width: auto;
  }
}

/* Submit Modal Styles */
.submit-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.submit-modal {
  background: var(--surface-strong);
  border-radius: 24px;
  box-shadow: var(--shadow);
  border: 1px solid var(--border);
  max-width: 480px;
  width: min(480px, 90vw);
  max-height: 90vh;
  overflow: hidden;
}

.submit-modal__content {
  padding: 40px 32px;
}

.submit-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 20px;
}

.submit-status__icon {
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  margin-bottom: 8px;
}

.submit-status--loading .submit-status__icon {
  background: var(--accent-soft);
  color: var(--accent);
}

.submit-status--success .submit-status__icon {
  background: transparent;
  color: #22c55e;
}

.submit-status--error .submit-status__icon {
  background: rgba(239, 68, 68, 0.12);
  color: var(--danger);
}

.submit-status h3 {
  margin: 0;
  font-family: Sora, sans-serif;
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--ink);
}

.submit-status p {
  margin: 0;
  color: var(--muted);
  font-size: 1rem;
  line-height: 1.5;
}

.submit-modal__actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-top: 24px;
}

.submit-modal__actions .btn {
  min-width: 120px;
}

/* Success Checkmark Animation */
.success-checkmark {
  width: 56px;
  height: 56px;
  position: relative;
}

.checkmark {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  display: block;
  stroke-width: 3;
  stroke: #22c55e;
  stroke-miterlimit: 10;
  background: #22c55e;
  animation: fill 0.4s ease-in-out 0.4s forwards, scale 0.3s ease-in-out 0.9s both;
}

.checkmark__circle {
  stroke-dasharray: 166;
  stroke-dashoffset: 166;
  stroke-width: 3;
  stroke-miterlimit: 10;
  stroke: #22c55e;
  fill: #22c55e;
  animation: stroke 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards;
}

.checkmark__check {
  transform-origin: 50% 50%;
  stroke-dasharray: 48;
  stroke-dashoffset: 48;
  stroke: #ffffff;
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
  animation: stroke 0.3s cubic-bezier(0.65, 0, 0.45, 1) 0.8s forwards;
}

@keyframes stroke {
  100% {
    stroke-dashoffset: 0;
  }
}

@keyframes scale {
  0%, 100% {
    transform: none;
  }
  50% {
    transform: scale3d(1.1, 1.1, 1);
  }
}

@keyframes fill {
  100% {
    box-shadow: inset 0px 0px 0px 30px #22c55e;
  }
}

/* Spin Animation for Loading */
.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Legacy styles for compatibility */
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
  align-self: center;
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