// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { precacheAndRoute } from 'workbox-precaching';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { registerRoute } from 'workbox-routing';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { ExpirationPlugin } from 'workbox-expiration';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

// Precache all assets generated by your build process
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
precacheAndRoute(self.__WB_MANIFEST);

// Cache images with a Cache First strategy
registerRoute(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ({ request, url }: { request: any, url: any }) => {
    // Skip unsupported URL schemes
    if (url.protocol === 'chrome-extension:' || 
        url.protocol === 'chrome:' ||
        url.protocol === 'edge:' ||
        url.protocol === 'brave:') {
      return false;
    }
    return request.destination === 'image';
  },
  new CacheFirst({
    cacheName: 'images',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
);

// Cache CSS and JavaScript with a Stale While Revalidate strategy
registerRoute(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ({ request, url }: { request: any, url: any }) => {
    // Skip unsupported URL schemes
    if (url.protocol === 'chrome-extension:' || 
        url.protocol === 'chrome:' ||
        url.protocol === 'edge:' ||
        url.protocol === 'brave:') {
      return false;
    }
    return request.destination === 'script' ||
           request.destination === 'style';
  },
  new StaleWhileRevalidate({
    cacheName: 'static-resources',
  })
);

// Enhanced caching for HomePage and RoutinePage
registerRoute(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ({ url }: { url: any }) => {
    // Skip unsupported URL schemes
    if (url.protocol === 'chrome-extension:' || 
        url.protocol === 'chrome:' ||
        url.protocol === 'edge:' ||
        url.protocol === 'brave:') {
      return false;
    }
    return url.pathname === '/' || 
           url.pathname === '/routine' || 
           url.pathname.startsWith('/static/');
  },
  new StaleWhileRevalidate({
    cacheName: 'app-pages',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 20,
        maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
      }),
    ],
  })
);

// Cache API calls with a Network First strategy
registerRoute(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ({ url }: { url: any }) => {
    // Skip unsupported URL schemes
    if (url.protocol === 'chrome-extension:' || 
        url.protocol === 'chrome:' ||
        url.protocol === 'edge:' ||
        url.protocol === 'brave:') {
      return false;
    }
    return url.pathname.startsWith('/api/');
  },
  new NetworkFirst({
    cacheName: 'api-responses',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 24 * 60 * 60, // 24 hours
      }),
    ],
  })
);

// Cache data requests for homepage and routine page with specific caching strategy
registerRoute(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ({ url }: { url: any }) => {
    // Skip unsupported URL schemes
    if (url.protocol === 'chrome-extension:' || 
        url.protocol === 'chrome:' ||
        url.protocol === 'edge:' ||
        url.protocol === 'brave:') {
      return false;
    } 
    return url.pathname.includes('/task') || 
           url.pathname.includes('/routine') || 
           url.pathname.includes('/user');
  },
  new NetworkFirst({
    cacheName: 'app-data',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 12 * 60 * 60, // 12 hours
      }),
    ],
  })
);

// Add a utility function at the beginning of the file 
// to safely check if a URL can be cached
function isValidCacheURL(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const validProtocols = ['http:', 'https:'];
    return validProtocols.includes(urlObj.protocol);
  } catch (e) {
    console.error('Invalid URL:', url, e);
    return false;
  }
}

// Handle offline fallback
const OFFLINE_PAGE = '/offline.html';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
self.addEventListener('install', (event: any) => {
  event.waitUntil(
    caches.open('offline-cache').then((cache) => {
      return cache.add(OFFLINE_PAGE);
    })
  );
});

// Improved fetch event handling
// eslint-disable-next-line @typescript-eslint/no-explicit-any
self.addEventListener('fetch', (event: any) => {
  // Skip cross-origin requests and unsupported URL schemes
  if (!event.request.url.startsWith(self.location.origin) || 
      event.request.url.startsWith('chrome-extension://') ||
      event.request.url.startsWith('chrome://') ||
      event.request.url.startsWith('edge://') ||
      event.request.url.startsWith('brave://') ||
      !isValidCacheURL(event.request.url)) {
    return;
  }

  // Handle navigation requests
  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          // Try to perform a normal navigation
          const preloadResponse = await event.preloadResponse;
          if (preloadResponse) {
            return preloadResponse;
          }

          // Try the network first for navigation
          return await fetch(event.request);
        } catch (error) {
          // If network fails, try to get the page from cache
          const cache = await caches.open('app-pages');
          const cachedResponse = await cache.match(event.request);
          if (cachedResponse) {
            return cachedResponse;
          }

          // If the page isn't in cache, return the offline page
          const offlineCache = await caches.open('offline-cache');
          const offlineResponse = await offlineCache.match(OFFLINE_PAGE);
          return offlineResponse;
        }
      })()
    );
  }
});

// Background sync for offline operations
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const bgSyncPlugin = new workbox.backgroundSync.BackgroundSyncPlugin('offlineQueue', {
  maxRetentionTime: 24 * 60 // Retry for up to 24 Hours
});

// Replace regex-based route with callback function to properly check URL
registerRoute(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ({ url }: { url: any }) => {
    // Skip unsupported URL schemes
    if (url.protocol === 'chrome-extension:' || 
        url.protocol === 'chrome:' ||
        url.protocol === 'edge:' ||
        url.protocol === 'brave:') {
      return false;
    }
    return url.pathname.match(/\/api\/.*/);
  },
  new NetworkFirst({
    plugins: [bgSyncPlugin]
  }),
  'POST'
);

// Add a global error handler to catch unexpected errors
self.addEventListener('error', (event) => {
  console.error('Service Worker error:', event.error);
});

// Add an unhandled rejection handler
self.addEventListener('unhandledrejection', (event) => {
  console.error('Service Worker unhandled rejection:', event.reason);
});