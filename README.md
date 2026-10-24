# PaperPatterns 📐

> A modern, minimal, zero-dependency vector graph paper & grid generator.  
> Re-architected and expanded from Kevin MacLeod's classic [Incompetech Graph Paper](https://incompetech.com/graphpaper/) (CC0 1.0 Public Domain).

![PaperPatterns](https://img.shields.io/badge/License-CC0_1.0-blue.svg)
![Zero Dependencies](https://img.shields.io/badge/Dependencies-0-success.svg)
![Offline First](https://img.shields.io/badge/Offline-100%25-brightgreen.svg)
![Generators](https://img.shields.io/badge/Patterns-91-orange.svg)

---

## ✨ What's New & Key Features

### 🎨 Modern & Minimalist UI
- **Clean Aesthetic**: Built with a contemporary Linear / Notion / Apple design language with smooth typography, subtle borders, and soft elevations.
- **Dark Mode & Light Mode**: Fluid system-aware theme toggle with custom styling for both app interface and paper simulation.
- **Visual Pattern Browser**: Collapsible drawer featuring live, miniature vector SVG thumbnail cards for all 91 patterns.
- **Categorized Navigation**: Quick-filter tab pills (Journaling, Plain Grids, Tilings & Patterns, Math & Charting, Writing & Calligraphy, Music & Specialty, Games & RPGs, Project & Assignment Borders, and Starred Favorites).
- **Instant Search**: Real-time fuzzy filtering with `/` keyboard shortcut.

### 📄 Interactive Canvas & Measurement Scale
- **True-to-Scale Simulation**: Paper sheet preview rendered to exact aspect ratio with drop shadows and page outline.
- **Fluid Pan & Zoom**: Smooth mouse wheel zooming, middle-click / left-click drag panning, zoom reset (`Fit to Screen`), and zoom percentage HUD.
- **Live Specification Badge**: Real-time display of active paper format (e.g. `A4 · 210 × 297 mm`), grid pitch, line count, and vector complexity.

### 📐 Decorative Frames & Assignment Borders (New Feature!)
- **14 Distinct Frame & Border Styles**:
  - `Single Line`: Crisp rectangular border framing the grid area.
  - `Double Line (Drafting)`: Formal dual-rule frame with inner accent line.
  - `Heavy Blueprint Frame`: Bold, high-contrast engineering title-block outer frame.
  - `Corner Marks (L-Brackets)`: Minimalist drafting crop marks at all 4 corners.
  - `Dashed / Stitch Frame`: Clean segmented border for craft, sewing, or bullet journaling.
  - `Notebook Margin Rule`: Classic vertical red margin rule with subtle header separator line.
  - `Beveled Art Deco Frame`: 45° notched decorative corner cutouts.
  - `Diploma & Certificate Seal`: Elegant gold/blue formal parchment border with embossed rosette seal.
  - `Greek Key (Meander)`: Classical continuous Hellenic geometric labyrinth border.
  - `Vintage Baroque Scroll`: Regal ornamental corner flourishes with filigree brackets.
  - `Celtic Endless Knot`: Interlaced continuous knotwork corner medallions.
  - `Art Deco Luxury Gatsby`: 1920s geometric stepped fan and chevron corner accents.
  - `Islamic Arabesque Girih`: Sacred 8-point geometric star and strapwork corner patterns.
  - `Modern Ribbon Title Banner`: Contemporary clean header banner with folded ribbon dovetail ends.
- **Editable Cover Page Text & Removable Elements**:
  - Editable report title, topic name, student name, roll number, class & section, subject, and date fields.
  - Toggle switches to independently show/hide submission tables, topic banners, medals, or date lines.
  - Universal real-time preview across screen, PDF export, and direct printing.

### 🚀 Advanced Document & Print Engine (New Features!)
- **Multi-Page PDF Generation**: Create 1, 2, 5, 10, 25, 50, or custom page notebook PDFs in milliseconds with minimal file size overhead.
- **Custom Headers & Dates**: Add custom project title lines (`Project Notes · Lab Log`) and blank date stamps (`Date: ________`).
- **Dynamic Page Numbering**: Auto-calculate and format `Page X of Y` in the footer.
- **Standard International & US Formats**: 1-click presets for **A4, A5, A3, US Letter, US Legal, Tabloid/Ledger, Executive, B5 (JIS)**, plus custom dimensions in millimeters, centimeters, or inches.
- **Orientation Toggle**: Instant 1-click swap between Portrait and Landscape without recalculation artifacts.
- **Preset Paper Margins**: Borderless ($0$), Narrow ($6.35\text{ mm}$), Standard ($12.7\text{ mm}$), Wide ($25.4\text{ mm}$), and continuous slider.
- **Predefined Inks & Paper Tints**:
  - Ink swatches: *Graph Blue, Charcoal Black, Pencil Grey, Cyan, Crimson, Engineering Green, and custom hex*.
  - Paper tints: *Clean White, Warm Ivory / Cream, Kraft Recycled, Blueprint Slate, Midnight Dark*.

### 💾 Flexible Export Options
- **Hand-Crafted PDF 1.4 Binary Compiler**: Zero external dependencies (no jsPDF, no PDFKit); compiles standards-compliant PDF byte streams directly in pure JavaScript.
- **Clean Vector SVG**: Exports clean, grouped `<svg>` files ready for laser cutters, pen plotters, Figma, Illustrator, or Canva.
- **300 DPI High-Res PNG**: High-resolution rasterization via HTML5 Canvas up to 8,000 px.
- **Direct Native Print**: Print preview configured with exact `@media print` CSS rules.
- **Stateless Shareable URL Hash**: All configurations serialize into `#patternId?params` for deep linking and bookmarking.
- **Offline Single-File Bundle**: 1-click button to download the entire application compiled into a single offline `.html` file.

---

## 🗂️ Project Architecture

```
paperpatterns/
├── index.html                 # Modern application entry point
├── css/
│   └── styles.css             # Minimal design system & dark/light theme
├── js/
│   ├── engine.js              # Display List IR, PDF 1.4 compiler, SVG converter, AFM metrics
│   ├── patterns.js            # 78 algorithmic pattern generators with category metadata
│   └── app.js                 # State controller, interactive canvas, form builder, exports
├── original_incompetech.html  # Preserved original Kevin MacLeod standalone artifact
└── README.md                  # Documentation
```

---

## 🚀 Running the App

Because **PaperPatterns** has zero external build steps or dependencies, you can run it immediately:

1. **Direct File Open**:
   Double click `index.html` or open in any modern browser (`Chrome`, `Firefox`, `Safari`, `Edge`).
2. **Local Static Server**:
   ```bash
   # Python 3
   python -m http.server 8000
   
   # Node.js
   npx serve .
   ```
   Open `http://localhost:8000` in your browser.

---

## 📜 License
Original generator algorithms by **Kevin MacLeod** (Incompetech), licensed under **Creative Commons Zero v1.0 (Public Domain)**.  
All improvements, modern GUI, and document additions are also released under **CC0 1.0**.
