export function validateEmail(email: string): string | null {
  if (!email.trim()) return "Email is required";
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) return "Invalid email format";
  return null;
}

export function validateUsername(username: string): string | null {
  if (!username.trim()) return "Username is required";
  if (username.trim().length < 3) return "Username must be at least 3 characters";
  if (username.trim().length > 20) return "Username must be at most 20 characters";
  if (!/^[a-zA-Z0-9_]+$/.test(username.trim())) return "Username can only contain letters, numbers, and underscores";
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return "Password is required";
  if (password.length < 6) return "Password must be at least 6 characters";
  if (password.length > 50) return "Password must be at most 50 characters";
  return null;
}

export function validateFullName(name: string): string | null {
  if (!name.trim()) return "Full name is required";
  if (name.trim().length < 2) return "Full name must be at least 2 characters";
  if (name.trim().length > 50) return "Full name must be at most 50 characters";
  return null;
}

export function validateConfirmPassword(password: string, confirm: string): string | null {
  if (!confirm) return "Please confirm your password";
  if (password !== confirm) return "Passwords do not match";
  return null;
}

export function validateRequired(value: string, fieldName: string): string | null {
  if (!value.trim()) return `${fieldName} is required`;
  return null;
}

export function validateDate(dateStr: string, fieldName: string): string | null {
  if (!dateStr.trim()) return `${fieldName} is required`;
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr.trim())) return `${fieldName} must be in YYYY-MM-DD format`;
  const date = new Date(dateStr.trim());
  if (isNaN(date.getTime())) return `${fieldName} is not a valid date`;
  return null;
}

export function validateDateRange(start: string, end: string): string | null {
  const startErr = validateDate(start, "Start date");
  if (startErr) return null;
  const endErr = validateDate(end, "End date");
  if (endErr) return null;
  const s = new Date(start.trim());
  const e = new Date(end.trim());
  if (e <= s) return "End date must be after start date";
  const diffDays = Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays > 30) return "Trip duration cannot exceed 30 days";
  return null;
}

export function validateNumPeople(val: string): string | null {
  if (!val.trim()) return "Number of people is required";
  const num = parseInt(val, 10);
  if (isNaN(num) || num < 1) return "Must be at least 1 person";
  if (num > 50) return "Maximum 50 people";
  return null;
}

export function validateDestinationName(name: string): string | null {
  if (!name.trim()) return "Destination name is required";
  if (name.trim().length < 2) return "Name must be at least 2 characters";
  if (name.trim().length > 100) return "Name must be at most 100 characters";
  return null;
}

export function validateAddress(addr: string): string | null {
  if (!addr.trim()) return "Address is required";
  if (addr.trim().length < 3) return "Address must be at least 3 characters";
  return null;
}
