import { Request, Response, NextFunction } from "express";

/**
 * Validates that requests to mutation endpoints come from the scorekeeper
 * via the shared-secret PIN header `x-scorekeeper-pin`.
 */
export function requireScorekeeper(req: Request, res: Response, next: NextFunction) {
  const configuredPin = process.env.SCOREKEEPER_PIN;

  // If no PIN is configured in environment, allow with warning (local dev convenience)
  if (!configuredPin) {
    return next();
  }

  const clientPin = req.headers["x-scorekeeper-pin"];

  if (!clientPin || clientPin !== configuredPin) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Invalid or missing scorekeeper PIN header (x-scorekeeper-pin)",
    });
  }

  next();
}
