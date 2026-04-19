import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function currency(value: number | string | null | undefined) {
  const num = Number(value || 0);
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    maximumFractionDigits: 2
  }).format(num);
}

export function makeAffiliateCode(name: string) {
  const clean = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 5)
    .toUpperCase();

  return `${clean || "AFI"}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}
