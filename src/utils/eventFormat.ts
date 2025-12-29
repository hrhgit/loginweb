import type { EventStatus } from '../store/models'

export const formatDateTime = (iso: string | null) => {
  if (!iso) return '时间待定'
  const date = new Date(iso)
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export const formatDateOnly = (iso: string | null) => {
  if (!iso) return '时间待定'
  const date = new Date(iso)
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export const formatDateRange = (start: string | null, end: string | null) => {
  const startLabel = formatDateOnly(start)
  if (!end) return startLabel
  const endLabel = formatDateOnly(end)
  return `${startLabel} - ${endLabel}`
}

export const formatTimeRange = (start: string | null, end: string | null) => {
  const startLabel = formatDateTime(start)
  if (!end) return startLabel
  const endLabel = formatDateTime(end)
  return `${startLabel} - ${endLabel}`
}

export const statusLabel = (status: EventStatus | null) => {
  if (!status) return ''
  switch (status) {
    case 'draft':
      return '草稿'
    case 'published':
      return '进行中'
    case 'ended':
      return '已结束'
    default:
      return '未知状态'
  }
}

export const statusClass = (status: EventStatus | null) => {
  if (!status) return ''
  switch (status) {
    case 'draft':
      return 'pill-badge--draft'
    case 'published':
      return 'pill-badge--published'
    case 'ended':
      return 'pill-badge--ended'
    default:
      return ''
  }
}

export const teamSizeLabel = (max: number | null) => {
  if (!max) return '不限'
  return `${max} 人`
}

export const locationLabel = (location: string | null) => {
  if (!location) return '地点待定'
  const trimmed = location.trim()
  return trimmed ? trimmed : '地点待定'
}
