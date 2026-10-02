/**
 * Regular expression patterns and candidate extraction for the API Autopsy Repository Scanner.
 * Strictly distinguishes direct response-field references from weaker contextual observations.
 */

export interface DirectFieldReference {
  field: string;               // e.g. "customer_id"
  expression: string;          // e.g. "payment.customer_id"
  line: number;                // 1-indexed source line number
  code: string;                // Exact line of source code e.g. "const customerId = payment.customer_id;"
}

export interface ApiCandidate {
  endpoint: string;
  method?: string;
  baseUrl?: string;
  file: string;
  line: number;                // Line number of the HTTP invocation
  evidence: string;            // Exact source code snippet of the HTTP call
  confidence: "high" | "medium" | "low";
  directReferences: DirectFieldReference[]; // Exact expressions like payment.customer_id found in application code
  observedFields: string[];    // Weaker, contextual field references
  fieldReferences?: string[];  // Backward compatibility: list of field names / expressions
}

export const HTTP_CALL_PATTERNS = [
  /axios\.(get|post|put|delete|patch)\s*\(\s*[`'"]([^`'"]+)[`'"]/i,
  /axios\s*\(\s*\{[^}]*url\s*:\s*[`'"]([^`'"]+)[`']/i,
  /fetch\s*\(\s*[`'"]([^`'"]+)[`']/i,
  /fetch\s*\(\s*`([^`]+)`/i,
  /axios\.(get|post|put|delete|patch)\s*\(\s*`([^`]+)`/i,
];

export const BASE_URL_PATTERNS = [
  /(?:baseURL|baseUrl)\s*[:=]\s*['"`](https?:\/\/[^'"`]+)['"`]/i,
  /(?:const|let|var)\s+[A-Z0-9_]*(?:BASE_URL|API_URL|API_BASE)[A-Z0-9_]*\s*=\s*['"`](https?:\/\/[^'"`]+)['"`]/i,
];

const IGNORED_PROPERTIES = new Set([
  "json",
  "status",
  "headers",
  "statusText",
  "ok",
  "data",
  "text",
  "then",
  "catch",
  "finally",
  "map",
  "filter",
  "forEach",
  "length",
  "toString",
  "push",
  "slice",
  "error",
]);

/**
 * Scan a single file's content line-by-line and extract API candidate usages.
 */
export function extractCandidatesFromFile(filePath: string, content: string): ApiCandidate[] {
  const lines = content.split(/\r?\n/);
  const candidates: ApiCandidate[] = [];

  // 1. Discover Base URL in file if defined
  let discoveredBaseUrl: string | undefined;
  for (const line of lines) {
    for (const pattern of BASE_URL_PATTERNS) {
      const match = line.match(pattern);
      if (match && match[1]) {
        discoveredBaseUrl = match[1];
        break;
      }
    }
    if (discoveredBaseUrl) break;
  }

  // 2. Scan file for HTTP calls
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    for (const pattern of HTTP_CALL_PATTERNS) {
      const match = line.match(pattern);
      if (!match) continue;

      let endpoint = match[2] || match[1];
      let method = "GET";

      if (line.includes("axios.post")) method = "POST";
      else if (line.includes("axios.put")) method = "PUT";
      else if (line.includes("axios.delete")) method = "DELETE";
      else if (line.includes("axios.patch")) method = "PATCH";
      else if (/method\s*:\s*['"]POST['"]/i.test(line) || /method\s*:\s*['"]POST['"]/i.test(lines.slice(i, i + 5).join(" "))) {
        method = "POST";
      }

      // Resolve template literals using discoveredBaseUrl
      let resolvedEndpoint = endpoint;
      if (resolvedEndpoint.includes("${") && discoveredBaseUrl) {
        resolvedEndpoint = resolvedEndpoint.replace(/\$\{[^}]*(?:BASE_URL|API_URL|API_BASE)[^}]*\}/i, discoveredBaseUrl);
      }

      // Capture exact lines of the HTTP invocation snippet (up to 4 lines)
      const callEndIdx = Math.min(lines.length, i + 4);
      const callSnippet = lines.slice(i, callEndIdx).join("\n").trim();

      // 3. Track response variables in the scope following the HTTP call
      // Look forward until the next function definition or end of block (up to 35 lines)
      const responseVars = new Set<string>(["response", "res", "data"]);
      const directReferences: DirectFieldReference[] = [];
      const observedFields = new Set<string>();

      const scopeEndIdx = Math.min(lines.length, i + 35);
      for (let j = i; j < scopeEndIdx; j++) {
        const scopeLine = lines[j];
        const scopeLineNum = j + 1;

        // If we hit a new function declaration after line i, stop scope tracking
        if (j > i && /^(?:export\s+)?(?:async\s+)?function\b/i.test(scopeLine.trim())) {
          break;
        }

        // Detect response assignment e.g. "const payment = response.data" or "const payment = await response.json()"
        const assignMatch = scopeLine.match(/(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:await\s+)?(?:response|res)(?:\.data|\.json\(\))?/i);
        if (assignMatch && assignMatch[1] && !["response", "res"].includes(assignMatch[1])) {
          responseVars.add(assignMatch[1]);
        }

        // Scan for direct field accesses on known response variables: e.g. payment.customer_id
        for (const varName of responseVars) {
          // Dot notation: \bpayment\.([a-zA-Z0-9_]+)\b
          const dotRegex = new RegExp(`\\b${varName}\\.([a-zA-Z0-9_]+)\\b`, "g");
          let dotMatch: RegExpExecArray | null;
          while ((dotMatch = dotRegex.exec(scopeLine)) !== null) {
            const prop = dotMatch[1];
            if (!IGNORED_PROPERTIES.has(prop)) {
              // Ensure we do not add exact duplicate line & expression
              const isDuplicate = directReferences.some(
                (d) => d.line === scopeLineNum && d.expression === `${varName}.${prop}`
              );
              if (!isDuplicate) {
                directReferences.push({
                  field: prop,
                  expression: `${varName}.${prop}`,
                  line: scopeLineNum,
                  code: scopeLine.trim(),
                });
              }
            }
          }

          // Bracket notation: \bpayment\['([a-zA-Z0-9_]+)'\]
          const bracketRegex = new RegExp(`\\b${varName}\\[['"]([a-zA-Z0-9_]+)['"]\\]`, "g");
          let bracketMatch: RegExpExecArray | null;
          while ((bracketMatch = bracketRegex.exec(scopeLine)) !== null) {
            const prop = bracketMatch[1];
            if (!IGNORED_PROPERTIES.has(prop)) {
              const isDuplicate = directReferences.some(
                (d) => d.line === scopeLineNum && d.field === prop
              );
              if (!isDuplicate) {
                directReferences.push({
                  field: prop,
                  expression: `${varName}['${prop}']`,
                  line: scopeLineNum,
                  code: scopeLine.trim(),
                });
              }
            }
          }
        }

        // Weaker contextual observation: fields mentioned inside payload/query without direct binding
        const weakRegex = /\b(?:params|query|payload|body|headers|record)\.([a-zA-Z0-9_]+)\b/g;
        let weakMatch: RegExpExecArray | null;
        while ((weakMatch = weakRegex.exec(scopeLine)) !== null) {
          const prop = weakMatch[1];
          if (!IGNORED_PROPERTIES.has(prop) && !directReferences.some((d) => d.field === prop)) {
            observedFields.add(prop);
          }
        }
      }

      // Confidence level:
      // High: Endpoint + at least one verified direct response-field reference in application code
      // Medium: Endpoint found with weak/contextual field references or known base URL
      // Low: Unresolved endpoint without verified direct code references
      const confidence: "high" | "medium" | "low" =
        directReferences.length > 0 && (resolvedEndpoint.startsWith("http") || discoveredBaseUrl)
          ? "high"
          : resolvedEndpoint.startsWith("http") || discoveredBaseUrl
          ? "medium"
          : "low";

      candidates.push({
        endpoint: resolvedEndpoint,
        method,
        baseUrl: discoveredBaseUrl,
        file: filePath,
        line: lineNumber,
        evidence: callSnippet,
        confidence,
        directReferences,
        observedFields: Array.from(observedFields),
        fieldReferences: directReferences.map((d) => d.expression),
      });

      break;
    }
  }

  return candidates;
}
