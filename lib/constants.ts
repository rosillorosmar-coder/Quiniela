export const TIME_ZONE = "America/Mexico_City";
export const CAPTURE_DEADLINE_LABEL = "11 de junio de 2026, 13:00";
export const CAPTURE_DEADLINE_UTC = "2026-06-11T19:00:00.000Z";

export function isCaptureClosed(now = new Date()) {
  return now.getTime() > new Date(CAPTURE_DEADLINE_UTC).getTime();
}

export function formatMexicoDateTime(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;

  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: TIME_ZONE
  }).format(date);
}

export function normalizeCurp(curp: string) {
  return curp.trim().toUpperCase().replace(/\s+/g, "");
}

export function maskCurp(curp: string) {
  const normalized = normalizeCurp(curp);
  if (normalized.length < 8) return "CURP registrada";
  return `${normalized.slice(0, 4)}**********${normalized.slice(-4)}`;
}
