import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import os from 'os';

const DB_PATH = path.join(os.homedir(), '.bulkleave', 'activity.db');

export class ActivityTracker {
  static async init() {
    const db = await open({
      filename: DB_PATH,
      driver: sqlite3.Database
    });

    await db.exec(`
      CREATE TABLE IF NOT EXISTS server_activity (
        server_id TEXT,
        user_id TEXT,
        last_visit DATETIME,
        visit_count INTEGER,
        PRIMARY KEY (server_id, user_id)
      )
    `);

    return db;
  }

  static async recordVisit(serverId, userId) {
    const db = await this.init();
    await db.run(`
      INSERT INTO server_activity (server_id, user_id, last_visit, visit_count)
      VALUES (?, ?, DATETIME('now'), 1)
      ON CONFLICT (server_id, user_id) DO UPDATE SET
        last_visit = DATETIME('now'),
        visit_count = visit_count + 1
    `, [serverId, userId]);
  }

  static async getServerActivity(userId) {
    const db = await this.init();
    return db.all(`
      SELECT * FROM server_activity
      WHERE user_id = ?
      ORDER BY last_visit DESC
    `, [userId]);
  }
}