// ─────────────────────────────────────────────────────────────────────────────
// Lift Trainer App — Utilities
// ─────────────────────────────────────────────────────────────────────────────

import { C } from '../constants/theme';
import { RISK_FLAG } from '../constants/trainer.constants';
import { MembershipStatus, PaymentStatus, VideoWatchStatus } from '../types/trainer.types';

// ─── Date & Time ─────────────────────────────────────────────────────────────

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateTime(iso: string): string {
  return `${formatDate(iso)} at ${formatTime(iso)}`;
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return days === 1 ? 'Yesterday' : `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return 'Just now';
}

export function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

export function daysOverdue(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

// ─── Currency ─────────────────────────────────────────────────────────────────

export function formatINR(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

// ─── BMI ─────────────────────────────────────────────────────────────────────

export function calcBMI(weightKg: number, heightCm: number): number {
  const h = heightCm / 100;
  return parseFloat((weightKg / (h * h)).toFixed(1));
}

export function bmiCategory(bmi: number): string {
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25) return 'Normal';
  if (bmi < 30) return 'Overweight';
  return 'Obese';
}

// ─── Risk flags ───────────────────────────────────────────────────────────────

export function hasRiskFlag(lastWorkoutDate: string | null, membershipExpiry: string | null): boolean {
  if (lastWorkoutDate) {
    const daysSince = daysOverdue(lastWorkoutDate);
    if (daysSince >= RISK_FLAG.MISSED_WORKOUT_DAYS) return true;
  }
  if (membershipExpiry) {
    const daysLeft = daysUntil(membershipExpiry);
    if (daysLeft <= RISK_FLAG.MEMBERSHIP_EXPIRY_WARNING_DAYS) return true;
  }
  return false;
}

// ─── Status label helpers ────────────────────────────────────────────────────

export function membershipStatusColor(status: MembershipStatus): string {
  switch (status) {
    case 'Active':   return C.green;
    case 'Expiring': return C.amber;
    case 'Expired':  return C.red;
    case 'Inactive': return C.mid;
    default:         return C.mid;
  }
}

export function watchStatusLabel(status: VideoWatchStatus, percent?: number): string {
  switch (status) {
    case 'not_watched': return 'Not watched';
    case 'in_progress': return `In Progress (${percent ?? 0}%)`;
    case 'watched':     return 'Watched';
    default:            return 'Unknown';
  }
}

export function watchStatusColor(status: VideoWatchStatus): string {
  switch (status) {
    case 'not_watched': return C.mid;
    case 'in_progress': return C.amber;
    case 'watched':     return C.green;
    default:            return C.mid;
  }
}

export function paymentStatusColor(status: PaymentStatus): string {
  switch (status) {
    case 'Received': return C.green;
    case 'Pending':  return C.amber;
    case 'Failed':   return C.red;
    default:         return C.mid;
  }
}

// ─── WhatsApp helpers (TS-007, TS-017) ───────────────────────────────────────

export function whatsappURL(phone: string, message: string): string {
  const encoded = encodeURIComponent(message);
  return `https://wa.me/91${phone}?text=${encoded}`;
}

export function feeReminderMessage(name: string, amount: number, paymentLink: string): string {
  return `Hi ${name}, your Lift training subscription fee of ₹${amount.toLocaleString('en-IN')} is due. Please pay via this link: ${paymentLink}.`;
}

export function freelanceInviteMessage(trainerName: string, inviteLink: string): string {
  return `Hi! I'm inviting you to join my training program on Lift. Click this link to sign up and get started: ${inviteLink}`;
}

// ─── Validation ───────────────────────────────────────────────────────────────

export function isValidIndianPhone(phone: string): boolean {
  return /^[6-9]\d{9}$/.test(phone.replace(/\s+/g, ''));
}

export function isValidGymCode(code: string): boolean {
  return /^[A-Z0-9]{6,10}$/.test(code);
}

export function isValidOTP(otp: string): boolean {
  return /^\d{6}$/.test(otp);
}

// ─── Gym code normalisation ──────────────────────────────────────────────────

export function normaliseGymCode(raw: string): string {
  return raw.toUpperCase().replace(/\s+/g, '');
}

// ─── Duration label ──────────────────────────────────────────────────────────

export function durationLabel(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m} min` : `${m}m ${s}s`;
}

// ─── Payout date (T+2) ───────────────────────────────────────────────────────

export function razorpayPayoutDate(paymentDate: string): string {
  const d = new Date(paymentDate);
  d.setDate(d.getDate() + 2);
  return formatDate(d.toISOString());
}
