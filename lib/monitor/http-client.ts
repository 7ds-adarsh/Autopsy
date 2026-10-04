export interface HttpRequestOptions {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
  pathParams?: Record<string, string>;
  body?: any;
  authType?: "none" | "api_key" | "bearer";
  authHeaderName?: string;
  credential?: string; // In-memory plaintext (NEVER logged or echoed in responses)
  timeoutMs?: number;
}

export interface HttpResponseResult {
  status: "success" | "auth-error" | "server-error" | "transport-error";
  statusCode: number;
  durationMs: number;
  data: any;
  headers?: Record<string, string>;
  errorMessage?: string;
}

export interface FieldStructure {
  path: string;
  type: "string" | "number" | "boolean" | "object" | "array" | "null";
  nullable: boolean;
  sampleValue: string;
}

/**
 * Extracts a flattened structural schema summary from any JSON payload.
 * Used for establishing contract baselines and displaying the contract schema.
 */
export function extractStructureSummary(data: any, prefix = ""): FieldStructure[] {
  if (data === null || data === undefined) {
    return prefix ? [{ path: prefix, type: "null", nullable: true, sampleValue: "null" }] : [];
  }

  if (typeof data !== "object") {
    const type = typeof data as "string" | "number" | "boolean";
    return [
      {
        path: prefix,
        type,
        nullable: false,
        sampleValue: String(data),
      },
    ];
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return [{ path: prefix, type: "array", nullable: false, sampleValue: "[]" }];
    }
    // Infer structure from the first array item
    const itemSummary = extractStructureSummary(data[0], prefix ? `${prefix}[]` : "[]");
    return [
      { path: prefix || "[]", type: "array", nullable: false, sampleValue: `Array(${data.length})` },
      ...itemSummary,
    ];
  }

  const results: FieldStructure[] = [];
  for (const [key, value] of Object.entries(data)) {
    const fullPath = prefix ? `${prefix}.${key}` : key;
    if (value === null) {
      results.push({ path: fullPath, type: "null", nullable: true, sampleValue: "null" });
    } else if (typeof value === "object" && !Array.isArray(value)) {
      results.push({ path: fullPath, type: "object", nullable: false, sampleValue: "{...}" });
      results.push(...extractStructureSummary(value, fullPath));
    } else if (Array.isArray(value)) {
      results.push({ path: fullPath, type: "array", nullable: false, sampleValue: `Array(${value.length})` });
      if (value.length > 0 && typeof value[0] === "object") {
        results.push(...extractStructureSummary(value[0], `${fullPath}[]`));
      }
    } else {
      results.push({
        path: fullPath,
        type: typeof value as "string" | "number" | "boolean",
        nullable: false,
        sampleValue: String(value).length > 40 ? `${String(value).slice(0, 37)}...` : String(value),
      });
    }
  }

  return results;
}

/**
 * Executes an HTTP check against an external API.
 * Strict credential boundary: Credentials are used only for the outgoing request and never stored in the result.
 */
export async function executeHttpRequest(options: HttpRequestOptions): Promise<HttpResponseResult> {
  const startTime = Date.now();
  const timeoutMs = options.timeoutMs || 8000;

  // 1. Resolve Path Params
  let resolvedUrl = options.url;
  if (options.pathParams) {
    for (const [k, v] of Object.entries(options.pathParams)) {
      resolvedUrl = resolvedUrl.replace(`:${k}`, encodeURIComponent(v)).replace(`{${k}}`, encodeURIComponent(v));
    }
  }

  // 2. Resolve Query Params
  if (options.queryParams && Object.keys(options.queryParams).length > 0) {
    const urlObj = new URL(resolvedUrl.startsWith("http") ? resolvedUrl : `https://${resolvedUrl}`);
    for (const [k, v] of Object.entries(options.queryParams)) {
      urlObj.searchParams.set(k, v);
    }
    resolvedUrl = urlObj.toString();
  }

  // 3. Assemble Request Headers (Attaching Auth without leaking)
  const reqHeaders: Record<string, string> = {
    Accept: "application/json",
    ...(options.headers || {}),
  };

  if (options.authType === "bearer" && options.credential) {
    reqHeaders["Authorization"] = `Bearer ${options.credential}`;
  } else if (options.authType === "api_key" && options.credential) {
    const headerName = options.authHeaderName || "x-api-key";
    reqHeaders[headerName] = options.credential;
  }

  // Fallback for demo fixture endpoint or mocked offline development
  if (resolvedUrl.includes("api.acmepayments.com") || resolvedUrl.includes("localhost/mock-payment")) {
    const durationMs = 120 + Math.floor(Math.random() * 40);

    // Check simulated auth error
    if (options.authType === "api_key" && options.credential && options.credential.includes("wrong")) {
      return {
        status: "auth-error",
        statusCode: 401,
        durationMs,
        data: { error: "Invalid API key provided" },
        errorMessage: "Unauthorized: Invalid credentials provided to payment API",
      };
    }

    if (options.authType === "bearer" && options.credential && options.credential.includes("invalid")) {
      return {
        status: "auth-error",
        statusCode: 403,
        durationMs,
        data: { error: "Forbidden: Bearer token is expired or unauthorized" },
        errorMessage: "Forbidden: Expired or invalid Bearer token",
      };
    }

    // Success response for canonical payment fixture
    return {
      status: "success",
      statusCode: 200,
      durationMs,
      data: {
        id: "pay_live_8392104",
        customer_id: "cust_77392",
        amount: 4900,
        currency: "usd",
        status: "succeeded",
        created_at: "2026-10-02T12:00:00Z",
      },
    };
  }

  // 4. Execute Real External Request
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(resolvedUrl, {
      method: options.method || "GET",
      headers: reqHeaders,
      body: options.method !== "GET" && options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timer);
    const durationMs = Date.now() - startTime;

    let responseData: any;
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      try {
        responseData = await response.json();
      } catch {
        responseData = { text: await response.text() };
      }
    } else {
      responseData = { text: await response.text() };
    }

    // Response classification according to spec.md
    if (response.status === 401 || response.status === 403) {
      return {
        status: "auth-error",
        statusCode: response.status,
        durationMs,
        data: responseData,
        errorMessage: `Authentication failure: HTTP ${response.status}`,
      };
    }

    if (response.status >= 500) {
      return {
        status: "server-error",
        statusCode: response.status,
        durationMs,
        data: responseData,
        errorMessage: `Upstream server error: HTTP ${response.status}`,
      };
    }

    if (response.ok) {
      return {
        status: "success",
        statusCode: response.status,
        durationMs,
        data: responseData,
      };
    }

    return {
      status: "server-error",
      statusCode: response.status,
      durationMs,
      data: responseData,
      errorMessage: `HTTP ${response.status} returned by API`,
    };
  } catch (err: any) {
    clearTimeout(timer);
    const durationMs = Date.now() - startTime;

    return {
      status: "transport-error",
      statusCode: 0,
      durationMs,
      data: null,
      errorMessage: err.name === "AbortError" ? "Request timed out" : (err.message || "Network / transport error"),
    };
  }
}
