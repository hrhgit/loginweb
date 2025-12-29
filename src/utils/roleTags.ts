const ROLE_MAP: Record<string, string> = {
  '策划': 'planner',
  '程序': 'programmer',
  '美术': 'artist',
  '音乐音效': 'audio',
}

const normalizeRoleLabel = (label: string) => {
  const trimmed = label.trim()
  if (trimmed.startsWith('缺')) {
    return trimmed.slice(1).trim()
  }
  return trimmed
}

export const getRoleTagKey = (label: string) => {
  const normalized = normalizeRoleLabel(label)
  return ROLE_MAP[normalized] ?? ''
}

export const getRoleTagClass = (label: string) => {
  const key = getRoleTagKey(label)
  if (!key) return ''
  return `role-tag role-tag--${key}`
}

const ROLE_ORDER: Record<string, number> = {
  planner: 0,
  programmer: 1,
  artist: 2,
  audio: 3,
}

export const sortRoleLabels = (labels: string[]) => {
  return [...labels].sort((a, b) => {
    const aKey = getRoleTagKey(a) || a
    const bKey = getRoleTagKey(b) || b
    const aOrder = ROLE_ORDER[aKey] ?? 99
    const bOrder = ROLE_ORDER[bKey] ?? 99
    if (aOrder !== bOrder) return aOrder - bOrder
    return a.localeCompare(b)
  })
}
