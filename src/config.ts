import os from "node:os";
import path from "node:path";

export interface AppConfig {
  host: string;
  port: number;
  passwordHash: string;
  sessionSecret: string;
  captureDir: string;
  dbPath: string;
  tcpdumpUser: string;
  captureInterface: string;
  wifiInterface: string;
  maxTotalCaptureGb: number;
  defaultChunkSeconds: number;
  defaultChunkMb: number;
  secureCookies: boolean;
}

function numberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be a number.`);
  }
  return value;
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

export function loadConfig(): AppConfig {
  return {
    host: process.env.PICAP_HOST || "0.0.0.0",
    port: numberEnv("PICAP_PORT", 8080),
    passwordHash: requiredEnv("PICAP_PASSWORD_HASH"),
    sessionSecret: requiredEnv("PICAP_SESSION_SECRET"),
    captureDir: path.resolve(process.env.PICAP_CAPTURE_DIR || "./data/captures"),
    dbPath: path.resolve(process.env.PICAP_DB_PATH || "./data/picap.sqlite3"),
    tcpdumpUser: process.env.PICAP_TCPDUMP_USER || os.userInfo().username,
    captureInterface: process.env.PICAP_CAPTURE_INTERFACE || "eth0",
    wifiInterface: process.env.PICAP_WIFI_INTERFACE || "wlan0",
    maxTotalCaptureGb: numberEnv("PICAP_MAX_TOTAL_CAPTURE_GB", 32),
    defaultChunkSeconds: numberEnv("PICAP_DEFAULT_CHUNK_SECONDS", 300),
    defaultChunkMb: numberEnv("PICAP_DEFAULT_CHUNK_MB", 256),
    secureCookies: process.env.PICAP_SECURE_COOKIES === "true"
  };
}
