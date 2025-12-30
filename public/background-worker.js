/**
 * Background Worker for Heavy Network Operations
 * 
 * Handles CPU-intensive tasks to prevent UI blocking
 */

// Worker message handler
self.onmessage = function(event) {
  const { taskId, type, data } = event.data
  
  try {
    let result
    
    switch (type) {
      case 'data-processing':
        result = processLargeDataset(data)
        break
      case 'network-analysis':
        result = analyzeNetworkData(data)
        break
      case 'compression':
        result = compressData(data)
        break
      case 'validation':
        result = validateLargeDataset(data)
        break
      case 'calculation':
        result = performCalculations(data)
        break
      case 'heavy':
      default:
        result = processHeavyTask(data)
        break
    }
    
    // Send result back to main thread
    self.postMessage({
      taskId,
      result,
      error: null
    })
    
  } catch (error) {
    // Send error back to main thread
    self.postMessage({
      taskId,
      result: null,
      error: error.message
    })
  }
}

// Heavy task processing functions
function processHeavyTask(data) {
  if (Array.isArray(data.items)) {
    return data.items.map(item => ({
      ...item,
      processed: true,
      timestamp: Date.now()
    }))
  }
  
  if (typeof data.input === 'number') {
    return { result: data.input * 2 }
  }
  
  return data
}

function processLargeDataset(data) {
  const { items, operation } = data
  
  if (!Array.isArray(items)) {
    throw new Error('Items must be an array')
  }
  
  switch (operation) {
    case 'sort':
      return items.sort((a, b) => {
        if (typeof a === 'number' && typeof b === 'number') {
          return a - b
        }
        return String(a).localeCompare(String(b))
      })
      
    case 'filter':
      return items.filter(item => item != null && item !== '')
      
    case 'transform':
      return items.map(item => ({
        original: item,
        processed: true,
        hash: simpleHash(String(item))
      }))
      
    case 'aggregate':
      return {
        count: items.length,
        sum: items.filter(x => typeof x === 'number').reduce((a, b) => a + b, 0),
        unique: [...new Set(items)].length
      }
      
    default:
      return items
  }
}

function analyzeNetworkData(data) {
  const { requests, metrics } = data
  
  if (!Array.isArray(requests)) {
    throw new Error('Requests must be an array')
  }
  
  const analysis = {
    totalRequests: requests.length,
    successRate: 0,
    averageResponseTime: 0,
    errorTypes: {},
    performanceMetrics: {}
  }
  
  let successCount = 0
  let totalResponseTime = 0
  
  requests.forEach(request => {
    if (request.success) {
      successCount++
    } else {
      const errorType = request.errorType || 'unknown'
      analysis.errorTypes[errorType] = (analysis.errorTypes[errorType] || 0) + 1
    }
    
    if (request.responseTime) {
      totalResponseTime += request.responseTime
    }
  })
  
  analysis.successRate = requests.length > 0 ? (successCount / requests.length) * 100 : 0
  analysis.averageResponseTime = requests.length > 0 ? totalResponseTime / requests.length : 0
  
  if (metrics) {
    analysis.performanceMetrics = {
      bandwidth: metrics.bandwidth || 0,
      latency: metrics.latency || 0,
      throughput: requests.length > 0 ? requests.length / (metrics.duration || 1) : 0
    }
  }
  
  return analysis
}

function compressData(data) {
  // Simple compression simulation
  const jsonString = JSON.stringify(data)
  
  // Simulate compression by removing whitespace and common patterns
  const compressed = jsonString
    .replace(/\s+/g, '')
    .replace(/null/g, 'n')
    .replace(/true/g, 't')
    .replace(/false/g, 'f')
  
  return {
    original: data,
    compressed: compressed,
    originalSize: jsonString.length,
    compressedSize: compressed.length,
    compressionRatio: compressed.length / jsonString.length
  }
}

function validateLargeDataset(data) {
  const { items, schema } = data
  
  if (!Array.isArray(items)) {
    throw new Error('Items must be an array')
  }
  
  const results = {
    valid: [],
    invalid: [],
    errors: []
  }
  
  items.forEach((item, index) => {
    try {
      if (validateItem(item, schema)) {
        results.valid.push({ index, item })
      } else {
        results.invalid.push({ index, item, reason: 'Schema validation failed' })
      }
    } catch (error) {
      results.errors.push({ index, item, error: error.message })
    }
  })
  
  return {
    ...results,
    summary: {
      total: items.length,
      validCount: results.valid.length,
      invalidCount: results.invalid.length,
      errorCount: results.errors.length,
      validationRate: (results.valid.length / items.length) * 100
    }
  }
}

function validateItem(item, schema) {
  if (!schema) return true
  
  // Simple schema validation
  if (schema.required && !item) return false
  if (schema.type && typeof item !== schema.type) return false
  if (schema.minLength && String(item).length < schema.minLength) return false
  if (schema.maxLength && String(item).length > schema.maxLength) return false
  
  return true
}

function performCalculations(data) {
  const { numbers, operation } = data
  
  if (!Array.isArray(numbers)) {
    throw new Error('Numbers must be an array')
  }
  
  const validNumbers = numbers.filter(n => typeof n === 'number' && !isNaN(n))
  
  if (validNumbers.length === 0) {
    return { result: 0, error: 'No valid numbers provided' }
  }
  
  let result
  
  switch (operation) {
    case 'sum':
      result = validNumbers.reduce((a, b) => a + b, 0)
      break
      
    case 'average':
      result = validNumbers.reduce((a, b) => a + b, 0) / validNumbers.length
      break
      
    case 'median':
      const sorted = [...validNumbers].sort((a, b) => a - b)
      const mid = Math.floor(sorted.length / 2)
      result = sorted.length % 2 === 0 
        ? (sorted[mid - 1] + sorted[mid]) / 2 
        : sorted[mid]
      break
      
    case 'standardDeviation':
      const mean = validNumbers.reduce((a, b) => a + b, 0) / validNumbers.length
      const variance = validNumbers.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / validNumbers.length
      result = Math.sqrt(variance)
      break
      
    default:
      result = validNumbers.length
  }
  
  return {
    result,
    count: validNumbers.length,
    operation,
    processingTime: Date.now()
  }
}

// Utility functions
function simpleHash(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return hash
}

// Error handler
self.onerror = function(error) {
  console.error('Worker error:', error)
}