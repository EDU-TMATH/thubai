import "server-only";

import initSqlJs from "sql.js";
import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";

const DB_FILE = path.join(process.cwd(), "thubai-history.sqlite");

type SqlJsDatabase = {
  run(sql: string, params?: unknown[]): void;
  exec(sql: string, params?: unknown[]): Array<{ columns: string[]; values: unknown[][] }>;
  export(): Uint8Array;
  close(): void;
};

type SqlJsStatic = {
  Database: new (data?: Uint8Array) => SqlJsDatabase;
};

export type SubmissionHistoryRow = {
  id: number;
  submissionId: string;
  username: string;
  displayName: string;
  organizationId: number;
  organizationShortName: string;
  organizationName: string;
  fileCount: number;
  totalBytes: number;
  destination: string;
  savedAt: string;
  createdAt: string;
};

export type SubmissionHistoryInput = {
  submissionId: string;
  username: string;
  displayName: string;
  organizationId: number;
  organizationShortName: string;
  organizationName: string;
  fileCount: number;
  totalBytes: number;
  destination: string;
  savedAt: string;
};

let sqlJsPromise: Promise<SqlJsStatic> | null = null;

/**
 * File-level lock to ensure atomic reads/writes of the SQLite database file.
 * 
 * CONCURRENCY SAFETY:
 * All database operations (both reads and writes) acquire this lock before file access.
 * This prevents:
 * - Concurrent reads from loading partially-written data
 * - Race conditions where User A's data could be returned for User B's query
 * - Database file corruption under high concurrent load
 * 
 * The lock ensures operations are serialized at the file level, not in-memory.
 * sql.js creates a new in-memory instance per operation, so file access must be protected.
 */
let fileLock = Promise.resolve();

function getSqlJs() {
  if (!sqlJsPromise) {
    sqlJsPromise = initSqlJs({
      locateFile: (file) => path.join(process.cwd(), "node_modules", "sql.js", "dist", file),
    }) as Promise<SqlJsStatic>;
  }

  return sqlJsPromise;
}

async function withFileLock<T>(task: () => Promise<T>): Promise<T> {
  const run = fileLock.then(task);
  fileLock = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function ensureSchema(db: SqlJsDatabase) {
  db.run(`
    CREATE TABLE IF NOT EXISTS submission_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      submission_id TEXT NOT NULL,
      username TEXT NOT NULL,
      display_name TEXT NOT NULL,
      organization_id INTEGER NOT NULL,
      organization_short_name TEXT NOT NULL,
      organization_name TEXT NOT NULL,
      file_count INTEGER NOT NULL,
      total_bytes INTEGER NOT NULL,
      destination TEXT NOT NULL,
      saved_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  db.run(
    "CREATE INDEX IF NOT EXISTS idx_submission_history_username ON submission_history(username);",
  );
  db.run(
    "CREATE INDEX IF NOT EXISTS idx_submission_history_saved_at ON submission_history(saved_at DESC);",
  );
}

async function openDatabase() {
  const SQL = await getSqlJs();
  const fileBuffer = await readFile(DB_FILE).catch(() => null);
  const db = new SQL.Database(fileBuffer ? new Uint8Array(fileBuffer) : undefined);
  ensureSchema(db);
  return db;
}

function mapRows(result: Array<{ columns: string[]; values: unknown[][] }>): SubmissionHistoryRow[] {
  if (result.length === 0) {
    return [];
  }

  const [first] = result;
  return first.values.map((values) => {
    const row = Object.fromEntries(first.columns.map((column, index) => [column, values[index]])) as Record<string, unknown>;
    return {
      id: Number(row.id),
      submissionId: String(row.submission_id),
      username: String(row.username),
      displayName: String(row.display_name),
      organizationId: Number(row.organization_id),
      organizationShortName: String(row.organization_short_name),
      organizationName: String(row.organization_name),
      fileCount: Number(row.file_count),
      totalBytes: Number(row.total_bytes),
      destination: String(row.destination),
      savedAt: String(row.saved_at),
      createdAt: String(row.created_at),
    };
  });
}

export async function insertSubmissionHistory(input: SubmissionHistoryInput): Promise<void> {
  await withFileLock(async () => {
    const db = await openDatabase();
    try {
      db.run(
        `
          INSERT INTO submission_history (
            submission_id,
            username,
            display_name,
            organization_id,
            organization_short_name,
            organization_name,
            file_count,
            total_bytes,
            destination,
            saved_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          input.submissionId,
          input.username,
          input.displayName,
          input.organizationId,
          input.organizationShortName,
          input.organizationName,
          input.fileCount,
          input.totalBytes,
          input.destination,
          input.savedAt,
        ],
      );

      await writeFile(DB_FILE, Buffer.from(db.export()));
    } finally {
      db.close();
    }
  });
}

export async function getSubmissionHistoryForUser(
  username: string,
  limit = 200,
): Promise<SubmissionHistoryRow[]> {
  console.log("[DB:QUERY] Fetching history for user", { username, limit });
  
  return withFileLock(async () => {
    const db = await openDatabase();
    try {
      const rows = db.exec(
        `
          SELECT
            id,
            submission_id,
            username,
            display_name,
            organization_id,
            organization_short_name,
            organization_name,
            file_count,
            total_bytes,
            destination,
            saved_at,
            created_at
          FROM submission_history
          WHERE username = ?
          ORDER BY saved_at DESC
          LIMIT ?
        `,
        [username, limit],
      );
      const result = mapRows(rows);
      console.log("[DB:RESULT] History query complete", { username, returnedRows: result.length });
      return result;
    } finally {
      db.close();
    }
  });
}

export async function getSubmissionHistoryAll(limit = 1000): Promise<SubmissionHistoryRow[]> {
  return withFileLock(async () => {
    const db = await openDatabase();
    try {
      const rows = db.exec(
        `
          SELECT
            id,
            submission_id,
            username,
            display_name,
            organization_id,
            organization_short_name,
            organization_name,
            file_count,
            total_bytes,
            destination,
            saved_at,
            created_at
          FROM submission_history
          ORDER BY saved_at DESC
          LIMIT ?
        `,
        [limit],
      );
      return mapRows(rows);
    } finally {
      db.close();
    }
  });
}

export async function deleteSubmissionHistoryById(
  submissionId: string,
  username: string,
  organizationShortName: string,
): Promise<void> {
  await withFileLock(async () => {
    const db = await openDatabase();
    try {
      db.run(
        `
          DELETE FROM submission_history
          WHERE submission_id = ?
            AND username = ?
            AND organization_short_name = ?
        `,
        [submissionId, username, organizationShortName],
      );
      await writeFile(DB_FILE, Buffer.from(db.export()));
    } finally {
      db.close();
    }
  });
}

export async function deleteAllSubmissionHistory(): Promise<void> {
  await withFileLock(async () => {
    const db = await openDatabase();
    try {
      db.run("DELETE FROM submission_history;");
      await writeFile(DB_FILE, Buffer.from(db.export()));
    } finally {
      db.close();
    }
  });
}