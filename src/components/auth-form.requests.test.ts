import { isValidElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  values: [] as unknown[], setters: [] as ReturnType<typeof vi.fn>[], index: 0,
  email: vi.fn(), signUp: vi.fn(), otp: vi.fn(), sendCode: vi.fn(), social: vi.fn(), error: vi.fn(), assign: vi.fn(),
}));
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useEffect: () => {},
  useState: (initial: unknown) => {
    const index = mocks.index++;
    mocks.setters[index] ??= vi.fn();
    return [mocks.values[index] ?? initial, mocks.setters[index]];
  },
}));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams("next=%2Finvite%2Ftest") }));
vi.mock("sonner", () => ({ toast: { error: mocks.error, success: vi.fn() } }));
vi.mock("@/lib/auth-client", () => ({ authClient: {
  signIn: { email: mocks.email, emailOtp: mocks.otp, social: mocks.social },
  signUp: { email: mocks.signUp }, emailOtp: { sendVerificationOtp: mocks.sendCode },
} }));
import { AuthForm } from "./auth-form";
import { getMessages } from "@/lib/i18n/messages";
const t = getMessages("en").app.auth;

function nodes(node: ReactNode): { type: unknown; props: Record<string, unknown> }[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!isValidElement<Record<string, unknown>>(node)) return [];
  return [{ type: node.type, props: node.props }, ...nodes(node.props.children as ReactNode)];
}
beforeEach(() => {
  vi.clearAllMocks(); mocks.index = 0; mocks.setters = [];
  mocks.values = ["QA", "qa@example.test", "disposable-test-password", false, false, false, "password", false, "123456"];
  vi.stubGlobal("window", { location: { assign: mocks.assign } });
});
afterEach(() => vi.unstubAllGlobals());

describe("authentication request recovery", () => {
  it.each(["sign-in", "sign-up", "code", "verify", "google"])("restores controls after a thrown %s network error", async mode => {
    if (mode === "code" || mode === "verify") mocks.values[6] = "code";
    if (mode === "verify") mocks.values[7] = true;
    const request = mode === "google" ? mocks.social : mode === "code" ? mocks.sendCode : mode === "verify" ? mocks.otp : mode === "sign-up" ? mocks.signUp : mocks.email;
    request.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const tree = nodes(AuthForm({ mode: mode === "sign-up" ? "sign-up" : "sign-in", t }));
    const target = mode === "google" ? tree.find(n => n.props.onClick)
      : mode === "code" ? tree.find(n => typeof n.props.onClick === "function" && n.props.onClick.name === "handleRequestCode")
      : tree.find(n => n.type === "form");
    expect(target).toBeDefined();
    const handler = target!.props[mode === "google" || mode === "code" ? "onClick" : "onSubmit"] as (event: { preventDefault(): void }) => Promise<void>;
    await handler({ preventDefault() {} });
    expect(request).toHaveBeenCalledTimes(1);
    expect(mocks.error).toHaveBeenCalledWith(t.connectionFailed);
    expect(mocks.setters[mode === "google" ? 4 : 3].mock.calls).toEqual([[true], [false]]);
    expect(mocks.assign).not.toHaveBeenCalled();
  });
  it("navigates once to the preserved invitation after a successful sign-in", async () => {
    mocks.email.mockResolvedValueOnce({ error: null });
    const form = nodes(AuthForm({ mode: "sign-in", t })).find(n => n.type === "form")!;
    await (form.props.onSubmit as (event: { preventDefault(): void }) => Promise<void>)({ preventDefault() {} });
    expect(mocks.assign).toHaveBeenCalledExactlyOnceWith("/invite/test");
  });
});
