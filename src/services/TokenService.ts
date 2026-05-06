/**
 * TokenService - Manages JWT token from Auth0
 * Provides token retrieval for authenticated API requests
 */

let token: string | null = null;

export const TokenService = {
  /**
   * Set the JWT token (called from React component)
   */
  setToken(newToken: string | null): void {
    token = newToken;
    console.log(token ? "✓ Token set" : "✓ Token cleared");
  },

  /**
   * Get the current JWT token
   */
  getToken(): string | null {
    return token;
  },

  /**
   * Check if token exists
   */
  hasToken(): boolean {
    return token !== null && token !== "";
  },

  /**
   * Get Authorization header value
   */
  getAuthHeader(): string | null {
    return token ? `Bearer ${token}` : null;
  },
};
