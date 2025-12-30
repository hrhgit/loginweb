/**
 * 性能优化配置
 * 
 * 集中管理错误处理系统的性能优化设置
 */

export interface PerformanceConfig {
  // 错误处理优化
  errorHandling: {
    cacheSize: number
    throttleInterval: number
    duplicateThreshold: number
    batchSize: number
  }
  
  // 存储优化
  storage: {
    maxRecords: number
    maxStorageSize: number
    batchWriteDelay: number
    cacheTimeout: number
  }
  
  // UI优化
  ui: {
    messageUpdateDebounce: number
    animationDuration: number
    maxConcurrentMessages: number
  }
  
  // 内存管理
  memory: {
    checkInterval: number
    memoryThreshold: number
    growthThreshold: number
    maxRetainedObjects: number
  }
  
  // 性能监控
  monitoring: {
    enabled: boolean
    sampleRate: number
    reportInterval: number
  }
}

export const DEFAULT_PERFORMANCE_CONFIG: PerformanceConfig = {
  errorHandling: {
    cacheSize: 100,
    throttleInterval: 1000, // 1 second
    duplicateThreshold: 5000, // 5 seconds
    batchSize: 10
  },
  
  storage: {
    maxRecords: 50,
    maxStorageSize: 1024 * 1024, // 1MB
    batchWriteDelay: 1000, // 1 second
    cacheTimeout: 30000 // 30 seconds
  },
  
  ui: {
    messageUpdateDebounce: 50, // 50ms
    animationDuration: 300, // 300ms
    maxConcurrentMessages: 3
  },
  
  memory: {
    checkInterval: 30000, // 30 seconds
    memoryThreshold: 100, // 100MB
    growthThreshold: 10, // 10MB/min
    maxRetainedObjects: 1000
  },
  
  monitoring: {
    enabled: true,
    sampleRate: 0.1, // 10% sampling
    reportInterval: 300000 // 5 minutes
  }
}

export const PRODUCTION_PERFORMANCE_CONFIG: PerformanceConfig = {
  ...DEFAULT_PERFORMANCE_CONFIG,
  
  errorHandling: {
    ...DEFAULT_PERFORMANCE_CONFIG.errorHandling,
    cacheSize: 200,
    batchSize: 20
  },
  
  storage: {
    ...DEFAULT_PERFORMANCE_CONFIG.storage,
    maxRecords: 100,
    maxStorageSize: 2 * 1024 * 1024, // 2MB
    batchWriteDelay: 2000 // 2 seconds for less frequent writes
  },
  
  monitoring: {
    ...DEFAULT_PERFORMANCE_CONFIG.monitoring,
    sampleRate: 0.05, // 5% sampling in production
    reportInterval: 600000 // 10 minutes
  }
}

export const DEVELOPMENT_PERFORMANCE_CONFIG: PerformanceConfig = {
  ...DEFAULT_PERFORMANCE_CONFIG,
  
  errorHandling: {
    ...DEFAULT_PERFORMANCE_CONFIG.errorHandling,
    throttleInterval: 500, // More frequent logging in dev
  },
  
  storage: {
    ...DEFAULT_PERFORMANCE_CONFIG.storage,
    batchWriteDelay: 500 // Faster writes for development
  },
  
  memory: {
    ...DEFAULT_PERFORMANCE_CONFIG.memory,
    checkInterval: 10000, // More frequent checks in dev
    memoryThreshold: 50 // Lower threshold for early detection
  },
  
  monitoring: {
    ...DEFAULT_PERFORMANCE_CONFIG.monitoring,
    sampleRate: 1.0, // 100% sampling in development
    reportInterval: 60000 // 1 minute
  }
}

/**
 * 性能配置管理器
 */
export class PerformanceConfigManager {
  private config: PerformanceConfig
  private listeners: Array<(config: PerformanceConfig) => void> = []

  constructor(initialConfig?: PerformanceConfig) {
    this.config = initialConfig || this.getEnvironmentConfig()
  }

  /**
   * 获取当前配置
   */
  getConfig(): PerformanceConfig {
    return { ...this.config }
  }

  /**
   * 更新配置
   */
  updateConfig(updates: Partial<PerformanceConfig>): void {
    this.config = this.mergeConfig(this.config, updates)
    this.notifyListeners()
  }

  /**
   * 重置为默认配置
   */
  resetToDefault(): void {
    this.config = { ...DEFAULT_PERFORMANCE_CONFIG }
    this.notifyListeners()
  }

  /**
   * 根据环境设置配置
   */
  setEnvironmentConfig(environment: 'development' | 'production' | 'default'): void {
    switch (environment) {
      case 'development':
        this.config = { ...DEVELOPMENT_PERFORMANCE_CONFIG }
        break
      case 'production':
        this.config = { ...PRODUCTION_PERFORMANCE_CONFIG }
        break
      default:
        this.config = { ...DEFAULT_PERFORMANCE_CONFIG }
        break
    }
    this.notifyListeners()
  }

  /**
   * 添加配置变更监听器
   */
  addListener(listener: (config: PerformanceConfig) => void): void {
    this.listeners.push(listener)
  }

  /**
   * 移除配置变更监听器
   */
  removeListener(listener: (config: PerformanceConfig) => void): void {
    const index = this.listeners.indexOf(listener)
    if (index > -1) {
      this.listeners.splice(index, 1)
    }
  }

  /**
   * 获取性能配置摘要
   */
  getConfigSummary(): string {
    const config = this.config
    return [
      '=== 性能配置摘要 ===',
      `错误处理缓存大小: ${config.errorHandling.cacheSize}`,
      `存储批量写入延迟: ${config.storage.batchWriteDelay}ms`,
      `UI消息更新防抖: ${config.ui.messageUpdateDebounce}ms`,
      `内存检查间隔: ${config.memory.checkInterval}ms`,
      `性能监控采样率: ${(config.monitoring.sampleRate * 100).toFixed(1)}%`,
      `最大错误记录数: ${config.storage.maxRecords}`,
      `最大存储大小: ${(config.storage.maxStorageSize / 1024 / 1024).toFixed(1)}MB`
    ].join('\n')
  }

  // 私有方法

  private getEnvironmentConfig(): PerformanceConfig {
    // 检测环境
    if (import.meta.env.PROD) {
      return { ...PRODUCTION_PERFORMANCE_CONFIG }
    } else if (import.meta.env.DEV) {
      return { ...DEVELOPMENT_PERFORMANCE_CONFIG }
    }
    return { ...DEFAULT_PERFORMANCE_CONFIG }
  }

  private mergeConfig(base: PerformanceConfig, updates: Partial<PerformanceConfig>): PerformanceConfig {
    const merged = { ...base }
    
    for (const [key, value] of Object.entries(updates)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        merged[key as keyof PerformanceConfig] = {
          ...merged[key as keyof PerformanceConfig],
          ...value
        } as any
      } else {
        (merged as any)[key] = value
      }
    }
    
    return merged
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.config)
      } catch (error) {
        console.warn('Error notifying performance config listener:', error)
      }
    }
  }
}

// 创建单例实例
export const performanceConfigManager = new PerformanceConfigManager()

// 便捷函数
export function getPerformanceConfig(): PerformanceConfig {
  return performanceConfigManager.getConfig()
}

export function updatePerformanceConfig(updates: Partial<PerformanceConfig>): void {
  performanceConfigManager.updateConfig(updates)
}

export function setEnvironmentConfig(environment: 'development' | 'production' | 'default'): void {
  performanceConfigManager.setEnvironmentConfig(environment)
}