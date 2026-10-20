import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * A small Chrome DevTools Protocol client for the partner-program browser
 * tests: the installed Chrome, driven over Node's built-in WebSocket - no
 * browser download and no extra dependency (see README.md for why not
 * Playwright). Each BrowserContext is an isolated profile (its own cookies
 * and storage), so a partner, an administrator and a visitor can be signed
 * in at once.
 */

type Message = { id?: number; method?: string; params?: Record<string, unknown>; result?: unknown; error?: { message: string }; sessionId?: string };
type Listener = (params: Record<string, unknown>, sessionId?: string) => void;

const DEFAULT_CHROME = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter((candidate): candidate is string => Boolean(candidate));

export class Browser {
  private nextId = 1;
  private pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void; method: string }>();
  private listeners = new Map<string, Set<Listener>>();

  private constructor(
    private readonly socket: WebSocket,
    private readonly process: ChildProcess,
    private readonly profile: string,
  ) {
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as Message;
      if (message.id !== undefined) {
        const waiting = this.pending.get(message.id);
        if (!waiting) return;
        this.pending.delete(message.id);
        if (message.error) waiting.reject(new Error(`${waiting.method}: ${message.error.message}`));
        else waiting.resolve(message.result);
        return;
      }
      if (message.method) for (const listener of this.listeners.get(message.method) ?? []) listener(message.params ?? {}, message.sessionId);
    });
  }

  static async launch(options: { headless?: boolean } = {}): Promise<Browser> {
    const executable = DEFAULT_CHROME.find((candidate) => existsSync(candidate));
    if (!executable) throw new Error("Chrome not found: set CHROME_PATH");
    const profile = mkdtempSync(path.join(tmpdir(), "repget-e2e-chrome-"));
    const child = spawn(
      executable,
      [
        options.headless === false ? "" : "--headless=new",
        "--remote-debugging-port=0",
        `--user-data-dir=${profile}`,
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-extensions",
        "--disable-background-networking",
        "--disable-sync",
        "--metrics-recording-only",
        "--hide-scrollbars",
        "about:blank",
      ].filter(Boolean),
      { stdio: "ignore" },
    );
    const portFile = path.join(profile, "DevToolsActivePort");
    const started = Date.now();
    // Chrome writes the file while we poll; on Windows reading it mid-write fails with EBUSY.
    const readPort = () => {
      try {
        const lines = readFileSync(portFile, "utf8").trim().split("\n");
        return lines.length >= 2 ? lines : null;
      } catch {
        return null;
      }
    };
    let lines = existsSync(portFile) ? readPort() : null;
    while (!lines) {
      if (Date.now() - started > 30_000) throw new Error("Chrome did not start");
      await new Promise((resolve) => setTimeout(resolve, 100));
      lines = existsSync(portFile) ? readPort() : null;
    }
    const [port, browserPath] = lines;
    const socket = new WebSocket(`ws://127.0.0.1:${port}${browserPath}`);
    await new Promise<void>((resolve, reject) => {
      socket.addEventListener("open", () => resolve(), { once: true });
      socket.addEventListener("error", () => reject(new Error("CDP connection failed")), { once: true });
    });
    return new Browser(socket, child, profile);
  }

  send<T = Record<string, unknown>>(method: string, params: Record<string, unknown> = {}, sessionId?: string): Promise<T> {
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject, method });
      this.socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }

  on(method: string, listener: Listener): () => void {
    if (!this.listeners.has(method)) this.listeners.set(method, new Set());
    this.listeners.get(method)!.add(listener);
    return () => this.listeners.get(method)!.delete(listener);
  }

  async newContext(): Promise<Context> {
    const { browserContextId } = await this.send<{ browserContextId: string }>("Target.createBrowserContext", { disposeOnDetach: true });
    return new Context(this, browserContextId);
  }

  async close(): Promise<void> {
    try {
      await Promise.race([this.send("Browser.close"), new Promise((resolve) => setTimeout(resolve, 3000))]);
    } catch {
      // Already gone.
    }
    this.socket.close();
    this.process.kill();
    await new Promise((resolve) => setTimeout(resolve, 300));
    rmSync(this.profile, { recursive: true, force: true, maxRetries: 5 });
  }
}

export type Cookie = { name: string; value: string; domain: string; path: string; httpOnly: boolean; secure: boolean; sameSite?: string };

export class Context {
  constructor(
    readonly browser: Browser,
    readonly id: string,
  ) {}

  async newPage(): Promise<Page> {
    const { targetId } = await this.browser.send<{ targetId: string }>("Target.createTarget", { url: "about:blank", browserContextId: this.id });
    const { sessionId } = await this.browser.send<{ sessionId: string }>("Target.attachToTarget", { targetId, flatten: true });
    const page = new Page(this.browser, sessionId, targetId);
    await page.init();
    return page;
  }

  async cookies(): Promise<Cookie[]> {
    const { cookies } = await this.browser.send<{ cookies: Cookie[] }>("Storage.getCookies", { browserContextId: this.id });
    return cookies;
  }

  async close(): Promise<void> {
    await this.browser.send("Target.disposeBrowserContext", { browserContextId: this.id }).catch(() => {});
  }
}

export type Viewport = { width: number; height: number; mobile?: boolean };
export const DESKTOP: Viewport = { width: 1440, height: 900 };
export const PHONE: Viewport = { width: 390, height: 844, mobile: true };

export class Page {
  /** Console errors and uncaught exceptions since the last navigation. */
  readonly errors: string[] = [];

  constructor(
    private readonly browser: Browser,
    readonly sessionId: string,
    readonly targetId: string,
  ) {}

  async init() {
    await this.send("Page.enable");
    await this.send("Runtime.enable");
    this.browser.on("Runtime.exceptionThrown", (params, sessionId) => {
      if (sessionId !== this.sessionId) return;
      const details = params.exceptionDetails as { text?: string; exception?: { description?: string } };
      this.errors.push(`exception: ${details.exception?.description ?? details.text ?? "unknown"}`.slice(0, 300));
    });
    this.browser.on("Runtime.consoleAPICalled", (params, sessionId) => {
      if (sessionId !== this.sessionId || params.type !== "error") return;
      const args = (params.args as { value?: unknown; description?: string }[]).map((arg) => String(arg.value ?? arg.description ?? ""));
      this.errors.push(`console: ${args.join(" ")}`.slice(0, 300));
    });
  }

  send<T = Record<string, unknown>>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    return this.browser.send<T>(method, params, this.sessionId);
  }

  private waitForEvent(method: string, timeout: number): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        off();
        reject(new Error(`timed out waiting for ${method}`));
      }, timeout);
      const off = this.browser.on(method, (params, sessionId) => {
        if (sessionId !== this.sessionId) return;
        clearTimeout(timer);
        off();
        resolve(params);
      });
    });
  }

  /** Navigates and waits for the load event; returns the final document's status and path. */
  async goto(url: string, timeout = 60_000): Promise<{ status: number; path: string }> {
    this.errors.length = 0;
    const loaded = this.waitForEvent("Page.loadEventFired", timeout);
    const result = await this.send<{ errorText?: string }>("Page.navigate", { url });
    if (result.errorText) throw new Error(`navigation to ${url} failed: ${result.errorText}`);
    await loaded;
    // Streamed pages first show their loading skeleton (aria-busy); wait for the real content.
    await this.waitFor(() => !document.querySelector('[aria-busy="true"]'), { timeout, message: "content after loading" });
    return this.documentState();
  }

  async documentState(): Promise<{ status: number; path: string }> {
    return this.evaluate(() => ({
      status: (performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming & { responseStatus?: number })?.responseStatus ?? 0,
      path: location.pathname + location.search,
    }));
  }

  /** Runs a function in the page. Arguments must be JSON. */
  async evaluate<T, A extends unknown[] = []>(fn: (...args: A) => T | Promise<T>, ...args: A): Promise<T> {
    const { result, exceptionDetails } = await this.send<{ result: { value?: T }; exceptionDetails?: { text: string; exception?: { description?: string } } }>("Runtime.evaluate", {
      expression: `(${fn.toString()})(...${JSON.stringify(args)})`,
      awaitPromise: true,
      returnByValue: true,
    });
    if (exceptionDetails) throw new Error(`in page: ${exceptionDetails.exception?.description ?? exceptionDetails.text}`);
    return result.value as T;
  }

  /** Polls a condition in the page until it returns something truthy. */
  async waitFor<T, A extends unknown[] = []>(fn: (...args: A) => T, options: { timeout?: number; message?: string } = {}, ...args: A): Promise<T> {
    const deadline = Date.now() + (options.timeout ?? 20_000);
    let last: unknown;
    while (Date.now() < deadline) {
      try {
        const value = await this.evaluate(fn, ...args);
        if (value) return value;
      } catch (error) {
        last = error;
      }
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    throw new Error(`timed out: ${options.message ?? fn.toString().slice(0, 120)}${last ? ` (${String(last)})` : ""}`);
  }

  async waitForText(text: string, timeout = 20_000): Promise<void> {
    try {
      await this.waitFor((needle: string) => document.body?.innerText.includes(needle), { timeout }, text);
    } catch {
      const shown = (await this.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 600);
      const where = await this.documentState().catch(() => ({ path: "?" }));
      throw new Error(`timed out waiting for text "${text}" on ${where.path}; the page shows: ${shown}`);
    }
  }

  async text(): Promise<string> {
    return this.evaluate(() => document.body?.innerText ?? "");
  }

  /** Clicks the first visible button or link whose text starts with `label` (inside a dialog when one is open and `inDialog`). */
  async clickByText(label: string, options: { inDialog?: boolean; selector?: string } = {}): Promise<void> {
    await this.waitFor(
      (needle: string, inDialog: boolean, selector: string) => {
        const root: ParentNode = inDialog ? (document.querySelector('[role="dialog"]') ?? document) : document;
        const candidates = [...root.querySelectorAll<HTMLElement>(selector)].filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && (element.textContent ?? "").trim().startsWith(needle) && !(element as HTMLButtonElement).disabled;
        });
        if (!candidates[0]) return false;
        candidates[0].click();
        return true;
      },
      { message: `click "${label}"` },
      label,
      Boolean(options.inDialog),
      options.selector ?? "button, a",
    );
  }

  /** Types into a field the way a person does (focus, select what is there, insert text), so React sees real input events. */
  async fill(selector: string, value: string): Promise<void> {
    await this.waitFor(
      (css: string) => {
        const element = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(css);
        if (!element) return false;
        element.focus();
        element.select();
        return true;
      },
      { message: `field ${selector}` },
      selector,
    );
    await this.send("Input.insertText", { text: value });
  }

  async selectOption(selector: string, value: string): Promise<void> {
    await this.evaluate(
      (css: string, option: string) => {
        const element = document.querySelector<HTMLSelectElement>(css);
        if (!element) throw new Error(`no select ${css}`);
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!;
        setter.call(element, option);
        element.dispatchEvent(new Event("change", { bubbles: true }));
      },
      selector,
      value,
    );
  }

  /** Headers every request from this page carries (here: the simulated person's x-real-ip). */
  async setHeaders(headers: Record<string, string>): Promise<void> {
    await this.send("Network.enable");
    await this.send("Network.setExtraHTTPHeaders", { headers });
  }

  async setViewport(viewport: Viewport): Promise<void> {
    await this.send("Emulation.setDeviceMetricsOverride", { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: Boolean(viewport.mobile) });
    await this.send("Emulation.setTouchEmulationEnabled", { enabled: Boolean(viewport.mobile) });
  }

  async setTheme(theme: "light" | "dark"): Promise<void> {
    await this.evaluate((value: string) => localStorage.setItem("repget-theme", value), theme);
  }

  async screenshot(file: string, fullPage = false): Promise<void> {
    const { data } = await this.send<{ data: string }>("Page.captureScreenshot", { format: "png", captureBeyondViewport: fullPage });
    writeFileSync(file, Buffer.from(data, "base64"));
  }

  /** Pixels the page is wider than the window (0 = no sideways scrolling). */
  async horizontalOverflow(): Promise<number> {
    return this.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  }

  async close(): Promise<void> {
    await this.browser.send("Target.closeTarget", { targetId: this.targetId }).catch(() => {});
  }
}
