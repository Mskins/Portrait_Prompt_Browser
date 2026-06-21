const data = Array.isArray(window.PROMPT_BROWSER_DATA)
  ? window.PROMPT_BROWSER_DATA.map(normalizeItem).sort((a, b) => a.index - b.index)
  : [];

const meta = window.PROMPT_BROWSER_META || { total: data.length, parts: 0 };
const PAGE_SIZE = 20;

const facetConfig = [
  { key: "part", label: "卷号", type: "scalar", target: "filter-part" },
  { key: "primaryCategory", label: "主类", type: "scalar", target: "filter-primary" },
  { key: "sceneTags", label: "场景", type: "array", target: "filter-scene" },
  { key: "shotTags", label: "构图", type: "array", target: "filter-shot" },
  { key: "lightTags", label: "光线", type: "array", target: "filter-light" },
  { key: "clothingTags", label: "服装", type: "array", target: "filter-clothing" },
  { key: "hairTags", label: "发型", type: "array", target: "filter-hair" },
  { key: "poseTags", label: "动作", type: "array", target: "filter-pose" },
  { key: "propTags", label: "道具", type: "array", target: "filter-prop" },
  { key: "styleTags", label: "风格", type: "array", target: "filter-style" }
];

const summaryConfig = [
  { key: "sceneTags", title: "场景高频" },
  { key: "clothingTags", title: "服装高频" },
  { key: "lightTags", title: "光线高频" },
  { key: "styleTags", title: "风格高频" }
];

const state = {
  search: "",
  part: "",
  primaryCategory: "",
  sceneTags: "",
  shotTags: "",
  lightTags: "",
  clothingTags: "",
  hairTags: "",
  poseTags: "",
  propTags: "",
  styleTags: "",
  currentPage: 1,
  currentRandomId: "",
  lastFilterSignature: "",
  advancedOpen: true,
  sidebarOpen: false
};

const elements = {
  totalCount: document.getElementById("total-count"),
  visibleCount: document.getElementById("visible-count"),
  partCount: document.getElementById("part-count"),
  searchInput: document.getElementById("search-input"),
  clearFilters: document.getElementById("clear-filters"),
  copySummary: document.getElementById("copy-summary"),
  primaryChips: document.getElementById("primary-chips"),
  activeFilterCount: document.getElementById("active-filter-count"),
  advancedFilters: document.getElementById("advanced-filters"),
  toggleAdvanced: document.getElementById("toggle-advanced"),
  summaryGroups: document.getElementById("summary-groups"),
  sidebar: document.getElementById("sidebar"),
  sidebarBackdrop: document.getElementById("sidebar-backdrop"),
  openSidebar: document.getElementById("open-sidebar"),
  closeSidebar: document.getElementById("close-sidebar"),
  mobileFilterCount: document.getElementById("mobile-filter-count"),
  mobileVisibleCount: document.getElementById("mobile-visible-count"),
  activeFilters: document.getElementById("active-filters"),
  randomFeature: document.getElementById("random-feature"),
  resultsGrid: document.getElementById("results-grid"),
  pagination: document.getElementById("pagination"),
  toast: document.getElementById("toast")
};

const facetValues = buildFacetValues();

init();

function normalizeItem(item) {
  const arrayKeys = [
    "sceneTags",
    "shotTags",
    "lightTags",
    "clothingTags",
    "hairTags",
    "poseTags",
    "propTags",
    "styleTags"
  ];

  const normalized = { ...item };
  arrayKeys.forEach((key) => {
    const value = item[key];
    if (Array.isArray(value)) {
      normalized[key] = value.filter(Boolean);
    } else if (value) {
      normalized[key] = [value];
    } else {
      normalized[key] = [];
    }
  });

  return normalized;
}

function init() {
  elements.totalCount.textContent = `${meta.total || data.length}`;
  elements.partCount.textContent = `${meta.parts || new Set(data.map((item) => item.part)).size}`;

  elements.searchInput.addEventListener("input", handleSearchInput);
  elements.clearFilters.addEventListener("click", resetFilters);
  elements.copySummary.addEventListener("click", copySummary);
  elements.toggleAdvanced.addEventListener("click", toggleAdvancedFilters);
  elements.openSidebar.addEventListener("click", openSidebar);
  elements.closeSidebar.addEventListener("click", closeSidebar);
  elements.sidebarBackdrop.addEventListener("click", closeSidebar);
  elements.primaryChips.addEventListener("click", handlePrimaryChipClick);
  elements.activeFilters.addEventListener("click", handleFilterPillClick);
  elements.resultsGrid.addEventListener("click", handleResultsClick);
  elements.pagination.addEventListener("click", handlePaginationClick);

  window.addEventListener("resize", syncResponsiveState);
  window.addEventListener("keydown", handleWindowKeydown);

  populateSelects();
  syncResponsiveState();
  render();
}

function buildFacetValues() {
  const values = {};

  for (const facet of facetConfig) {
    const bucket = new Map();

    data.forEach((item) => {
      if (facet.type === "scalar") {
        const rawValue = String(item[facet.key] ?? "").trim();
        if (!rawValue) return;
        bucket.set(rawValue, (bucket.get(rawValue) || 0) + 1);
        return;
      }

      (item[facet.key] || []).forEach((tag) => {
        const rawValue = String(tag).trim();
        if (!rawValue) return;
        bucket.set(rawValue, (bucket.get(rawValue) || 0) + 1);
      });
    });

    values[facet.key] = [...bucket.entries()]
      .sort((a, b) => {
        if (facet.key === "part") return Number(a[0]) - Number(b[0]);
        if (b[1] !== a[1]) return b[1] - a[1];
        return a[0].localeCompare(b[0], "zh-CN");
      })
      .map(([value, count]) => ({ value, count }));
  }

  return values;
}

function populateSelects() {
  facetConfig.forEach((facet) => {
    const select = document.getElementById(facet.target);
    const defaultLabel = facet.key === "part" ? "全部卷号" : `全部${facet.label}`;
    select.innerHTML = `<option value="">${defaultLabel}</option>`;

    facetValues[facet.key].forEach((entry) => {
      const option = document.createElement("option");
      option.value = entry.value;
      option.textContent = facet.key === "part"
        ? `第 ${String(entry.value).padStart(2, "0")} 卷 (${entry.count})`
        : `${entry.value} (${entry.count})`;
      select.appendChild(option);
    });

    select.addEventListener("change", () => {
      state[facet.key] = select.value;
      state.currentPage = 1;
      render();
      maybeCloseSidebarAfterAction();
    });
  });
}

function handleSearchInput(event) {
  state.search = event.target.value.trim();
  state.currentPage = 1;
  render();
}

function resetFilters() {
  state.search = "";
  state.currentPage = 1;

  facetConfig.forEach((facet) => {
    state[facet.key] = "";
    const select = document.getElementById(facet.target);
    if (select) select.value = "";
  });

  elements.searchInput.value = "";
  render();
  maybeCloseSidebarAfterAction();
}

function toggleAdvancedFilters() {
  state.advancedOpen = !state.advancedOpen;
  syncAdvancedFilters();
}

function handlePrimaryChipClick(event) {
  const chip = event.target.closest("[data-primary]");
  if (!chip) return;

  const value = chip.dataset.primary;
  state.primaryCategory = state.primaryCategory === value ? "" : value;
  document.getElementById("filter-primary").value = state.primaryCategory;
  state.currentPage = 1;
  render();
  maybeCloseSidebarAfterAction();
}

function handleFilterPillClick(event) {
  const pill = event.target.closest("[data-remove-filter]");
  if (!pill) return;

  const key = pill.dataset.removeFilter;
  if (!key) return;

  state[key] = "";
  if (key === "search") {
    elements.searchInput.value = "";
  } else {
    const facet = facetConfig.find((item) => item.key === key);
    if (facet) {
      const select = document.getElementById(facet.target);
      if (select) select.value = "";
    }
  }

  state.currentPage = 1;
  render();
}

function handleResultsClick(event) {
  const copyButton = event.target.closest("[data-copy-id]");
  if (copyButton) {
    const item = data.find((entry) => entry.id === copyButton.dataset.copyId);
    if (item) {
      copyText(item.text, `已复制 #${item.id}`);
    }
    return;
  }

  const chip = event.target.closest("[data-filter-key][data-filter-value]");
  if (!chip) return;

  const key = chip.dataset.filterKey;
  const value = chip.dataset.filterValue;
  const facet = facetConfig.find((item) => item.key === key);
  if (!facet) return;

  state[key] = value;
  const select = document.getElementById(facet.target);
  if (select) select.value = value;
  state.currentPage = 1;
  render();
  maybeCloseSidebarAfterAction();
}

function handlePaginationClick(event) {
  const button = event.target.closest("[data-page-action]");
  if (!button) return;

  const action = button.dataset.pageAction;
  const totalPages = Number(button.dataset.totalPages || "1");

  if (action === "prev" && state.currentPage > 1) {
    state.currentPage -= 1;
  }

  if (action === "next" && state.currentPage < totalPages) {
    state.currentPage += 1;
  }

  render();
}

function getFilteredData() {
  const keyword = state.search.toLowerCase();

  return data.filter((item) => {
    if (keyword) {
      const haystack = [
        item.text,
        item.primaryCategory,
        ...(item.sceneTags || []),
        ...(item.shotTags || []),
        ...(item.lightTags || []),
        ...(item.clothingTags || []),
        ...(item.hairTags || []),
        ...(item.poseTags || []),
        ...(item.propTags || []),
        ...(item.styleTags || [])
      ].join(" ").toLowerCase();

      if (!haystack.includes(keyword)) return false;
    }

    for (const facet of facetConfig) {
      const activeValue = state[facet.key];
      if (!activeValue) continue;

      if (facet.type === "scalar") {
        if (String(item[facet.key]) !== String(activeValue)) return false;
      } else if (!(item[facet.key] || []).includes(activeValue)) {
        return false;
      }
    }

    return true;
  });
}

function render() {
  const filtered = getFilteredData();
  syncRandomSelection(filtered);
  renderPrimaryChips(filtered);
  renderActiveFilters();
  renderSummary(filtered);
  renderRandomFeature(filtered);
  renderResults(filtered);
  renderMeta(filtered.length);
}

function renderMeta(filteredCount) {
  elements.visibleCount.textContent = `${filteredCount}`;
  elements.mobileVisibleCount.textContent = `${filteredCount}`;

  const activeCount = countActiveFilters();
  elements.activeFilterCount.textContent = `${activeCount} 个筛选`;
  elements.mobileFilterCount.textContent = `${activeCount} 个筛选`;
}

function countActiveFilters() {
  let count = state.search ? 1 : 0;
  facetConfig.forEach((facet) => {
    if (state[facet.key]) count += 1;
  });
  return count;
}

function renderPrimaryChips(filtered) {
  const counts = new Map();
  filtered.forEach((item) => {
    counts.set(item.primaryCategory, (counts.get(item.primaryCategory) || 0) + 1);
  });

  elements.primaryChips.innerHTML = facetValues.primaryCategory.map((entry) => {
    const active = state.primaryCategory === entry.value ? "active" : "";
    const filteredCount = counts.get(entry.value) || 0;
    return `
      <button class="chip ${active}" type="button" data-primary="${escapeHtml(entry.value)}">
        ${escapeHtml(entry.value)}
        <small>${filteredCount}</small>
      </button>
    `;
  }).join("");
}

function renderActiveFilters() {
  const pills = [];

  if (state.search) {
    pills.push(renderPill("search", "关键词", state.search));
  }

  facetConfig.forEach((facet) => {
    if (!state[facet.key]) return;
    const label = facet.key === "part"
      ? `第 ${String(state[facet.key]).padStart(2, "0")} 卷`
      : state[facet.key];
    pills.push(renderPill(facet.key, facet.label, label));
  });

  elements.activeFilters.innerHTML = pills.join("");
}

function renderPill(key, label, value) {
  return `
    <button class="filter-pill" type="button" data-remove-filter="${key}">
      <span>${escapeHtml(label)}</span>
      ${escapeHtml(value)}
    </button>
  `;
}

function renderSummary(filtered) {
  if (!filtered.length) {
    elements.summaryGroups.innerHTML = `
      <div class="summary-card">
        <h3>暂无可统计结果</h3>
        <div class="summary-tags">
          <span class="summary-tag">请放宽筛选条件</span>
        </div>
      </div>
    `;
    return;
  }

  elements.summaryGroups.innerHTML = summaryConfig.map((config) => {
    const topTags = getTopTags(filtered, config.key, 8);
    return `
      <div class="summary-card">
        <h3>${escapeHtml(config.title)}</h3>
        <div class="summary-tags">
          ${topTags.map((entry) => `
            <span class="summary-tag">${escapeHtml(entry.value)}<strong>${entry.count}</strong></span>
          `).join("")}
        </div>
      </div>
    `;
  }).join("");
}

function renderRandomFeature(filtered) {
  if (!filtered.length) {
    elements.randomFeature.innerHTML = `
      <div class="empty-state">
        <h3>当前没有随机提示词</h3>
        <p>请调整筛选条件后再试。</p>
      </div>
    `;
    return;
  }

  const item = getCurrentRandomItem(filtered);
  if (!item) return;

  elements.randomFeature.innerHTML = `
    <article class="random-card">
      <div class="random-head">
        <p class="results-label">随机提示词</p>
        <div class="random-actions">
          <button class="secondary-button" type="button" data-random-action="next">随机一条</button>
          <button class="primary-button" type="button" data-random-action="copy">复制当前随机提示词</button>
        </div>
      </div>
      <pre class="random-body"><code>${escapeHtml(item.text)}</code></pre>
    </article>
  `;

  elements.randomFeature.querySelectorAll("[data-random-action]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.randomAction === "next") {
        randomizeCurrentPrompt();
      }
      if (button.dataset.randomAction === "copy") {
        copyCurrentRandomPrompt();
      }
    });
  });
}

function renderResults(filtered) {
  if (!filtered.length) {
    elements.resultsGrid.innerHTML = `
      <div class="empty-state">
        <h3>没有匹配结果</h3>
        <p>可以尝试清空部分筛选，或换一个更宽泛的关键词。</p>
      </div>
    `;
    elements.pagination.innerHTML = "";
    return;
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  if (state.currentPage > totalPages) {
    state.currentPage = totalPages;
  }

  const start = (state.currentPage - 1) * PAGE_SIZE;
  const visibleItems = filtered.slice(start, start + PAGE_SIZE);

  elements.resultsGrid.innerHTML = visibleItems.map(renderCard).join("");
  renderPagination(totalPages, start, visibleItems.length, filtered.length);
}

function renderCard(item) {
  const tags = [
    renderTag("主类", item.primaryCategory, "primaryCategory"),
    ...(item.sceneTags || []).map((tag) => renderTag("场景", tag, "sceneTags")),
    ...(item.shotTags || []).map((tag) => renderTag("构图", tag, "shotTags")),
    ...(item.lightTags || []).map((tag) => renderTag("光线", tag, "lightTags")),
    ...(item.clothingTags || []).map((tag) => renderTag("服装", tag, "clothingTags")),
    ...(item.hairTags || []).map((tag) => renderTag("发型", tag, "hairTags")),
    ...(item.poseTags || []).map((tag) => renderTag("动作", tag, "poseTags")),
    ...(item.propTags || []).map((tag) => renderTag("道具", tag, "propTags")),
    ...(item.styleTags || []).map((tag) => renderTag("风格", tag, "styleTags"))
  ].join("");

  return `
    <article class="prompt-card" id="prompt-${item.id}">
      <div class="prompt-head">
        <div class="prompt-id">
          <strong>#${escapeHtml(item.id)}</strong>
          <span>第 ${String(item.part).padStart(2, "0")} 卷 · ${escapeHtml(item.sourceFile)}</span>
        </div>
        <button class="primary-button prompt-copy" type="button" data-copy-id="${escapeHtml(item.id)}">复制提示词</button>
      </div>
      <div class="prompt-meta">${tags}</div>
      <pre class="prompt-body"><code>${escapeHtml(item.text)}</code></pre>
    </article>
  `;
}

function renderTag(kind, value, filterKey) {
  return `
    <button
      class="tag-chip"
      type="button"
      data-kind="${escapeHtml(kind)}"
      data-filter-key="${escapeHtml(filterKey)}"
      data-filter-value="${escapeHtml(value)}"
    >
      ${escapeHtml(kind)} · ${escapeHtml(value)}
    </button>
  `;
}

function renderPagination(totalPages, startIndex, visibleCount, totalCount) {
  elements.pagination.innerHTML = `
    <div class="pagination-shell">
      <button
        class="ghost-button"
        type="button"
        data-page-action="prev"
        data-total-pages="${totalPages}"
        ${state.currentPage <= 1 ? "disabled" : ""}
      >
        上一页
      </button>
      <div class="pagination-info">
        <strong>第 ${state.currentPage} / ${totalPages} 页</strong>
        <span>显示 ${startIndex + 1} - ${startIndex + visibleCount} / ${totalCount}</span>
      </div>
      <button
        class="ghost-button"
        type="button"
        data-page-action="next"
        data-total-pages="${totalPages}"
        ${state.currentPage >= totalPages ? "disabled" : ""}
      >
        下一页
      </button>
    </div>
  `;
}

function getTopTags(items, key, limit) {
  const bucket = new Map();
  items.forEach((item) => {
    (item[key] || []).forEach((tag) => {
      bucket.set(tag, (bucket.get(tag) || 0) + 1);
    });
  });

  return [...bucket.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-CN"))
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

function buildFilterSignature() {
  return JSON.stringify({
    search: state.search,
    part: state.part,
    primaryCategory: state.primaryCategory,
    sceneTags: state.sceneTags,
    shotTags: state.shotTags,
    lightTags: state.lightTags,
    clothingTags: state.clothingTags,
    hairTags: state.hairTags,
    poseTags: state.poseTags,
    propTags: state.propTags,
    styleTags: state.styleTags
  });
}

function syncRandomSelection(filtered) {
  const signature = buildFilterSignature();
  const currentVisible = filtered.some((item) => item.id === state.currentRandomId);
  if (signature !== state.lastFilterSignature || !currentVisible) {
    state.lastFilterSignature = signature;
    state.currentRandomId = pickRandomId(filtered, state.currentRandomId);
  }
}

function pickRandomId(items, excludeId = "") {
  if (!items.length) return "";
  if (items.length === 1) return items[0].id;

  let item = items[Math.floor(Math.random() * items.length)];
  if (excludeId && item.id === excludeId) {
    const alternatives = items.filter((entry) => entry.id !== excludeId);
    item = alternatives[Math.floor(Math.random() * alternatives.length)];
  }

  return item.id;
}

function getCurrentRandomItem(filtered) {
  return filtered.find((item) => item.id === state.currentRandomId) || filtered[0] || null;
}

function randomizeCurrentPrompt() {
  const filtered = getFilteredData();
  if (!filtered.length) {
    showToast("当前没有可随机的结果");
    return;
  }

  state.currentRandomId = pickRandomId(filtered, state.currentRandomId);
  renderRandomFeature(filtered);
  showToast("已切换随机提示词");
}

function copyCurrentRandomPrompt() {
  const filtered = getFilteredData();
  const item = getCurrentRandomItem(filtered);
  if (!item) {
    showToast("当前没有可复制的随机提示词");
    return;
  }

  copyText(item.text, `已复制随机提示词 #${item.id}`);
}

function copySummary() {
  const filtered = getFilteredData();
  const active = [];
  if (state.search) active.push(`关键词: ${state.search}`);
  facetConfig.forEach((facet) => {
    if (state[facet.key]) active.push(`${facet.label}: ${state[facet.key]}`);
  });

  const summary = [
    `总提示词: ${data.length}`,
    `当前结果: ${filtered.length}`,
    `当前筛选: ${active.length ? active.join(" | ") : "无"}`
  ].join("\n");

  copyText(summary, "已复制当前统计");
}

function syncAdvancedFilters() {
  elements.advancedFilters.style.display = state.advancedOpen ? "grid" : "none";
  elements.toggleAdvanced.textContent = state.advancedOpen ? "收起" : "展开";
}

function isCompactViewport() {
  return window.innerWidth <= 1080;
}

function openSidebar() {
  if (!isCompactViewport()) return;
  state.sidebarOpen = true;
  syncSidebarState();
}

function closeSidebar() {
  state.sidebarOpen = false;
  syncSidebarState();
}

function syncSidebarState() {
  const shouldOpen = state.sidebarOpen && isCompactViewport();
  elements.sidebar.classList.toggle("is-open", shouldOpen);
  elements.sidebarBackdrop.classList.toggle("is-open", shouldOpen);
  document.body.classList.toggle("drawer-open", shouldOpen);
}

function syncResponsiveState() {
  if (!isCompactViewport()) {
    state.sidebarOpen = false;
  }
  syncSidebarState();
  syncAdvancedFilters();
}

function maybeCloseSidebarAfterAction() {
  if (isCompactViewport()) {
    closeSidebar();
  }
}

function handleWindowKeydown(event) {
  if (event.key === "Escape" && state.sidebarOpen) {
    closeSidebar();
  }
}

async function copyText(text, message) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(message);
  } catch (error) {
    const helper = document.createElement("textarea");
    helper.value = text;
    document.body.appendChild(helper);
    helper.select();
    document.execCommand("copy");
    helper.remove();
    showToast(message);
  }
}

let toastTimer = null;
function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    elements.toast.classList.remove("show");
  }, 1800);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
