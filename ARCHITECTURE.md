# Baito Wallet — Architecture & Domain Specification

## 1. Core Purpose
A zero-bloat Baito Shift, Payday Cashflow, and Student Visa (28h / 40h) Compliance Engine for international students in Japan.
- **Phase 1 (Current):** Pure client-side SPA (Vite + React + TypeScript + Tailwind + Vitest) with instant `localStorage` persistence.
- **Phase 2 (Planned):** Lightweight Python (`FastAPI`) sidecar service for Japanese receipt OCR and expense tracking.

## 2. Minimum Viable Schema
1. **`Employer`:** Stores job settings (`base_hourly_yen`, `weekend_hourly_bonus_yen`, `midnight_bonus_rate`, `pays_overtime_after_8h`, `transport_per_shift_yen`, `cutoff_day` [*Shimebi*], `pay_month_offset`, `pay_day` [*Shiharaibi*]).
2. **`ShiftTemplate`:** 1-tap preset stamps (`employer_id`, `label`, `start_time`, `end_time`, `break_minutes`, `is_midnight_break`).
3. **`Shift`:** Immutable-rate calendar instances (`start_at`, `end_at`, `break_minutes`, `is_midnight_break`, `applied_hourly_yen`, `applied_transport_yen`, `pays_overtime_after_8h`).
4. **`AppSettings`:** `vacation_mode_active` (`28h` vs `40h` rolling 7-day cap) and `tax_wall_target_yen` (`¥1,030,000` vs `¥1,300,000`).

## 3. Deterministic Calculation Rules
- **Rolling 7-Day Window:** Any 7 consecutive calendar days (`[D-6 .. D]`). Overnight shifts split strictly at `00:00` midnight JST. Calm non-blocking warning when exceeding `28h` (or `40h` in vacation mode).
- **Chronological Wage & Overtime Engine:**
  - Normal window: `05:00–22:00` (`1.0x`)
  - Midnight window: `22:00–05:00` (`+0.25x`)
  - Overtime (`> 480` net worked minutes, when `pays_overtime_after_8h` is true): `+0.25x` on minutes worked after the 480th net working minute.
  - Break allocation controlled by `is_midnight_break` (`false` = deducted from regular hours first; `true` = deducted from `22:00–05:00` midnight hours first).
- **Payday & Tax Walls:**
  - Shifts map to exact Payday dates (*Shiharaibi*) using Employer *Shimebi* (`cutoff_day`).
  - **¥1.03M Tax Wall:** Sums taxable wages (excluding tax-exempt transport) for paydays in `Jan 1 – Dec 31`.
  - **¥1.30M Social Insurance Wall:** Sums gross wages + transport allowance for paydays in `Jan 1 – Dec 31`.
