import Anthropic from "@anthropic-ai/sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ai = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@/lib/ai/client", () => ({
  anthropic: { messages: { create: ai.create } },
  isAiConfigured: () => true,
  MODELS: { GENERATION: "claude-sonnet-5", EXTRACTION: "claude-haiku-4-5" },
}));

import { answerCostUsd, askEngine } from "@/lib/geo/assistants";

const UA = { language: "Ukrainian", region: "Ukraine", countryCode: "UA" };
const env = { OPENAI_API_KEY: "sk-test", GOOGLE_AI_API_KEY: "g-test" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/**
 * Each assistant is asked with web search on, from the asker's country, as a
 * customer's own assistant answers (review of 2026-11-27: Claude only, no
 * web search). No real call: the Anthropic client and fetch are mocked.
 */
describe("asking the assistants", () => {
  beforeEach(() => ai.create.mockReset());

  it("asks Claude with its web search tool and the asker's country", async () => {
    ai.create.mockResolvedValue({
      model: "claude-sonnet-5",
      stop_reason: "end_turn",
      content: [
        { type: "server_tool_use", id: "s", name: "web_search", input: {} },
        { type: "text", text: "Try Podarunky.", citations: [{ type: "web_search_result_location", url: "https://podarunky.ua/", title: "", cited_text: "", encrypted_index: "" }] },
      ],
      usage: { input_tokens: 5000, output_tokens: 300, server_tool_use: { web_search_requests: 2, web_fetch_requests: 0 } },
    });
    const answer = await askEngine("claude", "Де купити подарунок?", UA, { env });
    const params = ai.create.mock.calls[0][0];
    expect(params.tools).toEqual([{ type: "web_search_20250305", name: "web_search", max_uses: 3, user_location: { type: "approximate", country: "UA" } }]);
    expect(params.system).toBeUndefined();
    expect(answer).toMatchObject({ engine: "claude", webSearch: true, text: "Try Podarunky.", searches: 2, sources: ["https://podarunky.ua/"] });
    // $2/M in, $10/M out, $10 per 1,000 searches.
    expect(answerCostUsd(answer)).toBeCloseTo(0.01 + 0.003 + 0.02, 5);
  });

  it("asks Claude again without the tool when web search is refused, and says so", async () => {
    ai.create
      .mockRejectedValueOnce(new Anthropic.BadRequestError(400, { type: "error", error: { type: "invalid_request_error", message: "web_search is not enabled for this organization" } }, undefined, new Headers()))
      .mockResolvedValueOnce({ model: "claude-sonnet-5", stop_reason: "end_turn", content: [{ type: "text", text: "An answer." }], usage: { input_tokens: 10, output_tokens: 5, server_tool_use: null } });
    const answer = await askEngine("claude", "q", UA, { env });
    expect(ai.create.mock.calls[1][0].tools).toBeUndefined();
    expect(answer.webSearch).toBe(false);
  });

  it("does not hide an outage as a refusal of web search", async () => {
    ai.create.mockRejectedValueOnce(new Anthropic.APIError(529, { type: "error", error: { type: "overloaded_error", message: "Overloaded" } }, undefined, new Headers()));
    const error = await askEngine("claude", "q", UA, { env }).then(() => null, (e: unknown) => e);
    expect(String(error)).toMatch(/529/);
    expect(ai.create).toHaveBeenCalledTimes(1);
  });

  it("asks ChatGPT through the Responses API with web search and the country", async () => {
    const http = vi.fn().mockResolvedValue(json({
      model: "gpt-5-mini-2026-08-07",
      output: [
        { type: "web_search_call" },
        { type: "message", content: [{ type: "output_text", text: "Podarunky is good.", annotations: [{ type: "url_citation", url: "https://podarunky.ua/" }] }] },
      ],
      usage: { input_tokens: 4000, output_tokens: 800 },
    }));
    const answer = await askEngine("chatgpt", "Де купити подарунок?", UA, { env, fetch: http as unknown as typeof fetch });
    const [url, init] = http.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/responses");
    expect(init.headers.Authorization).toBe("Bearer sk-test");
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ model: "gpt-5-mini", input: "Де купити подарунок?", store: false, tools: [{ type: "web_search", user_location: { type: "approximate", country: "UA" } }] });
    expect(answer).toMatchObject({ engine: "chatgpt", model: "gpt-5-mini-2026-08-07", webSearch: true, searches: 1, text: "Podarunky is good.", sources: ["https://podarunky.ua/"] });
  });

  it("treats an empty ChatGPT answer as no answer", async () => {
    const http = vi.fn().mockResolvedValue(json({ output: [], usage: {} }));
    await expect(askEngine("chatgpt", "q", UA, { env, fetch: http as unknown as typeof fetch })).rejects.toThrow(/no answer/);
  });

  it("asks Gemini with Google Search grounding", async () => {
    const http = vi.fn().mockResolvedValue(json({
      modelVersion: "gemini-3.7-flash",
      candidates: [{
        content: { parts: [{ text: "thinking", thought: true }, { text: "Podarunky." }] },
        groundingMetadata: { webSearchQueries: ["подарунки київ", "де купити"], groundingChunks: [{ web: { uri: "https://vertexaisearch.example/redirect" } }] },
      }],
      usageMetadata: { promptTokenCount: 20, candidatesTokenCount: 100, thoughtsTokenCount: 50 },
    }));
    const answer = await askEngine("gemini", "q", UA, { env: { ...env, GEO_GEMINI_MODEL: "gemini-x" }, fetch: http as unknown as typeof fetch });
    const [url, init] = http.mock.calls[0];
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-x:generateContent");
    expect(init.headers["x-goog-api-key"]).toBe("g-test");
    expect(JSON.parse(init.body).tools).toEqual([{ google_search: {} }]);
    expect(answer).toMatchObject({ engine: "gemini", model: "gemini-3.7-flash", webSearch: true, text: "Podarunky.", searches: 2, usage: { inputTokens: 20, outputTokens: 150 } });
    // One grounded prompt is billed once, however many queries it ran.
    expect(answerCostUsd(answer)).toBeCloseTo(0.014 + (20 * 0.5 + 150 * 3) / 1_000_000, 6);
  });

  it("asks Gemini again without grounding when it is refused", async () => {
    const http = vi
      .fn()
      .mockResolvedValueOnce(new Response("google_search tool is not supported for this model", { status: 400 }))
      .mockResolvedValueOnce(json({ candidates: [{ content: { parts: [{ text: "Plain answer." }] } }] }));
    const answer = await askEngine("gemini", "q", UA, { env, fetch: http as unknown as typeof fetch });
    expect(JSON.parse(http.mock.calls[1][1].body).tools).toBeUndefined();
    expect(answer.webSearch).toBe(false);
  });
});
