const http = require("node:http");
const { readFile } = require("node:fs/promises");
const path = require("node:path");

const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || "127.0.0.1";
const MCP_URL = process.env.META_ADS_MCP_URL || "https://mcp.facebook.com/ads";
const MCP_TOKEN = process.env.META_ADS_MCP_TOKEN || process.env.META_ADS_ACCESS_TOKEN || "";
const GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION || "v23.0";
const GRAPH_API_URL = process.env.META_GRAPH_API_URL || `https://graph.facebook.com/${GRAPH_API_VERSION}`;
const META_AD_ACCOUNT_ID = process.env.META_ADS_ACCOUNT_ID || "4437833576442216";
const META_AD_ACCOUNT_NAME = process.env.META_ADS_ACCOUNT_NAME || "Snugg NOVA";
const ROOT = __dirname;

const DEFAULT_TOP_CREATIVES = {
  since: process.env.TOP_CREATIVES_SINCE || "2026-06-01",
  until: process.env.TOP_CREATIVES_UNTIL || "2026-06-16",
  minimumSpend: Number(process.env.TOP_CREATIVES_MIN_SPEND || 100),
  minimumPurchases: Number(process.env.TOP_CREATIVES_MIN_PURCHASES || 3),
  limit: Number(process.env.TOP_CREATIVES_LIMIT || 100),
  sort: "purchases_roas",
  status: "all"
};
const TOP_CREATIVE_FIELDS = [
  "id",
  "name",
  "campaign_id",
  "adset_id",
  "creative_id",
  "status",
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
const CREATIVE_DETAIL_FIELDS = [
  "id",
  "name",
  "status",
  "account_id",
  "object_type",
  "body",
  "title",
  "link_url",
  "image_hash",
  "image_url",
  "video_id",
  "thumbnail_url",
  "call_to_action_type",
  "object_story_id",
  "effective_object_story_id",
  "effective_instagram_media_id",
  "child_attachments"
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
        graphApiUrl: GRAPH_API_URL,
        session: Boolean(sessionId)
      });
      return;
    }

    if (url.pathname === "/api/meta-ads/top-creatives") {
      const filters = normalizeTopCreativeFilters(url.searchParams);
      const result = await getTopCreatives(filters);
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

async function graphFetch(endpoint, params = {}) {
  if (!MCP_TOKEN) {
    throw new Error("Configure META_ADS_MCP_TOKEN antes de chamar o Meta Ads.");
  }

  const url = new URL(`${GRAPH_API_URL}${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });

  const response = await fetch(url, {
    headers: {
      "accept": "application/json",
      "authorization": `Bearer ${MCP_TOKEN}`
    }
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok || data?.error) {
    const message = data?.error?.message || text || `Meta Graph API retornou HTTP ${response.status}.`;
    throw new Error(formatMetaError(message));
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

function formatMetaError(message) {
  const clean = stringifyValue(message);
  if (/ads_management|ads_read|Ad account owner/i.test(clean)) {
    return "O token foi reconhecido, mas a conta de anúncios ainda não liberou permissão ads_read ou ads_management para consultar performance. Libere essa permissão no Meta Business/App e gere um novo token.";
  }

  if (/Invalid OAuth|OAuthException|Session has expired|Error validating access token/i.test(clean)) {
    return "O token do Meta está inválido ou expirado. Gere um novo token com acesso à conta de anúncios.";
  }

  return clean;
}

async function getTopCreatives(filters) {
  const query = {
    ad_account_id: filters.accountId,
    level: "ad",
    time_range: JSON.stringify({ since: filters.since, until: filters.until }),
    fields: TOP_CREATIVE_FIELDS,
    filtering: buildTopCreativeMetaFilters(filters),
    sort: metaSortFor(filters.sort),
    limit: filters.limit
  };

  const rawPayload = await getAdEntities(query, filters);
  const rows = extractRows(rawPayload);
  const items = rows
    .map(normalizeCreativeRow)
    .filter((item) => passesTopCreativeFilters(item, filters))
    .sort(compareCreativesFor(filters.sort))
    .slice(0, 5);
  const enrichedItems = await enrichTopCreatives(items, filters.accountId);

  return {
    account: {
      id: filters.accountId,
      name: filters.accountId === META_AD_ACCOUNT_ID ? META_AD_ACCOUNT_NAME : `Conta ${filters.accountId}`,
      currency: "BRL"
    },
    period: {
      since: filters.since,
      until: filters.until,
      label: formatDateRange(filters.since, filters.until)
    },
    fields: TOP_CREATIVE_FIELDS,
    filters: {
      minimumSpend: filters.minimumSpend,
      minimumPurchases: filters.minimumPurchases,
      campaignId: filters.campaignId,
      adsetId: filters.adsetId,
      status: filters.status
    },
    sort: sortLabel(filters.sort),
    generatedAt: new Date().toISOString(),
    items: enrichedItems
  };
}

function normalizeTopCreativeFilters(params) {
  const filters = {
    accountId: normalizeId(params.get("accountId")) || META_AD_ACCOUNT_ID,
    since: normalizeDateParam(params.get("since"), DEFAULT_TOP_CREATIVES.since, "Data inicial inválida."),
    until: normalizeDateParam(params.get("until"), DEFAULT_TOP_CREATIVES.until, "Data final inválida."),
    campaignId: normalizeId(params.get("campaignId")),
    adsetId: normalizeId(params.get("adsetId")),
    minimumSpend: normalizeNumberParam(params.get("minimumSpend"), DEFAULT_TOP_CREATIVES.minimumSpend, 0, 10000000),
    minimumPurchases: normalizeNumberParam(params.get("minimumPurchases"), DEFAULT_TOP_CREATIVES.minimumPurchases, 0, 1000000),
    limit: normalizeNumberParam(params.get("limit"), DEFAULT_TOP_CREATIVES.limit, 5, 500),
    sort: normalizeEnumParam(params.get("sort"), ["purchases_roas", "roas", "cpa", "spend"], DEFAULT_TOP_CREATIVES.sort),
    status: normalizeEnumParam(params.get("status"), ["all", "active", "inactive", "delivery_issue"], DEFAULT_TOP_CREATIVES.status)
  };

  if (filters.since > filters.until) {
    throw new Error("A data inicial precisa ser anterior ou igual à data final.");
  }

  return filters;
}

function buildTopCreativeMetaFilters(filters) {
  const metaFilters = [
    { field: "amount_spent", operator: "GREATER_THAN", value: [String(filters.minimumSpend)] },
    { field: "actions:omni_purchase", operator: "GREATER_THAN_OR_EQUAL", value: [String(filters.minimumPurchases)] }
  ];

  if (filters.campaignId) {
    metaFilters.push({ field: "campaign_id", operator: "IN", value: [filters.campaignId] });
  }

  if (filters.adsetId) {
    metaFilters.push({ field: "adset_id", operator: "IN", value: [filters.adsetId] });
  }

  return metaFilters;
}

function passesTopCreativeFilters(item, filters) {
  if (item.amount_spent < filters.minimumSpend) return false;
  if (item.purchases < filters.minimumPurchases) return false;
  if (filters.campaignId && item.campaign_id !== filters.campaignId) return false;
  if (filters.adsetId && item.adset_id !== filters.adsetId) return false;

  const delivery = item.delivery.toLowerCase();
  const status = item.status.toLowerCase();
  const isInactive = /inactive|paused|deleted|archived|off|not_delivering/.test(`${status} ${delivery}`);
  const hasDeliveryIssue = /error|rejected|limited|not_delivering|inactive|off/.test(`${status} ${delivery}`);

  if (filters.status === "active") return !isInactive;
  if (filters.status === "inactive") return isInactive;
  if (filters.status === "delivery_issue") return hasDeliveryIssue;
  return true;
}

function metaSortFor(sort) {
  if (sort === "roas") return "purchase_roas_descending";
  if (sort === "cpa") return "cost_per_result_ascending";
  if (sort === "spend") return "amount_spent_descending";
  return "actions:omni_purchase_descending";
}

async function getAdEntitiesWithFallback(query) {
  const attempts = [
    query,
    { ...query, sort: undefined },
    { ...query, sort: undefined, filtering: undefined }
  ];
  let lastError;

  for (const attempt of attempts) {
    try {
      return await callMcpTool("ads_get_ad_entities", compactObject(attempt));
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

async function getAdEntities(query, filters) {
  try {
    return await getAdEntitiesWithFallback(query);
  } catch (error) {
    if (!isMcpAuthenticationError(error)) throw error;
    return getGraphInsights(filters);
  }
}

function isMcpAuthenticationError(error) {
  return /Authentication Required|Failed to authenticate MCP|HTTP 401|status.*401|authorization|token/i.test(error.message || "");
}

async function getGraphInsights(filters) {
  const params = {
    level: "ad",
    time_range: JSON.stringify({ since: filters.since, until: filters.until }),
    fields: [
      "ad_id",
      "ad_name",
      "campaign_id",
      "adset_id",
      "spend",
      "actions",
      "purchase_roas",
      "cost_per_action_type",
      "ctr",
      "cpc",
      "cpm",
      "impressions",
      "reach"
    ].join(","),
    filtering: JSON.stringify(buildGraphInsightFilters(filters)),
    sort: metaSortFor(filters.sort),
    limit: String(filters.limit)
  };

  const payload = await graphFetch(`/act_${filters.accountId}/insights`, params);
  return {
    data: normalizeArray(payload?.data).map((row) => ({
      id: stringifyValue(row.ad_id),
      name: stringifyValue(row.ad_name),
      campaign_id: stringifyValue(row.campaign_id),
      adset_id: stringifyValue(row.adset_id),
      creative_id: "",
      amount_spent: row.spend,
      "actions:omni_purchase": findActionValue(row.actions, "omni_purchase") || findActionValue(row.actions, "purchase"),
      purchase_roas: findActionValue(row.purchase_roas, "omni_purchase") || findActionValue(row.purchase_roas, "purchase"),
      cost_per_result:
        findActionValue(row.cost_per_action_type, "omni_purchase") || findActionValue(row.cost_per_action_type, "purchase"),
      ctr: row.ctr,
      cpc: row.cpc,
      cpm: row.cpm,
      impressions: row.impressions,
      reach: row.reach,
      delivery: "",
      status: ""
    }))
  };
}

function buildGraphInsightFilters(filters) {
  const graphFilters = [];

  if (filters.campaignId) {
    graphFilters.push({ field: "campaign.id", operator: "IN", value: [filters.campaignId] });
  }

  if (filters.adsetId) {
    graphFilters.push({ field: "adset.id", operator: "IN", value: [filters.adsetId] });
  }

  return graphFilters;
}

async function enrichTopCreatives(items, accountId) {
  if (!items.length) return [];

  const adDetails = await getAdDetails(items.map((item) => item.id).filter(Boolean));
  const normalizedItems = items.map((item) => {
    const ad = adDetails.get(item.id) || {};
    const creative = ad.creative || {};
    return {
      ...item,
      status: item.status || stringifyValue(ad.status || ad.effective_status),
      delivery: item.delivery || stringifyValue(ad.effective_status || ad.status),
      creative_id: item.creative_id || stringifyValue(creative.id),
      preview_url: item.preview_url || stringifyValue(ad.preview_shareable_link)
    };
  });
  const creativeDetails = await getCreativeDetails(accountId, normalizedItems.map((item) => item.creative_id).filter(Boolean));
  return Promise.all(
    normalizedItems.map(async (item) => {
      const ad = adDetails.get(item.id) || {};
      const creative = creativeDetails.get(item.creative_id) || ad.creative || {};
      const preview = await getCreativePreview(item, creative);
      const imageUrl = firstValue(
        preview.image_url,
        preview.image_data_url,
        creative.thumbnail_url,
        creative.image_url,
        firstAttachmentValue(creative.child_attachments, ["picture", "image_url", "thumbnail_url"])
      );
      const previewUrl = firstValue(preview.preview_url, creative.permalink_url, creative.link_url);

      return {
        ...item,
        creative_name: stringifyValue(creative.name),
        creative_status: stringifyValue(creative.status),
        body: stringifyValue(creative.body),
        title: stringifyValue(creative.title),
        link_url: stringifyValue(creative.link_url),
        image_url: stringifyValue(imageUrl),
        preview_url: stringifyValue(previewUrl || item.preview_url),
        preview_format: stringifyValue(preview.ad_format_label || preview.ad_format),
        instagram_media_id: stringifyValue(creative.effective_instagram_media_id),
        object_story_id: stringifyValue(creative.effective_object_story_id || creative.object_story_id)
      };
    })
  );
}

async function getAdDetails(adIds) {
  const uniqueIds = [...new Set(adIds)].filter(Boolean).slice(0, 5);
  if (!uniqueIds.length) return new Map();

  const entries = await Promise.all(
    uniqueIds.map(async (adId) => {
      try {
        const payload = await graphFetch(`/${adId}`, {
          fields:
            "id,name,status,effective_status,preview_shareable_link,creative{id,name,status,body,title,link_url,image_url,thumbnail_url,video_id,call_to_action_type,object_story_id,effective_object_story_id,effective_instagram_media_id}"
        });
        return [stringifyValue(payload.id), payload];
      } catch (error) {
        return [adId, {}];
      }
    })
  );

  return new Map(entries);
}

async function getCreativeDetails(accountId, creativeIds) {
  const uniqueIds = [...new Set(creativeIds)].filter(Boolean);
  if (!uniqueIds.length) return new Map();

  try {
    const payload = await callMcpTool("ads_get_creatives", {
      ad_account_id: accountId,
      creative_ids: uniqueIds,
      fields: CREATIVE_DETAIL_FIELDS
    });
    return new Map(extractCreativeRows(payload).map((creative) => [stringifyValue(creative.id), creative]));
  } catch (error) {
    return new Map();
  }
}

async function getCreativePreview(item, creative) {
  const attempts = [
    { ad_id: item.id, ad_format: "INSTAGRAM_STANDARD" },
    { creative_id: item.creative_id, ad_format: "INSTAGRAM_STANDARD" },
    { ad_id: item.id, ad_format: "MOBILE_FEED_STANDARD" },
    { creative_id: item.creative_id, ad_format: "MOBILE_FEED_STANDARD" }
  ].filter((attempt) => attempt.ad_id || attempt.creative_id);

  for (const attempt of attempts) {
    try {
      return normalizePreviewPayload(await callMcpTool("ads_get_ad_preview", attempt));
    } catch (error) {
      // Keep the card useful even when one preview placement is unavailable.
    }
  }

  return {
    preview_url: creative.link_url || "",
    image_url: creative.thumbnail_url || creative.image_url || ""
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
  const images = extractToolImages(result);
  if (result?.structuredContent) {
    if (images.length && typeof result.structuredContent === "object") {
      return { ...result.structuredContent, images };
    }
    return result.structuredContent;
  }

  const text = extractToolText(result);
  if (text) {
    try {
      const parsed = JSON.parse(text);
      return images.length && parsed && typeof parsed === "object" ? { ...parsed, images } : parsed;
    } catch (error) {
      return images.length ? { text, images } : { text };
    }
  }

  return images.length ? { ...result, images } : result;
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

function extractCreativeRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.ad_creatives)) return payload.ad_creatives;
  if (Array.isArray(payload?.creatives)) return payload.creatives;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (payload?.result) return extractCreativeRows(payload.result);
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
    status: stringifyValue(row.status),
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
    preview_url: "",
    image_url: "",
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

function normalizePreviewPayload(payload) {
  const image = Array.isArray(payload?.images) ? payload.images[0] : null;
  return {
    preview_html: stringifyValue(payload?.preview_html),
    preview_url: decodeHtmlEntities(payload?.preview_url),
    ad_format: stringifyValue(payload?.ad_format),
    ad_format_label: stringifyValue(payload?.ad_format_label),
    image_data_url: image?.dataUrl || "",
    image_url: stringifyValue(payload?.image_url || payload?.thumbnail_url)
  };
}

function extractToolImages(result) {
  if (!result?.content || !Array.isArray(result.content)) return [];
  return result.content
    .filter((item) => item?.type === "image" && item.data)
    .map((item) => ({
      mimeType: item.mimeType || "image/png",
      dataUrl: `data:${item.mimeType || "image/png"};base64,${item.data}`
    }));
}

function firstAttachmentValue(attachments, keys) {
  const list = normalizeArray(attachments);
  for (const attachment of list) {
    for (const key of keys) {
      if (attachment?.[key]) return attachment[key];
    }
  }
  return "";
}

function normalizeArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && /^[\[{]/.test(value.trim())) {
    try {
      return normalizeArray(JSON.parse(value));
    } catch (error) {
      return [];
    }
  }
  return typeof value === "object" ? [value] : [];
}

function firstValue(...values) {
  return values.find((value) => value != null && String(value).trim() !== "") || "";
}

function compactObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== null));
}

function decodeHtmlEntities(value) {
  return stringifyValue(value)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}

function formatDateRange(since, until) {
  return `${formatDatePtBr(since)} a ${formatDatePtBr(until)}`;
}

function formatDatePtBr(value) {
  const [year, month, day] = String(value).split("-");
  return `${day}/${month}/${year}`;
}

function stringifyValue(value) {
  return value == null ? "" : String(value);
}

function normalizeId(value) {
  const clean = stringifyValue(value).trim().replace(/^act_/i, "");
  return /^\d+$/.test(clean) ? clean : "";
}

function normalizeDateParam(value, fallback, message) {
  const clean = stringifyValue(value || fallback).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    throw new Error(message);
  }

  const date = new Date(`${clean}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== clean) {
    throw new Error(message);
  }

  return clean;
}

function normalizeNumberParam(value, fallback, min, max) {
  const number = value == null || value === "" ? fallback : Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function normalizeEnumParam(value, allowedValues, fallback) {
  const clean = stringifyValue(value).trim();
  return allowedValues.includes(clean) ? clean : fallback;
}

function roundMetric(value, fractionDigits = 2) {
  const number = Number(value || 0);
  return Number(number.toFixed(fractionDigits));
}

function compareCreativesFor(sort) {
  if (sort === "roas") {
    return (a, b) => b.purchase_roas - a.purchase_roas || b.purchases - a.purchases || a.cpa - b.cpa;
  }

  if (sort === "cpa") {
    return (a, b) => a.cpa - b.cpa || b.purchases - a.purchases || b.purchase_roas - a.purchase_roas;
  }

  if (sort === "spend") {
    return (a, b) => b.amount_spent - a.amount_spent || b.purchases - a.purchases || b.purchase_roas - a.purchase_roas;
  }

  return compareCreatives;
}

function compareCreatives(a, b) {
  return (
    b.purchases - a.purchases ||
    b.purchase_roas - a.purchase_roas ||
    a.cpa - b.cpa ||
    b.amount_spent - a.amount_spent
  );
}

function sortLabel(sort) {
  if (sort === "roas") return ["purchase_roas_desc", "purchases_desc", "cpa_asc"];
  if (sort === "cpa") return ["cpa_asc", "purchases_desc", "purchase_roas_desc"];
  if (sort === "spend") return ["amount_spent_desc", "purchases_desc", "purchase_roas_desc"];
  return ["purchases_desc", "purchase_roas_desc", "cpa_asc"];
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
