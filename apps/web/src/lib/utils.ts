import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Platform } from '@rowa/core'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('th-TH').format(n)
}

export const platformLabel: Record<Platform, string> = {
  lazada: 'Lazada',
  shopee: 'Shopee',
  store: 'หน้าร้าน',
}

export const platformColor: Record<Platform, string> = {
  lazada: 'badge-lazada',
  shopee: 'badge-shopee',
  store: 'badge-store',
}
