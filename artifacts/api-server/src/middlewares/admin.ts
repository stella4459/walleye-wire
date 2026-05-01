import { type Request, type Response, type NextFunction } from "express";

const ADMIN_PASSWORD = process.env["ADMIN_PASSWORD"] || "";

export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!ADMIN_PASSWORD) {
    res.status(500).json({ error: "Admin password not configured" });
    return;
  }
  if (req.headers["x-admin-password"] !== ADMIN_PASSWORD) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}
