import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { encrypt, decrypt } from './encryption.js';

const CONFIG_PATH = path.join(os.homedir(), '.bulkleave');
const CONFIG_FILE = path.join(CONFIG_PATH, 'config.json');

export class ConfigManager {
  static async init() {
    await fs.mkdir(CONFIG_PATH, { recursive: true });
    try {
      await fs.access(CONFIG_FILE);
    } catch {
      await fs.writeFile(CONFIG_FILE, JSON.stringify({
        tokens: [],
        whitelisted_servers: [],
        settings: {
          auto_backup: true,
          default_sort: 'name'
        }
      }));
    }
  }

  static async getConfig() {
    const data = await fs.readFile(CONFIG_FILE, 'utf8');
    return JSON.parse(data);
  }

  static async saveToken(token, label) {
    const config = await this.getConfig();
    config.tokens.push({
      label,
      value: await encrypt(token),
      lastUsed: new Date().toISOString()
    });
    await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
  }

  static async getTokens() {
    const config = await this.getConfig();
    return Promise.all(config.tokens.map(async t => ({
      ...t,
      value: await decrypt(t.value)
    })));
  }
}
