export type VehicleInput = {
  make: string;
  model: string;
  registrationNumber: string;
};

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function normalizePhone(value: string) {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  return trimmed.startsWith("+") ? `+${digits}` : digits;
}

export function normalizeRegistration(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
}

export function validateEmail(value: string) {
  const email = normalizeEmail(value);
  if (!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(email) || email.length > 254) {
    return "Enter a valid email address.";
  }
  return null;
}

export function validatePassword(value: string, signingUp = true) {
  if (!signingUp) return value.length >= 6 ? null : "Password must be at least 6 characters.";
  if (value.length < 8 || value.length > 72) return "Password must be 8 to 72 characters.";
  if (!/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/[0-9]/.test(value)) {
    return "Password must include uppercase, lowercase, and a number.";
  }
  return null;
}

export function validateFullName(value: string, label = "Full name") {
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 80) return `${label} must be 2 to 80 characters.`;
  if (!/^[\p{L}][\p{L}\p{M} .'-]*$/u.test(name)) {
    return `${label} can contain letters, spaces, apostrophes, periods, and hyphens only.`;
  }
  return null;
}

export function validatePhone(value: string, label = "Phone") {
  const phone = normalizePhone(value);
  if (!/^\+[1-9][0-9]{9,14}$/.test(phone)) return `Enter a valid ${label.toLowerCase()} number.`;
  if (phone.startsWith("+91") && !/^\+91[6-9][0-9]{9}$/.test(phone)) {
    return `${label} must be a valid 10-digit Indian mobile number.`;
  }
  return null;
}

export function validateOptionalPhone(value: string, label = "Phone") {
  return value.trim() ? validatePhone(value, label) : null;
}

export function validateVehicleInput({ make, model, registrationNumber }: VehicleInput) {
  const cleanMake = make.trim();
  const cleanModel = model.trim();
  const cleanRegistration = normalizeRegistration(registrationNumber);
  if (!/^[A-Za-z0-9][A-Za-z0-9 .&'-]{1,39}$/.test(cleanMake)) {
    return "Vehicle make must be 2 to 40 valid characters.";
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9 .&'-]{0,39}$/.test(cleanModel)) {
    return "Vehicle model must be 1 to 40 valid characters.";
  }
  const standardRegistration = /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$/;
  const bharatRegistration = /^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$/;
  if (!standardRegistration.test(cleanRegistration) && !bharatRegistration.test(cleanRegistration)) {
    return "Enter a valid Indian registration number, for example TS09AB1234.";
  }
  return null;
}

export function validateDrivingLicence(value: string) {
  const clean = value.trim().toUpperCase().replace(/\s+/g, "");
  if (!/^[A-Z]{2}[0-9A-Z-]{8,18}$/.test(clean)) {
    return "Enter a valid driving licence number.";
  }
  return null;
}

export function validateUpiId(value: string) {
  if (!value.trim()) return null;
  if (!/^[A-Za-z0-9._-]{2,100}@[A-Za-z][A-Za-z0-9.-]{1,49}$/.test(value.trim())) {
    return "Enter a valid UPI ID, for example name@bank.";
  }
  return null;
}