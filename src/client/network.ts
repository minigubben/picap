import { readResponsePayload } from "./http";

interface WifiNetwork {
  ssid: string;
  signal: number | null;
  security: string;
}

function setStatus(message: string): void {
  const node = document.querySelector<HTMLElement>("[data-ui-status]");
  if (node) {
    node.textContent = message;
  }
}

export function bindNetwork(root: ParentNode = document): void {
  const button = root.querySelector<HTMLButtonElement>("[data-wifi-scan]");
  const select = root.querySelector<HTMLSelectElement>("[data-wifi-networks]");
  if (!button || !select) {
    return;
  }
  button.addEventListener("click", async () => {
    setStatus("Scanning Wi-Fi networks...");
    try {
      const response = await fetch("/api/network/wifi/scan");
      const payload = await readResponsePayload(response);
      if (!response.ok) {
        throw new Error(String(payload?.error || "Wi-Fi scan failed."));
      }
      const networks = (payload?.networks || []) as unknown as WifiNetwork[];
      select.replaceChildren(
        ...networks.map((network) => {
          const option = document.createElement("option");
          option.value = network.ssid;
          option.textContent = `${network.ssid} ${network.signal ?? "?"}% ${network.security}`;
          return option;
        })
      );
      setStatus(`Found ${networks.length} Wi-Fi networks.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Wi-Fi scan failed.");
    }
  });
}
