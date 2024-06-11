import type { TaskRecord } from "./worker";

interface Usage {
  count60s: number;
  usage60s: number;
  count10s: number;
  usage10s: number;
  count1s: number;
  usage1s: number;
}

export interface Capacity {
  tokens: number;
  requests: number;
}

/**
 * Ref: https://learn.microsoft.com/en-us/azure/ai-services/openai/how-to/quota#understanding-rate-limits
 * check tpm capacity (1 min window: < tpm limit)
 * check tpm capacity (10 sec window: < (tpm - consumed)/6 if not first req)
 * check tpm capacity (1 sec window: < (tpm - consumed)/60 if not first req)
 *
 * Additionally, there seems to be an undocumented requests per 10 seconds limit.
 * The limits are available from the Deployment Management API
 * Ref: https://learn.microsoft.com/en-us/rest/api/cognitiveservices/accountmanagement/deployments/list
 */
export function getCapacity(requestsPerMinute: number, tokensPerMinute: number, records: TaskRecord[]): Capacity {
  const ago60s = Date.now() - 60_000;
  const ago10s = Date.now() - 10_000;
  const ago1s = Date.now() - 1_000;

  const windowedRecords = records.reduce<Usage>(
    (result, record) => {
      if (record.startedAt > ago60s) {
        // TODO Azure does not use actual usage for throttling. Otherwise, we can switch to tokensUsed
        const usage = record.tokensDemanded;

        result.count60s++;
        result.usage60s += usage;

        if (record.startedAt > ago10s) {
          result.count10s++;
          result.usage10s += usage;

          if (record.startedAt > ago1s) {
            result.count1s++;
            result.usage1s += usage;
          }
        }
      }

      return result;
    },
    {
      count60s: 0,
      usage60s: 0,
      count10s: 0,
      usage10s: 0,
      count1s: 0,
      usage1s: 0,
    }
  );

  const tokenCapcity60s = tokensPerMinute - windowedRecords.usage60s;
  const tokenCapacity10s = windowedRecords.count10s > 0 ? tokensPerMinute / 6 - windowedRecords.usage10s : tokenCapcity60s;
  const tokenCapacity1s = windowedRecords.count1s > 0 ? tokensPerMinute / 60 - windowedRecords.usage1s : tokenCapcity60s;

  const requestCapacity60s = requestsPerMinute - windowedRecords.count60s;
  const requestCapacity10s = requestsPerMinute / 6 - windowedRecords.count10s;

  return {
    tokens: Math.min(tokenCapacity1s, tokenCapacity10s, tokenCapcity60s),
    requests: Math.min(requestCapacity10s, requestCapacity60s),
  };
}
export interface WindowedUsage {
  tokens: number;
  requests: number;
}
export function getWindowedUsage(windowSizeMs: number, records: TaskRecord[]): WindowedUsage {
  const windowStartMs = Date.now() - windowSizeMs;

  return records.reduce<WindowedUsage>(
    (result, record) => {
      if (record.startedAt > windowStartMs) {
        result.tokens += record.tokensDemanded;
        result.requests++;
      }

      return result;
    },
    {
      tokens: 0,
      requests: 0,
    }
  );
}
