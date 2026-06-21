import User, { IUser } from "../models/User";
import { generateToken } from "../utils/generateToken";
import { AppError } from "../middleware/error.middleware";
import {
  RegisterInput,
  LoginInput,
} from "../validators/auth.validator";

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    createdAt: Date;
    updatedAt: Date;
  };
}

function formatUser(user: IUser): AuthResponse["user"] {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function registerUser(input: RegisterInput): Promise<AuthResponse> {
  const existingUser = await User.findOne({ email: input.email });
  if (existingUser) {
    throw new AppError("Email already registered", 409);
  }

  const user = await User.create({
    name: input.name,
    email: input.email,
    password: input.password,
  });

  const token = generateToken(user._id.toString());

  return {
    token,
    user: formatUser(user),
  };
}

export async function loginUser(input: LoginInput): Promise<AuthResponse> {
  const user = await User.findOne({ email: input.email }).select("+password");

  if (!user) {
    throw new AppError("Invalid credentials", 401);
  }

  const isMatch = await user.comparePassword(input.password);
  if (!isMatch) {
    throw new AppError("Invalid credentials", 401);
  }

  const token = generateToken(user._id.toString());

  return {
    token,
    user: formatUser(user),
  };
}

export async function getUserById(userId: string): Promise<AuthResponse["user"]> {
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError("User not found", 404);
  }

  return formatUser(user);
}
