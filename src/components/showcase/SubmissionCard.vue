<template>
  <article class="submission-card" @click="handleClick" @dblclick="handleDoubleClick">
    <!-- 作品封面 -->
    <div class="submission-card__cover">
      <img 
        v-if="coverUrl"
        :src="coverUrl" 
        :alt="submission.project_name"
        class="submission-card__image"
        @error="handleImageError"
      />
      <div v-else class="submission-card__placeholder">
        <FileText class="submission-card__placeholder-icon" />
      </div>
    </div>

    <!-- 作品信息 -->
    <div class="submission-card__content">
      <h3 class="submission-card__title" @click.stop="handleTitleClick">{{ submission.project_name }}</h3>
      <p class="submission-card__team">{{ teamName }}</p>
      
      <!-- 作品简介 -->
      <p v-if="submission.intro" class="submission-card__intro">
        {{ truncatedIntro }}
      </p>
      
      <!-- 提交时间 -->
      <div class="submission-card__meta">
        <time class="submission-card__time">
          {{ formatSubmissionTime }}
        </time>
        <slot name="actions"></slot>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { FileText } from 'lucide-vue-next'
import { supabase } from '../../lib/supabase'
import type { SubmissionWithTeam } from '../../store/models'

interface Props {
  submission: SubmissionWithTeam
}

const props = defineProps<Props>()
const emit = defineEmits<{
  click: [submission: SubmissionWithTeam]
  'double-click': [submission: SubmissionWithTeam]
  'title-click': [submission: SubmissionWithTeam]
}>()

// 计算属性
const coverUrl = computed(() => {
  if (!props.submission.cover_path) return null
  
  try {
    const coverPath = props.submission.cover_path.trim()
    
    // 如果已经是完整的URL（向后兼容旧数据）
    if (coverPath.startsWith('http')) {
      return coverPath
    }
    
    // 如果是存储路径，生成公共URL
    if (coverPath.includes('/')) {
      const { data } = supabase.storage
        .from('public-assets')
        .getPublicUrl(coverPath)
      return data.publicUrl
    }
    
    return null
  } catch {
    return null
  }
})

const teamName = computed(() => {
  return props.submission.team?.name || '未知队伍'
})

const truncatedIntro = computed(() => {
  const intro = props.submission.intro
  if (!intro) return ''
  if (intro.length <= 80) return intro
  return intro.slice(0, 80) + '...'
})

const formatSubmissionTime = computed(() => {
  const date = new Date(props.submission.created_at)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    if (diffHours === 0) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60))
      return diffMinutes <= 1 ? '刚刚' : `${diffMinutes}分钟前`
    }
    return `${diffHours}小时前`
  } else if (diffDays === 1) {
    return '昨天'
  } else if (diffDays < 7) {
    return `${diffDays}天前`
  } else {
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric'
    })
  }
})

// 方法
const handleClick = () => {
  emit('click', props.submission)
}

const handleDoubleClick = () => {
  emit('double-click', props.submission)
}

const handleTitleClick = () => {
  emit('title-click', props.submission)
}

const handleImageError = (event: Event) => {
  const img = event.target as HTMLImageElement
  img.style.display = 'none'
}
</script>

<style scoped>
.submission-card {
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border-radius: 16px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.18s ease;
  border: 1px solid var(--border);
}

.submission-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow);
  border-color: var(--accent-soft);
}

.submission-card__cover {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  background: var(--surface-muted);
  overflow: hidden;
}

.submission-card__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.18s ease;
}

.submission-card:hover .submission-card__image {
  transform: scale(1.02);
}

.submission-card__placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, var(--surface-muted), var(--surface));
}

.submission-card__placeholder-icon {
  width: 2.5rem;
  height: 2.5rem;
  color: var(--muted);
  opacity: 0.6;
}

.submission-card__content {
  padding: 1rem;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.submission-card__title {
  font-family: 'Sora', sans-serif;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--ink);
  margin: 0 0 0.25rem 0;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  cursor: pointer;
  transition: color 0.18s ease;
}

.submission-card__title:hover {
  color: var(--accent);
}

.submission-card__team {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--accent);
  margin: 0 0 0.75rem 0;
}

.submission-card__intro {
  font-size: 0.875rem;
  color: var(--muted);
  line-height: 1.4;
  margin: 0 0 1rem 0;
  flex: 1;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.submission-card__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: auto;
  gap: 0.5rem;
}

.submission-card__time {
  font-size: 0.75rem;
  color: var(--muted);
  font-weight: 500;
}

/* 响应式设计 */
@media (max-width: 640px) {
  .submission-card__content {
    padding: 0.875rem;
  }
  
  .submission-card__title {
    font-size: 1rem;
  }
}

/* 无障碍支持 */
@media (prefers-reduced-motion: reduce) {
  .submission-card {
    transition: none;
  }
  
  .submission-card:hover {
    transform: none;
  }
  
  .submission-card__image {
    transition: none;
  }
  
  .submission-card:hover .submission-card__image {
    transform: none;
  }
}

/* 高对比度模式 */
@media (prefers-contrast: high) {
  .submission-card {
    border-width: 2px;
  }
  
  .submission-card__type {
    border-width: 2px;
  }
}
</style>