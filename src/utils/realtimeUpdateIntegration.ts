/**
 * Real-time Update Integration
 * 
 * Integrates update batching with existing real-time subscriptions
 * to prevent excessive re-rendering during high-frequency updates
 */

import { updateBatcher } from './updateBatcher'
import { backgroundProcessor } from './backgroundProcessor'

// Update types for different data entities
export type UpdateType = 
  | 'team-updates'
  | 'event-updates' 
  | 'submission-updates'
  | 'notification-updates'
  | 'network-state-updates'
  | 'performance-metrics'

// Setup batched updates for common app store operations
export function setupRealtimeUpdateBatching() {
  // Team updates batching
  updateBatcher.registerUpdateCallback(
    'team-updates',
    batchTeamUpdates,
    { batchSize: 5, batchDelay: 100 }
  )

  // Event updates batching  
  updateBatcher.registerUpdateCallback(
    'event-updates',
    batchEventUpdates,
    { batchSize: 3, batchDelay: 150 }
  )

  // Submission updates batching
  updateBatcher.registerUpdateCallback(
    'submission-updates', 
    batchSubmissionUpdates,
    { batchSize: 8, batchDelay: 200 }
  )

  // Notification updates batching
  updateBatcher.registerUpdateCallback(
    'notification-updates',
    batchNotificationUpdates,
    { batchSize: 10, batchDelay: 50 }
  )

  // Network state updates batching
  updateBatcher.registerUpdateCallback(
    'network-state-updates',
    batchNetworkStateUpdates,
    { batchSize: 5, batchDelay: 100 }
  )

  // Performance metrics batching
  updateBatcher.registerUpdateCallback(
    'performance-metrics',
    batchPerformanceMetrics,
    { batchSize: 20, batchDelay: 1000 }
  )
}

// Batch processing functions
function batchTeamUpdates(updates: any[]): void {
  console.log(`Processing ${updates.length} team updates in batch`)
  
  // Group updates by team ID to avoid duplicate processing
  const updatesByTeam = new Map<string, any[]>()
  
  updates.forEach(update => {
    const teamId = update.teamId || update.team_id
    if (teamId) {
      if (!updatesByTeam.has(teamId)) {
        updatesByTeam.set(teamId, [])
      }
      updatesByTeam.get(teamId)!.push(update)
    }
  })

  // Process each team's updates
  updatesByTeam.forEach((teamUpdates, teamId) => {
    // Use background processing for heavy team data processing
    if (teamUpdates.length > 10) {
      backgroundProcessor.processHeavyTask('team-data-processing', {
        teamId,
        updates: teamUpdates
      }).catch(error => {
        console.error('Error processing team updates in background:', error)
      })
    } else {
      // Process lighter updates immediately
      processTeamUpdatesImmediate(teamId, teamUpdates)
    }
  })
}

function batchEventUpdates(updates: any[]): void {
  console.log(`Processing ${updates.length} event updates in batch`)
  
  // Group by event ID
  const updatesByEvent = new Map<string, any[]>()
  
  updates.forEach(update => {
    const eventId = update.eventId || update.event_id
    if (eventId) {
      if (!updatesByEvent.has(eventId)) {
        updatesByEvent.set(eventId, [])
      }
      updatesByEvent.get(eventId)!.push(update)
    }
  })

  // Process each event's updates
  updatesByEvent.forEach((eventUpdates, eventId) => {
    processEventUpdatesImmediate(eventId, eventUpdates)
  })
}

function batchSubmissionUpdates(updates: any[]): void {
  console.log(`Processing ${updates.length} submission updates in batch`)
  
  // Group by event ID for efficient processing
  const updatesByEvent = new Map<string, any[]>()
  
  updates.forEach(update => {
    const eventId = update.eventId || update.event_id
    if (eventId) {
      if (!updatesByEvent.has(eventId)) {
        updatesByEvent.set(eventId, [])
      }
      updatesByEvent.get(eventId)!.push(update)
    }
  })

  // Process submissions by event
  updatesByEvent.forEach((submissionUpdates, eventId) => {
    // Use background processing for large submission datasets
    if (submissionUpdates.length > 20) {
      backgroundProcessor.processHeavyTask('submission-data-processing', {
        eventId,
        updates: submissionUpdates
      }).catch(error => {
        console.error('Error processing submission updates in background:', error)
      })
    } else {
      processSubmissionUpdatesImmediate(eventId, submissionUpdates)
    }
  })
}

function batchNotificationUpdates(updates: any[]): void {
  console.log(`Processing ${updates.length} notification updates in batch`)
  
  // Sort by timestamp to maintain order
  const sortedUpdates = updates.sort((a, b) => {
    const timeA = new Date(a.created_at || a.timestamp || 0).getTime()
    const timeB = new Date(b.created_at || b.timestamp || 0).getTime()
    return timeA - timeB
  })

  // Process notifications in order
  processNotificationUpdatesImmediate(sortedUpdates)
}

function batchNetworkStateUpdates(updates: any[]): void {
  console.log(`Processing ${updates.length} network state updates in batch`)
  
  // Only keep the latest network state
  const latestUpdate = updates[updates.length - 1]
  processNetworkStateUpdateImmediate(latestUpdate)
}

function batchPerformanceMetrics(updates: any[]): void {
  console.log(`Processing ${updates.length} performance metrics in batch`)
  
  // Aggregate metrics for efficient processing
  const aggregatedMetrics = aggregatePerformanceMetrics(updates)
  processPerformanceMetricsImmediate(aggregatedMetrics)
}

// Immediate processing functions (these would integrate with actual app store)
function processTeamUpdatesImmediate(teamId: string, updates: any[]): void {
  // This would call actual app store methods
  console.log(`Processing ${updates.length} updates for team ${teamId}`)
}

function processEventUpdatesImmediate(eventId: string, updates: any[]): void {
  // This would call actual app store methods
  console.log(`Processing ${updates.length} updates for event ${eventId}`)
}

function processSubmissionUpdatesImmediate(eventId: string, updates: any[]): void {
  // This would call actual app store methods
  console.log(`Processing ${updates.length} submission updates for event ${eventId}`)
}

function processNotificationUpdatesImmediate(updates: any[]): void {
  // This would call actual app store methods
  console.log(`Processing ${updates.length} notification updates`)
}

function processNetworkStateUpdateImmediate(update: any): void {
  // This would update the network state in app store
  console.log('Processing network state update:', update)
}

function processPerformanceMetricsImmediate(metrics: any): void {
  // This would update performance metrics in app store
  console.log('Processing aggregated performance metrics:', metrics)
}

// Utility functions
function aggregatePerformanceMetrics(updates: any[]): any {
  const aggregated = {
    totalUpdates: updates.length,
    averageResponseTime: 0,
    errorCount: 0,
    successCount: 0,
    timestamp: Date.now()
  }

  let totalResponseTime = 0
  
  updates.forEach(update => {
    if (update.responseTime) {
      totalResponseTime += update.responseTime
    }
    if (update.error) {
      aggregated.errorCount++
    } else {
      aggregated.successCount++
    }
  })

  aggregated.averageResponseTime = updates.length > 0 ? totalResponseTime / updates.length : 0

  return aggregated
}

// Convenience functions for adding updates
export function addTeamUpdate(update: any): void {
  updateBatcher.addUpdate('team-updates', update)
}

export function addEventUpdate(update: any): void {
  updateBatcher.addUpdate('event-updates', update)
}

export function addSubmissionUpdate(update: any): void {
  updateBatcher.addUpdate('submission-updates', update)
}

export function addNotificationUpdate(update: any): void {
  updateBatcher.addUpdate('notification-updates', update)
}

export function addNetworkStateUpdate(update: any): void {
  updateBatcher.addUpdate('network-state-updates', update)
}

export function addPerformanceMetric(metric: any): void {
  updateBatcher.addUpdate('performance-metrics', metric)
}

// Cleanup function
export function cleanupRealtimeUpdates(): void {
  updateBatcher.cleanup()
}