// lib/dateUtils.ts — Display date formatting helpers for badminton app

/**
 * Formats an ISO date string (YYYY-MM-DD or full ISO) into DD/MM/YY for UI display.
 * Internal data stores and calculations remain untouched in ISO format (YYYY-MM-DD).
 *
 * Example:
 *   formatDateDDMMYY("2026-10-11") => "11/10/26"
 */
export function formatDateDDMMYY(dateStr?: string | null): string {
  if (!dateStr) return "";
  const str = String(dateStr).trim();
  if (/^\d{2}\/\d{2}\/\d{2}$/.test(str)) return str;

  const cleanStr = str.includes("T") ? str.split("T")[0] : str;
  const parts = cleanStr.split("-");
  if (parts.length === 3) {
    const [yyyy, mm, dd] = parts;
    const yy = yyyy.length === 4 ? yyyy.slice(-2) : yyyy;
    return `${dd.padStart(2, "0")}/${mm.padStart(2, "0")}/${yy.padStart(2, "0")}`;
  }

  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yy = String(d.getFullYear()).slice(-2);
      return `${dd}/${mm}/${yy}`;
    }
  } catch {}

  return str;
}
