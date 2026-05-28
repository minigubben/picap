import { readResponsePayload } from "./http";

interface StatusPayload {
  totalBytes?: number;
  networkStatus?: {
    mode?: string;
    ssid?: string | null;
  };
}

function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function startStatusPolling(): void {
  if (!document.querySelector("[data-total-bytes]")) {
    return;
  }
  setInterval(async () => {
    const response = await fetch("/api/status");
    if (!response.ok) {
      return;
    }
    const payload = (await readResponsePayload(response)) as StatusPayload | null;
    const totalNode = document.querySelector<HTMLElement>("[data-total-bytes]");
    if (totalNode && typeof payload?.totalBytes === "number") {
      totalNode.textContent = formatBytes(payload.totalBytes);
    }
    document.querySelectorAll<HTMLElement>("[data-network-mode]").forEach((node) => {
      node.textContent = payload?.networkStatus?.mode || "unknown";
    });
    document.querySelectorAll<HTMLElement>("[data-network-ssid]").forEach((node) => {
      node.textContent = payload?.networkStatus?.ssid || "none";
    });
  }, 10_000);
}
