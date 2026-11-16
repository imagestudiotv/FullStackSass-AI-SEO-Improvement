import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { startConsentWithdrawalSync } from "./consent-withdrawal";

const consent = vi.hoisted(() => ({ value: "granted", listener: (() => {}) as () => void }));
vi.mock("@/lib/consent", () => ({
  readConsent: () => consent.value,
  onConsentChange: (listener: () => void) => { consent.listener = listener; return () => { consent.listener = () => {}; }; },
}));
beforeEach(() => { vi.useFakeTimers(); vi.stubGlobal("window", new EventTarget()); consent.value = "granted"; });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it("sends withdrawal only to the first-party endpoint after refusal, with no identity in a body or URL", async () => {
  const send = vi.fn<typeof fetch>(async () => new Response(null, { status: 204 }));
  const stop = startConsentWithdrawalSync(send);
  expect(send).not.toHaveBeenCalled();
  consent.value = "denied"; consent.listener();
  await vi.advanceTimersByTimeAsync(0);
  expect(send).toHaveBeenCalledWith("/api/analytics/consent", expect.objectContaining({ method: "POST", credentials: "same-origin" }));
  expect(send.mock.calls[0][1]).not.toHaveProperty("body");
  stop();
});

it("recovers an offline refusal while the page remains open and stops after acknowledgement/unmount", async () => {
  consent.value = "denied";
  const send = vi.fn<typeof fetch>().mockRejectedValueOnce(Error("offline")).mockResolvedValue(new Response(null, { status: 204 }));
  const stop = startConsentWithdrawalSync(send);
  await vi.advanceTimersByTimeAsync(30_000);
  expect(send).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(60_000);
  expect(send).toHaveBeenCalledTimes(2);
  stop();
  window.dispatchEvent(new Event("online"));
  consent.listener();
  expect(send).toHaveBeenCalledTimes(2);
});
