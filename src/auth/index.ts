import { z } from 'zod'

const AuthConfigSchema = z.object({
  apiKey: z.string().min(1, 'API key is required'),
  baseUrl: z.string().url().optional().default('https://api.jigx.com'),
  region: z.string().optional().default('us-east-1')
})

export type AuthConfig = z.infer<typeof AuthConfigSchema>

export class AuthManager {
  private readonly config: AuthConfig
  private readonly sanitizedKey: string

  constructor(config: Partial<AuthConfig> = {}) {
    // Try to get API key from environment or config
    const apiKey = config.apiKey || process.env['JIGX_API_KEY']

    if (!apiKey) {
      throw new Error(
        'JIGX_API_KEY not found. Please set it in environment variables or pass it in configuration.'
      )
    }

    // Validate config
    this.config = AuthConfigSchema.parse({
      apiKey,
      baseUrl: config.baseUrl,
      region: config.region
    })

    // Create sanitized version for logging
    this.sanitizedKey = this.sanitizeKey(this.config.apiKey)
  }

  /**
   * Get headers for API requests with authentication
   */
  getHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Region': this.config.region
    }
  }

  /**
   * Get base URL for API version
   */
  getBaseUrl(apiVersion: 'v1' | 'data/v20' | 'tool/v20'): string {
    return `${this.config.baseUrl}/${apiVersion}`
  }

  /**
   * Sanitize API key for safe logging
   */
  private sanitizeKey(key: string): string {
    if (key.length <= 8) {
      return '***'
    }
    return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`
  }

  /**
   * Get sanitized config for logging
   */
  getSanitizedConfig(): Record<string, any> {
    return {
      apiKey: this.sanitizedKey,
      baseUrl: this.config.baseUrl,
      region: this.config.region
    }
  }

  /**
   * Validate if auth is properly configured
   */
  validate(): boolean {
    try {
      AuthConfigSchema.parse(this.config)
      return true
    } catch {
      return false
    }
  }
}

// Singleton instance
let authManager: AuthManager | null = null

/**
 * Initialize auth manager with config
 */
export function initializeAuth(config?: Partial<AuthConfig>): AuthManager {
  authManager = new AuthManager(config)
  return authManager
}

/**
 * Get current auth manager instance
 */
export function getAuth(): AuthManager {
  if (!authManager) {
    throw new Error('Auth not initialized. Call initializeAuth() first.')
  }
  return authManager
}

/**
 * Check if auth is initialized
 */
export function isAuthInitialized(): boolean {
  return authManager !== null && authManager.validate()
}
