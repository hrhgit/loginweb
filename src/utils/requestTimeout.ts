export const DEFAULT_REQUEST_TIMEOUT_MS = 30000
export const DEFAULT_TIMEOUT_MESSAGE = 'Request timeout. Please refresh the page.'

export type TimeoutOptions = {
  timeoutMs?: number
  timeoutMessage?: string
}

export function createTimeoutError(
  message: string = DEFAULT_TIMEOUT_MESSAGE,
  timeoutMs?: number
): Error {
  const error = new Error(message)
  ;(error as { name?: string }).name = 'TimeoutError'
  ;(error as { code?: string }).code = 'TIMEOUT'
  if (typeof timeoutMs === 'number') {
    ;(error as { timeoutMs?: number }).timeoutMs = timeoutMs
  }
  return error
}

export async function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number = DEFAULT_REQUEST_TIMEOUT_MS,
  timeoutMessage: string = DEFAULT_TIMEOUT_MESSAGE
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(createTimeoutError(timeoutMessage, timeoutMs))
    }, timeoutMs)
  })

  try {
    return await Promise.race([operation(), timeoutPromise])
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  }
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: (RequestInit & TimeoutOptions) = {}
): Promise<Response> {
  const { timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS, timeoutMessage = DEFAULT_TIMEOUT_MESSAGE, ...rest } = init
  const controller = new AbortController()
  const originalSignal = rest.signal

  if (originalSignal) {
    if (originalSignal.aborted) {
      controller.abort()
    } else {
      originalSignal.addEventListener('abort', () => controller.abort(), { once: true })
    }
  }

  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(input, { ...rest, signal: controller.signal })
  } catch (error: any) {
    if (controller.signal.aborted) {
      throw createTimeoutError(timeoutMessage, timeoutMs)
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}
