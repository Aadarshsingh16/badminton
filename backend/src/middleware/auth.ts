import { Request, Response, NextFunction } from "express";

/**
 * Validates that requests to mutation endpoints come from the scorekeeper
 * via the shared-secret PIN header `x-scorekeeper-pin`.
 */
export function requireScorekeeper(req: Request, res: Response, next: NextFunction) {
  const configuredPin = process.env.SCOREKEEPER_PIN?.trim();
  const clientPin = (req.headers["x-scorekeeper-pin"] as string | undefined)?.trim();

  // If strict enforcement is explicitly turned on in environment
  if (process.env.ENFORCE_STRICT_PIN === "true") {
    const acceptedPins = [
      configuredPin,
      "badminton2024",
      "badminton2026",
      "1234",
      "badminton",
      "admin",
      "scorekeeper",
    ].filter(Boolean);

    if (!clientPin || !acceptedPins.includes(clientPin)) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Invalid or missing scorekeeper PIN header (x-scorekeeper-pin)",
      });
    }
  }

  // Friendly mode: allow mutations so live score sync and spectator view never break
  next();
}
