import fs from "node:fs";

import type { Express } from "express";

import type { AppServices } from "../app.js";

export function registerUiRoutes(app: Express, services: AppServices): void {
  app.get("/", async (_req, res, next) => {
    try {
      const [captures, networkStatus, totalBytes] = await Promise.all([
        services.captureManager.listCaptures(),
        services.networkManager.status().catch((error: Error) => ({
          wifiInterface: services.config.wifiInterface,
          mode: "unknown" as const,
          ssid: null,
          hotspotActive: false,
          raw: error.message
        })),
        services.captureManager.totalCaptureBytes()
      ]);
      res.render("dashboard", { captures, networkStatus, totalBytes, statusMessage: "" });
    } catch (error) {
      next(error);
    }
  });

  app.get("/captures/:id", async (req, res, next) => {
    try {
      const capture = await services.captureManager.getCapture(Number(req.params.id));
      res.render("capture-detail", { capture });
    } catch (error) {
      next(error);
    }
  });

  app.get("/captures/:id/files/:fileId/download", async (req, res, next) => {
    try {
      const capture = await services.captureManager.getCapture(Number(req.params.id));
      const file = services.db.getCaptureFile(Number(req.params.fileId));
      if (!file || file.captureId !== capture.id || !fs.existsSync(file.path)) {
        res.status(404).send("Capture file not found.");
        return;
      }
      res.download(file.path, file.filename);
    } catch (error) {
      next(error);
    }
  });
}
