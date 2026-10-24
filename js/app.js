/**
 * PaperPatterns Modern Application Controller
 * Handles state, interactive canvas, dynamic form generation, and export workflows.
 */

"use strict";

(function () {
  const $ = (id) => document.getElementById(id);
  const $$ = (sel) => document.querySelectorAll(sel);

  // Storage keys
  const STORAGE_PREFS = "paperpatterns_prefs_v3";
  const STORAGE_FAVS = "paperpatterns_favs_v3";

  // App State
  const state = {
    current: null, // active generator
    unit: "mm", // "mm" | "cm" | "inch"
    pageSize: "a4",
    width: 210, // in current unit
    height: 297, // in current unit
    orientation: "portrait",
    margin: 10, // in current unit
    spacing: 5, // in current unit
    spacingMode: "size", // "size" | "per"
    weight: 0.5, // points
    gridColor: "3a5fcd",
    bgColor: "ffffff",
    border: {
      style: "none",
      weight: 1.0,
      color: "3a5fcd",
      matchGridColor: true,
      inset: 0,
      showSubmission: true,
      showBanner: true,
      showTitleBlock: true,
      showCoords: true,
      showHeader: true,
      showFooter: true,
      showRemarks: true,
      showSeal: true,
      showRevCol: true,
      showPearls: true,
      showCrests: true,
      showCornerRosettes: true
    },
    extras: {},
    pageCount: 1,
    headerText: "",
    hasDateField: false,
    hasPageNumbering: false,
    zoom: 1,
    panX: 0,
    panY: 0,
    isPanning: false,
    startPanX: 0,
    startPanY: 0,
    activeCategory: "all",
    searchQuery: "",
    favorites: new Set()
  };

  // Thumbnail cache to avoid recomputing SVGs repeatedly
  const thumbCache = new Map();

  // ----------------------------------------------------
  // Initialization
  // ----------------------------------------------------
  function init() {
    loadPreferences();
    setupEventListeners();
    setupTheme();
    renderCategoryNav();
    route();
  }

  // ----------------------------------------------------
  // Preferences & Favorites
  // ----------------------------------------------------
  function defaultMarginForUnit(unit) {
    if (unit === "mm") return 12;
    if (unit === "cm") return 1.2;
    return 0.5; // inch
  }

  function loadPreferences() {
    try {
      const favs = localStorage.getItem(STORAGE_FAVS);
      if (favs) {
        state.favorites = new Set(JSON.parse(favs));
      }
      const prefs = localStorage.getItem(STORAGE_PREFS);
      if (prefs) {
        const p = JSON.parse(prefs);
        if (p.unit) state.unit = p.unit;
        if (p.pageSize && PaperEngine.PAGE_SIZES[p.pageSize]) state.pageSize = p.pageSize;
        if (p.theme) document.documentElement.setAttribute("data-theme", p.theme);
        state.margin = defaultMarginForUnit(state.unit);
      } else {
        // Auto-detect unit based on locale
        const lang = (navigator.language || "").toLowerCase();
        if (lang === "en-us") {
          state.unit = "inch";
          state.pageSize = "letter";
          state.margin = 0.5;
          state.spacing = 4;
          state.spacingMode = "per";
        } else {
          state.margin = defaultMarginForUnit(state.unit);
        }
      }
    } catch (e) {
      console.warn("Storage load error:", e);
    }
  }

  function savePreferences() {
    try {
      localStorage.setItem(STORAGE_FAVS, JSON.stringify([...state.favorites]));
      localStorage.setItem(STORAGE_PREFS, JSON.stringify({
        unit: state.unit,
        pageSize: state.pageSize,
        theme: document.documentElement.getAttribute("data-theme") || "light"
      }));
    } catch (e) {}
  }

  // ----------------------------------------------------
  // Theme Toggle
  // ----------------------------------------------------
  function setupTheme() {
    const btn = $("themeToggleBtn");
    btn.addEventListener("click", () => {
      const cur = document.documentElement.getAttribute("data-theme") || "light";
      const next = cur === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      savePreferences();
    });
}

  // ----------------------------------------------------
  // Category Navigation & Filtering
  // ----------------------------------------------------
  function renderCategoryNav() {
    const nav = $("categoryNav");
    nav.addEventListener("click", (e) => {
      const pill = e.target.closest(".cat-pill");
      if (!pill) return;
      $$(".cat-pill").forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      state.activeCategory = pill.dataset.cat;
      renderPatternCatalog();
    });
  }

  function filterGenerators() {
    const list = window.PATTERNS.filter(gen => {
      // Category filter
      if (state.activeCategory === "favorites") {
        if (!state.favorites.has(gen.id)) return false;
      } else if (state.activeCategory === "borders" || state.activeCategory === "Project & Assignment Borders") {
        if (gen.category === "Project & Assignment Borders") return true;
        const borderKeywords = ["border", "frame", "pad", "cornell", "storyboard", "ledger"];
        const match = borderKeywords.some(kw => gen.id.toLowerCase().includes(kw) || gen.name.toLowerCase().includes(kw));
        return match;
      } else if (state.activeCategory !== "all") {
        if (gen.category !== state.activeCategory) return false;
      }
      // Search text query
      if (state.searchQuery) {
        const q = state.searchQuery.toLowerCase();
        const mName = gen.name.toLowerCase().includes(q);
        const mId = gen.id.toLowerCase().includes(q);
        const mBlurb = (gen.blurb || "").toLowerCase().includes(q);
        const mNote = (gen.note || "").toLowerCase().includes(q);
        return mName || mId || mBlurb || mNote;
      }
      return true;
    });

    if (state.activeCategory === "borders" || state.activeCategory === "Project & Assignment Borders") {
      list.sort((a, b) => {
        const aIsProj = a.category === "Project & Assignment Borders" ? 0 : 1;
        const bIsProj = b.category === "Project & Assignment Borders" ? 0 : 1;
        return aIsProj - bIsProj;
      });
    }

    return list;
  }

  // ----------------------------------------------------
  // Mini Thumbnail Generator for Catalog Cards
  // ----------------------------------------------------
  function getMiniThumbnailSvg(gen) {
    if (thumbCache.has(gen.id)) return thumbCache.get(gen.id);

    // Standard A4 portrait proportions with isThumbnail flag for beautiful crisp previews
    const raw = {
      width: 210, height: 297, page_units: "mm",
      margin: 12, margin_units: "mm",
      spacing: gen.spacing ? (gen.spacing.def || 5) : 5,
      spacing_units: "mm",
      sMode: gen.spacing ? (gen.spacing.mode || "size") : "size",
      weight: 0.5,
      gridColor: "3a5fcd",
      bgColor: "ffffff",
      isThumbnail: true,
      x: {}
    };

    if (gen.extras) {
      for (const e of gen.extras) {
        raw.x[e.id] = e.def;
      }
    }

    try {
      const p = PaperEngine.resolveCommon(raw);
      p.isThumbnail = true;
      const r = gen.draw(p);
      const svg = '<svg viewBox="0 0 ' + p.width + ' ' + p.height + '" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">' +
        PaperEngine.dlToSvgBody(p, r.dl) + '</svg>';
      thumbCache.set(gen.id, svg);
      return svg;
    } catch (err) {
      return '<svg viewBox="0 0 100 100"><rect width="100" height="100" fill="#f8fafc"/></svg>';
    }
  }

  // ----------------------------------------------------
  // Render Pattern Catalog
  // ----------------------------------------------------
  function renderPatternCatalog() {
    const grid = $("patternGrid");
    const filtered = filterGenerators();
    $("drawerCatalogTitle").textContent = `Pattern Library (${filtered.length})`;

    if (filtered.length === 0) {
      grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px 10px; color: var(--text-muted);">' +
        '<p style="font-size:14px; margin-bottom:4px;">No matching patterns found</p>' +
        '<p style="font-size:12px;">Try adjusting your search query or category filter</p></div>';
      return;
    }

    let html = "";
    for (const gen of filtered) {
      const isFav = state.favorites.has(gen.id);
      const isActive = state.current && state.current.id === gen.id;
      html += `
        <div class="pattern-card ${isActive ? 'active' : ''}" data-id="${gen.id}">
          <button class="card-fav-btn ${isFav ? 'is-fav' : ''}" data-favid="${gen.id}" title="${isFav ? 'Remove favorite' : 'Add to favorites'}">
            ★
          </button>
          <div class="card-thumb">
            ${getMiniThumbnailSvg(gen)}
          </div>
          <div class="card-info">
            <span class="card-name">${gen.name}</span>
            <span class="card-blurb">${gen.blurb || ""}</span>
          </div>
        </div>
      `;
    }
    grid.innerHTML = html;
  }

  // ----------------------------------------------------
  // Hash Routing & Deep Linking
  // ----------------------------------------------------
  function route() {
    const h = location.hash.replace(/^#\/?/, "");
    const qi = h.indexOf("?");
    const id = decodeURIComponent(qi >= 0 ? h.slice(0, qi) : h);
    const query = qi >= 0 ? h.slice(qi + 1) : "";

    let gen = window.PATTERNS.find(p => p.id === id);
    if (!gen) gen = window.PATTERNS[0]; // fallback to first (Plain Grid)

    selectGenerator(gen, query);
  }

  function selectGenerator(gen, queryStr = "") {
    state.current = gen;

    // Update URL hash without causing loop
    const targetHash = `#${gen.id}` + (queryStr ? `?${queryStr}` : "");
    if (location.hash !== targetHash && !queryStr) {
      history.replaceState(null, "", `#${gen.id}`);
    }

    // Set titles
    $("inspectorPatternName").textContent = gen.name;
    $("inspectorPatternBlurb").textContent = gen.blurb || "";
    document.title = `${gen.name} · PaperPatterns`;

    // Initialize defaults from generator
    initDefaultsForGenerator(gen);

    // Apply URL params if present
    if (queryStr) {
      applyQueryParams(queryStr);
    }

    // Render inspector controls
    renderQuickPicks(gen);
    renderDynamicExtras(gen);
    syncInspectorControls();
    renderPatternCatalog();

    // Redraw canvas
    refreshCanvas(true);
  }

  function initDefaultsForGenerator(gen) {
    // Standard page dims
    applyPagePreset(state.pageSize);

    // Spacing
    if (gen.spacing) {
      if (state.unit === "mm") {
        state.spacingMode = gen.spacing.mode || "size";
        if (gen.spacing.mode === "size") {
          // If default was specified in inches (e.g. 0.25, 0.33, 0.5 in), convert to mm
          if (gen.spacing.def <= 2) {
            state.spacing = Math.max(4, Math.round(gen.spacing.def * 25.4));
          } else {
            state.spacing = gen.spacing.def;
          }
        } else {
          // In mm, standard graph paper spacing is 5mm cell size
          state.spacingMode = "size";
          state.spacing = 5;
        }
      } else if (state.unit === "cm") {
        state.spacingMode = gen.spacing.mode || "size";
        if (gen.spacing.mode === "size") {
          if (gen.spacing.def <= 2) {
            state.spacing = Math.max(0.4, Math.round(gen.spacing.def * 2.54 * 10) / 10);
          } else {
            state.spacing = gen.spacing.def;
          }
        } else {
          state.spacingMode = "size";
          state.spacing = 0.5;
        }
      } else {
        state.spacingMode = gen.spacing.mode || "per";
        state.spacing = gen.spacing.def !== undefined ? gen.spacing.def : 4;
      }
    } else {
      state.spacingMode = state.unit === "mm" ? "size" : "per";
      state.spacing = state.unit === "mm" ? 5 : 4;
    }

    // Weight
    state.weight = gen.weight && gen.weight.def ? gen.weight.def : 0.5;

    // Extras
    state.extras = {};
    if (gen.extras) {
      for (const e of gen.extras) {
        state.extras[e.id] = e.def;
      }
    }
  }

  function applyQueryParams(qs) {
    const q = new URLSearchParams(qs);
    if (q.has("unit")) state.unit = q.get("unit");
    if (q.has("pageSize")) {
      state.pageSize = q.get("pageSize");
      applyPagePreset(state.pageSize);
    }
    if (q.has("width")) state.width = parseFloat(q.get("width"));
    if (q.has("height")) state.height = parseFloat(q.get("height"));
    if (q.has("orientation")) state.orientation = q.get("orientation");
    if (q.has("margin")) state.margin = parseFloat(q.get("margin"));
    if (q.has("spacing")) state.spacing = parseFloat(q.get("spacing"));
    if (q.has("spacingMode")) state.spacingMode = q.get("spacingMode");
    if (q.has("weight")) state.weight = parseFloat(q.get("weight"));
    if (q.has("gridColor")) state.gridColor = PaperEngine.checkColor(q.get("gridColor"), state.gridColor);
    if (q.has("bgColor")) state.bgColor = PaperEngine.checkColor(q.get("bgColor"), state.bgColor);
    if (q.has("borderStyle")) state.border.style = q.get("borderStyle");
    if (q.has("borderWeight")) state.border.weight = parseFloat(q.get("borderWeight"));
    if (q.has("borderColor")) {
      state.border.color = PaperEngine.checkColor(q.get("borderColor"), state.border.color);
      state.border.matchGridColor = false;
    }
    if (q.has("borderInset")) state.border.inset = parseFloat(q.get("borderInset"));

    if (state.current && state.current.extras) {
      for (const e of state.current.extras) {
        if (q.has(e.id)) {
          if (e.t === "chk") state.extras[e.id] = q.get(e.id) === "1" || q.get(e.id) === "true";
          else if (e.t === "num" || e.t === "rng" || e.t === "pct" || e.t === "wt") state.extras[e.id] = parseFloat(q.get(e.id));
          else state.extras[e.id] = q.get(e.id);
        }
      }
    }
  }

  function buildQueryString() {
    const q = new URLSearchParams();
    q.set("unit", state.unit);
    q.set("pageSize", state.pageSize);
    q.set("width", state.width.toString());
    q.set("height", state.height.toString());
    q.set("orientation", state.orientation);
    q.set("margin", state.margin.toString());
    q.set("spacing", state.spacing.toString());
    q.set("spacingMode", state.spacingMode);
    q.set("weight", state.weight.toString());
    q.set("gridColor", state.gridColor);
    q.set("bgColor", state.bgColor);
    if (state.border.style !== "none") {
      q.set("borderStyle", state.border.style);
      q.set("borderWeight", state.border.weight.toString());
      if (!state.border.matchGridColor) q.set("borderColor", state.border.color);
      if (state.border.inset) q.set("borderInset", state.border.inset.toString());
    }

    for (const [k, v] of Object.entries(state.extras)) {
      if (typeof v === "boolean") q.set(k, v ? "1" : "0");
      else if (v !== undefined && v !== null) q.set(k, v.toString());
    }
    return q.toString();
  }

  // ----------------------------------------------------
  // Page Size & Units
  // ----------------------------------------------------
  function applyPagePreset(sizeKey) {
    state.pageSize = sizeKey;
    const preset = PaperEngine.PAGE_SIZES[sizeKey];
    if (preset) {
      let wInches = preset.width;
      let hInches = preset.height;
      if (state.orientation === "landscape") {
        const t = wInches; wInches = hInches; hInches = t;
      }
      state.width = Math.round(PaperEngine.inchesToUnit(wInches, state.unit) * 100) / 100;
      state.height = Math.round(PaperEngine.inchesToUnit(hInches, state.unit) * 100) / 100;
    }
  }

  function setUnit(newUnit) {
    if (state.unit === newUnit) return;
    const oldUnit = state.unit;
    state.unit = newUnit;

    // Convert margin and dimensions
    const wInches = PaperEngine.unitToInches(state.width, oldUnit);
    const hInches = PaperEngine.unitToInches(state.height, oldUnit);
    let mInches = PaperEngine.unitToInches(state.margin, oldUnit);
    if (isNaN(mInches) || mInches < 0 || mInches > 2.5) {
      mInches = 0.5;
    }

    state.width = Math.round(PaperEngine.inchesToUnit(wInches, newUnit) * 100) / 100;
    state.height = Math.round(PaperEngine.inchesToUnit(hInches, newUnit) * 100) / 100;
    state.margin = Math.round(PaperEngine.inchesToUnit(mInches, newUnit) * 100) / 100;

    // Convert spacing if mode is size
    if (state.spacingMode === "size") {
      const sInches = PaperEngine.unitToInches(state.spacing, oldUnit);
      state.spacing = Math.round(PaperEngine.inchesToUnit(sInches, newUnit) * 100) / 100;
    }

    // Update UI segmented control
    $$(".segmented-control button[data-unit]").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.unit === newUnit);
    });

    syncInspectorControls();
    refreshCanvas();
    savePreferences();
  }

  // ----------------------------------------------------
  // Quick Picks (Curated Presets)
  // ----------------------------------------------------
  function renderQuickPicks(gen) {
    const list = $("quickPicksList");
    if (!gen.picks || gen.picks.length === 0) {
      list.innerHTML = '<span style="font-size:12px; color:var(--text-faint);">Standard default configuration</span>';
      return;
    }

    let html = "";
    gen.picks.forEach((pk, i) => {
      html += `
        <button class="quick-pick-btn" data-pickidx="${i}">
          <span>${pk.name}</span>
          <span class="arrow">→</span>
        </button>
      `;
    });
    list.innerHTML = html;
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // ----------------------------------------------------
  // Dynamic Pattern Extras Generator
  // ----------------------------------------------------
  function renderDynamicExtras(gen) {
    const container = $("dynamicExtrasContainer");
    if (!gen.extras || gen.extras.length === 0) {
      container.innerHTML = "";
      return;
    }

    let html = "";
    for (const e of gen.extras) {
      const val = state.extras[e.id] !== undefined ? state.extras[e.id] : e.def;

      if (e.t === "chk") {
        html += `
          <div class="control-row">
            <label class="switch-control">
              <span class="switch-label">${e.label || e.text || e.id}</span>
              <input type="checkbox" id="extra-${e.id}" ${val ? "checked" : ""}>
              <div class="switch-track"><div class="switch-thumb"></div></div>
            </label>
          </div>
        `;
      } else if (e.t === "pct" || e.t === "rng") {
        const min = e.min !== undefined ? e.min : (e.t === "pct" ? 0 : 1);
        const max = e.max !== undefined ? e.max : (e.t === "pct" ? 100 : 50);
        const step = e.step || 1;
        html += `
          <div class="control-row">
            <div class="control-label">
              <span>${e.label || e.id}</span>
              <span class="control-val-badge" id="extra-badge-${e.id}">${val}${e.t === "pct" ? "%" : ""}</span>
            </div>
            <div class="slider-container">
              <input type="range" id="extra-${e.id}" min="${min}" max="${max}" step="${step}" value="${val}">
            </div>
          </div>
        `;
      } else if (e.t === "wt") {
        html += `
          <div class="control-row">
            <div class="control-label">
              <span>${e.label || e.id}</span>
              <span class="control-val-badge" id="extra-badge-${e.id}">${val} pt</span>
            </div>
            <div class="slider-container">
              <input type="range" id="extra-${e.id}" min="0.1" max="10" step="0.1" value="${val}">
            </div>
          </div>
        `;
      } else if (e.t === "txt") {
        html += `
          <div class="control-row">
            <div class="control-label"><span>${e.label || e.id}</span></div>
            <input type="text" id="extra-${e.id}" value="${escapeHtml(String(val !== undefined ? val : ''))}" placeholder="${e.placeholder || ''}" style="width: 100%; padding: 7px 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-surface); color: var(--text-main); font-size: 13px;">
          </div>
        `;
      } else if (e.t === "num") {
        html += `
          <div class="control-row">
            <div class="control-label"><span>${e.label || e.id}</span></div>
            <input type="number" id="extra-${e.id}" value="${val}" step="${e.step || 1}">
          </div>
        `;
      } else if (e.t === "col") {
        html += `
          <div class="control-row">
            <div class="control-label"><span>${e.label || e.id}</span></div>
            <input type="color" class="custom-color-input" id="extra-${e.id}" value="#${PaperEngine.checkColor(val, '000000')}">
          </div>
        `;
      } else if (e.t === "sel" && e.opts) {
        html += `
          <div class="control-row">
            <div class="control-label"><span>${e.label || e.id}</span></div>
            <select id="extra-${e.id}">
              ${e.opts.map(o => `<option value="${o.v !== undefined ? o.v : o}" ${val == (o.v !== undefined ? o.v : o) ? "selected" : ""}>${o.l || o}</option>`).join("")}
            </select>
          </div>
        `;
      }
    }
    container.innerHTML = html;

    // Wire extra event handlers
    for (const e of gen.extras) {
      const el = $(`extra-${e.id}`);
      if (!el) continue;

      el.addEventListener("input", (evt) => {
        if (e.t === "chk") {
          state.extras[e.id] = el.checked;
        } else if (e.t === "txt") {
          state.extras[e.id] = el.value;
        } else if (e.t === "col") {
          state.extras[e.id] = PaperEngine.checkColor(el.value, "000000");
        } else {
          state.extras[e.id] = parseFloat(el.value) || el.value;
          const badge = $(`extra-badge-${e.id}`);
          if (badge) {
            badge.textContent = el.value + (e.t === "pct" ? "%" : (e.t === "wt" ? " pt" : ""));
          }
        }
        refreshCanvas();
      });
    }
  }

  function setPageCount(val) {
    let count = parseInt(val, 10);
    if (isNaN(count) || count < 1) count = 1;
    if (count > 200) count = 200;
    state.pageCount = count;
    syncInspectorControls();
  }

  // ----------------------------------------------------
  // Dynamic Removable Sub-Options for Frames
  // ----------------------------------------------------
  function renderBorderSubOptions() {
    const container = $("borderSubOptionsContainer");
    if (!container) return;
    const style = state.border.style;

    const subDefs = {
      assignment_front: [
        { id: "bannerTitle", type: "text", label: "Banner Title", def: "PROJECT / ASSIGNMENT REPORT" },
        { id: "topicText", type: "text", label: "Topic Line", def: "TOPIC: __________________________________________________" },
        { id: "showBanner", type: "chk", label: "Title & Topic Banner", text: "Show top report title & topic banner" },
        { id: "showSubmission", type: "chk", label: "Student Submission Box", text: "Show student details box" }
      ],
      engineering_titleblock: [
        { id: "projectTitle", type: "text", label: "Drawing Title", def: "PROJECT / DRAWING TITLE:" },
        { id: "drawnBy", type: "text", label: "Drawn By", def: "DRAWN BY: ________________" },
        { id: "showTitleBlock", type: "chk", label: "ISO Title Block", text: "Show drawing title & approval block" },
        { id: "showCoords", type: "chk", label: "Margin Coordinates", text: "Show grid coordinates (A-D, 1-6)" }
      ],
      academic_double: [
        { id: "subjectText", type: "text", label: "Subject Field", def: "SUBJECT: ______________________________" },
        { id: "dateText", type: "text", label: "Date Field", def: "DATE: ______________" },
        { id: "showHeader", type: "chk", label: "Header Line", text: "Show Subject & Date line" },
        { id: "showFooter", type: "chk", label: "Footer Line", text: "Show Signature & Page No line" }
      ],
      minimal_assignment: [
        { id: "topicTech", type: "text", label: "Lab Topic Header", def: "ASSIGNMENT / LAB TOPIC: ______________________________" },
        { id: "remarksTech", type: "text", label: "Remarks Strip", def: "EVALUATOR'S REMARKS: ________________________________________" },
        { id: "showHeader", type: "chk", label: "Topic Header Bar", text: "Show Topic & Date bar" },
        { id: "showRemarks", type: "chk", label: "Remarks Strip", text: "Show Evaluator Remarks & Signature line" }
      ],
      diploma_seal: [
        { id: "sealText", type: "text", label: "Medal Inscription", def: "★ MERIT ★" },
        { id: "showSeal", type: "chk", label: "Certificate Rosette Seal", text: "Show medal seal with ribbons" }
      ],
      modern_ribbon: [
        { id: "ribbonTitle", type: "text", label: "Presentation Title", def: "PROJECT PRESENTATION / ARCHITECTURAL SHEET" },
        { id: "sheetNo", type: "text", label: "Sheet Number", def: "SHEET NO: A-101" },
        { id: "showHeader", type: "chk", label: "Header Title Ribbon", text: "Show presentation title ribbon" },
        { id: "showRevCol", type: "chk", label: "Revision Column", text: "Show right revision index column" }
      ],
      vintage_scroll: [
        { id: "showPearls", type: "chk", label: "Pearl Bead Chain", text: "Show pearl bead margin chain" },
        { id: "showCrests", type: "chk", label: "Center Crests", text: "Show top & bottom ornamental cartouches" }
      ],
      greek_key: [
        { id: "showCornerRosettes", type: "chk", label: "Corner Medallions", text: "Show decorative corner squares" }
      ]
    };

    const items = subDefs[style];
    if (!items || items.length === 0) {
      container.style.display = "none";
      container.innerHTML = "";
      return;
    }

    container.style.display = "flex";
    let html = `<div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--text-muted); margin-bottom: 2px;">Frame Text & Elements</div>`;
    for (const it of items) {
      if (it.type === "text") {
        const val = state.border[it.id] !== undefined ? state.border[it.id] : it.def;
        html += `
          <div class="control-row" style="margin-bottom: 4px;">
            <div class="control-label"><span>${it.label}</span></div>
            <input type="text" id="border-sub-${it.id}" value="${escapeHtml(String(val || ''))}" style="width: 100%; padding: 6px 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-surface); color: var(--text-main); font-size: 13px;">
          </div>
        `;
      } else {
        const val = state.border[it.id] !== undefined ? state.border[it.id] : true;
        html += `
          <div class="control-row" style="margin-bottom: 4px;">
            <label class="switch-control">
              <span class="switch-label">${it.label}</span>
              <input type="checkbox" id="border-sub-${it.id}" ${val ? "checked" : ""}>
              <div class="switch-track"><div class="switch-thumb"></div></div>
            </label>
          </div>
        `;
      }
    }
    container.innerHTML = html;

    for (const it of items) {
      const el = $("border-sub-" + it.id);
      if (el) {
        if (it.type === "text") {
          el.addEventListener("input", () => {
            state.border[it.id] = el.value;
            refreshCanvas();
          });
        } else {
          el.addEventListener("change", () => {
            state.border[it.id] = el.checked;
            refreshCanvas();
          });
        }
      }
    }
  }

  // ----------------------------------------------------
  // Sync Controls with Current State
  // ----------------------------------------------------
  function syncInspectorControls() {
    $("pageSizeSelect").value = state.pageSize;
    $("customDimRow").style.display = state.pageSize === "custom" ? "block" : "none";
    $("customWidthInput").value = state.width;
    $("customHeightInput").value = state.height;

    $("orientPortraitBtn").classList.toggle("active", state.orientation === "portrait");
    $("orientLandscapeBtn").classList.toggle("active", state.orientation === "landscape");

    // Margins
    const mSlider = $("marginSlider");
    if (mSlider) {
      if (state.unit === "inch") {
        mSlider.min = "0";
        mSlider.max = "2";
        mSlider.step = "0.05";
      } else if (state.unit === "cm") {
        mSlider.min = "0";
        mSlider.max = "5";
        mSlider.step = "0.1";
      } else {
        mSlider.min = "0";
        mSlider.max = "50";
        mSlider.step = "1";
      }
      mSlider.value = state.margin;
    }
    if ($("marginDisplay")) {
      $("marginDisplay").textContent = `${state.margin} ${state.unit}`;
    }

    const curMarginInches = PaperEngine.unitToInches(state.margin, state.unit);
    $$(".segmented-btn[data-margin]").forEach(btn => {
      const btnInches = parseFloat(btn.dataset.margin);
      btn.classList.toggle("active", Math.abs(curMarginInches - btnInches) < 0.08);
    });

    // Spacing
    $("spacingSlider").value = state.spacing;
    $("spacingNumber").value = state.spacing;
    $("spacingDisplay").textContent = state.spacingMode === "size"
      ? `${state.spacing} ${state.unit}`
      : `${state.spacing} / ${state.unit}`;

    // Weight
    $("weightSlider").value = PaperEngine.weightToSlider(state.weight);
    $("weightNumber").value = state.weight;
    $("weightDisplay").textContent = `${state.weight} pt`;

    // Colors
    $("gridColorPicker").value = `#${state.gridColor}`;
    $("bgColorPicker").value = `#${state.bgColor}`;

    $$(".color-swatch-btn[data-color]").forEach(b => {
      b.classList.toggle("active", b.dataset.color.toLowerCase() === state.gridColor.toLowerCase());
    });
    $$(".color-swatch-btn[data-bgcolor]").forEach(b => {
      b.classList.toggle("active", b.dataset.bgcolor.toLowerCase() === state.bgColor.toLowerCase());
    });

    // Multi-page controls in body & footer
    $$("button[data-pages]").forEach(b => {
      b.classList.toggle("active", parseInt(b.dataset.pages, 10) === state.pageCount);
    });
    if ($("pageCountDisplay")) {
      $("pageCountDisplay").textContent = `${state.pageCount} ${state.pageCount === 1 ? 'page' : 'pages'}`;
    }
    if ($("pageStepperInput")) {
      $("pageStepperInput").value = state.pageCount;
    }
    if ($("exportPdfBtnText")) {
      $("exportPdfBtnText").textContent = state.pageCount === 1
        ? "Download PDF (1 Page)"
        : `Download Multi-Page PDF (${state.pageCount} Pages)`;
    }

    // Headers & footers
    $("headerToggle").checked = !!state.headerText;
    $("headerTextInput").style.display = state.headerText ? "block" : "none";
    $("headerTextInput").value = state.headerText;
    $("dateToggle").checked = state.hasDateField;
    $("pageNumToggle").checked = state.hasPageNumbering;

    // Border controls
    if ($("borderStyleSelect")) {
      $("borderStyleSelect").value = state.border.style;
    }
    if ($("borderOptionsContainer")) {
      $("borderOptionsContainer").style.display = state.border.style !== "none" ? "flex" : "none";
      renderBorderSubOptions();
    }
    if ($("borderWeightSlider")) {
      $("borderWeightSlider").value = state.border.weight;
      $("borderWeightNumber").value = state.border.weight;
      $("borderWeightDisplay").textContent = `${state.border.weight} pt`;
    }
    if ($("borderMatchGridColor")) {
      $("borderMatchGridColor").checked = state.border.matchGridColor;
    }
    if ($("borderColorPicker")) {
      $("borderColorPicker").style.display = state.border.matchGridColor ? "none" : "block";
      $("borderColorPicker").value = `#${state.border.color}`;
    }
    if ($("borderInsetSlider")) {
      $("borderInsetSlider").value = state.border.inset;
      $("borderInsetDisplay").textContent = `${state.border.inset} pt`;
    }
  }

  // ----------------------------------------------------
  // Canvas Rendering & Layout
  // ----------------------------------------------------
  function refreshCanvas(autoFit = false) {
    if (!state.current) return;

    // Build raw parameters object for PaperEngine
    const raw = {
      width: state.width,
      height: state.height,
      page_units: state.unit,
      margin: state.margin,
      margin_units: state.unit,
      spacing: state.spacing,
      spacing_units: state.unit,
      sMode: state.spacingMode,
      weight: state.weight,
      gridColor: state.gridColor,
      bgColor: state.bgColor,
      x: { ...state.extras }
    };

    const p = PaperEngine.resolveCommon(raw);

    // Call pattern draw function
    let result;
    try {
      result = state.current.draw(p);
    } catch (e) {
      console.error("Pattern draw error:", e);
      return;
    }

    // Apply borders if enabled
    const borderColor = state.border.matchGridColor ? state.gridColor : state.border.color;
    const finalDl = PaperEngine.applyBorders(p, result.dl, {
      ...state.border,
      color: borderColor
    });

    // Apply header / footer / page numbering preview if enabled
    let canvasDl = finalDl;
    if (state.headerText || state.hasDateField || state.hasPageNumbering) {
      canvasDl = PaperEngine.applyPageAnnotations(p, finalDl, {
        headerText: state.headerText,
        dateField: state.hasDateField,
        pageNumbering: state.hasPageNumbering,
        pageNum: 1,
        pageCount: state.pageCount
      });
    }

    // Update SVG in paper sheet
    const paperSvg = $("paperSvg");
    paperSvg.setAttribute("viewBox", `0 0 ${p.width} ${p.height}`);
    paperSvg.innerHTML = PaperEngine.dlToSvgBody(p, canvasDl);

    // Keep dynamic print stylesheet in sync with page dimensions
    updatePrintStyles(p, state);

    // Update sheet dimensions & background
    const sheet = $("paperSheet");
    sheet.style.width = `${p.width}px`;
    sheet.style.height = `${p.height}px`;
    sheet.style.backgroundColor = `#${p.bgColor}`;

    // Update Scale & Spec Badge
    $("specPageSize").textContent = state.pageSize.toUpperCase();
    $("specDimensions").textContent = `${state.width} × ${state.height} ${state.unit}`;
    $("specSpacing").textContent = state.spacingMode === "size"
      ? `${state.spacing} ${state.unit}`
      : `${state.spacing} / ${state.unit}`;
    $("specLineCount").textContent = `${result.count || result.dl.length} primitives`;

    if (autoFit) {
      fitCanvasToScreen(p.width, p.height);
    } else {
      updateCanvasTransform();
    }
  }

  function fitCanvasToScreen(wPts, hPts) {
    const viewport = $("canvasViewport");
    const vw = viewport.clientWidth - 80;
    const vh = viewport.clientHeight - 80;
    if (vw <= 0 || vh <= 0) return;

    const scaleW = vw / wPts;
    const scaleH = vh / hPts;
    state.zoom = Math.min(scaleW, scaleH, 1.4);
    state.panX = 0;
    state.panY = 0;
    updateCanvasTransform();
  }

  function updateCanvasTransform() {
    const wrapper = $("paperWrapper");
    wrapper.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`;
    $("zoomLevelDisplay").textContent = `${Math.round(state.zoom * 100)}%`;
  }

  // ----------------------------------------------------
  // True-Scale Print Engine
  // ----------------------------------------------------
  function getPrintDimensions(p, state) {
    const preset = PaperEngine.PAGE_SIZES[state.pageSize];
    let wCss, hCss;
    if (preset) {
      const isLandscape = state.orientation === "landscape";
      if (preset.unit === "mm") {
        const w = isLandscape ? preset.mmH : preset.mmW;
        const h = isLandscape ? preset.mmW : preset.mmH;
        wCss = `${w}mm`;
        hCss = `${h}mm`;
      } else {
        const w = isLandscape ? preset.height : preset.width;
        const h = isLandscape ? preset.width : preset.height;
        wCss = `${w}in`;
        hCss = `${h}in`;
      }
    } else {
      wCss = `${state.width}${state.unit}`;
      hCss = `${state.height}${state.unit}`;
    }
    return { wCss, hCss };
  }

  function updatePrintStyles(p, state) {
    let styleEl = $("dynamicPrintStyle");
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "dynamicPrintStyle";
      document.head.appendChild(styleEl);
    }
    const { wCss, hCss } = getPrintDimensions(p, state);
    styleEl.textContent = `
      @media print {
        @page {
          size: ${wCss} ${hCss} !important;
          margin: 0mm !important;
        }
        .print-page {
          width: ${wCss} !important;
          height: ${hCss} !important;
          min-width: ${wCss} !important;
          min-height: ${hCss} !important;
          max-width: ${wCss} !important;
          max-height: ${hCss} !important;
        }
      }
    `;
  }

  function populatePrintContainer() {
    if (!state.current) return;
    const raw = {
      width: state.width, height: state.height, page_units: state.unit,
      margin: state.margin, margin_units: state.unit,
      spacing: state.spacing, spacing_units: state.unit,
      sMode: state.spacingMode, weight: state.weight,
      gridColor: state.gridColor, bgColor: state.bgColor,
      x: { ...state.extras }
    };
    const p = PaperEngine.resolveCommon(raw);
    const r = state.current.draw(p);
    const borderColor = state.border.matchGridColor ? state.gridColor : state.border.color;
    const baseDl = PaperEngine.applyBorders(p, r.dl, {
      ...state.border,
      color: borderColor
    });

    updatePrintStyles(p, state);

    const container = $("printContainer");
    if (!container) return;

    const count = Math.max(1, Math.min(200, parseInt(state.pageCount, 10) || 1));
    let html = "";
    for (let i = 1; i <= count; i++) {
      let pageDl = baseDl;
      if (state.headerText || state.hasDateField || state.hasPageNumbering) {
        pageDl = PaperEngine.applyPageAnnotations(p, pageDl, {
          headerText: state.headerText,
          dateField: state.hasDateField,
          pageNumbering: state.hasPageNumbering,
          pageNum: i,
          pageCount: count
        });
      }
      const svgBody = PaperEngine.dlToSvgBody(p, pageDl);
      html += `
        <div class="print-page">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PaperEngine.fnum(p.width)} ${PaperEngine.fnum(p.height)}" width="100%" height="100%">
            ${svgBody}
          </svg>
        </div>
      `;
    }
    container.innerHTML = html;
  }

  function prepareAndPrint() {
    populatePrintContainer();
    setTimeout(() => {
      window.print();
    }, 40);
  }

  // ----------------------------------------------------
  // Export Handlers (PDF, SVG, PNG, Link)
  // ----------------------------------------------------
  function exportPdf() {
    if (!state.current) return;
    const raw = {
      width: state.width, height: state.height, page_units: state.unit,
      margin: state.margin, margin_units: state.unit,
      spacing: state.spacing, spacing_units: state.unit,
      sMode: state.spacingMode, weight: state.weight,
      gridColor: state.gridColor, bgColor: state.bgColor,
      x: { ...state.extras }
    };
    const p = PaperEngine.resolveCommon(raw);
    const r = state.current.draw(p);
    const borderColor = state.border.matchGridColor ? state.gridColor : state.border.color;
    const finalDl = PaperEngine.applyBorders(p, r.dl, {
      ...state.border,
      color: borderColor
    });

    const pdfBytes = PaperEngine.buildPdf(p, finalDl, state.current.name, {
      pageCount: state.pageCount,
      headerText: state.headerText,
      dateField: state.hasDateField,
      pageNumbering: state.hasPageNumbering
    });

    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const filename = `paperpatterns-${state.current.id}-${state.pageSize}.pdf`;
    triggerDownload(blob, filename);
    showToast(`Exported ${state.pageCount}-page PDF!`);
  }

  function exportSvg() {
    if (!state.current) return;
    const raw = {
      width: state.width, height: state.height, page_units: state.unit,
      margin: state.margin, margin_units: state.unit,
      spacing: state.spacing, spacing_units: state.unit,
      sMode: state.spacingMode, weight: state.weight,
      gridColor: state.gridColor, bgColor: state.bgColor,
      x: { ...state.extras }
    };
    const p = PaperEngine.resolveCommon(raw);
    const r = state.current.draw(p);
    const borderColor = state.border.matchGridColor ? state.gridColor : state.border.color;
    let finalDl = PaperEngine.applyBorders(p, r.dl, {
      ...state.border,
      color: borderColor
    });
    if (state.headerText || state.hasDateField || state.hasPageNumbering) {
      finalDl = PaperEngine.applyPageAnnotations(p, finalDl, {
        headerText: state.headerText,
        dateField: state.hasDateField,
        pageNumbering: state.hasPageNumbering,
        pageNum: 1,
        pageCount: state.pageCount
      });
    }
    const svgStr = PaperEngine.buildSvgString(p, finalDl, state.current.name);

    const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
    const filename = `paperpatterns-${state.current.id}.svg`;
    triggerDownload(blob, filename);
    showToast("Downloaded SVG Vector!");
  }

  function exportPng() {
    if (!state.current) return;
    const raw = {
      width: state.width, height: state.height, page_units: state.unit,
      margin: state.margin, margin_units: state.unit,
      spacing: state.spacing, spacing_units: state.unit,
      sMode: state.spacingMode, weight: state.weight,
      gridColor: state.gridColor, bgColor: state.bgColor,
      x: { ...state.extras }
    };
    const p = PaperEngine.resolveCommon(raw);
    const r = state.current.draw(p);
    const borderColor = state.border.matchGridColor ? state.gridColor : state.border.color;
    let finalDl = PaperEngine.applyBorders(p, r.dl, {
      ...state.border,
      color: borderColor
    });
    if (state.headerText || state.hasDateField || state.hasPageNumbering) {
      finalDl = PaperEngine.applyPageAnnotations(p, finalDl, {
        headerText: state.headerText,
        dateField: state.hasDateField,
        pageNumbering: state.hasPageNumbering,
        pageNum: 1,
        pageCount: state.pageCount
      });
    }
    const svgStr = PaperEngine.buildSvgString(p, finalDl, state.current.name);

    showToast("Rendering 300 DPI image...");
    PaperEngine.rasterizeToBlob(svgStr, p.width, p.height, 300)
      .then(blob => {
        const filename = `paperpatterns-${state.current.id}.png`;
        triggerDownload(blob, filename);
        showToast("Downloaded 300 DPI PNG!");
      })
      .catch(err => {
        showToast("PNG export failed: " + err.message);
      });
  }

  function copyShareLink() {
    const qs = buildQueryString();
    const url = `${location.origin}${location.pathname}#${state.current.id}?${qs}`;
    navigator.clipboard.writeText(url)
      .then(() => showToast("Shareable link copied to clipboard!"))
      .catch(() => showToast("Failed to copy link"));
  }

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  function showToast(msg) {
    const toast = $("toastNotice");
    toast.textContent = msg;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2800);
  }

  // ----------------------------------------------------
  // Event Listeners Wiring
  // ----------------------------------------------------
  function setupEventListeners() {
    // Window hash navigation
    window.addEventListener("hashchange", route);

    // Brand click (home)
    $("brandHome").addEventListener("click", () => {
      state.activeCategory = "all";
      $$(".cat-pill").forEach(p => p.classList.toggle("active", p.dataset.cat === "all"));
      renderPatternCatalog();
    });

    // Pattern search input
    const searchInput = $("patternSearch");
    searchInput.addEventListener("input", (e) => {
      state.searchQuery = e.target.value.trim();
      renderPatternCatalog();
    });

    // Keyboard shortcuts
    window.addEventListener("keydown", (e) => {
      if (e.key === "/" && document.activeElement !== searchInput) {
        e.preventDefault();
        searchInput.focus();
      } else if (e.key === "Escape") {
        searchInput.blur();
        searchInput.value = "";
        state.searchQuery = "";
        renderPatternCatalog();
      } else if (e.key === "+" || e.key === "=") {
        if (document.activeElement.tagName !== "INPUT") {
          e.preventDefault();
          state.zoom = Math.min(state.zoom * 1.15, 3.0);
          updateCanvasTransform();
        }
      } else if (e.key === "-" || e.key === "_") {
        if (document.activeElement.tagName !== "INPUT") {
          e.preventDefault();
          state.zoom = Math.max(state.zoom / 1.15, 0.2);
          updateCanvasTransform();
        }
      } else if (e.key === "0") {
        if (document.activeElement.tagName !== "INPUT") {
          e.preventDefault();
          const p = PaperEngine.resolveCommon({
            width: state.width, height: state.height, page_units: state.unit,
            margin: state.margin, margin_units: state.unit,
            spacing: state.spacing, spacing_units: state.unit,
            sMode: state.spacingMode, weight: state.weight,
            gridColor: state.gridColor, bgColor: state.bgColor
          });
          fitCanvasToScreen(p.width, p.height);
        }
      }
    });

    // Units toggle
    $$(".segmented-control button[data-unit]").forEach(btn => {
      btn.addEventListener("click", () => setUnit(btn.dataset.unit));
    });

    // Pattern catalog selection & favorite toggle
    $("patternGrid").addEventListener("click", (e) => {
      const favBtn = e.target.closest(".card-fav-btn");
      if (favBtn) {
        e.stopPropagation();
        const favId = favBtn.dataset.favid;
        if (state.favorites.has(favId)) {
          state.favorites.delete(favId);
        } else {
          state.favorites.add(favId);
        }
        savePreferences();
        renderPatternCatalog();
        return;
      }

      const card = e.target.closest(".pattern-card");
      if (!card) return;
      const genId = card.dataset.id;
      const gen = window.PATTERNS.find(p => p.id === genId);
      if (gen) selectGenerator(gen);
    });

    // Quick picks click
    $("quickPicksList").addEventListener("click", (e) => {
      const btn = e.target.closest(".quick-pick-btn");
      if (!btn || !state.current || !state.current.picks) return;
      const pick = state.current.picks[parseInt(btn.dataset.pickidx, 10)];
      if (pick && pick.set) {
        applyQueryParams(new URLSearchParams(pick.set).toString());
        syncInspectorControls();
        refreshCanvas();
      }
    });

    // Page preset dropdown
    $("pageSizeSelect").addEventListener("change", (e) => {
      applyPagePreset(e.target.value);
      syncInspectorControls();
      refreshCanvas(true);
    });

    $("customWidthInput").addEventListener("input", (e) => {
      state.width = parseFloat(e.target.value) || state.width;
      refreshCanvas();
    });
    $("customHeightInput").addEventListener("input", (e) => {
      state.height = parseFloat(e.target.value) || state.height;
      refreshCanvas();
    });

    // Orientation toggle
    $("orientPortraitBtn").addEventListener("click", () => {
      if (state.orientation !== "portrait") {
        state.orientation = "portrait";
        const t = state.width; state.width = Math.min(t, state.height); state.height = Math.max(t, state.height);
        syncInspectorControls();
        refreshCanvas(true);
      }
    });
    $("orientLandscapeBtn").addEventListener("click", () => {
      if (state.orientation !== "landscape") {
        state.orientation = "landscape";
        const t = state.width; state.width = Math.max(t, state.height); state.height = Math.min(t, state.height);
        syncInspectorControls();
        refreshCanvas(true);
      }
    });

    // Margins
    $$(".segmented-btn[data-margin]").forEach(btn => {
      btn.addEventListener("click", () => {
        $$(".segmented-btn[data-margin]").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        let mInches = parseFloat(btn.dataset.margin);
        state.margin = Math.round(PaperEngine.inchesToUnit(mInches, state.unit) * 100) / 100;
        syncInspectorControls();
        refreshCanvas();
      });
    });

    $("marginSlider").addEventListener("input", (e) => {
      state.margin = parseFloat(e.target.value) || 0;
      $("marginDisplay").textContent = `${state.margin} ${state.unit}`;
      refreshCanvas();
    });

    // Spacing
    $("spacingSlider").addEventListener("input", (e) => {
      state.spacing = parseFloat(e.target.value) || 1;
      $("spacingNumber").value = state.spacing;
      $("spacingDisplay").textContent = state.spacingMode === "size"
        ? `${state.spacing} ${state.unit}`
        : `${state.spacing} / ${state.unit}`;
      refreshCanvas();
    });
    $("spacingNumber").addEventListener("input", (e) => {
      state.spacing = parseFloat(e.target.value) || 1;
      $("spacingSlider").value = state.spacing;
      $("spacingDisplay").textContent = state.spacingMode === "size"
        ? `${state.spacing} ${state.unit}`
        : `${state.spacing} / ${state.unit}`;
      refreshCanvas();
    });

    // Line weight
    $("weightSlider").addEventListener("input", (e) => {
      state.weight = PaperEngine.sliderToWeight(e.target.value);
      $("weightNumber").value = Math.round(state.weight * 100) / 100;
      $("weightDisplay").textContent = `${Math.round(state.weight * 100) / 100} pt`;
      refreshCanvas();
    });
    $("weightNumber").addEventListener("input", (e) => {
      state.weight = parseFloat(e.target.value) || 0.5;
      $("weightSlider").value = PaperEngine.weightToSlider(state.weight);
      $("weightDisplay").textContent = `${state.weight} pt`;
      refreshCanvas();
    });

    // Colors
    $$(".color-swatch-btn[data-color]").forEach(btn => {
      btn.addEventListener("click", () => {
        state.gridColor = btn.dataset.color;
        syncInspectorControls();
        refreshCanvas();
      });
    });
    $("gridColorPicker").addEventListener("input", (e) => {
      state.gridColor = PaperEngine.checkColor(e.target.value, state.gridColor);
      syncInspectorControls();
      refreshCanvas();
    });

    $$(".color-swatch-btn[data-bgcolor]").forEach(btn => {
      btn.addEventListener("click", () => {
        state.bgColor = btn.dataset.bgcolor;
        syncInspectorControls();
        refreshCanvas();
      });
    });
    $("bgColorPicker").addEventListener("input", (e) => {
      state.bgColor = PaperEngine.checkColor(e.target.value, state.bgColor);
      syncInspectorControls();
      refreshCanvas();
    });

    // Border controls
    if ($("borderStyleSelect")) {
      $("borderStyleSelect").addEventListener("change", (e) => {
        state.border.style = e.target.value;
        $("borderOptionsContainer").style.display = state.border.style !== "none" ? "flex" : "none";
        renderBorderSubOptions();
        refreshCanvas();
      });
    }

    if ($("borderWeightSlider")) {
      $("borderWeightSlider").addEventListener("input", (e) => {
        state.border.weight = parseFloat(e.target.value) || 1;
        $("borderWeightNumber").value = state.border.weight;
        $("borderWeightDisplay").textContent = `${state.border.weight} pt`;
        refreshCanvas();
      });
      $("borderWeightNumber").addEventListener("input", (e) => {
        state.border.weight = parseFloat(e.target.value) || 1;
        $("borderWeightSlider").value = state.border.weight;
        $("borderWeightDisplay").textContent = `${state.border.weight} pt`;
        refreshCanvas();
      });
    }

    if ($("borderMatchGridColor")) {
      $("borderMatchGridColor").addEventListener("change", (e) => {
        state.border.matchGridColor = e.target.checked;
        $("borderColorPicker").style.display = e.target.checked ? "none" : "block";
        refreshCanvas();
      });
    }

    if ($("borderColorPicker")) {
      $("borderColorPicker").addEventListener("input", (e) => {
        state.border.color = PaperEngine.checkColor(e.target.value, state.border.color);
        refreshCanvas();
      });
    }

    if ($("borderInsetSlider")) {
      $("borderInsetSlider").addEventListener("input", (e) => {
        state.border.inset = parseFloat(e.target.value) || 0;
        $("borderInsetDisplay").textContent = `${state.border.inset} pt`;
        refreshCanvas();
      });
    }

    // Multi-page options (body & footer controls)
    $$("button[data-pages]").forEach(btn => {
      btn.addEventListener("click", () => {
        setPageCount(btn.dataset.pages);
      });
    });

    if ($("pageStepMinus")) {
      $("pageStepMinus").addEventListener("click", () => {
        setPageCount(state.pageCount - 1);
      });
    }
    if ($("pageStepPlus")) {
      $("pageStepPlus").addEventListener("click", () => {
        setPageCount(state.pageCount + 1);
      });
    }
    if ($("pageStepperInput")) {
      $("pageStepperInput").addEventListener("input", (e) => {
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val) && val >= 1) {
          setPageCount(val);
        }
      });
      $("pageStepperInput").addEventListener("change", (e) => {
        setPageCount(e.target.value);
      });
    }

    $("headerToggle").addEventListener("change", (e) => {
      $("headerTextInput").style.display = e.target.checked ? "block" : "none";
      if (!e.target.checked) state.headerText = "";
      else state.headerText = $("headerTextInput").value || "Project Notes";
      refreshCanvas();
    });
    $("headerTextInput").addEventListener("input", (e) => {
      state.headerText = e.target.value;
      refreshCanvas();
    });

    $("dateToggle").addEventListener("change", (e) => {
      state.hasDateField = e.target.checked;
      refreshCanvas();
    });
    $("pageNumToggle").addEventListener("change", (e) => {
      state.hasPageNumbering = e.target.checked;
      refreshCanvas();
    });

    // Drawer toggle
    const toggleDrawer = () => {
      $("patternDrawer").classList.toggle("collapsed");
    };
    $("collapseDrawerBtn").addEventListener("click", toggleDrawer);
    $("toggleDrawerHudBtn").addEventListener("click", toggleDrawer);

    // Canvas Zoom & Pan
    $("zoomInBtn").addEventListener("click", () => {
      state.zoom = Math.min(state.zoom * 1.2, 3.0);
      updateCanvasTransform();
    });
    $("zoomOutBtn").addEventListener("click", () => {
      state.zoom = Math.max(state.zoom / 1.2, 0.2);
      updateCanvasTransform();
    });
    $("zoomFitBtn").addEventListener("click", () => {
      const p = PaperEngine.resolveCommon({
        width: state.width, height: state.height, page_units: state.unit,
        margin: state.margin, margin_units: state.unit,
        spacing: state.spacing, spacing_units: state.unit,
        sMode: state.spacingMode, weight: state.weight,
        gridColor: state.gridColor, bgColor: state.bgColor
      });
      fitCanvasToScreen(p.width, p.height);
    });

    const viewport = $("canvasViewport");
    viewport.addEventListener("wheel", (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      state.zoom = Math.min(Math.max(state.zoom * zoomFactor, 0.15), 3.5);
      updateCanvasTransform();
    }, { passive: false });

    viewport.addEventListener("mousedown", (e) => {
      if (e.button === 0 || e.button === 1) { // Left or Middle click pan
        state.isPanning = true;
        state.startPanX = e.clientX - state.panX;
        state.startPanY = e.clientY - state.panY;
      }
    });
    window.addEventListener("mousemove", (e) => {
      if (state.isPanning) {
        state.panX = e.clientX - state.startPanX;
        state.panY = e.clientY - state.startPanY;
        updateCanvasTransform();
      }
    });
    window.addEventListener("mouseup", () => {
      state.isPanning = false;
    });

    // Export & Print Actions
    $("exportPdfBtn").addEventListener("click", exportPdf);
    $("exportSvgBtn").addEventListener("click", exportSvg);
    $("exportPngBtn").addEventListener("click", exportPng);
    $("copyLinkBtn").addEventListener("click", copyShareLink);
    $("directPrintBtn").addEventListener("click", prepareAndPrint);

    // Ensure print container is populated if user invokes browser print directly (Ctrl+P / Menu)
    window.addEventListener("beforeprint", populatePrintContainer);

    // Download standalone offline app (if present)
    const downloadAppBtn = $("downloadAppBtn");
    if (downloadAppBtn) {
      downloadAppBtn.addEventListener("click", () => {
        showToast("Preparing single-file offline bundle...");
        // Fetch index.html, css/styles.css, js/engine.js, js/patterns.js, js/app.js and inline into one file
        Promise.all([
          fetch("css/styles.css").then(r => r.text()),
          fetch("js/engine.js").then(r => r.text()),
          fetch("js/patterns.js").then(r => r.text()),
          fetch("js/app.js").then(r => r.text())
        ]).then(([css, engine, patterns, app]) => {
          const bundle = `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>PaperPatterns · Offline Bundle</title>
  <style>${css}</style>
</head>
<body>
  ${$("app").outerHTML}
  <script>${engine}<\/script>
  <script>${patterns}<\/script>
  <script>${app}<\/script>
</body>
</html>`;
          const b = new Blob([bundle], { type: "text/html;charset=utf-8" });
          triggerDownload(b, "paperpatterns-offline.html");
          showToast("Downloaded single-file offline app!");
        }).catch(err => {
          showToast("Error creating offline bundle: " + err.message);
        });
      });
    }
  }

  // Start app when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
