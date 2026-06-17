(function () {
  const STORAGE_KEY = "paid-media-report-data-v3";
  const root = document.documentElement;
  let data = clone(window.reportData);
  let editMode = true;

  const formatters = {
    currency: (value) =>
      Number(value || 0).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 2
      }),
    integer: (value) => Number(value || 0).toLocaleString("pt-BR"),
    compact: (value) => {
      const number = Number(value || 0);
      return number >= 1000 ? `${(number / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : String(number);
    },
    currencyCompact: (value) => {
      const number = Number(value || 0);
      if (number >= 1000) {
        return `R$ ${(number / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
      }
      return formatters.currency(number);
    },
    percent: (value) => `${Number(value || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`,
    decimal: (value) => Number(value || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 }),
    roas: (value) => `${Number(value || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}x`,
    text: (value) => value ?? ""
  };

  init();

  function init() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        data = mergeDeep(clone(window.reportData), JSON.parse(saved));
      } catch (error) {
        showToast("Não consegui carregar os dados salvos. Usei a base original.");
      }
    }

    document.body.classList.toggle("editing", editMode);
    root.style.setProperty("--chart-height", "300px");
    bindToolbar();
    bindTopCreatives();
    render();
    loadTopCreatives();
  }

  function bindToolbar() {
    document.getElementById("editToggle").addEventListener("click", () => {
      editMode = !editMode;
      document.body.classList.toggle("editing", editMode);
      setEditableState();
      document.getElementById("editToggle").setAttribute("aria-pressed", String(editMode));
      showToast(editMode ? "Edição ativada." : "Edição travada.");
    });

    document.getElementById("exportButton").addEventListener("click", exportJson);
    document.getElementById("resetButton").addEventListener("click", () => {
      localStorage.removeItem(STORAGE_KEY);
      data = clone(window.reportData);
      render();
      showToast("Dados restaurados para a base extraída da apresentação.");
    });

    document.getElementById("importButton").addEventListener("click", () => document.getElementById("importInput").click());
    document.getElementById("importInput").addEventListener("change", importJson);
  }

  function bindTopCreatives() {
    document.getElementById("topCreativesRefresh")?.addEventListener("click", loadTopCreatives);
  }

  function render() {
    renderMetricCards();
    renderFunnel();
    bindEditableContent();
    renderCharts();
  }

  function renderMetricCards() {
    const container = document.getElementById("ecommerceMetrics");
    container.innerHTML = data.importantMetrics
      .map((metric, index) => {
        const valuePath = `importantMetrics.${index}.value`;
        const delta = percentChange(metric.value, metric.previous);
        return `
          <article class="metric-card">
            <span class="metric-label">${metric.label}</span>
            <strong class="metric-value" data-edit data-path="${valuePath}" data-type="${metric.type}">${formatValue(metric.value, metric.type)}</strong>
            <span class="metric-delta ${deltaClass(delta)}">${formatSignedPercent(delta)} vs. Maio</span>
          </article>
        `;
      })
      .join("");
  }

  function renderFunnel() {
    const visual = document.getElementById("funnelVisual");
    const insightList = document.getElementById("funnelInsights");
    if (!visual || !insightList || !data.funnel?.steps?.length) return;

    const max = Math.max(...data.funnel.steps.map((step) => Number(step.value || 0)));
    visual.innerHTML = data.funnel.steps
      .map((step, index) => {
        const ratio = Math.sqrt(Number(step.value || 0) / max);
        const barHeight = Math.max(20, Math.round(42 + ratio * 118));
        const nextRate = data.funnel.steps[index + 1]?.rateFromPrevious;
        return `
          <div class="funnel-stage">
            <span class="funnel-value" data-edit data-path="funnel.steps.${index}.value" data-type="integer">${formatValue(step.value, "integer")}</span>
            <div class="funnel-bar" style="height:${barHeight}px;background:${step.color}"></div>
            <span class="funnel-label" data-edit data-path="funnel.steps.${index}.label">${escapeHtml(step.label)}</span>
          </div>
          ${
            index < data.funnel.steps.length - 1
              ? `<div class="funnel-connector"><span>${formatValue(nextRate, "percent")}</span><b>→</b></div>`
              : ""
          }
        `;
      })
      .join("");

    insightList.innerHTML = data.funnel.insights
      .map(
        (insight, index) => `
          <article>
            <span>Insight ${index + 1}</span>
            <p data-edit data-path="funnel.insights.${index}">${escapeHtml(insight)}</p>
          </article>
        `
      )
      .join("");
  }

  function bindEditableContent() {
    document.querySelectorAll("[data-edit]").forEach((element) => {
      const path = element.dataset.path;
      const type = element.dataset.type || "text";
      const value = getPath(data, path);
      element.textContent = formatValue(value, type);
      element.contentEditable = editMode ? "true" : "false";
      element.spellcheck = true;
      if (element.dataset.bound === "true") return;
      element.dataset.bound = "true";
      element.addEventListener("focus", () => {
        if (!editMode) return;
        element.dataset.before = element.textContent;
        if (type !== "text") element.textContent = rawValue(getPath(data, path), type);
      });
      element.addEventListener("blur", () => {
        if (!editMode) return;
        const nextValue = parseValue(element.textContent, type);
        setPath(data, path, nextValue);
        persist();
        render();
        showToast("Campo atualizado.");
      });
      element.addEventListener("input", () => {
        if (!editMode) return;
        const nextValue = parseValue(element.textContent, type);
        setPath(data, path, nextValue);
        persist();
        if (type !== "text") renderCharts();
      });
      element.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.shiftKey && type !== "text") {
          event.preventDefault();
          element.blur();
        }
      });
    });
  }

  function setEditableState() {
    document.querySelectorAll("[data-edit]").forEach((element) => {
      element.contentEditable = editMode ? "true" : "false";
    });
  }

  function renderCharts() {
    const periods = data.periodComparison?.periods || [];
    drawGroupedBars(document.getElementById("platformChart"), {
      labels: periods.map((period) => period.name),
      series: [
        { label: "Investimento", values: periods.map((period) => period.investment), color: "#0066cc", format: "currency" },
        { label: "ROAS", values: periods.map((period) => period.roas), color: "#0a7c66", format: "roas", axis: "right" }
      ]
    });

  }

  function drawGroupedBars(canvas, config) {
    if (!canvas) return;
    const ctx = prepareCanvas(canvas);
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = Number(canvas.getAttribute("height"));
    const pad = { top: 28, right: 36, bottom: 62, left: 88 };
    const chartW = width - pad.left - pad.right;
    const chartH = height - pad.top - pad.bottom;
    const leftSeries = config.series.filter((item) => item.axis !== "right");
    const rightSeries = config.series.filter((item) => item.axis === "right");
    const leftMax = niceMax(Math.max(1, ...leftSeries.flatMap((item) => item.values)));
    const rightMax = niceMax(Math.max(1, ...rightSeries.flatMap((item) => item.values)));
    const groupWidth = chartW / config.labels.length;
    const barWidth = Math.min(30, (groupWidth - 18) / config.series.length);

    clearCanvas(ctx, width, height);
    drawGrid(ctx, pad, width, height, leftMax, config.series[0]?.format || "integer");

    config.labels.forEach((label, labelIndex) => {
      const start = pad.left + labelIndex * groupWidth + groupWidth / 2 - (barWidth * config.series.length) / 2;
      config.series.forEach((series, seriesIndex) => {
        const value = Number(series.values[labelIndex] || 0);
        const max = series.axis === "right" ? rightMax : leftMax;
        const barH = (value / max) * chartH;
        const x = start + seriesIndex * barWidth;
        const y = pad.top + chartH - barH;
        drawRoundedBar(ctx, x, y, barWidth - 4, barH, series.color);
      });
      drawAxisLabel(ctx, label, pad.left + labelIndex * groupWidth + groupWidth / 2, height - 30, groupWidth - 8);
    });

    drawLegend(ctx, config.series, pad.left, 12);
  }

  function drawHorizontalBars(canvas, config) {
    if (!canvas) return;
    const ctx = prepareCanvas(canvas);
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = Number(canvas.getAttribute("height"));
    const pad = { top: 26, right: 36, bottom: 20, left: 116 };
    const chartW = width - pad.left - pad.right;
    const rowH = (height - pad.top - pad.bottom) / config.labels.length;
    const max = niceMax(Math.max(1, ...config.values));

    clearCanvas(ctx, width, height);
    config.labels.forEach((label, index) => {
      const value = config.values[index];
      const y = pad.top + index * rowH + rowH * 0.22;
      const barH = rowH * 0.56;
      const barW = (value / max) * chartW;
      ctx.fillStyle = "#6e6e73";
      ctx.font = "600 12px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(shortLabel(label, 13), pad.left - 12, y + barH * 0.72);
      drawRoundedBar(ctx, pad.left, y, barW, barH, config.color);
      ctx.fillStyle = "#1d1d1f";
      ctx.textAlign = "left";
      ctx.fillText(formatValue(value, config.format), pad.left + barW + 8, y + barH * 0.72);
    });
  }

  function prepareCanvas(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const cssHeight = Number(canvas.getAttribute("height"));
    canvas.width = Math.max(1, rect.width * dpr);
    canvas.height = cssHeight * dpr;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }

  function clearCanvas(ctx, width, height) {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
  }

  function drawGrid(ctx, pad, width, height, max, format) {
    const chartH = height - pad.top - pad.bottom;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.08)";
    ctx.fillStyle = "#6e6e73";
    ctx.font = "600 11px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
    ctx.textAlign = "right";
    for (let i = 0; i <= 4; i += 1) {
      const value = (max / 4) * i;
      const y = pad.top + chartH - (chartH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(width - pad.right, y);
      ctx.stroke();
      ctx.fillText(formatValue(value, format), pad.left - 8, y + 4);
    }
  }

  function drawRoundedBar(ctx, x, y, width, height, color) {
    const radius = Math.min(8, width / 2, Math.abs(height) / 2);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height);
    ctx.lineTo(x, y + height);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
  }

  function drawAxisLabel(ctx, label, x, y, maxWidth) {
    ctx.fillStyle = "#6e6e73";
    ctx.font = "600 11px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
    ctx.textAlign = "center";
    const text = shortLabel(label, Math.max(8, Math.floor(maxWidth / 7)));
    ctx.fillText(text, x, y);
  }

  function drawLegend(ctx, series, x, y) {
    let cursor = x;
    series.forEach((item) => {
      ctx.fillStyle = item.color;
      ctx.fillRect(cursor, y, 9, 9);
      ctx.fillStyle = "#6e6e73";
      ctx.font = "650 12px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(item.label, cursor + 14, y + 9);
      cursor += ctx.measureText(item.label).width + 44;
    });
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `relatorio-midia-paga-${slugify(data.meta.updatedAt || "periodo")}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("Base exportada em JSON.");
  }

  function importJson(event) {
    const [file] = event.target.files;
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        data = mergeDeep(clone(window.reportData), JSON.parse(reader.result));
        persist();
        render();
        showToast("Base importada e gráficos atualizados.");
      } catch (error) {
        showToast("O arquivo importado não parece ser um JSON válido.");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  async function loadTopCreatives() {
    const grid = document.getElementById("topCreativesGrid");
    const state = document.getElementById("topCreativesState");
    const refreshButton = document.getElementById("topCreativesRefresh");
    if (!grid || !state) return;

    grid.innerHTML = "";
    state.hidden = false;
    state.className = "top-creatives-state loading";
    state.innerHTML = `<span class="loading-dot"></span><p>Carregando dados do Meta Ads...</p>`;
    if (refreshButton) refreshButton.disabled = true;

    try {
      if (window.location.protocol === "file:") {
        throw new Error("Abra o site pelo servidor local para carregar dados do Meta Ads.");
      }

      const payload = await fetchJson("/api/meta-ads/top-creatives");
      renderTopCreatives(payload.items || [], payload);
    } catch (error) {
      renderTopCreativesError(error);
    } finally {
      if (refreshButton) refreshButton.disabled = false;
    }
  }

  function renderTopCreatives(items, payload = {}) {
    const grid = document.getElementById("topCreativesGrid");
    const state = document.getElementById("topCreativesState");
    if (!grid || !state) return;

    if (!items.length) {
      state.hidden = false;
      state.className = "top-creatives-state empty";
      state.innerHTML = `<p>Nenhum anúncio passou pelos filtros de investimento e vendas neste mês.</p>`;
      grid.innerHTML = "";
      return;
    }

    state.hidden = false;
    state.className = "top-creatives-state ready";
    state.innerHTML = `<p>${escapeHtml(topCreativesSummary(payload))}</p>`;
    grid.innerHTML = items
      .map(
        (item, index) => `
          <article class="creative-card">
            <div class="creative-card-top">
              <span class="creative-rank">#${index + 1}</span>
              <span class="creative-badge ${badgeClass(item.badge)}">${escapeHtml(item.badge)}</span>
            </div>
            ${renderCreativePreview(item)}
            <h3>${escapeHtml(item.name || "Criativo sem nome")}</h3>
            <dl class="creative-stats">
              <div>
                <dt>Investimento</dt>
                <dd>${formatValue(item.amount_spent, "currency")}</dd>
              </div>
              <div>
                <dt>Vendas</dt>
                <dd>${formatValue(item.purchases, "integer")}</dd>
              </div>
              <div>
                <dt>ROAS</dt>
                <dd>${formatValue(item.purchase_roas, "roas")}</dd>
              </div>
              <div>
                <dt>CPA</dt>
                <dd>${formatValue(item.cpa, "currency")}</dd>
              </div>
              <div>
                <dt>CTR</dt>
                <dd>${formatValue(item.ctr, "percent")}</dd>
              </div>
              <div>
                <dt>Entrega</dt>
                <dd>${escapeHtml(formatDelivery(item.delivery))}</dd>
              </div>
            </dl>
            <div class="creative-meta">
              <span>ID ${escapeHtml(item.id || "--")}</span>
              <span>Creative ${escapeHtml(item.creative_id || "--")}</span>
            </div>
          </article>
        `
      )
      .join("");
  }

  function topCreativesSummary(payload) {
    const period = payload.period?.label || "01/06/2026 a 16/06/2026";
    const account = payload.account?.name || "Snugg NOVA";
    return `Conta ${account} · Período ${period} · clique no preview para visualizar o criativo.`;
  }

  function renderCreativePreview(item) {
    const previewUrl = safeExternalUrl(item.preview_url);
    const clickUrl = safeExternalUrl(item.preview_url || item.link_url);
    const imageUrl = safeImageUrl(item.image_url);
    const title = item.title || item.creative_name || item.name || "Criativo";

    if (imageUrl) {
      return `
        <a class="creative-preview" href="${escapeHtml(clickUrl || imageUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Visualizar criativo ${escapeHtml(title)}">
          <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(title)}" loading="lazy" />
          <span>Visualizar criativo</span>
        </a>
      `;
    }

    if (previewUrl) {
      return `
        <div class="creative-preview iframe-preview">
          <iframe src="${escapeHtml(previewUrl)}" title="Preview do criativo ${escapeHtml(title)}" loading="lazy"></iframe>
          <a href="${escapeHtml(previewUrl)}" target="_blank" rel="noopener noreferrer">Visualizar criativo</a>
        </div>
      `;
    }

    if (clickUrl) {
      return `
        <a class="creative-preview empty-preview" href="${escapeHtml(clickUrl)}" target="_blank" rel="noopener noreferrer">
          <span>Visualizar criativo</span>
        </a>
      `;
    }

    return `
      <div class="creative-preview empty-preview">
        <span>Preview indisponível</span>
      </div>
    `;
  }

  function renderTopCreativesError(error) {
    const grid = document.getElementById("topCreativesGrid");
    const state = document.getElementById("topCreativesState");
    if (!grid || !state) return;

    grid.innerHTML = "";
    state.hidden = false;
    state.className = "top-creatives-state error";
    state.innerHTML = `<p>${escapeHtml(error.message || "Não consegui carregar os criativos.")}</p>`;
  }

  async function fetchJson(url, options) {
    const response = await fetch(url, options);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Resposta inválida do servidor local.");
    return payload;
  }

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function formatValue(value, type = "text") {
    return (formatters[type] || formatters.text)(value);
  }

  function percentChange(value, previous) {
    const base = Number(previous || 0);
    if (!base) return 0;
    return ((Number(value || 0) - base) / base) * 100;
  }

  function formatSignedPercent(value) {
    const prefix = value > 0 ? "+" : "";
    return `${prefix}${formatValue(value, "percent")}`;
  }

  function deltaClass(value) {
    if (value > 0) return "positive";
    if (value < 0) return "negative";
    return "neutral";
  }

  function parseValue(value, type = "text") {
    if (type === "text") return value.trim();
    const clean = value.replace(/[^\d,.-]/g, "");
    const hasComma = clean.includes(",");
    const hasDot = clean.includes(".");
    const normalized =
      hasComma && hasDot
        ? clean.replace(/\./g, "").replace(",", ".")
        : hasComma
          ? clean.replace(",", ".")
          : clean;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function rawValue(value, type) {
    if (type === "currency" || type === "percent" || type === "decimal" || type === "roas") {
      return Number(value || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
    }
    return value ?? "";
  }

  function getPath(target, path) {
    return path.split(".").reduce((current, key) => (current == null ? undefined : current[key]), target);
  }

  function setPath(target, path, value) {
    const parts = path.split(".");
    const last = parts.pop();
    const parent = parts.reduce((current, key) => current[key], target);
    parent[last] = value;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function mergeDeep(base, patch) {
    Object.entries(patch || {}).forEach(([key, value]) => {
      if (value && typeof value === "object" && !Array.isArray(value) && base[key]) {
        mergeDeep(base[key], value);
      } else {
        base[key] = value;
      }
    });
    return base;
  }

  function niceMax(value) {
    const exponent = Math.floor(Math.log10(value));
    const fraction = value / 10 ** exponent;
    const niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
    return niceFraction * 10 ** exponent;
  }

  function shortLabel(label, length) {
    return String(label).length > length ? `${String(label).slice(0, Math.max(1, length - 1))}…` : String(label);
  }

  function badgeClass(value) {
    const badge = String(value || "").toLowerCase();
    if (badge.includes("escalar")) return "scale";
    if (badge.includes("aten")) return "attention";
    return "maintain";
  }

  function formatDelivery(value) {
    const delivery = String(value || "").replace(/_/g, " ").trim();
    return delivery || "--";
  }

  function safeExternalUrl(value) {
    const url = String(value || "").trim();
    if (!url) return "";
    if (/^https:\/\/(business\.facebook\.com|www\.facebook\.com|facebook\.com|www\.instagram\.com|instagram\.com)\//i.test(url)) return url;
    if (/^https?:\/\//i.test(url)) return url;
    return "";
  }

  function safeImageUrl(value) {
    const url = String(value || "").trim();
    if (!url) return "";
    if (/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(url)) return url;
    if (/^https?:\/\//i.test(url)) return url;
    return "";
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function slugify(value) {
    return String(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  let toastTimer;
  function showToast(message) {
    clearTimeout(toastTimer);
    document.querySelector(".toast")?.remove();
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    document.body.appendChild(toast);
    toastTimer = setTimeout(() => toast.remove(), 2400);
  }

  window.addEventListener("resize", () => {
    window.clearTimeout(window.__chartResizeTimer);
    window.__chartResizeTimer = window.setTimeout(renderCharts, 150);
  });
})();
