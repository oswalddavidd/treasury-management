import { EventEmitter } from "node:events";

/** In-process pub/sub so the SSE stream can push on ledger/LP/FX/clock changes. */
export const bufferEvents = new EventEmitter();
bufferEvents.setMaxListeners(0);

export function notifyBufferStateChanged(): void {
  bufferEvents.emit("changed");
}
