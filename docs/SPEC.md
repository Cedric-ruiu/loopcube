# LoopCube — specification

What LoopCube does and why. For the stack, commands, architecture and deployment, see the [README](../README.md).

## 1. The project

LoopCube is an open source web generator of **impossible cubes** (also called infinite cubes), made for metal trades: boilermakers, pipe fitters, ironworkers, welders.

- The user sets up the cube with sliders, from the stock on hand and the look they want.
- A real-time 3D view shows the result.
- A button produces a **printable fabrication plan** (A4) that stands on its own: a professional can cut and assemble the object with this document alone.
- Multilingual: French and English at launch, more languages later.

Mind the vocabulary: this is **not** the fidget "infinity cube" (8 small hinged cubes). It is a sculpture made of a single line of tube, closed on itself, that traces the edges of a cube.

## 2. Geometry

The data below was computed and verified numerically.

### 2.1 Principle

- A **single closed loop, with no start or end**: 18 straight runs joined by 18 corners at 90°. No other weld than the corners (except for bent-tube sections, see 4.3).
- Each run is parallel to an edge of the cube.
- Of the cube's 12 edges:
  - **6 edges are doubled**: two parallel runs side by side, separated by the gap `G`. They are **never aligned**: they are offset diagonally (one is flush with a face of the cube, the other with the adjacent face).
  - **6 edges are single**: one run only.
- No run touches another run, except its two neighbors in the loop, at the welded corner.
- Seen along the cube's main diagonal, the object draws 6 triangular lobes around a central star: this is the illusion of the endless line.
- The object has a 3-fold symmetry around that diagonal.

### 2.2 Shapes

The settings offer three shapes, all built on the same loop of 18 runs (same edges doubled, same order):

- **Classic cube**: every face alike, 3-fold symmetry (below, unless stated otherwise).
- **Framed cube**: the top and bottom faces are full-size frames, flush with the edges of the cube (enough to rest a top on). The 4 doubled runs of these two faces are flush on both ends; the bar paired with each one sits right under or above it, flush with the same side face (stacked, not offset diagonally). The 2 vertical doubled edges stay offset diagonally. Only a 2-fold symmetry is left.
- **Box**: the framed cube with its own length along X (horizontal, seen in the front view) and depth along Z, e.g. for a coffee table. Overall size `B × A × C`: `B` is the length, `A` the height, `C` the depth. `B ≥ C`, the height is free; at `B = C = A` it is the framed cube.

### 2.3 Geometric parameters

- `A`: cube edge = **overall outside size** of the object; height of a box.
- `B`: overall length of a box, along X.
- `C`: overall depth of a box, along Z.
- `W`: width of the square tube, or outside diameter of the round tube.
- `G`: gap between two parallel runs. Computed default: `G = W / 2`, editable.

### 2.4 Corner coordinates

Origin at the center of the cube. The 18 corners of the loop (on the tube axes) are encoded as signed levels, in loop order:

```
[-2,-1,-2] [-2,-1, 1] [ 2,-1, 1] [ 2, 2, 1] [-1, 2, 1] [-1,-2, 1]
[-1,-2,-2] [-1, 1,-2] [-1, 1, 2] [ 2, 1, 2] [ 2, 1,-1] [-2, 1,-1]
[-2,-2,-1] [ 1,-2,-1] [ 1, 2,-1] [ 1, 2, 2] [ 1,-1, 2] [ 1,-1,-2]
```

Framed cube and box: the same corners, except the 6 where the loop turns in the top or bottom face (both runs horizontal), which move to level 1 (flush):

```
[-1,-1,-1] [-1,-1, 1] [ 2,-1, 1] [ 2, 2, 1] [-1, 2, 1] [-1,-2, 1]
[-1,-2,-2] [-1, 1,-2] [-1, 1, 1] [ 1, 1, 1] [ 1, 1,-1] [-2, 1,-1]
[-2,-2,-1] [ 1,-2,-1] [ 1, 2,-1] [ 1, 2, 2] [ 1,-1, 2] [ 1,-1,-1]
```

Each component `c` converts to a real coordinate, with `S` the outside size along that axis (`A`, or for a box `B` along X and `C` along Z):

```
n = |c| - 1            (level 0 or 1)
x = sign(c) * (S/2 - W/2 - n * (W + G))
```

Run `i` joins corner `i` to corner `i+1` (the last one returns to the first).

### 2.5 Properties covered by unit tests

- Two consecutive corners differ on one axis only (runs parallel to the axes), and every corner is at 90°.
- Overall size = `A` exactly.
- Gap between two non-consecutive runs, measured axis by axis (the gap seen in orthographic views) = `G` exactly. In 3D, doubled bars face each other corner to corner: the Euclidean distance is `G√2` in square tube, and `(W+G)√2 − W` in round tube. `G` always means the axis-by-axis gap. Framed cube and box: stacked bars face each other side to side, so the Euclidean distance is `G` too.
- Centerline lengths (corner to corner):
  - **12 long runs**: `L1 = A - 2W - G` (the doubled edges)
  - **6 short runs**: `L2 = A - 3W - 2G` (the single edges)
  - Example `A=300, W=25, G=12`: 12 × 238 mm and 6 × 201 mm.
  - Framed cube: 4 flush runs `A − W`, 12 runs `L1`, 2 vertical runs `L2`. Box: the same, runs along X longer by `B − A` and runs along Z by `C − A`. Overall size = `B × A × C` exactly.
- Validity: the shortest straight length must stay ≥ `MIN_STRAIGHT` (10 mm). In square tube it is `L2 − W` (otherwise the miters of the short part cross); in round tube with elbows, `L2 − 2R`; in bent tube, `L2/2 − R` on each side of the weld. For a box, `L2` is the shorter of `A − 3W − 2G` (vertical runs) and `C − 2W − G` (runs along the depth). The sliders cannot reach impossible combinations, and the interface explains why.

### 2.6 Part types

Parts differ by their length **and** the orientation of the cuts at both ends. With the geometry above and square tube mitered at 45°:

- 12 long parts with both miters on the same side (U-shaped);
- 3 short parts with miters turned 90° from each other;
- 3 short parts mirroring the previous ones (twisted the other way).

These results are not hard-coded: the classification is **computed** from the geometry (length + relative orientation of the two cuts + chirality), so it stays correct if the geometry changes. The tests check that it finds 12 + 3 + 3, and 4 + 8 + 2 + 2 + 1 + 1 for the framed cube (the box splits further, its runs along X and Z having their own lengths).

## 3. User settings

- **Shape** (drop-down menu, first setting): classic cube, framed cube, or box (coffee table), each with a one-line description. The box adds a **length** `B` and a **depth** `C`; its edge is then labeled height. Picking the box starts its depth at the cube edge and its length at `2C` when it was shorter than `C`; both are kept while the shape stays a box. The length never goes under the depth: the depth stops at the length and the length at the depth, and the interface says why. The height is free.

- **Profile**: square tube or round tube.
- **Section**: width (square) or outside diameter (round), and **wall thickness** (separate slider).
  - A list of standard commercial sizes, plus free input.
  - Metric: common EN 10219 square tubes (20, 25, 30, 40, 50, 60 mm…), common round tubes (21.3; 26.9; 33.7; 42.4; 48.3; 60.3 mm…).
  - Imperial: common square tubes (3/4", 1", 1-1/4", 1-1/2", 2"…), common NPS round tubes (1/2, 3/4, 1, 1-1/4, 1-1/2, 2 with their actual outside diameter).
- **Cube edge** `A` (overall size).
- **Gap between bars** `G` (default `W/2`).
- **Round tube only**:
  - checkbox: **bent tube** or **weld elbows**;
  - **bend radius** `R`, measured to the tube axis, minimum `1 × Ø`, default `1.5 × Ø` (standard 3D elbow).
- **Units**: tied to the language by default (FR → mm, EN → inches), but changeable with a separate selector.
  - Inches: fractions to 1/16" (US shop practice).

Defaults: `A = 300 mm`, square tube `25 × 25 × 2 mm`, `G = 12.5 mm`. Imperial: `A = 12"`, square tube `1" × 0.083"` (14 ga), `G = 1/2"`. Imperial dimension format: `9-3/8"`.

## 4. Fabrication

### 4.1 Square tube

18 bars mitered at 45° at both ends, butt-welded at the 18 corners.

- For each part: centerline length, tip-to-tip length (outside of the corner, `L + W`), inside length (`L - W`), orientation of the two miters relative to each other.

### 4.2 Round tube with weld elbows

18 straight tubes + 18 elbows at 90° with radius `R`.

- Length of each straight tube: `L - 2R`.
- Elbows are designated by their radius and diameter.

### 4.3 Bent round tube

A closed 3D loop of 18 bends cannot be bent from a single tube. The plan therefore splits the loop into **identical bent sections**, joined by butt welds in the middle of straight runs.

- Split: cut in the middle of the 6 runs of the single edges. This gives **6 flat sections** (3 bends in one plane), joined with a rotation of ±90°. Classic cube: 6 identical sections `L2/2 – L1 – L1 – L2/2`. Framed cube: 2 types (4 side sections, 2 for the top and bottom). Box: 3 types of 2. The plan gives each weld from the section that really comes before it in the loop.
- The bends must not reduce the gap between bars.
- For each section: developed length (on the axis), dimensions between bends, angle of each bend (90°), **rotation of the tube between two successive bends** (0°, 90°, 180° or -90°), bend radius.

## 5. 3D view

- Real-time, in sync with every setting.
- Zoom (wheel, pinch) and free rotation (mouse, finger).
- A **"Diagonal view"** button puts the camera on the main diagonal of the envelope (through the corners where the doubled edges meet; `(B, A, C)` for a box) to show the illusion.
- A checkbox **colors parts by type**: each part type (as in 2.6) has its own color, told apart from all the others even in shade, with a legend giving the count of each type.
- Optional display of the **part marks** (same marks as the plan).
- A checkbox, unchecked by default, shows the **overall dimensions** (length, depth, height) as dimension lines, in the chosen unit, on the outline seen from the camera.
- Square tube drawn with its miters; round tube with its elbows or bends.

## 6. Fabrication plan

- Always in sync with the settings and the 3D view (same data source).
- **A4**, ready to print from the browser (and so to save as PDF).
- Technical drawing following the language's conventions:
  - **FR**: dimensions in mm, ISO 128 conventions, first-angle projection with its symbol in the title block.
  - **EN**: dimensions in fractional inches to 1/16", ASME Y14.5 conventions, third-angle projection with its symbol.
  - If the user changes the unit independently of the language, dimensions follow the chosen unit.
- Content:
  1. **Title block** on every page: LoopCube title naming the shape, settings (with `B` and `C` for a box), date, unit, projection symbol, scale, general tolerance, page number.
  2. **Overview**:
     - a large axonometric view (trimetric, at the opening angle of the 3D view: no doubled bar is hidden by its neighbor; at least half the sheet) with the marks of every part; each leader line ends with a dot on a visible part of its piece and crosses no other piece (when space runs out, in round tube with elbows, the one that crosses the fewest); a weld symbol (ISO 2553, AWS A2.4 in English): all-around butt weld at each corner or joint;
     - the orthographic views (front, top, side), reduced, with overall dimensions (the length of a box on the front and top views, which get a wider column, its depth on the top and side views); on the front view, a circle marks detail X: two doubled bars in section, at scale 1:1 or 1:2 depending on space (more for a large tube), dimensioned `□ W` (`Ø W` in round tube), `G` and wall thickness `e`;
     - a small presentation view along the main diagonal (the illusion), not to scale;
     - the loop sequence (parts in order, from A1 back to A1) and its repeating pattern, computed from the parts.
     - Commercial elbows are identical and fit any corner: they all carry mark C (a single mark in the axonometric view, "C" between tubes in the loop sequence, and in the 3D view).
  3. **Bill of materials**: mark, quantity, designation (section and thickness), length, total material (cumulative tube length, cutting waste not included, and stated as such). Notes: symbols, critical squareness (weld deviations add up when the loop closes), welds ground flush (optional).
  4. **Cut list**: one dimensioned sketch per part type, with the miters and their relative orientation clearly drawn; the cut length is the main dimension, the other lengths are reference dimensions, in parentheses (ISO 129); end views, at their own scale (1:1 or 1:2, stated under the view), show the tube wall and its size `□ W`; for bent tube, the layout of each section with dimensions between bends and rotation angles (see 4.3).
- **No** assembly or tack-welding order for now: the loop sequence is not one.
- The plan stays readable printed in black and white.

## 7. Pages, content and SEO

- Very simple, fast design. Mobile first, fully usable on desktop.
- A short introduction per language: what an impossible cube is, who the tool is for, how to use it.
- LoopCube is the brand; keywords go in the `title`, the H1, the meta description and the text.
  - FR `title`: *LoopCube — Générateur de cube infini en métal, plan de débit gratuit*
  - EN `title`: *LoopCube — Impossible cube generator for metal fabrication, free cut list*
  - FR keywords: « cube infini », « cube impossible », « chaudronnerie », « tuyauterie », « soudure », « plan cube infini soudure », « fiche de débit ».
  - EN keywords: "impossible cube", "infinite cube sculpture", "metal fabrication", "welding project plans", "cut list".
  - "Infinity cube" is avoided as the main English keyword: it mostly means the fidget toy. The text can explain the difference.
  - The H1 and first paragraph use the main keywords naturally, without stuffing.
- The root `/loopcube/` is a language choice page (redirect based on the browser, plus plain links), target of `x-default`.
- One pre-rendered page per language (`/fr/`, `/en/`), with its own `lang`, `hreflang` (including `x-default`), `canonical`, `title` and `description`, Open Graph, JSON-LD structured data (`WebApplication`), `sitemap.xml`, `robots.txt` (the sitemap is also submitted in Search Console, since the `robots.txt` of a subfolder is not read).
- Text content is in the static HTML, not injected by JavaScript.
- Paths work on GitHub Pages under the `/loopcube/` subfolder.

## 8. Technical constraints

- **Performance**:
  - loading: aim for 95+ on PageSpeed mobile; the 3D library is deferred so it does not hurt LCP;
  - use: smooth 3D on mobile, on-demand rendering (no idle render loop), geometry recomputed at most once per frame while a slider moves.
- A **pure geometry module** (no DOM, no 3D), single source for the 3D view and the plan, covered by unit tests.
- i18n: all strings in per-language files; unit formatting in one place.

## 9. Audience measurement

- [Umami](https://umami.is/), self-hosted: no cookie, no personal data, so no consent banner. A line in the footer says so.
- Page views, plus a few events on how the tool is used: first setting changed, plan printed (unit, shape, profile), view options, contact, share, outbound links. Never the dimensions entered: they stay in the browser, as the footer promises.
- A blocked tracker never breaks the page. The list of events and their data is the `Events` type in `src/app/analytics.ts`.
