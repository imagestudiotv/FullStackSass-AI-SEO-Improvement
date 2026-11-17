import { onConsentChange, readConsent } from "@/lib/consent";

/** First-party withdrawal only. No Google requests or identifying request body. */
export function startConsentWithdrawalSync(send: typeof fetch = fetch): () => void {
  let stopped = false;
  let inFlight = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const sync = async () => {
    if (stopped || inFlight || readConsent() !== "denied") return;
    inFlight = true;
    let ok = false;
    try {
      const response = await send("/api/analytics/consent", { method: "POST", credentials: "same-origin", keepalive: true, signal: AbortSignal.timeout(5000) });
      // A refusal (4xx) does not change by repeating it every 30 s; the next page load asks again.
      ok = response.ok || (response.status >= 400 && response.status < 500);
    } catch { /* Offline: repeat while this document is open, on reconnect and on the next page. */ }
    finally {
      inFlight = false;
      if (!ok && !stopped && readConsent() === "denied") timer = setTimeout(() => void sync(), 30_000);
    }
  };
  const changed = () => { clearTimeout(timer); void sync(); };
  const stop = onConsentChange(changed);
  window.addEventListener("online", changed);
  void sync();
  return () => { stopped = true; clearTimeout(timer); stop(); window.removeEventListener("online", changed); };
}
