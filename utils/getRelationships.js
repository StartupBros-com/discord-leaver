import { discordFetch } from './rateLimiter.js';
import { CONFIG } from '../config.js';

export async function getRelationships(token) {
  try {
    const response = await discordFetch(`${CONFIG.API_BASE_URL}/${CONFIG.API_VERSION}/users/@me/relationships`, {
      headers: { Authorization: token }
    });

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
