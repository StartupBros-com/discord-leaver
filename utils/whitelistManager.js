export class WhitelistManager {
    static async addToWhitelist(serverId, reason) {
      const config = await ConfigManager.getConfig();
      config.whitelisted_servers.push({
        id: serverId,
        reason,
        addedAt: new Date().toISOString()
      });
      await ConfigManager.saveConfig(config);
    }
  
    static async removeFromWhitelist(serverId) {
      const config = await ConfigManager.getConfig();
      config.whitelisted_servers = config.whitelisted_servers
        .filter(s => s.id !== serverId);
      await ConfigManager.saveConfig(config);
    }
  }