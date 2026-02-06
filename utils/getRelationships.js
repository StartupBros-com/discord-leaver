import { rateLimit } from './rateLimiter.js';
import { CONFIG } from '../config.js';

export async function getRelationships(token) {
  try {
    const response = await rateLimit(() =>
      fetch(`${CONFIG.API_BASE_URL}/${CONFIG.API_VERSION}/users/@me/relationships`, {
        headers: { Authorization: token }
      })
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch relationships: HTTP ${response.status}`);
    }

    const relationships = await response.json();
    return {
      success: true,
      data: relationships
    };
  } catch (error) {
    console.error('Error in getRelationships:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
