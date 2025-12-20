// Simple Service Worker for Offline Capabilities
const CACHE_NAME = 'ebuch-cache-v1';
const urlsToCache = [
  './',
  './index.html',
    // Add paths to your local libs here if you want them to work offline:
    'libs/katex/katex.min.css',
    'libs/katex/katex.min.js',
    'libs/katex/contrib/auto-render.min.js',
    'libs/marked/marked.min.js',
    'libs/pdfjs/pdf.min.js',
    'libs/html-docx/html-docx.min.js"',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request);
      })
  );
});