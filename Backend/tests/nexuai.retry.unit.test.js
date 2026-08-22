import { jest } from "@jest/globals";
import getNexusAiApiResponse from "../utils/nexuai.js";

// Unit tests for the retry + model-fallback logic added to nexuai.js.
// We never hit the real Gemini API here - `global.fetch` is replaced with
// a mock so we can simulate rate limits, server errors, and recovery in a
// controlled, repeatable way, without spending real API quota or needing
// network access.
//
// Jest's fake timers replace setTimeout so the exponential backoff delays
// (which can be several real seconds) resolve instantly in test time -
// `jest.runAllTimersAsync()` fast-forwards through every pending retry
// wait in one step.

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "MockStatus",
    headers: { get: () => null }, // no Retry-After header in these tests
    json: async () => body
  };
}

beforeEach(() => {
  jest.useFakeTimers();
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("getNexusAiApiResponse retry + fallback (unit)", () => {
  test("returns text immediately on a successful first call (no retry needed)", async () => {
    global.fetch.mockResolvedValueOnce(
      jsonResponse(200, { candidates: [{ content: { parts: [{ text: "Hello!" }] } }] })
    );

    const result = await getNexusAiApiResponse("hi");

    expect(result).toBe("Hello!");
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test("retries after a 429 rate-limit and succeeds on a later attempt", async () => {
    global.fetch
      .mockResolvedValueOnce(jsonResponse(429, { error: { code: 429, message: "Rate limited" } }))
      .mockResolvedValueOnce(
        jsonResponse(200, { candidates: [{ content: { parts: [{ text: "Recovered!" }] } }] })
      );

    const promise = getNexusAiApiResponse("hi");
    await jest.runAllTimersAsync(); // fast-forward through the backoff wait
    const result = await promise;

    expect(result).toBe("Recovered!");
    expect(global.fetch).toHaveBeenCalledTimes(2); // 1 failure + 1 success, same model
  });

  test("does NOT retry on a non-retryable error (e.g. 400 bad request)", async () => {
    global.fetch.mockResolvedValue(
      jsonResponse(400, { error: { code: 400, message: "Invalid request" } })
    );

    const promise = getNexusAiApiResponse("hi");
    // Attach the rejection assertion BEFORE flushing timers, so Jest
    // treats the eventual rejection as an expected assertion outcome
    // rather than an unhandled promise rejection.
    const assertion = expect(promise).rejects.toThrow(/Invalid request/);
    await jest.runAllTimersAsync();
    await assertion;

    // One call per model in the fallback chain, but zero extra retries per
    // model, since 400 isn't in the retryable status set.
    expect(global.fetch).toHaveBeenCalledTimes(3); // one attempt on each of the 3 chained models
  });

  test("falls back to the next model after the first model exhausts all its retries", async () => {
    global.fetch
      // Primary model: 3 straight 429s (all its retries used up)
      .mockResolvedValueOnce(jsonResponse(429, { error: { code: 429, message: "Rate limited" } }))
      .mockResolvedValueOnce(jsonResponse(429, { error: { code: 429, message: "Rate limited" } }))
      .mockResolvedValueOnce(jsonResponse(429, { error: { code: 429, message: "Rate limited" } }))
      // Fallback model: succeeds immediately
      .mockResolvedValueOnce(
        jsonResponse(200, { candidates: [{ content: { parts: [{ text: "From fallback model" }] } }] })
      );

    const promise = getNexusAiApiResponse("hi");
    await jest.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe("From fallback model");
    expect(global.fetch).toHaveBeenCalledTimes(4); // 3 failed attempts on model 1, then 1 success on model 2
  });

  test("throws a combined error listing every model's failure when all models are exhausted", async () => {
    // Every model, every attempt, fails with a 500.
    global.fetch.mockResolvedValue(
      jsonResponse(500, { error: { code: 500, message: "Server error" } })
    );

    const promise = getNexusAiApiResponse("hi");
    const assertion = expect(promise).rejects.toThrow(/Gemini API unavailable after retries across all models/);
    await jest.runAllTimersAsync();
    await assertion;
    // 3 models x 3 attempts each = 9 total calls.
    expect(global.fetch).toHaveBeenCalledTimes(9);
  });

  test("retries on a network error (fetch throws) and can still recover", async () => {
    global.fetch
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(
        jsonResponse(200, { candidates: [{ content: { parts: [{ text: "Back online" }] } }] })
      );

    const promise = getNexusAiApiResponse("hi");
    await jest.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe("Back online");
  });

  test("rejects immediately without calling fetch when given no text and no image", async () => {
    await expect(getNexusAiApiResponse("")).rejects.toThrow(/Provide a non-empty message/);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
