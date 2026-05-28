import type { Express } from "express";

import type { AppServices } from "../app.js";
import { verifyPassword } from "../lib/auth.js";

export function registerAuthRoutes(app: Express, services: AppServices): void {
  app.get("/login", (req, res) => {
    if (req.session.authenticated) {
      res.redirect("/");
      return;
    }
    res.render("login", { error: null });
  });

  app.post("/login", async (req, res) => {
    const password = String(req.body.password || "");
    if (await verifyPassword(password, services.config.passwordHash)) {
      req.session.authenticated = true;
      res.redirect("/");
      return;
    }
    res.status(401).render("login", { error: "Invalid password." });
  });

  app.post("/logout", (req, res) => {
    req.session.destroy(() => {
      res.redirect("/login");
    });
  });
}
