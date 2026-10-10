import { Request, Response, NextFunction } from "express";

/**
 * Validates that requests to mutation endpoints come from the scorekeeper
 * via the shared-secret PIN header `x-scorekeeper-pin`.
 */
export function requireScorekeeper(req: Request, res: Response, next: NextFunction) {
  const configuredPin = process.env.SCOREKEEPER_PIN?.trim();
  const clientPin = (req.headers["x-scorekeeper-pin"] as string | undefined)?.trim();

  // If the backend has a pin configured, strictly enforce it
  if (configuredPin) {
    if (!clientPin || clientPin !== configuredPin) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Invalid or missing scorekeeper PIN",
      });
    }
  }

  // If no pin is configured on the backend, allow everything (for local dev)
  next();
}
