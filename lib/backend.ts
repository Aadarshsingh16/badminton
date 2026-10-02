// lib/backend.ts — Centralized backend API resolution
export const DEFAULT_BACKEND_URL = "https://badminton-l1p2.onrender.com";

export function getBackendUrl(): string {
  if (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.trim() !== "") {
    return process.env.NEXT_PUBLIC_API_URL.trim();
  }
  return DEFAULT_BACKEND_URL;
}
