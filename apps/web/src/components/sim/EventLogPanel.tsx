import { Panel } from "./Field.js";
import type { LedgerEventDTO } from "../../api/types.js";

function formatAmount(event: LedgerEventDTO): string {
  const parts: string[] = [];
  if (event.idrAmount) parts.push(`Rp${Number(event.idrAmount).toLocaleString("en-US")}`);
  if (event.coinAmount) parts.push(`${event.coinAmount} ${event.coinId ?? ""}`.trim());
  return parts.join(" / ") || "—";
}

export function EventLogPanel({ events }: { events: LedgerEventDTO[] }) {
  return (
    <Panel title="Recent events">
      {events.length === 0 ? (
        <p className="text-xs text-neutral-500">No events yet.</p>
      ) : (
        <div className="max-h-80 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-neutral-900 text-neutral-500">
              <tr>
                <th className="py-1 pr-3 font-normal">Seq</th>
                <th className="py-1 pr-3 font-normal">Type</th>
                <th className="py-1 pr-3 font-normal">User</th>
                <th className="py-1 pr-3 font-normal">Amount</th>
                <th className="py-1 pr-3 font-normal">Occurred</th>
              </tr>
            </thead>
            <tbody className="text-neutral-300">
              {events.map((e) => (
                <tr key={e.id} className="border-t border-neutral-800">
                  <td className="py-1 pr-3 tabular-nums text-neutral-500">{e.seq}</td>
                  <td className="py-1 pr-3">{e.type}</td>
                  <td className="py-1 pr-3">{e.userId}</td>
                  <td className="py-1 pr-3 tabular-nums">{formatAmount(e)}</td>
                  <td className="py-1 pr-3 tabular-nums text-neutral-500">
                    {new Date(e.occurredAt).toLocaleString("en-GB", { timeZone: "Asia/Jakarta" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
