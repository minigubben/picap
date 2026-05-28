import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

import { AppDatabase } from "../src/lib/db.js";

test("creates, updates, indexes, and deletes captures", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "picap-db-"));
  const db = new AppDatabase(path.join(dir, "picap.sqlite3"));

  const capture = db.createCapture({
    name: "test",
    status: "pending",
    interfaceName: "eth0",
    bpfFilter: "tcp",
    durationSeconds: 60,
    chunkSeconds: 30,
    chunkMb: 64,
    maxJobBytes: 1024,
    captureDir: path.join(dir, "1")
  });

  assert.equal(capture.id, 1);
  assert.equal(capture.status, "pending");

  const running = db.updateCapture(capture.id, {
    status: "running",
    startedAt: "2026-05-28T00:00:00.000Z"
  });
  assert.equal(running.status, "running");

  const file = db.addCaptureFile({
    captureId: capture.id,
    path: path.join(dir, "1", "chunk.pcap"),
    filename: "chunk.pcap",
    sizeBytes: 99
  });
  assert.equal(file.filename, "chunk.pcap");
  assert.equal(db.listCaptureFiles(capture.id).length, 1);

  db.deleteCapture(capture.id);
  assert.equal(db.getCapture(capture.id), null);
  db.close();
});
