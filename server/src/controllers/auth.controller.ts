import { Request, Response } from "express";
import {
  registerUser,
  loginUser,
  getUserById,
} from "../services/auth.service";
import {
  validateRegister,
  validateLogin,
} from "../validators/auth.validator";
import { asyncHandler, AppError } from "../middleware/error.middleware";

export const register = asyncHandler(async (req: Request, res: Response) => {
  const validation = validateRegister(req.body);

  if (!validation.success || !validation.data) {
    throw new AppError(validation.errors?.join(". ") || "Validation failed", 400);
  }

  const result = await registerUser(validation.data);

  res.status(201).json({
    message: "Account created successfully",
    token: result.token,
    user: result.user,
  });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const validation = validateLogin(req.body);

  if (!validation.success || !validation.data) {
    throw new AppError(validation.errors?.join(". ") || "Validation failed", 400);
  }

  const result = await loginUser(validation.data);

  res.status(200).json({
    message: "Login successful",
    token: result.token,
    user: result.user,
  });
});

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Unauthorized", 401);
  }

  const user = await getUserById(req.user._id.toString());

  res.status(200).json({ user });
});

export const logout = asyncHandler(async (_req: Request, res: Response) => {
  res.status(200).json({ message: "Logged out successfully" });
});
