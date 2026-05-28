import fs from "node:fs";
import path from "node:path";

export interface ClientAssets {
  css: string[];
  js: string[];
}

interface ViteManifestEntry {
  file?: string;
  css?: string[];
}

export function readClientAssets(publicDir: string): ClientAssets {
  const manifestPath = path.join(publicDir, ".vite", "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    return { css: [], js: [] };
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as Record<
    string,
    ViteManifestEntry
  >;
  const entry = manifest["src/client/app.ts"];
  if (!entry) {
    return { css: [], js: [] };
  }

  return {
    css: (entry.css || []).map((href) => `/${href}`),
    js: entry.file ? [`/${entry.file}`] : []
  };
}
