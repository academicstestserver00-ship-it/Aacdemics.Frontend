// src/config.js
const rawBaseUrl = import.meta.env.VITE_BACKEND_URL;
export const API_BASE = rawBaseUrl ? rawBaseUrl.replace(/\/+$/, '') : undefined;

if (!API_BASE) {
  // eslint-disable-next-line no-console
  console.warn('VITE_BACKEND_URL is not set. API requests will fail.');
}
