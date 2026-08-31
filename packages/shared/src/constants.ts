import Decimal from "decimal.js";

// §1.1 — custody split. Uniform across all coins (per product decision — the
// model intentionally does not carry a per-coin ratio field).
export const ICC_RATIO = new Decimal("0.70"); // ICC keeps 70% of crypto
export const CRYPTO_FREE_FLOAT_RATIO = new Decimal("0.30"); // Coinbit retains 30%
export const KKI_RATIO = new Decimal("0.80"); // KKI keeps 80% of IDR
export const IDR_FREE_FLOAT_RATIO = new Decimal("0.20"); // Coinbit retains 20%

// §1.5 — status bands, assigned on peak consumption, not current.
export const BAND_THRESHOLDS = {
  HALTED: new Decimal("1.00"),
  CRITICAL: new Decimal("0.80"),
  ALERT: new Decimal("0.50"),
  WATCH: new Decimal("0.25"),
} as const;
