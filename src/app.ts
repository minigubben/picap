import path from "node:path";
import { fileURLToPath } from "node:url";

import express, { type Express } from "express";
import session from "express-session";

import type { AppConfig } from "./config.js";
import { loadConfig } from "./config.js";
import { ensureAuthenticated, ensureCsrfToken, verifyCsrf } from "./lib/auth.js";
import { readClientAssets } from "./lib/asset-manifest.js";
import { CaptureManager } from "./lib/capture-manager.js";
import { AppDatabase } from "./lib/db.js";
import { formatBytes, formatDate } from "./lib/format.js";
import { NetworkManager } from "./lib/network-manager.js";
import { registerApiRoutes } from "./routes/api.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerUiRoutes } from "./routes/ui.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface AppServices {
  config: AppConfig;
  db: AppDatabase;
  captureManager: CaptureManager;
  networkManager: NetworkManager;
}

export interface CreateAppOptions {
  config?: AppConfig;
  db?: AppDatabase;
  captureManager?: CaptureManager;
  networkManager?: NetworkManager;
}

export function createApp(options: CreateAppOptions = {}): Express {
  const config = options.config || loadConfig();
  const db = options.db || new AppDatabase(config.dbPath);
  const captureManager = options.captureManager || new CaptureManager(config, db);
  const networkManager = options.networkManager || new NetworkManager(config);
  const publicDir = path.join(__dirname, "public");
  const viewsDir = path.join(__dirname, "views");
  const app = express();

  const services: AppServices = { config, db, captureManager, networkManager };
  app.locals.services = services;
  app.locals.brand = {
    name: "PiCap",
    logoPath: "/brand/picap.svg",
    faviconPath: "/brand/picap.svg"
  };
  app.locals.clientAssets = readClientAssets(publicDir);
  app.locals.formatBytes = formatBytes;
  app.locals.formatDate = formatDate;

  app.set("view engine", "ejs");
  app.set("views", viewsDir);
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  app.use(express.static(publicDir));
  app.use(
    session({
      name: "picap.sid",
      secret: config.sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: config.secureCookies,
        maxAge: 12 * 60 * 60 * 1000
      }
    })
  );
  app.use(ensureCsrfToken);

  registerAuthRoutes(app, services);
  app.use(ensureAuthenticated);
  app.use((req, res, next) => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      verifyCsrf(req, res, next);
      return;
    }
    next();
  });

  registerUiRoutes(app, services);
  registerApiRoutes(app, services);

  return app;
}
