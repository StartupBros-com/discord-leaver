import { discordFetch } from './rateLimiter.js';
import { CONFIG } from '../config.js';

export async function getGuilds(token) {
  try {
    const response = await discordFetch(`${CONFIG.API_BASE_URL}/${CONFIG.API_VERSION}/users/@me/guilds?limit=200`, {
      headers: { Authorization: token }
    });

    const guilds = await response.json();

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

export async function enhanceGuildData(token, guild) {
  try {
    const response = await discordFetch(`${CONFIG.API_BASE_URL}/${CONFIG.API_VERSION}/guilds/${guild.id}`, {
      headers: { Authorization: token }
    });

    const details = await response.json();
    return {
      ...guild,
      approximate_member_count: details.approximate_member_count,
      approximate_presence_count: details.approximate_presence_count,
      roles: details.roles,
      joined_at: details.joined_at
    };
  } catch {
    return guild;
  }
}
