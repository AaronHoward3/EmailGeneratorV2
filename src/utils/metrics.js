// ESM-safe; lightweight
import { randomUUID } from "crypto";

let lastMetricsSummary = null;

export function setLastMetrics(summary) {
  lastMetricsSummary = summary;
}

export function getLastMetrics() {
  return lastMetricsSummary;
}

export function newMetrics({ emailType, designAesthetic } = {}) {
  const requestId = randomUUID();
  const t0 = process.hrtime.bigint();

  const timers = new Map();   // step -> start ns
  const elapsed = new Map();  // step -> ms
  const usage = { input: 0, output: 0 };

  // Track per-call usage for cost calc
  const apiCalls = []; // { step, model, inputTokens, outputTokens }

  function start(step) { timers.set(step, process.hrtime.bigint()); }
  function end(step) {
    const s = timers.get(step);
    if (!s) return;
    const ms = Number(process.hrtime.bigint() - s) / 1e6;
    elapsed.set(step, (elapsed.get(step) || 0) + ms);
  }
  function totalMs() { return Number(process.hrtime.bigint() - t0) / 1e6; }

  function addUsageFromResponse(resp) {
    const u = resp?.usage || resp?.meta?.usage || null;
    if (!u) return;
    if (typeof u.prompt_tokens === "number") usage.input += u.prompt_tokens;
    if (typeof u.input_tokens === "number") usage.input += u.input_tokens;
    if (typeof u.completion_tokens === "number") usage.output += u.completion_tokens;
    if (typeof u.output_tokens === "number") usage.output += u.output_tokens;
  }

  function addLocalUsage({ input = 0, output = 0 } = {}) {
    usage.input += Math.max(0, Math.floor(input));
    usage.output += Math.max(0, Math.floor(output));
  }

  // Record a single API call (for pricing)
  function recordApiCall({ step, model, usage: u }) {
    const inputTokens =
      (typeof u?.prompt_tokens === "number" ? u.prompt_tokens : 0) +
      (typeof u?.input_tokens === "number" ? u.input_tokens : 0);
    const outputTokens =
      (typeof u?.completion_tokens === "number" ? u.completion_tokens : 0) +
      (typeof u?.output_tokens === "number" ? u.output_tokens : 0);
    apiCalls.push({ step, model: model || null, inputTokens, outputTokens });
  }

  function log(...args) { console.log(`[GEN ${requestId}]`, ...args); }

  function summary(extra = {}) {
    return {
      requestId,
      emailType: extra.emailType ?? emailType ?? null,
      designAesthetic: extra.designAesthetic ?? designAesthetic ?? null,
      layout: extra.layout ?? null,
      timesMs: Object.fromEntries(elapsed.entries()),
      totalMs: Math.round(totalMs()),
      usage: {
        inputTokens: usage.input,
        outputTokens: usage.output,
        totalTokens: usage.input + usage.output,
      },
      // not exposing apiCalls by default; controller can compute costs with it
    };
  }

  return {
    requestId,
    start, end, totalMs,
    addUsageFromResponse,
    addLocalUsage,
    recordApiCall,   // <-- new
    log,
    summary,
    // extra hooks
    costs: undefined, // image/text/total costs can be attached by services/controllers
    apiCalls,         // controller will read this to compute text costs
  };
}
