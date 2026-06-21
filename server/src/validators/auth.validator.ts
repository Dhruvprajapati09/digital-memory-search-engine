export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: string[];
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateRegister(body: unknown): ValidationResult<RegisterInput> {
  const errors: string[] = [];

  if (!body || typeof body !== "object") {
    return { success: false, errors: ["Invalid request body"] };
  }

  const { name, email, password } = body as Record<string, unknown>;

  if (typeof name !== "string" || !name.trim()) {
    errors.push("Name is required");
  } else if (name.trim().length < 2) {
    errors.push("Name must be at least 2 characters");
  }

  if (typeof email !== "string" || !email.trim()) {
    errors.push("Email is required");
  } else if (!EMAIL_REGEX.test(email.trim())) {
    errors.push("Email format is invalid");
  }

  if (typeof password !== "string" || !password) {
    errors.push("Password is required");
  } else {
    if (password.length < 8) {
      errors.push("Password must be at least 8 characters");
    }
    if (!/[a-z]/.test(password)) {
      errors.push("Password must contain a lowercase letter");
    }
    if (!/[A-Z]/.test(password)) {
      errors.push("Password must contain an uppercase letter");
    }
    if (!/[0-9]/.test(password)) {
      errors.push("Password must contain a number");
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      name: (name as string).trim(),
      email: (email as string).trim().toLowerCase(),
      password: password as string,
    },
  };
}

export function validateLogin(body: unknown): ValidationResult<LoginInput> {
  const errors: string[] = [];

  if (!body || typeof body !== "object") {
    return { success: false, errors: ["Invalid request body"] };
  }

  const { email, password } = body as Record<string, unknown>;

  if (typeof email !== "string" || !email.trim()) {
    errors.push("Email is required");
  }

  if (typeof password !== "string" || !password) {
    errors.push("Password is required");
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      email: (email as string).trim().toLowerCase(),
      password: password as string,
    },
  };
}
