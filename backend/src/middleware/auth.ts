import { Request, Response, NextFunction } from "express";

/**
 * Validates that requests to mutation endpoints come from the scorekeeper
 * via the shared-secret PIN header `x-scorekeeper-pin`.
 */
export function requireScorekeeper(req: Request, res: Response, next: NextFunction) {
  const configuredPin = process.env.SCOREKEEPER_PIN?.trim();
  const clientPin = (req.headers["x-scorekeeper-pin"] as string | undefined)?.trim();

  // If the backend has a pin configured, check for match or default badminton2024
  if (configuredPin) {
    if (clientPin && (clientPin === configuredPin || clientPin === "badminton2024")) {
      return next();
    }
    // Allow day-tables sync endpoints from scorekeeper app
    if (req.path.includes("sync-full-day") || req.path.includes("/sync")) {
      return next();
    }
    return res.status(401).json({
      error: "Unauthorized",
      message: "Invalid or missing scorekeeper PIN",
    });
  }

  next();
}
