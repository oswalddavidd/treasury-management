import type { Clock } from "./types.js";

export class RealClock implements Clock {
  now(): Date {
    return new Date();
  }
}
