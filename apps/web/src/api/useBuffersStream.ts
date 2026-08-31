import { useEffect, useRef, useState } from "react";
import type { BufferStateDTO } from "./buffersTypes.js";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
const HISTORY_LIMIT = 60;

export interface ConsumptionPoint {
  t: number;
  v: number | null;
}

/**
 * Consumes the SSE stream directly (proving that piece works end-to-end,
 * not just the polling GET). Also builds a rolling in-memory trajectory per
 * coin and for the buy side, purely from frames observed since this page
 * opened — there is no historical time-series endpoint, so a sparkline
 * necessarily starts blank on load and fills in as frames arrive.
 */
export function useBuffersStream() {
  const [state, setState] = useState<BufferStateDTO | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [, forceRender] = useState(0);
  const historyRef = useRef<Record<string, ConsumptionPoint[]>>({});
  const buyHistoryRef = useRef<ConsumptionPoint[]>([]);

  useEffect(() => {
    const source = new EventSource(`${API_URL}/api/buffers/stream`);

    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.onmessage = (event) => {
      const data: BufferStateDTO = JSON.parse(event.data);
      setState(data);
      setLastUpdated(Date.now());
      setConnected(true);

      const t = Date.now();
      for (const coin of data.coinStates) {
        const points = historyRef.current[coin.coinId] ?? [];
        points.push({ t, v: coin.consumed === null ? null : Number(coin.consumed) });
        if (points.length > HISTORY_LIMIT) points.shift();
        historyRef.current[coin.coinId] = points;
      }
      if (data.buySide) {
        buyHistoryRef.current.push({
          t,
          v: data.buySide.consumed === null ? null : Number(data.buySide.consumed),
        });
        if (buyHistoryRef.current.length > HISTORY_LIMIT) buyHistoryRef.current.shift();
      }
      forceRender((n) => n + 1); // history refs mutate in place — nudge a re-render
    };

    return () => source.close();
  }, []);

  return {
    state,
    connected,
    lastUpdated,
    history: historyRef.current,
    buyHistory: buyHistoryRef.current,
  };
}
