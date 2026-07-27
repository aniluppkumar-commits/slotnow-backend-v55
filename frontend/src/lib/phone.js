/**
 * Normalize an Indian mobile number to MSG91-compatible E.164-lite format.
 *
 * Historical bug: the deployed backend passes the raw `phone` value from
 * the client straight into the MSG91 API request. When the frontend sent
 * a 10-digit number (`9876543210`), MSG91 rejected/dropped the SMS because
 * it expects `919876543210` (with the country code). The fix must live on
 * the client because we cannot modify the deployed backend.
 *
 * Rules (in order):
 *  - Strip every non-digit (spaces, dashes, plus, brackets).
 *  - 10 digits            → prepend `91`   → `91XXXXXXXXXX`
 *  - 12 digits starting `91` → keep as-is → `91XXXXXXXXXX`
 *  - 11 digits starting `0`  → drop leading `0` and prepend `91` (very common when users type 0-prefixed local numbers)
 *  - Anything else → return the digits as-is (backend will validate + reject).
 */
export function toIndianE164(phone) {
  if (!phone) return "";
  const digits = String(phone).replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  return digits;
}
