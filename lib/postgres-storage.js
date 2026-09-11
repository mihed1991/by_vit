const crypto = require('crypto');
const { Pool } = require('pg');

function safeInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function safeReason(value) {
  return String(value || 'save').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32) || 'save';
}

function assertBackupName(value) {
  const name = String(value || '');
  if (!/^store-[a-z0-9._-]+\.json$/i.test(name)) throw new Error('Invalid backup name');
  return name;
}

class PostgresStorage {
  constructor(options = {}) {
    if (!options.databaseUrl) throw new Error('DATABASE_URL is required for PostgreSQL storage');
    this.driver = 'postgres';
    this.persistent = true;
    this.maxBackups = safeInteger(options.maxBackups, 30);
    this.pool = new Pool({
      connectionString: options.databaseUrl,
      max: safeInteger(options.poolSize, 10),
      ssl: options.ssl === true ? { rejectUnauthorized: options.sslRejectUnauthorized !== false } : undefined
    });
    this.ready = null;
  }

  ensure() {
    if (!this.ready) {
      this.ready = this.pool.query(`
        CREATE TABLE IF NOT EXISTS byvit_state (
          id smallint PRIMARY KEY CHECK (id = 1),
          data jsonb NOT NULL,
          updated_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS byvit_backups (
          id bigserial PRIMARY KEY,
          name text UNIQUE NOT NULL,
          reason text NOT NULL,
          data jsonb NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS byvit_backups_created_at_idx ON byvit_backups (created_at DESC);
      `).then(() => undefined);
    }
    return this.ready;
  }

  async exists() {
    await this.ensure();
    const result = await this.pool.query('SELECT 1 FROM byvit_state WHERE id = 1');
    return result.rowCount > 0;
  }

  async read() {
    await this.ensure();
    const result = await this.pool.query('SELECT data FROM byvit_state WHERE id = 1');
    return result.rows[0]?.data || null;
  }

  backupName(reason = 'save') {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `store-${stamp}-${safeReason(reason)}-${crypto.randomBytes(3).toString('hex')}.json`;
  }

  async write(value, options = {}) {
    await this.ensure();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const current = await client.query('SELECT data FROM byvit_state WHERE id = 1 FOR UPDATE');
      if (options.backup !== false && current.rowCount) {
        await client.query(
          'INSERT INTO byvit_backups (name, reason, data) VALUES ($1, $2, $3::jsonb)',
          [this.backupName(options.reason || 'before-save'), safeReason(options.reason || 'before-save'), JSON.stringify(current.rows[0].data)]
        );
      }
      await client.query(
        `INSERT INTO byvit_state (id, data, updated_at) VALUES (1, $1::jsonb, now())
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
        [JSON.stringify(value)]
      );
      await client.query(
        'DELETE FROM byvit_backups WHERE id IN (SELECT id FROM byvit_backups ORDER BY created_at DESC, id DESC OFFSET $1)',
        [this.maxBackups]
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
    return this.info();
  }

  async withWriteLock(operation) {
    await this.ensure();
    const client = await this.pool.connect();
    try {
      await client.query('SELECT pg_advisory_lock($1)', [20260911]);
      return await operation();
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [20260911]).catch(() => {});
      client.release();
    }
  }

  async createBackup(reason = 'manual') {
    await this.ensure();
    const name = this.backupName(reason);
    const result = await this.pool.query(
      `INSERT INTO byvit_backups (name, reason, data)
       SELECT $1, $2, data FROM byvit_state WHERE id = 1
       RETURNING name, created_at, pg_column_size(data) AS size`,
      [name, safeReason(reason)]
    );
    if (!result.rowCount) return null;
    await this.pool.query(
      'DELETE FROM byvit_backups WHERE id IN (SELECT id FROM byvit_backups ORDER BY created_at DESC, id DESC OFFSET $1)',
      [this.maxBackups]
    );
    return { name: result.rows[0].name, createdAt: result.rows[0].created_at.toISOString(), size: Number(result.rows[0].size || 0) };
  }

  async listBackups() {
    await this.ensure();
    const result = await this.pool.query(
      'SELECT name, created_at, pg_column_size(data) AS size FROM byvit_backups ORDER BY created_at DESC, id DESC'
    );
    return result.rows.map(row => ({ name: row.name, createdAt: row.created_at.toISOString(), size: Number(row.size || 0) }));
  }

  async readBackup(name) {
    await this.ensure();
    const result = await this.pool.query('SELECT data FROM byvit_backups WHERE name = $1', [assertBackupName(name)]);
    if (!result.rowCount) throw new Error('Backup not found');
    return result.rows[0].data;
  }

  async restoreBackup(name) {
    const value = await this.readBackup(name);
    await this.write(value, { backup: true, reason: 'before-restore' });
    return value;
  }

  async info() {
    await this.ensure();
    const [state, backups] = await Promise.all([
      this.pool.query('SELECT updated_at, pg_column_size(data) AS size FROM byvit_state WHERE id = 1'),
      this.pool.query('SELECT count(*)::int AS count FROM byvit_backups')
    ]);
    return {
      driver: this.driver,
      persistent: true,
      updatedAt: state.rows[0]?.updated_at?.toISOString() || '',
      size: Number(state.rows[0]?.size || 0),
      backups: Number(backups.rows[0]?.count || 0),
      maxBackups: this.maxBackups
    };
  }

  async close() {
    await this.pool.end();
  }
}

function createPostgresStorage(options) {
  return new PostgresStorage(options);
}

module.exports = { createPostgresStorage };
