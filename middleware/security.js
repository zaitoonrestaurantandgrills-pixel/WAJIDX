// WAJIDX Security & Rate Limiting Middleware
const crypto = require('node:crypto');

// In-Memory Rate Limiter Store
const rateLimitStore = new Map();

// Periodic cleanup of expired rate limit buckets (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of rateLimitStore.entries()) {
    if (data.resetTime <= now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

/**
 * Creates a rate limiter middleware for specific endpoints
 * @param {Object} options
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {number} options.max - Maximum allowed requests within windowMs
 * @param {string} options.message - Error message when rate limit is exceeded
 */
function createRateLimiter({ windowMs = 15 * 60 * 1000, max = 100, message = 'Too many requests, please try again later.' }) {
  return function rateLimiter(req, res, next) {
    // Get client IP address
    const ip = req.headers['cf-connecting-ip'] || 
               req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
               req.socket.remoteAddress || 
               'unknown-ip';

    const routeKey = `${req.baseUrl || ''}${req.path || ''}`;
    const key = `${ip}:${routeKey}`;
    const now = Date.now();

    let record = rateLimitStore.get(key);
    if (!record || record.resetTime <= now) {
      record = {
        count: 1,
        resetTime: now + windowMs
      };
      rateLimitStore.set(key, record);
    } else {
      record.count += 1;
    }

    const remaining = Math.max(0, max - record.count);
    const resetSeconds = Math.ceil((record.resetTime - now) / 1000);

    res.setHeader('RateLimit-Limit', max);
    res.setHeader('RateLimit-Remaining', remaining);
    res.setHeader('RateLimit-Reset', resetSeconds);

    if (record.count > max) {
      res.setHeader('Retry-After', resetSeconds);
      return res.status(429).json({
        success: false,
        error: message,
        retryAfter: resetSeconds
      });
    }

    next();
  };
}

// Pre-configured rate limiters
const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts
  message: 'Too many authentication attempts. Please try again in 15 minutes.'
});

const contactRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 messages
  message: 'Too many inquiries submitted from your IP. Please try again in 15 minutes.'
});

const apiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 180, // 180 requests per minute
  message: 'API rate limit exceeded. Please throttle your requests.'
});

/**
 * HTTP Security Headers Middleware
 */
function securityHeaders(req, res, next) {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Prevent Clickjacking
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  // Cross-Site Scripting protection
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions Policy (Camera, Geolocation, Microphone restricted)
  res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=(), payment=()');

  // HSTS (HTTP Strict Transport Security)
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  next();
}

/**
 * Timing-safe string comparison using SHA-256 digests
 * Prevents side-channel timing attacks on secret/password comparison
 */
function timingSafeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

/**
 * Sanitize string input to prevent Stored XSS in admin viewing panels
 */
function sanitizeInput(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

module.exports = {
  authRateLimiter,
  contactRateLimiter,
  apiRateLimiter,
  securityHeaders,
  timingSafeCompare,
  sanitizeInput
};
