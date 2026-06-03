import { t } from "@/lib/i18n";

export function parseDDMMYYYY(dateStr: string): Date | null {
  const regex = /^(\d{2})-(\d{2})-(\d{4})$/;
  const match = dateStr.trim().match(regex);
  if (!match) return null;
  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1;
  const year = parseInt(match[3], 10);
  const date = new Date(year, month, day);
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) return null;
  return date;
}

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
  if (!dateStr.trim()) return t().validation.required(fieldName);
  const regex = /^(\d{2})-(\d{2})-(\d{4})$/;
  if (!regex.test(dateStr.trim())) return t().validation.invalidDateFormat(fieldName);
  const parsed = parseDDMMYYYY(dateStr);
  if (!parsed) return t().validation.invalidDate(fieldName);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (parsed < today) return t().validation.dateNotBeforeToday(fieldName);
  return null;
}

export function validateDateRange(start: string, end: string): string | null {
  const s = parseDDMMYYYY(start);
  const e = parseDDMMYYYY(end);
  if (!s || !e) return null;
  if (e < s) return t().validation.endDateAfterStart;
  const diffDays = Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays > 30) return t().validation.maxTripDuration;
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
