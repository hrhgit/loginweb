/**
 * Graceful Degradation and Error Recovery System
 * 
 * Implements circuit breaker patterns, feature degradation based on network quality,
 * automatic quality adjustment, and comprehensive error recovery strategies.
 */

import { ref, type Ref } from 'vue'
import { networkManager, type NetworkState } from './networkManager'
import { errorHandler } from './errorHandler'

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface CircuitBreakerConfig {
  failureThreshold: number
  recoveryTimeout: number
  monitoringPeriod: number
  halfOpenMaxCalls: number
}

export interface FeatureDegradationConfig {
  enableImageOptimization: boolean
  enableRealTimeUpdates: boolean
  enableBackgroundSync: boolean
  enableAdvancedUI: boolean
  maxConcurrentRequests: number
  requestTimeout: number
}

export interface QualityProfile {
  name: string
  networkThreshold: {
    minDownlink: number // Mbps
    maxRtt: number // milliseconds
  }
  features: FeatureDegradationConfig
}

export interface EndpointHealth {
  url: string
  successCount: number
  failureCount: number
  lastFailure?: Date
  lastSuccess?: Date
  averageResponseTime: number
  isHealthy: boolean
}

export interface RecoveryStrategy {
  type: 'retry' | 'fallback' | 'cache' | 'degrade'
  maxAttempts: number
  backoffMultiplier: number
  fallbackAction?: () => Promise<any>
  cacheKey?: string
}

export const CircuitState = {
  CLOSED: 'closed',
  OPEN: 'open',
  HALF_OPEN: 'half_open'
} as const

export type CircuitState = typeof CircuitState[keyof typeof CircuitState]

export interface CircuitBreaker {
  state: CircuitState
  failureCount: number
  lastFailureTime?: Date
  nextAttemptTime?: Date
  halfOpenCallCount: number
}

// ============================================================================
// Circuit Breaker Implementation
// ============================================================================

export class CircuitBreakerManager {
  private circuits: Map<string, CircuitBreaker> = new Map()
  private config: CircuitBreakerConfig
  private endpointHealth: Map<string, EndpointHealth> = new Map()

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.config = {
      failureThreshold: 5,
      recoveryTimeout: 60000, // 1 minute
      monitoringPeriod: 300000, // 5 minutes
      halfOpenMaxCalls: 3,
      ...config
    }

    // Clean up old health data periodically
    setInterval(() => this.cleanupHealthData(), this.config.monitoringPeriod)
  }

  /**
   * Execute request through circuit breaker
   */
  async executeWithCircuitBreaker<T>(
    endpoint: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const circuit = this.getOrCreateCircuit(endpoint)
    
    // Check if circuit is open
    if (circuit.state === CircuitState.OPEN) {
      if (this.shouldAttemptRecovery(circuit)) {
        circuit.state = CircuitState.HALF_OPEN
        circuit.halfOpenCallCount = 0
      } else {
        throw new Error(`Circuit breaker is OPEN for endpoint: ${endpoint}`)
      }
    }

    // Check half-open state limits
    if (circuit.state === CircuitState.HALF_OPEN) {
      if (circuit.halfOpenCallCount >= this.config.halfOpenMaxCalls) {
        throw new Error(`Circuit breaker HALF_OPEN limit exceeded for endpoint: ${endpoint}`)
      }
      circuit.halfOpenCallCount++
    }

    const startTime = Date.now()
    
    try {
      const result = await operation()
      
      // Record success
      this.recordSuccess(endpoint, Date.now() - startTime)
      
      // Reset circuit on success
      if (circuit.state === CircuitState.HALF_OPEN) {
        circuit.state = CircuitState.CLOSED
        circuit.failureCount = 0
        circuit.halfOpenCallCount = 0
      }
      
      return result
    } catch (error) {
      // Record failure
      this.recordFailure(endpoint, error)
      
      // Update circuit state
      circuit.failureCount++
      circuit.lastFailureTime = new Date()
      
      if (circuit.failureCount >= this.config.failureThreshold) {
        circuit.state = CircuitState.OPEN
        circuit.nextAttemptTime = new Date(Date.now() + this.config.recoveryTimeout)
      }
      
      throw error
    }
  }

  /**
   * Get circuit breaker status for endpoint
   */
  getCircuitStatus(endpoint: string): {
    state: CircuitState
    failureCount: number
    isHealthy: boolean
    lastFailure?: Date
  } {
    const circuit = this.circuits.get(endpoint)
    const health = this.endpointHealth.get(endpoint)
    
    return {
      state: circuit?.state || CircuitState.CLOSED,
      failureCount: circuit?.failureCount || 0,
      isHealthy: health?.isHealthy ?? true,
      lastFailure: circuit?.lastFailureTime
    }
  }

  /**
   * Get all endpoint health metrics
   */
  getHealthMetrics(): Record<string, EndpointHealth> {
    const metrics: Record<string, EndpointHealth> = {}
    for (const [url, health] of this.endpointHealth.entries()) {
      metrics[url] = { ...health }
    }
    return metrics
  }

  /**
   * Reset circuit breaker for endpoint
   */
  resetCircuit(endpoint: string): void {
    const circuit = this.circuits.get(endpoint)
    if (circuit) {
      circuit.state = CircuitState.CLOSED
      circuit.failureCount = 0
      circuit.halfOpenCallCount = 0
      circuit.lastFailureTime = undefined
      circuit.nextAttemptTime = undefined
    }
  }

  private getOrCreateCircuit(endpoint: string): CircuitBreaker {
    if (!this.circuits.has(endpoint)) {
      this.circuits.set(endpoint, {
        state: CircuitState.CLOSED,
        failureCount: 0,
        halfOpenCallCount: 0
      })
    }
    return this.circuits.get(endpoint)!
  }

  private shouldAttemptRecovery(circuit: CircuitBreaker): boolean {
    if (!circuit.nextAttemptTime) return true
    return Date.now() >= circuit.nextAttemptTime.getTime()
  }

  private recordSuccess(endpoint: string, responseTime: number): void {
    const health = this.getOrCreateEndpointHealth(endpoint)
    health.successCount++
    health.lastSuccess = new Date()
    health.averageResponseTime = this.updateAverageResponseTime(health.averageResponseTime, responseTime, health.successCount)
    health.isHealthy = this.calculateHealthStatus(health)
  }

  private recordFailure(endpoint: string, error: any): void {
    const health = this.getOrCreateEndpointHealth(endpoint)
    health.failureCount++
    health.lastFailure = new Date()
    health.isHealthy = this.calculateHealthStatus(health)
    
    // Log failure for monitoring
    errorHandler.handleError(error, {
      operation: 'circuit_breaker_failure',
      component: 'graceful_degradation',
      additionalData: { endpoint, health }
    })
  }

  private getOrCreateEndpointHealth(endpoint: string): EndpointHealth {
    if (!this.endpointHealth.has(endpoint)) {
      this.endpointHealth.set(endpoint, {
        url: endpoint,
        successCount: 0,
        failureCount: 0,
        averageResponseTime: 0,
        isHealthy: true
      })
    }
    return this.endpointHealth.get(endpoint)!
  }

  private updateAverageResponseTime(currentAverage: number, newTime: number, totalCount: number): number {
    return ((currentAverage * (totalCount - 1)) + newTime) / totalCount
  }

  private calculateHealthStatus(health: EndpointHealth): boolean {
    const totalRequests = health.successCount + health.failureCount
    if (totalRequests === 0) return true
    
    const successRate = health.successCount / totalRequests
    return successRate >= 0.8 // 80% success rate threshold
  }

  private cleanupHealthData(): void {
    const cutoffTime = Date.now() - this.config.monitoringPeriod
    
    for (const [endpoint, health] of this.endpointHealth.entries()) {
      const lastActivity = Math.max(
        health.lastSuccess?.getTime() || 0,
        health.lastFailure?.getTime() || 0
      )
      
      if (lastActivity < cutoffTime) {
        this.endpointHealth.delete(endpoint)
        this.circuits.delete(endpoint)
      }
    }
  }
}

// ============================================================================
// Feature Degradation Manager
// ============================================================================

export class FeatureDegradationManager {
  private currentProfile: Ref<QualityProfile>
  private profiles: QualityProfile[]
  private networkStateListener?: () => void

  constructor() {
    this.profiles = this.createQualityProfiles()
    this.currentProfile = ref(this.profiles[0]) // Start with high quality
    
    this.setupNetworkMonitoring()
  }

  /**
   * Get current feature configuration
   */
  get features(): FeatureDegradationConfig {
    return this.currentProfile.value.features
  }

  /**
   * Get current quality profile name
   */
  get profileName(): string {
    return this.currentProfile.value.name
  }

  /**
   * Check if specific feature is enabled
   */
  isFeatureEnabled(feature: keyof FeatureDegradationConfig): boolean {
    return this.currentProfile.value.features[feature] as boolean
  }

  /**
   * Get maximum concurrent requests allowed
   */
  getMaxConcurrentRequests(): number {
    return this.currentProfile.value.features.maxConcurrentRequests
  }

  /**
   * Get request timeout for current profile
   */
  getRequestTimeout(): number {
    return this.currentProfile.value.features.requestTimeout
  }

  /**
   * Manually set quality profile
   */
  setQualityProfile(profileName: string): void {
    const profile = this.profiles.find(p => p.name === profileName)
    if (profile) {
      this.currentProfile.value = profile
      console.log(`Quality profile changed to: ${profileName}`)
    }
  }

  /**
   * Get all available quality profiles
   */
  getAvailableProfiles(): QualityProfile[] {
    return [...this.profiles]
  }

  /**
   * Get degradation recommendations based on current conditions
   */
  getDegradationRecommendations(): string[] {
    const recommendations: string[] = []
    const networkState = networkManager.networkState
    
    if (networkState.effectiveType === 'slow-2g' || networkState.effectiveType === '2g') {
      recommendations.push('禁用实时更新以节省带宽')
      recommendations.push('使用低质量图片')
      recommendations.push('禁用背景同步')
    }
    
    if (networkState.downlink < 1) {
      recommendations.push('减少并发请求数量')
      recommendations.push('增加请求超时时间')
    }
    
    if (networkState.rtt > 1000) {
      recommendations.push('禁用高级UI动画')
      recommendations.push('使用缓存优先策略')
    }
    
    return recommendations
  }

  private createQualityProfiles(): QualityProfile[] {
    return [
      {
        name: 'high',
        networkThreshold: {
          minDownlink: 5, // 5 Mbps
          maxRtt: 100 // 100ms
        },
        features: {
          enableImageOptimization: true,
          enableRealTimeUpdates: true,
          enableBackgroundSync: true,
          enableAdvancedUI: true,
          maxConcurrentRequests: 10,
          requestTimeout: 30000
        }
      },
      {
        name: 'medium',
        networkThreshold: {
          minDownlink: 1, // 1 Mbps
          maxRtt: 500 // 500ms
        },
        features: {
          enableImageOptimization: true,
          enableRealTimeUpdates: true,
          enableBackgroundSync: false,
          enableAdvancedUI: false,
          maxConcurrentRequests: 5,
          requestTimeout: 45000
        }
      },
      {
        name: 'low',
        networkThreshold: {
          minDownlink: 0.1, // 100 Kbps
          maxRtt: 2000 // 2s
        },
        features: {
          enableImageOptimization: false,
          enableRealTimeUpdates: false,
          enableBackgroundSync: false,
          enableAdvancedUI: false,
          maxConcurrentRequests: 2,
          requestTimeout: 60000
        }
      }
    ]
  }

  private setupNetworkMonitoring(): void {
    this.networkStateListener = networkManager.addNetworkStateListener((state) => {
      this.adjustQualityBasedOnNetwork(state)
    })
  }

  /**
   * Manually adjust quality profile based on network state (for testing)
   */
  adjustQuality(networkState: NetworkState): void {
    this.adjustQualityBasedOnNetwork(networkState)
  }

  private adjustQualityBasedOnNetwork(networkState: NetworkState): void {
    if (!networkState.isOnline) {
      // Use lowest quality when offline
      this.currentProfile.value = this.profiles[this.profiles.length - 1]
      return
    }

    // Find appropriate profile based on network conditions
    // Prioritize effectiveType for slow connections
    let selectedProfile = this.profiles[this.profiles.length - 1] // Default to lowest quality
    
    // For very slow connections, force low quality regardless of other metrics
    if (networkState.effectiveType === 'slow-2g' || networkState.effectiveType === '2g') {
      selectedProfile = this.profiles[this.profiles.length - 1] // Force low quality
    } else {
      // For other connections, use bandwidth and latency thresholds
      for (const profile of this.profiles) {
        if (networkState.downlink >= profile.networkThreshold.minDownlink &&
            networkState.rtt <= profile.networkThreshold.maxRtt) {
          selectedProfile = profile
          break // Take the first (highest quality) profile that meets requirements
        }
      }
    }
    
    if (this.currentProfile.value.name !== selectedProfile.name) {
      this.currentProfile.value = selectedProfile
      console.log(`Auto quality adjustment: ${selectedProfile.name}, downlink: ${networkState.downlink}, rtt: ${networkState.rtt}`)
    }
  }

  dispose(): void {
    if (this.networkStateListener) {
      this.networkStateListener()
    }
  }
}

// ============================================================================
// Error Recovery Strategy Manager
// ============================================================================

export class ErrorRecoveryManager {
  private recoveryStrategies: Map<string, RecoveryStrategy> = new Map()
  private circuitBreaker: CircuitBreakerManager

  constructor(circuitBreaker: CircuitBreakerManager) {
    this.circuitBreaker = circuitBreaker
    this.setupDefaultStrategies()
  }

  /**
   * Execute operation with comprehensive error recovery
   */
  async executeWithRecovery<T>(
    operationId: string,
    operation: () => Promise<T>,
    customStrategy?: Partial<RecoveryStrategy>
  ): Promise<T> {
    const strategy = this.getRecoveryStrategy(operationId, customStrategy)
    
    for (let attempt = 1; attempt <= strategy.maxAttempts; attempt++) {
      try {
        // Use circuit breaker for network operations
        if (operationId.includes('network') || operationId.includes('api')) {
          return await this.circuitBreaker.executeWithCircuitBreaker(operationId, operation)
        } else {
          return await operation()
        }
      } catch (error) {
        const isLastAttempt = attempt === strategy.maxAttempts
        
        if (isLastAttempt) {
          // Try fallback strategies
          return await this.tryFallbackStrategies(strategy, error)
        }
        
        // Calculate backoff delay
        const delay = this.calculateBackoffDelay(attempt, strategy.backoffMultiplier)
        await this.delay(delay)
        
        // Log retry attempt
        errorHandler.handleError(error, {
          operation: `retry_attempt_${attempt}`,
          component: 'error_recovery',
          additionalData: { operationId, attempt, maxAttempts: strategy.maxAttempts }
        })
      }
    }
    
    throw new Error(`All recovery attempts failed for operation: ${operationId}`)
  }

  /**
   * Register custom recovery strategy
   */
  registerRecoveryStrategy(operationId: string, strategy: RecoveryStrategy): void {
    this.recoveryStrategies.set(operationId, strategy)
  }

  /**
   * Get recovery statistics
   */
  getRecoveryStats(): {
    totalOperations: number
    successfulRecoveries: number
    failedRecoveries: number
    circuitBreakerStats: Record<string, any>
  } {
    return {
      totalOperations: this.recoveryStrategies.size,
      successfulRecoveries: 0, // Would be tracked in real implementation
      failedRecoveries: 0, // Would be tracked in real implementation
      circuitBreakerStats: this.circuitBreaker.getHealthMetrics()
    }
  }

  private setupDefaultStrategies(): void {
    // Network operations
    this.recoveryStrategies.set('network_request', {
      type: 'retry',
      maxAttempts: 3,
      backoffMultiplier: 2
    })

    // Database operations
    this.recoveryStrategies.set('database_query', {
      type: 'retry',
      maxAttempts: 2,
      backoffMultiplier: 1.5
    })

    // File operations
    this.recoveryStrategies.set('file_upload', {
      type: 'retry',
      maxAttempts: 3,
      backoffMultiplier: 2
    })

    // Cache operations
    this.recoveryStrategies.set('cache_operation', {
      type: 'fallback',
      maxAttempts: 1,
      backoffMultiplier: 1,
      fallbackAction: async () => {
        // Fallback to direct network request
        return null
      }
    })
  }

  private getRecoveryStrategy(operationId: string, customStrategy?: Partial<RecoveryStrategy>): RecoveryStrategy {
    const baseStrategy = this.recoveryStrategies.get(operationId) || {
      type: 'retry',
      maxAttempts: 3,
      backoffMultiplier: 2
    }

    return { ...baseStrategy, ...customStrategy }
  }

  private async tryFallbackStrategies<T>(strategy: RecoveryStrategy, lastError: any): Promise<T> {
    switch (strategy.type) {
      case 'fallback':
        if (strategy.fallbackAction) {
          try {
            return await strategy.fallbackAction()
          } catch (fallbackError) {
            errorHandler.handleError(fallbackError, {
              operation: 'fallback_failed',
              component: 'error_recovery'
            })
          }
        }
        break

      case 'cache':
        if (strategy.cacheKey) {
          try {
            // Try to get from cache
            const { cacheManager } = await import('./cacheManager')
            const cachedResult = await cacheManager.get<T>(strategy.cacheKey)
            if (cachedResult !== null) {
              return cachedResult
            }
          } catch (cacheError) {
            errorHandler.handleError(cacheError, {
              operation: 'cache_fallback_failed',
              component: 'error_recovery'
            })
          }
        }
        break

      case 'degrade':
        // Return a degraded response
        return this.createDegradedResponse<T>()
    }

    throw lastError
  }

  private calculateBackoffDelay(attempt: number, multiplier: number): number {
    const baseDelay = 100 // 100ms for faster testing
    const delay = baseDelay * Math.pow(multiplier, attempt - 1)
    const jitter = Math.random() * 0.1 * delay // Add 10% jitter
    return Math.min(delay + jitter, 5000) // Max 5 seconds
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private createDegradedResponse<T>(): T {
    // Return a minimal response that won't break the application
    return {} as T
  }
}

// ============================================================================
// Main Graceful Degradation System
// ============================================================================

export class GracefulDegradationSystem {
  private circuitBreaker: CircuitBreakerManager
  private featureDegradation: FeatureDegradationManager
  private errorRecovery: ErrorRecoveryManager
  private isInitialized = false

  constructor() {
    this.circuitBreaker = new CircuitBreakerManager()
    this.featureDegradation = new FeatureDegradationManager()
    this.errorRecovery = new ErrorRecoveryManager(this.circuitBreaker)
  }

  /**
   * Initialize the graceful degradation system
   */
  initialize(): void {
    if (this.isInitialized) return

    // Monitor system health
    this.startHealthMonitoring()
    
    this.isInitialized = true
    console.log('Graceful degradation system initialized')
  }

  /**
   * Execute operation with full graceful degradation support
   */
  async executeOperation<T>(
    operationId: string,
    operation: () => Promise<T>,
    options?: {
      useCircuitBreaker?: boolean
      recoveryStrategy?: Partial<RecoveryStrategy>
      respectFeatureLimits?: boolean
    }
  ): Promise<T> {
    const opts = {
      useCircuitBreaker: true,
      respectFeatureLimits: true,
      ...options
    }

    // Check feature limits
    if (opts.respectFeatureLimits && !this.isOperationAllowed(operationId)) {
      throw new Error(`Operation ${operationId} is disabled due to network conditions`)
    }

    // Execute with error recovery
    return await this.errorRecovery.executeWithRecovery(
      operationId,
      operation,
      opts.recoveryStrategy
    )
  }

  /**
   * Get current system status
   */
  getSystemStatus(): {
    qualityProfile: string
    featuresEnabled: FeatureDegradationConfig
    circuitBreakerStatus: Record<string, any>
    networkState: NetworkState
    recommendations: string[]
  } {
    return {
      qualityProfile: this.featureDegradation.profileName,
      featuresEnabled: this.featureDegradation.features,
      circuitBreakerStatus: this.circuitBreaker.getHealthMetrics(),
      networkState: networkManager.networkState,
      recommendations: this.featureDegradation.getDegradationRecommendations()
    }
  }

  /**
   * Check if operation is allowed under current conditions
   */
  isOperationAllowed(operationId: string): boolean {
    const features = this.featureDegradation.features

    // Map operation types to feature flags
    if (operationId.includes('realtime') && !features.enableRealTimeUpdates) {
      return false
    }
    
    if (operationId.includes('background') && !features.enableBackgroundSync) {
      return false
    }
    
    if (operationId.includes('image') && !features.enableImageOptimization) {
      return false
    }
    
    if (operationId.includes('ui_animation') && !features.enableAdvancedUI) {
      return false
    }

    return true
  }

  /**
   * Get circuit breaker manager
   */
  getCircuitBreaker(): CircuitBreakerManager {
    return this.circuitBreaker
  }

  /**
   * Get feature degradation manager
   */
  getFeatureDegradation(): FeatureDegradationManager {
    return this.featureDegradation
  }

  /**
   * Get error recovery manager
   */
  getErrorRecovery(): ErrorRecoveryManager {
    return this.errorRecovery
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    this.featureDegradation.dispose()
    this.isInitialized = false
  }

  private startHealthMonitoring(): void {
    // Monitor system health every 30 seconds
    setInterval(() => {
      const status = this.getSystemStatus()
      
      console.log(`System health check: profile=${status.qualityProfile}, online=${status.networkState.isOnline}, downlink=${status.networkState.downlink}`)
      
      // Log degradation events
      if (status.qualityProfile !== 'high') {
        console.log(`Quality degradation active: profile=${status.qualityProfile}, recommendations=${status.recommendations.length}`)
      }
    }, 30000)
  }
}

// ============================================================================
// Singleton Instance and Exports
// ============================================================================

export const gracefulDegradationSystem = new GracefulDegradationSystem()

// Initialize on module load
gracefulDegradationSystem.initialize()

// Convenience exports
export const circuitBreaker = gracefulDegradationSystem.getCircuitBreaker()
export const featureDegradation = gracefulDegradationSystem.getFeatureDegradation()
export const errorRecovery = gracefulDegradationSystem.getErrorRecovery()

// Convenience functions
export function executeWithGracefulDegradation<T>(
  operationId: string,
  operation: () => Promise<T>,
  options?: Parameters<typeof gracefulDegradationSystem.executeOperation>[2]
): Promise<T> {
  return gracefulDegradationSystem.executeOperation(operationId, operation, options)
}

export function isFeatureEnabled(feature: keyof FeatureDegradationConfig): boolean {
  return featureDegradation.isFeatureEnabled(feature)
}

export function getSystemHealthStatus(): ReturnType<typeof gracefulDegradationSystem.getSystemStatus> {
  return gracefulDegradationSystem.getSystemStatus()
}