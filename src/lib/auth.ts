import crypto from "node:crypto";

import bcrypt from "bcryptjs";
import type { NextFunction, Request, Response } from "express";

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function ensureAuthenticated(req: Request, res: Response, next: NextFunction): void {
  if (req.session.authenticated) {
    next();
    return;
  }
  res.redirect("/login");
}

export function ensureCsrfToken(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(24).toString("hex");
  }
  res.locals.csrfToken = req.session.csrfToken;
  next();
}

export function verifyCsrf(req: Request, res: Response, next: NextFunction): void {
  const token = req.body?._csrf || req.get("X-CSRF-Token");
  if (!req.session.csrfToken || token !== req.session.csrfToken) {
    res.status(403).json({ error: "Invalid CSRF token." });
    return;
  }
  next();
}
