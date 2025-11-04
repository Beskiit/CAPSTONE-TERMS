// Image URL utilities for handling image paths in production vs development

const API_BASE = (import.meta.env.VITE_API_BASE || "https://terms-api.kiri8tives.com").replace(/\/$/, "");

/**
 * Normalize image URLs to work correctly in both development and production
 * @param {string|object} img - Image string or object with url/filename
 * @returns {object} - Normalized image object with url and filename
 */
export function normalizeImageUrl(img) {
  console.log('🔍 [DEBUG] normalizeImageUrl input:', img);
  
  if (typeof img === "string") {
    // Handle blob URLs (temporary local URLs)
    if (img.startsWith('blob:')) {
      console.log('🔍 [DEBUG] Blob URL detected:', img);
      return { url: img, filename: 'temp-image' };
    }
    
    // Handle absolute URLs (http/https)
    const isAbsolute = /^https?:\/\//i.test(img);
    if (isAbsolute) {
      console.log('🔍 [DEBUG] Absolute URL detected:', img);
      return { url: img, filename: img.split("/").pop() || img };
    }
    
    // Handle relative paths
    const hasSlash = img.includes("/");
    const rel = hasSlash ? img : `uploads/accomplishments/${img}`;
    let url = `${API_BASE}${rel.startsWith('/') ? rel : `/${rel}`}`;
    // Avoid double-encoding: if already percent-encoded, leave it; otherwise encode spaces
    if (!url.includes('%')) url = url.replace(/\s/g, '%20');
    console.log('🔍 [DEBUG] Constructed URL from string:', url);
    return { url, filename: img.split("/").pop() || img };
  }
  
  if (typeof img === "object" && img !== null) {
    const raw = img.url || img.path || img.src || (img.filename ? `uploads/accomplishments/${img.filename}` : "");
    console.log('🔍 [DEBUG] Object raw value:', raw);
    
    // Handle blob URLs (temporary local URLs)
    if (raw && raw.startsWith('blob:')) {
      console.log('🔍 [DEBUG] Blob URL in object:', raw);
      return { url: raw, filename: img.filename || 'temp-image' };
    }
    
    const isAbsolute = /^https?:\/\//i.test(raw);
    let url = isAbsolute ? raw : (raw ? `${API_BASE}${raw.startsWith('/') ? raw : `/${raw}`}` : "");
    if (url && !url.includes('%')) url = url.replace(/\s/g, '%20');
    const filename = img.filename || (raw ? raw.split("/").pop() : "");
    console.log('🔍 [DEBUG] Final object URL:', url);
    return { url, filename };
  }
  
  console.log('🔍 [DEBUG] No valid image format found, returning empty');
  return { url: "", filename: "" };
}

/**
 * Normalize an array of images
 * @param {Array} images - Array of image strings or objects
 * @returns {Array} - Array of normalized image objects
 */
export function normalizeImages(images) {
  if (!Array.isArray(images)) return [];
  return images.map(normalizeImageUrl);
}

/**
 * Get the correct image URL for display
 * @param {string|object} img - Image string or object
 * @returns {string} - Full URL for the image
 */
export function getImageUrl(img) {
  const normalized = normalizeImageUrl(img);
  return normalized.url;
}

/**
 * Debug function to log image URL construction
 * @param {string|object} img - Image to debug
 * @param {string} context - Context for debugging
 */
export function debugImageUrl(img, context = "") {
  const normalized = normalizeImageUrl(img);
  console.log(`[Image Debug ${context}]`, {
    original: img,
    normalized,
    apiBase: API_BASE
  });
  return normalized;
}
