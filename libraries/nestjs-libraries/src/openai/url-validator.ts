/**
 * URL Validation Utilities
 * Provides SSRF (Server-Side Request Forgery) protection for external API calls
 */

/**
 * Error thrown when a URL fails security validation
 */
export class URLValidationError extends Error {
  constructor(message: string) {
    super(`URL validation failed: ${message}`);
    this.name = 'URLValidationError';
  }
}

/**
 * IPv4 address patterns that should be blocked (private/local networks)
 */
const PRIVATE_IP_PATTERNS = [
  /^127\./, // Loopback (127.0.0.0/8)
  /^10\./, // Private Class A (10.0.0.0/8)
  /^172\.(1[6-9]|2\d|3[01])\./, // Private Class B (172.16.0.0/12)
  /^192\.168\./, // Private Class C (192.168.0.0/16)
  /^169\.254\./, // Link-local (169.254.0.0/16)
  /^0\./, // Current network (0.0.0.0/8)
];

/**
 * Hostnames that should be blocked
 */
const BLOCKED_HOSTNAMES = [
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback',
  // Local hostname patterns
  /^.*\.local$/,
  /^.*\.localhost$/,
];

/**
 * Validate a URL for SSRF protection before making external requests
 * @param url - The URL to validate
 * @throws URLValidationError if the URL fails validation
 * @returns The validated URL string
 */
export function validateExternalUrl(url: string): string {
  if (!url || typeof url !== 'string') {
    throw new URLValidationError('URL must be a non-empty string');
  }

  // Trim whitespace
  const trimmedUrl = url.trim();

  // Check for dangerous protocols
  if (trimmedUrl.startsWith('file://')) {
    throw new URLValidationError('file:// protocol is not allowed');
  }

  if (trimmedUrl.startsWith('ftp://')) {
    throw new URLValidationError('ftp:// protocol is not allowed');
  }

  if (trimmedUrl.startsWith('://')) {
    throw new URLValidationError('Protocol-relative URLs are not allowed');
  }

  // Enforce HTTPS for production security
  // Allow http:// only for localhost/127.0.0.1 in development
  const isDevelopment = process.env.NODE_ENV !== 'production';

  if (!trimmedUrl.startsWith('https://') && !trimmedUrl.startsWith('http://')) {
    throw new URLValidationError('URL must use https:// or http:// protocol');
  }

  // In production, require HTTPS
  if (!isDevelopment && trimmedUrl.startsWith('http://')) {
    throw new URLValidationError('Production environments require HTTPS URLs');
  }

  // Parse URL to check hostname
  let parsed: URL;
  try {
    parsed = new URL(trimmedUrl);
  } catch (error) {
    throw new URLValidationError('Invalid URL format');
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block localhost and similar patterns
  if (hostname === 'localhost' || hostname === '[::1]' || hostname === '0.0.0.0') {
    if (!isDevelopment) {
      throw new URLValidationError('localhost access is not allowed in production');
    }
  }

  // Check for blocked hostname patterns
  for (const pattern of BLOCKED_HOSTNAMES) {
    if (typeof pattern === 'string') {
      if (hostname === pattern) {
        throw new URLValidationError(`Hostname ${hostname} is not allowed`);
      }
    } else if (pattern.test(hostname)) {
      throw new URLValidationError(`Hostname pattern ${pattern} is not allowed`);
    }
  }

  // Block private IP ranges (except in development)
  if (!isDevelopment) {
    for (const pattern of PRIVATE_IP_PATTERNS) {
      if (pattern.test(hostname)) {
        throw new URLValidationError(`Private IP address ${hostname} is not allowed`);
      }
    }
  }

  // Validate port range (1-65535)
  if (parsed.port) {
    const portNum = parseInt(parsed.port, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      throw new URLValidationError('Invalid port number');
    }
  }

  return trimmedUrl;
}

/**
 * Validate a baseUrl or return undefined if not provided
 * @param baseUrl - The base URL to validate (can be undefined)
 * @param defaultUrl - Default URL to use if baseUrl is not provided
 * @returns Validated URL string
 */
export function validateBaseUrlOrDefault(
  baseUrl: string | undefined,
  defaultUrl: string
): string {
  if (!baseUrl) {
    return defaultUrl;
  }
  return validateExternalUrl(baseUrl);
}

/**
 * Check if a URL is safe to use (returns boolean instead of throwing)
 * @param url - The URL to check
 * @returns true if the URL is safe, false otherwise
 */
export function isUrlSafe(url: string): boolean {
  try {
    validateExternalUrl(url);
    return true;
  } catch {
    return false;
  }
}
