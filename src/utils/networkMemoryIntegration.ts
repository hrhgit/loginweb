/**
 * Network Memory Integration
 * 
 * Demonstrates how to integrate the enhanced memory management
 * with network operations for automatic cleanup and leak prevention.
 */

import { 
  startMemoryMonitoring, 
  registerComponentCleanup, 
  trackNetworkOperation, 
  completeNetworkOperation,
  getNetworkMemoryStats,
  performNetworkCleanup
} from './memoryManager'
import { addNetworkStateListener } from './networkManager'
import { fetchWithTimeout } from './requestTimeout'
import { TIMEOUT_REFRESH_MESSAGE } from './errorHandler'

/**
 * Initialize network memory management
 * Call this during application startup
 */
export function initializeNetworkMemoryManagement(): void {
  // Start memory monitoring
  startMemoryMonitoring()
  
  console.log('Network memory management initialized')
}

/**
 * Register cleanup for a Vue component that uses network operations
 * Call this in the component's setup() function
 */
export function useNetworkMemoryCleanup(componentName: string): {
  trackOperation: (operationId: string, type: string) => void
  completeOperation: (operationId: string) => void
  addNetworkListener: (callback: (state: any) => void) => () => void
  cleanup: () => void
} {
  const listeners: (() => void)[] = []
  
  // Register component cleanup
  const unregisterCleanup = registerComponentCleanup(componentName, () => {
    // Clean up all listeners when component unmounts
    listeners.forEach(removeListener => removeListener())
    listeners.length = 0
    console.log(`Cleaned up network listeners for component: ${componentName}`)
  })

  return {
    trackOperation: (operationId: string, type: string) => {
      trackNetworkOperation(operationId, `${componentName}:${type}`)
    },
    
    completeOperation: (operationId: string) => {
      completeNetworkOperation(operationId)
    },
    
    addNetworkListener: (callback: (state: any) => void) => {
      const removeListener = addNetworkStateListener(callback)
      listeners.push(removeListener)
      return removeListener
    },
    
    cleanup: () => {
      unregisterCleanup()
      listeners.forEach(removeListener => removeListener())
      listeners.length = 0
    }
  }
}

/**
 * Perform manual memory cleanup
 * Useful for testing or when memory pressure is detected
 */
export function performManualCleanup(): void {
  performNetworkCleanup()
  
  const stats = getNetworkMemoryStats()
  console.log('Manual cleanup performed:', {
    activeListeners: stats.activeListeners,
    queuedRequests: stats.queuedRequests,
    cacheSize: `${(stats.cacheSize / (1024 * 1024)).toFixed(2)}MB`,
    failedRequests: stats.failedRequests
  })
}

/**
 * Get current network memory statistics
 */
export function getNetworkMemoryReport(): {
  stats: ReturnType<typeof getNetworkMemoryStats>
  recommendations: string[]
} {
  const stats = getNetworkMemoryStats()
  const recommendations: string[] = []
  
  // Provide recommendations based on current state
  if (stats.activeListeners > 50) {
    recommendations.push('Consider cleaning up unused component listeners')
  }
  
  if (stats.queuedRequests > 100) {
    recommendations.push('High number of queued requests - check network connectivity')
  }
  
  if (stats.cacheSize > 50 * 1024 * 1024) { // 50MB
    recommendations.push('Cache size is large - consider clearing old entries')
  }
  
  if (stats.failedRequests > 20) {
    recommendations.push('Many failed requests - check network stability')
  }
  
  return { stats, recommendations }
}

/**
 * Example usage in a Vue component
 */
export function createNetworkAwareComponent() {
  return {
    setup() {
      const { trackOperation, completeOperation, addNetworkListener, cleanup } = 
        useNetworkMemoryCleanup('ExampleComponent')
      
      // Example: Track a network operation
      const performNetworkRequest = async (url: string) => {
        const operationId = `fetch_${Date.now()}`
        trackOperation(operationId, `GET ${url}`)
        
        try {
          const response = await fetchWithTimeout(url, {
            timeoutMessage: TIMEOUT_REFRESH_MESSAGE
          })
          const data = await response.json()
          completeOperation(operationId)
          return data
        } catch (error) {
          completeOperation(operationId)
          throw error
        }
      }
      
      // Example: Listen to network state changes
      addNetworkListener((state) => {
        console.log('Network state changed:', state.isOnline ? 'online' : 'offline')
      })
      
      // Cleanup on component unmount
      return {
        performNetworkRequest,
        cleanup
      }
    }
  }
}
