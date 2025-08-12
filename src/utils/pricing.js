// Compute $ cost for text calls using per-model pricing from ENV.
// Set ENV like:
//  PRICE_GPT_4O_MINI_INPUT_PER_M=0.150
//  PRICE_GPT_4O_MINI_OUTPUT_PER_M=0.600
// (values are $ per 1M tokens)

function envKeyForModel(model) {
  return String(model || "")
    .replace(/[^a-z0-9]+/gi, "_")
    .toUpperCase();
}

function parseNum(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

export function getTextRates(model) {
  const key = envKeyForModel(model);
  const inStr = process.env[`PRICE_${key}_INPUT_PER_M`];
  const outStr = process.env[`PRICE_${key}_OUTPUT_PER_M`];
  return {
    inputPerM: parseNum(inStr),
    outputPerM: parseNum(outStr),
  };
}

function roundUsd(x, places = 5) {
  return Math.round((x + Number.EPSILON) * 10 ** places) / 10 ** places;
}

/**
 * calls: [{ step, model, inputTokens, outputTokens }]
 */
export function computeTextCostUSD(calls = []) {
  let totalIn = 0;
  let totalOut = 0;
  const byCall = [];

  for (const c of calls) {
    const { step, model, inputTokens = 0, outputTokens = 0 } = c || {};
    const { inputPerM, outputPerM } = getTextRates(model);
    const inUSD = inputPerM != null ? (inputTokens / 1e6) * inputPerM : null;
    const outUSD = outputPerM != null ? (outputTokens / 1e6) * outputPerM : null;

    if (inUSD != null) totalIn += inUSD;
    if (outUSD != null) totalOut += outUSD;

    byCall.push({
      step,
      model,
      inputTokens,
      outputTokens,
      inputUSD: inUSD != null ? roundUsd(inUSD) : null,
      outputUSD: outUSD != null ? roundUsd(outUSD) : null,
      totalUSD:
        inUSD != null || outUSD != null
          ? roundUsd((inUSD || 0) + (outUSD || 0))
          : null,
    });
  }

  return {
    inputUSD: roundUsd(totalIn),
    outputUSD: roundUsd(totalOut),
    totalUSD: roundUsd(totalIn + totalOut),
    byCall,
  };
}
