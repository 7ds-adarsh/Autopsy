import { App, Octokit } from "octokit";

export interface RepoTreeItem {
  path: string;
  mode?: string;
  type: "blob" | "tree";
  sha?: string;
  size?: number;
  url?: string;
}

// Canonical demo fixture repository files for demonstration and testing
export const DEMO_FIXTURE_FILES: Record<string, string> = {
  "src/services/payment.ts": `import axios from "axios";

const API_BASE_URL = "https://api.acmepayments.com/v1";

export async function processPayment(amount: number, token: string) {
  const response = await axios.post(\`\${API_BASE_URL}/payments\`, {
    amount,
    currency: "USD",
    token,
  }, {
    headers: {
      Authorization: \`Bearer \${process.env.PAYMENT_API_KEY}\`,
    },
  });

  const payment = response.data;

  // Legacy billing system requires customer_id
  const customerId = payment.customer_id;
  console.log(\`Processing payment for customer: \${customerId}\`);

  return {
    success: true,
    paymentId: payment.id,
    customerId: payment.customer_id,
    amount: payment.amount,
    status: payment.status,
  };
}

export async function getPaymentStatus(paymentId: string) {
  const response = await axios.get(\`\${API_BASE_URL}/payments/\${paymentId}\`);
  const payment = response.data;

  // Direct access for customer record lookup
  const customerId = payment.customer_id;

  return {
    id: payment.id,
    customerId: payment.customer_id,
    status: payment.status,
  };
}
`,
  "src/controllers/order.ts": `import { processPayment } from "../services/payment";

export async function handleCheckout(req: any, res: any) {
  const { amount, paymentToken } = req.body;
  try {
    const payment = await processPayment(amount, paymentToken);
    return res.json({
      status: "complete",
      orderId: "ord_live_8392",
      customerId: payment.customerId,
    });
  } catch (error) {
    return res.status(500).json({ error: "Payment processing failed" });
  }
}
`,
  "package.json": `{
  "name": "acme-checkout-service",
  "version": "1.0.0",
  "dependencies": {
    "axios": "^1.6.0"
  }
}
`,
  // Files placed in ignore paths to verify ignore filtering
  "node_modules/axios/index.js": `// Ignored dependency file
module.exports = { get: () => {} };
`,
  "dist/bundle.js": `// Ignored compiled build artifact
var axios = require('axios');
`,
};

function getGitHubApp(): App | null {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;

  if (!appId || !privateKey || appId === "your_github_app_id") {
    return null;
  }

  try {
    return new App({
      appId,
      privateKey: privateKey.replace(/\\n/g, "\n"),
    });
  } catch (error) {
    console.warn("[GitHub App] Failed to initialize Octokit App with credentials:", error);
    return null;
  }
}

/**
 * Returns an authenticated Octokit instance for a given GitHub App installation.
 */
export async function getInstallationClient(installationId: string): Promise<Octokit | null> {
  if (installationId.startsWith("fixture-")) {
    return null;
  }

  const app = getGitHubApp();
  if (!app) return null;

  try {
    return (await app.getInstallationOctokit(Number(installationId))) as unknown as Octokit;
  } catch (err) {
    console.error(`[GitHub App] Error getting Octokit for installation ${installationId}:`, err);
    return null;
  }
}

/**
 * Fetches the recursive repository file tree.
 */
export async function getRepoFileTree(
  owner: string,
  repo: string,
  installationId: string,
  defaultBranch = "main"
): Promise<RepoTreeItem[]> {
  const client = await getInstallationClient(installationId);

  if (!client) {
    // Return the demo fixture tree if no client or if fixture repo
    return Object.keys(DEMO_FIXTURE_FILES).map((path) => ({
      path,
      type: "blob",
      size: DEMO_FIXTURE_FILES[path].length,
    }));
  }

  try {
    // 1. Get default branch commit SHA
    const branchRes = await client.rest.repos.getBranch({
      owner,
      repo,
      branch: defaultBranch,
    });
    const treeSha = branchRes.data.commit.commit.tree.sha;

    // 2. Fetch recursive tree
    const treeRes = await client.rest.git.getTree({
      owner,
      repo,
      tree_sha: treeSha,
      recursive: "1",
    });

    return (treeRes.data.tree as RepoTreeItem[]) || [];
  } catch (error) {
    console.error(`[GitHub App] Error fetching tree for ${owner}/${repo}:`, error);
    // Fallback to fixture files if error occurs
    return Object.keys(DEMO_FIXTURE_FILES).map((path) => ({
      path,
      type: "blob",
      size: DEMO_FIXTURE_FILES[path].length,
    }));
  }
}

/**
 * Fetches the raw text content of a specific file from the repository.
 */
export async function getFileContent(
  owner: string,
  repo: string,
  path: string,
  installationId: string
): Promise<string | null> {
  if (installationId.startsWith("fixture-") || !getGitHubApp()) {
    return DEMO_FIXTURE_FILES[path] || null;
  }

  const client = await getInstallationClient(installationId);
  if (!client) {
    return DEMO_FIXTURE_FILES[path] || null;
  }

  try {
    const res = await client.rest.repos.getContent({
      owner,
      repo,
      path,
    });

    const data = res.data;
    if (!Array.isArray(data) && "content" in data && data.content) {
      return Buffer.from(data.content, "base64").toString("utf-8");
    }

    return null;
  } catch (error) {
    console.warn(`[GitHub App] Failed to fetch content for ${path}:`, error);
    return DEMO_FIXTURE_FILES[path] || null;
  }
}
