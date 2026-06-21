import { Request, Response, NextFunction } from "express";
import User from "../models/User";
import { verifyToken } from "../utils/generateToken";
import { AppError } from "./error.middleware";

export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let token: string | undefined;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return next(new AppError("Unauthorized", 401));
  }

  try {
    const decoded = verifyToken(token);
    const user = await User.findById(decoded.id);

    if (!user) {
      return next(new AppError("Unauthorized", 401));
    }

    req.user = user;
    next();
  } catch {
    return next(new AppError("Unauthorized", 401));
  }
};
