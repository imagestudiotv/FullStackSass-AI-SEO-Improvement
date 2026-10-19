import { describe, expect, it } from "vitest";
import { localAuthRedirect } from "./local-origin";

describe("local authentication origin", () => {
  it("keeps an invitation and email when moving to the configured origin", () => {
    expect(localAuthRedirect("http://127.0.0.1:3000/sign-in?next=%2Finvite%2Fabc&email=qa%40example.test", "http://localhost:3000"))
      .toBe("http://localhost:3000/sign-in?next=%2Finvite%2Fabc&email=qa%40example.test");
  });
  it("supports the reverse alias without a redirect loop", () => {
    expect(localAuthRedirect("http://localhost:3000/sign-up", "http://127.0.0.1:3000")).toBe("http://127.0.0.1:3000/sign-up");
    expect(localAuthRedirect("http://localhost:3000/sign-in", "http://localhost:3000")).toBeNull();
  });
  it.each([
    ["http://127.0.0.1:3000/dashboard", "http://localhost:3000"],
    ["http://127.0.0.1:3000/sign-in", "http://localhost:4000"],
    ["http://127.0.0.1:3000/sign-in", "https://localhost:3000"],
    ["https://repget.com/sign-in", "https://other.example"],
    ["http://127.0.0.1:3000/sign-in", "https://repget.com"],
    ["http://127.0.0.1:3000/sign-in", "invalid"],
  ])("does not redirect unrelated origins or routes", (url, configured) => {
    expect(localAuthRedirect(url, configured)).toBeNull();
  });
});
