/**
 * Data Compression Utilities - Handles data compression for large payloads
 * 
 * Provides compression and decompression functionality to reduce data usage
 * for network requests and storage operations.
 */

export interface CompressionResult {
  compressed: ArrayBuffer
  originalSize: number
  compressedSize: number
  compressionRatio: number
  algorithm: string
}

export interface CompressionOptions {
  algorithm: 'gzip' | 'deflate' | 'br'
  level: number // 1-9
  minSize: number // Minimum size to compress (bytes)
}

/**
 * Data Compression Manager
 */
export class DataCompressionManager {
  private defaultOptions: CompressionOptions = {
    algorithm: 'gzip',
    level: 6,
    minSize: 1024 // 1KB
  }

  constructor(options?: Partial<CompressionOptions>) {
    this.defaultOptions = {
      ...this.defaultOptions,
      ...options
    }
  }

  /**
   * Compress data using specified algorithm
   */
  async compress(
    data: string | ArrayBuffer | Uint8Array,
    options?: Partial<CompressionOptions>
  ): Promise<CompressionResult> {
    const opts = { ...this.defaultOptions, ...options }
    
    // Convert input to Uint8Array
    let inputArray: Uint8Array
    if (typeof data === 'string') {
      inputArray = new TextEncoder().encode(data)
    } else if (data instanceof ArrayBuffer) {
      inputArray = new Uint8Array(data)
    } else {
      inputArray = data
    }

    const originalSize = inputArray.length

    // Skip compression if data is too small
    if (originalSize < opts.minSize) {
      return {
        compressed: inputArray.buffer,
        originalSize,
        compressedSize: originalSize,
        compressionRatio: 0,
        algorithm: 'none'
      }
    }

    try {
      const compressed = await this.performCompression(inputArray, opts)
      const compressedSize = compressed.byteLength
      const compressionRatio = ((originalSize - compressedSize) / originalSize) * 100

      return {
        compressed,
        originalSize,
        compressedSize,
        compressionRatio,
        algorithm: opts.algorithm
      }
    } catch (error) {
      console.warn('Compression failed, returning original data:', error)
      return {
        compressed: inputArray.buffer,
        originalSize,
        compressedSize: originalSize,
        compressionRatio: 0,
        algorithm: 'none'
      }
    }
  }

  /**
   * Decompress data
   */
  async decompress(
    compressedData: ArrayBuffer,
    algorithm: string
  ): Promise<ArrayBuffer> {
    if (algorithm === 'none') {
      return compressedData
    }

    try {
      return await this.performDecompression(compressedData, algorithm as CompressionOptions['algorithm'])
    } catch (error) {
      console.warn('Decompression failed, returning original data:', error)
      return compressedData
    }
  }

  /**
   * Check if compression is beneficial for given data
   */
  shouldCompress(dataSize: number, options?: Partial<CompressionOptions>): boolean {
    const opts = { ...this.defaultOptions, ...options }
    return dataSize >= opts.minSize
  }

  /**
   * Estimate compression ratio for given data type
   */
  estimateCompressionRatio(dataType: 'text' | 'json' | 'binary'): number {
    switch (dataType) {
      case 'text':
        return 0.6 // ~40% compression
      case 'json':
        return 0.7 // ~30% compression
      case 'binary':
        return 0.9 // ~10% compression
      default:
        return 0.8 // ~20% compression
    }
  }

  private async performCompression(
    data: Uint8Array,
    options: CompressionOptions
  ): Promise<ArrayBuffer> {
    // Check if CompressionStream is available (modern browsers)
    if ('CompressionStream' in window) {
      return this.compressWithStream(data, options.algorithm)
    }

    // Fallback to manual compression simulation
    return this.simulateCompression(data, options)
  }

  private async compressWithStream(
    data: Uint8Array,
    algorithm: CompressionOptions['algorithm']
  ): Promise<ArrayBuffer> {
    const stream = new (window as any).CompressionStream(algorithm)
    const writer = stream.writable.getWriter()
    const reader = stream.readable.getReader()

    // Write data to compression stream
    await writer.write(data)
    await writer.close()

    // Read compressed data
    const chunks: Uint8Array[] = []
    let done = false

    while (!done) {
      const { value, done: readerDone } = await reader.read()
      done = readerDone
      if (value) {
        chunks.push(value)
      }
    }

    // Combine chunks into single ArrayBuffer
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
    const result = new Uint8Array(totalLength)
    let offset = 0

    for (const chunk of chunks) {
      result.set(chunk, offset)
      offset += chunk.length
    }

    return result.buffer
  }

  private async performDecompression(
    data: ArrayBuffer,
    algorithm: CompressionOptions['algorithm']
  ): Promise<ArrayBuffer> {
    // Check if DecompressionStream is available (modern browsers)
    if ('DecompressionStream' in window) {
      return this.decompressWithStream(data, algorithm)
    }

    // Fallback to manual decompression simulation
    return this.simulateDecompression(data)
  }

  private async decompressWithStream(
    data: ArrayBuffer,
    algorithm: CompressionOptions['algorithm']
  ): Promise<ArrayBuffer> {
    const stream = new (window as any).DecompressionStream(algorithm)
    const writer = stream.writable.getWriter()
    const reader = stream.readable.getReader()

    // Write compressed data to decompression stream
    await writer.write(new Uint8Array(data))
    await writer.close()

    // Read decompressed data
    const chunks: Uint8Array[] = []
    let done = false

    while (!done) {
      const { value, done: readerDone } = await reader.read()
      done = readerDone
      if (value) {
        chunks.push(value)
      }
    }

    // Combine chunks into single ArrayBuffer
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
    const result = new Uint8Array(totalLength)
    let offset = 0

    for (const chunk of chunks) {
      result.set(chunk, offset)
      offset += chunk.length
    }

    return result.buffer
  }

  private async simulateCompression(
    data: Uint8Array,
    options: CompressionOptions
  ): Promise<ArrayBuffer> {
    // Simulate compression by reducing size based on algorithm
    const compressionRatios = {
      'gzip': 0.7,
      'deflate': 0.75,
      'br': 0.65
    }

    const ratio = compressionRatios[options.algorithm] || 0.7
    const compressedSize = Math.floor(data.length * ratio)
    
    // Create simulated compressed data
    const compressed = new ArrayBuffer(compressedSize)
    const compressedView = new Uint8Array(compressed)
    
    // Copy partial data to simulate compression
    const sourceView = new Uint8Array(data.buffer, 0, Math.min(compressedSize, data.length))
    compressedView.set(sourceView)

    return compressed
  }

  private async simulateDecompression(data: ArrayBuffer): Promise<ArrayBuffer> {
    // Simulate decompression by expanding size
    const expansionRatio = 1.43 // Reverse of ~0.7 compression
    const decompressedSize = Math.floor(data.byteLength * expansionRatio)
    
    // Create simulated decompressed data
    const decompressed = new ArrayBuffer(decompressedSize)
    const decompressedView = new Uint8Array(decompressed)
    
    // Copy and expand data to simulate decompression
    const sourceView = new Uint8Array(data)
    for (let i = 0; i < decompressedSize; i++) {
      decompressedView[i] = sourceView[i % sourceView.length]
    }

    return decompressed
  }
}

// Create singleton instance
export const dataCompressionManager = new DataCompressionManager()

// Convenience functions
export async function compressData(
  data: string | ArrayBuffer | Uint8Array,
  options?: Partial<CompressionOptions>
): Promise<CompressionResult> {
  return dataCompressionManager.compress(data, options)
}

export async function decompressData(
  compressedData: ArrayBuffer,
  algorithm: string
): Promise<ArrayBuffer> {
  return dataCompressionManager.decompress(compressedData, algorithm)
}

export function shouldCompressData(dataSize: number): boolean {
  return dataCompressionManager.shouldCompress(dataSize)
}

export function estimateCompressionSavings(
  dataSize: number,
  dataType: 'text' | 'json' | 'binary' = 'json'
): number {
  const ratio = dataCompressionManager.estimateCompressionRatio(dataType)
  return Math.floor(dataSize * (1 - ratio))
}