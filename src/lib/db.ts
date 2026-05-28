import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

import type { CaptureFile, CaptureJob, CaptureStatus } from "../types/domain.js";

interface CaptureRow {
  id: number;
  name: string;
  status: CaptureStatus;
  interface_name: string;
  bpf_filter: string;
  duration_seconds: number;
  chunk_seconds: number;
  chunk_mb: number;
  max_job_bytes: number;
  started_at: string | null;
  ended_at: string | null;
  exit_code: number | null;
  error_message: string | null;
  capture_dir: string;
  created_at: string;
}

interface CaptureFileRow {
  id: number;
  capture_id: number;
  path: string;
  filename: string;
  size_bytes: number;
  created_at: string;
  sha256: string | null;
}

function mapCapture(row: CaptureRow): CaptureJob {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    interfaceName: row.interface_name,
    bpfFilter: row.bpf_filter,
    durationSeconds: row.duration_seconds,
    chunkSeconds: row.chunk_seconds,
    chunkMb: row.chunk_mb,
    maxJobBytes: row.max_job_bytes,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    exitCode: row.exit_code,
    errorMessage: row.error_message,
    captureDir: row.capture_dir,
    createdAt: row.created_at
  };
}

function mapCaptureFile(row: CaptureFileRow): CaptureFile {
  return {
    id: row.id,
    captureId: row.capture_id,
    path: row.path,
    filename: row.filename,
    sizeBytes: row.size_bytes,
    createdAt: row.created_at,
    sha256: row.sha256
  };
}

export interface CreateCaptureInput {
  name: string;
  status: CaptureStatus;
  interfaceName: string;
  bpfFilter: string;
  durationSeconds: number;
  chunkSeconds: number;
  chunkMb: number;
  maxJobBytes: number;
  captureDir: string;
}

export interface UpdateCaptureInput {
  status?: CaptureStatus;
  startedAt?: string | null;
  endedAt?: string | null;
  exitCode?: number | null;
  errorMessage?: string | null;
  captureDir?: string;
}

export class AppDatabase {
  private readonly db: Database.Database;

  constructor(dbPath: string) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.migrate();
  }

  close(): void {
    this.db.close();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS captures (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        status TEXT NOT NULL,
        interface_name TEXT NOT NULL,
        bpf_filter TEXT NOT NULL,
        duration_seconds INTEGER NOT NULL,
        chunk_seconds INTEGER NOT NULL,
        chunk_mb INTEGER NOT NULL,
        max_job_bytes INTEGER NOT NULL,
        started_at TEXT,
        ended_at TEXT,
        exit_code INTEGER,
        error_message TEXT,
        capture_dir TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS capture_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        capture_id INTEGER NOT NULL,
        path TEXT NOT NULL UNIQUE,
        filename TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        sha256 TEXT,
        FOREIGN KEY (capture_id) REFERENCES captures(id) ON DELETE CASCADE
      );
    `);
  }

  createCapture(input: CreateCaptureInput): CaptureJob {
    const result = this.db
      .prepare(
        `INSERT INTO captures (
          name, status, interface_name, bpf_filter, duration_seconds, chunk_seconds,
          chunk_mb, max_job_bytes, capture_dir
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.name,
        input.status,
        input.interfaceName,
        input.bpfFilter,
        input.durationSeconds,
        input.chunkSeconds,
        input.chunkMb,
        input.maxJobBytes,
        input.captureDir
      );

    return this.getCapture(Number(result.lastInsertRowid))!;
  }

  getCapture(id: number): CaptureJob | null {
    const row = this.db
      .prepare("SELECT * FROM captures WHERE id = ?")
      .get(id) as CaptureRow | undefined;
    return row ? mapCapture(row) : null;
  }

  listCaptures(limit = 50): CaptureJob[] {
    const rows = this.db
      .prepare("SELECT * FROM captures ORDER BY created_at DESC, id DESC LIMIT ?")
      .all(limit) as CaptureRow[];
    return rows.map(mapCapture);
  }

  updateCapture(id: number, input: UpdateCaptureInput): CaptureJob {
    const fields: string[] = [];
    const values: unknown[] = [];
    const mappings: Record<keyof UpdateCaptureInput, string> = {
      status: "status",
      startedAt: "started_at",
      endedAt: "ended_at",
      exitCode: "exit_code",
      errorMessage: "error_message",
      captureDir: "capture_dir"
    };

    for (const key of Object.keys(input) as Array<keyof UpdateCaptureInput>) {
      fields.push(`${mappings[key]} = ?`);
      values.push(input[key]);
    }

    if (!fields.length) {
      return this.getCapture(id)!;
    }

    this.db.prepare(`UPDATE captures SET ${fields.join(", ")} WHERE id = ?`).run(...values, id);
    return this.getCapture(id)!;
  }

  addCaptureFile(input: Omit<CaptureFile, "id" | "createdAt" | "sha256">): CaptureFile {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO capture_files (capture_id, path, filename, size_bytes)
         VALUES (?, ?, ?, ?)`
      )
      .run(input.captureId, input.path, input.filename, input.sizeBytes);

    const row = this.db
      .prepare("SELECT * FROM capture_files WHERE path = ?")
      .get(input.path) as CaptureFileRow;
    return mapCaptureFile(row);
  }

  listCaptureFiles(captureId: number): CaptureFile[] {
    const rows = this.db
      .prepare("SELECT * FROM capture_files WHERE capture_id = ? ORDER BY filename ASC")
      .all(captureId) as CaptureFileRow[];
    return rows.map(mapCaptureFile);
  }

  getCaptureFile(fileId: number): CaptureFile | null {
    const row = this.db
      .prepare("SELECT * FROM capture_files WHERE id = ?")
      .get(fileId) as CaptureFileRow | undefined;
    return row ? mapCaptureFile(row) : null;
  }

  deleteCapture(id: number): void {
    this.db.prepare("DELETE FROM captures WHERE id = ?").run(id);
  }
}
