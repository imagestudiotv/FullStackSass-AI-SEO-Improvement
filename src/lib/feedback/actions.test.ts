import { beforeEach, describe, expect, it, vi } from "vitest";

/** The forms' action: who is sending, and what it passes on (the checks themselves are send.test.ts's). */

const session = vi.hoisted(() => ({ value: null as unknown }));
vi.mock("@/lib/auth-guard", () => ({ getSession: async () => session.value }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7" }) }));
const core = vi.hoisted(() => ({ submit: vi.fn() }));
vi.mock("./send", () => ({ submitFeedback: core.submit }));

import { sendFeedback } from "./actions";

function form(fields: Record<string, string>, files: File[] = []) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  for (const file of files) data.append("screenshot", file);
  return data;
}
const file = (bytes: number, type = "image/png") => new File([new Uint8Array(bytes)], "picture", { type });
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
    expect(input).toMatchObject({ kind: "idea", email: "sam@example.com", pageUrl: "/dashboard", locale: "de", elapsedMs: 9000, trap: "", screenshots: [] });
    expect(sender).toMatchObject({ source: "website", userId: null, accountEmail: null, organizationId: null });
    expect(sender.visitor).toEqual(expect.any(String));
  });

  it("from a signed-in customer is the dashboard's and carries their account", async () => {
    session.value = { user: { id: "user-1", email: "dana@shop.example" }, session: { activeOrganizationId: "org-1" } };
    await sendFeedback(form(FIELDS));
    expect(core.submit.mock.calls[0][1]).toMatchObject({ source: "dashboard", userId: "user-1", accountEmail: "dana@shop.example", organizationId: "org-1" });
  });

  it("passes the pictures on in order, and refuses too many or too much before reading them", async () => {
    await sendFeedback(form(FIELDS, [file(1000), file(2000, "image/webp")]));
    const sent = core.submit.mock.calls[0][0].screenshots as { data: Buffer; type: string }[];
    expect(sent.map((picture) => [picture.type, picture.data.length])).toEqual([
      ["image/png", 1000],
      ["image/webp", 2000],
    ]);
    expect(await sendFeedback(form(FIELDS, Array.from({ length: 6 }, () => file(10))))).toEqual({ ok: false, code: "screenshot_count" });
    expect(await sendFeedback(form(FIELDS, [file(500 * 1024), file(401 * 1024)]))).toEqual({ ok: false, code: "screenshot_size" });
    expect(core.submit).toHaveBeenCalledTimes(1);
  });

  it("never returns the stored id to the browser", async () => {
    expect(await sendFeedback(form(FIELDS))).toEqual({ ok: true });
  });
});
