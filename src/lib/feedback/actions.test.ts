import { beforeEach, describe, expect, it, vi } from "vitest";

/** The forms' action: who is sending, and what it passes on (the checks themselves are send.test.ts's). */

const session = vi.hoisted(() => ({ value: null as unknown }));
vi.mock("@/lib/auth-guard", () => ({ getSession: async () => session.value }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7" }) }));
const core = vi.hoisted(() => ({ submit: vi.fn() }));
vi.mock("./send", () => ({ submitFeedback: core.submit }));

import { sendFeedback } from "./actions";

function form(fields: Record<string, string>, file?: File) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  if (file) data.set("screenshot", file);
  return data;
}
const FIELDS = { kind: "idea", message: "A weekly ranking email.", email: "sam@example.com", name: "Sam", page: "/dashboard", locale: "de", source: "dashboard", elapsed: "9000", company: "" };

beforeEach(() => {
  core.submit.mockReset();
  core.submit.mockResolvedValue({ ok: true, id: "f1" });
  session.value = null;
});

describe("sending feedback", () => {
  it("from a visitor counts as the website's, whatever the form says, with no account", async () => {
    expect(await sendFeedback(form(FIELDS))).toEqual({ ok: true });
    const [input, sender] = core.submit.mock.calls[0];
    expect(input).toMatchObject({ kind: "idea", email: "sam@example.com", pageUrl: "/dashboard", locale: "de", elapsedMs: 9000, trap: "", screenshot: null });
    expect(sender).toMatchObject({ source: "website", userId: null, accountEmail: null, organizationId: null });
    expect(sender.visitor).toEqual(expect.any(String));
  });

  it("from a signed-in customer is the dashboard's and carries their account", async () => {
    session.value = { user: { id: "user-1", email: "dana@shop.example" }, session: { activeOrganizationId: "org-1" } };
    await sendFeedback(form(FIELDS));
    expect(core.submit.mock.calls[0][1]).toMatchObject({ source: "dashboard", userId: "user-1", accountEmail: "dana@shop.example", organizationId: "org-1" });
  });

  it("passes a screenshot on, and refuses one too big before reading it", async () => {
    await sendFeedback(form(FIELDS, new File([new Uint8Array(1000)], "shot.png", { type: "image/png" })));
    expect(core.submit.mock.calls[0][0].screenshot).toMatchObject({ type: "image/png" });
    expect(core.submit.mock.calls[0][0].screenshot.data.length).toBe(1000);
    expect(await sendFeedback(form(FIELDS, new File([new Uint8Array(901 * 1024)], "big.png", { type: "image/png" })))).toEqual({ ok: false, code: "screenshot_size" });
    expect(core.submit).toHaveBeenCalledTimes(1);
  });

  it("never returns the stored id to the browser", async () => {
    expect(await sendFeedback(form(FIELDS))).toEqual({ ok: true });
  });
});
