export type CaptureStatus = "pending" | "running" | "completed" | "stopped" | "failed";

export interface CaptureJob {
  id: number;
  name: string;
  status: CaptureStatus;
  interfaceName: string;
  bpfFilter: string;
  durationSeconds: number;
  chunkSeconds: number;
  chunkMb: number;
  maxJobBytes: number;
  startedAt: string | null;
  endedAt: string | null;
  exitCode: number | null;
  errorMessage: string | null;
  captureDir: string;
  createdAt: string;
}

export interface CaptureFile {
  id: number;
  captureId: number;
  path: string;
  filename: string;
  sizeBytes: number;
  createdAt: string;
  sha256: string | null;
}

export interface CaptureWithFiles extends CaptureJob {
  files: CaptureFile[];
}

export interface CaptureRequest {
  name: string;
  interfaceName?: string;
  durationValue: number;
  durationUnit: "minutes" | "hours" | "days" | "weeks";
  chunkSeconds?: number;
  chunkMb?: number;
  maxJobGb?: number;
  filter: CaptureFilterRequest;
}

export interface CaptureFilterRequest {
  ip?: string;
  srcIp?: string;
  dstIp?: string;
  port?: string | number;
  srcPort?: string | number;
  dstPort?: string | number;
  protocol?: "any" | "tcp" | "udp" | "icmp";
  advancedBpf?: string;
}

export interface NetworkStatus {
  wifiInterface: string;
  mode: "unknown" | "wifi" | "hotspot" | "disconnected";
  ssid: string | null;
  hotspotActive: boolean;
  raw: string;
}

export interface WifiNetwork {
  ssid: string;
  signal: number | null;
  security: string;
}
