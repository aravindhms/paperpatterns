/**
 * PaperPatterns Core Vector & Document Generation Engine
 * Hand-crafted zero-dependency vector engine and PDF 1.4 binary compiler.
 * Based on vector IR algorithms by Kevin MacLeod (CC0 1.0 Public Domain).
 */

(function () {
  "use strict";

  const CM_PER_INCH = 2.54;
const MM_PER_INCH = 25.4;
const POINTS_PER_INCH = 72;
const KAPPA = 0.5522847498; // Cubic Bézier circle approximation constant

// Standard paper dimensions in inches (width, height in portrait)
const PAGE_SIZES = {
  a4: { name: "A4", width: 8.2677, height: 11.6929, unit: "mm", mmW: 210, mmH: 297 },
  a5: { name: "A5", width: 5.8268, height: 8.2677, unit: "mm", mmW: 148, mmH: 210 },
  a3: { name: "A3", width: 11.6929, height: 16.5354, unit: "mm", mmW: 297, mmH: 420 },
  letter: { name: "US Letter", width: 8.5, height: 11.0, unit: "in", mmW: 215.9, mmH: 279.4 },
  legal: { name: "US Legal", width: 8.5, height: 14.0, unit: "in", mmW: 215.9, mmH: 355.6 },
  tabloid: { name: "Tabloid / Ledger", width: 11.0, height: 17.0, unit: "in", mmW: 279.4, mmH: 431.8 },
  executive: { name: "Executive", width: 7.25, height: 10.5, unit: "in", mmW: 184.15, mmH: 266.7 },
  b5: { name: "B5 (JIS)", width: 7.165, height: 10.118, unit: "mm", mmW: 182, mmH: 257 }
};

function correct(value, min, max) {
  if (value === undefined || value === null || value === "") return min;
  let s = String(value).replace(/,/g, ".").replace(/\.\./g, ".").replace(/[^0-9.\-]/g, "");
  let n = parseFloat(s);
  if (!isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function checkColor(input, fallback) {
  if (input) {
    const clean = String(input).replace(/^#/, "").trim();
    if (/^[0-9a-fA-F]{6}$/.test(clean)) return clean.toLowerCase();
  }
  return fallback;
}

function fnum(n) {
  return (Math.round(n * 100) / 100).toString();
}

function hexToRgbTriplet(hex) {
  const clean = checkColor(hex, "000000");
  return fnum(parseInt(clean.slice(0, 2), 16) / 255) + " " +
         fnum(parseInt(clean.slice(2, 4), 16) / 255) + " " +
         fnum(parseInt(clean.slice(4, 6), 16) / 255);
}

function unitToInches(val, unit) {
  const v = parseFloat(val) || 0;
  if (unit === "mm") return v / MM_PER_INCH;
  if (unit === "cm") return v / CM_PER_INCH;
  return v; // default inches
}

function inchesToUnit(inches, unit) {
  if (unit === "mm") return inches * MM_PER_INCH;
  if (unit === "cm") return inches * CM_PER_INCH;
  return inches;
}

// Convert spacing value + unit into points offset
function perOffset(v, units) {
  v = correct(v, 0.1, 100);
  if (units === "mm") return 72 / (v * (MM_PER_INCH / 10));
  if (units === "cm") return 72 / (v * CM_PER_INCH);
  return 72 / v;
}

// Convert a size value + unit into points
function sizePts(v, units, min, max) {
  v = correct(v, min !== undefined ? min : 0.05, max !== undefined ? max : 500);
  if (units === "mm") v /= MM_PER_INCH;
  else if (units === "cm") v /= CM_PER_INCH;
  return v * 72;
}

// Common parameter resolution
function resolveCommon(raw) {
  let width = correct(raw.width, 0.5, 500);
  let height = correct(raw.height, 0.5, 500);

  if (raw.page_units === "mm") {
    width /= MM_PER_INCH;
    height /= MM_PER_INCH;
  } else if (raw.page_units === "cm") {
    width /= CM_PER_INCH;
    height /= CM_PER_INCH;
  }
  width *= 72;
  height *= 72;

  let margin = correct(raw.margin, 0, 50);
  if (raw.margin_units === "mm") margin /= MM_PER_INCH;
  else if (raw.margin_units === "cm") margin /= CM_PER_INCH;

  // Margin safety clamp: left+right margins cannot exceed 60% of page dimension
  const maxMarginInches = Math.min(width, height) * 0.3 / 72;
  if (margin > maxMarginInches || margin < 0) {
    margin = Math.min(0.5, maxMarginInches);
  }

  const sMin = raw.sMin !== undefined ? raw.sMin : 0.01;
  const sMax = raw.sMax !== undefined ? raw.sMax : 500;
  let spacing = correct(raw.spacing, sMin, sMax);
  let offset;

  if (raw.sMode === "size") {
    if (raw.spacing_units === "mm") spacing /= MM_PER_INCH;
    else if (raw.spacing_units === "cm") spacing /= CM_PER_INCH;
    offset = spacing * 72;
  } else {
    let perInch = spacing;
    if (raw.spacing_units === "mm") perInch = (spacing / 10) * CM_PER_INCH; // lines per cm
    else if (raw.spacing_units === "cm") perInch = spacing * CM_PER_INCH;
    offset = 72 / perInch;
  }

  // Density safety clamp: prevent sub-millimeter offsets that crash SVG DOM / memory
  offset = Math.max(3.5, offset);

  return {
    width: width,
    height: height,
    margin: margin,
    offset: offset,
    weight: correct(raw.weight, 0.05, 30),
    gridColor: checkColor(raw.gridColor, "3a5fcd"),
    bgColor: checkColor(raw.bgColor, "ffffff"),
    x: raw.x || {},
    meta: raw.meta || {}
  };
}

// Rectangular-grid layout helper (centered leftover margins)
function gridLayout(p) {
  const usableW = p.width - p.margin * 144;
  const usableH = p.height - p.margin * 144;
  const nx = Math.floor(usableW / p.offset);
  const ny = Math.floor(usableH / p.offset);
  return {
    nx: nx,
    ny: ny,
    xStart: (p.width - p.offset * nx) / 2,
    yStart: (p.height - p.offset * ny) / 2,
    ok: nx >= 0 && ny >= 0
  };
}

// Helvetica AFM widths for chars 32..126 (thousandths of em)
const HELV_W = [
  278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,
  556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,
  1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,
  667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,
  333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,
  556,556,333,278,278,556,500,722,500,500,500,334,260,334,584
];

function textWidthPts(s, size) {
  let w = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    w += (c >= 32 && c <= 126) ? HELV_W[c - 32] : 556;
  }
  return (w / 1000) * size;
}

function pdfEscape(s) {
  return String(s).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

// Line-thickness slider mapping
function sliderToWeight(v) {
  v = Number(v);
  if (v >= 100) return (v - 100) * 0.15 + 2;
  if (v >= 50) return (v - 50) * 0.034 + 0.7;
  return v * (0.7 / 50) + 0.05;
}

function weightToSlider(w) {
  w = Number(w);
  let v;
  if (w >= 2) v = (w - 2) / 0.15 + 100;
  else if (w >= 0.7) v = (w - 0.7) / 0.034 + 50;
  else v = (w - 0.05) / (0.7 / 50);
  return Math.round(Math.min(200, Math.max(0, v)));
}

// ---------- Display list -> PDF content stream ops ----------
function dlToPdfOps(p, dl) {
  const ops = [];
  ops.push(hexToRgbTriplet(p.bgColor) + " rg");
  ops.push("0 0 " + fnum(p.width) + " " + fnum(p.height) + " re f");
  let color = p.gridColor, w = p.weight;
  ops.push(fnum(w) + " w");
  ops.push(hexToRgbTriplet(color) + " RG");
  ops.push(hexToRgbTriplet(color) + " rg");

  for (const pr of dl) {
    const t = pr[0];
    if (t === "L") {
      ops.push(fnum(pr[1]) + " " + fnum(pr[2]) + " m " +
               fnum(pr[3]) + " " + fnum(pr[4]) + " l S");
    } else if (t === "P") {
      const pts = pr[1];
      let s = fnum(pts[0]) + " " + fnum(pts[1]) + " m";
      for (let i = 2; i < pts.length; i += 2) {
        s += " " + fnum(pts[i]) + " " + fnum(pts[i + 1]) + " l";
      }
      ops.push(s + (pr[2] ? " h S" : " S"));
    } else if (t === "D") {
      const x = pr[1], y = pr[2], r = pr[3], k = KAPPA * r;
      ops.push(
        fnum(x + r) + " " + fnum(y) + " m " +
        fnum(x + r) + " " + fnum(y + k) + " " + fnum(x + k) + " " + fnum(y + r) + " " + fnum(x) + " " + fnum(y + r) + " c " +
        fnum(x - k) + " " + fnum(y + r) + " " + fnum(x - r) + " " + fnum(y + k) + " " + fnum(x - r) + " " + fnum(y) + " c " +
        fnum(x - r) + " " + fnum(y - k) + " " + fnum(x - k) + " " + fnum(y - r) + " " + fnum(x) + " " + fnum(y - r) + " c " +
        fnum(x + k) + " " + fnum(y - r) + " " + fnum(x + r) + " " + fnum(y - k) + " " + fnum(x + r) + " " + fnum(y) + " c f"
      );
    } else if (t === "C") {
      const x = pr[1], y = pr[2], r = pr[3], k = KAPPA * r;
      ops.push(
        fnum(x + r) + " " + fnum(y) + " m " +
        fnum(x + r) + " " + fnum(y + k) + " " + fnum(x + k) + " " + fnum(y + r) + " " + fnum(x) + " " + fnum(y + r) + " c " +
        fnum(x - k) + " " + fnum(y + r) + " " + fnum(x - r) + " " + fnum(y + k) + " " + fnum(x - r) + " " + fnum(y) + " c " +
        fnum(x - r) + " " + fnum(y - k) + " " + fnum(x - k) + " " + fnum(y - r) + " " + fnum(x) + " " + fnum(y - r) + " c " +
        fnum(x + k) + " " + fnum(y - r) + " " + fnum(x + r) + " " + fnum(y - k) + " " + fnum(x + r) + " " + fnum(y) + " c S"
      );
    } else if (t === "T") {
      const size = pr[3], str = String(pr[4]);
      let x = pr[1];
      const tw = textWidthPts(str, size);
      if (pr[5] === "c") x -= tw / 2;
      else if (pr[5] === "r") x -= tw;
      const fontRef = pr[6] === "s" ? "/F2" : "/F1";
      ops.push("BT " + fontRef + " " + fnum(size) + " Tf " +
        fnum(x) + " " + fnum(pr[2]) + " Td (" + pdfEscape(str) + ") Tj ET");
    } else if (t === "R") {
      ops.push(fnum(pr[1]) + " " + fnum(pr[2]) + " " +
               fnum(pr[3]) + " " + fnum(pr[4]) + " re f");
    } else if (t === "S") {
      if (pr[1] !== color) {
        color = pr[1];
        ops.push(hexToRgbTriplet(color) + " RG");
        ops.push(hexToRgbTriplet(color) + " rg");
      }
      if (pr[2] !== w) { w = pr[2]; ops.push(fnum(w) + " w"); }
      const dash = pr[3] || null;
      ops.push(dash ? "[" + dash.map(fnum).join(" ") + "] 0 d" : "[] 0 d");
    }
  }
  return ops;
}

// ---------- Enhanced PDF Assembly (Multi-page, header/footer support) ----------
function buildPdf(p, dl, title, options = {}) {
  const pageCount = Math.max(1, Math.min(200, parseInt(options.pageCount, 10) || 1));
  const hasPageNumbering = !!options.pageNumbering;
  const headerText = options.headerText || "";
  const dateField = !!options.dateField;
  const now = new Date();
  const z = (n) => String(n).padStart(2, "0");
  const pdfDate = "D:" + now.getUTCFullYear() + z(now.getUTCMonth() + 1) +
    z(now.getUTCDate()) + z(now.getUTCHours()) + z(now.getUTCMinutes()) +
    z(now.getUTCSeconds()) + "+00'00'";
  const safeTitle = (title || "Pattern").replace(/[\\()]/g, "");

  // Base display list ops
  const baseOps = dlToPdfOps(p, dl);

  // If pages are identical with no unique page numbers, we reuse a single stream
  const isIdentical = !hasPageNumbering && pageCount > 1;

  const objects = [];
  // We'll fill objects dynamically and compute xrefs accurately
  // Obj 1: Catalog
  // Obj 2: Pages root
  // Obj 3.. (3 + pageCount - 1): Page objects
  // Obj: Font F1 (Helvetica)
  // Obj: Font F2 (Symbol)
  // Obj: Content streams
  // Obj: Info

  const fontF1Obj = 5;
  const fontF2Obj = 6;

  if (isIdentical || pageCount === 1) {
    let finalOps = [...baseOps];
    if (headerText || dateField) {
      finalOps.push("0.2 0.2 0.2 RG 0.2 0.2 0.2 rg 0.7 w [] 0 d");
      const m = p.margin * 72;
      const topY = p.height - Math.max(20, m - 12);
      if (headerText) {
        finalOps.push("BT /F1 9 Tf " + fnum(m) + " " + fnum(topY) + " Td (" + pdfEscape(headerText) + ") Tj ET");
      }
      if (dateField) {
        finalOps.push("BT /F1 9 Tf " + fnum(p.width - m - 70) + " " + fnum(topY) + " Td (Date: ________) Tj ET");
      }
    }
    const stream = finalOps.join("\n");
    const streamObjId = 4;

    const pageKids = [];
    const pageObjects = [];
    let curObjId = 7; // after fonts (5, 6)

    for (let i = 0; i < pageCount; i++) {
      const pageId = curObjId++;
      pageKids.push(pageId + " 0 R");
      pageObjects.push({
        id: pageId,
        body: "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + fnum(p.width) + " " +
              fnum(p.height) + "] /Contents " + streamObjId + " 0 R /Resources " +
              "<< /Font << /F1 5 0 R /F2 6 0 R >> >> >>"
      });
    }

    const infoObjId = curObjId++;

    const objMap = [
      { id: 1, body: "<< /Type /Catalog /Pages 2 0 R >>" },
      { id: 2, body: "<< /Type /Pages /Kids [" + pageKids.join(" ") + "] /Count " + pageCount + " >>" },
      { id: 4, body: "<< /Length " + stream.length + " >>\nstream\n" + stream + "\nendstream" },
      { id: 5, body: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>" },
      { id: 6, body: "<< /Type /Font /Subtype /Type1 /BaseFont /Symbol >>" },
      ...pageObjects,
      { id: infoObjId, body: "<< /Title (" + safeTitle + ") /Author (PaperPatterns) " +
        "/Creator (https://incompetech.com/graphpaper/) " +
        "/Subject (" + safeTitle + ") /CreationDate (" + pdfDate + ") >>" }
    ];

    objMap.sort((a, b) => a.id - b.id);

    let out = "%PDF-1.4\n";
    const offsets = [];
    const maxId = objMap[objMap.length - 1].id;
    const offsetMap = {};

    for (const item of objMap) {
      offsetMap[item.id] = out.length;
      out += item.id + " 0 obj\n" + item.body + "\nendobj\n";
    }

    const xrefPos = out.length;
    out += "xref\n0 " + (maxId + 1) + "\n0000000000 65535 f \n";
    for (let i = 1; i <= maxId; i++) {
      const off = offsetMap[i] || 0;
      out += String(off).padStart(10, "0") + " 00000 n \n";
    }
    out += "trailer\n<< /Size " + (maxId + 1) + " /Root 1 0 R /Info " + infoObjId + " 0 R >>\nstartxref\n" + xrefPos + "\n%%EOF";

    const bytes = new Uint8Array(out.length);
    for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
    return bytes;
  }

  // Multi-page with individual page numbers
  const pageKids = [];
  const generatedPageObjs = [];
  const streamObjs = [];
  let curObjId = 7;

  for (let i = 1; i <= pageCount; i++) {
    const pageId = curObjId++;
    const streamId = curObjId++;
    pageKids.push(pageId + " 0 R");

    let pageOps = [...baseOps];
    const m = p.margin * 72;
    pageOps.push("0.3 0.3 0.3 RG 0.3 0.3 0.3 rg 0.7 w [] 0 d");

    if (headerText || dateField) {
      const topY = p.height - Math.max(18, m - 10);
      if (headerText) {
        pageOps.push("BT /F1 9 Tf " + fnum(m) + " " + fnum(topY) + " Td (" + pdfEscape(headerText) + ") Tj ET");
      }
      if (dateField) {
        pageOps.push("BT /F1 9 Tf " + fnum(p.width - m - 70) + " " + fnum(topY) + " Td (Date: ________) Tj ET");
      }
    }

    if (hasPageNumbering) {
      const bottomY = Math.max(14, m - 12);
      const pageStr = `${i} / ${pageCount}`;
      const tw = textWidthPts(pageStr, 8);
      const px = (p.width - tw) / 2;
      pageOps.push("BT /F1 8 Tf " + fnum(px) + " " + fnum(bottomY) + " Td (" + pdfEscape(pageStr) + ") Tj ET");
    }

    const stext = pageOps.join("\n");
    streamObjs.push({
      id: streamId,
      body: "<< /Length " + stext.length + " >>\nstream\n" + stext + "\nendstream"
    });

    generatedPageObjs.push({
      id: pageId,
      body: "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + fnum(p.width) + " " +
            fnum(p.height) + "] /Contents " + streamId + " 0 R /Resources " +
            "<< /Font << /F1 5 0 R /F2 6 0 R >> >> >>"
    });
  }

  const infoObjId = curObjId++;
  const allObjects = [
    { id: 1, body: "<< /Type /Catalog /Pages 2 0 R >>" },
    { id: 2, body: "<< /Type /Pages /Kids [" + pageKids.join(" ") + "] /Count " + pageCount + " >>" },
    { id: 5, body: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>" },
    { id: 6, body: "<< /Type /Font /Subtype /Type1 /BaseFont /Symbol >>" },
    ...generatedPageObjs,
    ...streamObjs,
    { id: infoObjId, body: "<< /Title (" + safeTitle + ") /Author (PaperPatterns) " +
      "/Creator (https://incompetech.com/graphpaper/) " +
      "/Subject (" + safeTitle + ") /CreationDate (" + pdfDate + ") >>" }
  ];

  allObjects.sort((a, b) => a.id - b.id);

  let out = "%PDF-1.4\n";
  const maxId = allObjects[allObjects.length - 1].id;
  const offsetMap = {};

  for (const item of allObjects) {
    offsetMap[item.id] = out.length;
    out += item.id + " 0 obj\n" + item.body + "\nendobj\n";
  }

  const xrefPos = out.length;
  out += "xref\n0 " + (maxId + 1) + "\n0000000000 65535 f \n";
  for (let i = 1; i <= maxId; i++) {
    const off = offsetMap[i] || 0;
    out += String(off).padStart(10, "0") + " 00000 n \n";
  }
  out += "trailer\n<< /Size " + (maxId + 1) + " /Root 1 0 R /Info " + infoObjId + " 0 R >>\nstartxref\n" + xrefPos + "\n%%EOF";

  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
  return bytes;
}

// ---------- Display list -> SVG body (y flipped) ----------
function dlToSvgBody(p, dl) {
  const H = p.height;
  let body = '<rect x="0" y="0" width="' + fnum(p.width) + '" height="' +
    fnum(H) + '" fill="#' + p.bgColor + '"/>';

  let color = p.gridColor, w = p.weight, dash = null;
  let strokeD = "", fillD = "";

  function flushStroke() {
    if (strokeD) {
      body += '<path d="' + strokeD + '" stroke="#' + color +
        '" stroke-width="' + fnum(w) + '"' +
        (dash ? ' stroke-dasharray="' + dash.map(fnum).join(" ") + '"' : "") +
        ' fill="none"/>';
      strokeD = "";
    }
  }
  function flushFill() {
    if (fillD) {
      body += '<path d="' + fillD + '" fill="#' + color + '"/>';
      fillD = "";
    }
  }

  for (const pr of dl) {
    const t = pr[0];
    if (t === "L") {
      strokeD += "M" + fnum(pr[1]) + " " + fnum(H - pr[2]) +
                 "L" + fnum(pr[3]) + " " + fnum(H - pr[4]);
    } else if (t === "P") {
      const pts = pr[1];
      strokeD += "M" + fnum(pts[0]) + " " + fnum(H - pts[1]);
      for (let i = 2; i < pts.length; i += 2) {
        strokeD += "L" + fnum(pts[i]) + " " + fnum(H - pts[i + 1]);
      }
      if (pr[2]) strokeD += "Z";
    } else if (t === "D") {
      const x = pr[1], y = H - pr[2], r = pr[3];
      fillD += "M" + fnum(x - r) + " " + fnum(y) +
        "a" + fnum(r) + " " + fnum(r) + " 0 1 0 " + fnum(2 * r) + " 0" +
        "a" + fnum(r) + " " + fnum(r) + " 0 1 0 " + fnum(-2 * r) + " 0Z";
    } else if (t === "C") {
      const x = pr[1], y = H - pr[2], r = pr[3];
      strokeD += "M" + fnum(x - r) + " " + fnum(y) +
        "a" + fnum(r) + " " + fnum(r) + " 0 1 0 " + fnum(2 * r) + " 0" +
        "a" + fnum(r) + " " + fnum(r) + " 0 1 0 " + fnum(-2 * r) + " 0";
    } else if (t === "T") {
      flushStroke(); flushFill();
      let str = String(pr[4]);
      if (pr[6] === "s") str = str.replace(/p/g, "π");
      const anchor = pr[5] === "c" ? "middle" : (pr[5] === "r" ? "end" : "start");
      body += '<text x="' + fnum(pr[1]) + '" y="' + fnum(H - pr[2]) +
        '" font-size="' + fnum(pr[3]) +
        '" font-family="system-ui, -apple-system, Helvetica, Arial, sans-serif" text-anchor="' + anchor +
        '" fill="#' + color + '">' +
        str.replace(/&/g, "&amp;").replace(/</g, "&lt;") + "</text>";
    } else if (t === "R") {
      flushStroke(); flushFill();
      body += '<rect x="' + fnum(pr[1]) + '" y="' + fnum(H - pr[2] - pr[4]) +
        '" width="' + fnum(pr[3]) + '" height="' + fnum(pr[4]) +
        '" fill="#' + color + '"/>';
    } else if (t === "S") {
      flushStroke(); flushFill();
      color = pr[1]; w = pr[2]; dash = pr[3] || null;
    }
  }
  flushStroke(); flushFill();
  return body;
}

function buildSvgString(p, dl, title) {
  const safeTitle = (title || "Paper Pattern").replace(/[<>&]/g, "");
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + fnum(p.width) + ' ' + fnum(p.height) +
    '" width="' + fnum(p.width) + 'pt" height="' + fnum(p.height) + 'pt">\n' +
    '  <title>' + safeTitle + '</title>\n' +
    '  <g id="pattern-layer">\n' +
    dlToSvgBody(p, dl) +
    '\n  </g>\n</svg>';
}

// Apply page border and framing styles
function applyBorders(p, dl, borderConfig) {
  if (!borderConfig || !borderConfig.style || borderConfig.style === "none") return dl;
  const m = p.margin * 72;
  const W = p.width;
  const H = p.height;
  const color = checkColor(borderConfig.color, p.gridColor);
  const w = correct(borderConfig.weight, 0.2, 10);
  const style = borderConfig.style;
  const inset = correct(borderConfig.inset, 0, 50);

  const x0 = m + inset;
  const y0 = m + inset;
  const x1 = W - m - inset;
  const y1 = H - m - inset;

  if (x1 <= x0 || y1 <= y0) return dl;

  const isThumb = !!p.isThumbnail || (W < 300 && H < 300);
  const borderDl = [];

  const opt = (cfgKey, pKey, defVal = true) => {
    if (borderConfig && borderConfig[cfgKey] !== undefined) return !!borderConfig[cfgKey];
    if (p.x && p.x[pKey] !== undefined) return !!p.x[pKey];
    return defVal;
  };

  const showSubmission = opt("showSubmission", "show_submission", true);
  const showBanner = opt("showBanner", "show_banner", true);
  const showTitleBlock = opt("showTitleBlock", "show_titleblock", true);
  const showCoords = opt("showCoords", "show_coords", true);
  const showHeader = opt("showHeader", "show_header", true);
  const showFooter = opt("showFooter", "show_footer", true);
  const showRemarks = opt("showRemarks", "show_remarks", true);
  const showSeal = opt("showSeal", "show_seal", true);
  const showRevCol = opt("showRevCol", "show_rev_col", true);
  const showPearls = opt("showPearls", "show_pearls", true);
  const showCrests = opt("showCrests", "show_crests", true);
  const showCornerRosettes = opt("showCornerRosettes", "show_corner_rosettes", true);

  const txt = (cfgKey, pKey, defVal = "") => {
    if (borderConfig && borderConfig[cfgKey] !== undefined && borderConfig[cfgKey] !== null && borderConfig[cfgKey] !== "") {
      return String(borderConfig[cfgKey]);
    }
    if (p.x && p.x[pKey] !== undefined && p.x[pKey] !== null && p.x[pKey] !== "") {
      return String(p.x[pKey]);
    }
    return defVal;
  };

  const textBannerTitle = txt("bannerTitle", "banner_title", "PROJECT / ASSIGNMENT REPORT");
  const textTopic = txt("topicText", "topic_text", "TOPIC: __________________________________________________");
  const textName = txt("subName", "sub_name", "NAME: _________________________________________");
  const textRoll = txt("subRoll", "sub_roll", "ROLL NO / REG NO: ____________________________");
  const textClass = txt("subClass", "sub_class", "CLASS & SECTION: _____________________________");
  const textSubj = txt("subSubject", "sub_subject", "SUBJECT: ______________________________________");
  const textSubTo = txt("subSubmittedTo", "sub_submitted_to", "SUBMITTED TO: ________________________________");

  const textProjectTitle = txt("projectTitle", "project_title", "PROJECT / DRAWING TITLE:");
  const textDrawnBy = txt("drawnBy", "drawn_by", "DRAWN BY: ________________");
  const textDateEng = txt("dateEng", "date_eng", "DATE: ____________");
  const textCheckedBy = txt("checkedBy", "checked_by", "CHECKED BY: _____________");
  const textScale = txt("scaleText", "scale_text", "SCALE: 1:1  REV: 0");

  const textSubjectAcad = txt("subjectText", "subject_text", "SUBJECT: ______________________________");
  const textDateAcad = txt("dateText", "date_text", "DATE: ______________");
  const textSigAcad = txt("signatureText", "signature_text", "SIGNATURE: ____________________________");
  const textPageAcad = txt("pageText", "page_text", "PAGE NO: _________");

  const textTopicTech = txt("topicTech", "topic_text", "ASSIGNMENT / LAB TOPIC: ______________________________");
  const textRemarksTech = txt("remarksTech", "remarks_text", "EVALUATOR'S REMARKS: ________________________________________");

  const textSeal = txt("sealText", "seal_text", "★ MERIT ★");
  const textRibbonTitle = txt("ribbonTitle", "ribbon_title", "PROJECT PRESENTATION / ARCHITECTURAL SHEET");
  const textSheetNo = txt("sheetNo", "sheet_no", "SHEET NO: A-101");


  if (style === "assignment_front") {
    // 🎓 Assignment Front / Title Page Frame
    borderDl.push(["S", color, w * 2.2, null]);
    borderDl.push(["L", x0, y0, x1, y0]);
    borderDl.push(["L", x1, y0, x1, y1]);
    borderDl.push(["L", x1, y1, x0, y1]);
    borderDl.push(["L", x0, y1, x0, y0]);

    // Inner hairline frame
    const ins = 6;
    borderDl.push(["S", color, Math.max(0.4, w * 0.7), null]);
    borderDl.push(["L", x0 + ins, y0 + ins, x1 - ins, y0 + ins]);
    borderDl.push(["L", x1 - ins, y0 + ins, x1 - ins, y1 - ins]);
    borderDl.push(["L", x1 - ins, y1 - ins, x0 + ins, y1 - ins]);
    borderDl.push(["L", x0 + ins, y1 - ins, x0 + ins, y0 + ins]);

    // Corner decorative rosettes (12pt corner squares with diagonal cross)
    const csz = 12;
    const corners = [
      [x0, y0], [x1 - csz, y0], [x0, y1 - csz], [x1 - csz, y1 - csz]
    ];
    borderDl.push(["S", color, w * 0.9, null]);
    for (const [cx, cy] of corners) {
      borderDl.push(["R", cx, cy, csz, csz]);
      borderDl.push(["S", p.bgColor, Math.max(0.3, w * 0.5), null]);
      borderDl.push(["L", cx + 2, cy + 2, cx + csz - 2, cy + csz - 2]);
      borderDl.push(["L", cx + 2, cy + csz - 2, cx + csz - 2, cy + 2]);
      borderDl.push(["S", color, w * 0.9, null]);
    }

    // Top Title Ribbon / Banner
    if (showBanner) {
      borderDl.push(["S", color, w * 1.2, null]);
      const bannerY = y1 - 48;
      borderDl.push(["L", x0 + ins + 15, bannerY, x1 - ins - 15, bannerY]);
      borderDl.push(["L", x0 + ins + 15, bannerY - 3, x1 - ins - 15, bannerY - 3]);
      if (!isThumb) {
        borderDl.push(["T", W / 2, bannerY + 12, 14, textBannerTitle, "c", "h"]);
        borderDl.push(["T", x0 + ins + 25, bannerY - 22, 10, textTopic, "l", "h"]);
      } else {
        borderDl.push(["S", color, Math.max(0.4, w * 0.6), null]);
        borderDl.push(["L", W / 2 - 40, bannerY + 12, W / 2 + 40, bannerY + 12]);
      }
    }

    // Bottom Submission Block
    if (showSubmission) {
      const subW = Math.min(270, x1 - x0 - 40);
      const subH = 105;
      const subX = (W - subW) / 2;
      const subY = y0 + ins + 25;
      borderDl.push(["S", color, w, null]);
      borderDl.push(["L", subX, subY, subX + subW, subY]);
      borderDl.push(["L", subX + subW, subY, subX + subW, subY + subH]);
      borderDl.push(["L", subX + subW, subY + subH, subX, subY + subH]);
      borderDl.push(["L", subX, subY + subH, subX, subY]);

      if (!isThumb) {
        borderDl.push(["T", subX + 14, subY + subH - 18, 9, textName, "l", "h"]);
        borderDl.push(["T", subX + 14, subY + subH - 36, 9, textRoll, "l", "h"]);
        borderDl.push(["T", subX + 14, subY + subH - 54, 9, textClass, "l", "h"]);
        borderDl.push(["T", subX + 14, subY + subH - 72, 9, textSubj, "l", "h"]);
        borderDl.push(["T", subX + 14, subY + subH - 90, 9, textSubTo, "l", "h"]);
      } else {
        borderDl.push(["S", color, Math.max(0.4, w * 0.6), null]);
        borderDl.push(["L", subX + 14, subY + subH - 22, subX + subW - 14, subY + subH - 22]);
        borderDl.push(["L", subX + 14, subY + subH - 44, subX + subW - 14, subY + subH - 44]);
        borderDl.push(["L", subX + 14, subY + subH - 66, subX + subW - 14, subY + subH - 66]);
        borderDl.push(["L", subX + 14, subY + subH - 88, subX + subW - 14, subY + subH - 88]);
      }
    }

  } else if (style === "engineering_titleblock") {
    // 📐 Engineering Drawing Sheet Border with Title Block
    borderDl.push(["S", color, w * 2, null]);
    borderDl.push(["L", x0, y0, x1, y0]);
    borderDl.push(["L", x1, y0, x1, y1]);
    borderDl.push(["L", x1, y1, x0, y1]);
    borderDl.push(["L", x0, y1, x0, y0]);

    // Grid reference tick marks along outer margins
    if (showCoords) {
      borderDl.push(["S", color, Math.max(0.4, w * 0.7), null]);
      const numDivsX = 6, numDivsY = 4;
      const stepX = (x1 - x0) / numDivsX;
      const stepY = (y1 - y0) / numDivsY;
      for (let i = 1; i < numDivsX; i++) {
        const gx = x0 + i * stepX;
        borderDl.push(["L", gx, y0, gx, y0 + 6]);
        borderDl.push(["L", gx, y1, gx, y1 - 6]);
        borderDl.push(["T", gx - stepX / 2, y1 - 12, 7, String(i), "c", "h"]);
      }
      borderDl.push(["T", x1 - stepX / 2, y1 - 12, 7, String(numDivsX), "c", "h"]);

      const letters = ["A", "B", "C", "D"];
      for (let j = 0; j < numDivsY; j++) {
        const gy = y1 - (j + 0.5) * stepY;
        borderDl.push(["T", x0 + 4, gy - 3, 7, letters[j], "c", "h"]);
        borderDl.push(["T", x1 - 4, gy - 3, 7, letters[j], "c", "h"]);
      }
    }

    // Title Block in bottom-right corner (190pt x 72pt)
    if (showTitleBlock) {
      const tbW = Math.min(210, x1 - x0 - 20);
      const tbH = 72;
      const tbX = x1 - tbW;
      const tbY = y0;
      borderDl.push(["S", color, w * 1.5, null]);
      borderDl.push(["L", tbX, tbY, tbX, tbY + tbH]);
      borderDl.push(["L", tbX, tbY + tbH, x1, tbY + tbH]);

      // Internal Title block divisions
      borderDl.push(["S", color, Math.max(0.4, w * 0.6), null]);
      borderDl.push(["L", tbX, tbY + 48, x1, tbY + 48]);
      borderDl.push(["L", tbX, tbY + 24, x1, tbY + 24]);
      borderDl.push(["L", tbX + tbW * 0.55, tbY, tbX + tbW * 0.55, tbY + 48]);

      if (!isThumb) {
        borderDl.push(["T", tbX + 8, tbY + 58, 8, textProjectTitle, "l", "h"]);
        borderDl.push(["T", tbX + 8, tbY + 34, 7, textDrawnBy, "l", "h"]);
        borderDl.push(["T", tbX + tbW * 0.58, tbY + 34, 7, textDateEng, "l", "h"]);
        borderDl.push(["T", tbX + 8, tbY + 10, 7, textCheckedBy, "l", "h"]);
        borderDl.push(["T", tbX + tbW * 0.58, tbY + 10, 7, textScale, "l", "h"]);
      } else {
        borderDl.push(["S", color, Math.max(0.3, w * 0.5), null]);
        borderDl.push(["L", tbX + 6, tbY + 58, tbX + tbW - 6, tbY + 58]);
        borderDl.push(["L", tbX + 6, tbY + 34, tbX + tbW * 0.5, tbY + 34]);
        borderDl.push(["L", tbX + 6, tbY + 10, tbX + tbW * 0.5, tbY + 10]);
      }
    }

  } else if (style === "academic_double") {
    // 🏛️ University Academic Double-Fillet with Corner Stones
    borderDl.push(["S", color, w * 2.0, null]);
    borderDl.push(["L", x0, y0, x1, y0]);
    borderDl.push(["L", x1, y0, x1, y1]);
    borderDl.push(["L", x1, y1, x0, y1]);
    borderDl.push(["L", x0, y1, x0, y0]);

    const ins = 5;
    borderDl.push(["S", color, Math.max(0.4, w * 0.6), null]);
    borderDl.push(["L", x0 + ins, y0 + ins, x1 - ins, y0 + ins]);
    borderDl.push(["L", x1 - ins, y0 + ins, x1 - ins, y1 - ins]);
    borderDl.push(["L", x1 - ins, y1 - ins, x0 + ins, y1 - ins]);
    borderDl.push(["L", x0 + ins, y1 - ins, x0 + ins, y0 + ins]);

    // Top Header line
    if (showHeader) {
      const headY = y1 - 28;
      borderDl.push(["S", color, Math.max(0.5, w * 0.7), null]);
      borderDl.push(["L", x0 + ins, headY, x1 - ins, headY]);
      if (!isThumb) {
        borderDl.push(["T", x0 + ins + 10, headY + 7, 8, textSubjectAcad, "l", "h"]);
        borderDl.push(["T", x1 - ins - 10, headY + 7, 8, textDateAcad, "r", "h"]);
      }
    }

    // Bottom Footer line
    if (showFooter) {
      const footY = y0 + 24;
      borderDl.push(["S", color, Math.max(0.5, w * 0.7), null]);
      borderDl.push(["L", x0 + ins, footY, x1 - ins, footY]);
      if (!isThumb) {
        borderDl.push(["T", x0 + ins + 10, footY - 14, 8, textSigAcad, "l", "h"]);
        borderDl.push(["T", x1 - ins - 10, footY - 14, 8, textPageAcad, "r", "h"]);
      }
    }

  } else if (style === "minimal_assignment") {
    // ⚡ Modern Tech Assignment Frame with Header Bar
    borderDl.push(["S", color, w * 1.5, null]);
    borderDl.push(["L", x0, y0, x1, y0]);
    borderDl.push(["L", x1, y0, x1, y1]);
    borderDl.push(["L", x1, y1, x0, y1]);
    borderDl.push(["L", x0, y1, x0, y0]);

    // Header strip box
    if (showHeader) {
      const headH = 26;
      borderDl.push(["S", color, Math.max(0.5, w * 0.8), null]);
      borderDl.push(["L", x0, y1 - headH, x1, y1 - headH]);
      if (!isThumb) {
        borderDl.push(["T", x0 + 12, y1 - 17, 8, textTopicTech, "l", "h"]);
        borderDl.push(["T", x1 - 120, y1 - 17, 8, "DATE: ________", "l", "h"]);
        borderDl.push(["T", x1 - 14, y1 - 17, 8, "PAGE: ____", "r", "h"]);
      }
    }

    // Footer signature strip
    if (showRemarks) {
      const footH = 22;
      borderDl.push(["S", color, Math.max(0.5, w * 0.8), null]);
      borderDl.push(["L", x0, y0 + footH, x1, y0 + footH]);
      if (!isThumb) {
        borderDl.push(["T", x0 + 12, y0 + 7, 7.5, textRemarksTech, "l", "h"]);
        borderDl.push(["T", x1 - 14, y0 + 7, 7.5, "SIGNATURE: ____________", "r", "h"]);
      }
    }

  } else if (style === "floral") {
    // 🌸 Decorative Floral / Flourish Corner Project Border
    borderDl.push(["S", color, w * 1.5, null]);
    borderDl.push(["L", x0, y0, x1, y0]);
    borderDl.push(["L", x1, y0, x1, y1]);
    borderDl.push(["L", x1, y1, x0, y1]);
    borderDl.push(["L", x0, y1, x0, y0]);

    // Flourish brackets at 4 corners using Bézier curves
    const flen = 28;
    borderDl.push(["S", color, w * 0.9, null]);
    // Bottom-Left
    borderDl.push(["C", x0 + 14, y0 + 14, 8]);
    borderDl.push(["D", x0 + 14, y0 + 14, 2.5]);
    borderDl.push(["L", x0 + 6, y0 + 14, x0 + flen, y0 + 14]);
    borderDl.push(["L", x0 + 14, y0 + 6, x0 + 14, y0 + flen]);
    // Bottom-Right
    borderDl.push(["C", x1 - 14, y0 + 14, 8]);
    borderDl.push(["D", x1 - 14, y0 + 14, 2.5]);
    borderDl.push(["L", x1 - 6, y0 + 14, x1 - flen, y0 + 14]);
    borderDl.push(["L", x1 - 14, y0 + 6, x1 - 14, y0 + flen]);
    // Top-Left
    borderDl.push(["C", x0 + 14, y1 - 14, 8]);
    borderDl.push(["D", x0 + 14, y1 - 14, 2.5]);
    borderDl.push(["L", x0 + 6, y1 - 14, x0 + flen, y1 - 14]);
    borderDl.push(["L", x0 + 14, y1 - 6, x0 + 14, y1 - flen]);
    // Top-Right
    borderDl.push(["C", x1 - 14, y1 - 14, 8]);
    borderDl.push(["D", x1 - 14, y1 - 14, 2.5]);
    borderDl.push(["L", x1 - 6, y1 - 14, x1 - flen, y1 - 14]);
    borderDl.push(["L", x1 - 14, y1 - 6, x1 - 14, y1 - flen]);

  } else if (style === "single") {
    borderDl.push(["S", color, w, null]);
    borderDl.push(["L", x0, y0, x1, y0]);
    borderDl.push(["L", x1, y0, x1, y1]);
    borderDl.push(["L", x1, y1, x0, y1]);
    borderDl.push(["L", x0, y1, x0, y0]);

  } else if (style === "double") {
    // Outer frame
    borderDl.push(["S", color, w, null]);
    borderDl.push(["L", x0, y0, x1, y0]);
    borderDl.push(["L", x1, y0, x1, y1]);
    borderDl.push(["L", x1, y1, x0, y1]);
    borderDl.push(["L", x0, y1, x0, y0]);
    // Inner frame
    const gap = Math.max(3, w * 2.5);
    if (x1 - gap > x0 + gap && y1 - gap > y0 + gap) {
      borderDl.push(["S", color, Math.max(0.3, w * 0.6), null]);
      borderDl.push(["L", x0 + gap, y0 + gap, x1 - gap, y0 + gap]);
      borderDl.push(["L", x1 - gap, y0 + gap, x1 - gap, y1 - gap]);
      borderDl.push(["L", x1 - gap, y1 - gap, x0 + gap, y1 - gap]);
      borderDl.push(["L", x0 + gap, y1 - gap, x0 + gap, y0 + gap]);
    }

  } else if (style === "bold") {
    borderDl.push(["S", color, w * 2.5, null]);
    borderDl.push(["L", x0, y0, x1, y0]);
    borderDl.push(["L", x1, y0, x1, y1]);
    borderDl.push(["L", x1, y1, x0, y1]);
    borderDl.push(["L", x0, y1, x0, y0]);

  } else if (style === "dashed") {
    borderDl.push(["S", color, w, [5, 4]]);
    borderDl.push(["L", x0, y0, x1, y0]);
    borderDl.push(["L", x1, y0, x1, y1]);
    borderDl.push(["L", x1, y1, x0, y1]);
    borderDl.push(["L", x0, y1, x0, y0]);

  } else if (style === "corners") {
    const len = Math.min(22, Math.min(x1 - x0, y1 - y0) / 4);
    borderDl.push(["S", color, w * 1.5, null]);
    borderDl.push(["L", x0, y0, x0 + len, y0]);
    borderDl.push(["L", x0, y0, x0, y0 + len]);
    borderDl.push(["L", x1, y0, x1 - len, y0]);
    borderDl.push(["L", x1, y0, x1, y0 + len]);
    borderDl.push(["L", x0, y1, x0 + len, y1]);
    borderDl.push(["L", x0, y1, x0, y1 - len]);
    borderDl.push(["L", x1, y1, x1 - len, y1]);
    borderDl.push(["L", x1, y1, x1, y1 - len]);

  } else if (style === "looseleaf") {
    const marginX = Math.max(x0, 85);
    const redColor = borderConfig.customColor ? color : "e05252";
    borderDl.push(["S", redColor, Math.max(0.75, w), null]);
    borderDl.push(["L", marginX, 0, marginX, H]);
    const headerY = H - Math.max(y0, 85);
    borderDl.push(["S", color, Math.max(0.5, w * 0.75), null]);
    borderDl.push(["L", 0, headerY, W, headerY]);

  } else if (style === "artdeco") {
    const notch = Math.min(14, (x1 - x0) / 6);
    borderDl.push(["S", color, w * 1.5, null]);
    borderDl.push(["L", x0 + notch, y0, x1 - notch, y0]);
    borderDl.push(["L", x1 - notch, y0, x1, y0 + notch]);
    borderDl.push(["L", x1, y0 + notch, x1, y1 - notch]);
    borderDl.push(["L", x1, y1 - notch, x1 - notch, y1]);
    borderDl.push(["L", x1 - notch, y1, x0 + notch, y1]);
    borderDl.push(["L", x0 + notch, y1, x0, y1 - notch]);
    borderDl.push(["L", x0, y1 - notch, x0, y0 + notch]);
    borderDl.push(["L", x0, y0 + notch, x0 + notch, y0]);
  } else if (style === "diploma_seal") {
    // 📜 Certificate & Diploma Frame with Rosette Seal
    borderDl.push(["S", color, w * 2.2, null]);
    borderDl.push(["L", x0, y0, x1, y0]);
    borderDl.push(["L", x1, y0, x1, y1]);
    borderDl.push(["L", x1, y1, x0, y1]);
    borderDl.push(["L", x0, y1, x0, y0]);

    const ins1 = 4;
    borderDl.push(["S", color, Math.max(0.4, w * 0.5), null]);
    borderDl.push(["L", x0 + ins1, y0 + ins1, x1 - ins1, y0 + ins1]);
    borderDl.push(["L", x1 - ins1, y0 + ins1, x1 - ins1, y1 - ins1]);
    borderDl.push(["L", x1 - ins1, y1 - ins1, x0 + ins1, y1 - ins1]);
    borderDl.push(["L", x0 + ins1, y1 - ins1, x0 + ins1, y0 + ins1]);

    const ins2 = 9;
    borderDl.push(["S", color, Math.max(0.4, w * 0.6), [3, 2]]);
    borderDl.push(["L", x0 + ins2, y0 + ins2, x1 - ins2, y0 + ins2]);
    borderDl.push(["L", x1 - ins2, y0 + ins2, x1 - ins2, y1 - ins2]);
    borderDl.push(["L", x1 - ins2, y1 - ins2, x0 + ins2, y1 - ins2]);
    borderDl.push(["L", x0 + ins2, y1 - ins2, x0 + ins2, y0 + ins2]);

    const ins3 = 14;
    borderDl.push(["S", color, Math.max(0.5, w * 0.9), null]);
    borderDl.push(["L", x0 + ins3, y0 + ins3, x1 - ins3, y0 + ins3]);
    borderDl.push(["L", x1 - ins3, y0 + ins3, x1 - ins3, y1 - ins3]);
    borderDl.push(["L", x1 - ins3, y1 - ins3, x0 + ins3, y1 - ins3]);
    borderDl.push(["L", x0 + ins3, y1 - ins3, x0 + ins3, y0 + ins3]);

    const csz = 22;
    const corners = [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]];
    borderDl.push(["S", color, Math.max(0.5, w * 0.8), null]);
    for (const [cx, cy, sx, sy] of corners) {
      borderDl.push(["L", cx, cy + sy * csz, cx + sx * csz, cy]);
      borderDl.push(["C", cx + sx * 10, cy + sy * 10, 4]);
      borderDl.push(["D", cx + sx * 10, cy + sy * 10, 1.5]);
    }

    if (showSeal) {
      const sealX = x0 + 44, sealY = y0 + 44;
      const sealR = 24;
      borderDl.push(["S", color, Math.max(0.6, w * 1.0), null]);
      borderDl.push(["C", sealX, sealY, sealR]);
      borderDl.push(["C", sealX, sealY, sealR - 3.5]);
      borderDl.push(["C", sealX, sealY, sealR - 6]);
      for (let a = 0; a < 16; a++) {
        const rad1 = (a * 2 * Math.PI) / 16;
        const rad2 = ((a + 0.5) * 2 * Math.PI) / 16;
        const px1 = sealX + (sealR + 2.5) * Math.cos(rad1);
        const py1 = sealY + (sealR + 2.5) * Math.sin(rad1);
        const px2 = sealX + (sealR - 1) * Math.cos(rad2);
        const py2 = sealY + (sealR - 1) * Math.sin(rad2);
        borderDl.push(["L", px1, py1, px2, py2]);
      }
      borderDl.push(["L", sealX - 8, sealY - sealR + 2, sealX - 16, sealY - sealR - 18]);
      borderDl.push(["L", sealX - 16, sealY - sealR - 18, sealX - 6, sealY - sealR - 12]);
      borderDl.push(["L", sealX - 6, sealY - sealR - 12, sealX, sealY - sealR + 2]);
      borderDl.push(["L", sealX + 8, sealY - sealR + 2, sealX + 16, sealY - sealR - 18]);
      borderDl.push(["L", sealX + 16, sealY - sealR - 18, sealX + 6, sealY - sealR - 12]);
      borderDl.push(["L", sealX + 6, sealY - sealR - 12, sealX, sealY - sealR + 2]);
      if (!isThumb) {
        borderDl.push(["T", sealX, sealY - 2.5, 6, textSeal, "c", "h"]);
      }
    }

  } else if (style === "greek_key") {
    // 🏛️ Classical Greek Key (Meander) Border
    const band = 14;
    borderDl.push(["S", color, w * 1.8, null]);
    borderDl.push(["L", x0, y0, x1, y0]);
    borderDl.push(["L", x1, y0, x1, y1]);
    borderDl.push(["L", x1, y1, x0, y1]);
    borderDl.push(["L", x0, y1, x0, y0]);

    borderDl.push(["S", color, Math.max(0.4, w * 0.7), null]);
    borderDl.push(["L", x0 + band, y0 + band, x1 - band, y0 + band]);
    borderDl.push(["L", x1 - band, y0 + band, x1 - band, y1 - band]);
    borderDl.push(["L", x1 - band, y1 - band, x0 + band, y1 - band]);
    borderDl.push(["L", x0 + band, y1 - band, x0 + band, y0 + band]);

    const step = 12;
    borderDl.push(["S", color, Math.max(0.4, w * 0.6), null]);

    const topY = y1 - band / 2;
    for (let x = x0 + band + 2; x + step <= x1 - band - 2; x += step) {
      borderDl.push(["L", x, topY - 3, x + step * 0.7, topY - 3]);
      borderDl.push(["L", x + step * 0.7, topY - 3, x + step * 0.7, topY + 3]);
      borderDl.push(["L", x + step * 0.7, topY + 3, x + step * 0.3, topY + 3]);
      borderDl.push(["L", x + step * 0.3, topY + 3, x + step * 0.3, topY]);
    }
    const botY = y0 + band / 2;
    for (let x = x0 + band + 2; x + step <= x1 - band - 2; x += step) {
      borderDl.push(["L", x, botY + 3, x + step * 0.7, botY + 3]);
      borderDl.push(["L", x + step * 0.7, botY + 3, x + step * 0.7, botY - 3]);
      borderDl.push(["L", x + step * 0.7, botY - 3, x + step * 0.3, botY - 3]);
      borderDl.push(["L", x + step * 0.3, botY - 3, x + step * 0.3, botY]);
    }
    const lftX = x0 + band / 2;
    for (let y = y0 + band + 2; y + step <= y1 - band - 2; y += step) {
      borderDl.push(["L", lftX - 3, y, lftX - 3, y + step * 0.7]);
      borderDl.push(["L", lftX - 3, y + step * 0.7, lftX + 3, y + step * 0.7]);
      borderDl.push(["L", lftX + 3, y + step * 0.7, lftX + 3, y + step * 0.3]);
      borderDl.push(["L", lftX + 3, y + step * 0.3, lftX, y + step * 0.3]);
    }
    const rgtX = x1 - band / 2;
    for (let y = y0 + band + 2; y + step <= y1 - band - 2; y += step) {
      borderDl.push(["L", rgtX + 3, y, rgtX + 3, y + step * 0.7]);
      borderDl.push(["L", rgtX + 3, y + step * 0.7, rgtX - 3, y + step * 0.7]);
      borderDl.push(["L", rgtX - 3, y + step * 0.7, rgtX - 3, y + step * 0.3]);
      borderDl.push(["L", rgtX - 3, y + step * 0.3, rgtX, y + step * 0.3]);
    }

    const cSquares = [[x0, y0], [x1 - band, y0], [x0, y1 - band], [x1 - band, y1 - band]];
    borderDl.push(["S", color, Math.max(0.5, w * 0.8), null]);
    for (const [cx, cy] of cSquares) {
      borderDl.push(["R", cx, cy, band, band]);
      borderDl.push(["L", cx + 2, cy + band / 2, cx + band - 2, cy + band / 2]);
      borderDl.push(["L", cx + band / 2, cy + 2, cx + band / 2, cy + band - 2]);
      borderDl.push(["D", cx + band / 2, cy + band / 2, 1.5]);
    }

  } else if (style === "vintage_scroll") {
    // 🌿 Vintage Victorian Scrollwork & Acanthus Lace
    borderDl.push(["S", color, w * 1.5, null]);
    borderDl.push(["L", x0, y0, x1, y0]);
    borderDl.push(["L", x1, y0, x1, y1]);
    borderDl.push(["L", x1, y1, x0, y1]);
    borderDl.push(["L", x0, y1, x0, y0]);

    const ins = 7;
    borderDl.push(["S", color, Math.max(0.3, w * 0.5), null]);
    borderDl.push(["L", x0 + ins, y0 + ins, x1 - ins, y0 + ins]);
    borderDl.push(["L", x1 - ins, y0 + ins, x1 - ins, y1 - ins]);
    borderDl.push(["L", x1 - ins, y1 - ins, x0 + ins, y1 - ins]);
    borderDl.push(["L", x0 + ins, y1 - ins, x0 + ins, y0 + ins]);

    const dotGap = 12;
    borderDl.push(["S", color, 0.5, null]);
    for (let x = x0 + 16; x <= x1 - 16; x += dotGap) {
      borderDl.push(["D", x, y0 + ins / 2, 1.0]);
      borderDl.push(["D", x, y1 - ins / 2, 1.0]);
    }
    for (let y = y0 + 16; y <= y1 - 16; y += dotGap) {
      borderDl.push(["D", x0 + ins / 2, y, 1.0]);
      borderDl.push(["D", x1 - ins / 2, y, 1.0]);
    }

    const flen = 32;
    borderDl.push(["S", color, Math.max(0.5, w * 0.9), null]);
    const vCorners = [
      [x0 + ins, y0 + ins, 1, 1],
      [x1 - ins, y0 + ins, -1, 1],
      [x0 + ins, y1 - ins, 1, -1],
      [x1 - ins, y1 - ins, -1, -1]
    ];
    for (const [cx, cy, sx, sy] of vCorners) {
      borderDl.push(["L", cx, cy + sy * flen, cx + sx * 6, cy + sy * (flen - 8)]);
      borderDl.push(["L", cx + sx * 6, cy + sy * (flen - 8), cx + sx * 16, cy + sy * 16]);
      borderDl.push(["L", cx + sx * 16, cy + sy * 16, cx + sx * (flen - 8), cy + sy * 6]);
      borderDl.push(["L", cx + sx * (flen - 8), cy + sy * 6, cx + sx * flen, cy]);
      borderDl.push(["C", cx + sx * 18, cy + sy * 18, 5]);
      borderDl.push(["D", cx + sx * 18, cy + sy * 18, 2]);
    }

    const midX = (x0 + x1) / 2;
    borderDl.push(["C", midX, y1 - ins, 5]);
    borderDl.push(["D", midX, y1 - ins, 1.8]);
    borderDl.push(["L", midX - 18, y1 - ins, midX - 6, y1 - ins]);
    borderDl.push(["L", midX + 6, y1 - ins, midX + 18, y1 - ins]);

    borderDl.push(["C", midX, y0 + ins, 5]);
    borderDl.push(["D", midX, y0 + ins, 1.8]);
    borderDl.push(["L", midX - 18, y0 + ins, midX - 6, y0 + ins]);
    borderDl.push(["L", midX + 6, y0 + ins, midX + 18, y0 + ins]);

  } else if (style === "celtic_knot") {
    // 🍀 Celtic Knotwork & Interlace Frame
    const kBand = 14;
    borderDl.push(["S", color, w * 1.6, null]);
    borderDl.push(["L", x0, y0, x1, y0]);
    borderDl.push(["L", x1, y0, x1, y1]);
    borderDl.push(["L", x1, y1, x0, y1]);
    borderDl.push(["L", x0, y1, x0, y0]);

    borderDl.push(["S", color, Math.max(0.4, w * 0.7), null]);
    borderDl.push(["L", x0 + kBand, y0 + kBand, x1 - kBand, y0 + kBand]);
    borderDl.push(["L", x1 - kBand, y0 + kBand, x1 - kBand, y1 - kBand]);
    borderDl.push(["L", x1 - kBand, y1 - kBand, x0 + kBand, y1 - kBand]);
    borderDl.push(["L", x0 + kBand, y1 - kBand, x0 + kBand, y0 + kBand]);

    borderDl.push(["S", color, Math.max(0.4, w * 0.6), null]);
    const bStep = 10;
    for (let x = x0 + kBand + 6; x + bStep <= x1 - kBand - 6; x += bStep) {
      borderDl.push(["L", x, y0, x + bStep, y0 + kBand]);
      borderDl.push(["L", x, y0 + kBand, x + bStep, y0]);
      borderDl.push(["L", x, y1, x + bStep, y1 - kBand]);
      borderDl.push(["L", x, y1 - kBand, x + bStep, y1]);
    }
    for (let y = y0 + kBand + 6; y + bStep <= y1 - kBand - 6; y += bStep) {
      borderDl.push(["L", x0, y, x0 + kBand, y + bStep]);
      borderDl.push(["L", x0 + kBand, y, x0, y + bStep]);
      borderDl.push(["L", x1, y, x1 - kBand, y + bStep]);
      borderDl.push(["L", x1 - kBand, y, x1, y + bStep]);
    }

    const kCorners = [[x0, y0], [x1 - kBand, y0], [x0, y1 - kBand], [x1 - kBand, y1 - kBand]];
    borderDl.push(["S", color, Math.max(0.5, w * 0.9), null]);
    for (const [cx, cy] of kCorners) {
      borderDl.push(["R", cx, cy, kBand, kBand]);
      borderDl.push(["L", cx, cy, cx + kBand, cy + kBand]);
      borderDl.push(["L", cx + kBand, cy, cx, cy + kBand]);
      borderDl.push(["C", cx + kBand / 2, cy + kBand / 2, 3.5]);
      borderDl.push(["D", cx + kBand / 2, cy + kBand / 2, 1.2]);
    }

  } else if (style === "artdeco_luxury") {
    // 🍸 Art Deco Grand Stepped Chevron Frame
    borderDl.push(["S", color, w * 2.0, null]);
    borderDl.push(["L", x0, y0, x1, y0]);
    borderDl.push(["L", x1, y0, x1, y1]);
    borderDl.push(["L", x1, y1, x0, y1]);
    borderDl.push(["L", x0, y1, x0, y0]);

    const ins = 8;
    borderDl.push(["S", color, Math.max(0.4, w * 0.6), null]);
    borderDl.push(["L", x0 + ins, y0 + ins, x1 - ins, y0 + ins]);
    borderDl.push(["L", x1 - ins, y0 + ins, x1 - ins, y1 - ins]);
    borderDl.push(["L", x1 - ins, y1 - ins, x0 + ins, y1 - ins]);
    borderDl.push(["L", x0 + ins, y1 - ins, x0 + ins, y0 + ins]);

    const adCorners = [
      [x0, y0, 1, 1],
      [x1, y0, -1, 1],
      [x0, y1, 1, -1],
      [x1, y1, -1, -1]
    ];
    borderDl.push(["S", color, Math.max(0.5, w * 0.8), null]);
    for (const [cx, cy, sx, sy] of adCorners) {
      borderDl.push(["L", cx + sx * 26, cy, cx + sx * 26, cy + sy * 8]);
      borderDl.push(["L", cx + sx * 26, cy + sy * 8, cx + sx * 16, cy + sy * 8]);
      borderDl.push(["L", cx + sx * 16, cy + sy * 8, cx + sx * 16, cy + sy * 16]);
      borderDl.push(["L", cx + sx * 16, cy + sy * 16, cx + sx * 8, cy + sy * 16]);
      borderDl.push(["L", cx + sx * 8, cy + sy * 16, cx + sx * 8, cy + sy * 26]);
      borderDl.push(["L", cx + sx * 8, cy + sy * 26, cx, cy + sy * 26]);

      borderDl.push(["L", cx + sx * 6, cy + sy * 6, cx + sx * 24, cy + sy * 24]);
      borderDl.push(["L", cx + sx * 12, cy + sy * 24, cx + sx * 24, cy + sy * 12]);
      borderDl.push(["D", cx + sx * 24, cy + sy * 24, 2.0]);
    }

  } else if (style === "islamic_geom") {
    // ۞ Arabesque Geometric 8-Point Star Frame
    borderDl.push(["S", color, w * 1.8, null]);
    borderDl.push(["L", x0, y0, x1, y0]);
    borderDl.push(["L", x1, y0, x1, y1]);
    borderDl.push(["L", x1, y1, x0, y1]);
    borderDl.push(["L", x0, y1, x0, y0]);

    const starBand = 16;
    borderDl.push(["S", color, Math.max(0.4, w * 0.6), null]);
    borderDl.push(["L", x0 + starBand, y0 + starBand, x1 - starBand, y0 + starBand]);
    borderDl.push(["L", x1 - starBand, y0 + starBand, x1 - starBand, y1 - starBand]);
    borderDl.push(["L", x1 - starBand, y1 - starBand, x0 + starBand, y1 - starBand]);
    borderDl.push(["L", x0 + starBand, y1 - starBand, x0 + starBand, y0 + starBand]);

    const starCenters = [
      [x0 + starBand / 2, y0 + starBand / 2],
      [x1 - starBand / 2, y0 + starBand / 2],
      [x0 + starBand / 2, y1 - starBand / 2],
      [x1 - starBand / 2, y1 - starBand / 2]
    ];
    borderDl.push(["S", color, Math.max(0.5, w * 0.9), null]);
    for (const [scx, scy] of starCenters) {
      const sr = starBand * 0.44;
      borderDl.push(["R", scx - sr, scy - sr, sr * 2, sr * 2]);
      const d = sr * 1.414;
      borderDl.push(["L", scx, scy - d, scx + d, scy]);
      borderDl.push(["L", scx + d, scy, scx, scy + d]);
      borderDl.push(["L", scx, scy + d, scx - d, scy]);
      borderDl.push(["L", scx - d, scy, scx, scy - d]);
      borderDl.push(["D", scx, scy, 1.5]);
    }

    const gStep = 16;
    borderDl.push(["S", color, Math.max(0.4, w * 0.5), null]);
    for (let x = x0 + starBand + 4; x + gStep <= x1 - starBand - 4; x += gStep) {
      borderDl.push(["L", x, y0, x + gStep / 2, y0 + starBand]);
      borderDl.push(["L", x + gStep / 2, y0 + starBand, x + gStep, y0]);
      borderDl.push(["L", x, y1, x + gStep / 2, y1 - starBand]);
      borderDl.push(["L", x + gStep / 2, y1 - starBand, x + gStep, y1]);
    }

  } else if (style === "modern_ribbon") {
    // 📐 Modern Architectural Presentation Frame with Title Ribbon
    borderDl.push(["S", color, w * 2.0, null]);
    borderDl.push(["L", x0, y0, x1, y0]);
    borderDl.push(["L", x1, y0, x1, y1]);
    borderDl.push(["L", x1, y1, x0, y1]);
    borderDl.push(["L", x0, y1, x0, y0]);

    const chLen = 8;
    borderDl.push(["S", color, Math.max(0.5, w * 0.8), null]);
    const chCorners = [[x0 - 2, y0 - 2], [x1 + 2, y0 - 2], [x0 - 2, y1 + 2], [x1 + 2, y1 + 2]];
    for (const [cx, cy] of chCorners) {
      borderDl.push(["L", cx - chLen, cy, cx + chLen, cy]);
      borderDl.push(["L", cx, cy - chLen, cx, cy + chLen]);
      borderDl.push(["C", cx, cy, 3.5]);
    }

    const rHeadH = 24;
    if (showHeader) {
      borderDl.push(["S", color, Math.max(0.5, w * 0.9), null]);
      borderDl.push(["L", x0, y1 - rHeadH, x1, y1 - rHeadH]);
      if (!isThumb) {
        borderDl.push(["T", x0 + 12, y1 - 15, 8, textRibbonTitle, "l", "h"]);
        borderDl.push(["T", x1 - 14, y1 - 15, 7.5, textSheetNo, "r", "h"]);
      }
    }

    if (showRevCol) {
      const rColW = 32;
      const topY = showHeader ? y1 - rHeadH : y1;
      borderDl.push(["S", color, Math.max(0.4, w * 0.7), null]);
      borderDl.push(["L", x1 - rColW, y0, x1 - rColW, topY]);
      const rRows = 4;
      const rRowH = (topY - y0) / rRows;
      for (let r = 1; r < rRows; r++) {
        const ry = y0 + r * rRowH;
        borderDl.push(["L", x1 - rColW, ry, x1, ry]);
      }
    }
  }

  return [...dl, ...borderDl];
}

function applyPageAnnotations(p, dl, opts = {}) {
  const result = [...dl];
  const m = p.margin * 72;
  const headerText = opts.headerText || "";
  const dateField = !!opts.dateField;
  const pageNumbering = !!opts.pageNumbering;
  const pageNum = opts.pageNum || 1;
  const pageCount = opts.pageCount || 1;

  if (headerText || dateField) {
    result.push(["S", "444444", 0.7, null]);
    const topY = p.height - Math.max(18, m - 10);
    if (headerText) {
      result.push(["T", Math.max(20, m), topY, 9, headerText, "l"]);
    }
    if (dateField) {
      result.push(["T", p.width - Math.max(20, m), topY, 9, "Date: ________", "r"]);
    }
  }

  if (pageNumbering) {
    result.push(["S", "555555", 0.7, null]);
    const bottomY = Math.max(14, m - 12);
    const pageStr = `${pageNum} / ${pageCount}`;
    result.push(["T", p.width / 2, bottomY, 8, pageStr, "c"]);
  }

  return result;
}

// Convert SVG to PNG Blob at crisp print resolution
function rasterizeToBlob(svgString, widthPts, heightPts, targetDpi = 300) {
  return new Promise((resolve, reject) => {
    const scale = Math.min(targetDpi / 72, 8000 / Math.max(widthPts, heightPts));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(widthPts * scale);
    canvas.height = Math.round(heightPts * scale);
    const ctx = canvas.getContext("2d");

    const img = new Image();
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((pngBlob) => {
        if (pngBlob) resolve(pngBlob);
        else reject(new Error("Canvas toBlob failed"));
      }, "image/png");
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

  // Export as ES/global namespace
  const Engine = {
    PAGE_SIZES,
    correct,
    checkColor,
    fnum,
    hexToRgbTriplet,
    unitToInches,
    inchesToUnit,
    perOffset,
    sizePts,
    resolveCommon,
    gridLayout,
    HELV_W,
    textWidthPts,
    pdfEscape,
    sliderToWeight,
    weightToSlider,
    dlToPdfOps,
    buildPdf,
    dlToSvgBody,
    buildSvgString,
    rasterizeToBlob,
    applyBorders,
    applyPageAnnotations
  };

  if (typeof window !== "undefined") {
    window.PaperEngine = Engine;
  }
  if (typeof global !== "undefined") {
    global.PaperEngine = Engine;
  }
})();
