/**
 * Database Manager Tests
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DatabaseManager } from '../database';

describe('DatabaseManager', () => {
  let tempDir: string;
  let dbPath: string;
  let manager: DatabaseManager;

  beforeEach(() => {
    // Create temporary directory for each test
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'index-search-test-'));
    dbPath = path.join(tempDir, 'test.db');
  });

  afterEach(() => {
    // Cleanup
    if (manager) {
      manager.close();
    }
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should create a new database with schema', () => {
    manager = new DatabaseManager({ dbPath, walMode: false });
    const db = manager.getDatabase();

    expect(db).toBeDefined();
    expect(fs.existsSync(dbPath)).toBe(true);

    // Check that essential tables exist
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
      )
      .all() as Array<{ name: string }>;

    const tableNames = tables.map(t => t.name);
    expect(tableNames).toContain('notes');
    expect(tableNames).toContain('links');
  });

  it('should return database stats', () => {
    manager = new DatabaseManager({ dbPath, walMode: false });
    const stats = manager.getStats();

    expect(stats).toHaveProperty('totalNotes');
    expect(stats).toHaveProperty('totalLinks');
    expect(stats).toHaveProperty('dbSizeBytes');
    expect(stats).toHaveProperty('lastVacuum');
    expect(typeof stats.totalNotes).toBe('number');
    expect(typeof stats.totalLinks).toBe('number');
    expect(typeof stats.dbSizeBytes).toBe('number');
    expect(stats.totalNotes).toBe(0); // Empty database
    expect(stats.totalLinks).toBe(0); // Empty database
  });

  it('should enable WAL mode when requested', () => {
    manager = new DatabaseManager({ dbPath, walMode: true });
    const db = manager.getDatabase();

    const result = db.prepare('PRAGMA journal_mode').get() as {
      journal_mode: string;
    };
    expect(result.journal_mode.toLowerCase()).toBe('wal');
  });

  it('should use DELETE mode when WAL is disabled', () => {
    manager = new DatabaseManager({ dbPath, walMode: false });
    const db = manager.getDatabase();

    const result = db.prepare('PRAGMA journal_mode').get() as {
      journal_mode: string;
    };
    expect(result.journal_mode.toLowerCase()).toBe('delete');
  });

  it('should close database connection', () => {
    manager = new DatabaseManager({ dbPath, walMode: false });
    const db = manager.getDatabase();

    expect(db.open).toBe(true);

    manager.close();

    expect(db.open).toBe(false);
  });

  it('should create FTS5 virtual table', () => {
    manager = new DatabaseManager({ dbPath, walMode: false });
    const db = manager.getDatabase();

    // Check that FTS5 table exists
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='notes_fts'"
      )
      .all() as Array<{ name: string }>;

    expect(tables.length).toBe(1);
    expect(tables[0]?.name).toBe('notes_fts');
  });

  it('should handle multiple instantiations with same dbPath', () => {
    const manager1 = new DatabaseManager({ dbPath, walMode: false });
    const manager2 = new DatabaseManager({ dbPath, walMode: false });

    expect(manager1.getDatabase()).toBeDefined();
    expect(manager2.getDatabase()).toBeDefined();

    manager1.close();
    manager2.close();
  });
});
