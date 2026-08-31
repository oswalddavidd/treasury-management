import { useEffect, useState } from "react";
import { buttonClass, Field, inputClass, Panel } from "./Field.js";
import { useBuy, useDepositIdr, useSell, useWithdrawIdr } from "../../api/simHooks.js";
import type { CoinDTO } from "../../api/types.js";

const DEFAULT_USER_ID = "sim-user-1";

export function TradeActionsPanel({ coins }: { coins: CoinDTO[] }) {
  const [userId, setUserId] = useState(DEFAULT_USER_ID);

  const [depositAmount, setDepositAmount] = useState("1000000");
  const [withdrawAmount, setWithdrawAmount] = useState("1000000");

  const [buyCoinId, setBuyCoinId] = useState(coins[0]?.id ?? "");
  const [buyIdrAmount, setBuyIdrAmount] = useState("1000000");
  const [buyPrice, setBuyPrice] = useState("1000000");

  const [sellCoinId, setSellCoinId] = useState(coins[0]?.id ?? "");
  const [sellCoinAmount, setSellCoinAmount] = useState("1");
  const [sellPrice, setSellPrice] = useState("1000000");

  // The coin list can arrive after this component's first render (or
  // change out from under it — e.g. after a reset), and useState's
  // initializer only ever runs once. Without this, a selection made while
  // `coins` was empty gets stuck at "" forever even once real coins load —
  // the <select> visually falls back to showing the first <option>, but
  // the actual state (and therefore the button's disabled check) never
  // catches up.
  useEffect(() => {
    if (coins.length === 0) return;
    if (!coins.some((c) => c.id === buyCoinId)) setBuyCoinId(coins[0].id);
    if (!coins.some((c) => c.id === sellCoinId)) setSellCoinId(coins[0].id);
  }, [coins, buyCoinId, sellCoinId]);

  const depositIdr = useDepositIdr();
  const withdrawIdr = useWithdrawIdr();
  const buy = useBuy();
  const sell = useSell();

  return (
    <Panel title="Trade actions">
      <div className="mb-4">
        <Field label="User id">
          <input className={inputClass} value={userId} onChange={(e) => setUserId(e.target.value)} />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase text-neutral-500">Deposit IDR</p>
          <div className="flex items-end gap-2">
            <Field label="Amount">
              <input
                className={inputClass}
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
              />
            </Field>
            <button
              className={buttonClass}
              disabled={depositIdr.isPending}
              onClick={() => depositIdr.mutate({ userId, amount: depositAmount })}
            >
              Deposit
            </button>
          </div>

          <p className="mt-2 text-xs font-medium uppercase text-neutral-500">Withdraw IDR</p>
          <div className="flex items-end gap-2">
            <Field label="Amount">
              <input
                className={inputClass}
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
              />
            </Field>
            <button
              className={buttonClass}
              disabled={withdrawIdr.isPending}
              onClick={() => withdrawIdr.mutate({ userId, amount: withdrawAmount })}
            >
              Withdraw
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase text-neutral-500">Buy coin</p>
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Coin">
              <select
                className={inputClass}
                value={buyCoinId}
                onChange={(e) => setBuyCoinId(e.target.value)}
              >
                {coins.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.id}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="IDR amount">
              <input
                className={inputClass}
                value={buyIdrAmount}
                onChange={(e) => setBuyIdrAmount(e.target.value)}
              />
            </Field>
            <Field label="Price (IDR/unit)">
              <input className={inputClass} value={buyPrice} onChange={(e) => setBuyPrice(e.target.value)} />
            </Field>
            <button
              className={buttonClass}
              disabled={buy.isPending || !buyCoinId}
              onClick={() =>
                buy.mutate({ userId, coinId: buyCoinId, idrAmount: buyIdrAmount, price: buyPrice })
              }
            >
              Buy
            </button>
          </div>

          <p className="mt-2 text-xs font-medium uppercase text-neutral-500">Sell coin</p>
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Coin">
              <select
                className={inputClass}
                value={sellCoinId}
                onChange={(e) => setSellCoinId(e.target.value)}
              >
                {coins.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.id}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Coin amount">
              <input
                className={inputClass}
                value={sellCoinAmount}
                onChange={(e) => setSellCoinAmount(e.target.value)}
              />
            </Field>
            <Field label="Price (IDR/unit)">
              <input
                className={inputClass}
                value={sellPrice}
                onChange={(e) => setSellPrice(e.target.value)}
              />
            </Field>
            <button
              className={buttonClass}
              disabled={sell.isPending || !sellCoinId}
              onClick={() =>
                sell.mutate({
                  userId,
                  coinId: sellCoinId,
                  coinAmount: sellCoinAmount,
                  price: sellPrice,
                })
              }
            >
              Sell
            </button>
          </div>
        </div>
      </div>
    </Panel>
  );
}
