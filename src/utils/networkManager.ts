/**
 * Network Management Infrastructure
 * 
 * Core network management system providing connection monitoring,
 * request queuing, retry logic, and network resilience features.
 */

import { ref, type Ref } from 'vue'
import { registerNetworkCleanup, trackNetworkOperation, completeNetworkOperation, type NetworkMemoryStats } from './memoryManager'
import { backgroundProcessor } from './backgroundProcessor'
import { updateBatcher } from './updateBatcher'
import { fetchWithTimeout } from './requestTimeout'
import { TIMEOUT_REFRESH_MESSAGE } from './errorHandler'

// Network State Types
export interface NetworkState {
  isOnline: boolean
  connectionType: 'wifi' | 'cellular' | 'ethernet' | 'unknown'
  effectiveType: 'slow-2g' | '2g' | '3g' | '4g' | 'unknown'
  downlink: number // Mbps
  rtt: number // milliseconds
  saveData: boolean
}

export interface NetworkRequest {
  id: string
  url: string
  method: string
  data?: any
  priority: 'high' | 'medium' | 'low'
  retryCount: number
  maxRetries: number
  timestamp: number
  resolve?: (value: any) => void
  reject?: (error: any) => void
}

export interface NetworkError {
  type: 'connection_lost' | 'timeout' | 'server_error' | 'rate_limited' | 'offline'
  message: string
  retryable: boolean
  retryAfter?: number
  originalRequest: NetworkRequest
}

export interface RetryConfig {
  maxRetries: number
  baseDelay: number
  maxDelay: number
  backoffMultiplier: number
}

/**
 * Connection Monitor - Tracks network connectivity and quality
 */
export class ConnectionMonitor {
  private networkState: Ref<NetworkState>
  private listeners: Set<(state: NetworkState) => void> = new Set()

  constructor() {
    this.networkState = ref<NetworkState>({
      isOnline: navigator.onLine,
      connectionType: 'unknown',
      effectiveType: 'unknown',
      downlink: 0,
      rtt: 0,
      saveData: false
    })

    this.initializeNetworkAPI()
    this.setupEventListeners()
  }

  get state(): NetworkState {
    return this.networkState.value
  }

  get isOnline(): boolean {
    return this.networkState.value.isOnline
  }

  get connectionQuality(): 'fast' | 'slow' | 'offline' {
    if (!this.networkState.value.isOnline) return 'offline'
    
    const effectiveType = this.networkState.value.effectiveType
    if (effectiveType === '4g' || effectiveType === 'unknown') return 'fast'
    if (effectiveType === '3g') return 'fast'
    return 'slow' // 2g, slow-2g
  }

  addListener(callback: (state: NetworkState) => void): () => void {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  removeAllListeners(): void {
    this.listeners.clear()
  }

  getListenerCount(): number {
    return this.listeners.size
  }

  private initializeNetworkAPI(): void {
    // Initialize Network Information API if available
    const connection = (navigator as any).connection || 
                      (navigator as any).mozConnection || 
                      (navigator as any).webkitConnection

    if (connection) {
      this.updateNetworkInfo(connection)
      
      // Listen for connection changes
      connection.addEventListener('change', () => {
        this.updateNetworkInfo(connection)
      })
    }
  }

  private updateNetworkInfo(connection: any): void {
    this.networkState.value = {
      ...this.networkState.value,
      connectionType: connection.type || 'unknown',
      effectiveType: connection.effectiveType || 'unknown',
      downlink: connection.downlink || 0,
      rtt: connection.rtt || 0,
      saveData: connection.saveData || false
    }
    
    this.notifyListeners()
  }

  private setupEventListeners(): void {
    // Online/offline events
    window.addEventListener('online', () => {
      this.networkState.value.isOnline = true
      this.notifyListeners()
    })

    window.addEventListener('offline', () => {
      this.networkState.value.isOnline = false
      this.notifyListeners()
    })
  }

  private notifyListeners(): void {
    this.listeners.forEach(callback => {
      try {
        callback(this.networkState.value)
      } catch (error) {
        console.error('Error in network state listener:', error)
      }
    })
  }
}

/**
 * Request Queue - Manages network requests with priority and retry logic
 */
export class RequestQueue {
  private queue: NetworkRequest[] = []
  private processing = false
  private retryConfig: RetryConfig

  constructor(retryConfig?: Partial<RetryConfig>) {
    this.retryConfig = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      ...retryConfig
    }
  }

  add(request: Omit<NetworkRequest, 'id' | 'timestamp'>): Promise<any> {
    return new Promise((resolve, reject) => {
      const queuedRequest: NetworkRequest = {
        ...request,
        id: this.generateRequestId(),
        timestamp: Date.now(),
        resolve,
        reject
      }

      // Insert based on priority
      this.insertByPriority(queuedRequest)
      
      // Start processing if not already running
      if (!this.processing) {
        this.processQueue()
      }
    })
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private insertByPriority(request: NetworkRequest): void {
    const priorityOrder = { high: 0, medium: 1, low: 2 }
    const requestPriority = priorityOrder[request.priority]

    let insertIndex = this.queue.length
    for (let i = 0; i < this.queue.length; i++) {
      const queuePriority = priorityOrder[this.queue[i].priority]
      if (requestPriority < queuePriority) {
        insertIndex = i
        break
      }
    }

    this.queue.splice(insertIndex, 0, request)
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) return

    this.processing = true

    while (this.queue.length > 0) {
      const request = this.queue.shift()!
      
      try {
        const result = await this.executeRequest(request)
        request.resolve?.(result)
      } catch (error) {
        if (this.shouldRetry(request, error)) {
          await this.retryRequest(request, error)
        } else {
          request.reject?.(error)
        }
      }
    }

    this.processing = false
  }

  private async executeRequest(request: NetworkRequest): Promise<any> {
    try {
      const response = await fetchWithTimeout(request.url, {
        method: request.method,
        headers: {
          'Content-Type': 'application/json',
          ...request.data?.headers
        },
        body: request.data ? JSON.stringify(request.data) : undefined,
        timeoutMs: 10000,
        timeoutMessage: TIMEOUT_REFRESH_MESSAGE
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      throw error
    }
  }

  private shouldRetry(request: NetworkRequest, error: any): boolean {
    if (request.retryCount >= request.maxRetries) return false

    // Don't retry client errors (4xx)
    if (error.message?.includes('HTTP 4')) return false

    // Retry network errors, timeouts, and server errors
    return true
  }

  private async retryRequest(request: NetworkRequest, _error: any): Promise<void> {
    request.retryCount++
    
    const delay = Math.min(
      this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffMultiplier, request.retryCount - 1),
      this.retryConfig.maxDelay
    )

    // Add jitter to prevent thundering herd
    const jitteredDelay = delay + Math.random() * 1000

    await new Promise(resolve => setTimeout(resolve, jitteredDelay))

    // Re-add to queue for retry
    this.insertByPriority(request)
  }

  getQueueStatus(): { pending: number; processing: boolean } {
    return {
      pending: this.queue.length,
      processing: this.processing
    }
  }

  clear(): void {
    // Reject all pending requests
    this.queue.forEach(request => {
      request.reject?.(new Error('Request queue cleared'))
    })
    this.queue = []
  }
}

/**
 * Network Manager - Main coordinator for network operations
 */
export class NetworkManager {
  private connectionMonitor: ConnectionMonitor
  private requestQueue: RequestQueue
  private failedRequests: NetworkRequest[] = []

  constructor(retryConfig?: Partial<RetryConfig>) {
    this.connectionMonitor = new ConnectionMonitor()
    this.requestQueue = new RequestQueue(retryConfig)

    // Listen for connectivity changes
    this.connectionMonitor.addListener((state) => {
      if (state.isOnline) {
        this.retryFailedRequests()
      }
    })

    // Register memory cleanup callbacks
    this.registerMemoryCleanup()
  }

  private registerMemoryCleanup(): void {
    registerNetworkCleanup({
      clearRequestQueue: () => this.requestQueue.clear(),
      clearFailedRequests: () => { this.failedRequests = [] },
      removeNetworkListeners: () => this.connectionMonitor.removeAllListeners(),
      getNetworkStats: (): NetworkMemoryStats => ({
        activeListeners: this.connectionMonitor.getListenerCount(),
        queuedRequests: this.requestQueue.getQueueStatus().pending,
        cacheEntries: 0, // Will be set by cache manager
        cacheSize: 0, // Will be set by cache manager
        failedRequests: this.failedRequests.length
      }),
      clearBackgroundTasks: () => backgroundProcessor.cleanup(),
      clearUpdateBatches: () => updateBatcher.cleanup()
    })
  }

  get isOnline(): boolean {
    return this.connectionMonitor.isOnline
  }

  get connectionQuality(): 'fast' | 'slow' | 'offline' {
    return this.connectionMonitor.connectionQuality
  }

  get networkState(): NetworkState {
    return this.connectionMonitor.state
  }

  async executeRequest<T>(request: Omit<NetworkRequest, 'id' | 'timestamp' | 'retryCount'>): Promise<T> {
    if (!this.isOnline) {
      throw this.createNetworkError('offline', 'No network connection available', request as NetworkRequest)
    }

    const requestWithDefaults = {
      ...request,
      retryCount: 0,
      maxRetries: request.maxRetries || 3
    }

    const operationId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    trackNetworkOperation(operationId, `${request.method || 'GET'} ${request.url}`)

    try {
      const result = await this.requestQueue.add(requestWithDefaults)
      completeNetworkOperation(operationId)
      return result
    } catch (error) {
      completeNetworkOperation(operationId)
      // Store failed request for later retry
      this.failedRequests.push(requestWithDefaults as NetworkRequest)
      throw error
    }
  }

  async retryFailedRequests(): Promise<void> {
    if (!this.isOnline || this.failedRequests.length === 0) return

    const requestsToRetry = [...this.failedRequests]
    this.failedRequests = []

    for (const request of requestsToRetry) {
      try {
        // Reset retry count for manual retry
        request.retryCount = 0
        await this.requestQueue.add(request)
      } catch (error) {
        // If still failing, put back in failed requests
        this.failedRequests.push(request)
      }
    }
  }

  queueRequest(request: Omit<NetworkRequest, 'id' | 'timestamp' | 'retryCount'>): void {
    const requestWithDefaults = {
      ...request,
      retryCount: 0,
      maxRetries: request.maxRetries || 3
    }

    this.requestQueue.add(requestWithDefaults).catch(_error => {
      this.failedRequests.push(requestWithDefaults as NetworkRequest)
    })
  }

  async processQueue(): Promise<void> {
    // Queue processing is automatic, this method is for manual triggering
    return Promise.resolve()
  }

  addNetworkStateListener(callback: (state: NetworkState) => void): () => void {
    return this.connectionMonitor.addListener(callback)
  }

  getStatus(): {
    isOnline: boolean
    connectionQuality: 'fast' | 'slow' | 'offline'
    queueStatus: { pending: number; processing: boolean }
    failedRequests: number
  } {
    return {
      isOnline: this.isOnline,
      connectionQuality: this.connectionQuality,
      queueStatus: this.requestQueue.getQueueStatus(),
      failedRequests: this.failedRequests.length
    }
  }

  private createNetworkError(
    type: NetworkError['type'],
    message: string,
    originalRequest: NetworkRequest
  ): NetworkError {
    return {
      type,
      message,
      retryable: type !== 'offline',
      originalRequest
    }
  }

  /**
   * Process heavy network operations in background
   */
  async processHeavyNetworkTask(taskType: string, data: any): Promise<any> {
    return backgroundProcessor.processHeavyTask(`network_${taskType}`, data, 'high')
  }

  /**
   * Add batched network state update
   */
  addNetworkStateUpdate(update: Partial<NetworkState>): void {
    updateBatcher.addUpdate('network-state', update)
  }

  dispose(): void {
    this.requestQueue.clear()
    this.failedRequests = []
    backgroundProcessor.cleanup()
  }
}

// Create singleton instance
export const networkManager = new NetworkManager()

// Convenience functions
export function isOnline(): boolean {
  return networkManager.isOnline
}

export function getConnectionQuality(): 'fast' | 'slow' | 'offline' {
  return networkManager.connectionQuality
}

export function getNetworkState(): NetworkState {
  return networkManager.networkState
}

export function executeNetworkRequest<T>(
  url: string,
  options: {
    method?: string
    data?: any
    priority?: 'high' | 'medium' | 'low'
    maxRetries?: number
  } = {}
): Promise<T> {
  return networkManager.executeRequest({
    url,
    method: options.method || 'GET',
    data: options.data,
    priority: options.priority || 'medium',
    maxRetries: options.maxRetries || 3
  })
}

export function addNetworkStateListener(callback: (state: NetworkState) => void): () => void {
  return networkManager.addNetworkStateListener(callback)
}

export function processHeavyNetworkTask(taskType: string, data: any): Promise<any> {
  return networkManager.processHeavyNetworkTask(taskType, data)
}

export function addNetworkStateUpdate(update: Partial<NetworkState>): void {
  return networkManager.addNetworkStateUpdate(update)
}
