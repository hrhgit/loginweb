/**
 * Composable for managing code splitting and bundle optimization
 */

import { ref, computed, onMounted, type Ref } from 'vue'
import { 
  analyzeBundleSize, 
  chunkTracker, 
  type BundleAnalysis 
} from '../utils/codeSplitting'

export interface CodeSplittingMetrics {
  chunksLoaded: number
  totalLoadTime: number
  averageLoadTime: number
  failedChunks: number
  optimizationScore: number
}

export function useCodeSplitting() {
  const isAnalyzing = ref(false)
  const bundleAnalysis: Ref<BundleAnalysis | null> = ref(null)
  const metrics = ref<CodeSplittingMetrics>({
    chunksLoaded: 0,
    totalLoadTime: 0,
    averageLoadTime: 0,
    failedChunks: 0,
    optimizationScore: 0
  })

  /**
   * Analyze current bundle size and optimization opportunities
   */
  const analyzeBundleOptimization = async () => {
    isAnalyzing.value = true
    
    try {
      // Get bundle analysis
      bundleAnalysis.value = analyzeBundleSize()
      
      // Get chunk loading statistics
      const stats = chunkTracker.getLoadingStats()
      
      // Update metrics
      metrics.value = {
        chunksLoaded: Object.keys(stats.loadTimes).length,
        totalLoadTime: Object.values(stats.loadTimes).reduce((a, b) => a + b, 0),
        averageLoadTime: stats.averageLoadTime,
        failedChunks: Object.keys(stats.loadErrors).length,
        optimizationScore: calculateOptimizationScore(stats)
      }
    } finally {
      isAnalyzing.value = false
    }
  }

  /**
   * Calculate optimization score based on loading performance
   */
  const calculateOptimizationScore = (stats: any): number => {
    let score = 100
    
    // Penalize slow average load times
    if (stats.averageLoadTime > 3000) score -= 30
    else if (stats.averageLoadTime > 1500) score -= 15
    else if (stats.averageLoadTime > 800) score -= 5
    
    // Penalize failed chunks
    const failureRate = Object.keys(stats.loadErrors).length / Math.max(Object.keys(stats.loadTimes).length, 1)
    score -= failureRate * 50
    
    // Bonus for good performance
    if (stats.averageLoadTime < 500) score += 10
    
    return Math.max(0, Math.min(100, score))
  }

  /**
   * Get optimization recommendations
   */
  const getOptimizationRecommendations = computed(() => {
    const recommendations: string[] = []
    
    if (!bundleAnalysis.value) return recommendations
    
    // Add bundle-specific recommendations
    recommendations.push(...bundleAnalysis.value.recommendations)
    
    // Add performance-based recommendations
    if (metrics.value.averageLoadTime > 2000) {
      recommendations.push('Consider reducing chunk sizes or improving network conditions')
    }
    
    if (metrics.value.failedChunks > 0) {
      recommendations.push('Implement retry logic for failed chunk loads')
    }
    
    if (metrics.value.chunksLoaded > 20) {
      recommendations.push('Consider consolidating smaller chunks to reduce overhead')
    }
    
    return recommendations
  })

  /**
   * Track route-based code splitting effectiveness
   */
  const trackRouteChunkLoading = (routeName: string) => {
    const startTime = performance.now()
    
    return {
      onChunkLoaded: () => {
        const tracker = chunkTracker.trackChunkLoad(`route-${routeName}`, startTime)
        tracker.onLoad()
        
        // Update metrics
        analyzeBundleOptimization()
      },
      onChunkError: (error: Error) => {
        const tracker = chunkTracker.trackChunkLoad(`route-${routeName}`, startTime)
        tracker.onError(error)
        
        // Update metrics
        analyzeBundleOptimization()
      }
    }
  }

  /**
   * Monitor component lazy loading performance
   */
  const trackComponentLoading = (componentName: string) => {
    const startTime = performance.now()
    
    return chunkTracker.trackChunkLoad(`component-${componentName}`, startTime)
  }

  /**
   * Get performance insights for optimization
   */
  const getPerformanceInsights = computed(() => {
    const insights: string[] = []
    
    if (metrics.value.optimizationScore >= 90) {
      insights.push('Excellent code splitting performance!')
    } else if (metrics.value.optimizationScore >= 70) {
      insights.push('Good code splitting performance with room for improvement')
    } else if (metrics.value.optimizationScore >= 50) {
      insights.push('Moderate code splitting performance - consider optimizations')
    } else {
      insights.push('Poor code splitting performance - immediate optimization needed')
    }
    
    if (metrics.value.averageLoadTime < 500) {
      insights.push('Fast chunk loading times detected')
    }
    
    if (metrics.value.failedChunks === 0 && metrics.value.chunksLoaded > 0) {
      insights.push('No chunk loading failures - reliable performance')
    }
    
    return insights
  })

  /**
   * Initialize code splitting monitoring
   */
  onMounted(() => {
    // Initial analysis
    analyzeBundleOptimization()
    
    // Monitor for dynamic imports in development
    if (import.meta.env.DEV) {
      console.log('Code splitting monitoring initialized')
    }
  })

  return {
    // State
    isAnalyzing,
    bundleAnalysis,
    metrics,
    
    // Computed
    getOptimizationRecommendations,
    getPerformanceInsights,
    
    // Methods
    analyzeBundleOptimization,
    trackRouteChunkLoading,
    trackComponentLoading
  }
}