const http = require("node:http");
const { readFile } = require("node:fs/promises");
const path = require("node:path");

const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || "127.0.0.1";
const MCP_URL = process.env.META_ADS_MCP_URL || "https://mcp.facebook.com/ads";
const MCP_TOKEN = process.env.META_ADS_MCP_TOKEN || process.env.META_ADS_ACCESS_TOKEN || "";
const META_AD_ACCOUNT_ID = process.env.META_ADS_ACCOUNT_ID || "4437833576442216";
const META_AD_ACCOUNT_NAME = process.env.META_ADS_ACCOUNT_NAME || "Snugg NOVA";
const ROOT = __dirname;

const TOP_CREATIVES_MIN_SPEND = Number(process.env.TOP_CREATIVES_MIN_SPEND || 100);
const TOP_CREATIVES_MIN_PURCHASES = Number(process.env.TOP_CREATIVES_MIN_PURCHASES || 3);
const TOP_CREATIVES_LIMIT = Number(process.env.TOP_CREATIVES_LIMIT || 100);
const TOP_CREATIVE_FIELDS = [
  "id",
  "name",
  "campaign_id",
  "adset_id",
  "creative_id",
  "amount_spent",
  "actions:omni_purchase",
  "purchase_roas",
  "cost_per_result",
  "ctr",
  "cpc",
  "cpm",
  "impressions",
  "reach",
  "delivery"
];

let sessionId = "";
let requestId = 1;

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml"
};

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (url.pathname === "/api/meta-ads/status") {
      sendJson(response, {
        configured: Boolean(MCP_TOKEN),
        mcpUrl: MCP_URL,
        session: Boolean(sessionId)
      });
      return;
    }

    if (url.pathname === "/api/meta-ads/top-creatives") {
      const result = await getTopCreatives();
      sendJson(response, result);
      return;
    }

    await serveStatic(url.pathname, response);
  } catch (error) {
    sendJson(response, { error: error.message || "Erro inesperado." }, 500);
  }
});

server.on("error", (error) => {
  console.error(`Não consegui iniciar o servidor em http://${HOST}:${PORT}: ${error.message}`);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`Site disponível em http://${HOST}:${PORT}`);
});

async function callMcp(method, params) {
  if (!MCP_TOKEN) {
    throw new Error("Configure META_ADS_MCP_TOKEN antes de chamar o MCP.");
  }

  if (!sessionId && method !== "initialize") {
    await initializeMcp();
  }

  return postMcp({
    jsonrpc: "2.0",
    id: requestId++,
    method,
    params
  });
}

async function initializeMcp() {
  const initResult = await postMcp({
    jsonrpc: "2.0",
    id: requestId++,
    method: "initialize",
    params: {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: {
        name: "paid-media-report",
        version: "1.0.0"
      }
    }
  });

  await postMcp({
    jsonrpc: "2.0",
    method: "notifications/initialized"
  });

  return initResult;
}

async function postMcp(payload) {
  const headers = {
    "accept": "application/json, text/event-stream",
    "content-type": "application/json",
    "authorization": `Bearer ${MCP_TOKEN}`
  };

  if (sessionId) headers["mcp-session-id"] = sessionId;

  const response = await fetch(MCP_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });

  const nextSessionId = response.headers.get("mcp-session-id");
  if (nextSessionId) sessionId = nextSessionId;

  const text = await response.text();
  const data = parseMcpBody(text, response.headers.get("content-type") || "");

  if (!response.ok) {
    const message = data?.error?.message || data?.message || text || `MCP retornou HTTP ${response.status}.`;
    throw new Error(message);
  }

  if (data?.error) {
    throw new Error(data.error.message || "O MCP retornou um erro.");
  }

  return data;
}

function parseMcpBody(text, contentType) {
  if (!text) return null;
  if (contentType.includes("text/event-stream")) {
    const dataLine = text
      .split(/\r?\n/)
      .find((line) => line.startsWith("data:"));
    return dataLine ? JSON.parse(dataLine.replace(/^data:\s*/, "")) : null;
  }
  return JSON.parse(text);
}

function normalizeMcpResult(payload) {
  return payload?.result ?? payload;
}

async function getTopCreatives() {
  const query = {
    ad_account_id: META_AD_ACCOUNT_ID,
    level: "ad",
    date_preset: "this_month",
    fields: TOP_CREATIVE_FIELDS,
    filtering: [
      { field: "amount_spent", operator: "GREATER_THAN", value: [String(TOP_CREATIVES_MIN_SPEND)] },
      { field: "actions:omni_purchase", operator: "GREATER_THAN_OR_EQUAL", value: [String(TOP_CREATIVES_MIN_PURCHASES)] }
    ],
    sort: "actions:omni_purchase_descending",
    limit: TOP_CREATIVES_LIMIT
  };

  const rawPayload = await callMcpTool("ads_get_ad_entities", query);
  const rows = extractRows(rawPayload);
  const items = rows
    .map(normalizeCreativeRow)
    .filter((item) => item.amount_spent > TOP_CREATIVES_MIN_SPEND && item.purchases >= TOP_CREATIVES_MIN_PURCHASES)
    .sort(compareCreatives)
    .slice(0, 5);

  return {
    account: {
      id: META_AD_ACCOUNT_ID,
      name: META_AD_ACCOUNT_NAME,
      currency: "BRL"
    },
    period: "this_month",
    fields: TOP_CREATIVE_FIELDS,
    filters: {
      minimumSpend: TOP_CREATIVES_MIN_SPEND,
      minimumPurchases: TOP_CREATIVES_MIN_PURCHASES
    },
    sort: ["purchases_desc", "purchase_roas_desc", "cpa_asc"],
    generatedAt: new Date().toISOString(),
    items
  };
}

async function callMcpTool(name, args) {
  try {
    const payload = await callMcp("tools/call", { name, arguments: args });
    return parseToolPayload(payload);
  } catch (error) {
    if (!args.sort || /token|authorization|credencial|configure/i.test(error.message || "")) throw error;
    const fallbackArgs = { ...args };
    delete fallbackArgs.sort;
    const payload = await callMcp("tools/call", { name, arguments: fallbackArgs });
    return parseToolPayload(payload);
  }
}

function parseToolPayload(payload) {
  const result = normalizeMcpResult(payload);
  if (result?.isError) {
    throw new Error(extractToolText(result) || "O MCP retornou erro ao consultar os anúncios.");
  }
  if (result?.structuredContent) return result.structuredContent;

  const text = extractToolText(result);
  if (text) {
    try {
      return JSON.parse(text);
    } catch (error) {
      return { text };
    }
  }

  return result;
}

function extractToolText(result) {
  if (!result?.content || !Array.isArray(result.content)) return "";
  return result.content
    .map((item) => (item?.type === "text" ? item.text || "" : ""))
    .filter(Boolean)
    .join("\n")
    .trim();
}

function extractRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.ads)) return payload.ads;
  if (Array.isArray(payload?.ad_entities)) return payload.ad_entities;
  if (Array.isArray(payload?.items)) return payload.items;
  if (payload?.result) return extractRows(payload.result);
  return [];
}

function normalizeCreativeRow(row) {
  const amountSpent = metricNumber(row.amount_spent);
  const purchases = metricNumber(row["actions:omni_purchase"] ?? findActionValue(row.actions, "omni_purchase"));
  const roas = metricNumber(row.purchase_roas);
  const costPerResult = metricNumber(row.cost_per_result);
  const cpa = costPerResult || (purchases > 0 ? amountSpent / purchases : 0);

  const item = {
    id: stringifyValue(row.id),
    name: stringifyValue(row.name),
    campaign_id: stringifyValue(row.campaign_id),
    adset_id: stringifyValue(row.adset_id),
    creative_id: stringifyValue(row.creative_id),
    amount_spent: roundMetric(amountSpent),
    purchases: roundMetric(purchases, 0),
    purchase_roas: roundMetric(roas),
    cost_per_result: roundMetric(costPerResult),
    cpa: roundMetric(cpa),
    ctr: roundMetric(metricNumber(row.ctr)),
    cpc: roundMetric(metricNumber(row.cpc)),
    cpm: roundMetric(metricNumber(row.cpm)),
    impressions: roundMetric(metricNumber(row.impressions), 0),
    reach: roundMetric(metricNumber(row.reach), 0),
    delivery: stringifyValue(row.delivery),
    badge: ""
  };

  item.badge = classifyCreative(item);
  return item;
}

function findActionValue(actions, actionType) {
  if (!actions) return 0;
  if (!Array.isArray(actions) && typeof actions === "object") {
    return actions[actionType] ?? actions[`actions:${actionType}`] ?? actions.value ?? 0;
  }
  if (!Array.isArray(actions)) return actions;
  const match = actions.find((action) => String(action.action_type || "").includes(actionType));
  return match?.value ?? 0;
}

function metricNumber(value) {
  if (value == null || value === "") return 0;
  if (Array.isArray(value)) {
    const purchaseValue = value.find((item) => String(item.action_type || "").includes("omni_purchase"))?.value;
    return metricNumber(purchaseValue ?? value[0]?.value ?? value[0]);
  }
  if (typeof value === "object") {
    return metricNumber(value.value ?? value.omni_purchase ?? value["actions:omni_purchase"] ?? 0);
  }
  if (typeof value === "string" && /^[\[{]/.test(value.trim())) {
    try {
      return metricNumber(JSON.parse(value));
    } catch (error) {
      // Fall through to numeric parsing below.
    }
  }
  const normalized = String(value).replace(/[^\d,.-]/g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function stringifyValue(value) {
  return value == null ? "" : String(value);
}

function roundMetric(value, fractionDigits = 2) {
  const number = Number(value || 0);
  return Number(number.toFixed(fractionDigits));
}

function compareCreatives(a, b) {
  return (
    b.purchases - a.purchases ||
    b.purchase_roas - a.purchase_roas ||
    a.cpa - b.cpa ||
    b.amount_spent - a.amount_spent
  );
}

function classifyCreative(item) {
  const delivery = item.delivery.toLowerCase();
  const hasDeliveryIssue = delivery.includes("error") || delivery.includes("inactive") || delivery.includes("off");
  if (hasDeliveryIssue || item.purchase_roas < 2 || item.cpa > 80) return "Atenção";
  if (item.purchases >= 5 && item.purchase_roas >= 5 && item.cpa <= 50) return "Escalar";
  return "Manter";
}

async function serveStatic(urlPath, response) {
  const requestedPath = urlPath === "/" ? "/index.html" : decodeURIComponent(urlPath);
  const filePath = path.normalize(path.join(ROOT, requestedPath));

  if (!filePath.startsWith(ROOT)) {
    sendJson(response, { error: "Caminho inválido." }, 403);
    return;
  }

  try {
    const contents = await readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      "content-type": MIME_TYPES[extension] || "application/octet-stream"
    });
    response.end(contents);
  } catch (error) {
    sendJson(response, { error: "Arquivo não encontrado." }, 404);
  }
}

function sendJson(response, payload, status = 200) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload, null, 2));
}
