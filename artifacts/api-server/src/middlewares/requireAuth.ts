import { getAuth } from "@clerk/express";
import type { RequestHandler } from "express";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export const requireAuth: RequestHandler = (req, res, next) => {
  const { userId } = getAuth(req);

  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  req.userId = userId;
  next();
};

export function currentUserId(req: { userId?: string }): string {
  if (!req.userId) {
    throw new Error("Authenticated request is missing its user ID");
  }
  return req.userId;
}
