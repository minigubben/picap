import type { Express, Request, Response } from "express";

import type { AppServices } from "../app.js";
import type { CaptureRequest } from "../types/domain.js";

function sendError(res: Response, error: unknown): void {
  res.status(400).json({ error: error instanceof Error ? error.message : "Request failed." });
}

function captureRequestFromBody(body: Record<string, unknown>): CaptureRequest {
  return {
    name: String(body.name || ""),
    interfaceName: body.interfaceName ? String(body.interfaceName) : undefined,
    durationValue: Number(body.durationValue || 0),
    durationUnit: String(body.durationUnit || "minutes") as CaptureRequest["durationUnit"],
    chunkSeconds: body.chunkSeconds ? Number(body.chunkSeconds) : undefined,
    chunkMb: body.chunkMb ? Number(body.chunkMb) : undefined,
    maxJobGb: body.maxJobGb ? Number(body.maxJobGb) : undefined,
    filter: {
      ip: body.ip ? String(body.ip) : undefined,
      srcIp: body.srcIp ? String(body.srcIp) : undefined,
      dstIp: body.dstIp ? String(body.dstIp) : undefined,
      port: body.port ? String(body.port) : undefined,
      srcPort: body.srcPort ? String(body.srcPort) : undefined,
      dstPort: body.dstPort ? String(body.dstPort) : undefined,
      protocol: String(body.protocol || "any") as CaptureRequest["filter"]["protocol"],
      advancedBpf: body.advancedBpf ? String(body.advancedBpf) : undefined
    }
  };
}

export function registerApiRoutes(app: Express, services: AppServices): void {
  app.get("/api/status", async (_req, res) => {
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
    res.json({ captures, networkStatus, totalBytes });
  });

  app.post("/captures", async (req: Request, res) => {
    try {
      const capture = await services.captureManager.startCapture(captureRequestFromBody(req.body));
      res.json({ capture });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post("/captures/:id/stop", async (req, res) => {
    try {
      const capture = await services.captureManager.stopCapture(Number(req.params.id));
      res.json({ capture });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post("/captures/:id/delete", async (req, res) => {
    try {
      await services.captureManager.deleteCapture(Number(req.params.id));
      res.json({ ok: true });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.get("/api/captures/:id/status", async (req, res) => {
    try {
      res.json({ capture: await services.captureManager.getCapture(Number(req.params.id)) });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.get("/api/network/status", async (_req, res) => {
    try {
      res.json({ networkStatus: await services.networkManager.status() });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.get("/api/network/wifi/scan", async (_req, res) => {
    try {
      res.json({ networks: await services.networkManager.scan() });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post("/network/wifi/connect", async (req, res) => {
    try {
      await services.networkManager.connectWifi(String(req.body.ssid || ""), String(req.body.password || ""));
      res.json({ ok: true });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post("/network/hotspot/start", async (req, res) => {
    try {
      await services.networkManager.startHotspot(
        String(req.body.ssid || "PiCap"),
        String(req.body.password || ""),
        String(req.body.country || "US"),
        req.body.channel ? String(req.body.channel) : undefined
      );
      res.json({ ok: true });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post("/network/hotspot/stop", async (_req, res) => {
    try {
      await services.networkManager.stopHotspot();
      res.json({ ok: true });
    } catch (error) {
      sendError(res, error);
    }
  });
}
