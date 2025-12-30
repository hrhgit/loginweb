/**
 * 文本处理工具函数
 */

/**
 * 截断文本到指定长度，如果超出则添加省略号
 * @param text 要截断的文本
 * @param maxLength 最大长度
 * @param suffix 超出时添加的后缀，默认为 '...'
 * @returns 截断后的文本
 */
export function truncateText(text: string | null | undefined, maxLength: number, suffix = '...'): string {
  if (!text) return ''
  
  const trimmedText = text.trim()
  if (trimmedText.length <= maxLength) {
    return trimmedText
  }
  
  return trimmedText.slice(0, maxLength) + suffix
}

/**
 * 截断队伍简介文本（最多50字）
 * @param intro 队伍简介
 * @returns 截断后的简介
 */
export function truncateTeamIntro(intro: string | null | undefined): string {
  return truncateText(intro, 50)
}

/**
 * 截断个人求组队简介文本（最多100字）
 * @param intro 个人简介
 * @returns 截断后的简介
 */
export function truncateSeekerIntro(intro: string | null | undefined): string {
  return truncateText(intro, 100)
}