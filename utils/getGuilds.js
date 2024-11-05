import { rateLimit } from './rateLimiter.js';
import { CONFIG } from '../config.js';

export async function getGuilds(token) {
  try {
    // Get basic guild data first
    const response = await fetch(`${CONFIG.API_BASE_URL}/${CONFIG.API_VERSION}/users/@me/guilds`, {
      headers: { Authorization: token }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch guilds: HTTP ${response.status}`);
    }

    const guilds = await response.json();

    // Return basic data immediately
    return {
      success: true,
      data: guilds
    };

  } catch (error) {
    console.error('Error in getGuilds:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Optional: Create a separate function for enhanced data
export async function enhanceGuildData(token, guild) {
  try {
    const response = await rateLimit(() => 
      fetch(`${CONFIG.API_BASE_URL}/${CONFIG.API_VERSION}/guilds/${guild.id}`, {
        headers: { Authorization: token }
      })
    );
    
    if (response.ok) {
      const details = await response.json();
      return {
        ...guild,
        approximate_member_count: details.approximate_member_count,
        approximate_presence_count: details.approximate_presence_count,
        roles: details.roles,
        joined_at: details.joined_at
      };
    }
    return guild;
  } catch {
    return guild;
  }
}