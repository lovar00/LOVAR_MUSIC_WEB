const CACHE_NAME = 'lovar-music-v1.0.0';
const STATIC_CACHE = 'lovar-static-v1.0.0';
const DYNAMIC_CACHE = 'lovar-dynamic-v1.0.0';
const MUSIC_CACHE = 'lovar-music-files-v1.0.0';

// Files to cache for offline use
const STATIC_FILES = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  // Add more static assets as needed
];

// API endpoints to cache
const CACHE_API_ROUTES = [
  '/api/auth/me',
  '/api/music/trending',
  '/api/music/new-releases',
  '/api/playlists/featured',
];

// Maximum cache size for different types
const MAX_CACHE_SIZE = {
  static: 50,
  dynamic: 100,
  music: 20 // Music files (limited due to size)
};

// Install event - cache static files
self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('Service Worker: Caching static files');
        return cache.addAll(STATIC_FILES);
      })
      .then(() => {
        console.log('Service Worker: Static files cached');
        self.skipWaiting();
      })
      .catch(err => {
        console.error('Service Worker: Error caching static files', err);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== STATIC_CACHE && 
              cacheName !== DYNAMIC_CACHE && 
              cacheName !== MUSIC_CACHE) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker: Activated');
      self.clients.claim();
    })
  );
});

// Fetch event - serve cached content when offline
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Handle music file requests
  if (url.pathname.includes('/uploads/music/')) {
    event.respondWith(handleMusicRequest(request));
    return;
  }

  // Handle image requests
  if (url.pathname.includes('/uploads/images/')) {
    event.respondWith(handleImageRequest(request));
    return;
  }

  // Handle navigation requests
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  // Handle static files
  event.respondWith(handleStaticRequest(request));
});

// Handle API requests with network-first strategy
async function handleApiRequest(request) {
  const cacheName = DYNAMIC_CACHE;
  
  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cache successful responses
      const cache = await caches.open(cacheName);
      
      // Only cache GET requests for specific routes
      if (request.method === 'GET' && 
          CACHE_API_ROUTES.some(route => request.url.includes(route))) {
        cache.put(request, networkResponse.clone());
      }
      
      return networkResponse;
    }
    
    // If network response is not ok, try cache
    const cachedResponse = await caches.match(request);
    return cachedResponse || createOfflineResponse();
    
  } catch (error) {
    console.log('Service Worker: Network failed, trying cache', error);
    
    // Network failed, try cache
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline response for specific endpoints
    if (request.url.includes('/api/auth/me')) {
      return createOfflineUserResponse();
    }
    
    return createOfflineResponse();
  }
}

// Handle music file requests with cache-first strategy
async function handleMusicRequest(request) {
  const cacheName = MUSIC_CACHE;
  
  try {
    // Check cache first
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      console.log('Service Worker: Serving music from cache');
      return cachedResponse;
    }
    
    // If not in cache, fetch from network
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cache the music file
      const cache = await caches.open(cacheName);
      
      // Check cache size before adding
      await limitCacheSize(cacheName, MAX_CACHE_SIZE.music);
      
      cache.put(request, networkResponse.clone());
      console.log('Service Worker: Music file cached');
    }
    
    return networkResponse;
    
  } catch (error) {
    console.log('Service Worker: Music request failed', error);
    return createOfflineMusicResponse();
  }
}

// Handle image requests with cache-first strategy
async function handleImageRequest(request) {
  const cacheName = DYNAMIC_CACHE;
  
  try {
    // Check cache first
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Fetch from network
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
    
  } catch (error) {
    // Return placeholder image for offline
    return createPlaceholderImage();
  }
}

// Handle navigation requests
async function handleNavigationRequest(request) {
  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      return networkResponse;
    }
    
    // Fallback to cached index.html
    const cachedResponse = await caches.match('/');
    return cachedResponse || createOfflinePageResponse();
    
  } catch (error) {
    // Network failed, serve cached version
    const cachedResponse = await caches.match('/');
    return cachedResponse || createOfflinePageResponse();
  }
}

// Handle static file requests
async function handleStaticRequest(request) {
  try {
    // Check cache first for static files
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Fetch from network
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
    
  } catch (error) {
    // Try to serve from cache
    const cachedResponse = await caches.match(request);
    return cachedResponse || new Response('Offline', { status: 503 });
  }
}

// Utility functions
async function limitCacheSize(cacheName, maxSize) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  
  if (keys.length > maxSize) {
    // Remove oldest entries
    const keysToDelete = keys.slice(0, keys.length - maxSize);
    await Promise.all(keysToDelete.map(key => cache.delete(key)));
  }
}

function createOfflineResponse() {
  return new Response(
    JSON.stringify({
      error: 'Offline',
      message: 'You are currently offline. Some features may not be available.'
    }),
    {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}

function createOfflineUserResponse() {
  // Return cached user data if available
  return new Response(
    JSON.stringify({
      user: {
        username: 'Offline User',
        email: 'offline@example.com',
        userType: 'NORMAL',
        isOffline: true
      }
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}

function createOfflineMusicResponse() {
  return new Response(
    'Music file not available offline',
    {
      status: 503,
      headers: { 'Content-Type': 'text/plain' }
    }
  );
}

function createPlaceholderImage() {
  // Create a simple SVG placeholder
  const svg = `
    <svg width="300" height="300" xmlns="http://www.w3.org/2000/svg">
      <rect width="300" height="300" fill="#1e293b"/>
      <text x="150" y="150" font-family="Arial" font-size="16" fill="#64748b" text-anchor="middle">
        Image unavailable offline
      </text>
    </svg>
  `;
  
  return new Response(svg, {
    headers: { 'Content-Type': 'image/svg+xml' }
  });
}

function createOfflinePageResponse() {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>LOVAR MUSIC - Offline</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body {
          font-family: Arial, sans-serif;
          background: #0f172a;
          color: white;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          margin: 0;
          text-align: center;
        }
        .offline-container {
          max-width: 400px;
          padding: 2rem;
        }
        .offline-icon {
          font-size: 4rem;
          margin-bottom: 1rem;
        }
        h1 {
          color: #8b5cf6;
          margin-bottom: 1rem;
        }
        p {
          color: #64748b;
          margin-bottom: 2rem;
        }
        button {
          background: linear-gradient(to right, #8b5cf6, #ec4899);
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 16px;
        }
      </style>
    </head>
    <body>
      <div class="offline-container">
        <div class="offline-icon">🎵</div>
        <h1>LOVAR MUSIC</h1>
        <p>You're currently offline. Please check your internet connection and try again.</p>
        <button onclick="window.location.reload()">Retry</button>
      </div>
    </body>
    </html>
  `;
  
  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}

// Background sync for uploading when back online
self.addEventListener('sync', event => {
  console.log('Service Worker: Background sync triggered', event.tag);
  
  if (event.tag === 'background-sync-upload') {
    event.waitUntil(processOfflineUploads());
  }
});

async function processOfflineUploads() {
  // Process any queued uploads when back online
  try {
    const uploads = await getQueuedUploads();
    
    for (const upload of uploads) {
      try {
        await fetch(upload.url, upload.options);
        await removeQueuedUpload(upload.id);
        
        // Notify the client
        self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({
              type: 'UPLOAD_COMPLETE',
              data: upload
            });
          });
        });
        
      } catch (error) {
        console.error('Failed to process queued upload:', error);
      }
    }
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}

// Push notification handling
self.addEventListener('push', event => {
  console.log('Service Worker: Push notification received');
  
  let data = {};
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (error) {
      console.error('Error parsing push data:', error);
      data = { title: 'LOVAR MUSIC', body: 'New notification' };
    }
  }
  
  const options = {
    title: data.title || 'LOVAR MUSIC',
    body: data.body || 'You have a new notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    tag: data.tag || 'default',
    data: data.data || {},
    actions: [
      {
        action: 'open',
        title: 'Open App'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ],
    requireInteraction: false,
    silent: false
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'LOVAR MUSIC', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  console.log('Service Worker: Notification clicked');
  
  event.notification.close();
  
  if (event.action === 'dismiss') {
    return;
  }
  
  // Open the app
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      // Check if app is already open
      for (const client of clients) {
        if (client.url === self.registration.scope && 'focus' in client) {
          return client.focus();
        }
      }
      
      // Open new window
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});

// Message handling from main thread
self.addEventListener('message', event => {
  console.log('Service Worker: Message received', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_MUSIC') {
    // Cache specific music file
    event.waitUntil(cacheMusic(event.data.url));
  }
});

async function cacheMusic(url) {
  try {
    const cache = await caches.open(MUSIC_CACHE);
    await cache.add(url);
    console.log('Service Worker: Music cached successfully', url);
  } catch (error) {
    console.error('Service Worker: Failed to cache music', error);
  }
}

// Placeholder functions for queued uploads (would need IndexedDB implementation)
async function getQueuedUploads() {
  // Return empty array for now - implement with IndexedDB
  return [];
}

async function removeQueuedUpload(id) {
  // Implement with IndexedDB
  console.log('Removing queued upload:', id);
}