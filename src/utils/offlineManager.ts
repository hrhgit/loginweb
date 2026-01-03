/**
 * Offline Manager
 * 
 * Manages offline functionality including form data storage,
 * offline page detection, and background sync coordination.
 */

import { ref, computed, type Ref } from 'vue'

// Types for offline functionality
export interface OfflineFormData {
  id: string
  formType: string
  data: Record<string, any>
  timestamp: number
  url?: string
  method?: string
}

export interface OfflineIndicator {
  isVisible: boolean
  message: string
  type: 'info' | 'warning' | 'error' | 'success'
}

export interface OfflineCapability {
  canViewCachedPages: boolean
  canSubmitForms: boolean
  canAccessFeatures: string[]
  unavailableFeatures: string[]
}

/**
 * IndexedDB wrapper for offline form storage
 */
class OfflineStorage {
  private dbName = 'EventPlatformOffline'
  private version = 1
  private db: IDBDatabase | null = null

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Create form data store
        if (!db.objectStoreNames.contains('formData')) {
          const formStore = db.createObjectStore('formData', { keyPath: 'id' })
          formStore.createIndex('formType', 'formType', { unique: false })
          formStore.createIndex('timestamp', 'timestamp', { unique: false })
        }

        // Create pending submissions store
        if (!db.objectStoreNames.contains('pendingSubmissions')) {
          const submissionStore = db.createObjectStore('pendingSubmissions', { keyPath: 'id' })
          submissionStore.createIndex('timestamp', 'timestamp', { unique: false })
        }
      }
    })
  }

  async storeFormData(formData: OfflineFormData): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['formData'], 'readwrite')
      const store = transaction.objectStore('formData')
      const request = store.put(formData)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async getFormData(id: string): Promise<OfflineFormData | null> {
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['formData'], 'readonly')
      const store = transaction.objectStore('formData')
      const request = store.get(id)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result || null)
    })
  }

  async getAllFormData(): Promise<OfflineFormData[]> {
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['formData'], 'readonly')
      const store = transaction.objectStore('formData')
      const request = store.getAll()

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result || [])
    })
  }

  async removeFormData(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['formData'], 'readwrite')
      const store = transaction.objectStore('formData')
      const request = store.delete(id)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async clearExpiredData(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    const cutoffTime = Date.now() - maxAge

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['formData'], 'readwrite')
      const store = transaction.objectStore('formData')
      const index = store.index('timestamp')
      const range = IDBKeyRange.upperBound(cutoffTime)
      const request = index.openCursor(range)

      request.onerror = () => reject(request.error)
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        if (cursor) {
          cursor.delete()
          cursor.continue()
        } else {
          resolve()
        }
      }
    })
  }
}

/**
 * Main offline manager class
 */
export class OfflineManager {
  private storage: OfflineStorage
  private isOffline: Ref<boolean>
  private serviceWorkerRegistration: ServiceWorkerRegistration | null = null

  constructor() {
    this.storage = new OfflineStorage()
    this.isOffline = ref(!navigator.onLine)
    
    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.isOffline.value = false
      this.handleConnectivityRestored()
    })
    
    window.addEventListener('offline', () => {
      this.isOffline.value = true
    })
  }

  async init(): Promise<void> {
    try {
      await this.storage.init()
      await this.registerServiceWorker()
      await this.storage.clearExpiredData()
      console.log('Offline Manager: Initialized successfully')
    } catch (error) {
      console.error('Offline Manager: Initialization failed', error)
    }
  }

  private async registerServiceWorker(): Promise<void> {
    // Only register service worker in production to avoid interference with HMR and dev server proxies
    if (import.meta.env.DEV) {
      console.log('Service Worker registration skipped in development mode')
      return
    }

    if ('serviceWorker' in navigator) {
      try {
        this.serviceWorkerRegistration = await navigator.serviceWorker.register('/sw.js')
        console.log('Service Worker registered successfully')

        // Listen for service worker updates
        this.serviceWorkerRegistration.addEventListener('updatefound', () => {
          console.log('Service Worker update found')
        })
      } catch (error) {
        console.error('Service Worker registration failed', error)
      }
    }
  }

  get offline(): boolean {
    return this.isOffline.value
  }

  get online(): boolean {
    return !this.isOffline.value
  }

  /**
   * Store form data for offline submission
   */
  async storeFormData(
    formId: string,
    formType: string,
    data: Record<string, any>,
    submissionUrl?: string,
    method: string = 'POST'
  ): Promise<OfflineIndicator> {
    try {
      const formData: OfflineFormData = {
        id: formId,
        formType,
        data,
        timestamp: Date.now(),
        url: submissionUrl,
        method
      }

      await this.storage.storeFormData(formData)

      if (this.offline) {
        return {
          isVisible: true,
          message: 'Form data saved locally. Internet connection required for submission.',
          type: 'warning'
        }
      } else {
        return {
          isVisible: true,
          message: 'Form data saved successfully.',
          type: 'success'
        }
      }
    } catch (error) {
      console.error('Failed to store form data', error)
      return {
        isVisible: true,
        message: 'Failed to save form data locally.',
        type: 'error'
      }
    }
  }

  /**
   * Get stored form data
   */
  async getStoredFormData(formId: string): Promise<OfflineFormData | null> {
    try {
      return await this.storage.getFormData(formId)
    } catch (error) {
      console.error('Failed to get stored form data', error)
      return null
    }
  }

  /**
   * Get all stored forms
   */
  async getAllStoredForms(): Promise<OfflineFormData[]> {
    try {
      return await this.storage.getAllFormData()
    } catch (error) {
      console.error('Failed to get all stored forms', error)
      return []
    }
  }

  /**
   * Remove stored form data
   */
  async removeStoredFormData(formId: string): Promise<void> {
    try {
      await this.storage.removeFormData(formId)
    } catch (error) {
      console.error('Failed to remove stored form data', error)
    }
  }

  /**
   * Get offline capability information
   */
  getOfflineCapability(): OfflineCapability {
    const availableFeatures = [
      'view-cached-events',
      'view-cached-profile',
      'view-cached-teams',
      'edit-profile-offline',
      'create-team-offline'
    ]

    const unavailableFeatures = [
      'submit-forms',
      'upload-files',
      'real-time-updates',
      'search-users',
      'send-invitations'
    ]

    return {
      canViewCachedPages: true,
      canSubmitForms: this.online,
      canAccessFeatures: this.online ? [...availableFeatures, ...unavailableFeatures] : availableFeatures,
      unavailableFeatures: this.offline ? unavailableFeatures : []
    }
  }

  /**
   * Get offline indicator for current state
   */
  getOfflineIndicator(context: string = 'general'): OfflineIndicator {
    if (this.offline) {
      const contextMessages = {
        general: 'You are currently offline. Some features may not be available.',
        form: 'Cannot submit forms while offline. Data will be saved locally.',
        page: 'You are viewing cached content while offline.',
        feature: 'This feature requires an internet connection.'
      }

      return {
        isVisible: true,
        message: contextMessages[context as keyof typeof contextMessages] || contextMessages.general,
        type: 'warning'
      }
    }

    return {
      isVisible: false,
      message: '',
      type: 'info'
    }
  }

  /**
   * Check if a page is available offline
   */
  async isPageAvailableOffline(url: string): Promise<boolean> {
    if (this.online) return true

    try {
      const cache = await caches.open('dynamic-v1')
      const response = await cache.match(url)
      return !!response
    } catch (error) {
      console.error('Failed to check offline page availability', error)
      return false
    }
  }

  /**
   * Request background sync for pending submissions
   */
  async requestBackgroundSync(): Promise<void> {
    if (this.serviceWorkerRegistration && 'sync' in this.serviceWorkerRegistration) {
      try {
        // Type assertion for sync property
        const registration = this.serviceWorkerRegistration as any
        await registration.sync.register('form-submission')
        console.log('Background sync requested')
      } catch (error) {
        console.error('Failed to request background sync', error)
      }
    }
  }

  /**
   * Handle connectivity restoration
   */
  private async handleConnectivityRestored(): Promise<void> {
    console.log('Connectivity restored')
    
    try {
      // Request background sync for pending submissions
      await this.requestBackgroundSync()
      
      // Notify about restored connectivity
      const storedForms = await this.getAllStoredForms()
      if (storedForms.length > 0) {
        console.log(`Found ${storedForms.length} stored forms that can now be submitted`)
      }
    } catch (error) {
      console.error('Error handling connectivity restoration', error)
    }
  }

  /**
   * Get connectivity restoration indicator
   */
  getConnectivityRestoredIndicator(): OfflineIndicator {
    return {
      isVisible: true,
      message: 'Connection restored! You can now submit your saved forms.',
      type: 'success'
    }
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    window.removeEventListener('online', () => {})
    window.removeEventListener('offline', () => {})
  }
}

// Create singleton instance
export const offlineManager = new OfflineManager()

// Composable for Vue components
export function useOfflineManager() {
  const isOffline = computed(() => offlineManager.offline)
  const isOnline = computed(() => offlineManager.online)
  
  return {
    isOffline,
    isOnline,
    offlineManager,
    
    // Convenience methods
    storeFormData: offlineManager.storeFormData.bind(offlineManager),
    getStoredFormData: offlineManager.getStoredFormData.bind(offlineManager),
    getAllStoredForms: offlineManager.getAllStoredForms.bind(offlineManager),
    removeStoredFormData: offlineManager.removeStoredFormData.bind(offlineManager),
    getOfflineCapability: offlineManager.getOfflineCapability.bind(offlineManager),
    getOfflineIndicator: offlineManager.getOfflineIndicator.bind(offlineManager),
    isPageAvailableOffline: offlineManager.isPageAvailableOffline.bind(offlineManager)
  }
}