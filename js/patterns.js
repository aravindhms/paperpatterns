/**
 * PaperPatterns Geometry & Pattern Library
 * 78 Algorithmic Pattern Generators ported from Kevin MacLeod (CC0 1.0 Public Domain)
 */

"use strict";

(function () {
  "use strict";

  const Engine = (typeof window !== "undefined" && window.PaperEngine)
    ? window.PaperEngine
    : (typeof global !== "undefined" && global.PaperEngine ? global.PaperEngine : {});
  const PaperEngine = Engine;

  // Pull engine math utilities into module scope
  const {
    correct,
    checkColor,
    fnum,
    CM_PER_INCH,
    KAPPA,
    perOffset,
    sizePts,
    resolveCommon,
    gridLayout,
    textWidthPts
  } = Engine;


"use strict";

// Shared triangle-grid skeleton. vf = vertical factor
// (0.866 for equilateral; vartriangle/68degree use other values).
function triGridDraw(p, vf) {
  const o = p.offset, dl = [];
  const uW = p.width - p.margin * 144, uH = p.height - p.margin * 144;
  const nx = Math.floor(uW / (o * 3)), ny = Math.floor(uH / (o * 2 * vf));
  if (nx < 1 || ny < 1) return { dl: dl, pitch: o, count: 0 };
  const xs = (p.width - o * 3 * nx) / 2 + o;
  const ys = (p.height - o * 2 * vf * ny) / 2;
  for (let k = 0; k / 3 < nx - 0.667; k++) {
    const x = xs + (k / 3) * o * 3;
    let top = false;
    for (let it = 0; it < ny; it++) {
      const y = ys + it * o * 2 * vf;
      const h = vf * o;
      if (!top) { dl.push(["L", x, y, x + o, y]); top = true; }
      dl.push(["L", x - o * 0.5, y + h, x + o * 1.5, y + h]);
      dl.push(["L", x, y, x + o, y + 2 * h]);
      dl.push(["L", x, y + 2 * h, x + o, y]);
      dl.push(["L", x + o * 1.5, y + h, x + o, y + 2 * h]);
      dl.push(["L", x + o, y, x + o * 1.5, y + h]);
      dl.push(["L", x + o, y + 2 * h, x, y + 2 * h]);
      dl.push(["L", x, y, x - o * 0.5, y + h]);
      dl.push(["L", x - o * 0.5, y + h, x, y + 2 * h]);
    }
  }
  return { dl: dl, pitch: o * 2 * vf, count: dl.length };
}

// Shared Cornell note-paper frame. Returns layout; emits border.
// Content drawing and separator lines are per-variant.
const CORNELL_EXTRAS = [
  { t: "pct", id: "hsize", label: "Note width", def: 75 },
  { t: "pct", id: "vsize", label: "Note height", def: 80 },
  { t: "wt", id: "obweight", label: "Border weight", def: 1, min: 0, max: 20 },
  { t: "wt", id: "ihweight", label: "Divider weight", def: 1.5, min: 0.02, max: 20 },
  { t: "chk", id: "cueright", label: "Cue column", text: "Cue on the right", def: false },
  { t: "chk", id: "sumtop", label: "Summary", text: "Summary on top", def: false }
];

function cornellLayout(p, dl) {
  const m = p.margin * 72;
  const uW = p.width - 2 * m, uH = p.height - 2 * m;
  const hsize = correct(p.x.hsize, 0, 100) / 100;
  const vsize = correct(p.x.vsize, 0, 100) / 100;
  const gridW = uW * hsize, gridH = uH * vsize;
  const gridOffset = p.offset;
  const xS = Math.floor(gridW / gridOffset), yS = Math.floor(gridH / gridOffset);
  const lineW = gridW, lineH = gridOffset * yS;
  const xStart = (p.width - lineW) / 2 + (uW - gridW) / 2;
  const yStart = (p.height - lineH) / 2 + (uH - gridH) / 2;
  const ob = correct(p.x.obweight, 0, 20);
  if (ob) {
    dl.push(["S", p.gridColor, ob]);
    dl.push(["L", m, m, p.width - m, m]);
    dl.push(["L", m, p.height - m, p.width - m, p.height - m]);
    dl.push(["L", m, m, m, p.height - m]);
    dl.push(["L", p.width - m, m, p.width - m, p.height - m]);
  }
  return {
    m: m, uW: uW, uH: uH, gridW: gridW, gridH: gridH,
    off: gridOffset, xS: xS, yS: yS, lineW: lineW, lineH: lineH,
    xStart: xStart, yStart: yStart,
    cueRight: !!p.x.cueright, sumTop: !!p.x.sumtop
  };
}

function cornellSeparators(p, dl, L) {
  const m = L.m, W = p.width, H = p.height;
  dl.push(["S", p.gridColor, correct(p.x.ihweight, 0.02, 20)]);
  if (L.sumTop) {
    dl.push(["L", m, H - L.yStart, W - m, H - L.yStart]);
  } else {
    dl.push(["L", m, L.yStart, W - m, L.yStart]);
  }
  if (L.cueRight) {
    if (L.sumTop) dl.push(["L", W - L.xStart, H - L.yStart, W - L.xStart, m]);
    else dl.push(["L", W - L.xStart, H - m, W - L.xStart, L.yStart]);
  } else {
    if (L.sumTop) dl.push(["L", L.xStart, H - L.yStart, L.xStart, m]);
    else dl.push(["L", L.xStart, H - m, L.xStart, L.yStart]);
  }
}

// Shared stacked-squares (character practice) skeleton: boxes at 1.4x
// horizontal pitch, heavy outlines, then thin inner guides per style.
function stackedSquares(p, thinDiv, innerFn) {
  const size = p.offset, dl = [];
  const uW = p.width - p.margin * 144, uH = p.height - p.margin * 144;
  const nx = Math.floor(uW / (size * 1.4)), ny = Math.floor(uH / size);
  if (nx < 1 || ny < 1) return { dl: dl, pitch: size, count: 0 };
  const xs = (p.width - nx * size * 1.4) / 2;
  const ys = (p.height - ny * size) / 2;
  for (let i = 0; i < nx; i++) {
    const x = xs + i * size * 1.4;
    for (let j = 0; j < ny; j++) {
      const y = ys + j * size;
      dl.push(["L", x, y + size, x + size, y + size]);
      dl.push(["L", x, y, x + size, y]);
      dl.push(["L", x, y, x, y + size]);
      dl.push(["L", x + size, y, x + size, y + size]);
    }
  }
  dl.push(["S", p.gridColor, p.weight / thinDiv]);
  for (let i = 0; i < nx; i++) {
    const x = xs + i * size * 1.4;
    for (let j = 0; j < ny; j++) {
      innerFn(dl, x, ys + j * size, size);
    }
  }
  return { dl: dl, pitch: size, count: nx * ny };
}

// Diamond lattice with optional light verticals/horizontals
// (axonometric and intersected diamonds share this source).
function diamondLattice(p) {
  const dl = [], o = p.offset, RT2 = 1.41421356, d = o * 0.707;
  const uW = p.width - p.margin * 144, uH = p.height - p.margin * 144;
  const nx = Math.floor(uW / (o * RT2)), ny = Math.floor(uH / (o * RT2));
  if (nx < 1 || ny < 1) return { dl: dl, pitch: o, count: 0 };
  const xs = p.margin * 72, ys = p.margin * 72 + d;
  let xMax = 0, yMax = 0;
  for (let i = 0; i < nx; i++) {
    const x = xs + i * o * RT2;
    for (let j = 0; j < ny; j++) {
      const y = ys + j * o * RT2;
      dl.push(["L", x, y, x + d, y + d]);
      dl.push(["L", x, y, x + d, y - d]);
      dl.push(["L", x + d, y + d, x + 2 * d, y]);
      dl.push(["L", x + d, y - d, x + 2 * d, y]);
      if (y > yMax) yMax = y;
      if (x > xMax) xMax = x;
    }
  }
  if (p.x.verticals) {
    dl.push(["S", p.gridColor, p.weight / 2]);
    for (let i = 0; i <= nx; i += 0.5) {
      const x = xs + i * o * RT2;
      dl.push(["L", x, ys - d, x, yMax + d]);
    }
  }
  if (p.x.horizontals) {
    dl.push(["S", p.gridColor, p.weight / 2]);
    for (let j = -0.5; j <= ny - 0.5; j += 0.5) {
      const y = ys + j * o * RT2;
      dl.push(["L", xs, y, xMax + 2 * d, y]);
    }
  }
  return { dl: dl, pitch: o * RT2, count: dl.length };
}

const GENERATORS = [

  {
    id: "plain",
    name: "Plain Grid",
    blurb: "Simple squares.",
    spacing: { label: "lines", def: 4 },
    weight: { label: "Line thickness", def: 0.5 },
    extras: [
      { t: "chk", id: "bold", label: "Accent", text: "Bold major axes", def: false }
    ],
    draw: function (p) {
      const g = gridLayout(p), dl = [];
      if (!g.ok) return { dl: dl, pitch: p.offset, count: 0 };
      const x0 = g.xStart, x1 = g.xStart + g.nx * p.offset;
      const y0 = g.yStart, y1 = g.yStart + g.ny * p.offset;
      for (let i = 0; i <= g.nx; i++) {
        const x = x0 + i * p.offset;
        dl.push(["L", x, y0, x, y1]);
      }
      for (let j = 0; j <= g.ny; j++) {
        const y = y0 + j * p.offset;
        dl.push(["L", x0, y, x1, y]);
      }
      if (p.x.bold) {
        dl.push(["S", p.gridColor, p.weight * 3]);
        dl.push(["L", x0 + Math.round(g.nx / 2) * p.offset, y0,
                       x0 + Math.round(g.nx / 2) * p.offset, y1]);
        dl.push(["L", x0, y0 + Math.round(g.ny / 2) * p.offset,
                       x1, y0 + Math.round(g.ny / 2) * p.offset]);
      }
      return { dl: dl, pitch: p.offset, count: g.nx + g.ny + 4 };
    },
    picks: [
      { name: "1cm Fine Grid",
        set: { spacing: "1", spacing_units: "cm", weight: "0.35", gridColor: "b3b3b3" } },
      { name: "Axis Graphing · 4/inch",
        set: { spacing: "4", spacing_units: "inch", weight: "0.5", gridColor: "b3b3ff", bold: "1" } },
      { name: "Big & Bold · 2/inch",
        set: { spacing: "2", spacing_units: "inch", weight: "1.5", gridColor: "000000" } }
    ]
  },

  {
    id: "squarecross",
    name: "Cross Grid",
    blurb: "Plus marks at intersections.",
    note: "Common spacing for most bullet journals is 5mm. Standard colors are 70% Medium Grey, Graph Blue, and Fade \u2014 a very light sepia designed to be invisible almost all the time. It can be a challenge in low-light situations.",
    spacing: { label: "lines", def: 2 },
    weight: { label: "Line thickness", def: 0.7 },
    extras: [
      { t: "pct", id: "crossx", label: "Horizontal length", def: 20 },
      { t: "pct", id: "crossy", label: "Vertical length", def: 20 }
    ],
    draw: function (p) {
      const g = gridLayout(p), dl = [];
      if (!g.ok) return { dl: dl, pitch: p.offset, count: 0 };
      const hx = (correct(p.x.crossx, 0, 100) / 200) * p.offset;
      const hy = (correct(p.x.crossy, 0, 100) / 200) * p.offset;
      for (let i = 0; i <= g.nx; i++) {
        const x = g.xStart + i * p.offset;
        for (let j = 0; j <= g.ny; j++) {
          const y = g.yStart + j * p.offset;
          if (hx > 0) dl.push(["L", x - hx, y, x + hx, y]);
          if (hy > 0) dl.push(["L", x, y - hy, x, y + hy]);
        }
      }
      return { dl: dl, pitch: p.offset, count: (g.nx + 1) * (g.ny + 1) };
    },
    picks: [
      { name: "5mm · 10% · Graph Blue",
        set: { spacing: "2", spacing_units: "cm", crossx: "10", crossy: "10",
               weight: "0.7", gridColor: "b3b3ff" } },
      { name: "5mm · 10% · Grey",
        set: { spacing: "2", spacing_units: "cm", crossx: "10", crossy: "10",
               weight: "0.7", gridColor: "c8c8c8" } },
      { name: "5mm · 10% · Fade",
        set: { spacing: "2", spacing_units: "cm", crossx: "10", crossy: "10",
               weight: "0.7", gridColor: "ece0c4" } },
      { name: "Vertical Lines · Green",
        set: { spacing: "5", spacing_units: "inch", crossx: "0", crossy: "100",
               weight: "0.7", gridColor: "00b300" } },
      { name: "Writing Paper w/ Ticks",
        set: { spacing: "5", spacing_units: "inch", crossx: "100", crossy: "10",
               weight: "0.7", gridColor: "000000" } },
      { name: "Dense Red",
        set: { spacing: "10", spacing_units: "inch", crossx: "20", crossy: "20",
               weight: "0.4", gridColor: "cc0000" } }
    ]
  },

  {
    id: "squaredots",
    name: "Square Dots",
    blurb: "A dot at every intersection.",
    note: "5mm is the commonly accepted bullet journal standard. But not everyone is standard!",
    spacing: { label: "dots", def: 4 },
    weight: { label: "Dot size", def: 0.7 },
    extras: [],
    draw: function (p) {
      const g = gridLayout(p), dl = [];
      if (!g.ok) return { dl: dl, pitch: p.offset, count: 0 };
      for (let i = 0; i <= g.nx; i++) {
        const x = g.xStart + i * p.offset;
        for (let j = 0; j <= g.ny; j++) {
          dl.push(["D", x, g.yStart + j * p.offset, p.weight / 2]);
        }
      }
      return { dl: dl, pitch: p.offset, count: (g.nx + 1) * (g.ny + 1) };
    },
    picks: [
      { name: "5mm Bullet Journal · Grey",
        set: { spacing: "2", spacing_units: "cm", weight: "0.5", gridColor: "c0c0c0" } },
      { name: "Classic · 4/inch",
        set: { spacing: "4", spacing_units: "inch", weight: "0.7", gridColor: "000000" } },
      { name: "Big Dots · 2/inch",
        set: { spacing: "2", spacing_units: "inch", weight: "1.5", gridColor: "b3b3ff" } }
    ]
  },

  {
    id: "hexagonal",
    name: "Hexagonal",
    blurb: "Honeycomb.",
    note: "Hex math, given side length x: tip to tip is 2x, flat to flat is about 1.732x, and area is about 2.6x\u00b2. So for 4 hexes per square inch: 4 \u00d7 2.6x\u00b2 = 1, giving x \u2248 0.31 inches per side.",
    spacing: { label: "hexes", def: 4 },
    weight: { label: "Line thickness", def: 0.5 },
    extras: [
      { t: "chk", id: "dot", label: "Add dot", text: "Dot in the middle of each hexagon", def: false }
    ],
    draw: function (p) {
      const dl = [];
      // spacing = hexes per unit, measured vertically flat-to-flat.
      const h = p.offset;             // hex height (across flats)
      const s = h / Math.sqrt(3);     // side length
      const usableW = p.width - p.margin * 144;
      const usableH = p.height - p.margin * 144;
      // n columns occupy s*(1.5n + 0.5); staggered rows occupy h*(rows + 0.5)
      const cols = Math.floor((usableW / s - 0.5) / 1.5);
      const rows = Math.floor(usableH / h - 0.5);
      if (cols < 1 || rows < 1) return { dl: dl, pitch: h, count: 0 };
      const totalW = s * (1.5 * cols + 0.5);
      const totalH = h * (rows + 0.5);
      const left = (p.width - totalW) / 2;
      const bottom = (p.height - totalH) / 2;

      for (let i = 0; i < cols; i++) {
        const cx = left + s * (1 + 1.5 * i);
        const stag = (i % 2) ? h / 2 : 0;
        for (let j = 0; j < rows; j++) {
          const cy = bottom + h / 2 + j * h + stag;
          if (cy + h / 2 > bottom + totalH + 0.01) continue;
          dl.push(["P", [
            cx - s, cy,
            cx - s / 2, cy + h / 2,
            cx + s / 2, cy + h / 2,
            cx + s, cy,
            cx + s / 2, cy - h / 2,
            cx - s / 2, cy - h / 2
          ], true]);
          if (p.x.dot) dl.push(["D", cx, cy, p.weight * 1.5]);
        }
      }
      return { dl: dl, pitch: h, count: cols * rows };
    },
    picks: [
      { name: "4 per inch · Grey",
        set: { spacing: "4", spacing_units: "inch", weight: "0.5", gridColor: "b3b3b3" } },
      { name: "Small Hexes · 8/inch",
        set: { spacing: "8", spacing_units: "inch", weight: "0.35", gridColor: "b3b3b3" } },
      { name: "With Center Dots",
        set: { spacing: "4", spacing_units: "inch", weight: "0.5", gridColor: "000000", dot: "1" } }
    ]
  },

  {
    id: "triangle",
    name: "Triangle",
    blurb: "Equilateral triangles.",
    spacing: { mode: "size", label: "Triangle size", def: 0.25 },
    weight: { label: "Line thickness", def: 0.5 },
    extras: [],
    draw: function (p) { return triGridDraw(p, 0.866); },
    picks: [
      { name: "Quarter Inch · Grey",
        set: { spacing: "0.25", spacing_units: "inch", weight: "0.5", gridColor: "b3b3b3" } },
      { name: "Half Inch · Blue",
        set: { spacing: "0.5", spacing_units: "inch", weight: "0.5", gridColor: "b3b3ff" } }
    ]
  },

  {
    id: "diamond",
    name: "Diamond Trapezoid",
    blurb: "Triangles minus the horizontals.",
    spacing: { mode: "size", label: "Diamond size", def: 0.25 },
    weight: { label: "Line thickness", def: 0.5 },
    extras: [],
    draw: function (p) {
      const o = p.offset, R = 0.866, dl = [];
      const uW = p.width - p.margin * 144, uH = p.height - p.margin * 144;
      const nx = Math.floor(uW / (o * 3)), ny = Math.floor(uH / (o * 2 * R));
      if (nx < 1 || ny < 1) return { dl: dl, pitch: o, count: 0 };
      const xs = (p.width - o * 3 * nx) / 2 + o;
      const ys = (p.height - o * 2 * R * ny) / 2;
      for (let k = 0; k / 3 < nx - 0.667; k++) {
        const x = xs + (k / 3) * o * 3;
        for (let it = 0; it < ny; it++) {
          const y = ys + it * o * 2 * R;
          dl.push(["L", x, y, x + o, y + 2 * R * o]);
          dl.push(["L", x, y + 2 * R * o, x + o, y]);
          dl.push(["L", x + o * 1.5, y + R * o, x + o, y + 2 * R * o]);
          dl.push(["L", x + o, y, x + o * 1.5, y + R * o]);
          dl.push(["L", x, y, x - o * 0.5, y + R * o]);
          dl.push(["L", x - o * 0.5, y + R * o, x, y + 2 * R * o]);
        }
      }
      return { dl: dl, pitch: o * 2 * R, count: dl.length };
    },
    picks: [
      { name: "Quarter Inch · Grey",
        set: { spacing: "0.25", spacing_units: "inch", weight: "0.5", gridColor: "b3b3b3" } }
    ]
  },

  {
    id: "isometricdots",
    name: "Isometric Dots",
    blurb: "Staggered dots for 3D work.",
    spacing: { mode: "size", label: "Dot spacing", def: 0.25 },
    weight: { label: "Dot size", def: 1 },
    extras: [],
    draw: function (p) {
      const g = gridLayout(p), dl = [];
      if (!g.ok) return { dl: dl, pitch: p.offset, count: 0 };
      for (let i = 0; i <= g.nx; i++) {
        for (let j = 0; j <= g.ny; j++) {
          const shifted = j % 2 === 1;
          if (shifted && i === g.nx) continue;
          dl.push(["D",
            g.xStart + i * p.offset + (shifted ? p.offset / 2 : 0),
            g.yStart + j * p.offset, p.weight / 2]);
        }
      }
      return { dl: dl, pitch: p.offset, count: dl.length };
    },
    picks: [
      { name: "Quarter Inch · Black",
        set: { spacing: "0.25", spacing_units: "inch", weight: "1", gridColor: "000000" } },
      { name: "1cm · Grey",
        set: { spacing: "1", spacing_units: "cm", weight: "0.8", gridColor: "b3b3b3" } }
    ]
  },

  {
    id: "octagon",
    name: "Octagonal",
    blurb: "Octagons, diamonds between.",
    spacing: { mode: "size", label: "Cell size", def: 0.5 },
    weight: { label: "Line thickness", def: 0.5 },
    extras: [],
    draw: function (p) {
      const o = p.offset, a = 0.292893219, b = 0.707106781, dl = [];
      const g = gridLayout(p);
      if (!g.ok || g.nx < 1 || g.ny < 1) return { dl: dl, pitch: o, count: 0 };
      for (let i = 0; i < g.nx; i++) {
        const x = g.xStart + i * o;
        for (let j = 0; j < g.ny; j++) {
          const y = g.yStart + j * o;
          dl.push(["L", x + a * o, y, x + b * o, y]);
          dl.push(["L", x + a * o, y + o, x + b * o, y + o]);
          dl.push(["L", x, y + a * o, x, y + b * o]);
          dl.push(["L", x + o, y + a * o, x + o, y + b * o]);
          dl.push(["L", x + a * o, y, x, y + a * o]);
          dl.push(["L", x + b * o, y, x + o, y + a * o]);
          dl.push(["L", x, y + b * o, x + a * o, y + o]);
          dl.push(["L", x + b * o, y + o, x + o, y + b * o]);
        }
      }
      return { dl: dl, pitch: o, count: dl.length };
    },
    picks: [
      { name: "Half Inch · Grey",
        set: { spacing: "0.5", spacing_units: "inch", weight: "0.5", gridColor: "b3b3b3" } }
    ]
  },

  {
    id: "brick",
    name: "Brick Layout",
    blurb: "Running bond.",
    spacing: { label: "rows", def: 2 },
    weight: { label: "Line thickness", def: 0.7 },
    extras: [
      { t: "sp2", id: "vspacing", label: "Bricks across", def: 1 }
    ],
    draw: function (p) {
      const dl = [];
      const hOffset = p.offset;
      const vOffset = perOffset(p.x.vspacing, p.x.vspacing_units);
      const uW = p.width - p.margin * 144, uH = p.height - p.margin * 144;
      const xS = Math.floor(uW / vOffset), yS = Math.floor(uH / hOffset);
      if (xS < 1 || yS < 1) return { dl: dl, pitch: hOffset, count: 0 };
      const lw = vOffset * xS, lh = hOffset * yS;
      const xStart = (p.width - lw) / 2, yStart = (p.height - lh) / 2;
      const wt = p.weight;
      let y = yStart, hCount = 0;
      while (y <= (p.height - yStart) + 0.005) {
        dl.push(["L", xStart - wt / 2, y, xStart + lw + wt / 2, y]);
        y += hOffset; hCount++;
      }
      for (let z = 0; z < hCount - 1; z++) {
        let x = xStart;
        y = yStart + z * hOffset;
        while (x <= (p.width - xStart) + 0.005) {
          if (z % 2 === 0) {
            dl.push(["L", x, y - wt / 2, x, y + hOffset + wt / 2]);
          } else if (x + vOffset / 2 <= (p.width - xStart) + 0.005) {
            dl.push(["L", x + vOffset / 2, y - wt / 2,
                          x + vOffset / 2, y + hOffset + wt / 2]);
          }
          x += vOffset;
        }
      }
      return { dl: dl, pitch: Math.min(hOffset, vOffset), count: dl.length };
    },
    picks: [
      { name: "Classic Brick",
        set: { spacing: "2", spacing_units: "inch", vspacing: "1", vspacing_units: "inch",
               weight: "0.7", gridColor: "aa4444" } }
    ]
  },

  {
    id: "engineer",
    name: "Engineer",
    blurb: "Two weights, offset starts.",
    spacing: { label: "rows", def: 5 },
    weight: { label: "Horizontal weight", def: 0.5 },
    extras: [
      { t: "sp2", id: "vspacing", label: "Columns", def: 5 },
      { t: "wt", id: "hweight", label: "Vertical weight", def: 0.5, min: 0.01, max: 20 },
      { t: "num", id: "hsuper", label: "Skip columns", def: 0, min: 0, max: 40 },
      { t: "num", id: "vsuper", label: "Skip rows", def: 0, min: 0, max: 40 }
    ],
    draw: function (p) {
      const dl = [];
      const hOffset = p.offset;
      const vOffset = perOffset(p.x.vspacing, p.x.vspacing_units);
      const vW = p.weight;
      const hW = correct(p.x.hweight, 0.01, 20);
      const hsuper = correct(p.x.hsuper, 0, 40);
      const vsuper = correct(p.x.vsuper, 0, 40);
      const uW = p.width - p.margin * 144, uH = p.height - p.margin * 144;
      const xS = Math.floor(uW / vOffset), yS = Math.floor(uH / hOffset);
      if (xS < 1 || yS < 1) return { dl: dl, pitch: hOffset, count: 0 };
      const lw = vOffset * xS, lh = hOffset * yS;
      const xStart = (p.width - lw) / 2, yStart = (p.height - lh) / 2;
      let y = yStart;
      while (y <= (p.height - yStart) + 0.005 - vsuper * hOffset) {
        dl.push(["L", xStart - vW / 2, y, xStart + lw + vW / 2, y]);
        y += hOffset;
      }
      dl.push(["S", p.gridColor, hW]);
      let x = xStart + hsuper * vOffset;
      while (x <= (p.width - xStart) + 0.005) {
        dl.push(["L", x, yStart - hW / 2, x, yStart + lh + hW / 2]);
        x += vOffset;
      }
      return { dl: dl, pitch: Math.min(hOffset, vOffset), count: dl.length };
    },
    picks: [
      { name: "5 per inch · Green",
        set: { spacing: "5", spacing_units: "inch", vspacing: "5", vspacing_units: "inch",
               weight: "0.5", hweight: "0.5", gridColor: "00b300" } }
    ]
  },

  {
    id: "lined",
    name: "Lined",
    blurb: "Horizontal lines. That's it.",
    spacing: { label: "lines", def: 4, min: 0.2, max: 501 },
    weight: { label: "Line thickness", def: 0.5 },
    extras: [],
    draw: function (p) {
      const g = gridLayout(p), dl = [];
      if (!g.ok) return { dl: dl, pitch: p.offset, count: 0 };
      const lw = p.offset * g.nx, wt = p.weight;
      let y = g.yStart;
      while (y <= (p.height - g.yStart) + 0.005) {
        dl.push(["L", g.xStart - wt / 2, y, g.xStart + lw + wt / 2, y]);
        y += p.offset;
      }
      return { dl: dl, pitch: p.offset, count: dl.length };
    },
    picks: [
      { name: "College-ish · Blue",
        set: { spacing: "3.56", spacing_units: "inch", weight: "0.5", gridColor: "b3b3ff" } },
      { name: "Wide · Grey",
        set: { spacing: "3", spacing_units: "inch", weight: "0.5", gridColor: "b3b3b3" } }
    ]
  },

  {
    id: "writing",
    name: "Writing Paper",
    blurb: "Baseline, midline, dashed.",
    spacing: { mode: "size", label: "Writing size", def: 0.25 },
    weight: { label: "Line thickness", def: 0.7 },
    extras: [],
    draw: function (p) {
      const dl = [];
      const o = p.offset * (4 / 3);  // original: offset = writingSize * 96pt
      const uW = p.width - p.margin * 144, uH = p.height - p.margin * 144;
      const yS = Math.floor(uH / o);
      if (yS < 1 || uW <= 0) return { dl: dl, pitch: o, count: 0 };
      const lw = uW, lh = o * yS;
      const xStart = (p.width - lw) / 2, yStart = (p.height - lh) / 2;
      let y = yStart;
      while (y + o <= p.height - yStart) {
        dl.push(["L", xStart, y + o * (2 / 3), xStart + lw, y + o * (2 / 3)]);
        dl.push(["L", xStart, y, xStart + lw, y]);
        y += o;
      }
      dl.push(["S", p.gridColor, p.weight / 2, [10, 6]]);
      y = yStart;
      while (y + o <= p.height - yStart) {
        dl.push(["L", xStart, y + o / 3, xStart + lw, y + o / 3]);
        y += o;
      }
      return { dl: dl, pitch: o, count: dl.length };
    },
    picks: [
      { name: "Primary · 1/2 inch",
        set: { spacing: "0.5", spacing_units: "inch", weight: "0.7", gridColor: "b3b3ff" } },
      { name: "Intermediate · 1/4 inch",
        set: { spacing: "0.25", spacing_units: "inch", weight: "0.7", gridColor: "b3b3b3" } }
    ]
  },

  {
    id: "boldsquaredots",
    name: "Bold Square Dots",
    blurb: "Alternating big and small dots.",
    spacing: { label: "dots", def: 4 },
    weight: { label: "Dot size", def: 1 },
    extras: [],
    draw: function (p) {
      const g = gridLayout(p), dl = [];
      if (!g.ok) return { dl: dl, pitch: p.offset, count: 0 };
      for (let i = 0; i <= g.nx; i++) {
        const x = g.xStart + i * p.offset;
        const r = (i % 2 === 0) ? p.weight / 2 : p.weight;
        for (let j = 0; j <= g.ny; j++) {
          dl.push(["D", x, g.yStart + j * p.offset, r]);
        }
      }
      return { dl: dl, pitch: p.offset, count: dl.length };
    },
    picks: [
      { name: "4 per inch · Grey",
        set: { spacing: "4", spacing_units: "inch", weight: "1", gridColor: "b3b3b3" } }
    ]
  },

  {
    id: "linedots",
    name: "Lined Dots",
    blurb: "Dots plus guide lines.",
    spacing: { label: "lines", def: 4 },
    weight: { label: "Dot size", def: 1 },
    extras: [
      { t: "wt", id: "lineweight", label: "Line thickness", def: 0.3, min: 0.01, max: 20 }
    ],
    draw: function (p) {
      const g = gridLayout(p), dl = [];
      if (!g.ok) return { dl: dl, pitch: p.offset, count: 0 };
      for (let i = 0; i <= g.nx; i++) {
        const x = g.xStart + i * p.offset;
        for (let j = 0; j <= g.ny; j++) {
          dl.push(["D", x, g.yStart + j * p.offset, p.weight / 2]);
        }
      }
      dl.push(["S", p.gridColor, correct(p.x.lineweight, 0.01, 20)]);
      const xb = g.xStart + g.nx * p.offset;
      for (let j = 0; j <= g.ny; j++) {
        const y = g.yStart + j * p.offset;
        dl.push(["L", g.xStart, y, xb, y]);
      }
      return { dl: dl, pitch: p.offset, count: dl.length };
    },
    picks: [
      { name: "5mm · Grey",
        set: { spacing: "2", spacing_units: "cm", weight: "0.8", lineweight: "0.25", gridColor: "b3b3b3" } }
    ]
  },

  {
    id: "offsetsquaredots",
    name: "Offset Dots",
    blurb: "Every other dot.",
    spacing: { label: "dots", def: 4 },
    weight: { label: "Dot size", def: 1 },
    extras: [],
    draw: function (p) {
      const g = gridLayout(p), dl = [];
      if (!g.ok) return { dl: dl, pitch: p.offset, count: 0 };
      for (let i = 0; i <= g.nx; i++) {
        const x = g.xStart + i * p.offset;
        for (let j = 0; j <= g.ny; j++) {
          if ((i + j) % 2) dl.push(["D", x, g.yStart + j * p.offset, p.weight / 2]);
        }
      }
      return { dl: dl, pitch: p.offset, count: dl.length };
    },
    picks: [
      { name: "4 per inch · Black",
        set: { spacing: "4", spacing_units: "inch", weight: "1", gridColor: "000000" } }
    ]
  },

  {
    id: "gridlined",
    name: "Grid Lined",
    blurb: "Fine grid, heavier writing lines.",
    note: "These are custom-created pieces I\u2019ve gotten requests for. They have thicker lines every so often.",
    spacing: { label: "lines", def: 8 },
    weight: { label: "Major line weight", def: 1 },
    extras: [
      { t: "num", id: "minorweight", label: "Minor line weight", def: 0.3, min: 0.02, max: 20 },
      { t: "num", id: "boxesperline", label: "Lines per writing row", def: 4, min: 0.1, max: 50 }
    ],
    draw: function (p) {
      const dl = [];
      const minorOffset = p.offset;
      const boxes = correct(p.x.boxesperline, 0.1, 50);
      const majorOffset = minorOffset * boxes;
      const minW = correct(p.x.minorweight, 0.02, 20);
      const uW = p.width - p.margin * 144, uH = p.height - p.margin * 144;
      const xS = Math.floor(uW / majorOffset), yS = Math.floor(uH / majorOffset);
      if (xS < 1 || yS < 1) return { dl: dl, pitch: minorOffset, count: 0 };
      const lw = majorOffset * xS, lh = majorOffset * yS;
      const xStart = (p.width - lw) / 2, yStart = (p.height - lh) / 2;
      let y = yStart;
      while (y + majorOffset * 2 <= (p.height - yStart) + 0.005) {
        y += majorOffset;
        dl.push(["L", xStart - minW / 2, y, xStart + lw + minW / 2, y]);
      }
      dl.push(["S", p.gridColor, minW]);
      y = yStart;
      while (y <= (p.height - yStart) + 0.005) {
        dl.push(["L", xStart - minW / 2, y, xStart + lw + minW / 2, y]);
        y += minorOffset;
      }
      let x = xStart;
      while (x <= (p.width - xStart) + 0.005) {
        dl.push(["L", x, yStart - minW / 2, x, yStart + lh + minW / 2]);
        x += minorOffset;
      }
      return { dl: dl, pitch: minorOffset, count: dl.length };
    },
    picks: [
      { name: "Note Grid · Blue",
        set: { spacing: "8", spacing_units: "inch", boxesperline: "4",
               weight: "1", minorweight: "0.25", gridColor: "b3b3ff" } }
    ]
  },

  {
    id: "doublelined",
    name: "Double Lined",
    blurb: "Two inner guide lines.",
    spacing: { mode: "size", label: "Writing size", def: 0.33 },
    weight: { label: "Line thickness", def: 0.7 },
    extras: [
      { t: "chk", id: "dashed", label: "Style", text: "Dashed inner lines", def: false }
    ],
    draw: function (p) {
      const dl = [];
      const o = p.offset * (4 / 3);
      const uW = p.width - p.margin * 144, uH = p.height - p.margin * 144;
      const yS = Math.floor(uH / o);
      if (yS < 1 || uW <= 0) return { dl: dl, pitch: o, count: 0 };
      const lw = uW, lh = o * yS;
      const xStart = (p.width - lw) / 2, yStart = (p.height - lh) / 2;
      let y = yStart;
      while (y + o <= p.height - yStart) {
        dl.push(["L", xStart, y + o * (2 / 3), xStart + lw, y + o * (2 / 3)]);
        dl.push(["L", xStart, y, xStart + lw, y]);
        y += o;
      }
      dl.push(["S", p.gridColor, p.weight / 3, p.x.dashed ? [10, 6] : null]);
      y = yStart;
      while (y + o <= p.height - yStart) {
        dl.push(["L", xStart, y + o * (2 / 9), xStart + lw, y + o * (2 / 9)]);
        dl.push(["L", xStart, y + o * (4 / 9), xStart + lw, y + o * (4 / 9)]);
        y += o;
      }
      return { dl: dl, pitch: o, count: dl.length };
    },
    picks: [
      { name: "Calligraphy · Dashed",
        set: { spacing: "0.33", spacing_units: "inch", weight: "0.7",
               dashed: "1", gridColor: "b3b3b3" } }
    ]
  },

  {
    id: "tumblingblock",
    name: "Tumbling Block",
    blurb: "The 3D cube illusion.",
    spacing: { mode: "size", label: "Block size", def: 0.33 },
    weight: { label: "Line thickness", def: 0.5 },
    extras: [],
    draw: function (p) {
      const o = p.offset, R = 0.866, dl = [];
      const uW = p.width - p.margin * 144, uH = p.height - p.margin * 144;
      const nx = Math.floor(uW / (o * 3)), ny = Math.floor(uH / (o * 2 * R));
      if (nx < 1 || ny < 1) return { dl: dl, pitch: o, count: 0 };
      const xs = (p.width - o * 3 * nx) / 2 + o * 0.5;
      const ys = (p.height - o * 2 * R * ny) / 2;
      for (let xit = 0; xit < nx - 0.667; xit++) {
        const x = xs + xit * o * 3;
        let top = false;
        for (let it = 0; it < ny; it++) {
          const y = ys + it * o * 2 * R;
          const h = R * o;
          if (!top) { dl.push(["L", x, y, x + 2 * o, y]); top = true; }
          dl.push(["L", x - o * 0.5, y + h, x + o * 0.5, y + h]);
          dl.push(["L", x + o * 1.5, y + h, x + o * 2.5, y + h]);
          dl.push(["L", x + o, y, x + o * 0.5, y + h]);
          dl.push(["L", x + o * 0.5, y + h, x + o, y + 2 * h]);
          dl.push(["L", x + o * 1.5, y + h, x + o, y + 2 * h]);
          dl.push(["L", x + o * 1.5, y + h, x + o, y]);
          dl.push(["L", x + o * 2.5, y + h, x + 2 * o, y + 2 * h]);
          dl.push(["L", x + 2 * o, y, x + o * 2.5, y + h]);
          dl.push(["L", x + 2 * o, y + 2 * h, x, y + 2 * h]);
          dl.push(["L", x, y, x - o * 0.5, y + h]);
          dl.push(["L", x - o * 0.5, y + h, x, y + 2 * h]);
        }
      }
      return { dl: dl, pitch: o * 2 * R, count: dl.length };
    },
    picks: [
      { name: "Third Inch · Grey",
        set: { spacing: "0.33", spacing_units: "inch", weight: "0.5", gridColor: "b3b3b3" } }
    ]
  },

  {
    id: "moorish",
    name: "Moorish",
    blurb: "Narrow and wide bands.",
    spacing: { mode: "size", label: "Margin size", def: 0.25 },
    weight: { label: "Grid line weight", def: 0.5 },
    extras: [
      { t: "num", id: "ratio", label: "Body ratio", def: 3, min: 0.2, max: 20 }
    ],
    draw: function (p) {
      const dl = [];
      const unit = p.offset;
      const ratio = correct(p.x.ratio, 0.2, 20);
      const dealie = unit + ratio * unit;
      const uW = p.width - p.margin * 144, uH = p.height - p.margin * 144;
      let xI = Math.floor(uW / dealie);
      if (xI * dealie + unit > uW) xI--;
      let yI = Math.floor(uH / dealie);
      if (yI * dealie + unit > uH) yI--;
      if (xI < 0 || yI < 0) return { dl: dl, pitch: dealie, count: 0 };
      const lw = dealie * xI + unit, lh = dealie * yI + unit;
      const xStart = (p.width - lw) / 2, yStart = (p.height - lh) / 2;
      const wt = p.weight;
      let y = yStart, marker = 0;
      while (y <= (p.height - yStart) + 0.005) {
        dl.push(["L", xStart - wt / 2, y, xStart + lw + wt / 2, y]);
        y += marker ? unit * ratio : unit;
        marker = 1 - marker;
      }
      let x = xStart;
      marker = 0;
      while (x <= (p.width - xStart) + 0.005) {
        dl.push(["L", x, yStart - wt / 2, x, yStart + lh + wt / 2]);
        x += marker ? unit * ratio : unit;
        marker = 1 - marker;
      }
      return { dl: dl, pitch: dealie, count: dl.length };
    },
    picks: [
      { name: "Quarter Inch · 3x · Blue",
        set: { spacing: "0.25", spacing_units: "inch", ratio: "3",
               weight: "0.5", gridColor: "0000b3" } }
    ]
  },

  {
    id: "detached",
    name: "Detached Squares",
    blurb: "Squares with breathing room.",
    spacing: { mode: "size", label: "Square size", def: 0.25, max: 10 },
    weight: { label: "Line thickness", def: 0.7 },
    extras: [
      { t: "sz2", id: "spaceSize", label: "Spacing", def: 0.25 }
    ],
    draw: function (p) {
      const dl = [];
      const sq = p.offset;
      const sp = sizePts(p.x.spaceSize, p.x.spaceSize_units, 0.1, 10);
      const offset = sq + sp;
      const uW = p.width - p.margin * 144, uH = p.height - p.margin * 144;
      const nx = Math.floor(uW / offset) - 1, ny = Math.floor(uH / offset) - 1;
      if (nx < 0 || ny < 0) return { dl: dl, pitch: offset, count: 0 };
      const lw = offset * nx, lh = offset * ny;
      const xStart = (p.width - lw) / 2, yStart = (p.height - lh) / 2;
      const wt = p.weight;
      for (let i = 0; i <= nx; i++) {
        const x = xStart + i * offset - sp / 2;
        for (let j = 0; j <= ny; j++) {
          const y = yStart + j * offset - sp / 2;
          dl.push(["L", x - wt / 2, y, x + sq + wt / 2, y]);
          dl.push(["L", x, y, x, y + sq]);
          dl.push(["L", x + sq, y, x + sq, y + sq]);
          dl.push(["L", x - wt / 2, y + sq, x + sq + wt / 2, y + sq]);
        }
      }
      return { dl: dl, pitch: offset, count: dl.length };
    },
    picks: [
      { name: "Quarter + Quarter · Grey",
        set: { spacing: "0.25", spacing_units: "inch", spaceSize: "0.25",
               spaceSize_units: "inch", weight: "0.7", gridColor: "b3b3b3" } }
    ]
  },

  {
    id: "inverted",
    name: "Inverted",
    blurb: "Ink field, paper lines.",
    spacing: { label: "lines", def: 4 },
    weight: { label: "Line thickness", def: 0.7 },
    extras: [
      { t: "chk", id: "bold", label: "Accent", text: "Bold major axes", def: false }
    ],
    draw: function (p) {
      const g = gridLayout(p), dl = [];
      if (!g.ok) return { dl: dl, pitch: p.offset, count: 0 };
      const uW = p.width - p.margin * 144, uH = p.height - p.margin * 144;
      dl.push(["R", p.margin * 72, p.margin * 72, uW, uH]);
      dl.push(["S", "ffffff", p.weight]);
      const lw = p.offset * g.nx, lh = p.offset * g.ny, wt = p.weight;
      let y = g.yStart;
      while (y <= (p.height - g.yStart) + 0.005) {
        dl.push(["L", g.xStart - wt / 2, y, g.xStart + lw + wt / 2, y]);
        y += p.offset;
      }
      let x = g.xStart;
      while (x <= (p.width - g.xStart) + 0.005) {
        dl.push(["L", x, g.yStart - wt / 2, x, g.yStart + lh + wt / 2]);
        x += p.offset;
      }
      if (p.x.bold) {
        dl.push(["S", "ffffff", wt * 3]);
        dl.push(["L", g.xStart, g.yStart + Math.floor(g.ny / 2) * p.offset,
                      g.xStart + lw, g.yStart + Math.floor(g.ny / 2) * p.offset]);
        dl.push(["L", g.xStart + Math.floor(g.nx / 2) * p.offset, g.yStart,
                      g.xStart + Math.floor(g.nx / 2) * p.offset, g.yStart + lh]);
      }
      return { dl: dl, pitch: p.offset, count: dl.length };
    },
    picks: [
      { name: "Blue Field · 4/inch",
        set: { spacing: "4", spacing_units: "inch", weight: "0.7", gridColor: "0000b3" } }
    ]
  },

  {
    id: "vartriangle",
    name: "Variable Triangle",
    blurb: "Triangles, any angle.",
    note: "This one had some issues in the math that were never tracked down. Possibly because I dislike trig so much.",
    spacing: { mode: "size", label: "Triangle base", def: 0.25 },
    weight: { label: "Line thickness", def: 0.5 },
    extras: [
      { t: "num", id: "angle", label: "Angle (degrees)", def: 60, min: 5, max: 85 }
    ],
    draw: function (p) {
      const angle = correct(p.x.angle, 5, 85);
      const vf = 0.5 * Math.tan((angle / 180) * Math.PI);
      return triGridDraw(p, vf);
    },
    picks: [
      { name: "45° · Grey",
        set: { spacing: "0.25", spacing_units: "inch", angle: "45", weight: "0.5", gridColor: "b3b3b3" } }
    ]
  },

  {
    id: "68degree",
    name: "68° Triangle",
    blurb: "The 68° drafting classic.",
    spacing: { mode: "size", label: "Triangle base", def: 0.25 },
    weight: { label: "Line thickness", def: 0.5 },
    extras: [],
    draw: function (p) { return triGridDraw(p, 0.927); },
    picks: [
      { name: "Quarter Inch · Grey",
        set: { spacing: "0.25", spacing_units: "inch", weight: "0.5", gridColor: "b3b3b3" } }
    ]
  },

  {
    id: "circle",
    name: "Circle Hex",
    blurb: "Circles, honeycomb packed.",
    spacing: { mode: "size", label: "Circle spacing", def: 0.5 },
    weight: { label: "Line thickness", def: 0.5 },
    extras: [
      { t: "num", id: "radius", label: "Size (× spacing)", def: 1, min: 0.2, max: 3 }
    ],
    draw: function (p) {
      const dl = [];
      const o = p.offset;
      const rr = correct(p.x.radius, 0.2, 3);
      const uW = p.width - (p.margin * 144 + o * rr);
      const uH = p.height - (p.margin * 144 + o * rr);
      const nx = Math.floor(uW / o), ny = Math.floor(uH / o);
      if (nx < 0 || ny < 0) return { dl: dl, pitch: o, count: 0 };
      const xs = (p.width - o * nx) / 2, ys = (p.height - o * ny) / 2;
      for (let xit = 0; xit <= nx; xit++) {
        const x = xs + xit * o;
        for (let it = 0; it <= ny * 1.135; it++) {
          const y = ys + it * o / 1.135;
          const shifted = it % 2 === 1;
          if (shifted && xit === nx) continue;
          dl.push(["C", x + (shifted ? o / 2 : 0), y, (o / 2) * rr]);
        }
      }
      return { dl: dl, pitch: o, count: dl.length };
    },
    picks: [
      { name: "Half Inch · Grey",
        set: { spacing: "0.5", spacing_units: "inch", radius: "1", weight: "0.5", gridColor: "b3b3b3" } }
    ]
  },

  {
    id: "circlegrid",
    name: "Circle Grid",
    blurb: "Circles in rows.",
    spacing: { mode: "size", label: "Circle spacing", def: 0.5 },
    weight: { label: "Line thickness", def: 0.5 },
    extras: [
      { t: "num", id: "radius", label: "Size (× spacing)", def: 1, min: 0.2, max: 3 }
    ],
    draw: function (p) {
      const dl = [];
      const o = p.offset;
      const rr = correct(p.x.radius, 0.2, 3);
      const uW = p.width - (p.margin * 144 + o * rr);
      const uH = p.height - (p.margin * 144 + o * rr);
      const nx = Math.floor(uW / o), ny = Math.floor(uH / o);
      if (nx < 0 || ny < 0) return { dl: dl, pitch: o, count: 0 };
      const xs = (p.width - o * nx) / 2, ys = (p.height - o * ny) / 2;
      for (let xit = 0; xit <= nx; xit++) {
        for (let it = 0; it <= ny; it++) {
          dl.push(["C", xs + xit * o, ys + it * o, (o / 2) * rr]);
        }
      }
      return { dl: dl, pitch: o, count: dl.length };
    },
    picks: [
      { name: "Interlocking · 1.4x",
        set: { spacing: "0.5", spacing_units: "inch", radius: "1.4", weight: "0.35", gridColor: "b3b3b3" } }
    ]
  },

  {
    id: "spider",
    name: "Spider Web",
    blurb: "Spokes and rings.",
    spacing: null,
    weight: { label: "Line thickness", def: 0.7 },
    extras: [
      { t: "num", id: "spokes", label: "Spokes", def: 8, min: 2, max: 40 },
      { t: "num", id: "polys", label: "Rings", def: 10, min: 1, max: 66 }
    ],
    draw: function (p) {
      const dl = [];
      const m = p.margin * 72 + 20;
      const W = p.width, H = p.height;
      const xRad = (W - m) / 2 - 20;
      const polys = Math.floor(correct(p.x.polys, 1, 66));
      const spokes = Math.floor(correct(p.x.spokes, 2, 40));
      const guess = Math.floor(polys / 3);
      if (xRad <= 0) return { dl: dl, pitch: 10, count: 0 };
      const PI = Math.PI;
      let location = 2 * PI, go = true;
      while (go) {
        dl.push(["L", W / 2, H / 2,
          Math.sin(location + PI / 2) * xRad + W / 2,
          Math.cos(location + PI / 2) * xRad + H / 2]);
        const other = location - 2 * PI / spokes;
        dl.push(["L",
          Math.sin(other + PI / 2) * xRad + W / 2,
          Math.cos(other + PI / 2) * xRad + H / 2,
          Math.sin(location + PI / 2) * xRad + W / 2,
          Math.cos(location + PI / 2) * xRad + H / 2]);
        for (let cb = 1; cb <= polys; cb++) {
          const r = xRad * cb / polys;
          dl.push(["L",
            Math.sin(other + PI / 2) * r + W / 2,
            Math.cos(other + PI / 2) * r + H / 2,
            Math.sin(location + PI / 2) * r + W / 2,
            Math.cos(location + PI / 2) * r + H / 2]);
        }
        location -= 2 * PI / spokes;
        if (location < 0) go = false;
      }
      location = 0;
      while (location < 2 * PI) {
        dl.push(["L",
          Math.sin(location + PI / 2) * (xRad * guess / polys) + W / 2,
          Math.cos(location + PI / 2) * (xRad * guess / polys) + H / 2,
          Math.sin(location + PI / 2) * xRad + W / 2,
          Math.cos(location + PI / 2) * xRad + H / 2]);
        location += 2 * PI / spokes;
      }
      return { dl: dl, pitch: xRad / Math.max(1, polys), count: dl.length };
    },
    picks: [
      { name: "Radar · 5 × 5",
        set: { spokes: "5", polys: "5", weight: "0.7", gridColor: "000000" } },
      { name: "Fine Web · 12 × 20",
        set: { spokes: "12", polys: "20", weight: "0.35", gridColor: "b3b3b3" } }
    ]
  },

  {
    id: "cornellgraph",
    name: "Cornell Graph",
    blurb: "Cornell notes, graph area.",
    spacing: { label: "lines", def: 4 },
    weight: { label: "Grid weight", def: 0.4 },
    extras: CORNELL_EXTRAS,
    draw: function (p) {
      const dl = [];
      const L = cornellLayout(p, dl);
      const gw = p.weight;
      dl.push(["S", p.gridColor, gw]);
      let y, yEnd, x, xEnd;
      if (L.sumTop) { y = L.m; yEnd = p.height - L.yStart; }
      else { y = L.yStart; yEnd = p.height - L.m; }
      if (L.cueRight) { x = L.m; xEnd = L.m + L.gridW; }
      else { x = L.xStart; xEnd = L.xStart + L.gridW; }
      while (y <= yEnd + 0.005) {
        dl.push(["L", x - gw / 2, y, x + L.lineW + gw / 2, y]);
        y += L.off;
      }
      const yBase = L.sumTop ? L.m : L.yStart;
      while (x <= xEnd + 0.005) {
        dl.push(["L", x, yBase - gw / 2, x, yBase + L.lineH + gw / 2]);
        x += L.off;
      }
      cornellSeparators(p, dl, L);
      return { dl: dl, pitch: L.off, count: dl.length };
    },
    picks: [
      { name: "Classic · 4/inch",
        set: { spacing: "4", spacing_units: "inch", weight: "0.4", gridColor: "b3b3b3" } }
    ]
  },

  {
    id: "cornelllined",
    name: "Cornell Lined",
    blurb: "Cornell notes, ruled.",
    spacing: { label: "lines", def: 3 },
    weight: { label: "Line weight", def: 0.4 },
    extras: CORNELL_EXTRAS,
    draw: function (p) {
      const dl = [];
      const L = cornellLayout(p, dl);
      const gw = p.weight;
      let y, yEnd, x;
      if (L.sumTop) { y = L.m; yEnd = p.height - L.yStart; }
      else { y = L.yStart; yEnd = p.height - L.m; }
      x = L.cueRight ? L.m : L.xStart;
      y += L.off;
      if (gw > 0) {
        dl.push(["S", p.gridColor, gw]);
        while (y <= yEnd + 0.005 - L.off) {
          dl.push(["L", x - gw / 2, y, x + L.lineW + gw / 2, y]);
          y += L.off;
        }
      }
      cornellSeparators(p, dl, L);
      return { dl: dl, pitch: L.off, count: dl.length };
    },
    picks: [
      { name: "Classic · 3/inch",
        set: { spacing: "3", spacing_units: "inch", weight: "0.4", gridColor: "b3b3b3" } }
    ]
  },

  {
    id: "cornelldots",
    name: "Cornell Dots",
    blurb: "Cornell notes, dot grid.",
    spacing: { label: "dots", def: 4 },
    weight: { label: "Dot size", def: 1 },
    extras: CORNELL_EXTRAS,
    draw: function (p) {
      const dl = [];
      const L = cornellLayout(p, dl);
      const gw = p.weight;
      if (gw > 0) {
        let off = L.off, xS = L.xS, yS = L.yS;
        const maxDots = 15000;
        const total = (xS + 1) * (yS + 1);
        if (total > maxDots) {
          const scale = Math.sqrt(total / maxDots);
          off *= scale;
          xS = Math.floor(L.gridW / off);
          yS = Math.floor(L.gridH / off);
        }
        const dotBaseY = L.sumTop ? L.m : L.yStart;
        const dotBaseX = L.cueRight ? L.m : L.xStart;
        for (let iy = 1; iy < yS; iy++) {
          const cy = dotBaseY + iy * off;
          for (let ix = 1; ix < xS; ix++) {
            dl.push(["D", dotBaseX + ix * off, cy, gw / 2]);
          }
        }
      }
      cornellSeparators(p, dl, L);
      return { dl: dl, pitch: L.off, count: dl.length };
    },
    picks: [
      { name: "Classic · 4/inch",
        set: { spacing: "4", spacing_units: "inch", weight: "1", gridColor: "b3b3b3" } }
    ]
  },

  {
    id: "chinesequarter",
    name: "Stacked Quarters",
    blurb: "Practice boxes in quarters.",
    spacing: { mode: "size", label: "Cell size", def: 0.75, max: 20 },
    weight: { label: "Line thickness", def: 1 },
    extras: [],
    draw: function (p) {
      return stackedSquares(p, 3, function (dl, x, y, s) {
        dl.push(["L", x, y + s * 0.5, x + s, y + s * 0.5]);
        dl.push(["L", x + s * 0.5, y, x + s * 0.5, y + s]);
      });
    },
    picks: [
      { name: "3/4 inch · Grey",
        set: { spacing: "0.75", spacing_units: "inch", weight: "1", gridColor: "b3b3b3" } }
    ]
  },

  {
    id: "chineseX",
    name: "Stacked X",
    blurb: "Quarters plus diagonals.",
    spacing: { mode: "size", label: "Cell size", def: 0.75, max: 20 },
    weight: { label: "Line thickness", def: 1 },
    extras: [],
    draw: function (p) {
      return stackedSquares(p, 3, function (dl, x, y, s) {
        dl.push(["L", x, y + s / 2, x + s, y + s / 2]);
        dl.push(["L", x + s / 2, y, x + s / 2, y + s]);
        dl.push(["L", x, y, x + s, y + s]);
        dl.push(["L", x + s, y, x, y + s]);
      });
    },
    picks: [
      { name: "3/4 inch · Grey",
        set: { spacing: "0.75", spacing_units: "inch", weight: "1", gridColor: "b3b3b3" } }
    ]
  },

  {
    id: "chinesesquare",
    name: "Stacked Hash",
    blurb: "Practice boxes in thirds.",
    spacing: { mode: "size", label: "Cell size", def: 0.75, max: 20 },
    weight: { label: "Line thickness", def: 1 },
    extras: [],
    draw: function (p) {
      return stackedSquares(p, 3, function (dl, x, y, s) {
        dl.push(["L", x, y + s * 0.3333, x + s, y + s * 0.3333]);
        dl.push(["L", x, y + s * 0.6667, x + s, y + s * 0.6667]);
        dl.push(["L", x + s * 0.3333, y, x + s * 0.3333, y + s]);
        dl.push(["L", x + s * 0.6667, y, x + s * 0.6667, y + s]);
      });
    },
    picks: [
      { name: "3/4 inch · Grey",
        set: { spacing: "0.75", spacing_units: "inch", weight: "1", gridColor: "b3b3b3" } }
    ]
  },

  {
    id: "chinesehex",
    name: "Stacked Hex",
    blurb: "Hex practice cells.",
    spacing: { mode: "size", label: "Hex side", def: 0.5, max: 20 },
    weight: { label: "Line thickness", def: 1 },
    extras: [],
    draw: function (p) {
      const s = p.offset, R = 0.866, dl = [];
      const uW = p.width - p.margin * 144, uH = p.height - p.margin * 144;
      const nx = Math.floor(uW / (s * 3)), ny = Math.floor(uH / (s * 2 * R));
      if (nx < 1 || ny < 1) return { dl: dl, pitch: s, count: 0 };
      const xs = (p.width - s * 3 * nx) / 2 + s;
      const ys = (p.height - s * 2 * R * ny) / 2;
      const thin = [];
      for (let i = 0; i < nx; i++) {
        const x = xs + i * s * 3;
        let top = false;
        for (let j = 0; j < ny; j++) {
          const y = ys + j * s * 2 * R;
          if (!top) { dl.push(["L", x, y, x + s, y]); top = true; }
          dl.push(["L", x + s, y, x + s * 1.5, y + R * s]);
          dl.push(["L", x + s * 1.5, y + R * s, x + s, y + 2 * R * s]);
          dl.push(["L", x + s, y + 2 * R * s, x, y + 2 * R * s]);
          dl.push(["L", x - s / 2, y + R * s, x, y + 2 * R * s]);
          dl.push(["L", x, y, x - s / 2, y + R * s]);
          thin.push(["L", x + s * 1.5, y + R * s, x - s / 2, y + R * s]);
          thin.push(["L", x + s / 2, y + 2 * R * s, x + s / 2, y]);
        }
      }
      dl.push(["S", p.gridColor, p.weight / 2]);
      for (const t of thin) dl.push(t);
      return { dl: dl, pitch: s * 2 * R, count: dl.length };
    },
    picks: [
      { name: "Half Inch Side · Grey",
        set: { spacing: "0.5", spacing_units: "inch", weight: "1", gridColor: "b3b3b3" } }
    ]
  },

  {
    id: "calligraphy",
    name: "Calligraphy",
    blurb: "Nib-width guideline sets.",
    note: "The nib width is in millimeters. The number of lines on a page is a function of nib size, spacing, and paper size \u2014 it cannot be set directly.",
    spacing: null,
    weight: { label: "Line thickness", def: 0.5 },
    extras: [
      { t: "num", id: "unit", label: "Nib width (mm)", def: 1.5, min: 0.5, max: 10 },
      { t: "num", id: "gap", label: "Gap between sets (mm)", def: 10, min: 1, max: 60 }
    ],
    draw: function (p) {
      const dl = [];
      const K = 3.937; // the original's mm-ish factor, kept for fidelity
      const unit = correct(p.x.unit, 0.5, 10);
      const gap = Math.floor(correct(p.x.gap, 1, 60));
      const m = p.margin * 72;
      const total = (15 * unit + gap) * K;
      const uW = p.width - 2 * m, uH = p.height - 2 * m;
      const n = Math.floor(uH / total);
      if (n < 1 || uW <= 0) return { dl: dl, pitch: total, count: 0 };
      const x = m;
      let y = m;
      for (let i = 0; i < n; i++) {
        for (const mult of [0, 5, 10, 12, 15]) {
          const yy = y + unit * K * mult;
          dl.push(["L", x, yy, x + uW, yy]);
        }
        y += total;
      }
      return { dl: dl, pitch: total, count: dl.length };
    },
    picks: [
      { name: "1.5mm Nib",
        set: { unit: "1.5", gap: "10", weight: "0.5", gridColor: "b3b3b3" } },
      { name: "3mm Broad Nib",
        set: { unit: "3", gap: "12", weight: "0.5", gridColor: "b3b3ff" } }
    ]
  },

  {
    id: "notelined",
    name: "Notebook",
    blurb: "Store-bought notebook ruling.",
    spacing: null,
    weight: { label: "Line weight", def: 0.4 },
    extras: [
      { t: "sel", id: "rule", label: "Rule", def: "Medium", options: [
        ["Extra-wide", "Extra wide"], ["Wide", "Wide (legal)"],
        ["Medium", "Medium (college)"], ["Narrow", "Narrow"],
        ["Very-narrow", "Very narrow"]
      ] }
    ],
    draw: function (p) {
      const dl = [];
      const m = p.margin * 72;
      const gw = p.weight;
      let LPI = 3.56, vSize = 0.95;
      const rules = { "Extra-wide": 2.4, "Wide": 2.91, "Medium": 3.56,
                      "Narrow": 4, "Very-narrow": 7.16 };
      if (rules[p.x.rule]) LPI = rules[p.x.rule];
      if (p.x.rule === "Very-narrow") vSize = 0.98;
      const uW = p.width - 2 * m, uH = p.height - 2 * m;
      const gridH = uH * vSize;
      const off = 72 / LPI;
      const yS = Math.floor(gridH / off);
      if (yS < 1 || uW <= 0) return { dl: dl, pitch: off, count: 0 };
      const lineH = off * yS;
      const xStart = m;
      const yStart = (p.height - lineH) / 2 + (uH - gridH) / 2;
      let y = m + off;
      const yEnd = p.height - yStart;
      if (gw > 0) {
        while (y <= yEnd + 0.005 - off) {
          dl.push(["L", xStart - gw / 2, y, xStart + uW + gw / 2, y]);
          y += off;
        }
      }
      dl.push(["L", xStart + 92, p.height - m, xStart + 92, m]);
      return { dl: dl, pitch: off, count: dl.length };
    },
    picks: [
      { name: "College Ruled",
        set: { rule: "Medium", weight: "0.4", gridColor: "b3b3ff" } },
      { name: "Wide Ruled",
        set: { rule: "Wide", weight: "0.4", gridColor: "b3b3b3" } }
    ]
  },

  {
    id: "axonometric",
    name: "Axonometric",
    blurb: "Diamond lattice with guides.",
    spacing: { mode: "size", label: "Diamond side", def: 0.5 },
    weight: { label: "Line thickness", def: 0.5 },
    extras: [
      { t: "chk", id: "verticals", label: "Guides", text: "Light verticals", def: true },
      { t: "chk", id: "horizontals", label: " ", text: "Light horizontals", def: false }
    ],
    draw: diamondLattice,
    picks: [{ name: "Half Inch · Grey",
      set: { spacing: "0.5", spacing_units: "inch", verticals: "1", weight: "0.5", gridColor: "b3b3b3" } }]
  },

  {
    id: "intersecteddiamonds",
    name: "Intersected Diamonds",
    blurb: "Diamonds, crossed.",
    spacing: { mode: "size", label: "Diamond side", def: 0.5 },
    weight: { label: "Line thickness", def: 0.5 },
    extras: [
      { t: "chk", id: "verticals", label: "Guides", text: "Light verticals", def: true },
      { t: "chk", id: "horizontals", label: " ", text: "Light horizontals", def: true }
    ],
    draw: diamondLattice,
    picks: [{ name: "Half Inch · Grey",
      set: { spacing: "0.5", spacing_units: "inch", verticals: "1", horizontals: "1", weight: "0.5", gridColor: "b3b3b3" } }]
  },

  {
    id: "triangledots",
    name: "Triangle Dots",
    blurb: "Dots in triangular stagger.",
    spacing: { mode: "size", label: "Dot spacing", def: 0.25 },
    weight: { label: "Dot size", def: 1 },
    extras: [],
    draw: function (p) {
      const dl = [], o = p.offset;
      const uW = p.width - p.margin * 144, uH = p.height - p.margin * 144;
      const nx = Math.floor(uW / o), ny = Math.floor(uH / o);
      if (nx < 0 || ny < 0) return { dl: dl, pitch: o, count: 0 };
      const xs = (p.width - o * nx) / 2, ys = (p.height - o * ny) / 2;
      for (let i = 0; i <= nx; i++) {
        const x = xs + i * o;
        for (let j = 0; j <= ny * 1.135; j++) {
          const shifted = j % 2 === 1;
          if (shifted && i === nx) continue;
          dl.push(["D", x + (shifted ? o / 2 : 0), ys + j * o / 1.135, p.weight / 2]);
        }
      }
      return { dl: dl, pitch: o, count: dl.length };
    },
    picks: [{ name: "Quarter Inch · Grey",
      set: { spacing: "0.25", spacing_units: "inch", weight: "1", gridColor: "b3b3b3" } }]
  },

  {
    id: "leftborder",
    name: "Left Border Grid",
    blurb: "Grid with a blank margin.",
    note: "Officially retired in 2018. Un-retired in 2026.",
    spacing: { label: "major lines", def: 1 },
    weight: { label: "Major weight", def: 1 },
    extras: [
      { t: "sp2", id: "minorspacing", label: "Minor lines", def: 4 },
      { t: "wt", id: "minorweight", label: "Minor weight", def: 0.3, min: 0.02, max: 20 },
      { t: "sz2", id: "leftborder", label: "Left border", def: 1 }
    ],
    draw: function (p) {
      const dl = [];
      const majorOffset = p.offset;
      const minorOffset = perOffset(p.x.minorspacing, p.x.minorspacing_units);
      const lb = sizePts(p.x.leftborder, p.x.leftborder_units, 0, 4);
      const wt = p.weight, minW = correct(p.x.minorweight, 0.02, 20);
      const uW = p.width - (p.margin * 144 + lb), uH = p.height - p.margin * 144;
      const xS = Math.floor(uW / majorOffset), yS = Math.floor(uH / majorOffset);
      if (xS < 1 || yS < 1) return { dl: dl, pitch: minorOffset, count: 0 };
      const lw = majorOffset * xS, lh = majorOffset * yS;
      const xStart = (p.width - lw) / 2, yStart = (p.height - lh) / 2;
      const bp = lb / 2;
      let y = yStart, x;
      while (y <= (p.height - yStart) + 0.005) {
        dl.push(["L", xStart + bp - wt / 2, y, xStart + bp + lw + wt / 2, y]);
        y += majorOffset;
      }
      x = xStart + bp;
      while (x <= (p.width - xStart) + 0.015 + bp) {
        dl.push(["L", x, yStart - wt / 2, x, yStart + lh + wt / 2]);
        x += majorOffset;
      }
      dl.push(["S", p.gridColor, minW]);
      y = yStart;
      while (y <= (p.height - yStart) + 0.005) {
        dl.push(["L", xStart + bp - wt / 2, y, xStart + bp + lw + wt / 2, y]);
        y += minorOffset;
      }
      x = xStart + bp;
      while (x <= (p.width - xStart) + 0.005 + bp) {
        dl.push(["L", x, yStart - wt / 2, x, yStart + lh + wt / 2]);
        x += minorOffset;
      }
      return { dl: dl, pitch: minorOffset, count: dl.length };
    },
    picks: [{ name: "1 inch Border",
      set: { spacing: "1", spacing_units: "inch", minorspacing: "4", minorspacing_units: "inch",
             leftborder: "1", leftborder_units: "inch", weight: "1", minorweight: "0.3", gridColor: "b3b3b3" } }]
  },

  {
    id: "asymmetric",
    name: "Asymmetric",
    blurb: "Different spacing each way.",
    note: "The pre-generated classics all used a 3:2 ratio.",
    spacing: null,
    weightFirst: true,
    weight: { label: "Line weight · largest", def: 0.7 },
    extras: [
      { t: "wt", id: "minorweight", label: "Line weight · smallest", def: 0.15, min: 0.01, max: 20 },
      { t: "sp2", id: "hmajorspacing", label: "Horizontal · larger", def: 1 },
      { t: "sp2", id: "hminorspacing", label: "Horizontal · smaller", def: 5 },
      { t: "sp2", id: "vmajorspacing", label: "Vertical · larger", def: 1 },
      { t: "sp2", id: "vminorspacing", label: "Vertical · smaller", def: 5 }
    ],
    draw: function (p) {
      const dl = [];
      const hMaj = perOffset(p.x.hmajorspacing, p.x.hmajorspacing_units);
      const hMin = perOffset(p.x.hminorspacing, p.x.hminorspacing_units);
      const vMaj = perOffset(p.x.vmajorspacing, p.x.vmajorspacing_units);
      const vMin = perOffset(p.x.vminorspacing, p.x.vminorspacing_units);
      const wt = p.weight, minW = correct(p.x.minorweight, 0.01, 20);
      const uW = p.width - p.margin * 144, uH = p.height - p.margin * 144;
      // Faithful to the original's h/v swap:
      const xS = Math.floor(uW / vMaj), yS = Math.floor(uH / hMaj);
      if (xS < 1 || yS < 1) return { dl: dl, pitch: Math.min(hMin, vMin), count: 0 };
      const lw = vMaj * xS, lh = hMaj * yS;
      const xStart = (p.width - lw) / 2, yStart = (p.height - lh) / 2;
      let y = yStart, x = xStart;
      while (y <= (p.height - yStart) + 0.005) {
        dl.push(["L", xStart - wt / 2, y, xStart + lw + wt / 2, y]);
        y += vMaj;
      }
      while (x <= (p.width - xStart) + 0.005) {
        dl.push(["L", x, yStart - wt / 2, x, yStart + lh + wt / 2]);
        x += hMaj;
      }
      dl.push(["S", p.gridColor, minW]);
      y = yStart; x = xStart;
      while (y <= (p.height - yStart) + 0.005) {
        dl.push(["L", xStart - wt / 2, y, xStart + lw + wt / 2, y]);
        y += vMin;
      }
      while (x <= (p.width - xStart) + 0.005) {
        dl.push(["L", x, yStart - wt / 2, x, yStart + lh + wt / 2]);
        x += hMin;
      }
      return { dl: dl, pitch: Math.min(hMin, vMin), count: dl.length };
    },
    picks: [{ name: "Classic 1 × 5 per inch",
      set: { hmajorspacing: "1", hminorspacing: "5", vmajorspacing: "1", vminorspacing: "5",
             weight: "0.7", minorweight: "0.15", gridColor: "b3b3b3" } }]
  },

  {
    id: "simpleasymmetric",
    name: "Knitting Grid",
    blurb: "Stitch-shaped cells.",
    spacing: null,
    weightFirst: true,
    weight: { label: "Bold weight", def: 0.7 },
    extras: [
      { t: "wt", id: "minorweight", label: "Normal weight", def: 0.15, min: 0.01, max: 20 },
      { t: "sz2", id: "hsize", label: "Horizontal size", def: 0.25 },
      { t: "num", id: "hbold", label: "Bold every N columns", def: 5, min: 1, max: 30 },
      { t: "sz2", id: "vsize", label: "Vertical size", def: 0.125 },
      { t: "num", id: "vbold", label: "Bold every N rows", def: 5, min: 1, max: 30 }
    ],
    draw: function (p) {
      const dl = [];
      const hMin = sizePts(p.x.hsize, p.x.hsize_units, 0.1, 8);
      const vMin = sizePts(p.x.vsize, p.x.vsize_units, 0.1, 8);
      const hMaj = hMin * Math.floor(correct(p.x.hbold, 1, 30));
      const vMaj = vMin * Math.floor(correct(p.x.vbold, 1, 30));
      const wt = p.weight, minW = correct(p.x.minorweight, 0.01, 20);
      const uW = p.width - p.margin * 144, uH = p.height - p.margin * 144;
      const xS = Math.floor(uW / hMaj), yS = Math.floor(uH / vMaj);
      if (xS < 1 || yS < 1) return { dl: dl, pitch: Math.min(hMin, vMin), count: 0 };
      const lw = hMaj * xS, lh = vMaj * yS;
      const xStart = (p.width - lw) / 2, yStart = (p.height - lh) / 2;
      let y = yStart, x = xStart;
      while (y <= (p.height - yStart) + 0.005) {
        dl.push(["L", xStart - wt / 2, y, xStart + lw + wt / 2, y]);
        y += vMaj;
      }
      while (x <= (p.width - xStart) + 0.005) {
        dl.push(["L", x, yStart - wt / 2, x, yStart + lh + wt / 2]);
        x += hMaj;
      }
      dl.push(["S", p.gridColor, minW]);
      y = yStart; x = xStart;
      while (y <= (p.height - yStart) + 0.005) {
        dl.push(["L", xStart - wt / 2, y, xStart + lw + wt / 2, y]);
        y += vMin;
      }
      while (x <= (p.width - xStart) + 0.005) {
        dl.push(["L", x, yStart - wt / 2, x, yStart + lh + wt / 2]);
        x += hMin;
      }
      return { dl: dl, pitch: Math.min(hMin, vMin), count: dl.length };
    },
    picks: [
      { name: "Classic Knitting · 5×5",
        set: { hsize: "0.25", hsize_units: "inch", vsize: "0.125", vsize_units: "inch",
               hbold: "5", vbold: "5", weight: "0.7", minorweight: "0.15", gridColor: "b3b3ff" } },
      { name: "Square Cells · Bold 4",
        set: { hsize: "0.25", hsize_units: "inch", vsize: "0.25", vsize_units: "inch",
               hbold: "4", vbold: "4", weight: "1", minorweight: "0.3", gridColor: "b3b3b3" } }
    ]
  },

  {
    id: "multiwidth",
    name: "Multi-Weight",
    blurb: "Major, medium, minor lines.",
    note: "These are custom-created pieces I\u2019ve gotten requests for. They have thicker lines every so often.",
    spacing: { label: "major lines", def: 1, min: 0.01 },
    weight: { label: "Major weight", def: 1.2 },
    extras: [
      { t: "sp2", id: "mediumspacing", label: "Medium lines", def: 2 },
      { t: "wt", id: "mediumweight", label: "Medium weight", def: 0.6, min: 0.02, max: 20 },
      { t: "sp2", id: "minorspacing", label: "Minor lines", def: 8 },
      { t: "wt", id: "minorweight", label: "Minor weight", def: 0.25, min: 0.02, max: 20 }
    ],
    draw: function (p) {
      const dl = [];
      const majO = p.offset;
      const midO = perOffset(p.x.mediumspacing, p.x.mediumspacing_units);
      const minO = perOffset(p.x.minorspacing, p.x.minorspacing_units);
      const wt = p.weight;
      const uW = p.width - p.margin * 144, uH = p.height - p.margin * 144;
      const xS = Math.floor(uW / majO), yS = Math.floor(uH / majO);
      if (xS < 1 || yS < 1) return { dl: dl, pitch: minO, count: 0 };
      const lw = majO * xS, lh = majO * yS;
      const xStart = (p.width - lw) / 2, yStart = (p.height - lh) / 2;
      function pass(off) {
        let y = yStart, x = xStart;
        while (y <= (p.height - yStart) + 0.005) {
          dl.push(["L", xStart - wt / 2, y, xStart + lw + wt / 2, y]); y += off;
        }
        while (x <= (p.width - xStart) + 0.005) {
          dl.push(["L", x, yStart - wt / 2, x, yStart + lh + wt / 2]); x += off;
        }
      }
      pass(majO);
      dl.push(["S", p.gridColor, correct(p.x.mediumweight, 0.02, 20)]);
      pass(midO);
      dl.push(["S", p.gridColor, correct(p.x.minorweight, 0.02, 20)]);
      pass(minO);
      return { dl: dl, pitch: minO, count: dl.length };
    },
    picks: [{ name: "1 · 2 · 8 per inch",
      set: { spacing: "1", mediumspacing: "2", minorspacing: "8",
             weight: "1.2", mediumweight: "0.6", minorweight: "0.25", gridColor: "0000b3" } }]
  },

  {
    id: "weightedgrid",
    name: "Accented Grid",
    blurb: "Heavier rows, lighter columns.",
    spacing: { label: "lines", def: 4 },
    weight: { label: "Horizontal weight", def: 0.8 },
    extras: [
      { t: "wt", id: "vweight", label: "Vertical weight", def: 0.4, min: 0.01, max: 20 }
    ],
    draw: function (p) {
      const dl = [];
      const hW = p.weight, vW = correct(p.x.vweight, 0.01, 20);
      const g = gridLayout(p);
      if (!g.ok) return { dl: dl, pitch: p.offset, count: 0 };
      const lw = p.offset * g.nx, lh = p.offset * g.ny;
      // Verticals in a lightened tint of the grid color (original: x1.25)
      const lighten = (h) => {
        let s = "";
        for (let i = 0; i < 6; i += 2) {
          s += ("0" + Math.min(255, Math.round(parseInt(h.substr(i, 2), 16) * 1.25))
            .toString(16)).slice(-2);
        }
        return s;
      };
      dl.push(["S", lighten(p.gridColor), vW]);
      let x = g.xStart;
      while (x <= (p.width - g.xStart) + 0.005) {
        dl.push(["L", x, g.yStart - hW / 2, x, g.yStart + lh + hW / 2]); x += p.offset;
      }
      dl.push(["S", p.gridColor, hW]);
      let y = g.yStart;
      while (y <= (p.height - g.yStart) + 0.005) {
        dl.push(["L", g.xStart - vW / 2, y, g.xStart + lw + vW / 2, y]); y += p.offset;
      }
      return { dl: dl, pitch: p.offset, count: dl.length };
    },
    picks: [{ name: "4/inch · Blue",
      set: { spacing: "4", spacing_units: "inch", weight: "0.8", vweight: "0.4", gridColor: "0000b3" } }]
  },

  {
    id: "multicolor",
    name: "Multi-Color",
    blurb: "Three grids, three colors.",
    note: "You don\u2019t need these presets. You\u2019re a graph paper enthusiast. Usually I\u2019d put examples of what this is used for, but this is the most common kind of graph paper there is: squares. All squares. All the time. You need squares? Most of them are here.",
    spacing: null,
    hideWeight: true,
    hideGridColor: true,
    weight: { label: "Line weight", def: 0.7 },
    extras: [
      { t: "col", id: "lgridcolor", label: "Large grid", def: "b30000" },
      { t: "wt", id: "lweight", label: "Weight", def: 0.7, min: 0.02, max: 20 },
      { t: "sp2", id: "lspacing", label: "Spacing", def: 1 },
      { t: "col", id: "mgridcolor", label: "Medium grid", def: "383838" },
      { t: "wt", id: "mediumweight", label: "Weight", def: 0.3, min: 0.02, max: 20 },
      { t: "sp2", id: "mediumspacing", label: "Spacing", def: 2 },
      { t: "col", id: "sgridcolor", label: "Small grid", def: "b3b3ff" },
      { t: "wt", id: "minorweight", label: "Weight", def: 0.15, min: 0.02, max: 20 },
      { t: "sp2", id: "minorspacing", label: "Spacing", def: 10 }
    ],
    draw: function (p) {
      const dl = [];
      const majO = perOffset(p.x.lspacing, p.x.lspacing_units);
      const midO = perOffset(p.x.mediumspacing, p.x.mediumspacing_units);
      const minO = perOffset(p.x.minorspacing, p.x.minorspacing_units);
      const wt = correct(p.x.lweight, 0.02, 20);
      const uW = p.width - p.margin * 144, uH = p.height - p.margin * 144;
      const xS = Math.floor(uW / majO), yS = Math.floor(uH / majO);
      if (xS < 1 || yS < 1) return { dl: dl, pitch: minO, count: 0 };
      const lw = majO * xS, lh = majO * yS;
      const xStart = (p.width - lw) / 2, yStart = (p.height - lh) / 2;
      function pass(off) {
        let y = yStart, x = xStart;
        while (y <= (p.height - yStart) + 0.005) {
          dl.push(["L", xStart - wt / 2, y, xStart + lw + wt / 2, y]); y += off;
        }
        while (x <= (p.width - xStart) + 0.005) {
          dl.push(["L", x, yStart - wt / 2, x, yStart + lh + wt / 2]); x += off;
        }
      }
      dl.push(["S", checkColor(p.x.lgridcolor, "b30000"), wt]);
      pass(majO);
      dl.push(["S", checkColor(p.x.sgridcolor, "b3b3ff"),
        correct(p.x.minorweight, 0.02, 20)]);
      pass(minO);
      dl.push(["S", checkColor(p.x.mgridcolor, "383838"),
        correct(p.x.mediumweight, 0.02, 20)]);
      pass(midO);
      return { dl: dl, pitch: minO, count: dl.length };
    },
    picks: [
      { name: "Classic Red · Dark · Blue",
        set: { lspacing: "1", mediumspacing: "2", minorspacing: "10",
               lweight: "0.7", mediumweight: "0.3", minorweight: "0.15",
               lgridcolor: "b30000", mgridcolor: "383838", sgridcolor: "b3b3ff" } },
      { name: "Black · Green · Blue",
        set: { lspacing: "1", mediumspacing: "2", minorspacing: "8",
               lweight: "1.2", mediumweight: "0.6", minorweight: "0.25",
               lgridcolor: "000000", mgridcolor: "00b300", sgridcolor: "b3b3ff" } }
    ]
  },

  {
    id: "genkoyoushi",
    name: "Stacked Blocks",
    blurb: "Plain practice boxes.",
    note: "For the traditional layout, print in landscape mode!",
    spacing: { mode: "size", label: "Cell size", def: 0.75, max: 20 },
    weight: { label: "Line thickness", def: 1 },
    extras: [],
    draw: function (p) {
      return stackedSquares(p, 1, function () {});
    },
    picks: [{ name: "3/4 inch · Grey",
      set: { spacing: "0.75", spacing_units: "inch", weight: "1", gridColor: "b3b3b3" } }]
  },

  {
    id: "perspective",
    name: "Perspective",
    blurb: "One vanishing point.",
    note: "Vertical convergence runs from 0 (top of the page) toward 1 (three page-heights up \u2014 nearly parallel lines). Not every calculated line gets drawn; want more, bump the number up. Blank corners are normal \u2014 filling them would take an out-of-hand number of lines.",
    spacing: { label: "lines", def: 4 },
    weight: { label: "Horizontal weight", def: 0.5 },
    extras: [
      { t: "wt", id: "pweight", label: "Perspective weight", def: 0.5, min: 0.02, max: 20 },
      { t: "num", id: "plines", label: "Perspective lines", def: 20, min: 2, max: 400 },
      { t: "num", id: "convergence", label: "Convergence (0-1)", def: 0.5, min: 0, max: 1 },
      { t: "num", id: "vconvergence", label: "Height (0-1)", def: 0.1, min: 0, max: 1 }
    ],
    draw: function (p) {
      const dl = [];
      const m = p.margin * 72;
      const majO = p.offset;
      const uW = p.width - 2 * m;
      const pLines = Math.floor(correct(p.x.plines, 2, 400));
      const conv = correct(p.x.convergence, 0, 1);
      const vconv = correct(p.x.vconvergence, 0, 1);
      let y = m;
      while (y <= (p.height - m) + 0.005) {
        dl.push(["L", 0, y, p.width, y]);
        y += majO;
      }
      const convPoint = conv * uW + m;
      const vConvPoint = (p.height - m) + vconv * (p.height * 3);
      dl.push(["S", p.gridColor, correct(p.x.pweight, 0.02, 20)]);
      const step = (uW / (pLines - 1)) * 3;
      for (let i = 0; i < pLines; i++) {
        dl.push(["L", convPoint, vConvPoint, m + step * i - uW, m]);
      }
      dl.push(["S", "ffffff", 1]);
      dl.push(["R", p.width - m, 0, m, p.height]);
      dl.push(["R", 0, 0, m, p.height]);
      dl.push(["R", 0, p.height - m, p.width, m]);
      return { dl: dl, pitch: majO, count: dl.length };
    },
    picks: [{ name: "Room Study",
      set: { spacing: "4", spacing_units: "inch", plines: "20",
             convergence: "0.5", vconvergence: "0.1",
             weight: "0.5", pweight: "0.5", gridColor: "b3b3b3" } }]
  },

  {
    id: "bisectedtrapezoid",
    name: "Bisected Trapezoid",
    blurb: "Trapezoid chains.",
    spacing: { mode: "size", label: "Base size", def: 0.25 },
    weight: { label: "Line thickness", def: 0.5 },
    extras: [],
    draw: function (p) {
      const o = p.offset, R = 0.866, dl = [];
      const uW = p.width - p.margin * 144, uH = p.height - p.margin * 144;
      const nx = Math.floor(uW / (o * 3)), ny = Math.floor(uH / (o * 2 * R));
      if (nx < 1 || ny < 1) return { dl: dl, pitch: o, count: 0 };
      const xs = (p.width - o * 3 * nx) / 2 + o;
      const ys = (p.height - o * 2 * R * ny) / 2;
      for (let k = 0; k / 3 < nx - 0.667; k++) {
        const x = xs + (k / 3) * o * 3;
        for (let it = 0; it < ny; it++) {
          const y = ys + it * o * 2 * R;
          const h = R * o;
          dl.push(["L", x - o * 0.5, y + h, x + o * 1.5, y + h]);
          dl.push(["L", x, y, x + o, y + 2 * h]);
          dl.push(["L", x, y + 2 * h, x + o, y]);
          dl.push(["L", x + o * 1.5, y + h, x + o, y + 2 * h]);
          dl.push(["L", x + o, y, x + o * 1.5, y + h]);
          dl.push(["L", x, y, x - o * 0.5, y + h]);
          dl.push(["L", x - o * 0.5, y + h, x, y + 2 * h]);
        }
      }
      return { dl: dl, pitch: o * 2 * R, count: dl.length };
    },
    picks: [{ name: "Quarter Inch · Grey",
      set: { spacing: "0.25", spacing_units: "inch", weight: "0.5", gridColor: "b3b3b3" } }]
  },

  {
    id: "musicstaff",
    name: "Music Staves",
    blurb: "Staff paper.",
    spacing: null,
    weight: { label: "Line thickness", def: 0.5 },
    extras: [
      { t: "num", id: "staves", label: "Staves per page", def: 8, min: 1, max: 80 },
      { t: "num", id: "lps", label: "Lines per staff", def: 5, min: 1, max: 11 },
      { t: "num", id: "gap", label: "Interstaff space (lines)", def: 5, min: 1, max: 20 },
      { t: "chk", id: "topper", label: "Extra space", text: "Include extra space on top", def: false }
    ],
    draw: function (p) {
      const dl = [];
      const staves = correct(p.x.staves, 1, 80);
      const lps = Math.floor(correct(p.x.lps, 1, 11));
      const gap = Math.floor(correct(p.x.gap, 1, 20));
      let totalLines = lps * staves + gap * (staves - 1);
      const loopLines = totalLines;
      if (p.x.topper) totalLines += lps + gap;
      const uW = p.width - p.margin * 144, uH = p.height - p.margin * 144;
      if (uW <= 0 || totalLines < 1) return { dl: dl, pitch: 10, count: 0 };
      const off = uH / totalLines;
      const x = (p.width - uW) / 2;
      let y = (p.height - off * totalLines) / 2;
      for (let n = 0; n < loopLines; n++) {
        if (n % (lps + gap) < lps) dl.push(["L", x, y, x + uW, y]);
        y += off;
      }
      return { dl: dl, pitch: off, count: dl.length };
    },
    picks: [
      { name: "Standard 8 Staves", set: { staves: "8", lps: "5", gap: "5", weight: "0.5", gridColor: "000000" } },
      { name: "Guitar Tab (6 lines)", set: { staves: "7", lps: "6", gap: "4", weight: "0.5", gridColor: "000000" } }
    ]
  },

  {
    id: "storyboard",
    name: "Storyboard",
    blurb: "Frames in your aspect ratio.",
    note: "Lots of columns and rows can give you an unexpected layout. Keep them to 3 or less for optimal results.",
    spacing: null,
    weight: { label: "Frame weight", def: 1 },
    extras: [
      { t: "num", id: "aspectx", label: "Aspect width", def: 16, min: 0.1, max: 5000 },
      { t: "num", id: "aspecty", label: "Aspect height", def: 9, min: 0.1, max: 5000 },
      { t: "num", id: "numcols", label: "Columns", def: 2, min: 1, max: 20 },
      { t: "num", id: "numrows", label: "Rows", def: 3, min: 1, max: 20 },
      { t: "wt", id: "mediumweight", label: "Line weight", def: 0.3, min: 0.02, max: 20 },
      { t: "chk", id: "lines", label: "Notes", text: "Lines under frames", def: true },
      { t: "chk", id: "header", label: "Header", text: "Header line", def: false },
      { t: "txt", id: "headtext", label: "Header text", def: "" }
    ],
    draw: function (p) {
      const dl = [];
      const m = p.margin * 72;
      let uW = p.width - 2 * m, uH = p.height - 2 * m;
      const frameW = p.weight;
      const lineW = correct(p.x.mediumweight, 0.02, 20);
      const aspect = correct(
        correct(p.x.aspectx, 0.1, 5000) / correct(p.x.aspecty, 0.1, 5000), 0.1, 10);
      const cols = Math.floor(correct(p.x.numcols, 1, 20));
      const rows = Math.floor(correct(p.x.numrows, 1, 20));
      if (uW <= 0 || uH <= 0) return { dl: dl, pitch: 10, count: 0 };
      dl.push(["S", p.gridColor, lineW]);
      if (p.x.header) {
        uH -= 24;
        dl.push(["L", m, p.height - m - 14, p.width - m, p.height - m - 14]);
        if (p.x.headtext) {
          dl.push(["S", "606060", lineW]);
          dl.push(["T", m, p.height - m - 12, 14, p.x.headtext, "l", "h"]);
          dl.push(["S", p.gridColor, lineW]);
        }
      }
      const brickH = uH / rows - (rows - 1) * (m * 0.5);
      const brickW = uW / cols - (cols - 1) * (m * 0.5);
      if (brickH <= 0 || brickW <= 0) return { dl: dl, pitch: 10, count: 0 };
      let frameX = brickW, frameY = brickH;
      if (aspect > brickW / brickH) frameY = frameX / aspect;
      else frameX = frameY * aspect;
      for (let r = 1; r <= cols; r++) {
        for (let c = 1; c <= rows; c++) {
          const xS = m + (r - 1) * brickW + (r - 1) * (m / 2);
          const yS = uH - (m + (c - 1) * brickH + (c - 1) * (m / 2)) + m;
          dl.push(["S", p.gridColor, frameW]);
          dl.push(["L", xS - frameW / 2, yS, xS + frameX + frameW / 2, yS]);
          dl.push(["L", xS - frameW / 2, yS - frameY, xS + frameX + frameW / 2, yS - frameY]);
          dl.push(["L", xS, yS, xS, yS - frameY]);
          dl.push(["L", xS + frameX, yS, xS + frameX, yS - frameY]);
          if (p.x.lines) {
            dl.push(["S", p.gridColor, lineW]);
            let cY = frameY;
            while (cY < brickH - 23) {
              dl.push(["L", xS, yS - cY, xS + frameX, yS - cY]);
              cY += 22;
            }
          }
        }
      }
      return { dl: dl, pitch: brickH, count: dl.length };
    },
    picks: [
      { name: "16:9 · 2×3 · Notes", set: { aspectx: "16", aspecty: "9", numcols: "2", numrows: "3",
        lines: "1", weight: "1", mediumweight: "0.3", gridColor: "000000" } }
    ]
  },

  {
    id: "numberline",
    name: "Number Line",
    blurb: "Labeled number lines.",
    note: "Due to the extreme latitude given to the input values, you can make this do bad things (such as incrementing by 0.99993) that result in unreadable files. Use at your own peril!",
    spacing: null,
    weight: { label: "Line weight", def: 1 },
    extras: [
      { t: "num", id: "start", label: "Starting number", def: 0, min: -5000, max: 5000 },
      { t: "num", id: "end", label: "Ending number", def: 10, min: -5000, max: 5000 },
      { t: "num", id: "increment", label: "Increment by", def: 1, min: 0, max: 1000 },
      { t: "num", id: "lines", label: "Lines per page", def: 5, min: 1, max: 15 },
      { t: "num", id: "fontsize", label: "Font size", def: 10, min: 5, max: 25 }
    ],
    draw: function (p) {
      const dl = [];
      const m = p.margin * 72;
      const start = correct(p.x.start, -5000, 5000);
      const end = correct(p.x.end, -5000, 5000);
      let inc = Math.abs(correct(p.x.increment, 0, 1000));
      if (inc === 0) inc = 1;
      const rows = Math.floor(correct(p.x.lines, 1, 15)) * 2 + 1;
      const fs = correct(p.x.fontsize, 5, 25);
      const uX = p.width - 2 * m, uY = p.height - 2 * m;
      const quanta = Math.abs(start - end) / inc;
      if (quanta < 0.5 || quanta > 2000 || uX <= 0)
        return { dl: dl, pitch: 20, count: 0 };
      const offD = uX / quanta, rowD = uY / rows;
      for (let r = 1; r < rows; r += 2) {
        dl.push(["L", m, r * rowD + m, p.width - m, r * rowD + m]);
        let num = start;
        for (let c = 0; c <= quanta + 1e-9; c++) {
          dl.push(["L", c * offD + m, r * rowD + m - offD / 6,
                        c * offD + m, r * rowD + m + offD / 6]);
          dl.push(["T", c * offD + m, r * rowD + m - (offD / 5 + fs),
                   fs, Math.round(num * 1e6) / 1e6, "c", "h"]);
          num += inc;
        }
      }
      return { dl: dl, pitch: rowD, count: dl.length };
    },
    picks: [
      { name: "0 to 10", set: { start: "0", end: "10", increment: "1", lines: "5",
        fontsize: "10", weight: "1", gridColor: "000000" } },
      { name: "-10 to 10 by 2", set: { start: "-10", end: "10", increment: "2", lines: "5",
        fontsize: "10", weight: "1", gridColor: "000000" } }
    ]
  },

  {
    id: "polar",
    name: "Polar",
    blurb: "Rings, spokes, labels.",
    spacing: null,
    hideWeight: true,
    weight: { label: "Ring weight", def: 0.7 },
    extras: [
      { t: "num", id: "circles", label: "Concentric circles", def: 10, min: 1, max: 66 },
      { t: "num", id: "spokes", label: "Primary spokes", def: 12, min: 2, max: 2000 },
      { t: "wt", id: "primaryweight", label: "Primary weight", def: 0.7, min: 0.1, max: 10 },
      { t: "num", id: "secondary", label: "Secondary spokes", def: 72, min: 0, max: 2000 },
      { t: "wt", id: "narrowweight", label: "Secondary weight", def: 0.35, min: 0, max: 10 },
      { t: "sel", id: "labels", label: "Labels", def: "none", options: [
        ["none", "None"], ["degrees", "Degrees"], ["radians", "Radians"]] },
      { t: "sel", id: "center", label: "Center style", def: "normal", options: [
        ["normal", "Spokes to center"], ["cleared", "Open center"], ["cross", "Cross at center"]] }
    ],
    draw: function (p) {
      const dl = [];
      const m = p.margin * 72 + 20;
      const W = p.width, H = p.height;
      const xRad = (W - m) / 2 - 20;
      const circles = Math.floor(correct(p.x.circles, 1, 66));
      const spokes = Math.floor(correct(p.x.spokes, 2, 2000));
      if (xRad <= 0) return { dl: dl, pitch: 10, count: 0 };
      const wide = correct(p.x.primaryweight, 0.1, 10);
      dl.push(["S", p.gridColor, wide]);
      for (let r = xRad / circles; r <= xRad + 0.005; r += xRad / circles) {
        dl.push(["C", W / 2, H / 2, r]);
      }
      const gcd = function (a, b) { return b ? gcd(b, a % b) : a; };
      let cleared = Math.floor(circles / 7);
      if (cleared < 1) cleared = 1;
      // Primaries draw at the bold (ring) weight, per the original.
      const PI = Math.PI;
      let location = 2 * PI, count = 0, go = true;
      if (p.x.center === "cross") {
        dl.push(["L", W / 2 - 4, H / 2, W / 2 + 4, H / 2]);
        dl.push(["L", W / 2, H / 2 - 4, W / 2, H / 2 + 4]);
      }
      while (go) {
        const sx = Math.sin(location + PI / 2), cy = Math.cos(location + PI / 2);
        if (p.x.center === "normal") {
          dl.push(["L", W / 2, H / 2, sx * xRad + W / 2, cy * xRad + H / 2]);
        } else {
          dl.push(["L", sx * (xRad * cleared / circles) + W / 2,
                        cy * (xRad * cleared / circles) + H / 2,
                        sx * xRad + W / 2, cy * xRad + H / 2]);
        }
        const lx = sx * xRad * 1.1 + W / 2, ly = cy * xRad * 1.1 + H / 2 - 4;
        if (p.x.labels === "radians") {
          if (count * 2 === spokes) {
            dl.push(["T", lx, ly, 12, "p", "c", "s"]);
          } else if (count) {
            const g = gcd(count * 2, spokes);
            if (count * 2 / g === 1) {
              dl.push(["T", lx, ly, 12, "p/" + (spokes / g), "c", "s"]);
            } else if (spokes > g) {
              dl.push(["T", lx, ly, 12, (count * 2 / g) + "p/" + (spokes / g), "c", "s"]);
            }
          } else {
            dl.push(["T", lx, ly, 12, "0", "c", "s"]);
          }
        } else if (p.x.labels === "degrees") {
          if (count) {
            const d = Math.floor(360 / spokes * count);
            if (d < 360) dl.push(["T", lx, ly, 12, d, "c", "h"]);
          } else {
            dl.push(["T", lx, ly, 12, "0", "c", "h"]);
          }
        }
        count++;
        location -= 2 * PI / spokes;
        if (location < 0) go = false;
      }
      // Secondary spokes: thinner, and culled from the center — they
      // start at the 1/3-radius ring so dense counts don't blob.
      const secondary = Math.floor(correct(p.x.secondary, 0, 2000));
      if (secondary >= 2) {
        dl.push(["S", p.gridColor, correct(p.x.narrowweight, 0, 10) || 0.0001]);
        const guess = Math.max(1, Math.floor(circles / 3));
        let loc = 0;
        while (loc < 2 * PI) {
          const sx = Math.sin(loc + PI / 2), cy = Math.cos(loc + PI / 2);
          dl.push(["L", sx * (xRad * guess / circles) + W / 2,
                        cy * (xRad * guess / circles) + H / 2,
                        sx * xRad + W / 2, cy * xRad + H / 2]);
          loc += 2 * PI / secondary;
        }
      }
      return { dl: dl, pitch: xRad / circles, count: dl.length };
    },
    picks: [
      { name: "Degrees · 12 Primary · 72 Fine", set: { circles: "10", spokes: "12", secondary: "72",
        labels: "degrees", center: "normal", primaryweight: "0.7", narrowweight: "0.35", gridColor: "000000" } },
      { name: "Radians · 24 Spokes", set: { circles: "10", spokes: "24", secondary: "0",
        labels: "radians", center: "cleared", primaryweight: "0.7", narrowweight: "0.35", gridColor: "000000" } },
      { name: "180 Spoke Degrees", set: { circles: "12", spokes: "36", secondary: "180",
        labels: "degrees", center: "cleared", primaryweight: "0.7", narrowweight: "0.25", gridColor: "000000" } },
      { name: "Unit Circle · Radians", set: { circles: "1", spokes: "12", secondary: "0",
        labels: "radians", center: "normal", primaryweight: "1.2", narrowweight: "0.5", gridColor: "000000" } },
      { name: "Unit Circle · Degrees", set: { circles: "1", spokes: "24", secondary: "0",
        labels: "degrees", center: "normal", primaryweight: "1.2", narrowweight: "0.5", gridColor: "000000" } }
    ]
  },

  {
    id: "logarithmic",
    name: "Log / Semi-Log",
    blurb: "Log cycles, labeled.",
    note: "In 2017, ad robots twice deemed this page \u0022no content\u0022 and log paper \u0022valueless.\u0022 For log graph paper to be considered as having no content is an insult to all log fans everywhere! We must never forget these dark times.",
    spacing: null,
    weight: { label: "Line weight", def: 0.7 },
    extras: [
      { t: "sel", id: "xaxis", label: "X axis", def: "2", options: [
        ["linear", "Linear"], ["1", "1 cycle"], ["2", "2 cycles"], ["3", "3 cycles"],
        ["4", "4 cycles"], ["5", "5 cycles"], ["6", "6 cycles"]] },
      { t: "chk", id: "xfine", label: " ", text: "Fine X subdivisions", def: true },
      { t: "sp2", id: "xspacing", label: "X spacing (linear)", def: 4 },
      { t: "sel", id: "yaxis", label: "Y axis", def: "3", options: [
        ["linear", "Linear"], ["1", "1 cycle"], ["2", "2 cycles"], ["3", "3 cycles"],
        ["4", "4 cycles"], ["5", "5 cycles"], ["6", "6 cycles"]] },
      { t: "chk", id: "yfine", label: " ", text: "Fine Y subdivisions", def: true },
      { t: "sp2", id: "yspacing", label: "Y spacing (linear)", def: 4 },
      { t: "chk", id: "square", label: "Shape", text: "Force square plot", def: false }
    ],
    draw: function (p) {
      const dl = [];
      // Precomputed log10 tables from the original (fidelity!)
      const NARROW = [0.0211893,0.04139269,0.06069784,0.07918125,0.11394335,
        0.13033377,0.14612804,0.161368,0.1903317,0.20411998,0.21748394,
        0.23044892,0.25527251,0.26717173,0.2787536,0.29003461,0.31175386,
        0.32221929,0.33243846,0.34242268,0.36172784,0.37106786,0.38021124,
        0.38916608,0.40654018,0.41497335,0.42324587,0.43136376,0.44715803,
        0.45484486,0.462398,0.46982202,0.49136169,0.50514998,0.51851394,
        0.53147892,0.5563025,0.56820172,0.5797836,0.59106461,0.61278386,
        0.62324929,0.63346846,0.64345268,0.66275783,0.67209786,0.68124124,
        0.69019608,0.69897,0.71600334,0.73239376,0.74818803,0.76342799,
        0.79239169,0.80617997,0.81954394,0.83250891,0.8573325,0.86923172,
        0.88081359,0.8920946,0.91381385,0.92427929,0.93449845,0.94448267,
        0.96378783,0.97312785,0.98227123,0.99122608];
      const WIDE = [0,0.09691001,0.17609126,0.24303805,0.30103,0.35218252,
        0.39794001,0.43933269,0.47712125,0.54406804,0.60205999,0.65321251,
        0.69897,0.77815125,0.84509804,0.90308999,0.95424251,1.0];
      const m = p.margin * 72 + 18;
      const wideW = correct(p.weight, 0.1, 10);
      const narrowW = wideW * 0.3;
      let totalX = p.width, totalY = p.height;
      if (p.x.square) {
        if (totalX < totalY) totalY = totalX;
        if (totalX > totalY) totalX = totalY;
      }
      const xcycles = p.x.xaxis === "linear" ? 0 : Math.floor(correct(p.x.xaxis, 1, 6));
      const ycycles = p.x.yaxis === "linear" ? 0 : Math.floor(correct(p.x.yaxis, 1, 6));
      const xsp = perOffset(p.x.xspacing, p.x.xspacing_units);
      const ysp = perOffset(p.x.yspacing, p.x.yspacing_units);
      if (totalX - 2 * m <= 0 || totalY - 2 * m <= 0)
        return { dl: dl, pitch: 10, count: 0 };
      const FS = 8;
      if (ycycles) {
        const ySize = (totalY - m * 2) / ycycles;
        for (let cyc = 0; cyc < ycycles; cyc++) {
          const yOff = ySize * cyc;
          if (p.x.yfine) {
            dl.push(["S", p.gridColor, narrowW]);
            for (const n of NARROW) {
              dl.push(["L", m, yOff + m + n * ySize, totalX - m, yOff + m + n * ySize]);
            }
          }
          dl.push(["S", p.gridColor, wideW]);
          for (const n of WIDE) {
            dl.push(["L", m, yOff + m + n * ySize, totalX - m, yOff + m + n * ySize]);
          }
          for (let num = (cyc === 0 ? 1 : 2); num <= 10; num++) {
            dl.push(["T", m - 6, yOff + m - 2 + Math.log10(num) * ySize,
              FS, num, "c", "h"]);
          }
        }
      } else {
        dl.push(["S", p.gridColor, narrowW]);
        let ypos = 0;
        while (ypos <= totalY - m * 2) {
          dl.push(["L", m, ypos + m, totalX - m, ypos + m]);
          ypos += ysp;
        }
        dl.push(["L", m, totalY - m, totalX - m, totalY - m]);
      }
      if (xcycles) {
        const xSize = (totalX - m * 2) / xcycles;
        for (let cyc = 0; cyc < xcycles; cyc++) {
          const xOff = xSize * cyc;
          if (p.x.xfine) {
            dl.push(["S", p.gridColor, narrowW]);
            for (const n of NARROW) {
              dl.push(["L", xOff + m + n * xSize, m, xOff + m + n * xSize, totalY - m]);
            }
          }
          dl.push(["S", p.gridColor, wideW]);
          for (const n of WIDE) {
            dl.push(["L", xOff + m + n * xSize, m, xOff + m + n * xSize, totalY - m]);
          }
          for (let num = (cyc === 0 ? 1 : 2); num <= 10; num++) {
            dl.push(["T", xOff + m + Math.log10(num) * xSize, m - 9,
              FS, num, "c", "h"]);
          }
        }
      } else {
        dl.push(["S", p.gridColor, narrowW]);
        let xpos = 0;
        while (xpos <= totalX - m * 2) {
          dl.push(["L", m + xpos, m, m + xpos, totalY - m]);
          xpos += xsp;
        }
        xpos = totalX - m * 2;
        dl.push(["L", m + xpos, m, m + xpos, totalY - m]);
      }
      const cycles = Math.max(xcycles, ycycles, 1);
      return { dl: dl, pitch: (totalY - 2 * m) / (cycles * 10), count: dl.length };
    },
    picks: [
      { name: "Semi-Log · 3 Y cycles",
        set: { xaxis: "linear", yaxis: "3", xspacing: "4", xspacing_units: "inch",
               yfine: "1", weight: "0.7", gridColor: "00b300" } },
      { name: "Log-Log · 2 × 3",
        set: { xaxis: "2", yaxis: "3", xfine: "1", yfine: "1",
               weight: "0.7", gridColor: "b3b3b3" } }
    ]
  },

  {
    id: "lite",
    name: "Simple Boxes",
    blurb: "Exactly the squares you ask for.",
    note: "Especially useful if you need a specific number of squares on a sheet.",
    spacing: { mode: "size", label: "Square size", def: 0.5, min: 0.01, max: 10 },
    weight: { label: "Line thickness", def: 0.3 },
    extras: [
      { t: "num", id: "numx", label: "Squares across", def: 10, min: 1, max: 1000 },
      { t: "num", id: "numy", label: "Squares down", def: 10, min: 1, max: 1000 }
    ],
    draw: function (p) {
      // Unlike the others, this one counts squares; margin is ignored
      // (the original lite.pl had no margin parameter).
      const dl = [], o = p.offset, wt = p.weight;
      const nx = Math.floor(correct(p.x.numx, 1, 1000));
      const ny = Math.floor(correct(p.x.numy, 1, 1000));
      const lw = o * nx, lh = o * ny;
      const xStart = (p.width - lw) / 2, yStart = (p.height - lh) / 2;
      let y = yStart, x = xStart;
      while (y <= (p.height - yStart) + 0.005) {
        dl.push(["L", xStart - wt / 2, y, xStart + lw + wt / 2, y]);
        y += o;
      }
      while (x <= (p.width - xStart) + 0.005) {
        dl.push(["L", x, yStart - wt / 2, x, yStart + lh + wt / 2]);
        x += o;
      }
      return { dl: dl, pitch: o, count: dl.length };
    },
    picks: [
      { name: "10 × 10 Half Inch", set: { spacing: "0.5", spacing_units: "inch",
        numx: "10", numy: "10", weight: "0.3", gridColor: "000000" } },
      { name: "Chessboard 8 × 8", set: { spacing: "1", spacing_units: "inch",
        numx: "8", numy: "8", weight: "0.8", gridColor: "000000" } }
    ]
  },

  {
    id: "circlesquare",
    name: "Circle Square",
    blurb: "Circles, grid, and spokes.",
    spacing: { mode: "size", label: "Ring spacing", def: 0.5, max: 5 },
    weight: { label: "Line thickness", def: 0.5 },
    extras: [
      { t: "num", id: "spokes", label: "Spokes", def: 8, min: 2, max: 400 }
    ],
    draw: function (p) {
      const dl = [], sq = p.offset;
      const m = p.margin * 72;
      const useX = p.width - m, useY = p.height - m + 15;
      const cX = p.width / 2, cY = p.height / 2;
      const xRad = useX / 2;
      let n = Math.min(Math.floor(useX / sq), Math.floor(useY / sq));
      n = Math.floor(n / 2);
      if (n < 1) return { dl: dl, pitch: sq, count: 0 };
      for (let i = 1; i <= n; i++) dl.push(["C", cX, cY, i * sq]);
      const ext = n * sq;
      for (let i = -1; i < n; i++) {
        dl.push(["L", cX - ext + sq * (i + 1), cY - ext, cX - ext + sq * (i + 1), cY + ext]);
        dl.push(["L", cX - ext + sq * i + (n + 1) * sq, cY - ext,
                      cX - ext + sq * i + (n + 1) * sq, cY + ext]);
        dl.push(["L", cX - ext, cY - ext + sq * (1 + i), cX + ext, cY - ext + sq * (1 + i)]);
        dl.push(["L", cX - ext, cY - ext + sq * i + (n + 1) * sq,
                      cX + ext, cY - ext + sq * i + (n + 1) * sq]);
      }
      const spokes = Math.floor(correct(p.x.spokes, 2, 400));
      const PI = Math.PI;
      let loc = 2 * PI, go = true;
      while (go) {
        dl.push(["L", cX, cY,
          Math.sin(loc + PI / 2) * xRad + cX, Math.cos(loc + PI / 2) * xRad + cY]);
        loc -= 2 * PI / spokes;
        if (loc < 0) go = false;
      }
      return { dl: dl, pitch: sq, count: dl.length };
    },
    picks: [{ name: "Half Inch · 8 Spokes",
      set: { spacing: "0.5", spacing_units: "inch", spokes: "8", weight: "0.5", gridColor: "b3b3b3" } }]
  },

  {
    id: "fretboard",
    name: "Fretboard Diagrams",
    blurb: "Blank chord charts.",
    note: "The diagrams have variable height-to-width ratios \u2014 real examples range from square to 3:1. The ratio here is determined by rows and columns: on 8.5 \u00d7 11, a 6 \u00d7 6 grid gives slightly taller-than-wide diagrams. Want them squarer? Fewer columns or more rows. See how it works? You\u2019ll get the hang of it. :-)",
    spacing: null,
    weight: { label: "Line thickness", def: 0.7 },
    extras: [
      { t: "num", id: "strings", label: "Strings", def: 6, min: 2, max: 15 },
      { t: "num", id: "frets", label: "Frets", def: 5, min: 2, max: 15 },
      { t: "num", id: "columns", label: "Diagrams across", def: 3, min: 2, max: 15 },
      { t: "num", id: "rows", label: "Diagrams down", def: 4, min: 2, max: 15 }
    ],
    draw: function (p) {
      const dl = [];
      // Original used the margin value in raw points (a bug); we use
      // inches * 72, which is clearly the intent.
      const m = p.margin * 72;
      const strings = Math.floor(correct(p.x.strings, 2, 15));
      const frets = Math.floor(correct(p.x.frets, 2, 15));
      const cols = Math.floor(correct(p.x.columns, 2, 15)) * 2 + 1;
      const rows = Math.floor(correct(p.x.rows, 2, 15)) * 2 + 1;
      const uX = p.width - m * 2, uY = p.height - m * 2;
      if (uX <= 0 || uY <= 0) return { dl: dl, pitch: 20, count: 0 };
      const colD = uX / cols, rowD = uY / rows;
      const fretD = rowD / (frets - 1), stringD = colD / (strings - 1);
      for (let r = 1; r < rows; r += 2) {
        for (let c = 1; c < cols; c += 2) {
          for (let f = 0; f < frets; f++) {
            dl.push(["L", c * colD + m, f * fretD + r * rowD + m,
                          c * colD + colD + m, f * fretD + r * rowD + m]);
          }
          for (let s = 0; s < strings; s++) {
            dl.push(["L", c * colD + s * stringD + m, r * rowD + m,
                          c * colD + s * stringD + m, rowD + r * rowD + m]);
          }
        }
      }
      return { dl: dl, pitch: rowD, count: dl.length };
    },
    picks: [
      { name: "Guitar · 3 × 4", set: { strings: "6", frets: "5", columns: "3", rows: "4",
        weight: "0.7", gridColor: "000000" } },
      { name: "Ukulele · 4 × 5", set: { strings: "4", frets: "5", columns: "4", rows: "5",
        weight: "0.7", gridColor: "000000" } }
    ]
  },

  {
    id: "musicsuper",
    name: "Music Grid",
    blurb: "Staves over a light grid.",
    spacing: null,
    weight: { label: "Staff line weight", def: 0.6 },
    extras: [
      { t: "num", id: "staves", label: "Staves per page", def: 8, min: 1, max: 80 },
      { t: "num", id: "gap", label: "Interstaff space (lines)", def: 5, min: 1, max: 20 },
      { t: "num", id: "columns", label: "Columns", def: 24, min: 2, max: 500 },
      { t: "col", id: "lightgridcolor", label: "Light grid color", def: "cccccc" },
      { t: "chk", id: "topper", label: "Title room", text: "Leave room at top", def: false }
    ],
    draw: function (p) {
      const dl = [];
      const staves = correct(p.x.staves, 1, 80);
      const lps = 5;
      const gap = Math.floor(correct(p.x.gap, 1, 20));
      const cols = Math.floor(correct(p.x.columns, 2, 500));
      const light = checkColor(p.x.lightgridcolor, "cccccc");
      const lw = p.weight, lwl = lw / 2;
      let totalLines = lps * staves + gap * (staves - 1);
      const loopLines = totalLines;
      if (p.x.topper) totalLines += lps + gap;
      const uW = p.width - p.margin * 144, uH = p.height - p.margin * 144;
      if (uW <= 0 || totalLines < 1) return { dl: dl, pitch: 10, count: 0 };
      const off = uH / totalLines;
      const colOff = uW / cols;
      let x = (p.width - uW) / 2;
      const yBase = (p.height - uH) / 2;
      dl.push(["S", light, lwl]);
      for (let cn = 0; cn <= cols; cn++) {
        dl.push(["L", x, yBase, x, yBase + uH - (gap + 1)]);
        x += colOff;
      }
      x = (p.width - uW) / 2;
      let y = yBase;
      for (let n = 0; n < loopLines; n++) {
        if (n % (lps + gap) < lps) {
          dl.push(["S", p.gridColor, lw]);
          dl.push(["L", x, y, x + uW, y]);
        } else {
          dl.push(["S", light, lwl]);
          dl.push(["L", x, y, x + uW, y]);
        }
        y += off;
      }
      return { dl: dl, pitch: off, count: dl.length };
    },
    picks: [{ name: "8 Staves · 24 Columns",
      set: { staves: "8", gap: "5", columns: "24", weight: "0.6",
             lightgridcolor: "cccccc", gridColor: "000000" } }]
  },

  {
    id: "cornellstaff",
    name: "Cornell Music",
    blurb: "Cornell notes, staves.",
    spacing: null,
    weight: { label: "Staff weight", def: 0.5 },
    extras: [
      { t: "num", id: "staves", label: "Staves per page", def: 6, min: 1, max: 80 },
      { t: "num", id: "lps", label: "Lines per staff", def: 5, min: 1, max: 11 },
      { t: "num", id: "gap", label: "Interstaff space (lines)", def: 5, min: 1, max: 20 },
      { t: "pct", id: "hsize", label: "Note width", def: 75 },
      { t: "pct", id: "vsize", label: "Note height", def: 80 },
      { t: "wt", id: "obweight", label: "Border weight", def: 1, min: 0, max: 20 },
      { t: "wt", id: "ihweight", label: "Divider weight", def: 1.5, min: 0.02, max: 20 },
      { t: "chk", id: "cueright", label: "Cue column", text: "Cue on the right", def: false },
      { t: "chk", id: "sumtop", label: "Summary", text: "Summary on top", def: false }
    ],
    draw: function (p) {
      const dl = [];
      const m = p.margin * 72;
      const uW = p.width - 2 * m, uH = p.height - 2 * m;
      const ob = correct(p.x.obweight, 0, 20);
      const gw = p.weight;
      const staves = Math.floor(correct(p.x.staves, 1, 80));
      const lps = Math.floor(correct(p.x.lps, 1, 11));
      const lsp = Math.floor(correct(p.x.gap, 1, 20));
      const hsize = correct(p.x.hsize, 0, 100) / 100;
      const vsize = correct(p.x.vsize, 0, 100) / 100;
      const gridW = uW * hsize, gridH = uH * vsize;
      const gridOffset = 72 / lsp;
      const xS = Math.floor(gridW / gridOffset), yS = Math.floor(gridH / gridOffset);
      const lineW = gridOffset * xS, lineH = gridOffset * yS;
      const xStart = (p.width - lineW) / 2 + (uW - gridW) / 2;
      const yStart = (p.height - lineH) / 2 + (uH - gridH) / 2;
      if (ob) {
        dl.push(["S", p.gridColor, ob]);
        dl.push(["L", m, m, p.width - m, m]);
        dl.push(["L", m, p.height - m, p.width - m, p.height - m]);
        dl.push(["L", m, m, m, p.height - m]);
        dl.push(["L", p.width - m, m, p.width - m, p.height - m]);
      }
      const sumTop = !!p.x.sumtop, cueRight = !!p.x.cueright;
      let y = sumTop ? m : yStart;
      const x = cueRight ? m : xStart;
      const totalLines = lps * staves + lsp * (staves - 1) + lsp * 2;
      let ln = lsp;
      const off = gridH / totalLines;
      dl.push(["S", p.gridColor, gw]);
      while (ln < totalLines) {
        if (ln % (lps + lsp) < lps) dl.push(["L", x, y, x + lineW, y]);
        y += off;
        ln++;
      }
      cornellSeparators(p, dl,
        { m: m, xStart: xStart, yStart: yStart, cueRight: cueRight, sumTop: sumTop });
      return { dl: dl, pitch: off, count: dl.length };
    },
    picks: [{ name: "6 Staves · Classic",
      set: { staves: "6", lps: "5", gap: "5", weight: "0.5", gridColor: "000000" } }]
  },

  {
    id: "cursive",
    name: "Penmanship Slant",
    blurb: "Slant guides for cursive.",
    note: "The old server took several minutes to render this one. Your browser just did it before you finished this sentence.",
    spacing: null,
    weight: { label: "Line weight", def: 0.7 },
    extras: [
      { t: "sz2", id: "linespacing", label: "Line spacing", def: 0.5 },
      { t: "sz2", id: "slantspacing", label: "Slant spacing", def: 0.5 },
      { t: "num", id: "slantangle", label: "Slant angle (deg)", def: 60, min: 40, max: 130 },
      { t: "wt", id: "slantweight", label: "Slant weight", def: 0.3, min: 0.01, max: 20 }
    ],
    density: function (p) {
      const lo = sizePts(p.x.linespacing, p.x.linespacing_units, 0.1, 50);
      const so = sizePts(p.x.slantspacing, p.x.slantspacing_units, 0.1, 50);
      return (p.width / so) * (p.height / lo);
    },
    draw: function (p) {
      const dl = [];
      const lineOff = sizePts(p.x.linespacing, p.x.linespacing_units, 0.1, 50);
      const slantOff = sizePts(p.x.slantspacing, p.x.slantspacing_units, 0.1, 50);
      const angle = correct(p.x.slantangle, 40, 130);
      const sw = correct(p.x.slantweight, 0.01, 20);
      const uW = p.width - p.margin * 144, uH = p.height - p.margin * 144;
      const nSlant = Math.floor(uW / slantOff), nLines = Math.floor(uH / lineOff);
      if (nSlant < 1 || nLines < 1) return { dl: dl, pitch: lineOff, count: 0 };
      const xStart = p.margin * 72, yStart = p.margin * 72;
      dl.push(["S", p.gridColor, sw]);
      const dx = Math.cos(angle * Math.PI / 180) * lineOff;
      for (let i = 0; i < nSlant; i++) {
        const x = xStart + i * slantOff;
        for (let j = 0; j < nLines; j++) {
          const y = yStart + j * lineOff;
          dl.push(["L", x, y, x + dx, y + lineOff]);
        }
      }
      dl.push(["S", p.gridColor, p.weight]);
      for (let j = 0; j <= nLines; j++) {
        const y = yStart + j * lineOff;
        dl.push(["L", xStart, y, xStart + uW, y]);
      }
      return { dl: dl, pitch: lineOff, count: dl.length };
    },
    picks: [
      { name: "Half Inch · 60°", set: { linespacing: "0.5", linespacing_units: "inch",
        slantspacing: "0.5", slantspacing_units: "inch", slantangle: "60",
        weight: "0.7", slantweight: "0.3", gridColor: "b3b3b3" } },
      { name: "Left-Hand · 120°", set: { linespacing: "0.5", linespacing_units: "inch",
        slantspacing: "0.5", slantspacing_units: "inch", slantangle: "120",
        weight: "0.7", slantweight: "0.3", gridColor: "b3b3b3" } }
    ]
  },

  {
    id: "paper174",
    name: "174 Paper",
    blurb: "Grid with a clear left column.",
    note: "Nostalgic for UK Government and Civil Service \u0022174 paper\u0022? I know I am.",
    spacing: { label: "columns", def: 4, min: 0.2, max: 30 },
    weight: { label: "Line thickness", def: 0.5 },
    extras: [
      { t: "sp2", id: "vspacing", label: "Rows", def: 4 },
      { t: "num", id: "super", label: "Clear columns", def: 4, min: 2, max: 40 }
    ],
    draw: function (p) {
      const dl = [];
      const hOff = p.offset;
      const vOff = perOffset(p.x.vspacing, p.x.vspacing_units);
      let sup = Math.floor(correct(p.x.super, 2, 40));
      const wt = p.weight;
      const uW = p.width - p.margin * 144, uH = p.height - p.margin * 144;
      const xS = Math.floor(uW / hOff), yS = Math.floor(uH / vOff);
      if (xS < 1 || yS < 1) return { dl: dl, pitch: Math.min(hOff, vOff), count: 0 };
      const lw = hOff * xS, lh = vOff * yS;
      const xStart = (p.width - lw) / 2, yStart = (p.height - lh) / 2;
      let y = yStart;
      while (y <= (p.height - yStart) + 0.005) {
        dl.push(["L", xStart - wt / 2, y, xStart + lw + wt / 2, y]);
        y += vOff;
      }
      let x = xStart, count = 0;
      while (x <= (p.width - xStart) + 0.005) {
        if (count > 1 && sup > 1) {
          sup--;
        } else {
          dl.push(["L", x, yStart - wt / 2, x, yStart + lh + wt / 2]);
        }
        x += hOff;
        count++;
      }
      return { dl: dl, pitch: Math.min(hOff, vOff), count: dl.length };
    },
    picks: [{ name: "Classic 174",
      set: { spacing: "4", spacing_units: "inch", vspacing: "4", vspacing_units: "inch",
             super: "4", weight: "0.5", gridColor: "b3b3b3" } }]
  },

  {
    id: "celticknot",
    name: "Celtic Knot",
    blurb: "Squares in eighths: 0-1-3-5-7.",
    spacing: { mode: "size", label: "Square size", def: 1 },
    weight: { label: "Major weight", def: 0.8 },
    extras: [
      { t: "wt", id: "minorweight", label: "Minor weight", def: 0.25, min: 0.01, max: 20 }
    ],
    draw: function (p) {
      // Per Kevin: each major square is cut into 8; of the subdivision
      // lines 0..8, only 0, 1, 3, 5, 7, 8 are rendered.
      const dl = [], S = p.offset;
      const g = gridLayout(p);
      if (!g.ok || g.nx < 1 || g.ny < 1) return { dl: dl, pitch: S, count: 0 };
      const lw = S * g.nx, lh = S * g.ny;
      const minW = correct(p.x.minorweight, 0.01, 20);
      for (let i = 0; i <= g.nx; i++) {
        const x = g.xStart + i * S;
        dl.push(["L", x, g.yStart, x, g.yStart + lh]);
      }
      for (let j = 0; j <= g.ny; j++) {
        const y = g.yStart + j * S;
        dl.push(["L", g.xStart, y, g.xStart + lw, y]);
      }
      dl.push(["S", p.gridColor, minW]);
      const F = [1, 3, 5, 7];
      for (let i = 0; i < g.nx; i++) {
        for (const f of F) {
          const x = g.xStart + i * S + (f * S) / 8;
          dl.push(["L", x, g.yStart, x, g.yStart + lh]);
        }
      }
      for (let j = 0; j < g.ny; j++) {
        for (const f of F) {
          const y = g.yStart + j * S + (f * S) / 8;
          dl.push(["L", g.xStart, y, g.xStart + lw, y]);
        }
      }
      return { dl: dl, pitch: S / 8, count: dl.length };
    },
    picks: [
      { name: "1 inch · Grey",
        set: { spacing: "1", spacing_units: "inch", weight: "0.8",
               minorweight: "0.25", gridColor: "b3b3b3" } },
      { name: "2cm · Black",
        set: { spacing: "2", spacing_units: "cm", weight: "0.8",
               minorweight: "0.25", gridColor: "000000" } }
    ]
  },

  {
    id: "ledger",
    name: "Accounting Ledger",
    blurb: "Columnar accounting paper.",
    spacing: null,
    weight: { label: "Line weight", def: 0.5 },
    extras: [
      { t: "num", id: "columns", label: "Money columns", def: 6, min: 1, max: 30 },
      { t: "num", id: "rows", label: "Rows", def: 40, min: 10, max: 120 },
      { t: "col", id: "altcolor", label: "Rule color", def: "770000" }
    ],
    draw: function (p) {
      // Ported from ledger_builder.pl. Fixed 30pt margins and 15pt
      // rows like the hand-built originals; page margin is ignored.
      const dl = [];
      const m = 30;
      const W = p.width, H = p.height;
      const useX = W - m, useY = H - m + 15;
      const cols = Math.floor(correct(p.x.columns, 1, 30)) + 3;
      const lines = Math.floor(correct(p.x.rows, 10, 120)) + 9;
      const main = p.gridColor;
      const alt = checkColor(p.x.altcolor, "770000");
      const f = p.weight / 0.5; // scale factor on the original weights
      if (useY - 4 - lines * 15 < m) {
        // Too many rows for the page: let it run off like the
        // original would, but keep at least a sane bottom.
      }
      const colW = (useX - (m + 20)) / cols;
      const xL = m + 10, xR = W - (m + 10);

      // Horizontal rules + row numbers
      for (let i = 1; i <= lines; i++) {
        const yBase = (useY - 4) - i * 15;
        if (i > 8 && i !== lines) {
          dl.push(["T", m, useY - i * 15, 8, i - 8, "c", "h"]);
          dl.push(["T", W - m, useY - i * 15, 8, i - 8, "c", "h"]);
        }
        if (i === 8 || i === 5 || i === lines) {
          dl.push(["S", alt, 0.3 * f]);
          dl.push(["L", xL, yBase, xR, yBase]);
          dl.push(["L", xL, yBase - 1, xR, yBase - 1]);
        } else if (i === 4) {
          dl.push(["S", alt, 0.3 * f]);
          dl.push(["L", xL, (useY - 12) - i * 15, xR, (useY - 12) - i * 15]);
          dl.push(["L", xL, (useY - 13) - i * 15, xR, (useY - 13) - i * 15]);
        } else if (i > 8 && (i - 8) % 5 === 0) {
          dl.push(["S", alt, 0.6 * f]);
          dl.push(["L", xL, yBase, xR, yBase]);
        } else {
          dl.push(["S", main, 0.5 * f]);
          dl.push(["L", xL, yBase, xR, yBase]);
        }
      }

      // Vertical column boundaries (doubled), at 0, 0.5, 3, 4..cols
      const gridStop = (useY - 4) - 5 * 15;
      const intGridStop = (useY - 4) - 8 * 15;
      const gridStart = (useY - 4) - lines * 15;
      const bounds = [0, 0.5];
      for (let v = 3; v <= cols; v++) bounds.push(v);
      dl.push(["S", alt, 0.2 * f]);
      for (const v of bounds) {
        const x = m + 10 + colW * v;
        dl.push(["L", x, gridStart, x, gridStop]);
        dl.push(["L", x - 1, gridStart, x - 1, gridStop]);
      }

      // Column number labels punched into the top rule (the originals
      // have these; the builder's version of this block was disabled)
      for (let v = 3; v < cols; v++) {
        const cx = m + 10 + colW * (v + 0.5);
        dl.push(["S", "ffffff", 1]);
        dl.push(["R", cx - 7, gridStop - 11, 14, 22]);
        dl.push(["S", alt, 0.2 * f]);
        dl.push(["T", cx, gridStop + 1, 8, v - 2, "c", "h"]);
      }

      // Cent subdivisions inside each money column
      const delta = ((useX - 20) / cols) / 10;
      for (let v = 3; v < cols; v++) {
        const start = m + 10 + colW * v;
        for (let d = 1.6; d <= 8; d++) {
          const heavier = (d === 1.6 || d === 4.6 || d === 7.6);
          dl.push(["S", main, (heavier ? 0.35 : 0.2) * f]);
          dl.push(["L", start + delta * d, gridStart, start + delta * d, intGridStop]);
        }
      }

      // The two little lines in the description area
      dl.push(["S", main, 0.15 * f]);
      dl.push(["L", m + 10 + colW * 2 - 15, gridStart, m + 10 + colW * 2 - 15, intGridStop]);
      dl.push(["L", m + 10 + colW * 0.5 - 15, gridStart, m + 10 + colW * 0.5 - 15, intGridStop]);

      return { dl: dl, pitch: 15, count: dl.length };
    },
    picks: [
      { name: "Green & Rust · 6 × 40",
        set: { columns: "6", rows: "40", gridColor: "007700", altcolor: "770000", weight: "0.5" } },
      { name: "Grey & Smoke · 6 × 40",
        set: { columns: "6", rows: "40", gridColor: "777777", altcolor: "444444", weight: "0.5" } },
      { name: "Cream & Green · 6 × 40",
        set: { columns: "6", rows: "40", gridColor: "888855", altcolor: "558855", weight: "0.5" } },
      { name: "13 Columns (Tabloid)",
        set: { columns: "13", rows: "40", width: "11", height: "17",
               gridColor: "007700", altcolor: "770000", weight: "0.5" } }
    ]
  },

  // ==================================================================
  // EXPERIMENTAL: new generators, never on the classic site.
  // ==================================================================

  {
    id: "axisgraph",
    name: "Numbered Axes",
    blurb: "Numbered X and Y axes.",
    spacing: { label: "lines", def: 4 },
    weight: { label: "Grid weight", def: 0.35 },
    extras: [
      { t: "wt", id: "axisweight", label: "Axis weight", def: 1.2, min: 0.05, max: 20 },
      { t: "num", id: "labelevery", label: "Label every N lines", def: 1, min: 1, max: 20 },
      { t: "sel", id: "quadrants", label: "Quadrants", def: "4", options: [
        ["4", "Four (centered origin)"], ["1", "One (origin bottom-left)"]] }
    ],
    draw: function (p) {
      const g = gridLayout(p), dl = [];
      if (!g.ok || g.nx < 2 || g.ny < 2) return { dl: dl, pitch: p.offset, count: 0 };
      const o = p.offset, lw = o * g.nx, lh = o * g.ny;
      const q1 = p.x.quadrants === "1";
      const ox = q1 ? 0 : Math.floor(g.nx / 2);
      const oy = q1 ? 0 : Math.floor(g.ny / 2);
      const n = Math.floor(correct(p.x.labelevery, 1, 20));
      for (let i = 0; i <= g.nx; i++) {
        const x = g.xStart + i * o;
        dl.push(["L", x, g.yStart, x, g.yStart + lh]);
      }
      for (let j = 0; j <= g.ny; j++) {
        const y = g.yStart + j * o;
        dl.push(["L", g.xStart, y, g.xStart + lw, y]);
      }
      const ax = g.xStart + ox * o, ay = g.yStart + oy * o;
      dl.push(["S", p.gridColor, correct(p.x.axisweight, 0.05, 20)]);
      dl.push(["L", ax, g.yStart, ax, g.yStart + lh]);
      dl.push(["L", g.xStart, ay, g.xStart + lw, ay]);
      const fs = Math.min(9, o * 0.45);
      for (let i = 0; i <= g.nx; i += n) {
        if (i === ox) continue;
        dl.push(["T", g.xStart + i * o, ay - fs - 2, fs, i - ox, "c", "h"]);
      }
      for (let j = 0; j <= g.ny; j += n) {
        if (j === oy) continue;
        dl.push(["T", ax - 3, g.yStart + j * o - fs / 3, fs, j - oy, "r", "h"]);
      }
      dl.push(["T", ax - 3, ay - fs - 2, fs, "0", "r", "h"]);
      return { dl: dl, pitch: o, count: dl.length };
    },
    picks: [{ name: "Four Quadrant · 4/inch",
      set: { spacing: "4", spacing_units: "inch", quadrants: "4", labelevery: "1",
             weight: "0.35", axisweight: "1.2", gridColor: "b3b3b3" } }]
  },

  {
    id: "engpad",
    name: "Engineering Pad",
    blurb: "The green engineering pad.",
    spacing: { label: "lines", def: 5 },
    weight: { label: "Grid weight", def: 0.25 },
    extras: [
      { t: "wt", id: "frameweight", label: "Frame weight", def: 0.8, min: 0.05, max: 20 }
    ],
    draw: function (p) {
      const dl = [], m = p.margin * 72, o = p.offset;
      const W = p.width, H = p.height;
      const headH = 36, marginX = m + 54; // left rule 0.75in inside margin
      const uW = W - 2 * m, uH = H - 2 * m - headH;
      if (uW <= 0 || uH <= 0) return { dl: dl, pitch: o, count: 0 };
      const nx = Math.floor(uW / o), ny = Math.floor(uH / o);
      const xs = (W - o * nx) / 2, ys = m + (uH - o * ny) / 2;
      for (let i = 0; i <= nx; i++) dl.push(["L", xs + i * o, ys, xs + i * o, ys + o * ny]);
      for (let j = 0; j <= ny; j++) dl.push(["L", xs, ys + j * o, xs + o * nx, ys + j * o]);
      dl.push(["S", p.gridColor, correct(p.x.frameweight, 0.05, 20)]);
      const topY = H - m, headY = H - m - headH;
      dl.push(["L", m, topY, W - m, topY]);
      dl.push(["L", m, headY, W - m, headY]);
      dl.push(["L", m + uW / 3, topY, m + uW / 3, headY]);
      dl.push(["L", m + (2 * uW) / 3, topY, m + (2 * uW) / 3, headY]);
      dl.push(["L", marginX, headY, marginX, m]);
      return { dl: dl, pitch: o, count: dl.length };
    },
    picks: [{ name: "Classic Green 5/inch",
      set: { spacing: "5", spacing_units: "inch", weight: "0.25",
             frameweight: "0.8", gridColor: "00b300", bgColor: "f4faf4" } }]
  },

  {
    id: "ternary",
    name: "Ternary Plot",
    blurb: "Three-part mixture plots.",
    spacing: null,
    weight: { label: "Outline weight", def: 1 },
    extras: [
      { t: "num", id: "divisions", label: "Divisions per side", def: 10, min: 2, max: 50 },
      { t: "wt", id: "minorweight", label: "Grid weight", def: 0.3, min: 0.02, max: 20 },
      { t: "chk", id: "labels", label: "Labels", text: "Percent labels on edges", def: true }
    ],
    draw: function (p) {
      const dl = [], m = p.margin * 72 + 18;
      const uW = p.width - 2 * m, uH = p.height - 2 * m;
      const S = Math.min(uW, uH / 0.866);
      if (S <= 0) return { dl: dl, pitch: 10, count: 0 };
      const hgt = S * 0.866;
      const Ax = (p.width - S) / 2, Ay = (p.height - hgt) / 2;
      const A = [Ax, Ay], B = [Ax + S, Ay], C = [Ax + S / 2, Ay + hgt];
      const div = Math.floor(correct(p.x.divisions, 2, 50));
      const mix = (P, Q, t) => [P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t];
      dl.push(["S", p.gridColor, correct(p.x.minorweight, 0.02, 20)]);
      for (let i = 1; i < div; i++) {
        const t = i / div;
        let a = mix(A, C, t), b = mix(B, C, t);
        dl.push(["L", a[0], a[1], b[0], b[1]]);
        a = mix(A, B, t); b = mix(C, B, t);
        dl.push(["L", a[0], a[1], b[0], b[1]]);
        a = mix(B, A, t); b = mix(C, A, t);
        dl.push(["L", a[0], a[1], b[0], b[1]]);
      }
      dl.push(["S", p.gridColor, p.weight]);
      dl.push(["P", [A[0], A[1], B[0], B[1], C[0], C[1]], true]);
      if (p.x.labels) {
        const step = div <= 20 ? Math.max(1, Math.round(div / 10)) : 5;
        for (let i = 0; i <= div; i += step) {
          const t = i / div, pct = Math.round(t * 100);
          let pt = mix(A, B, t);
          dl.push(["T", pt[0], pt[1] - 12, 7, pct, "c", "h"]);
          pt = mix(B, C, t);
          dl.push(["T", pt[0] + 5, pt[1] - 2, 7, pct, "l", "h"]);
          pt = mix(C, A, t);
          dl.push(["T", pt[0] - 5, pt[1] - 2, 7, pct, "r", "h"]);
        }
      }
      return { dl: dl, pitch: S / div, count: dl.length };
    },
    picks: [{ name: "10% Steps",
      set: { divisions: "10", labels: "1", weight: "1", minorweight: "0.3", gridColor: "000000" } }]
  },

  {
    id: "crossstitch",
    name: "Cross-Stitch",
    blurb: "Counted grid, center arrows.",
    spacing: { label: "squares", def: 10 },
    weight: { label: "Grid weight", def: 0.25 },
    extras: [
      { t: "num", id: "boldevery", label: "Bold every N", def: 10, min: 2, max: 50 },
      { t: "wt", id: "boldweight", label: "Bold weight", def: 0.8, min: 0.05, max: 20 }
    ],
    draw: function (p) {
      const g = gridLayout(p), dl = [];
      if (!g.ok || g.nx < 2 || g.ny < 2) return { dl: dl, pitch: p.offset, count: 0 };
      const o = p.offset, lw = o * g.nx, lh = o * g.ny;
      const every = Math.floor(correct(p.x.boldevery, 2, 50));
      const cx = Math.floor(g.nx / 2), cy = Math.floor(g.ny / 2);
      const boldsX = [], boldsY = [];
      for (let i = 0; i <= g.nx; i++) {
        ((i - cx) % every === 0 ? boldsX : []).push(i);
        if ((i - cx) % every !== 0) dl.push(["L", g.xStart + i * o, g.yStart, g.xStart + i * o, g.yStart + lh]);
      }
      for (let j = 0; j <= g.ny; j++) {
        ((j - cy) % every === 0 ? boldsY : []).push(j);
        if ((j - cy) % every !== 0) dl.push(["L", g.xStart, g.yStart + j * o, g.xStart + lw, g.yStart + j * o]);
      }
      dl.push(["S", p.gridColor, correct(p.x.boldweight, 0.05, 20)]);
      for (const i of boldsX) dl.push(["L", g.xStart + i * o, g.yStart, g.xStart + i * o, g.yStart + lh]);
      for (const j of boldsY) dl.push(["L", g.xStart, g.yStart + j * o, g.xStart + lw, g.yStart + j * o]);
      // Center arrows on all four edges
      const mx = g.xStart + cx * o, my = g.yStart + cy * o, a = Math.min(8, o);
      dl.push(["P", [mx - a / 2, g.yStart + lh + a, mx + a / 2, g.yStart + lh + a, mx, g.yStart + lh + 2], true]);
      dl.push(["P", [mx - a / 2, g.yStart - a, mx + a / 2, g.yStart - a, mx, g.yStart - 2], true]);
      dl.push(["P", [g.xStart - a, my - a / 2, g.xStart - a, my + a / 2, g.xStart - 2, my], true]);
      dl.push(["P", [g.xStart + lw + a, my - a / 2, g.xStart + lw + a, my + a / 2, g.xStart + lw + 2, my], true]);
      return { dl: dl, pitch: o, count: dl.length };
    },
    picks: [{ name: "14 Count Aida",
      set: { spacing: "14", spacing_units: "inch", boldevery: "10",
             weight: "0.25", boldweight: "0.8", gridColor: "b3b3b3" } }]
  },

  {
    id: "hexmap",
    name: "Numbered Hex Map",
    blurb: "Numbered wargame hexes.",
    spacing: { label: "hexes", def: 1 },
    weight: { label: "Line thickness", def: 0.5 },
    extras: [
      { t: "chk", id: "labels", label: "Labels", text: "Number each hex (colrow)", def: true }
    ],
    draw: function (p) {
      const dl = [];
      const h = p.offset, s = h / Math.sqrt(3);
      const uW = p.width - p.margin * 144, uH = p.height - p.margin * 144;
      const cols = Math.floor((uW / s - 0.5) / 1.5);
      const rows = Math.floor(uH / h - 0.5);
      if (cols < 1 || rows < 1) return { dl: dl, pitch: h, count: 0 };
      const totalW = s * (1.5 * cols + 0.5), totalH = h * (rows + 0.5);
      const left = (p.width - totalW) / 2, bottom = (p.height - totalH) / 2;
      const pad2 = (n) => (n < 10 ? "0" : "") + n;
      const fs = Math.max(4, Math.min(9, h * 0.16));
      const texts = [];
      for (let i = 0; i < cols; i++) {
        const cx = left + s * (1 + 1.5 * i);
        const stag = (i % 2) ? h / 2 : 0;
        for (let j = 0; j < rows; j++) {
          const cy = bottom + h / 2 + j * h + stag;
          if (cy + h / 2 > bottom + totalH + 0.01) continue;
          dl.push(["P", [cx - s, cy, cx - s / 2, cy + h / 2, cx + s / 2, cy + h / 2,
                         cx + s, cy, cx + s / 2, cy - h / 2, cx - s / 2, cy - h / 2], true]);
          if (p.x.labels) {
            texts.push(["T", cx, cy + h / 2 - fs - 1, fs, pad2(i + 1) + pad2(j + 1), "c", "h"]);
          }
        }
      }
      for (const t of texts) dl.push(t);
      return { dl: dl, pitch: h, count: dl.length };
    },
    picks: [{ name: "1 inch · Numbered",
      set: { spacing: "1", spacing_units: "inch", labels: "1", weight: "0.5", gridColor: "b3b3b3" } }]
  },

  {
    id: "goboard",
    name: "Go Board",
    blurb: "Goban with star points.",
    mini: { x: { size: "9" }, patch: 3.6 },
    spacing: { mode: "size", label: "Cell size", def: 0.4, max: 3 },
    weight: { label: "Line thickness", def: 0.7 },
    extras: [
      { t: "sel", id: "size", label: "Board size", def: "19", options: [
        ["19", "19 × 19"], ["13", "13 × 13"], ["9", "9 × 9"]] }
    ],
    draw: function (p) {
      const dl = [], o = p.offset;
      const n = parseInt(p.x.size, 10) || 19;
      const span = o * (n - 1);
      const xs = (p.width - span) / 2, ys = (p.height - span) / 2;
      if (span > p.width || span > p.height) return { dl: dl, pitch: o, count: 0 };
      for (let i = 0; i < n; i++) {
        const w = (i === 0 || i === n - 1) ? p.weight * 1.8 : p.weight;
        dl.push(["S", p.gridColor, w]);
        dl.push(["L", xs + i * o, ys, xs + i * o, ys + span]);
        dl.push(["L", xs, ys + i * o, xs + span, ys + i * o]);
      }
      const hoshi = n === 19 ? [3, 9, 15] : (n === 13 ? [3, 6, 9] : [2, 4, 6]);
      dl.push(["S", p.gridColor, p.weight]);
      for (const i of hoshi) {
        for (const j of hoshi) {
          if (n === 9 && !((i === 4 && j === 4) || (i !== 4 && j !== 4))) continue;
          dl.push(["D", xs + i * o, ys + j * o, o * 0.09]);
        }
      }
      return { dl: dl, pitch: o, count: dl.length };
    },
    picks: [
      { name: "Full 19 × 19",
        set: { spacing: "0.4", spacing_units: "inch", size: "19", weight: "0.7", gridColor: "000000" } },
      { name: "Beginner 9 × 9",
        set: { spacing: "0.8", spacing_units: "inch", size: "9", weight: "0.7", gridColor: "000000" } }
    ]
  },

  {
    id: "perspective2",
    name: "Two-Point Perspective",
    blurb: "Two vanishing points.",
    spacing: null,
    weight: { label: "Ray weight", def: 0.35 },
    extras: [
      { t: "num", id: "plines", label: "Rays per point", def: 15, min: 4, max: 100 },
      { t: "pct", id: "horizon", label: "Horizon height", def: 50, min: 5, max: 95 },
      { t: "pct", id: "spread", label: "Vanishing point spread", def: 100, min: 50, max: 300 },
      { t: "chk", id: "vertical", label: "Guide", text: "Center vertical line", def: true }
    ],
    draw: function (p) {
      const dl = [], m = p.margin * 72;
      const W = p.width, H = p.height;
      const uH = H - 2 * m;
      const n = Math.floor(correct(p.x.plines, 4, 100));
      // horizon and spread arrive as percentages
      const hy = m + uH * (correct(p.x.horizon, 5, 95) / 100);
      const spread = correct(p.x.spread, 50, 300) / 100;
      const vpL = W / 2 - W * spread / 2, vpR = W / 2 + W * spread / 2;
      for (const vp of [vpL, vpR]) {
        const tx = vp === vpL ? W : 0; // rays aim across the page
        for (let i = 0; i <= n; i++) {
          const ty = m + (uH * i) / n;
          dl.push(["L", vp, hy, tx, ty]);
        }
      }
      dl.push(["S", p.gridColor, p.weight * 3]);
      dl.push(["L", m, hy, W - m, hy]);
      if (p.x.vertical) {
        dl.push(["S", p.gridColor, p.weight * 2]);
        dl.push(["L", W / 2, m, W / 2, H - m]);
      }
      dl.push(["S", "ffffff", 1]);
      dl.push(["R", 0, 0, m, H]);
      dl.push(["R", W - m, 0, m, H]);
      dl.push(["R", 0, 0, W, m]);
      dl.push(["R", 0, H - m, W, m]);
      return { dl: dl, pitch: uH / n, count: dl.length };
    },
    picks: [{ name: "Room Interior",
      set: { plines: "15", horizon: "50", spread: "120", vertical: "1",
             weight: "0.35", gridColor: "b3b3b3" } }]
  },

  {
    id: "habittracker",
    name: "Habit Tracker",
    blurb: "Numbered columns, habit rows.",
    spacing: null,
    weight: { label: "Line weight", def: 0.4 },
    extras: [
      { t: "num", id: "days", label: "Columns", def: 31, min: 7, max: 31 },
      { t: "num", id: "rows", label: "Rows", def: 52, min: 3, max: 60 },
      { t: "num", id: "namewidth", label: "Name column (inches)", def: 1.5, min: 0.5, max: 4 }
    ],
    draw: function (p) {
      const dl = [], m = p.margin * 72;
      const W = p.width, H = p.height;
      const days = Math.floor(correct(p.x.days, 7, 31));
      const rows = Math.floor(correct(p.x.rows, 3, 60));
      const nameW = correct(p.x.namewidth, 0.5, 4) * 72;
      const headH = 16;
      const uW = W - 2 * m - nameW, uH = H - 2 * m - headH;
      if (uW <= 0 || uH <= 0) return { dl: dl, pitch: 20, count: 0 };
      const colW = uW / days, rowH = uH / rows;
      const left = m, gridL = m + nameW, top = H - m;
      for (let j = 0; j <= rows; j++) {
        dl.push(["L", left, top - headH - j * rowH, W - m, top - headH - j * rowH]);
      }
      dl.push(["L", left, top, W - m, top]);
      dl.push(["L", left, top, left, m]);
      dl.push(["S", p.gridColor, p.weight * 2]);
      dl.push(["L", gridL, top, gridL, m]);
      dl.push(["S", p.gridColor, p.weight]);
      for (let i = 0; i <= days; i++) {
        dl.push(["L", gridL + i * colW, top, gridL + i * colW, m]);
      }
      const fs = Math.min(8, colW * 0.6);
      for (let i = 0; i < days; i++) {
        dl.push(["T", gridL + i * colW + colW / 2, top - headH + 4, fs, i + 1, "c", "h"]);
      }
      return { dl: dl, pitch: rowH, count: dl.length };
    },
    picks: [{ name: "31 × 52 Year Tracker",
      set: { days: "31", rows: "52", namewidth: "1.5", weight: "0.4", gridColor: "b3b3b3" } }]
  },

  {
    id: "splitpage",
    name: "Split Page",
    blurb: "Grid one side, lines the other.",
    spacing: null,
    weight: { label: "Line weight", def: 0.4 },
    extras: [
      { t: "sel", id: "layout", label: "Layout", def: "gridleft", options: [
        ["gridleft", "Grid left · lines right"], ["gridright", "Lines left · grid right"],
        ["gridtop", "Grid top · lines bottom"], ["gridbottom", "Lines top · grid bottom"]] },
      { t: "sp2", id: "gridspacing", label: "Grid spacing", def: 4 },
      { t: "sp2", id: "linespacing", label: "Line spacing", def: 3 }
    ],
    draw: function (p) {
      const dl = [], m = p.margin * 72, gap = 18;
      const W = p.width, H = p.height;
      const gO = perOffset(p.x.gridspacing, p.x.gridspacing_units);
      const lO = perOffset(p.x.linespacing, p.x.linespacing_units);
      const horiz = p.x.layout === "gridleft" || p.x.layout === "gridright";
      const gridFirst = p.x.layout === "gridleft" || p.x.layout === "gridtop";
      function gridIn(x0, y0, w, h) {
        const nx = Math.floor(w / gO), ny = Math.floor(h / gO);
        if (nx < 1 || ny < 1) return;
        const xs = x0 + (w - nx * gO) / 2, ys = y0 + (h - ny * gO) / 2;
        for (let i = 0; i <= nx; i++) dl.push(["L", xs + i * gO, ys, xs + i * gO, ys + ny * gO]);
        for (let j = 0; j <= ny; j++) dl.push(["L", xs, ys + j * gO, xs + nx * gO, ys + j * gO]);
      }
      function linesIn(x0, y0, w, h) {
        const ny = Math.floor(h / lO);
        if (ny < 1) return;
        const ys = y0 + (h - ny * lO) / 2;
        for (let j = 0; j <= ny; j++) dl.push(["L", x0, ys + j * lO, x0 + w, ys + j * lO]);
      }
      const uW = W - 2 * m, uH = H - 2 * m;
      if (uW <= gap || uH <= gap) return { dl: dl, pitch: gO, count: 0 };
      if (horiz) {
        const half = (uW - gap) / 2;
        const L = [m, m, half, uH], R = [m + half + gap, m, half, uH];
        gridIn.apply(null, gridFirst ? L : R);
        linesIn.apply(null, gridFirst ? R : L);
      } else {
        const half = (uH - gap) / 2;
        const T = [m, m + half + gap, uW, half], B = [m, m, uW, half];
        gridIn.apply(null, gridFirst ? T : B);
        linesIn.apply(null, gridFirst ? B : T);
      }
      return { dl: dl, pitch: Math.min(gO, lO), count: dl.length };
    },
    picks: [{ name: "Sketch & Notes",
      set: { layout: "gridleft", gridspacing: "4", gridspacing_units: "inch",
             linespacing: "3", linespacing_units: "inch", weight: "0.4", gridColor: "b3b3b3" } }]
  },

  {
    id: "beadpaper",
    name: "Bead Paper",
    blurb: "Peyote, brick, or loom.",
    spacing: { label: "beads", def: 8 },
    weight: { label: "Line thickness", def: 0.3 },
    extras: [
      { t: "sel", id: "style", label: "Stitch", def: "peyote", options: [
        ["peyote", "Peyote (column offset)"], ["brick", "Brick (row offset)"],
        ["loom", "Loom / square stitch"]] },
      { t: "sel", id: "ratio", label: "Bead shape", def: "0.84", options: [
        ["0.75", "Round seed (wide)"], ["0.84", "Delica cylinder"],
        ["1", "Square"], ["1.3", "Tall / bugle"]] },
      { t: "num", id: "customratio", label: "Custom ratio (0 = use preset)", def: 0, min: 0, max: 2 }
    ],
    draw: function (p) {
      const dl = [];
      const w = p.offset;
      const custom = correct(p.x.customratio, 0, 2);
      const h = w * (custom >= 0.3 ? custom : correct(p.x.ratio, 0.3, 2));
      const uW = p.width - p.margin * 144, uH = p.height - p.margin * 144;
      const nx = Math.floor(uW / w), ny = Math.floor(uH / h);
      if (nx < 1 || ny < 1) return { dl: dl, pitch: Math.min(w, h), count: 0 };
      const xs = (p.width - nx * w) / 2, ys = (p.height - ny * h) / 2;
      const style = p.x.style;
      for (let i = 0; i < nx; i++) {
        for (let j = 0; j < ny; j++) {
          let x = xs + i * w, y = ys + j * h;
          if (style === "peyote" && i % 2) {
            y -= h / 2;
            if (y < ys - h / 2 + 0.01 && j === 0) { /* half bead at edge: keep */ }
          }
          if (style === "brick" && j % 2) {
            x += w / 2;
            if (i === nx - 1) continue;
          }
          dl.push(["P", [x, y, x + w, y, x + w, y + h, x, y + h], true]);
        }
      }
      return { dl: dl, pitch: Math.min(w, h), count: dl.length };
    },
    picks: [
      { name: "Peyote · Delica",
        set: { spacing: "8", spacing_units: "inch", style: "peyote", ratio: "0.84",
               weight: "0.3", gridColor: "b3b3b3" } },
      { name: "Loom · Delica",
        set: { spacing: "8", spacing_units: "inch", style: "loom", ratio: "0.84",
               weight: "0.3", gridColor: "b3b3b3" } }
    ]
  },

  {
    id: "dotsboxes",
    name: "Dots & Boxes",
    blurb: "The pencil game.",
    spacing: { mode: "size", label: "Dot spacing", def: 0.5 },
    weight: { label: "Dot size", def: 2 },
    extras: [
      { t: "chk", id: "guides", label: "Guides", text: "Faint grid lines between dots", def: true },
      { t: "wt", id: "guideweight", label: "Guide weight", def: 0.1, min: 0.02, max: 5 },
      { t: "chk", id: "border", label: "Border", text: "Frame around the field", def: false }
    ],
    draw: function (p) {
      const g = gridLayout(p), dl = [];
      if (!g.ok || g.nx < 1 || g.ny < 1) return { dl: dl, pitch: p.offset, count: 0 };
      const o = p.offset, lw = o * g.nx, lh = o * g.ny;
      if (p.x.guides) {
        dl.push(["S", p.gridColor, correct(p.x.guideweight, 0.02, 5)]);
        for (let i = 0; i <= g.nx; i++) {
          dl.push(["L", g.xStart + i * o, g.yStart, g.xStart + i * o, g.yStart + lh]);
        }
        for (let j = 0; j <= g.ny; j++) {
          dl.push(["L", g.xStart, g.yStart + j * o, g.xStart + lw, g.yStart + j * o]);
        }
        dl.push(["S", p.gridColor, p.weight]);
      }
      for (let i = 0; i <= g.nx; i++) {
        for (let j = 0; j <= g.ny; j++) {
          dl.push(["D", g.xStart + i * o, g.yStart + j * o, p.weight / 2]);
        }
      }
      if (p.x.border) {
        dl.push(["S", p.gridColor, 0.75]);
        const pad = o / 2;
        dl.push(["P", [g.xStart - pad, g.yStart - pad,
                       g.xStart + lw + pad, g.yStart - pad,
                       g.xStart + lw + pad, g.yStart + lh + pad,
                       g.xStart - pad, g.yStart + lh + pad], true]);
      }
      return { dl: dl, pitch: o, count: dl.length };
    },
    picks: [{ name: "Half Inch Game",
      set: { spacing: "0.5", spacing_units: "inch", weight: "2", guides: "1",
             guideweight: "0.1", border: "1", gridColor: "000000" } }]
  },

  {
    id: "battlemat",
    name: "Battle Mat",
    blurb: "Hexes over squares.",
    spacing: { mode: "size", label: "Square size", def: 1, max: 5 },
    weight: { label: "Major weight", def: 1 },
    extras: [
      { t: "sel", id: "style", label: "Style", def: "hex", options: [
        ["hex", "Hexes over squares"], ["super", "Squares + heavy supergrid"]] },
      { t: "num", id: "sub", label: "Subdivisions per square", def: 4, min: 1, max: 10 },
      { t: "wt", id: "subweight", label: "Fine weight", def: 0.25, min: 0.02, max: 20 },
      { t: "txt", id: "scalelabel", label: "Scale note", def: "1 square = 5 feet" }
    ],
    draw: function (p) {
      const dl = [];
      const S = p.offset;
      const sub = Math.floor(correct(p.x.sub, 1, 10));
      const o = S / sub;
      const uW = p.width - p.margin * 144, uH = p.height - p.margin * 144;
      const nx = Math.floor(uW / S), ny = Math.floor(uH / S);
      if (nx < 1 || ny < 1) return { dl: dl, pitch: S, count: 0 };
      const xs = (p.width - nx * S) / 2, ys = (p.height - ny * S) / 2;
      const lw = nx * S, lh = ny * S;
      // Fine grid
      if (sub > 1) {
        dl.push(["S", p.gridColor, correct(p.x.subweight, 0.02, 20)]);
        for (let i = 0; i <= nx * sub; i++) {
          dl.push(["L", xs + i * o, ys, xs + i * o, ys + lh]);
        }
        for (let j = 0; j <= ny * sub; j++) {
          dl.push(["L", xs, ys + j * o, xs + lw, ys + j * o]);
        }
      }
      dl.push(["S", p.gridColor, p.weight]);
      if (p.x.style === "hex") {
        // Heavy hex overlay, hex height = square size, over the fine grid
        const h = S, s = h / Math.sqrt(3);
        const cols = Math.floor((lw / s - 0.5) / 1.5);
        const rows = Math.floor(lh / h - 0.5);
        const totalW = s * (1.5 * cols + 0.5), totalH = h * (rows + 0.5);
        const left = xs + (lw - totalW) / 2, bottom = ys + (lh - totalH) / 2;
        for (let i = 0; i < cols; i++) {
          const cx = left + s * (1 + 1.5 * i);
          const stag = (i % 2) ? h / 2 : 0;
          for (let j = 0; j < rows; j++) {
            const cy = bottom + h / 2 + j * h + stag;
            if (cy + h / 2 > bottom + totalH + 0.01) continue;
            dl.push(["P", [cx - s, cy, cx - s / 2, cy + h / 2, cx + s / 2, cy + h / 2,
                           cx + s, cy, cx + s / 2, cy - h / 2, cx - s / 2, cy - h / 2], true]);
          }
        }
      } else {
        for (let i = 0; i <= nx; i++) {
          dl.push(["L", xs + i * S, ys, xs + i * S, ys + lh]);
        }
        for (let j = 0; j <= ny; j++) {
          dl.push(["L", xs, ys + j * S, xs + lw, ys + j * S]);
        }
      }
      if (p.x.scalelabel) {
        dl.push(["T", p.width / 2, Math.max(6, ys - 14), 9, p.x.scalelabel, "c", "h"]);
      }
      return { dl: dl, pitch: o, count: dl.length };
    },
    picks: [
      { name: "D&D Classic · 1 inch",
        set: { spacing: "1", spacing_units: "inch", style: "super", sub: "4",
               weight: "1", subweight: "0.25", scalelabel: "1 square = 5 feet",
               gridColor: "b3b3b3" } },
      { name: "Hex Over Square",
        set: { spacing: "1", spacing_units: "inch", style: "hex", sub: "4",
               weight: "1.2", subweight: "0.2", scalelabel: "1 hex = 5 feet",
               gridColor: "777777" } }
    ]
  },

  {
    id: "alphanumeric",
    name: "Alpha-Numeric Grid",
    blurb: "Lettered rows, numbered columns.",
    spacing: { mode: "size", label: "Cell size", def: 0.5, max: 3 },
    weight: { label: "Line weight", def: 0.5 },
    extras: [
      { t: "sel", id: "sidetype", label: "Side labels are", def: "letters", options: [
        ["letters", "Letters on the side"], ["numbers", "Numbers on the side"]] },
      { t: "sel", id: "sidepos", label: "Side position", def: "left", options: [
        ["left", "Left"], ["right", "Right"], ["both", "Both"]] },
      { t: "sel", id: "toppos", label: "Top position", def: "top", options: [
        ["top", "Top"], ["bottom", "Bottom"], ["both", "Both"]] }
    ],
    draw: function (p) {
      const dl = [], S = p.offset, m = p.margin * 72;
      const toAlpha = (n) => {
        let s = "";
        do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; }
        while (n >= 0);
        return s;
      };
      const fs = Math.min(10, S * 0.4);
      const gut = Math.max(fs * 2, 14);
      const sideL = p.x.sidepos === "left" || p.x.sidepos === "both";
      const sideR = p.x.sidepos === "right" || p.x.sidepos === "both";
      const topT = p.x.toppos === "top" || p.x.toppos === "both";
      const topB = p.x.toppos === "bottom" || p.x.toppos === "both";
      const uW = p.width - 2 * m - (sideL ? gut : 0) - (sideR ? gut : 0);
      const uH = p.height - 2 * m - (topT ? gut : 0) - (topB ? gut : 0);
      const cols = Math.floor(uW / S), rows = Math.floor(uH / S);
      if (cols < 1 || rows < 1) return { dl: dl, pitch: S, count: 0 };
      const gx = m + (sideL ? gut : 0) + (uW - cols * S) / 2;
      const gy = m + (topB ? gut : 0) + (uH - rows * S) / 2;
      for (let i = 0; i <= cols; i++) dl.push(["L", gx + i * S, gy, gx + i * S, gy + rows * S]);
      for (let j = 0; j <= rows; j++) dl.push(["L", gx, gy + j * S, gx + cols * S, gy + j * S]);
      const rowLab = (j) => p.x.sidetype === "numbers" ? String(j + 1) : toAlpha(j);
      const colLab = (i) => p.x.sidetype === "numbers" ? toAlpha(i) : String(i + 1);
      for (let i = 0; i < cols; i++) {
        const cx = gx + i * S + S / 2;
        if (topT) dl.push(["T", cx, gy + rows * S + 4, fs, colLab(i), "c", "h"]);
        if (topB) dl.push(["T", cx, gy - fs - 3, fs, colLab(i), "c", "h"]);
      }
      for (let j = 0; j < rows; j++) {
        const cy = gy + rows * S - (j + 1) * S + S / 2 - fs / 3;
        if (sideL) dl.push(["T", gx - 5, cy, fs, rowLab(j), "r", "h"]);
        if (sideR) dl.push(["T", gx + cols * S + 5, cy, fs, rowLab(j), "l", "h"]);
      }
      return { dl: dl, pitch: S, count: dl.length };
    },
    picks: [
      { name: "Battleship Grid",
        set: { spacing: "0.35", spacing_units: "inch", sidetype: "letters",
               sidepos: "left", toppos: "top", weight: "0.5", gridColor: "0000b3" } },
      { name: "Map Grid · All Edges",
        set: { spacing: "0.5", spacing_units: "inch", sidetype: "letters",
               sidepos: "both", toppos: "both", weight: "0.5", gridColor: "b3b3b3" } }
    ]
  },

  {
    id: "archspiral",
    name: "Archimedean Spiral",
    blurb: "Evenly spaced coils.",
    spacing: null,
    weight: { label: "Line weight", def: 0.7 },
    extras: [
      { t: "pct", id: "turns", label: "Turns", def: 8, min: 1, max: 30, unit: "" },
      { t: "pct", id: "rotation", label: "Rotation", def: 0, min: 0, max: 359, unit: "°" },
      { t: "chk", id: "crosshair", label: "Center", text: "Crosshair at center", def: false }
    ],
    draw: function (p) {
      const dl = [], m = p.margin * 72;
      const W = p.width, H = p.height;
      const maxR = Math.min(W, H) / 2 - m;
      if (maxR <= 10) return { dl: dl, pitch: 10, count: 0 };
      const turns = correct(p.x.turns, 1, 30); // fractional turns welcome
      const rot = correct(p.x.rotation, 0, 359) * Math.PI / 180;
      const N = Math.max(8, Math.round(turns * 72));
      const b = maxR / (turns * 2 * Math.PI);
      const pts = [];
      for (let i = 0; i <= N; i++) {
        const th = (i / N) * turns * 2 * Math.PI;
        const r = b * th;
        pts.push(W / 2 + r * Math.cos(th + rot), H / 2 + r * Math.sin(th + rot));
      }
      dl.push(["P", pts, false]);
      if (p.x.crosshair) {
        dl.push(["S", p.gridColor, p.weight / 2]);
        dl.push(["L", W / 2 - 6, H / 2, W / 2 + 6, H / 2]);
        dl.push(["L", W / 2, H / 2 - 6, W / 2, H / 2 + 6]);
      }
      return { dl: dl, pitch: maxR / turns, count: dl.length };
    },
    picks: [{ name: "Mandala Base · 12 Turns",
      set: { turns: "12", rotation: "0", crosshair: "1", weight: "0.5", gridColor: "b3b3b3" } }]
  },

  {
    id: "logspiral",
    name: "Golden Spiral",
    blurb: "The nautilus curve.",
    spacing: null,
    weight: { label: "Line weight", def: 0.7 },
    extras: [
      { t: "pct", id: "growth", label: "Growth per quarter turn", def: 162, min: 105, max: 220, unit: "%" },
      { t: "pct", id: "rotation", label: "Rotation", def: 0, min: 0, max: 359, unit: "°" },
      { t: "chk", id: "crosshair", label: "Center", text: "Crosshair at center", def: false }
    ],
    draw: function (p) {
      const dl = [], m = p.margin * 72;
      const W = p.width, H = p.height;
      const maxR = Math.min(W, H) / 2 - m;
      if (maxR <= 10) return { dl: dl, pitch: 10, count: 0 };
      const turns = 30; // plenty; the 0.5pt radius floor ends it sooner
      const rot = correct(p.x.rotation, 0, 359) * Math.PI / 180;
      const g = correct(p.x.growth, 105, 220) / 100;
      const SEG = 72;
      const pts = [];
      for (let i = 0; i <= turns * SEG; i++) {
        const th = (i / SEG) * 2 * Math.PI;
        const r = maxR * Math.pow(g, -(th / (Math.PI / 2)));
        if (r < 0.5) break;
        pts.push(W / 2 + r * Math.cos(th + rot), H / 2 + r * Math.sin(th + rot));
      }
      if (pts.length >= 4) dl.push(["P", pts, false]);
      if (p.x.crosshair) {
        dl.push(["S", p.gridColor, p.weight / 2]);
        dl.push(["L", W / 2 - 6, H / 2, W / 2 + 6, H / 2]);
        dl.push(["L", W / 2, H / 2 - 6, W / 2, H / 2 + 6]);
      }
      return { dl: dl, pitch: maxR / turns, count: dl.length };
    },
    picks: [
      { name: "Golden Ratio (162%)",
        set: { growth: "162", rotation: "0", weight: "0.7", gridColor: "000000" } },
      { name: "Gentle Coil (120%)",
        set: { growth: "120", rotation: "0", weight: "0.5", gridColor: "b3b3b3" } }
    ]
  },

  {
    id: "copperplate",
    name: "Copperplate",
    blurb: "X-heights plus slant guides.",
    spacing: null,
    weight: { label: "Waist & base weight", def: 0.6 },
    extras: [
      { t: "sz2", id: "xheight", label: "X-height", def: 0.2 },
      { t: "sel", id: "ratio", label: "Proportions (asc:x:desc)", def: "3:2:3", options: [
        ["3:2:3", "3 : 2 : 3 (classic)"], ["2:1:2", "2 : 1 : 2"],
        ["1.5:1:1.5", "1.5 : 1 : 1.5"], ["1:1:1", "1 : 1 : 1"]] },
      { t: "wt", id: "lightweight", label: "Asc/desc weight", def: 0.3, min: 0.02, max: 20 },
      { t: "pct", id: "slantangle", label: "Slant angle", def: 55, min: 30, max: 150, unit: "°" },
      { t: "sz2", id: "slantspacing", label: "Slant spacing", def: 0.3 },
      { t: "wt", id: "slantweight", label: "Slant weight", def: 0.25, min: 0.02, max: 20 }
    ],
    draw: function (p) {
      const dl = [], m = p.margin * 72;
      const uW = p.width - 2 * m, uH = p.height - 2 * m;
      const xh = sizePts(p.x.xheight, p.x.xheight_units, 0.05, 3);
      const parts = String(p.x.ratio || "3:2:3").split(":").map(Number);
      const asc = (parts[0] || 3) * xh / (parts[1] || 2);
      const desc = (parts[2] || 3) * xh / (parts[1] || 2);
      const setH = asc + xh + desc;
      const n = Math.floor(uH / setH);
      if (n < 1 || uW <= 0) return { dl: dl, pitch: setH, count: 0 };
      const x0 = m, x1 = m + uW;
      const yTop = (p.height + n * setH) / 2;
      // Slant guides first, clipped to the ruled block.
      // Angles past 90° lean left, for left-handed calligraphers.
      const angDeg = correct(p.x.slantangle, 30, 150);
      const sSpace = sizePts(p.x.slantspacing, p.x.slantspacing_units, 0.05, 5);
      const blockB = yTop - n * setH, blockT = yTop;
      const vertical = Math.abs(angDeg - 90) < 0.5;
      const run = vertical ? 0
        : (blockT - blockB) / Math.tan(angDeg * Math.PI / 180);
      dl.push(["S", p.gridColor, correct(p.x.slantweight, 0.02, 20)]);
      const sxFrom = x0 - Math.max(run, 0), sxTo = x1 - Math.min(run, 0);
      for (let sx = sxFrom; sx <= sxTo; sx += sSpace) {
        if (vertical) {
          if (sx < x0 || sx > x1) continue;
          dl.push(["L", sx, blockB, sx, blockT]);
          continue;
        }
        // Parametric clip of (sx,blockB)->(sx+run,blockT) to [x0,x1]
        const tA = (x0 - sx) / run, tB = (x1 - sx) / run;
        const tLo = Math.max(0, Math.min(tA, tB));
        const tHi = Math.min(1, Math.max(tA, tB));
        if (tHi <= tLo) continue;
        dl.push(["L", sx + run * tLo, blockB + (blockT - blockB) * tLo,
                      sx + run * tHi, blockB + (blockT - blockB) * tHi]);
      }
      // Rulings: ascender (light), waist (heavy), base (heavy), desc = next asc
      const lightW = correct(p.x.lightweight, 0.02, 20);
      for (let i = 0; i < n; i++) {
        const top = yTop - i * setH;
        dl.push(["S", p.gridColor, lightW]);
        dl.push(["L", x0, top, x1, top]);
        dl.push(["S", p.gridColor, p.weight]);
        dl.push(["L", x0, top - asc, x1, top - asc]);
        dl.push(["L", x0, top - asc - xh, x1, top - asc - xh]);
      }
      dl.push(["S", p.gridColor, lightW]);
      dl.push(["L", x0, blockB, x1, blockB]);
      return { dl: dl, pitch: setH, count: dl.length };
    },
    picks: [
      { name: "Classic 55° · 3:2:3",
        set: { xheight: "0.2", xheight_units: "inch", ratio: "3:2:3", slantangle: "55",
               slantspacing: "0.3", slantspacing_units: "inch",
               weight: "0.6", lightweight: "0.3", slantweight: "0.25", gridColor: "b3b3b3" } },
      { name: "5mm Practice",
        set: { xheight: "0.5", xheight_units: "cm", ratio: "2:1:2", slantangle: "55",
               slantspacing: "0.8", slantspacing_units: "cm",
               weight: "0.6", lightweight: "0.3", slantweight: "0.25", gridColor: "b3b3ff" } }
    ]
  },

  {
    id: "hexdot",
    name: "Hex Dot",
    blurb: "Dots at hex corners.",
    note: "For thirty years this paper only came in fixed versions, because generating it crashed the server. You may now specify whatever you like. Progress!",
    spacing: { label: "hexes", def: 4 },
    weight: { label: "Dot size", def: 1 },
    extras: [],
    draw: function (p) {
      // Same layout as Hexagonal; dots at vertices, no lines.
      const dl = [];
      const h = p.offset, s = h / Math.sqrt(3);
      const uW = p.width - p.margin * 144, uH = p.height - p.margin * 144;
      const cols = Math.floor((uW / s - 0.5) / 1.5);
      const rows = Math.floor(uH / h - 0.5);
      if (cols < 1 || rows < 1) return { dl: dl, pitch: h, count: 0 };
      const totalW = s * (1.5 * cols + 0.5), totalH = h * (rows + 0.5);
      const left = (p.width - totalW) / 2, bottom = (p.height - totalH) / 2;
      const seen = {};
      const r = p.weight / 2;
      for (let i = 0; i < cols; i++) {
        const cx = left + s * (1 + 1.5 * i);
        const stag = (i % 2) ? h / 2 : 0;
        for (let j = 0; j < rows; j++) {
          const cy = bottom + h / 2 + j * h + stag;
          if (cy + h / 2 > bottom + totalH + 0.01) continue;
          const verts = [
            [cx - s, cy], [cx - s / 2, cy + h / 2], [cx + s / 2, cy + h / 2],
            [cx + s, cy], [cx + s / 2, cy - h / 2], [cx - s / 2, cy - h / 2]
          ];
          for (const v of verts) {
            const key = Math.round(v[0] * 10) + "," + Math.round(v[1] * 10);
            if (seen[key]) continue;
            seen[key] = 1;
            dl.push(["D", v[0], v[1], r]);
          }
        }
      }
      return { dl: dl, pitch: h, count: dl.length };
    },
    picks: [
      { name: "4 per inch · Grey",
        set: { spacing: "4", spacing_units: "inch", weight: "1", gridColor: "b3b3b3" } },
      { name: "5mm · Bullet Journal",
        set: { spacing: "2", spacing_units: "cm", weight: "0.8", gridColor: "c0c0c0" } }
    ]
  },

  // ============================================================
  // A4 Project & Assignment Borders
  // ============================================================
  {
    id: "proj_front",
    category: "Project & Assignment Borders",
    name: "Assignment Front Page (Title & Submission)",
    blurb: "Official project cover sheet with title banner and student submission block.",
    weight: { label: "Border thickness", def: 1.0 },
    extras: [
      { t: "txt", id: "banner_title", label: "Banner Title", placeholder: "e.g. PROJECT REPORT", def: "PROJECT / ASSIGNMENT REPORT" },
      { t: "txt", id: "topic_text", label: "Topic / Subject Line", placeholder: "e.g. TOPIC: Photosynthesis", def: "TOPIC: __________________________________________________" },
      { t: "chk", id: "show_banner", label: "Title & Topic Banner", text: "Show top report title & topic banner", def: true },
      { t: "chk", id: "show_submission", label: "Student Submission Box", text: "Show student details box (Name, Roll No, Class, Subject)", def: true },
      { t: "txt", id: "sub_name", label: "Student Name", placeholder: "Name fill-in line", def: "NAME: _________________________________________" },
      { t: "txt", id: "sub_roll", label: "Roll / Reg Number", placeholder: "Roll No line", def: "ROLL NO / REG NO: ____________________________" },
      { t: "txt", id: "sub_class", label: "Class & Section", placeholder: "Class line", def: "CLASS & SECTION: _____________________________" },
      { t: "txt", id: "sub_subject", label: "Subject", placeholder: "Subject line", def: "SUBJECT: ______________________________________" },
      { t: "txt", id: "sub_submitted_to", label: "Submitted To", placeholder: "Teacher / Faculty line", def: "SUBMITTED TO: ________________________________" },
      { t: "num", id: "inset", label: "Border Inset (pt)", def: 0, min: 0, max: 36 }
    ],
    draw: function (p) {
      const dl = PaperEngine.applyBorders(p, [], {
        style: "assignment_front",
        weight: p.weight,
        color: p.gridColor,
        inset: p.x.inset || 0
      });
      return { dl: dl, pitch: 100, count: dl.length };
    },
    picks: [
      { name: "College Front Page · Classic", set: { weight: "1", gridColor: "000000" } },
      { name: "Blue Ribbon Submission", set: { weight: "1.2", gridColor: "3a5fcd" } }
    ]
  },

  {
    id: "proj_eng",
    category: "Project & Assignment Borders",
    name: "Engineering Project Sheet (Title Block)",
    blurb: "Drafting sheet with reference grid coordinates and ISO standard title block.",
    spacing: { label: "grid mm", def: 5, mode: "size" },
    weight: { label: "Line thickness", def: 0.6 },
    extras: [
      { t: "txt", id: "project_title", label: "Drawing Title", placeholder: "e.g. FLANGE ASSEMBLY", def: "PROJECT / DRAWING TITLE:" },
      { t: "txt", id: "drawn_by", label: "Drawn By", placeholder: "Author name", def: "DRAWN BY: ________________" },
      { t: "txt", id: "date_eng", label: "Drawing Date", placeholder: "Date", def: "DATE: ____________" },
      { t: "txt", id: "checked_by", label: "Checked By", placeholder: "Approver name", def: "CHECKED BY: _____________" },
      { t: "txt", id: "scale_text", label: "Scale & Rev", placeholder: "Scale", def: "SCALE: 1:1  REV: 0" },
      { t: "chk", id: "showgrid", label: "Drafting Grid", text: "Show 5mm drafting graph grid", def: true },
      { t: "chk", id: "show_titleblock", label: "ISO Title Block", text: "Show drawing title & approval block", def: true },
      { t: "chk", id: "show_coords", label: "Margin Coordinates", text: "Show reference coordinates (A-D, 1-6)", def: true }
    ],
    draw: function (p) {
      let dl = [];
      const m = p.margin * 72;
      const x0 = m, y0 = m, x1 = p.width - m, y1 = p.height - m;
      if (p.x.showgrid && p.offset >= 4) {
        dl.push(["S", p.gridColor, p.weight * 0.4, null]);
        for (let x = x0; x <= x1; x += p.offset) {
          dl.push(["L", x, y0, x, y1]);
        }
        for (let y = y0; y <= y1; y += p.offset) {
          dl.push(["L", x0, y, x1, y]);
        }
      }
      dl = PaperEngine.applyBorders(p, dl, {
        style: "engineering_titleblock",
        weight: p.weight,
        color: p.gridColor,
        inset: 0
      });
      return { dl: dl, pitch: p.offset, count: dl.length };
    },
    picks: [
      { name: "5mm Engineering Pad", set: { spacing: "5", spacing_units: "mm", sMode: "size", showgrid: "1", weight: "0.6", gridColor: "008060" } },
      { name: "Blueprint Title Block", set: { spacing: "5", spacing_units: "mm", sMode: "size", showgrid: "1", weight: "0.7", gridColor: "0099ff", bgColor: "0f172a" } }
    ]
  },

  {
    id: "proj_academic_ruled",
    category: "Project & Assignment Borders",
    name: "Academic Assignment Sheet (Ruled + Frame)",
    blurb: "Standard 8mm ruled assignment writing paper framed in a university double-fillet border.",
    spacing: { label: "line height mm", def: 8, mode: "size" },
    weight: { label: "Line thickness", def: 0.5 },
    extras: [
      { t: "txt", id: "subject_text", label: "Subject Field", placeholder: "Subject", def: "SUBJECT: ______________________________" },
      { t: "txt", id: "date_text", label: "Date Field", placeholder: "Date", def: "DATE: ______________" },
      { t: "txt", id: "signature_text", label: "Signature Field", placeholder: "Signature", def: "SIGNATURE: ____________________________" },
      { t: "txt", id: "page_text", label: "Page Number Field", placeholder: "Page No", def: "PAGE NO: _________" },
      { t: "chk", id: "show_header", label: "Header Line", text: "Show Subject & Date line", def: true },
      { t: "chk", id: "show_footer", label: "Footer Line", text: "Show Signature & Page No line", def: true },
      { t: "wt", id: "borderweight", label: "Border weight", def: 1.0 }
    ],
    draw: function (p) {
      let dl = [];
      const m = p.margin * 72;
      const x0 = m + 6, x1 = p.width - m - 6;
      const yBottom = m + 32;
      const yTop = p.height - m - 36;
      const step = Math.max(12, p.offset);

      dl.push(["S", p.gridColor, p.weight * 0.6, null]);
      for (let y = yBottom; y <= yTop; y += step) {
        dl.push(["L", x0, y, x1, y]);
      }

      dl = PaperEngine.applyBorders(p, dl, {
        style: "academic_double",
        weight: p.x.borderweight || 1.0,
        color: p.gridColor,
        inset: 0
      });
      return { dl: dl, pitch: step, count: dl.length };
    },
    picks: [
      { name: "Standard 8mm University Lines", set: { spacing: "8", spacing_units: "mm", sMode: "size", weight: "0.45", gridColor: "444466" } },
      { name: "Fine 6mm College Ruled", set: { spacing: "6", spacing_units: "mm", sMode: "size", weight: "0.4", gridColor: "3a5fcd" } }
    ]
  },

  {
    id: "proj_academic_blank",
    category: "Project & Assignment Borders",
    name: "Academic Project Sheet (Blank + Frame)",
    blurb: "Formal double-line project border with corner rosettes on clean blank sheet.",
    weight: { label: "Border thickness", def: 1.0 },
    extras: [
      { t: "txt", id: "subject_text", label: "Subject Field", placeholder: "Subject", def: "SUBJECT: ______________________________" },
      { t: "txt", id: "date_text", label: "Date Field", placeholder: "Date", def: "DATE: ______________" },
      { t: "txt", id: "signature_text", label: "Signature Field", placeholder: "Signature", def: "SIGNATURE: ____________________________" },
      { t: "txt", id: "page_text", label: "Page Number Field", placeholder: "Page No", def: "PAGE NO: _________" },
      { t: "chk", id: "show_header", label: "Header Line", text: "Show Subject & Date line", def: true },
      { t: "chk", id: "show_footer", label: "Footer Line", text: "Show Signature & Page No line", def: true }
    ],
    draw: function (p) {
      const dl = PaperEngine.applyBorders(p, [], {
        style: "academic_double",
        weight: p.weight,
        color: p.gridColor,
        inset: 0
      });
      return { dl: dl, pitch: 100, count: dl.length };
    },
    picks: [
      { name: "Clean Formal A4 Frame", set: { weight: "1", gridColor: "000000" } }
    ]
  },

  {
    id: "proj_floral",
    category: "Project & Assignment Borders",
    name: "Decorative Project Sheet (Floral Frame)",
    blurb: "Corner floral flourishes and clean page framing for biology, arts, and creative reports.",
    weight: { label: "Border thickness", def: 1.0 },
    extras: [],
    draw: function (p) {
      const dl = PaperEngine.applyBorders(p, [], {
        style: "floral",
        weight: p.weight,
        color: p.gridColor,
        inset: 0
      });
      return { dl: dl, pitch: 100, count: dl.length };
    },
    picks: [
      { name: "Botanical Green", set: { weight: "1", gridColor: "008060" } },
      { name: "Crimson Certificate", set: { weight: "1.2", gridColor: "b30000" } }
    ]
  },

  {
    id: "proj_tech",
    category: "Project & Assignment Borders",
    name: "Tech Assignment / Lab Report Sheet",
    blurb: "Lab report sheet with header metadata bar (Topic, Date, Page) and evaluator remarks.",
    spacing: { label: "grid mm", def: 5, mode: "size" },
    weight: { label: "Line thickness", def: 0.5 },
    extras: [
      { t: "txt", id: "topic_text", label: "Lab Topic Header", placeholder: "Topic", def: "ASSIGNMENT / LAB TOPIC: ______________________________" },
      { t: "txt", id: "remarks_text", label: "Remarks Strip", placeholder: "Remarks", def: "EVALUATOR'S REMARKS: ________________________________________" },
      { t: "chk", id: "showgrid", label: "Lab Grid", text: "Show 5mm lab data grid", def: true },
      { t: "chk", id: "show_header", label: "Topic Header", text: "Show Topic & Date bar", def: true },
      { t: "chk", id: "show_remarks", label: "Remarks Strip", text: "Show Evaluator Remarks & Signature line", def: true }
    ],
    draw: function (p) {
      let dl = [];
      const m = p.margin * 72;
      const x0 = m, y0 = m + 26, x1 = p.width - m, y1 = p.height - m - 30;
      if (p.x.showgrid && p.offset >= 4) {
        dl.push(["S", p.gridColor, p.weight * 0.35, null]);
        for (let x = x0; x <= x1; x += p.offset) {
          dl.push(["L", x, y0, x, y1]);
        }
        for (let y = y0; y <= y1; y += p.offset) {
          dl.push(["L", x0, y, x1, y]);
        }
      }
      dl = PaperEngine.applyBorders(p, dl, {
        style: "minimal_assignment",
        weight: p.weight,
        color: p.gridColor,
        inset: 0
      });
      return { dl: dl, pitch: p.offset, count: dl.length };
    },
    picks: [
      { name: "5mm Lab Data Grid", set: { spacing: "5", spacing_units: "mm", sMode: "size", showgrid: "1", weight: "0.5", gridColor: "3a5fcd" } },
      { name: "Blank Report with Header", set: { showgrid: "0", weight: "0.8", gridColor: "000000" } }
    ]
  },

  {
    id: "proj_diploma",
    category: "Project & Assignment Borders",
    name: "Certificate & Award Project Border",
    blurb: "Formal certificate frame with quadruple fillet lines, baroque corners, and rosette seal.",
    weight: { label: "Border thickness", def: 1.0 },
    extras: [
      { t: "txt", id: "seal_text", label: "Medal Inscription", placeholder: "e.g. ★ MERIT ★", def: "★ MERIT ★" },
      { t: "chk", id: "show_seal", label: "Rosette Seal", text: "Show embossed medal seal with ribbons", def: true },
      { t: "num", id: "inset", label: "Border Inset (pt)", def: 0, min: 0, max: 36 }
    ],
    draw: function (p) {
      const dl = PaperEngine.applyBorders(p, [], {
        style: "diploma_seal",
        weight: p.weight,
        color: p.gridColor,
        inset: p.x.inset || 0
      });
      return { dl: dl, pitch: 100, count: dl.length };
    },
    picks: [
      { name: "Gold Seal Honors", set: { weight: "1.1", gridColor: "c59b27" } },
      { name: "Navy Diploma Formal", set: { weight: "1.0", gridColor: "1a365d" } },
      { name: "Crimson Certificate", set: { weight: "1.2", gridColor: "8b0000" } }
    ]
  },

  {
    id: "proj_greek_key",
    category: "Project & Assignment Borders",
    name: "Classical Greek Key (Meander) Border",
    blurb: "Timeless Greek meander fretwork border with corner rosettes for architecture and classical essays.",
    weight: { label: "Border thickness", def: 1.0 },
    extras: [
      { t: "num", id: "inset", label: "Border Inset (pt)", def: 0, min: 0, max: 36 }
    ],
    draw: function (p) {
      const dl = PaperEngine.applyBorders(p, [], {
        style: "greek_key",
        weight: p.weight,
        color: p.gridColor,
        inset: p.x.inset || 0
      });
      return { dl: dl, pitch: 100, count: dl.length };
    },
    picks: [
      { name: "Athenian Classic Black", set: { weight: "1.0", gridColor: "000000" } },
      { name: "Aegean Sea Blue", set: { weight: "1.1", gridColor: "006699" } }
    ]
  },

  {
    id: "proj_vintage_scroll",
    category: "Project & Assignment Borders",
    name: "Victorian Botanical Scroll Frame",
    blurb: "Ornate curled acanthus corner flourishes and pearl beadwork for literature, biology, and arts.",
    weight: { label: "Border thickness", def: 1.0 },
    extras: [
      { t: "num", id: "inset", label: "Border Inset (pt)", def: 0, min: 0, max: 36 }
    ],
    draw: function (p) {
      const dl = PaperEngine.applyBorders(p, [], {
        style: "vintage_scroll",
        weight: p.weight,
        color: p.gridColor,
        inset: p.x.inset || 0
      });
      return { dl: dl, pitch: 100, count: dl.length };
    },
    picks: [
      { name: "Vintage Sepia Parchment", set: { weight: "1.0", gridColor: "5c4033", bgColor: "fff9ee" } },
      { name: "Botanical Forest Green", set: { weight: "1.0", gridColor: "1e4d2b" } }
    ]
  },

  {
    id: "proj_celtic_knot",
    category: "Project & Assignment Borders",
    name: "Celtic Knotwork Interlace Frame",
    blurb: "Continuous 4-loop Celtic interlace knots and woven diagonal ribbon borders.",
    weight: { label: "Border thickness", def: 1.0 },
    extras: [
      { t: "num", id: "inset", label: "Border Inset (pt)", def: 0, min: 0, max: 36 }
    ],
    draw: function (p) {
      const dl = PaperEngine.applyBorders(p, [], {
        style: "celtic_knot",
        weight: p.weight,
        color: p.gridColor,
        inset: p.x.inset || 0
      });
      return { dl: dl, pitch: 100, count: dl.length };
    },
    picks: [
      { name: "Emerald Knot", set: { weight: "1.1", gridColor: "007a3d" } },
      { name: "Highland Black", set: { weight: "1.0", gridColor: "111111" } }
    ]
  },

  {
    id: "proj_artdeco_luxury",
    category: "Project & Assignment Borders",
    name: "Art Deco Grand Stepped Chevron Frame",
    blurb: "3-tier stepped geometric corners with sunburst chevrons and corner diamond jewels.",
    weight: { label: "Border thickness", def: 1.0 },
    extras: [
      { t: "num", id: "inset", label: "Border Inset (pt)", def: 0, min: 0, max: 36 }
    ],
    draw: function (p) {
      const dl = PaperEngine.applyBorders(p, [], {
        style: "artdeco_luxury",
        weight: p.weight,
        color: p.gridColor,
        inset: p.x.inset || 0
      });
      return { dl: dl, pitch: 100, count: dl.length };
    },
    picks: [
      { name: "Great Gatsby Gold", set: { weight: "1.2", gridColor: "c59b27" } },
      { name: "Midnight Deco", set: { weight: "1.0", gridColor: "0f172a" } }
    ]
  },

  {
    id: "proj_islamic_geom",
    category: "Project & Assignment Borders",
    name: "Arabesque 8-Point Star Geometric Frame",
    blurb: "Khatam 8-point star medallions with geometric interlaced strapwork.",
    weight: { label: "Border thickness", def: 1.0 },
    extras: [
      { t: "num", id: "inset", label: "Border Inset (pt)", def: 0, min: 0, max: 36 }
    ],
    draw: function (p) {
      const dl = PaperEngine.applyBorders(p, [], {
        style: "islamic_geom",
        weight: p.weight,
        color: p.gridColor,
        inset: p.x.inset || 0
      });
      return { dl: dl, pitch: 100, count: dl.length };
    },
    picks: [
      { name: "Persian Lapis Blue", set: { weight: "1.1", gridColor: "1c39bb" } },
      { name: "Onyx Geometry", set: { weight: "1.0", gridColor: "1a1a1a" } }
    ]
  },

  {
    id: "proj_architectural",
    category: "Project & Assignment Borders",
    name: "Architectural Presentation Sheet",
    blurb: "Modern drafting sheet with precision crosshairs, top header ribbon, and revision column.",
    spacing: { label: "grid mm", def: 5, mode: "size" },
    weight: { label: "Line thickness", def: 0.5 },
    extras: [
      { t: "txt", id: "ribbon_title", label: "Presentation Title", placeholder: "Project Name", def: "PROJECT PRESENTATION / ARCHITECTURAL SHEET" },
      { t: "txt", id: "sheet_no", label: "Sheet Number", placeholder: "e.g. A-101", def: "SHEET NO: A-101" },
      { t: "chk", id: "showgrid", label: "Drafting Grid", text: "Show background 5mm drafting grid", def: false },
      { t: "chk", id: "show_header", label: "Header Ribbon", text: "Show top presentation title ribbon", def: true },
      { t: "chk", id: "show_rev_col", label: "Revision Column", text: "Show right revision index column", def: true }
    ],
    draw: function (p) {
      let dl = [];
      const m = p.margin * 72;
      const x0 = m, y0 = m, x1 = p.width - m, y1 = p.height - m - 24;
      if (p.x.showgrid && p.offset >= 4) {
        dl.push(["S", p.gridColor, p.weight * 0.35, null]);
        for (let x = x0; x <= x1; x += p.offset) {
          dl.push(["L", x, y0, x, y1]);
        }
        for (let y = y0; y <= y1; y += p.offset) {
          dl.push(["L", x0, y, x1, y]);
        }
      }
      dl = PaperEngine.applyBorders(p, dl, {
        style: "modern_ribbon",
        weight: p.weight,
        color: p.gridColor,
        inset: 0
      });
      return { dl: dl, pitch: p.offset, count: dl.length };
    },
    picks: [
      { name: "Clean Portfolio White", set: { showgrid: "0", weight: "0.8", gridColor: "000000" } },
      { name: "Blueprint Drafting Pad", set: { showgrid: "1", spacing: "5", spacing_units: "mm", sMode: "size", weight: "0.5", gridColor: "0088cc" } }
    ]
  }


];

function getGenerator(id) {
  for (const g of GENERATORS) if (g.id === id) return g;
  return null;
}

// =====================================================================
// EXTRA QUICK PICKS - mined from two decades of pregenerated PDFs in
// /graphpaper/custom/, plus recipes showing off the new generators.
// Merged after each generator's built-in picks.
// =====================================================================
const EXTRA_PICKS = {
plain: [
 { name: "1cm Super Fine", set: { spacing: "1", spacing_units: "cm", weight: "0.25", gridColor: "b3b3b3" } },
 { name: "10 to 1 All Blue", set: { spacing: "10", spacing_units: "inch", weight: "0.3", gridColor: "b3b3ff" } },
 { name: "Cream Comfort", set: { spacing: "4", spacing_units: "inch", weight: "0.4", gridColor: "b3b3b3", bgColor: "FFF4DE" } }
],
squaredots: [
 { name: "2 per cm · Black", set: { spacing: "2", spacing_units: "cm", weight: "0.6", gridColor: "000000" } },
 { name: "Fine Mist · 8/inch", set: { spacing: "8", spacing_units: "inch", weight: "0.4", gridColor: "b3b3b3" } },
 { name: "Fade Dots", set: { spacing: "4", spacing_units: "inch", weight: "0.8", gridColor: "ece0c4" } }
],
hexagonal: [
 { name: "10mm Black Net", set: { spacing: "1", spacing_units: "cm", weight: "0.5", gridColor: "000000" } },
 { name: "Tiny Hexes · 12/inch", set: { spacing: "12", spacing_units: "inch", weight: "0.25", gridColor: "b3b3b3" } },
 { name: "Game Map · Green", set: { spacing: "2", spacing_units: "inch", weight: "0.7", gridColor: "00b300" } }
],
triangle: [
 { name: "1cm · Blue", set: { spacing: "1", spacing_units: "cm", weight: "0.5", gridColor: "b3b3ff" } },
 { name: "Fine 1/8 inch", set: { spacing: "0.125", spacing_units: "inch", weight: "0.3", gridColor: "b3b3b3" } },
 { name: "Big Inch · Black", set: { spacing: "1", spacing_units: "inch", weight: "0.7", gridColor: "000000" } }
],
diamond: [
 { name: "1cm Diamonds", set: { spacing: "1", spacing_units: "cm", weight: "0.5", gridColor: "b3b3b3" } },
 { name: "Half Inch · Blue", set: { spacing: "0.5", spacing_units: "inch", weight: "0.5", gridColor: "0000b3" } },
 { name: "Fine Weave", set: { spacing: "0.125", spacing_units: "inch", weight: "0.25", gridColor: "b3b3b3" } },
 { name: "Cream Lattice", set: { spacing: "0.33", spacing_units: "inch", weight: "0.5", gridColor: "b3b3b3", bgColor: "FFF4DE" } }
],
isometricdots: [
 { name: "5mm · Black", set: { spacing: "0.5", spacing_units: "cm", weight: "1", gridColor: "000000" } },
 { name: "Half Inch · Grey", set: { spacing: "0.5", spacing_units: "inch", weight: "1.2", gridColor: "b3b3b3" } },
 { name: "Fine Iso · Blue", set: { spacing: "0.2", spacing_units: "inch", weight: "0.7", gridColor: "b3b3ff" } }
],
octagon: [
 { name: "1 Inch Octagon", set: { spacing: "1", spacing_units: "inch", weight: "0.6", gridColor: "000000" } },
 { name: "1cm · Grey", set: { spacing: "1", spacing_units: "cm", weight: "0.4", gridColor: "b3b3b3" } },
 { name: "Quarter · Blue", set: { spacing: "0.25", spacing_units: "inch", weight: "0.35", gridColor: "b3b3ff" } },
 { name: "Tile Floor", set: { spacing: "0.75", spacing_units: "inch", weight: "0.8", gridColor: "b3b3b3", bgColor: "FFF4DE" } }
],
brick: [
 { name: "1-2 Brick", set: { spacing: "2", spacing_units: "inch", vspacing: "1", vspacing_units: "inch", weight: "0.7", gridColor: "b3b3b3" } },
 { name: "Tiny Bond · 4×2", set: { spacing: "4", spacing_units: "inch", vspacing: "2", vspacing_units: "inch", weight: "0.4", gridColor: "b3b3b3" } },
 { name: "Red Wall", set: { spacing: "2", spacing_units: "inch", vspacing: "1", vspacing_units: "inch", weight: "1", gridColor: "b30000" } },
 { name: "Subway Tile (cm)", set: { spacing: "1", spacing_units: "cm", vspacing: "0.5", vspacing_units: "cm", weight: "0.5", gridColor: "b3b3b3" } }
],
engineer: [
 { name: "10 per inch · Fine", set: { spacing: "10", spacing_units: "inch", vspacing: "10", vspacing_units: "inch", weight: "0.3", hweight: "0.3", gridColor: "00b300" } },
 { name: "Skip Start 2×2", set: { spacing: "5", spacing_units: "inch", vspacing: "5", vspacing_units: "inch", hsuper: "2", vsuper: "2", weight: "0.5", hweight: "0.5", gridColor: "b3b3b3" } },
 { name: "Blue Drafting", set: { spacing: "4", spacing_units: "inch", vspacing: "4", vspacing_units: "inch", weight: "0.6", hweight: "0.3", gridColor: "0000b3" } },
 { name: "Metric 2/cm", set: { spacing: "2", spacing_units: "cm", vspacing: "2", vspacing_units: "cm", weight: "0.5", hweight: "0.5", gridColor: "b3b3b3" } }
],
lined: [
 { name: "Narrow · 4/inch", set: { spacing: "4", spacing_units: "inch", weight: "0.5", gridColor: "b3b3b3" } },
 { name: "Dense Notes · 6/inch", set: { spacing: "6", spacing_units: "inch", weight: "0.35", gridColor: "b3b3ff" } },
 { name: "Fade Lines", set: { spacing: "3.56", spacing_units: "inch", weight: "0.6", gridColor: "ece0c4" } }
],
writing: [
 { name: "Kindergarten · 1 inch", set: { spacing: "1", spacing_units: "inch", weight: "0.8", gridColor: "b3b3ff" } },
 { name: "2cm Practice", set: { spacing: "2", spacing_units: "cm", weight: "0.7", gridColor: "b3b3b3" } },
 { name: "Green Board Style", set: { spacing: "0.5", spacing_units: "inch", weight: "0.8", gridColor: "00b300" } }
],
boldsquaredots: [
 { name: "5mm Alternating", set: { spacing: "2", spacing_units: "cm", weight: "0.8", gridColor: "b3b3b3" } },
 { name: "Big & Small · Blue", set: { spacing: "2", spacing_units: "inch", weight: "1.5", gridColor: "b3b3ff" } },
 { name: "Fine Rhythm", set: { spacing: "8", spacing_units: "inch", weight: "0.6", gridColor: "000000" } },
 { name: "Cream Beat", set: { spacing: "4", spacing_units: "inch", weight: "1", gridColor: "b3b3b3", bgColor: "FFF4DE" } }
],
linedots: [
 { name: "Writer's Ruler", set: { spacing: "3.56", spacing_units: "inch", weight: "1", lineweight: "0.25", gridColor: "b3b3b3" } },
 { name: "Blue Lines Black Dots", set: { spacing: "4", spacing_units: "inch", weight: "1", lineweight: "0.3", gridColor: "0000b3" } },
 { name: "Dense Grid Dots", set: { spacing: "8", spacing_units: "inch", weight: "0.6", lineweight: "0.15", gridColor: "b3b3b3" } },
 { name: "1cm Journal", set: { spacing: "1", spacing_units: "cm", weight: "0.8", lineweight: "0.2", gridColor: "c0c0c0" } }
],
offsetsquaredots: [
 { name: "5mm Checker", set: { spacing: "2", spacing_units: "cm", weight: "0.8", gridColor: "b3b3b3" } },
 { name: "Sparse · 2/inch", set: { spacing: "2", spacing_units: "inch", weight: "1.2", gridColor: "b3b3ff" } },
 { name: "Dense · 8/inch", set: { spacing: "8", spacing_units: "inch", weight: "0.5", gridColor: "000000" } },
 { name: "Fade Field", set: { spacing: "4", spacing_units: "inch", weight: "0.9", gridColor: "ece0c4" } }
],
gridlined: [
 { name: "Note Grid · Grey", set: { spacing: "8", spacing_units: "inch", boxesperline: "4", weight: "0.8", minorweight: "0.2", gridColor: "b3b3b3" } },
 { name: "Tall Rows · 6 per line", set: { spacing: "12", spacing_units: "inch", boxesperline: "6", weight: "1", minorweight: "0.2", gridColor: "b3b3ff" } },
 { name: "Metric Journal", set: { spacing: "4", spacing_units: "cm", boxesperline: "3", weight: "0.8", minorweight: "0.25", gridColor: "b3b3b3" } },
 { name: "Green Steno", set: { spacing: "8", spacing_units: "inch", boxesperline: "4", weight: "0.9", minorweight: "0.2", gridColor: "00b300" } }
],
doublelined: [
 { name: "Solid Guides", set: { spacing: "0.33", spacing_units: "inch", weight: "0.7", dashed: "0", gridColor: "b3b3b3" } },
 { name: "Big Primary · Dashed", set: { spacing: "0.5", spacing_units: "inch", weight: "0.8", dashed: "1", gridColor: "b3b3ff" } },
 { name: "1cm Practice", set: { spacing: "1", spacing_units: "cm", weight: "0.6", dashed: "1", gridColor: "b3b3b3" } },
 { name: "Fine Hand", set: { spacing: "0.25", spacing_units: "inch", weight: "0.5", dashed: "1", gridColor: "c0c0c0" } }
],
tumblingblock: [
 { name: "Quilter's Half Inch", set: { spacing: "0.5", spacing_units: "inch", weight: "0.5", gridColor: "b3b3b3" } },
 { name: "1cm Cubes", set: { spacing: "1", spacing_units: "cm", weight: "0.5", gridColor: "000000" } },
 { name: "Big Blocks · Blue", set: { spacing: "0.75", spacing_units: "inch", weight: "0.7", gridColor: "0000b3" } },
 { name: "Fine Illusion", set: { spacing: "0.2", spacing_units: "inch", weight: "0.3", gridColor: "b3b3b3" } }
],
moorish: [
 { name: "Wide Body · 4x", set: { spacing: "0.25", spacing_units: "inch", ratio: "4", weight: "0.5", gridColor: "b3b3b3" } },
 { name: "Tight Bands · 2x", set: { spacing: "0.2", spacing_units: "inch", ratio: "2", weight: "0.5", gridColor: "000000" } },
 { name: "1cm · Green", set: { spacing: "0.5", spacing_units: "cm", ratio: "3", weight: "0.5", gridColor: "00b300" } },
 { name: "Grand Scale", set: { spacing: "0.5", spacing_units: "inch", ratio: "5", weight: "0.8", gridColor: "0000b3" } }
],
detached: [
 { name: "Quarter + Eighth Gap", set: { spacing: "0.25", spacing_units: "inch", spaceSize: "0.125", spaceSize_units: "inch", weight: "0.7", gridColor: "b3b3b3" } },
 { name: "1cm + 5mm Gap", set: { spacing: "1", spacing_units: "cm", spaceSize: "0.5", spaceSize_units: "cm", weight: "0.7", gridColor: "000000" } },
 { name: "Big Tiles", set: { spacing: "0.75", spacing_units: "inch", spaceSize: "0.25", spaceSize_units: "inch", weight: "1", gridColor: "b3b3ff" } },
 { name: "Pixel Farm", set: { spacing: "0.2", spacing_units: "inch", spaceSize: "0.1", spaceSize_units: "inch", weight: "0.4", gridColor: "b3b3b3" } }
],
inverted: [
 { name: "Black Field · 4/inch", set: { spacing: "4", spacing_units: "inch", weight: "0.7", gridColor: "000000" } },
 { name: "Green Chalkboard", set: { spacing: "4", spacing_units: "inch", weight: "0.7", gridColor: "004400" } },
 { name: "Bold Axes Field", set: { spacing: "4", spacing_units: "inch", weight: "0.7", bold: "1", gridColor: "0000b3" } },
 { name: "Dense Night", set: { spacing: "8", spacing_units: "inch", weight: "0.4", gridColor: "17171a" } }
],
vartriangle: [
 { name: "30° Shallow", set: { spacing: "0.25", spacing_units: "inch", angle: "30", weight: "0.5", gridColor: "b3b3b3" } },
 { name: "75° Steep", set: { spacing: "0.25", spacing_units: "inch", angle: "75", weight: "0.5", gridColor: "b3b3b3" } },
 { name: "60° Classic 1cm", set: { spacing: "1", spacing_units: "cm", angle: "60", weight: "0.5", gridColor: "0000b3" } },
 { name: "15° Extreme", set: { spacing: "0.5", spacing_units: "inch", angle: "15", weight: "0.4", gridColor: "b3b3b3" } }
],
"68degree": [
 { name: "1cm · Grey", set: { spacing: "1", spacing_units: "cm", weight: "0.5", gridColor: "b3b3b3" } },
 { name: "Fine Draft", set: { spacing: "0.125", spacing_units: "inch", weight: "0.3", gridColor: "b3b3b3" } },
 { name: "Half Inch · Blue", set: { spacing: "0.5", spacing_units: "inch", weight: "0.5", gridColor: "b3b3ff" } },
 { name: "Big & Bold", set: { spacing: "1", spacing_units: "inch", weight: "0.8", gridColor: "000000" } }
],
circle: [
 { name: "Penny Rug · 1 inch", set: { spacing: "1", spacing_units: "inch", radius: "1", weight: "0.5", gridColor: "b3b3b3" } },
 { name: "Overlap · 1.5x", set: { spacing: "0.5", spacing_units: "inch", radius: "1.5", weight: "0.35", gridColor: "b3b3ff" } },
 { name: "Sparse Spots · 0.5x", set: { spacing: "0.5", spacing_units: "inch", radius: "0.5", weight: "0.5", gridColor: "000000" } },
 { name: "2cm Scales", set: { spacing: "2", spacing_units: "cm", radius: "1.2", weight: "0.4", gridColor: "00b300" } }
],
circlegrid: [
 { name: "Sparse Rows", set: { spacing: "0.75", spacing_units: "inch", radius: "0.7", weight: "0.5", gridColor: "b3b3b3" } },
 { name: "Heavy Overlap 1.8x", set: { spacing: "0.5", spacing_units: "inch", radius: "1.8", weight: "0.3", gridColor: "b3b3ff" } },
 { name: "1cm Coins", set: { spacing: "1", spacing_units: "cm", radius: "1", weight: "0.5", gridColor: "000000" } },
 { name: "Bubble Wrap", set: { spacing: "0.4", spacing_units: "inch", radius: "0.95", weight: "0.4", gridColor: "b3b3b3" } }
],
spider: [
 { name: "13 Spoke Spider", set: { spokes: "13", polys: "17", weight: "0.5", gridColor: "000000" } },
 { name: "Radar · 8 × 4", set: { spokes: "8", polys: "4", weight: "0.8", gridColor: "0000b3" } },
 { name: "Dense Web 20 × 30", set: { spokes: "20", polys: "30", weight: "0.3", gridColor: "b3b3b3" } }
],
cornellgraph: [
 { name: "Right-Hand Cue", set: { spacing: "4", spacing_units: "inch", cueright: "1", weight: "0.4", gridColor: "b3b3b3" } },
 { name: "Summary Top", set: { spacing: "4", spacing_units: "inch", sumtop: "1", weight: "0.4", gridColor: "b3b3b3" } },
 { name: "Metric 2/cm", set: { spacing: "2", spacing_units: "cm", weight: "0.4", gridColor: "b3b3ff" } },
 { name: "Wide Notes 85%", set: { spacing: "4", spacing_units: "inch", hsize: "85", vsize: "85", weight: "0.4", gridColor: "b3b3b3" } }
],
cornelllined: [
 { name: "College Cornell", set: { spacing: "3.56", spacing_units: "inch", weight: "0.4", gridColor: "b3b3b3" } },
 { name: "Right-Hand Cue", set: { spacing: "3", spacing_units: "inch", cueright: "1", weight: "0.4", gridColor: "b3b3b3" } },
 { name: "Wide Rule Blue", set: { spacing: "2.91", spacing_units: "inch", weight: "0.4", gridColor: "b3b3ff" } },
 { name: "Big Margin Cue", set: { spacing: "3", spacing_units: "inch", hsize: "65", weight: "0.4", gridColor: "b3b3b3" } }
],
cornelldots: [
 { name: "5mm Dot Cornell", set: { spacing: "2", spacing_units: "cm", weight: "0.8", gridColor: "b3b3b3" } },
 { name: "Right-Hand Cue", set: { spacing: "4", spacing_units: "inch", cueright: "1", weight: "1", gridColor: "b3b3b3" } },
 { name: "Fine Dots 6/inch", set: { spacing: "6", spacing_units: "inch", weight: "0.7", gridColor: "c0c0c0" } },
 { name: "Summary Top", set: { spacing: "4", spacing_units: "inch", sumtop: "1", weight: "1", gridColor: "b3b3b3" } }
],
chinesequarter: [
 { name: "1 Inch Cells", set: { spacing: "1", spacing_units: "inch", weight: "1", gridColor: "b3b3b3" } },
 { name: "2cm · Green", set: { spacing: "2", spacing_units: "cm", weight: "1", gridColor: "00b300" } },
 { name: "Small Practice", set: { spacing: "0.5", spacing_units: "inch", weight: "0.8", gridColor: "b3b3b3" } },
 { name: "Cream Sheets", set: { spacing: "0.75", spacing_units: "inch", weight: "1", gridColor: "b3b3b3", bgColor: "FFF4DE" } }
],
chineseX: [
 { name: "1 Inch Cells", set: { spacing: "1", spacing_units: "inch", weight: "1", gridColor: "b3b3b3" } },
 { name: "Mi Zi Ge 2cm", set: { spacing: "2", spacing_units: "cm", weight: "1", gridColor: "b30000" } },
 { name: "Small Practice", set: { spacing: "0.5", spacing_units: "inch", weight: "0.8", gridColor: "b3b3b3" } },
 { name: "Fade Guides", set: { spacing: "0.75", spacing_units: "inch", weight: "1", gridColor: "ece0c4" } }
],
chinesesquare: [
 { name: "1 Inch Cells", set: { spacing: "1", spacing_units: "inch", weight: "1", gridColor: "b3b3b3" } },
 { name: "Jiu Gong Ge 2cm", set: { spacing: "2", spacing_units: "cm", weight: "1", gridColor: "b30000" } },
 { name: "Small Practice", set: { spacing: "0.5", spacing_units: "inch", weight: "0.8", gridColor: "b3b3b3" } },
 { name: "Cream Classic", set: { spacing: "0.75", spacing_units: "inch", weight: "1", gridColor: "b3b3b3", bgColor: "FFF4DE" } }
],
chinesehex: [
 { name: "Large Side · 0.75", set: { spacing: "0.75", spacing_units: "inch", weight: "1", gridColor: "b3b3b3" } },
 { name: "1.5cm · Green", set: { spacing: "1.5", spacing_units: "cm", weight: "1", gridColor: "00b300" } },
 { name: "Small Chain", set: { spacing: "0.33", spacing_units: "inch", weight: "0.8", gridColor: "b3b3b3" } },
 { name: "Bold Black", set: { spacing: "0.5", spacing_units: "inch", weight: "1.4", gridColor: "000000" } }
],
calligraphy: [
 { name: "2mm Fine Nib", set: { unit: "2", gap: "8", weight: "0.5", gridColor: "b3b3b3" } },
 { name: "5mm Poster Nib", set: { unit: "5", gap: "15", weight: "0.6", gridColor: "b3b3ff" } },
 { name: "Tight Practice", set: { unit: "1.5", gap: "4", weight: "0.4", gridColor: "c0c0c0" } }
],
notelined: [
 { name: "Extra Wide", set: { rule: "Extra-wide", weight: "0.4", gridColor: "b3b3b3" } },
 { name: "Very Narrow", set: { rule: "Very-narrow", weight: "0.35", gridColor: "b3b3ff" } },
 { name: "Narrow Green", set: { rule: "Narrow", weight: "0.4", gridColor: "00b300" } }
],
axonometric: [
 { name: "1cm · Both Guides", set: { spacing: "1", spacing_units: "cm", verticals: "1", horizontals: "1", weight: "0.5", gridColor: "b3b3b3" } },
 { name: "Clean Diamonds Only", set: { spacing: "0.5", spacing_units: "inch", verticals: "0", horizontals: "0", weight: "0.5", gridColor: "000000" } },
 { name: "Fine Draft", set: { spacing: "0.25", spacing_units: "inch", verticals: "1", weight: "0.35", gridColor: "b3b3b3" } },
 { name: "Big Blue", set: { spacing: "1", spacing_units: "inch", verticals: "1", weight: "0.7", gridColor: "b3b3ff" } }
],
intersecteddiamonds: [
 { name: "1cm Full Cross", set: { spacing: "1", spacing_units: "cm", verticals: "1", horizontals: "1", weight: "0.5", gridColor: "b3b3b3" } },
 { name: "Horizontals Only", set: { spacing: "0.5", spacing_units: "inch", verticals: "0", horizontals: "1", weight: "0.5", gridColor: "b3b3b3" } },
 { name: "Fine Mesh", set: { spacing: "0.25", spacing_units: "inch", verticals: "1", horizontals: "1", weight: "0.3", gridColor: "b3b3b3" } },
 { name: "Bold Inch", set: { spacing: "1", spacing_units: "inch", verticals: "1", horizontals: "1", weight: "0.8", gridColor: "000000" } }
],
triangledots: [
 { name: "5mm Stagger", set: { spacing: "0.5", spacing_units: "cm", weight: "0.8", gridColor: "b3b3b3" } },
 { name: "Half Inch Dots", set: { spacing: "0.5", spacing_units: "inch", weight: "1.2", gridColor: "000000" } },
 { name: "Fine Blue Field", set: { spacing: "0.2", spacing_units: "inch", weight: "0.6", gridColor: "b3b3ff" } },
 { name: "Fade Triangles", set: { spacing: "0.25", spacing_units: "inch", weight: "1", gridColor: "ece0c4" } }
],
leftborder: [
 { name: "12 to 1 Blue", set: { spacing: "1", spacing_units: "inch", minorspacing: "12", minorspacing_units: "inch", leftborder: "1", leftborder_units: "inch", weight: "0.8", minorweight: "0.25", gridColor: "b3b3ff" } },
 { name: "10 to 1 Grey", set: { spacing: "1", spacing_units: "inch", minorspacing: "10", minorspacing_units: "inch", leftborder: "1", leftborder_units: "inch", weight: "0.8", minorweight: "0.25", gridColor: "b3b3b3" } },
 { name: "Wide Border 2 inch", set: { spacing: "1", spacing_units: "inch", minorspacing: "4", minorspacing_units: "inch", leftborder: "2", leftborder_units: "inch", weight: "1", minorweight: "0.3", gridColor: "b3b3b3" } },
 { name: "Metric Ledger-ish", set: { spacing: "2", spacing_units: "cm", minorspacing: "10", minorspacing_units: "cm", leftborder: "2.5", leftborder_units: "cm", weight: "0.8", minorweight: "0.2", gridColor: "00b300" } }
],
asymmetric: [
 { name: "Tall Cells 1×5 / 1×3", set: { hmajorspacing: "1", hminorspacing: "3", vmajorspacing: "1", vminorspacing: "5", weight: "0.7", minorweight: "0.15", gridColor: "b3b3b3" } },
 { name: "10 to 2 Grey", set: { hmajorspacing: "1", hminorspacing: "10", vmajorspacing: "1", vminorspacing: "2", weight: "0.7", minorweight: "0.2", gridColor: "b3b3b3" } },
 { name: "Blue Ledger Feel", set: { hmajorspacing: "0.5", hminorspacing: "4", vmajorspacing: "1", vminorspacing: "6", weight: "0.8", minorweight: "0.15", gridColor: "b3b3ff" } },
 { name: "Metric 1×10 per cm", set: { hmajorspacing: "0.5", hminorspacing: "5", hmajorspacing_units: "cm", hminorspacing_units: "cm", vmajorspacing: "0.5", vminorspacing: "5", vmajorspacing_units: "cm", vminorspacing_units: "cm", weight: "0.7", minorweight: "0.15", gridColor: "b3b3b3" } }
],
simpleasymmetric: [
 { name: "Wide Stitch 0.3 × 0.1", set: { hsize: "0.3", hsize_units: "inch", vsize: "0.1", vsize_units: "inch", hbold: "5", vbold: "5", weight: "0.7", minorweight: "0.15", gridColor: "b3b3b3" } },
 { name: "Metric 6 × 4 mm", set: { hsize: "0.6", hsize_units: "cm", vsize: "0.4", vsize_units: "cm", hbold: "10", vbold: "10", weight: "0.7", minorweight: "0.15", gridColor: "b3b3ff" } },
 { name: "Bold Tens", set: { hsize: "0.25", hsize_units: "inch", vsize: "0.125", vsize_units: "inch", hbold: "10", vbold: "10", weight: "0.9", minorweight: "0.15", gridColor: "000000" } }
],
multiwidth: [
 { name: "Tenth Inch Minors", set: { spacing: "1", mediumspacing: "2", minorspacing: "10", weight: "1.2", mediumweight: "0.6", minorweight: "0.25", gridColor: "b3b3b3" } },
 { name: "Twelfth Inch Minors", set: { spacing: "1", mediumspacing: "2", minorspacing: "12", weight: "1.2", mediumweight: "0.6", minorweight: "0.2", gridColor: "b3b3ff" } },
 { name: "10-2 Grey", set: { spacing: "1", mediumspacing: "2", minorspacing: "10", weight: "1", mediumweight: "0.5", minorweight: "0.25", gridColor: "b3b3b3" } },
 { name: "Metric 1-5-10", set: { spacing: "1", spacing_units: "cm", mediumspacing: "5", mediumspacing_units: "cm", minorspacing: "10", minorspacing_units: "cm", weight: "1", mediumweight: "0.5", minorweight: "0.2", gridColor: "00b300" } }
],
weightedgrid: [
 { name: "Strong Rows", set: { spacing: "4", spacing_units: "inch", weight: "1", vweight: "0.3", gridColor: "b3b3b3" } },
 { name: "Ledger Green", set: { spacing: "5", spacing_units: "inch", weight: "0.8", vweight: "0.4", gridColor: "00b300" } },
 { name: "Metric Accent", set: { spacing: "2", spacing_units: "cm", weight: "0.9", vweight: "0.4", gridColor: "0000b3" } },
 { name: "Subtle Grey", set: { spacing: "4", spacing_units: "inch", weight: "0.6", vweight: "0.25", gridColor: "b3b3b3" } }
],
multicolor: [
 { name: "10 to 1 Red Grey Blue", set: { lspacing: "1", mediumspacing: "2", minorspacing: "10", lweight: "0.7", mediumweight: "0.3", minorweight: "0.15", lgridcolor: "b30000", mgridcolor: "b3b3b3", sgridcolor: "b3b3ff" } },
 { name: "Forest Tones", set: { lspacing: "1", mediumspacing: "2", minorspacing: "8", lweight: "0.8", mediumweight: "0.35", minorweight: "0.15", lgridcolor: "004400", mgridcolor: "00b300", sgridcolor: "b3d9b3" } },
 { name: "Metric Trio", set: { lspacing: "1", lspacing_units: "cm", mediumspacing: "2", mediumspacing_units: "cm", minorspacing: "10", minorspacing_units: "cm", lweight: "0.7", mediumweight: "0.3", minorweight: "0.12", lgridcolor: "000000", mgridcolor: "b30000", sgridcolor: "b3b3ff" } }
],
genkoyoushi: [
 { name: "1 Inch Blocks", set: { spacing: "1", spacing_units: "inch", weight: "1", gridColor: "b3b3b3" } },
 { name: "Genko Yoshi 2cm", set: { spacing: "2", spacing_units: "cm", weight: "1", gridColor: "b30000" } },
 { name: "Small Boxes", set: { spacing: "0.5", spacing_units: "inch", weight: "0.8", gridColor: "b3b3b3" } },
 { name: "Cream Paper", set: { spacing: "0.75", spacing_units: "inch", weight: "1", gridColor: "b3b3b3", bgColor: "FFF4DE" } }
],
perspective: [
 { name: "Low Horizon", set: { spacing: "4", spacing_units: "inch", plines: "20", convergence: "0.5", vconvergence: "0.02", weight: "0.5", pweight: "0.5", gridColor: "b3b3b3" } },
 { name: "Off-Center Point", set: { spacing: "4", spacing_units: "inch", plines: "24", convergence: "0.25", vconvergence: "0.1", weight: "0.4", pweight: "0.5", gridColor: "b3b3b3" } },
 { name: "Dense Rays", set: { spacing: "4", spacing_units: "inch", plines: "40", convergence: "0.5", vconvergence: "0.1", weight: "0.35", pweight: "0.35", gridColor: "b3b3b3" } },
 { name: "Blue Study", set: { spacing: "5", spacing_units: "inch", plines: "16", convergence: "0.6", vconvergence: "0.15", weight: "0.4", pweight: "0.5", gridColor: "b3b3ff" } }
],
bisectedtrapezoid: [
 { name: "1cm Bold", set: { spacing: "1", spacing_units: "cm", weight: "0.8", gridColor: "000000" } },
 { name: "Half Inch · Grey", set: { spacing: "0.5", spacing_units: "inch", weight: "0.5", gridColor: "b3b3b3" } },
 { name: "Fine Chain", set: { spacing: "0.125", spacing_units: "inch", weight: "0.3", gridColor: "b3b3b3" } },
 { name: "Blue Rhombus", set: { spacing: "0.33", spacing_units: "inch", weight: "0.5", gridColor: "b3b3ff" } }
],
musicstaff: [
 { name: "12 Staves Tight", set: { staves: "12", lps: "5", gap: "4", weight: "0.5", gridColor: "000000" } },
 { name: "15 Blue Staves", set: { staves: "15", lps: "5", gap: "3", weight: "0.4", gridColor: "0000b3" } },
 { name: "Big Practice · 4", set: { staves: "4", lps: "5", gap: "8", topper: "1", weight: "0.7", gridColor: "000000" } }
],
storyboard: [
 { name: "16:9 · 4-up", set: { aspectx: "16", aspecty: "9", numcols: "2", numrows: "2", lines: "1", weight: "1", mediumweight: "0.3", gridColor: "000000" } },
 { name: "16:9 · 6-up", set: { aspectx: "16", aspecty: "9", numcols: "2", numrows: "3", lines: "0", weight: "1", mediumweight: "0.3", gridColor: "000000" } },
 { name: "16:9 · 9-up", set: { aspectx: "16", aspecty: "9", numcols: "3", numrows: "3", lines: "0", weight: "0.8", mediumweight: "0.3", gridColor: "000000" } },
 { name: "4:3 Classic w/ Header", set: { aspectx: "4", aspecty: "3", numcols: "2", numrows: "3", lines: "1", header: "1", headtext: "Project:", weight: "1", mediumweight: "0.3", gridColor: "000000" } }
],
numberline: [
 { name: "Fractions 0-1 by ⅛", set: { start: "0", end: "1", increment: "0.125", lines: "5", fontsize: "9", weight: "1", gridColor: "000000" } },
 { name: "Negatives -20 to 20", set: { start: "-20", end: "20", increment: "5", lines: "6", fontsize: "10", weight: "1", gridColor: "000000" } },
 { name: "Hundreds 0-1000", set: { start: "0", end: "1000", increment: "100", lines: "4", fontsize: "9", weight: "1", gridColor: "0000b3" } }
],
logarithmic: [
 { name: "Semi-Log 1 Cycle", set: { xaxis: "linear", yaxis: "1", xspacing: "4", xspacing_units: "inch", yfine: "1", weight: "0.7", gridColor: "00b300" } },
 { name: "Log-Log 3 × 3", set: { xaxis: "3", yaxis: "3", xfine: "1", yfine: "1", weight: "0.6", gridColor: "b3b3b3" } },
 { name: "5-Cycle Tall", set: { xaxis: "linear", yaxis: "5", xspacing: "4", xspacing_units: "inch", yfine: "0", weight: "0.6", gridColor: "b3b3b3" } }
],
hexdot: [
 { name: "Tiny Vertices 8/inch", set: { spacing: "8", spacing_units: "inch", weight: "0.7", gridColor: "b3b3b3" } },
 { name: "Big Vertex Field", set: { spacing: "2", spacing_units: "inch", weight: "1.5", gridColor: "000000" } },
 { name: "Fade Hex Dots", set: { spacing: "4", spacing_units: "inch", weight: "1", gridColor: "ece0c4" } }
],
lite: [
 { name: "100 Boxes", set: { spacing: "0.7", spacing_units: "inch", numx: "10", numy: "10", weight: "0.5", gridColor: "000000" } },
 { name: "10000 Boxes", set: { spacing: "0.07", spacing_units: "inch", numx: "100", numy: "100", weight: "0.15", gridColor: "b3b3b3" } },
 { name: "1024 Boxes", set: { spacing: "0.2", spacing_units: "inch", numx: "32", numy: "32", weight: "0.3", gridColor: "b3b3b3" } }
],
circlesquare: [
 { name: "16 Spoke Circle Square", set: { spacing: "0.5", spacing_units: "inch", spokes: "16", weight: "0.5", gridColor: "b3b3b3" } },
 { name: "1cm Circle Square", set: { spacing: "1", spacing_units: "cm", spokes: "8", weight: "0.5", gridColor: "b3b3b3" } },
 { name: "Dense Target", set: { spacing: "0.25", spacing_units: "inch", spokes: "24", weight: "0.35", gridColor: "0000b3" } },
 { name: "Bold Compass", set: { spacing: "0.75", spacing_units: "inch", spokes: "12", weight: "0.8", gridColor: "000000" } }
],
fretboard: [
 { name: "Bass · 4 String", set: { strings: "4", frets: "5", columns: "3", rows: "4", weight: "0.7", gridColor: "000000" } },
 { name: "Mandolin 8-up", set: { strings: "4", frets: "6", columns: "2", rows: "4", weight: "0.7", gridColor: "000000" } },
 { name: "Big Charts 2×2", set: { strings: "6", frets: "6", columns: "2", rows: "2", weight: "0.9", gridColor: "000000" } }
],
musicsuper: [
 { name: "12 Staff Right Notes", set: { staves: "12", gap: "4", columns: "32", weight: "0.6", lightgridcolor: "cccccc", gridColor: "000000" } },
 { name: "Rhythm 16 Columns", set: { staves: "6", gap: "6", columns: "16", weight: "0.7", lightgridcolor: "b3b3ff", gridColor: "000000" } },
 { name: "Dense Composer", set: { staves: "10", gap: "5", columns: "48", weight: "0.5", lightgridcolor: "dddddd", gridColor: "000000" } },
 { name: "Green Light Grid", set: { staves: "8", gap: "5", columns: "24", weight: "0.6", lightgridcolor: "b3d9b3", gridColor: "000000" } }
],
cornellstaff: [
 { name: "8 Staves · Cue Left", set: { staves: "8", lps: "5", gap: "4", weight: "0.5", gridColor: "000000" } },
 { name: "Summary Top", set: { staves: "6", lps: "5", gap: "5", sumtop: "1", weight: "0.5", gridColor: "000000" } },
 { name: "Tab Practice (6 line)", set: { staves: "5", lps: "6", gap: "5", weight: "0.5", gridColor: "000000" } },
 { name: "Wide Notes 85%", set: { staves: "6", lps: "5", gap: "5", hsize: "85", weight: "0.5", gridColor: "000000" } }
],
cursive: [
 { name: "Steep 70°", set: { linespacing: "0.5", linespacing_units: "inch", slantspacing: "0.4", slantspacing_units: "inch", slantangle: "70", weight: "0.7", slantweight: "0.3", gridColor: "b3b3b3" } },
 { name: "1cm Metric Slant", set: { linespacing: "1", linespacing_units: "cm", slantspacing: "0.8", slantspacing_units: "cm", slantangle: "60", weight: "0.6", slantweight: "0.25", gridColor: "b3b3ff" } },
 { name: "Dense Guides", set: { linespacing: "0.4", linespacing_units: "inch", slantspacing: "0.2", slantspacing_units: "inch", slantangle: "55", weight: "0.6", slantweight: "0.2", gridColor: "c0c0c0" } }
],
paper174: [
 { name: "174 Black", set: { spacing: "4", spacing_units: "inch", vspacing: "4", vspacing_units: "inch", super: "4", weight: "0.5", gridColor: "000000" } },
 { name: "174 Graph Blue", set: { spacing: "4", spacing_units: "inch", vspacing: "4", vspacing_units: "inch", super: "4", weight: "0.5", gridColor: "b3b3ff" } },
 { name: "174 Star Chart", set: { spacing: "6", spacing_units: "inch", vspacing: "6", vspacing_units: "inch", super: "8", weight: "0.35", gridColor: "b3b3b3" } },
 { name: "Wide Margin · 174", set: { spacing: "5", spacing_units: "inch", vspacing: "5", vspacing_units: "inch", super: "10", weight: "0.4", gridColor: "b3b3b3" } }
],
ledger: [
 { name: "3-Column Simple", set: { columns: "3", rows: "40", gridColor: "007700", altcolor: "770000", weight: "0.5" } }
],
celticknot: [
 { name: "Half Inch Weave", set: { spacing: "0.5", spacing_units: "inch", weight: "0.6", minorweight: "0.2", gridColor: "b3b3b3" } },
 { name: "Big Knot · 2 inch", set: { spacing: "2", spacing_units: "inch", weight: "1", minorweight: "0.3", gridColor: "00b300" } },
 { name: "Fine Interlace 1cm", set: { spacing: "1", spacing_units: "cm", weight: "0.6", minorweight: "0.2", gridColor: "0000b3" } }
],
axisgraph: [
 { name: "First Quadrant Lab", set: { spacing: "4", spacing_units: "inch", quadrants: "1", labelevery: "1", weight: "0.35", axisweight: "1.2", gridColor: "b3b3b3" } },
 { name: "Label Every 5", set: { spacing: "10", spacing_units: "inch", quadrants: "4", labelevery: "5", weight: "0.25", axisweight: "1.2", gridColor: "b3b3b3" } },
 { name: "Metric Centered", set: { spacing: "2", spacing_units: "cm", quadrants: "4", labelevery: "1", weight: "0.35", axisweight: "1.2", gridColor: "b3b3ff" } },
 { name: "Big Kid Axes 2/inch", set: { spacing: "2", spacing_units: "inch", quadrants: "4", labelevery: "1", weight: "0.4", axisweight: "1.5", gridColor: "000000" } }
],
engpad: [
 { name: "Grey Professional", set: { spacing: "5", spacing_units: "inch", weight: "0.25", frameweight: "0.8", gridColor: "b3b3b3" } },
 { name: "Metric 2/cm", set: { spacing: "2", spacing_units: "cm", weight: "0.25", frameweight: "0.8", gridColor: "00b300", bgColor: "f4faf4" } },
 { name: "Amber Pad", set: { spacing: "5", spacing_units: "inch", weight: "0.25", frameweight: "0.8", gridColor: "aa8833", bgColor: "fdf6e3" } },
 { name: "Fine 10/inch", set: { spacing: "10", spacing_units: "inch", weight: "0.15", frameweight: "0.8", gridColor: "00b300", bgColor: "f4faf4" } }
],
ternary: [
 { name: "5% Steps", set: { divisions: "20", labels: "1", weight: "1", minorweight: "0.25", gridColor: "000000" } },
 { name: "2% Fine", set: { divisions: "50", labels: "1", weight: "1", minorweight: "0.15", gridColor: "b3b3b3" } },
 { name: "Quarters Teaching", set: { divisions: "4", labels: "1", weight: "1.2", minorweight: "0.5", gridColor: "0000b3" } },
 { name: "Unlabeled 10%", set: { divisions: "10", labels: "0", weight: "1", minorweight: "0.3", gridColor: "b3b3b3" } }
],
crossstitch: [
 { name: "18 Count", set: { spacing: "18", spacing_units: "inch", boldevery: "10", weight: "0.2", boldweight: "0.7", gridColor: "b3b3b3" } },
 { name: "11 Count Chunky", set: { spacing: "11", spacing_units: "inch", boldevery: "10", weight: "0.3", boldweight: "0.9", gridColor: "b3b3b3" } },
 { name: "Bold Every 5", set: { spacing: "10", spacing_units: "inch", boldevery: "5", weight: "0.25", boldweight: "0.7", gridColor: "b3b3b3" } },
 { name: "Blue Chart", set: { spacing: "14", spacing_units: "inch", boldevery: "10", weight: "0.25", boldweight: "0.8", gridColor: "b3b3ff" } }
],
hexmap: [
 { name: "Half Inch Campaign", set: { spacing: "2", spacing_units: "inch", labels: "1", weight: "0.4", gridColor: "b3b3b3" } },
 { name: "Unlabeled Terrain", set: { spacing: "1", spacing_units: "inch", labels: "0", weight: "0.6", gridColor: "b3b3b3" } },
 { name: "2cm Wargame", set: { spacing: "0.5", spacing_units: "cm", labels: "1", weight: "0.4", gridColor: "000000" } },
 { name: "Big Hex Blue", set: { spacing: "0.7", spacing_units: "inch", labels: "1", weight: "0.5", gridColor: "0000b3" } }
],
goboard: [
 { name: "13 × 13 Club", set: { spacing: "0.55", spacing_units: "inch", size: "13", weight: "0.7", gridColor: "000000" } },
 { name: "Gomoku Paper", set: { spacing: "0.35", spacing_units: "inch", size: "19", weight: "0.5", gridColor: "b3b3b3" } },
 { name: "Cream Goban", set: { spacing: "0.4", spacing_units: "inch", size: "19", weight: "0.7", gridColor: "000000", bgColor: "FFF4DE" } }
],
perspective2: [
 { name: "High Horizon", set: { plines: "15", horizon: "75", spread: "120", vertical: "1", weight: "0.35", gridColor: "b3b3b3" } },
 { name: "Worm's Eye", set: { plines: "15", horizon: "15", spread: "120", vertical: "1", weight: "0.35", gridColor: "b3b3b3" } },
 { name: "Dense Blue Rays", set: { plines: "40", horizon: "50", spread: "150", vertical: "0", weight: "0.25", gridColor: "b3b3ff" } },
 { name: "Extreme Corner", set: { plines: "20", horizon: "50", spread: "60", vertical: "1", weight: "0.35", gridColor: "b3b3b3" } }
],
habittracker: [
 { name: "Week View · 7 Columns", set: { days: "7", rows: "20", namewidth: "2", weight: "0.4", gridColor: "b3b3b3" } },
 { name: "30 Days · 20 Habits", set: { days: "30", rows: "20", namewidth: "1.5", weight: "0.4", gridColor: "b3b3b3" } },
 { name: "Wide Names", set: { days: "31", rows: "30", namewidth: "2.5", weight: "0.4", gridColor: "0000b3" } },
 { name: "Green Year", set: { days: "31", rows: "52", namewidth: "1.5", weight: "0.35", gridColor: "00b300" } }
],
splitpage: [
 { name: "Lines Left · Grid Right", set: { layout: "gridright", gridspacing: "4", gridspacing_units: "inch", linespacing: "3", linespacing_units: "inch", weight: "0.4", gridColor: "b3b3b3" } },
 { name: "Grid Top · Notes Below", set: { layout: "gridtop", gridspacing: "4", gridspacing_units: "inch", linespacing: "3.56", linespacing_units: "inch", weight: "0.4", gridColor: "b3b3b3" } },
 { name: "Metric Combo", set: { layout: "gridleft", gridspacing: "2", gridspacing_units: "cm", linespacing: "1", linespacing_units: "cm", weight: "0.4", gridColor: "b3b3ff" } },
 { name: "Dense Engineer Split", set: { layout: "gridbottom", gridspacing: "8", gridspacing_units: "inch", linespacing: "4", linespacing_units: "inch", weight: "0.3", gridColor: "00b300" } }
],
beadpaper: [
 { name: "Brick · Delica", set: { spacing: "8", spacing_units: "inch", style: "brick", ratio: "0.84", weight: "0.3", gridColor: "b3b3b3" } },
 { name: "11/0 Seed Peyote", set: { spacing: "10", spacing_units: "inch", style: "peyote", ratio: "0.75", weight: "0.25", gridColor: "b3b3b3" } },
 { name: "Big Chart 5/inch", set: { spacing: "5", spacing_units: "inch", style: "peyote", ratio: "0.84", weight: "0.4", gridColor: "000000" } }
],
dotsboxes: [
 { name: "Tournament Tight", set: { spacing: "0.35", spacing_units: "inch", weight: "1.6", guides: "1", guideweight: "0.08", border: "1", gridColor: "000000" } },
 { name: "Kids' Big Board", set: { spacing: "0.75", spacing_units: "inch", weight: "2.5", guides: "1", guideweight: "0.12", border: "1", gridColor: "0000b3" } },
 { name: "No Guides Classic", set: { spacing: "0.5", spacing_units: "inch", weight: "2", guides: "0", border: "0", gridColor: "000000" } },
 { name: "1cm Travel", set: { spacing: "1", spacing_units: "cm", weight: "1.8", guides: "1", guideweight: "0.1", border: "1", gridColor: "b3b3b3" } }
],
battlemat: [
 { name: "Metric Dungeon 2.5cm", set: { spacing: "2.5", spacing_units: "cm", style: "super", sub: "5", weight: "1", subweight: "0.2", scalelabel: "1 square = 1.5 m", gridColor: "b3b3b3" } },
 { name: "No Subdivisions", set: { spacing: "1", spacing_units: "inch", style: "super", sub: "1", weight: "0.8", subweight: "0.2", scalelabel: "", gridColor: "b3b3b3" } },
 { name: "Fine Tactical 8ths", set: { spacing: "1", spacing_units: "inch", style: "hex", sub: "8", weight: "1.2", subweight: "0.15", scalelabel: "1 hex = 5 feet", gridColor: "777777" } }
],
alphanumeric: [
 { name: "Numbers on Side", set: { spacing: "0.5", spacing_units: "inch", sidetype: "numbers", sidepos: "left", toppos: "top", weight: "0.5", gridColor: "b3b3b3" } },
 { name: "Crossword Setter", set: { spacing: "0.3", spacing_units: "inch", sidetype: "numbers", sidepos: "both", toppos: "both", weight: "0.5", gridColor: "000000" } },
 { name: "1cm Classroom", set: { spacing: "1", spacing_units: "cm", sidetype: "letters", sidepos: "left", toppos: "top", weight: "0.5", gridColor: "0000b3" } }
],
copperplate: [
 { name: "Lefty 125°", set: { xheight: "0.2", xheight_units: "inch", ratio: "3:2:3", slantangle: "125", slantspacing: "0.3", slantspacing_units: "inch", weight: "0.6", lightweight: "0.3", slantweight: "0.25", gridColor: "b3b3b3" } },
 { name: "Upright Practice 90°", set: { xheight: "0.25", xheight_units: "inch", ratio: "2:1:2", slantangle: "90", slantspacing: "0.25", slantspacing_units: "inch", weight: "0.6", lightweight: "0.3", slantweight: "0.2", gridColor: "b3b3ff" } },
 { name: "Spencerian-ish 52°", set: { xheight: "0.15", xheight_units: "inch", ratio: "3:2:3", slantangle: "52", slantspacing: "0.35", slantspacing_units: "inch", weight: "0.5", lightweight: "0.25", slantweight: "0.2", gridColor: "c0c0c0" } }
],
archspiral: [
 { name: "Tight Coil · 20 Turns", set: { turns: "20", rotation: "0", crosshair: "0", weight: "0.4", gridColor: "b3b3b3" } },
 { name: "Three & a Half", set: { turns: "3.5", rotation: "90", crosshair: "1", weight: "0.8", gridColor: "000000" } },
 { name: "Zen Single", set: { turns: "1.5", rotation: "0", crosshair: "0", weight: "1", gridColor: "b3b3b3" } },
 { name: "Blue Vortex", set: { turns: "15", rotation: "45", crosshair: "0", weight: "0.5", gridColor: "0000b3" } }
],
logspiral: [
 { name: "Nautilus 140%", set: { growth: "140", rotation: "0", crosshair: "0", weight: "0.7", gridColor: "b3b3b3" } },
 { name: "Aggressive 200%", set: { growth: "200", rotation: "180", crosshair: "1", weight: "0.8", gridColor: "000000" } },
 { name: "Barely Growing 108%", set: { growth: "108", rotation: "0", crosshair: "0", weight: "0.4", gridColor: "b3b3b3" } }
]
};

// Category definitions
const CATEGORIES = [
  "Classic Writing",
  "Experimental",
  "Patterns",
  "Plain Grids",
  "Recording & Charting",
  "Specialty",
  "Writing & Bullet Journalling",
  "Project & Assignment Borders"
];

const GROUP_OF = {
  "squarecross": "Writing & Bullet Journalling",
  "squaredots": "Writing & Bullet Journalling",
  "boldsquaredots": "Writing & Bullet Journalling",
  "offsetsquaredots": "Writing & Bullet Journalling",
  "linedots": "Writing & Bullet Journalling",
  "isometricdots": "Writing & Bullet Journalling",
  "detached": "Writing & Bullet Journalling",
  "plain": "Plain Grids",
  "inverted": "Plain Grids",
  "asymmetric": "Patterns",
  "octagon": "Patterns",
  "triangle": "Patterns",
  "vartriangle": "Patterns",
  "68degree": "Patterns",
  "hexagonal": "Patterns",
  "brick": "Patterns",
  "diamond": "Patterns",
  "tumblingblock": "Patterns",
  "circle": "Patterns",
  "circlegrid": "Patterns",
  "moorish": "Patterns",
  "engineer": "Recording & Charting",
  "spider": "Recording & Charting",
  "notelined": "Classic Writing",
  "gridlined": "Classic Writing",
  "lined": "Classic Writing",
  "writing": "Classic Writing",
  "doublelined": "Classic Writing",
  "cornelllined": "Classic Writing",
  "cornellgraph": "Classic Writing",
  "cornelldots": "Classic Writing",
  "calligraphy": "Classic Writing",
  "chinesehex": "Classic Writing",
  "chinesesquare": "Classic Writing",
  "chineseX": "Classic Writing",
  "chinesequarter": "Classic Writing",
  "genkoyoushi": "Classic Writing",
  "axonometric": "Plain Grids",
  "multiwidth": "Plain Grids",
  "weightedgrid": "Plain Grids",
  "multicolor": "Plain Grids",
  "leftborder": "Plain Grids",
  "intersecteddiamonds": "Patterns",
  "simpleasymmetric": "Patterns",
  "bisectedtrapezoid": "Patterns",
  "celticknot": "Patterns",
  "triangledots": "Writing & Bullet Journalling",
  "hexdot": "Writing & Bullet Journalling",
  "perspective": "Specialty",
  "polar": "Recording & Charting",
  "logarithmic": "Recording & Charting",
  "paper174": "Recording & Charting",
  "ledger": "Recording & Charting",
  "lite": "Plain Grids",
  "circlesquare": "Plain Grids",
  "cursive": "Classic Writing",
  "fretboard": "Specialty",
  "musicsuper": "Specialty",
  "cornellstaff": "Specialty",
  "musicstaff": "Specialty",
  "storyboard": "Specialty",
  "numberline": "Specialty",
  "axisgraph": "Experimental",
  "engpad": "Experimental",
  "ternary": "Experimental",
  "crossstitch": "Experimental",
  "hexmap": "Experimental",
  "goboard": "Experimental",
  "perspective2": "Experimental",
  "habittracker": "Experimental",
  "splitpage": "Experimental",
  "beadpaper": "Experimental",
  "dotsboxes": "Experimental",
  "battlemat": "Experimental",
  "alphanumeric": "Experimental",
  "copperplate": "Experimental",
  "archspiral": "Experimental",
  "logspiral": "Experimental",
  "proj_front": "Project & Assignment Borders",
  "proj_eng": "Project & Assignment Borders",
  "proj_academic_ruled": "Project & Assignment Borders",
  "proj_academic_blank": "Project & Assignment Borders",
  "proj_floral": "Project & Assignment Borders",
  "proj_tech": "Project & Assignment Borders"
};

// Enrich generators with category and search tags
GENERATORS.forEach(gen => {
  gen.category = GROUP_OF[gen.id] || "More";
});

  if (typeof window !== "undefined") {
    window.PATTERNS = GENERATORS;
    window.CATEGORIES = CATEGORIES;
    window.GROUP_OF = GROUP_OF;
  }
  if (typeof global !== "undefined") {
    global.PATTERNS = GENERATORS;
    global.CATEGORIES = CATEGORIES;
    global.GROUP_OF = GROUP_OF;
  }
})();
