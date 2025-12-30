/**
 * Service Worker for Offline Functionality
 * 
 * Provides asset caching, offline page detection, and background sync
 * for the event management platform.
 */

const CACHE_NAME = 'event-platform-v1'
const STATIC_CACHE = 'static-v1'
const DYNAMIC_CACHE = 'dynamic-v1'

// Essential assets to cache for offline functionality
const ESSENTIAL_ASSETS = [
  '/',
  '/index.html',
  '/src/main.ts',
  '/src/style.css',
  '/public/fonts/sora-latin.woff2',
  '/public/fonts/worksans-latin.woff2',
  '/public/icons/home.svg',
  '/public/icons/arrow-left.svg'
]

// Routes that should work offline (cached pages)
const OFFLINE_ROUTES = [
  '/',
  '/events',
  '/me/profile',
  '/me/teams'
]

// API endpoints to cache
const CACHEABLE_APIS = [
  '/rest/v1/events',
  '/rest/v1/profiles',
  '/rest/v1/teams'
]

/**
 * Install event - cache essential assets
 */
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...')
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('Service Worker: Caching essential assets')
        return cache.addAll(ESSENTIAL_ASSETS)
      })
      .then(() => {
        console.log('Service Worker: Essential assets cached')
        return self.skipWaiting()
      })
      .catch((error) => {
        console.error('Service Worker: Failed to cache essential assets', error)
      })
  )
})

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...')
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('Service Worker: Deleting old cache', cacheName)
              return caches.delete(cacheName)
            }
          })
        )
      })
      .then(() => {
        console.log('Service Worker: Activated')
        return self.clients.claim()
      })
  )
})

/**
 * Fetch event - implement caching strategies
 */
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return
  }
  
  // Skip chrome-extension and other non-http requests
  if (!url.protocol.startsWith('http')) {
    return
  }
  
  event.respondWith(handleFetch(request))
})

/**
 * Handle fetch requests with appropriate caching strategy
 */
async function handleFetch(request) {
  const url = new URL(request.url)
  
  try {
    // Strategy 1: Cache-first for static assets
    if (isStaticAsset(url)) {
      return await cacheFirst(request)
    }
    
    // Strategy 2: Network-first for API calls
    if (isApiCall(url)) {
      return await networkFirst(request)
    }
    
    // Strategy 3: Stale-while-revalidate for pages
    if (isPageRequest(request)) {
      return await staleWhileRevalidate(request)
    }
    
    // Default: Network-first
    return await networkFirst(request)
    
  } catch (error) {
    console.error('Service Worker: Fetch error', error)
    
    // Return offline fallback if available
    return await getOfflineFallback(request)
  }
}

/**
 * Cache-first strategy for static assets
 */
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request)
  
  if (cachedResponse) {
    return cachedResponse
  }
  
  try {
    const networkResponse = await fetch(request)
    
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE)
      cache.put(request, networkResponse.clone())
    }
    
    return networkResponse
  } catch (error) {
    console.error('Service Worker: Network error for static asset', error)
    throw error
  }
}

/**
 * Network-first strategy for API calls
 */
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request)
    
    if (networkResponse.ok && isCacheableApi(request)) {
      const cache = await caches.open(DYNAMIC_CACHE)
      cache.put(request, networkResponse.clone())
    }
    
    return networkResponse
  } catch (error) {
    console.log('Service Worker: Network failed, trying cache', error)
    
    const cachedResponse = await caches.match(request)
    if (cachedResponse) {
      // Add offline indicator header
      const response = cachedResponse.clone()
      response.headers.set('X-Served-From-Cache', 'true')
      return response
    }
    
    throw error
  }
}

/**
 * Stale-while-revalidate strategy for pages
 */
async function staleWhileRevalidate(request) {
  const cachedResponse = await caches.match(request)
  
  // Always try to fetch from network in background
  const networkPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        const cache = caches.open(DYNAMIC_CACHE)
        cache.then(c => c.put(request, networkResponse.clone()))
      }
      return networkResponse
    })
    .catch(() => null)
  
  // Return cached version immediately if available
  if (cachedResponse) {
    // Don't wait for network update
    networkPromise.catch(() => {}) // Prevent unhandled rejection
    return cachedResponse
  }
  
  // If no cache, wait for network
  const networkResponse = await networkPromise
  if (networkResponse) {
    return networkResponse
  }
  
  // Return offline fallback
  return await getOfflineFallback(request)
}

/**
 * Get offline fallback response
 */
async function getOfflineFallback(request) {
  const url = new URL(request.url)
  
  // For page requests, try to return cached index.html with offline indicator
  if (isPageRequest(request)) {
    const cachedIndex = await caches.match('/')
    if (cachedIndex) {
      // Clone and modify response to indicate offline status
      const response = cachedIndex.clone()
      response.headers.set('X-Offline-Page', 'true')
      return response
    }
  }
  
  // For API requests, return a structured offline response
  if (isApiCall(url)) {
    return new Response(
      JSON.stringify({
        error: 'offline',
        message: 'This request is not available offline',
        offline: true
      }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: {
          'Content-Type': 'application/json',
          'X-Offline-Response': 'true'
        }
      }
    )
  }
  
  // Default offline page
  return new Response(
    `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Offline - Event Platform</title>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          text-align: center; 
          padding: 2rem;
          background: #f7f3ec;
          color: #1f2421;
        }
        .offline-container {
          max-width: 400px;
          margin: 2rem auto;
          padding: 2rem;
          background: rgba(255, 255, 255, 0.86);
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
        .offline-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
        }
        .offline-title {
          font-size: 1.5rem;
          font-weight: 600;
          margin-bottom: 1rem;
          color: #1f6f6d;
        }
        .offline-message {
          margin-bottom: 1.5rem;
          line-height: 1.5;
        }
        .retry-button {
          background: #1f6f6d;
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 8px;
          cursor: pointer;
          font-size: 1rem;
        }
        .retry-button:hover {
          background: #1a5d5b;
        }
      </style>
    </head>
    <body>
      <div class="offline-container">
        <div class="offline-icon">📡</div>
        <h1 class="offline-title">You're Offline</h1>
        <p class="offline-message">
          This page is not available offline. Please check your internet connection and try again.
        </p>
        <button class="retry-button" onclick="window.location.reload()">
          Try Again
        </button>
      </div>
    </body>
    </html>
    `,
    {
      status: 503,
      statusText: 'Service Unavailable',
      headers: {
        'Content-Type': 'text/html',
        'X-Offline-Page': 'true'
      }
    }
  )
}

/**
 * Check if request is for a static asset
 */
function isStaticAsset(url) {
  const staticExtensions = ['.css', '.js', '.woff2', '.woff', '.ttf', '.svg', '.png', '.jpg', '.jpeg', '.ico']
  return staticExtensions.some(ext => url.pathname.endsWith(ext))
}

/**
 * Check if request is an API call
 */
function isApiCall(url) {
  return url.pathname.startsWith('/rest/') || 
         url.pathname.startsWith('/auth/') ||
         url.pathname.startsWith('/storage/')
}

/**
 * Check if API call should be cached
 */
function isCacheableApi(request) {
  const url = new URL(request.url)
  return CACHEABLE_APIS.some(api => url.pathname.startsWith(api))
}

/**
 * Check if request is for a page
 */
function isPageRequest(request) {
  const url = new URL(request.url)
  return request.headers.get('Accept')?.includes('text/html') ||
         url.pathname === '/' ||
         !url.pathname.includes('.')
}

/**
 * Background sync for form submissions
 */
self.addEventListener('sync', (event) => {
  console.log('Service Worker: Background sync triggered', event.tag)
  
  if (event.tag === 'form-submission') {
    event.waitUntil(syncFormSubmissions())
  }
})

/**
 * Sync pending form submissions when back online
 */
async function syncFormSubmissions() {
  try {
    // Get pending submissions from IndexedDB
    const pendingSubmissions = await getPendingSubmissions()
    
    for (const submission of pendingSubmissions) {
      try {
        const response = await fetch(submission.url, {
          method: submission.method,
          headers: submission.headers,
          body: submission.body
        })
        
        if (response.ok) {
          // Remove from pending submissions
          await removePendingSubmission(submission.id)
          console.log('Service Worker: Successfully synced submission', submission.id)
        }
      } catch (error) {
        console.error('Service Worker: Failed to sync submission', submission.id, error)
      }
    }
  } catch (error) {
    console.error('Service Worker: Background sync failed', error)
  }
}

/**
 * Get pending submissions from IndexedDB
 */
async function getPendingSubmissions() {
  // This would integrate with IndexedDB
  // For now, return empty array as placeholder
  return []
}

/**
 * Remove pending submission from IndexedDB
 */
async function removePendingSubmission(id) {
  // This would integrate with IndexedDB
  // Placeholder implementation
  console.log('Service Worker: Would remove pending submission', id)
}

/**
 * Handle push notifications (future enhancement)
 */
self.addEventListener('push', (event) => {
  console.log('Service Worker: Push notification received', event)
  
  // This would handle push notifications for offline users
  // when they come back online
})

/**
 * Handle notification clicks
 */
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification clicked', event)
  
  event.notification.close()
  
  // This would handle navigation when user clicks notifications
  event.waitUntil(
    self.clients.openWindow('/')
  )
})

console.log('Service Worker: Script loaded')