import {
	bend,
	bentSections,
	buildLoop,
	type CutItem,
	cubeEdges,
	cutList,
	type Design,
	envelopeBox,
	type Loop,
	midpoint,
	mitredBar,
	mitreLengths,
	type Part,
	pieceEnds,
	type SectionPart,
	type Segment,
	sectionLayout,
	straightRun,
	type Vec3,
} from "../geometry";
import { add, cross, cyclic, dot, neg, scale, sub } from "../geometry/vec";
import type { Messages } from "../i18n/fr";
import { fill } from "../i18n/template";
import {
	formatDimension,
	formatLength,
	formatSection,
	inchesToMm,
	type Unit,
} from "../units/units";
import {
	type Anchor,
	around,
	band,
	clip,
	disc,
	hull,
	type Label,
	type Placed,
	type Poly,
	placeLabels,
	box as rect,
} from "./labels";
import {
	bendRadiusOf,
	bendSamples,
	bounds2,
	hiddenLines,
	joinRuns,
	type P2,
	type Placement,
	place,
	project,
	type Solid,
	solidsOf,
	type TubeScene,
	toPaper,
	tubeItems,
	tubePaths,
	tubeWelds,
	VIEWS,
	type View,
	view,
	viewBounds,
} from "./render";
import {
	angular,
	arrow,
	BALLOON,
	balloon,
	circle,
	esc,
	line,
	linear,
	polygon,
	polyline,
	projectionSymbol,
	projectionSymbolWidth,
	radius,
	type Standard,
	text,
	textWidth,
	weldSymbol,
	weldSymbolBox,
} from "./svg";

export type PlanMessages = Pick<Messages, "plan" | "parts" | "ui">;

export interface PlanContext {
	locale: string;
	unit: Unit;
	messages: PlanMessages;
	date: Date;
}

interface Ctx extends PlanContext {
	design: Design;
	loop: Loop;
	std: Standard;
	angle: "first" | "third";
	m: PlanMessages["plan"];
	dim: (mm: number) => string;
	len: (mm: number) => string;
}

interface Block {
	height: number;
	html: string;
	scale?: string;
}

interface Page {
	sheet: string;
	scale: string;
	blocks: Block[];
}

const BODY = { x: 24, y: 14, width: 172, height: 239 };
const SERIES: Record<Standard, readonly number[]> = {
	iso: [1, 2, 5, 10, 20, 50, 100],
	asme: [1, 2, 4, 8, 16, 32, 64],
};
const OUTLINE = 0.5;

const scaleName = (pl: Placement) => `1:${Math.round(1 / pl.scale)}`;

const svg = (width: number, height: number, body: string) =>
	`<svg class="lc-drawing" viewBox="0 0 ${width} ${height}" width="${width}mm" height="${height}mm">${body}</svg>`;

/** Marks of a part: A1–A12, or C alone when its pieces are identical. */
const range = (marks: readonly string[]) => {
	const unique = [...new Set(marks)];
	return unique.length > 1
		? `${unique[0]}–${unique.at(-1)}`
		: (unique[0] ?? "");
};

const twistText = (twist: number) =>
	twist === 0 ? "0°" : `${twist > 0 ? "+" : "−"}${Math.abs(twist)}°`;

function drawParts(
	c: Ctx,
	partList: readonly Part[],
	v: View,
	pl: Placement,
	hidden = false,
): string {
	const out = [
		drawSolids(
			partList.flatMap((p) => solidsOf(p, c.loop)),
			v,
			pl,
			hidden,
		),
	];
	const r = bendRadiusOf(c.design);
	const scene: TubeScene = {
		paths: partList.flatMap((p) => tubePaths(p, c.loop, r).flat()),
		welds: partList.flatMap((p) => tubeWelds(p, c.loop)),
		radius: c.design.width / 2,
	};
	if (scene.paths.length > 0) out.push(drawTubes(scene, v, pl));
	return out.join("");
}

function drawSolids(
	solids: readonly Solid[],
	v: View,
	pl: Placement,
	hidden = false,
): string {
	if (solids.length === 0) return "";
	const edges = hiddenLines(solids, v);
	const out: string[] = [];
	if (hidden) {
		for (const [a, b] of edges.hidden)
			out.push(line(toPaper(pl, a), toPaper(pl, b), "hidden"));
	}
	for (const [a, b] of edges.visible)
		out.push(line(toPaper(pl, a), toPaper(pl, b), "thick"));
	return out.join("");
}

function drawTubes(scene: TubeScene, v: View, pl: Placement): string {
	const width = scene.radius * 2 * pl.scale;
	const out: string[] = [];
	for (const item of tubeItems(scene, v)) {
		switch (item.kind) {
			case "band": {
				// Pieces overlap, the white core further than the outline, so that
				// no seam shows where two of them meet
				const a = toPaper(pl, item.a);
				const b = toPaper(pl, item.b);
				const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
				const segment = (e: number) => {
					const u: P2 = [((b[0] - a[0]) / l) * e, ((b[1] - a[1]) / l) * e];
					return `M${(a[0] - u[0]).toFixed(2)} ${(a[1] - u[1]).toFixed(2)}L${(b[0] + u[0]).toFixed(2)} ${(b[1] + u[1]).toFixed(2)}`;
				};
				out.push(
					`<path class="tube-o" stroke-width="${(width + OUTLINE).toFixed(2)}" d="${segment(0.12)}"/>`,
					`<path class="tube-i" stroke-width="${Math.max(width - OUTLINE, 0.1).toFixed(2)}" d="${segment(0.45)}"/>`,
				);
				break;
			}
			case "curve": {
				const d = `M${item.points
					.map((p) =>
						toPaper(pl, p)
							.map((v) => v.toFixed(2))
							.join(" "),
					)
					.join("L")}`;
				out.push(
					`<path class="tube-o" stroke-width="${(width + OUTLINE).toFixed(2)}" d="${d}"/>`,
					`<path class="tube-i" stroke-width="${Math.max(width - OUTLINE, 0.1).toFixed(2)}" d="${d}"/>`,
				);
				break;
			}
			case "disc":
				out.push(
					circle(toPaper(pl, item.c), width / 2, "thick"),
					`<circle class="tube-disc" cx="${toPaper(pl, item.c)[0].toFixed(2)}" cy="${toPaper(pl, item.c)[1].toFixed(2)}" r="${(width / 2 - OUTLINE / 2).toFixed(2)}"/>`,
				);
				break;
			case "weld":
				out.push(
					polyline(
						item.points.map((p) => toPaper(pl, p)),
						"weld",
					),
				);
				break;
		}
	}
	return out.join("");
}

function envelopeCorners(loop: Loop): Vec3[] {
	const { min, max } = envelopeBox(loop);
	return [0, 1, 2, 3, 4, 5, 6, 7].map(
		(k): Vec3 => [
			k & 1 ? max[0] : min[0],
			k & 2 ? max[1] : min[1],
			k & 4 ? max[2] : min[2],
		],
	);
}

function orthoView(c: Ctx, v: View, pl: Placement, detail: boolean): string {
	const all = parts(c);
	const out = [drawParts(c, all, v, pl)];
	const b = viewBounds(v, envelopeCorners(c.loop));
	const lo = toPaper(pl, [b.min[0], b.min[1]]);
	const hi = toPaper(pl, [b.max[0], b.max[1]]);
	const edge = c.dim(c.design.edge);
	// Paper y grows downwards: lo is the bottom left corner
	out.push(linear(c.std, [lo[0], lo[1]], [hi[0], lo[1]], "x", lo[1] + 8, edge));
	out.push(linear(c.std, [lo[0], lo[1]], [lo[0], hi[1]], "y", lo[0] - 8, edge));
	if (detail) out.push(detailCircle(c, v, pl));
	return out.join("");
}

function doubledPair(c: Ctx): [Segment, Segment] | null {
	const [pair] = cubeEdges(c.loop)
		.filter((e) => e.segments.length === 2 && e.axis === 0)
		.map((e) => e.segments.map((i) => cyclic(c.loop.segments, i)))
		.sort(([a], [b]) => (b?.start[1] ?? 0) - (a?.start[1] ?? 0));
	const [a, b] = pair ?? [];
	if (!a || !b) return null;
	return a.start[1] > b.start[1] ? [a, b] : [b, a];
}

function overlapMiddle(a: Segment, b: Segment): number {
	const lo = Math.max(
		Math.min(a.start[0], a.end[0]),
		Math.min(b.start[0], b.end[0]),
	);
	const hi = Math.min(
		Math.max(a.start[0], a.end[0]),
		Math.max(b.start[0], b.end[0]),
	);
	return (lo + hi) / 2;
}

function detailCircle(c: Ctx, v: View, pl: Placement): string {
	const pair = doubledPair(c);
	if (!pair) return "";
	const [upper, lower] = pair;
	const centre = toPaper(
		pl,
		project(v, [
			overlapMiddle(upper, lower),
			(upper.start[1] + lower.start[1]) / 2,
			0,
		]),
	);
	const r = Math.max(4, (c.design.width + c.design.gap / 2) * pl.scale * 1.15);
	return [
		circle(centre, r),
		text([centre[0] + r * 0.72 + 0.8, centre[1] - r * 0.72 - 0.8], "X", {
			anchor: "start",
			size: 3.5,
			bold: true,
		}),
	].join("");
}

function sectionPath(round: boolean, [x, y]: P2, r: number): string {
	const n = (v: number) => v.toFixed(2);
	return round
		? `M${n(x - r)} ${n(y)}A${n(r)} ${n(r)} 0 1 0 ${n(x + r)} ${n(y)}A${n(r)} ${n(r)} 0 1 0 ${n(x - r)} ${n(y)}Z`
		: `M${n(x - r)} ${n(y - r)}H${n(x + r)}V${n(y + r)}H${n(x - r)}Z`;
}

/**
 * Cut tube: a thin wall is blackened (ISO 128-50), a thick one hatched at
 * 45°, a solid bar hatched all over.
 */
function cutSection(
	round: boolean,
	centre: P2,
	half: number,
	wall: number,
	id: string,
): string {
	const bore = half - wall;
	const d =
		sectionPath(round, centre, half) +
		(bore > 0 ? sectionPath(round, centre, bore) : "");
	if (bore > 0 && wall < 2)
		return `<path class="fill" fill-rule="evenodd" d="${d}"/>`;
	const hatch: string[] = [];
	for (let k = -2 * half; k <= 2 * half; k += 1.5)
		hatch.push(
			line(
				[centre[0] + k - half, centre[1] + half],
				[centre[0] + k + half, centre[1] - half],
			),
		);
	return `<clipPath id="${id}"><path clip-rule="evenodd" d="${d}"/></clipPath><g clip-path="url(#${id})">${hatch.join("")}</g><path class="thick" fill-rule="evenodd" d="${d}"/>`;
}

function detailView(
	c: Ctx,
	area: Area,
): { drawing: string; scale: string } | null {
	const pair = doubledPair(c);
	if (!pair) return null;
	const v = c.angle === "first" ? VIEWS.left : VIEWS.right;
	const { width, gap, wall } = c.design;
	const round = c.design.profile.shape === "round";
	const half = width / 2;
	const x = overlapMiddle(...pair);
	const centres = pair.map((s) => project(v, [x, s.start[1], s.start[2]]));
	const bounds = bounds2(
		centres.flatMap(([u = 0, w = 0]) => [
			[u - half, w - half],
			[u + half, w + half],
		]),
	);
	const pl = place(
		bounds,
		{
			x: area.x + 9,
			y: area.y + 2,
			width: area.width - 22,
			height: area.height - 10,
		},
		SERIES[c.std],
	);
	const [u, l] = centres.map((p) => toPaper(pl, p)) as [P2, P2];
	const h = half * pl.scale;
	const t = wall * pl.scale;
	const s = l[0] >= u[0] ? 1 : -1;
	const out = [
		cutSection(round, u, h, t, "lc-cut-1"),
		cutSection(round, l, h, t, "lc-cut-2"),
	];
	const wx = round ? u[0] : u[0] - s * h;
	out.push(
		linear(
			c.std,
			[wx, u[1] - h],
			[wx, u[1] + h],
			"y",
			u[0] - s * (h + 6),
			`${round ? "Ø" : "W"} ${c.dim(width)}`,
		),
	);
	out.push(
		linear(
			c.std,
			[round ? u[0] : u[0] + s * h, u[1] + h],
			[round ? l[0] : l[0] + s * h, l[1] - h],
			"y",
			l[0] + s * (h + 6),
			`G ${c.dim(gap)}`,
		),
	);
	const ey = round ? l[1] : l[1] + h;
	out.push(
		linear(
			c.std,
			[l[0] + s * h, ey],
			[l[0] + s * (h - t), ey],
			"x",
			l[1] + h + 6,
			`e ${c.dim(wall)}`,
			s < 0,
		),
	);
	return { drawing: out.join(""), scale: scaleName(pl) };
}

interface Area {
	x: number;
	y: number;
	width: number;
	height: number;
}

const SMALL_VIEW = 40;
const CAPTION = 6.5;
/** Room for the dimensions: on the left and the gap on the right; below and above */
const DIM_ROOM = { x: 26, y: 15 };

function layout(c: Ctx) {
	const square = viewBounds(VIEWS.front, envelopeCorners(c.loop));
	const fit = place(
		square,
		{ x: 0, y: 0, width: SMALL_VIEW, height: SMALL_VIEW },
		SERIES[c.std],
	);
	const size = (square.max[0] - square.min[0]) * fit.scale;
	const cell = {
		width: Math.max(size + DIM_ROOM.x, 50),
		height: Math.max(size + DIM_ROOM.y + CAPTION, 46),
	};
	const axoHeight = BODY.height - 2 * cell.height;
	const axo: Area = {
		x: 0,
		y: 0,
		width: BODY.width,
		height: axoHeight - CAPTION,
	};
	return { fit, cell, axoHeight, axo };
}

interface Outline {
	mark: string;
	polys: Poly[];
	anchors: Anchor[];
}

const direction = (a: P2, b: P2): P2 => {
	const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
	return [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
};

/**
 * Places along a straight piece from `a` to `b` (paper, with depths) where a
 * leader may end, middle first, each across the drawn width of the piece.
 */
function spots(
	a: P2,
	b: P2,
	da: number,
	db: number,
	half: number,
	// Down to the ends: a piece may be seen only past the one in front of it
	ts = Array.from(
		{ length: 39 },
		(_, k) => 0.5 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.025,
	),
): Anchor[] {
	const axis = direction(a, b);
	return ts.map((t) => ({
		at: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
		depth: da + (db - da) * t,
		axis,
		half,
	}));
}

/**
 * Every piece of the loop as drawn in a view, and the welds between them: a
 * point on each weld seen from the viewer, with the two pieces it joins.
 */
function outlines(
	c: Ctx,
	v: View,
	pl: Placement,
): { pieces: Outline[]; welds: Anchor[] } {
	const { loop, design } = c;
	const paper = (p: Vec3) => toPaper(pl, project(v, p));
	const depth = (p: Vec3) => project(v, p)[2];
	const r = design.width / 2;
	const rho = r * pl.scale;
	const pieces: Outline[] = [];
	const bySegment: number[] = [];
	const byCorner: number[] = [];
	const bySection: { first: number; last: number; piece: number }[] = [];
	const tube = (centre: readonly Vec3[], step: number) =>
		band(centre.map(paper), centre.map(depth), rho, step);
	for (const part of parts(c)) {
		const mark = (k: number) => part.marks[k] ?? "";
		switch (part.kind) {
			case "bar":
				part.segments.forEach((i, k) => {
					const s = cyclic(loop.segments, i);
					const solid = mitredBar(loop, i);
					const a = paper(s.start);
					const b = paper(s.end);
					const axis = direction(a, b);
					const corners = [...solid.start, ...solid.end].map(paper);
					const half = Math.max(
						...corners.map((p) =>
							Math.abs((p[0] - a[0]) * axis[1] - (p[1] - a[1]) * axis[0]),
						),
					);
					const da = depth(s.start);
					const db = depth(s.end);
					bySegment[i] = pieces.length;
					pieces.push({
						mark: mark(k),
						polys: [hull(corners, { a, b, da, db })],
						anchors: spots(a, b, da, db, half),
					});
				});
				break;
			case "tube":
				part.segments.forEach((i, k) => {
					const run = straightRun(loop, i, bendRadiusOf(design));
					bySegment[i] = pieces.length;
					pieces.push({
						mark: mark(k),
						polys: tube([run.start, run.end], 1),
						anchors: spots(
							paper(run.start),
							paper(run.end),
							depth(run.start),
							depth(run.end),
							rho,
						),
					});
				});
				break;
			case "elbow":
				part.corners.forEach((corner, k) => {
					const centre = bendSamples(loop, corner, part.radius);
					const anchors = [6, 5, 7, 4, 8, 3, 9, 2, 10, 1, 11].flatMap((j) => {
						const [p, q] = [centre[j - 1], centre[j + 1]];
						return p && q
							? spots(paper(p), paper(q), depth(p), depth(q), rho, [0.5])
							: [];
					});
					byCorner[corner] = pieces.length;
					pieces.push({ mark: mark(k), polys: tube(centre, 2), anchors });
				});
				break;
			case "section":
				tubePaths(part, loop, part.radius).forEach((runs, k) => {
					const segments = part.sections[k]?.segments ?? [];
					bySection.push({
						first: segments[0] ?? 0,
						last: segments.at(-1) ?? 0,
						piece: pieces.length,
					});
					const length = (run: Vec3[]) =>
						Math.hypot(...sub(run[1] ?? [0, 0, 0], run[0] ?? [0, 0, 0]));
					const straight = runs
						.filter((run) => run.length === 2)
						.sort((a, b) => length(b) - length(a));
					pieces.push({
						mark: mark(k),
						polys: runs.flatMap((run) => tube(run, run.length === 2 ? 1 : 2)),
						anchors: straight.flatMap(([a = [0, 0, 0], b = [0, 0, 0]]) =>
							spots(paper(a), paper(b), depth(a), depth(b), rho),
						),
					});
				});
				break;
		}
	}

	const weld = (at: Vec3, pieces: number[]): Anchor => ({
		at: paper(at),
		depth: depth(at),
		pieces,
	});
	const ring = (at: Vec3, axis: Vec3): Vec3 => {
		const t = v.toward;
		const off = sub(t, scale(axis, dot(t, axis)));
		const l = Math.hypot(...off) || 1;
		return add(at, scale(off, (r * 0.6) / l));
	};
	const welds: Anchor[] = [];
	const n = loop.corners.length;
	if (design.profile.shape === "square") {
		loop.corners.forEach((corner, k) => {
			const a = cyclic(loop.segments, k - 1).dir;
			const b = cyclic(loop.segments, k).dir;
			const normal = cross(a, b);
			const face = dot(normal, v.toward) > 0 ? normal : neg(normal);
			welds.push(
				weld(add(corner, add(scale(face, r), scale(sub(a, b), 0.2 * r))), [
					bySegment[(k + n - 1) % n] ?? 0,
					bySegment[k] ?? 0,
				]),
			);
		});
	} else if (design.profile.joint === "elbow") {
		loop.corners.forEach((_, k) => {
			const b = bend(loop, k, bendRadiusOf(design));
			const elbow = byCorner[k] ?? 0;
			welds.push(
				weld(ring(b.start, cyclic(loop.segments, k - 1).dir), [
					bySegment[(k + n - 1) % n] ?? 0,
					elbow,
				]),
				weld(ring(b.end, cyclic(loop.segments, k).dir), [
					elbow,
					bySegment[k] ?? 0,
				]),
			);
		});
	} else {
		for (const section of bySection) {
			const s = cyclic(loop.segments, section.first);
			const before = bySection.find((other) => other.last === section.first);
			welds.push(
				weld(ring(midpoint(s.start, s.end), s.dir), [
					section.piece,
					before?.piece ?? section.piece,
				]),
			);
		}
	}
	return { pieces, welds };
}

function weldCount(c: Ctx): { count: number; tail: string } {
	const p = c.design.profile;
	const kind = p.shape === "square" ? "square" : p.joint;
	const count =
		kind === "square"
			? c.loop.corners.length
			: kind === "elbow"
				? 2 * c.loop.corners.length
				: bentSections(c.loop).length;
	return { count, tail: fill(c.m.weld[kind], { count }) };
}

interface AxoLabels {
	weld: Placed;
	marks: { mark: string; placed: Placed }[];
	tail: string;
}

const weldSide = (u: P2): 1 | -1 => (u[0] >= 0 ? 1 : -1);

function axoLabels(c: Ctx, area: Area, pl: Placement): AxoLabels {
	const { pieces, welds } = outlines(c, VIEWS.axo, pl);
	const { tail } = weldCount(c);
	const weld: Label = {
		pieces: [],
		anchors: welds,
		directions: [35, 45, 55, 65].flatMap((d) =>
			[d, -d, 180 - d, 180 + d].map((a) => (a * Math.PI) / 180),
		),
		body: (end, u) => {
			const b = weldSymbolBox(end, weldSide(u), tail);
			return rect(b.min, b.max);
		},
		minLength: 7,
	};
	const groups = new Map<string, number[]>();
	pieces.forEach((p, i) => {
		groups.set(p.mark, [...(groups.get(p.mark) ?? []), i]);
	});
	const balloons = [...groups.values()].map((indices): Label => {
		const lists = indices.map((i) =>
			(pieces[i]?.anchors ?? []).map((a) => ({ ...a, pieces: [i] })),
		);
		const anchors = Array.from(
			{ length: Math.max(...lists.map((l) => l.length)) },
			(_, k) => lists.flatMap((l) => (l[k] ? [l[k]] : [])),
		).flat();
		return {
			pieces: indices,
			anchors,
			directions: around(7.5),
			body: (end, u) =>
				disc([end[0] + u[0] * BALLOON, end[1] + u[1] * BALLOON], BALLOON),
			...(indices.length > 1 ? { enough: 600 } : {}),
		};
	});
	const [weldPlaced, ...placed] = placeLabels(
		pieces.map((p) => p.polys),
		[weld, ...balloons],
		{
			min: [area.x, area.y],
			max: [area.x + area.width, area.y + area.height],
		},
		c.design.width / 2,
	);
	if (!weldPlaced) throw new Error("No weld symbol");
	const marks = [...groups.keys()].map((mark, k) => {
		const p = placed[k];
		if (!p) throw new Error(`No balloon for ${mark}`);
		return { mark, placed: p };
	});
	return { weld: weldPlaced, marks, tail };
}

function axoPlacement(c: Ctx, area: Area): Placement {
	const margin = 10;
	return place(
		viewBounds(VIEWS.axo, envelopeCorners(c.loop)),
		{
			x: area.x + margin,
			y: area.y + margin,
			width: area.width - 2 * margin,
			height: area.height - 2 * margin,
		},
		null,
	);
}

function axoView(c: Ctx, area: Area): string {
	const pl = axoPlacement(c, area);
	const { weld, marks, tail } = axoLabels(c, area, pl);
	const out = [drawParts(c, parts(c), VIEWS.axo, pl)];
	out.push(weldSymbol(c.std, weld.anchor, weld.end, weldSide(weld.u), tail));
	for (const { mark, placed: m } of marks) {
		const at: P2 = [m.end[0] + m.u[0] * BALLOON, m.end[1] + m.u[1] * BALLOON];
		out.push(balloon(at, m.anchor, mark));
	}
	return out.join("");
}

function loopSequence(c: Ctx): { mark: string; id: string }[] {
	const items: { at: number; mark: string; id: string }[] = [];
	for (const part of parts(c)) {
		const add = (at: number, k: number) =>
			items.push({ at, mark: part.marks[k] ?? "", id: part.id });
		switch (part.kind) {
			case "bar":
			case "tube":
				for (const [k, i] of part.segments.entries()) add(i + 0.5, k);
				break;
			case "elbow":
				for (const [k, i] of part.corners.entries()) add(i, k);
				break;
			case "section":
				for (const [k, s] of part.sections.entries())
					add((s.segments[0] ?? 0) + 0.5, k);
				break;
		}
	}
	items.sort((a, b) => a.at - b.at);
	const start = Math.max(
		0,
		items.findIndex((i) => i.mark === parts(c)[0]?.marks[0]),
	);
	return [...items.slice(start), ...items.slice(0, start)];
}

/** Shortest run of part types that repeats all around the loop, if any. */
export function pattern(
	ids: readonly string[],
): { count: number; run: string[] } | null {
	const n = ids.length;
	for (let p = 1; p < n; p++) {
		if (n % p === 0 && ids.every((id, k) => id === ids[(k + p) % n])) {
			return { count: n / p, run: ids.slice(0, p) };
		}
	}
	return null;
}

function sequenceHtml(c: Ctx): string {
	const m = c.m.sequence;
	const items = loopSequence(c);
	const chain = [...items, items[0]].map((i) => i?.mark ?? "").join("\u00a0→ ");
	const repeat = pattern(items.map((i) => i.id));
	const motif = repeat
		? `${repeat.count} × ${repeat.run.length > 1 ? `(${repeat.run.join(", ")})` : repeat.run[0]}`
		: "";
	const elbows = parts(c).find((p) => p.kind === "elbow");
	const same = elbows
		? fill(c.m.elbows, { mark: elbows.id, count: elbows.marks.length })
		: "";
	return `<h3>${esc(m.title)}</h3><p class="lc-chain">${esc(chain)}</p>${motif ? `<p>${esc(m.pattern)} <b class="lc-nowrap">${esc(motif)}</b></p>` : ""}${same ? `<p>${esc(same)}</p>` : ""}<p class="lc-note">${esc(m.note)}</p>`;
}

function sequenceHeight(c: Ctx, width: number): number {
	const lines = (content: string, size: number, wider = 1) =>
		Math.ceil((textWidth(content, size) * wider) / (width - 4));
	const items = loopSequence(c);
	const chain = [...items, items[0]].map((i) => i?.mark ?? "").join(" → ");
	const elbows = parts(c).some((p) => p.kind === "elbow");
	return (
		2 +
		4.75 +
		lines(chain, 2.8) * 4.2 +
		1.5 +
		(lines(c.m.sequence.pattern, 2.8) + 1) * 3.5 +
		1.5 +
		(elbows ? 2 * 3.5 + 1.5 : 0) +
		lines(c.m.sequence.note, 2.5) * 3.125 +
		1.5
	);
}

function overview(c: Ctx): Page {
	const first = c.angle === "first";
	// Detail X next to the side view, which sees the bars as it does
	const cells = first
		? { front: [0, 0], side: [1, 0], top: [0, 1], detail: [1, 1] }
		: { top: [0, 0], detail: [1, 0], front: [0, 1], side: [1, 1] };
	const side = first ? VIEWS.left : VIEWS.right;
	const sideName = first ? c.m.views.left : c.m.views.right;
	const corners = envelopeCorners(c.loop);
	const { fit, cell, axoHeight, axo } = layout(c);
	const box = ([col = 0, row = 0]: number[]) => ({
		x: col * cell.width,
		y: axoHeight + row * cell.height,
		width: cell.width,
		height: cell.height - CAPTION,
	});
	const at = (spot: number[]): Placement => {
		const b = box(spot);
		return {
			scale: fit.scale,
			origin: [b.x + b.width / 2, b.y + b.height / 2 - 1.5],
		};
	};
	const caption = (x: number, y: number, content: string) =>
		text([x, y], content, { size: 2.8, bold: true });
	const cellCaption = (at: number[], content: string) => {
		const b = box(at);
		return caption(b.x + b.width / 2, b.y + cell.height - 3, content);
	};
	const sequence = { x: 2 * cell.width, y: axoHeight };
	const column = BODY.width - sequence.x;
	const below = axoHeight + sequenceHeight(c, column);
	const diagonal = place(
		viewBounds(VIEWS.diagonal, corners),
		{
			x: sequence.x + 6,
			y: below + 2,
			width: column - 12,
			height: BODY.height - below - CAPTION - 4,
		},
		null,
	);
	const detail = detailView(c, box(cells.detail));
	const body = [
		axoView(c, axo),
		caption(
			BODY.width / 2,
			axoHeight - 3,
			`${c.m.views.axo} (${c.m.notToScale})`,
		),
		orthoView(c, VIEWS.front, at(cells.front), true),
		cellCaption(cells.front, c.m.views.front),
		orthoView(c, VIEWS.top, at(cells.top), false),
		cellCaption(cells.top, c.m.views.top),
		orthoView(c, side, at(cells.side), false),
		cellCaption(cells.side, sideName),
		`<g class="lc-light">${drawParts(c, parts(c), VIEWS.diagonal, diagonal)}</g>`,
		caption(
			sequence.x + column / 2,
			BODY.height - 3,
			`${c.m.views.diagonal} (${c.m.notToScale})`,
		),
		...(detail
			? [
					detail.drawing,
					cellCaption(cells.detail, fill(c.m.detail, { scale: detail.scale })),
				]
			: []),
		line([0, axoHeight], [BODY.width, axoHeight], "thin"),
		line([sequence.x, axoHeight], [sequence.x, BODY.height], "thin"),
	].join("");
	const html = `<div class="lc-overview">${svg(BODY.width, BODY.height, body)}<div class="lc-sequence" style="left:${sequence.x}mm;top:${sequence.y}mm;width:${column}mm">${sequenceHtml(c)}</div></div>`;
	return {
		sheet: c.m.sheets.overview,
		scale: scaleName(fit),
		blocks: [{ height: BODY.height, html }],
	};
}

function designation(c: Ctx, part: Part): string {
	const m = c.messages.parts;
	switch (part.kind) {
		case "bar":
			return m.bar[
				part.relation === "twisted"
					? part.chirality > 0
						? "right"
						: "left"
					: part.relation
			];
		case "tube":
			return m.tube;
		case "elbow":
			return m.elbow;
		case "section":
			return fill(m.section, { bends: part.straights.length - 1 });
	}
}

function stock(c: Ctx): string {
	const d = c.design;
	const shape = d.profile.shape;
	return `${c.messages.ui.shapes[shape]} ${formatSection(shape, d.width, d.wall, c.unit, c.locale)}`;
}

function bom(c: Ctx, list: ReturnType<typeof cutList>): Block {
	const m = c.m.bom;
	const rows = list.items.map((item) => {
		const { part } = item;
		const designationText =
			part.kind === "elbow"
				? `${designation(c, part)}, ${fill(c.messages.parts.radius, { radius: c.len(part.radius) })} (${m.bought})`
				: designation(c, part);
		return `<tr><td class="c"><b>${part.id}</b></td><td class="c">${item.quantity}</td><td>${esc(designationText)}</td><td>${esc(stock(c))}</td><td>${range(part.marks)}</td><td class="r">${item.cut === null ? "—" : esc(c.len(item.cut))}</td><td class="r">${item.cut === null ? "—" : esc(c.len(item.total))}</td></tr>`;
	});
	const notes = [
		c.m.unitNote[c.unit],
		c.m.notes.symbols,
		...(c.design.profile.shape === "round" ? [c.m.notes.radius] : []),
		c.design.profile.shape === "square"
			? c.m.notes.square
			: c.design.profile.joint === "elbow"
				? c.m.notes.elbow
				: fill(c.m.notes.bent, { count: list.items[0]?.quantity ?? 0 }),
		c.design.profile.shape === "round" && c.design.profile.joint === "bent"
			? fill(c.m.notes.closureBent, {
					count: weldCount(c).count,
					bends: c.loop.corners.length,
				})
			: fill(c.m.notes.closure, { count: weldCount(c).count }),
		c.m.notes.flush,
		c.m.notes.marks,
	];
	const height = 16 + rows.length * 9 + 9 + 8 + notes.length * 6.5;
	const html = `<div class="lc-bom" style="height:${height}mm">
<h2>${esc(c.m.sheets.bom)}</h2>
<table><thead><tr><th>${m.mark}</th><th>${m.qty}</th><th>${esc(m.designation)}</th><th>${esc(m.stock)}</th><th>${esc(m.pieces)}</th><th>${esc(m.cut)}</th><th>${esc(m.total)}</th></tr></thead>
<tbody>${rows.join("")}</tbody>
<tfoot><tr><td colspan="6">${esc(m.material)}<small>${esc(m.materialNote)}</small></td><td class="r"><b>${esc(c.len(list.total))}</b></td></tr></tfoot></table>
<h3>${esc(c.m.notes.title)}</h3><ol>${notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ol></div>`;
	return { height, html };
}

const facts = (rows: [string, string][]) =>
	`<dl class="lc-facts">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>`;

function card(
	c: Ctx,
	item: CutItem,
	pl: Placement | null,
	drawing: string,
	rows: [string, string][],
	note = "",
	aside = "",
): string {
	const heading = fill(c.m.card.heading, {
		id: item.part.id,
		qty: item.quantity,
		designation: designation(c, item.part),
	});
	const scale = pl
		? `<span>${esc(fill(c.m.scaleLabel, { scale: scaleName(pl) }))}</span>`
		: "";
	const body = aside
		? `<div class="lc-split">${facts(rows)}${aside}</div>`
		: facts(rows);
	return `<h2>${esc(heading)}${scale}</h2>${drawing}${body}${note ? `<p class="lc-note">${esc(note)}</p>` : ""}`;
}

const noteHeight = (note: string) =>
	Math.ceil(textWidth(note, 2.5) / 168) * 3.2 + 1.5;

const endScale = (c: Ctx, size: number) =>
	place(
		{ min: [0, 0], max: [size, size] },
		{ x: 0, y: 0, width: 32, height: 32 },
		SERIES[c.std],
	);

const cardBlock = (
	height: number,
	html: string,
	pl: Placement | null,
): Block => ({
	height,
	html: `<article class="lc-card" style="height:${height}mm">${html}</article>`,
	...(pl ? { scale: scaleName(pl) } : {}),
});

/**
 * Where the text of an angle at `c` (paper radians, `from` to `to`) can go
 * clear of `lines`: along the bisector, out of the arc, the nearest first.
 */
function angleText(
	c: P2,
	from: number,
	to: number,
	label: string,
	lines: readonly [P2, P2][],
	radii = [12, 10, 14, 8, 16, 7, 18],
): { radius: number; at: P2 } | null {
	const mid = (from + to) / 2;
	const w = textWidth(label) + 0.8;
	const arc = (r: number) =>
		Array.from({ length: 9 }, (_, k): P2 => {
			const t = from + ((to - from) * k) / 8;
			return [c[0] + r * Math.cos(t), c[1] + r * Math.sin(t)];
		});
	for (const r of radii)
		for (const d of [2.4, 3.6, 5])
			for (const turn of [0, -0.25, 0.25]) {
				const t = mid + turn * Math.abs(to - from);
				const centre: P2 = [
					c[0] + (r + d) * Math.cos(t),
					c[1] + (r + d) * Math.sin(t),
				];
				const box = rect(
					[centre[0] - w / 2, centre[1] - 1.6],
					[centre[0] + w / 2, centre[1] + 1.6],
				);
				const points = arc(r);
				const near = [
					...lines,
					...points.slice(1).map((p, k): [P2, P2] => [points[k] ?? p, p]),
				];
				if (near.every(([a, b]) => !clip(a, b, box, 0.3)))
					return { radius: r, at: [centre[0], centre[1] + 0.9] };
			}
	return null;
}

function barCard(c: Ctx, item: CutItem): Block {
	const part = item.part;
	if (part.kind !== "bar") throw new Error("Not a bar");
	const { loop, design } = c;
	const index = part.segments[0] ?? 0;
	const s = loop.segments[index];
	const ends = pieceEnds(loop)[index];
	if (!s || !ends) throw new RangeError(`No segment ${index}`);
	const lengths = mitreLengths(loop, index);
	const solid = mitredBar(loop, index);
	const front = view(s.dir, ends.startArm);
	const top = view(s.dir, neg(front.toward));
	const fromEnd1 = view(front.toward, ends.startArm);

	const W = 172;
	const points = [...solid.start, ...solid.end];
	const fb = viewBounds(front, points);
	const fit = place(
		fb,
		{ x: 0, y: 0, width: W - 24, height: 14 },
		SERIES[c.std],
	);
	// Two stacked dimensions above the front view and one below it; the top
	// view under the front view (first angle) or over it (third angle)
	const h = (fb.max[1] - fb.min[1]) * fit.scale;
	const first = c.angle === "first";
	const frontTop = first ? 15 : h + 17;
	const topTop = first ? frontTop + h + 9.5 : 2;
	const H = first ? topTop + h + 1 : frontTop + h + 9.5;
	const fpl: Placement = {
		scale: fit.scale,
		origin: [
			W / 2 - ((fb.min[0] + fb.max[0]) / 2) * fit.scale,
			frontTop + h / 2 + ((fb.min[1] + fb.max[1]) / 2) * fit.scale,
		],
	};
	const tb = viewBounds(top, points);
	const tpl: Placement = {
		scale: fit.scale,
		origin: [
			fpl.origin[0],
			topTop + h / 2 + ((tb.min[1] + tb.max[1]) / 2) * fit.scale,
		],
	};

	const out: string[] = [];
	out.push(drawSolids([solid], front, fpl, true));
	out.push(drawSolids([solid], top, tpl, true));

	const fp = (p: Vec3) => toPaper(fpl, project(front, p));
	const corners = points.map(fp);
	const xs = corners.map((p) => p[0]);
	const ys = corners.map((p) => p[1]);
	const left = Math.min(...xs);
	const rightX = Math.max(...xs);
	const topY = Math.min(...ys);
	const bottomY = Math.max(...ys);
	const inside = solid.start
		.map((p, k) => ({
			a: fp(p),
			b: fp(solid.end[k] ?? p),
			length: Math.hypot(...(solid.end[k] ?? p).map((v, i) => v - (p[i] ?? 0))),
		}))
		.sort((a, b) => a.length - b.length)[0];
	const axisA = fp(s.start);
	const axisB = fp(s.end);
	out.push(line([left - 2, axisA[1]], [rightX + 2, axisA[1]], "center"));
	out.push(
		linear(
			c.std,
			[left, bottomY],
			[rightX, bottomY],
			"x",
			bottomY + 7,
			c.dim(lengths.outside),
		),
	);
	// The cut length is the dimension to work to; the others are auxiliary
	if (inside)
		out.push(
			linear(
				c.std,
				inside.a,
				inside.b,
				"x",
				topY - 5,
				`(${c.dim(lengths.inside)})`,
			),
		);
	out.push(
		linear(c.std, axisA, axisB, "x", topY - 11, `(L ${c.dim(lengths.axis)})`),
	);
	const heel = corners
		.filter((p) => Math.abs(p[1] - topY) < 1e-6)
		.sort((a, b) => a[0] - b[0])[0];
	if (heel) {
		const tip: P2 = [left, bottomY];
		const from = Math.atan2(heel[1] - tip[1], heel[0] - tip[0]);
		const edges = hiddenLines([solid], front);
		const drawn: [P2, P2][] = [
			...[...edges.visible, ...edges.hidden].map(([a, b]): [P2, P2] => [
				toPaper(fpl, a),
				toPaper(fpl, b),
			]),
			[
				[left - 2, axisA[1]],
				[rightX + 2, axisA[1]],
			],
			[axisA, [axisA[0], topY - 12.5]],
			...(inside ? [[inside.a, [inside.a[0], topY - 6.5]] as [P2, P2]] : []),
		];
		const place45 = angleText(tip, from, 0, "45°", drawn);
		out.push(
			angular(
				tip,
				place45?.radius ?? Math.max(10, (bottomY - topY) * 1.2),
				from,
				0,
				"45°",
				place45?.at,
			),
		);
	}
	out.push(
		text([left - 1.5, axisA[1] + 1], "1", { anchor: "end", bold: true }),
		text([rightX + 1.5, axisA[1] + 1], "2", { anchor: "start", bold: true }),
	);

	const eb = viewBounds(fromEnd1, points);
	const efit = endScale(c, design.width);
	const half = (design.width / 2) * efit.scale;
	const EW = 52;
	const EH = 2 * half + 23;
	const center: P2 = [EW / 2, half + 11];
	const [sx, sy] = project(fromEnd1, s.start);
	const epl: Placement = {
		scale: efit.scale,
		origin: [center[0] - sx * efit.scale, center[1] + sy * efit.scale],
	};
	const end: string[] = [drawSolids([solid], fromEnd1, epl, true)];
	const bore = (design.width / 2 - design.wall) * efit.scale;
	if (bore > 0)
		end.push(
			polygon(
				[
					[center[0] - bore, center[1] - bore],
					[center[0] + bore, center[1] - bore],
					[center[0] + bore, center[1] + bore],
					[center[0] - bore, center[1] + bore],
				],
				"thick",
			),
		);
	const reach = half + 3.5;
	const arms = [ends.startArm, ends.endArm].map((arm) => {
		const [x, y] = project(fromEnd1, arm);
		return Math.atan2(-y, x);
	});
	const same = Math.abs((arms[0] ?? 0) - (arms[1] ?? 0)) < 1e-6;
	arms.forEach((angle, k) => {
		const shift = same ? (k === 0 ? -1.6 : 1.6) : 0;
		const normal: P2 = [-Math.sin(angle) * shift, Math.cos(angle) * shift];
		const from: P2 = [center[0] + normal[0], center[1] + normal[1]];
		const tipP: P2 = [
			from[0] + Math.cos(angle) * reach,
			from[1] + Math.sin(angle) * reach,
		];
		end.push(
			line(from, tipP, "thick"),
			arrow(tipP, [Math.cos(angle), Math.sin(angle)]),
			text(
				[
					tipP[0] + Math.cos(angle) * 2 + normal[0],
					tipP[1] + Math.sin(angle) * 2 + 0.9 + normal[1],
				],
				String(k + 1),
				{ bold: true },
			),
		);
	});
	if (!same) {
		const [a0 = 0, a1 = 0] = arms;
		const delta = Math.atan2(Math.sin(a1 - a0), Math.cos(a1 - a0));
		const label = `${Math.abs(Math.round((delta * 180) / Math.PI))}°`;
		const square = (r: number): [P2, P2][] =>
			[
				[-r, -r],
				[r, -r],
				[r, r],
				[-r, r],
			].map(([x = 0, y = 0], k, all): [P2, P2] => {
				const [nx = 0, ny = 0] = all[(k + 1) % 4] ?? [];
				return [
					[center[0] + x, center[1] + y],
					[center[0] + nx, center[1] + ny],
				];
			});
		const drawn = [
			...square(half),
			...(bore > 0 ? square(bore) : []),
			...arms.map((a): [P2, P2] => [
				center,
				[
					center[0] + Math.cos(a) * (reach + 4),
					center[1] + Math.sin(a) * (reach + 4),
				],
			]),
		];
		const spot = angleText(center, a0, a0 + delta, label, drawn, [
			half + 2.5,
			half + 4,
			half * 1.45,
			half + 7,
		]);
		end.push(
			angular(
				center,
				spot?.radius ?? half + 2.5,
				a0,
				a0 + delta,
				label,
				spot?.at,
			),
		);
	}
	const eLo = toPaper(epl, [eb.min[0], eb.min[1]]);
	const eHi = toPaper(epl, [eb.max[0], eb.max[1]]);
	const towards = (side: number) => arms.some((a) => Math.cos(a - side) > 0.5);
	const label = `W ${c.dim(design.width)}`;
	if (!towards(Math.PI / 2))
		end.push(
			linear(c.std, [eLo[0], eLo[1]], [eHi[0], eLo[1]], "x", eLo[1] + 7, label),
		);
	else if (!towards(0))
		end.push(
			linear(c.std, [eHi[0], eHi[1]], [eHi[0], eLo[1]], "y", eHi[0] + 7, label),
		);
	else
		end.push(
			linear(c.std, [eLo[0], eHi[1]], [eLo[0], eLo[1]], "y", eLo[0] - 7, label),
		);
	end.push(
		text([EW / 2, 2.6], c.m.bar.endView, { size: 2.2, bold: true }),
		text([EW / 2, EH - 0.8], fill(c.m.scaleLabel, { scale: scaleName(efit) }), {
			size: 2.5,
		}),
	);

	const ending =
		part.relation === "twisted"
			? part.chirality > 0
				? "right"
				: "left"
			: part.relation;
	const rows: [string, string][] = [
		[c.m.bar.outside, c.len(lengths.outside)],
		[c.m.bar.axis, `(${c.len(lengths.axis)})`],
		[c.m.bar.inside, `(${c.len(lengths.inside)})`],
		[c.m.bar.mitres, c.m.bar.mitreValue],
		[c.m.bar.orientation, c.m.bar.orientations[ending]],
		[c.m.card.stock, stock(c)],
		[c.m.card.piece, range(part.marks)],
	];
	const note = `${c.m.bar.endViewNote} ${c.m.auxiliary}`;
	return cardBlock(
		6 + H + 1.5 + Math.max(rows.length * 5, EH) + noteHeight(note),
		card(
			c,
			item,
			fit,
			svg(W, H, out.join("")),
			rows,
			note,
			svg(EW, EH, end.join("")),
		),
		fit,
	);
}

function tubeCard(c: Ctx, item: CutItem): Block {
	const part = item.part;
	if (part.kind !== "tube") throw new Error("Not a tube");
	const index = part.segments[0] ?? 0;
	const s = c.loop.segments[index];
	const ends = pieceEnds(c.loop)[index];
	if (!s || !ends) throw new RangeError(`No segment ${index}`);
	const [runs] = tubePaths(part, c.loop, bendRadiusOf(c.design));
	if (!runs) throw new Error("No tube");
	const path = joinRuns(runs);
	const v = view(s.dir, ends.startArm);
	const r = c.design.width / 2;
	const efit = endScale(c, c.design.width);
	const eh = r * efit.scale;
	const W = 172;
	const H = 2 * eh + 25;
	const endWidth = Math.max(44, 2 * eh + 18);
	const viewsX = c.angle === "first" ? 0 : endWidth;
	const endX = c.angle === "first" ? W - endWidth : 0;
	const center: P2 = [endX + endWidth / 2, eh + 12];
	const b = viewBounds(v, path);
	const bb = {
		min: [b.min[0], b.min[1] - r] as P2,
		max: [b.max[0], b.max[1] + r] as P2,
	};
	const pl = place(
		bb,
		{
			x: viewsX + 12,
			y: center[1] - 8,
			width: W - endWidth - 30,
			height: 16,
		},
		SERIES[c.std],
	);
	const out = [drawTubes({ paths: [path], welds: [], radius: r }, v, pl)];
	const [a3, b3] = [
		project(v, path[0] ?? s.start),
		project(v, path.at(-1) ?? s.end),
	];
	const a = toPaper(pl, a3);
	const e = toPaper(pl, b3);
	const half = r * pl.scale;
	out.push(
		line([a[0], a[1] - half], [a[0], a[1] + half], "thick"),
		line([e[0], e[1] - half], [e[0], e[1] + half], "thick"),
	);
	out.push(line([a[0] - 2, a[1]], [e[0] + 2, e[1]], "center"));
	out.push(
		linear(
			c.std,
			[a[0], a[1] + half],
			[e[0], e[1] + half],
			"x",
			a[1] + half + 7,
			c.dim(part.length),
		),
	);
	const bore = (r - c.design.wall) * efit.scale;
	out.push(
		circle(center, eh, "thick"),
		...(bore > 0 ? [circle(center, bore, "thick")] : []),
		line(
			[center[0] - eh - 1.5, center[1]],
			[center[0] + eh + 1.5, center[1]],
			"center",
		),
		line(
			[center[0], center[1] - eh - 1.5],
			[center[0], center[1] + eh + 1.5],
			"center",
		),
		linear(
			c.std,
			[center[0] - eh, center[1] + eh],
			[center[0] + eh, center[1] + eh],
			"x",
			center[1] + eh + 7,
			`Ø ${c.dim(c.design.width)}`,
		),
		text([center[0], 2.6], c.m.tube.endView, { size: 2.2, bold: true }),
		text([center[0], H - 1], fill(c.m.scaleLabel, { scale: scaleName(efit) }), {
			size: 2.5,
		}),
	);
	const rows: [string, string][] = [
		[c.m.tube.cut, c.len(part.length)],
		[c.m.tube.ends, "90°"],
		[c.m.card.stock, stock(c)],
		[c.m.card.piece, range(part.marks)],
	];
	return cardBlock(
		6 + H + 1.5 + 2 * 5 + 2,
		card(c, item, pl, svg(W, H, out.join("")), rows),
		pl,
	);
}

function elbowCard(c: Ctx, item: CutItem): Block {
	const part = item.part;
	if (part.kind !== "elbow") throw new Error("Not an elbow");
	const corner = part.corners[0] ?? 0;
	const b = bend(c.loop, corner, part.radius);
	const v = view(b.from, b.to);
	const r = c.design.width / 2;
	const path = bendSamples(c.loop, corner, part.radius);
	const W = 172;
	const H = 62;
	const pts = [b.center, ...path];
	const vb = viewBounds(v, pts);
	const bb = {
		min: [vb.min[0] - r, vb.min[1] - r] as P2,
		max: [vb.max[0] + r, vb.max[1] + r] as P2,
	};
	const pl = place(
		bb,
		{ x: 30, y: 6, width: W - 90, height: H - 18 },
		SERIES[c.std],
	);
	const out = [
		drawTubes(
			{
				paths: [path],
				welds: tubeWelds({ ...part, corners: [corner] }, c.loop),
				radius: r,
			},
			v,
			pl,
		),
	];
	const paper = (p: Vec3) => toPaper(pl, project(v, p));
	out.push(polyline(path.map(paper), "center"));
	const center = paper(b.center);
	const start = paper(b.start);
	const end = paper(b.end);
	out.push(line(center, start, "center"), line(center, end, "center"));
	out.push(
		angular(
			center,
			part.radius * pl.scale * 0.35,
			Math.atan2(end[1] - center[1], end[0] - center[0]),
			Math.atan2(start[1] - center[1], start[0] - center[0]),
			"90°",
		),
	);
	out.push(
		radius(
			center,
			part.radius * pl.scale,
			-Math.PI / 4,
			`R ${c.dim(part.radius)}`,
		),
	);
	const half = r * pl.scale;
	out.push(
		linear(
			c.std,
			[start[0] - half, start[1]],
			[start[0] + half, start[1]],
			"x",
			start[1] + 8,
			`Ø ${c.dim(c.design.width)}`,
		),
	);
	const rows: [string, string][] = [
		[c.m.elbow.radius, c.len(part.radius)],
		[c.m.elbow.diameter, c.len(c.design.width)],
		[c.m.elbow.angle, "90°"],
		[c.m.card.stock, stock(c)],
		[c.m.card.piece, range(part.marks)],
	];
	return cardBlock(
		98,
		card(
			c,
			item,
			pl,
			svg(W, H, out.join("")),
			rows,
			`${c.m.elbow.kind} ${fill(c.m.elbows, { mark: part.id, count: part.marks.length })}`,
		),
		pl,
	);
}

function sectionCard(c: Ctx, item: CutItem): Block {
	const part = item.part as SectionPart;
	const { loop, design } = c;
	const layout = sectionLayout(part, loop);
	const [first] = part.sections;
	const [runs] = tubePaths(part, loop, part.radius);
	if (!first || !runs) throw new Error("No section");
	const path = joinRuns(runs);
	const seg = (k: number) => {
		const s = loop.segments[first.segments[k] ?? 0];
		if (!s) throw new RangeError("No segment");
		return s;
	};
	const v = view(seg(0).dir, seg(1).dir);
	const r = design.width / 2;
	const W = 172;
	const shapeH = 118;
	const vb = viewBounds(v, path);
	const bb = {
		min: [vb.min[0] - r, vb.min[1] - r] as P2,
		max: [vb.max[0] + r, vb.max[1] + r] as P2,
	};
	const pl = place(
		bb,
		{ x: 18, y: 12, width: W - 36, height: shapeH - 26 },
		SERIES[c.std],
	);
	const paper = (p: Vec3) => toPaper(pl, project(v, p));
	const welds = [
		{ at: path[0] ?? seg(0).start, axis: seg(0).dir },
		{ at: path.at(-1) ?? seg(3).end, axis: seg(3).dir },
	];
	const shape: string[] = [drawTubes({ paths: runs, welds, radius: r }, v, pl)];
	shape.push(polyline(path.map(paper), "center"));
	const half = r * pl.scale;
	// Weld, corners, weld: the dimensions are taken at the tube axis
	const nodes = [
		path[0] ?? seg(0).start,
		seg(1).start,
		seg(2).start,
		seg(3).start,
		path.at(-1) ?? seg(3).end,
	].map(paper);
	const [n0, n1, n2, n3, n4] = nodes as [P2, P2, P2, P2, P2];
	const [l0 = 0, l1 = 0, l2 = 0, l3 = 0] = layout.axis;
	const ys = nodes.map((p) => p[1]);
	const xs = nodes.map((p) => p[0]);
	const below = Math.max(...ys) + half + 7;
	const above = Math.min(...ys) - half - 7;
	const rightX = Math.max(...xs) + half + 7;
	const leftX = Math.min(...xs) - half - 7;
	const dimFor = (a: P2, b: P2, value: number) => {
		const horizontal = Math.abs(a[1] - b[1]) < Math.abs(a[0] - b[0]);
		const mid = horizontal ? (a[1] + b[1]) / 2 : (a[0] + b[0]) / 2;
		if (horizontal) {
			const at =
				Math.abs(mid - Math.max(...ys)) < Math.abs(mid - Math.min(...ys))
					? below
					: above;
			return linear(c.std, a, b, "x", at, c.dim(value));
		}
		const at =
			Math.abs(mid - Math.max(...xs)) < Math.abs(mid - Math.min(...xs))
				? rightX
				: leftX;
		return linear(c.std, a, b, "y", at, c.dim(value));
	};
	shape.push(
		dimFor(n0, n1, l0),
		dimFor(n1, n2, l1),
		dimFor(n2, n3, l2),
		dimFor(n3, n4, l3),
	);
	const bends = [1, 2, 3].map((k) =>
		bend(loop, first.segments[k] ?? 0, part.radius),
	);
	const middle = bends[1];
	if (middle) {
		const cc = paper(middle.center);
		const corner = paper(seg(2).start);
		const mid = Math.atan2(corner[1] - cc[1], corner[0] - cc[0]);
		const angle = [mid - 0.6, mid + 0.6].sort(
			(a, b) => Math.abs(Math.cos(b)) - Math.abs(Math.cos(a)),
		)[0];
		shape.push(
			radius(
				cc,
				part.radius * pl.scale,
				angle ?? mid,
				`${layout.bends.length} × R ${c.dim(part.radius)}`,
			),
		);
	}
	bends.forEach((b, k) => {
		const corner = paper(seg(k + 1).start);
		const cc = paper(b.center);
		const d = Math.hypot(corner[0] - cc[0], corner[1] - cc[1]) || 1;
		const out = 3.5;
		shape.push(
			text(
				[
					corner[0] +
						((corner[0] - cc[0]) / d) * (half + out) -
						((corner[1] - cc[1]) / d) * 0,
					corner[1] + ((corner[1] - cc[1]) / d) * (half + out) + 1,
				],
				`C${k + 1}`,
				{ bold: true, size: 2.8 },
			),
		);
	});
	for (const [end, before, n] of [
		[n0, n1, 1],
		[n4, n3, 2],
	] as const) {
		const d = Math.hypot(end[0] - before[0], end[1] - before[1]) || 1;
		const u: P2 = [(end[0] - before[0]) / d, (end[1] - before[1]) / d];
		const horizontal = Math.abs(u[0]) > Math.abs(u[1]);
		shape.push(
			text(
				[
					end[0] + u[0] * 2,
					end[1] + u[1] * 4 + (horizontal ? 0.9 : u[1] > 0 ? 1.5 : 0),
				],
				fill(c.m.card.end, { n }),
				{
					size: 2.4,
					bold: true,
					anchor: horizontal ? (u[0] > 0 ? "start" : "end") : "middle",
				},
			),
		);
	}
	shape.push(
		text([2, 4], c.m.section.shape, { anchor: "start", size: 2.6, bold: true }),
	);

	const devH = 42;
	const total = part.length;
	const dpl = place(
		{ min: [0, -r], max: [total, r] },
		{ x: 12, y: 17, width: W - 30, height: 6 },
		null,
	);
	const dx = (mm: number) => dpl.origin[0] + mm * dpl.scale;
	const y0 = dpl.origin[1];
	const bandH = Math.max(design.width * dpl.scale, 2);
	const dev: string[] = [
		text([2, 4], `${c.m.section.unrolled} (${c.m.unrolledScale})`, {
			anchor: "start",
			size: 2.6,
			bold: true,
		}),
		`<rect class="thick" x="${dx(0).toFixed(2)}" y="${(y0 - bandH / 2).toFixed(2)}" width="${(total * dpl.scale).toFixed(2)}" height="${bandH.toFixed(2)}"/>`,
		line([dx(0) - 2, y0], [dx(total) + 2, y0], "center"),
	];
	layout.bends.forEach((bm, k) => {
		const a = dx(bm.start);
		const e = dx(bm.end);
		dev.push(
			`<rect class="lc-bend" x="${a.toFixed(2)}" y="${(y0 - bandH / 2).toFixed(2)}" width="${(e - a).toFixed(2)}" height="${bandH.toFixed(2)}"/>`,
		);
		dev.push(
			line([a, y0 - bandH / 2], [a, y0 + bandH / 2], "thin"),
			line([e, y0 - bandH / 2], [e, y0 + bandH / 2], "thin"),
		);
		dev.push(
			text([(a + e) / 2, y0 - bandH / 2 - 1.5], `C${k + 1}`, {
				bold: true,
				size: 2.6,
			}),
		);
	});
	const stops = [0, ...layout.bends.flatMap((bm) => [bm.start, bm.end]), total];
	// Straight runs, on two staggered rows so that short ones keep their text clear
	for (let k = 0; k + 1 < stops.length; k += 2) {
		const a = stops[k] ?? 0;
		const e = stops[k + 1] ?? 0;
		dev.push(
			linear(
				c.std,
				[dx(a), y0 + bandH / 2],
				[dx(e), y0 + bandH / 2],
				"x",
				y0 + bandH / 2 + (k % 4 === 0 ? 6 : 12),
				c.dim(e - a),
			),
		);
	}
	dev.push(
		linear(
			c.std,
			[dx(0), y0 - bandH / 2],
			[dx(total), y0 - bandH / 2],
			"x",
			y0 - bandH / 2 - 7,
			c.dim(total),
		),
	);
	dev.push(
		text([dx(0) - 1.5, y0 + 0.9], "1", { anchor: "end", bold: true }),
		text([dx(total) + 1.5, y0 + 0.9], "2", { anchor: "start", bold: true }),
	);

	const ms = c.m.section;
	const bendRows = layout.bends
		.map(
			(bm, k) =>
				`<tr><td class="c"><b>C${k + 1}</b></td><td class="r">${esc(c.len(bm.start))}</td><td class="r">${esc(c.len(bm.end))}</td><td class="c">${bm.angle}°</td><td class="c">${bm.twist === null ? ms.first : twistText(bm.twist)}</td></tr>`,
		)
		.join("");
	const weldRows = layout.welds
		.map((w, k) => {
			const from =
				part.marks[(k + part.marks.length - 1) % part.marks.length] ?? "";
			return `<tr><td>${esc(fill(ms.weld, { from, to: w.mark }))}</td><td class="c">${twistText(w.twist)}</td></tr>`;
		})
		.join("");
	const tables = `<div class="lc-tables"><table><caption>${esc(ms.bends)}</caption><thead><tr><th>${esc(ms.bend)}</th><th>${esc(ms.start)}</th><th>${esc(ms.finish)}</th><th>${esc(ms.angle)}</th><th>${esc(ms.twist)}</th></tr></thead><tbody>${bendRows}</tbody></table><table><caption>${esc(ms.welds)}</caption><thead><tr><th></th><th>${esc(ms.twist)}</th></tr></thead><tbody>${weldRows}</tbody></table></div>`;
	const rows: [string, string][] = [
		[ms.developed, c.len(part.length)],
		[ms.radius, c.len(part.radius)],
		[c.m.card.stock, stock(c)],
		[c.m.card.piece, part.marks.join(" ")],
	];
	const html = card(
		c,
		item,
		pl,
		svg(W, shapeH, shape.join("")) + svg(W, devH, dev.join("")) + tables,
		rows,
		`${ms.twistNote} ${ms.grip}`,
	);
	return cardBlock(BODY.height, html, pl);
}

function cutCard(c: Ctx, item: CutItem): Block {
	switch (item.part.kind) {
		case "bar":
			return barCard(c, item);
		case "tube":
			return tubeCard(c, item);
		case "elbow":
			return elbowCard(c, item);
		case "section":
			return sectionCard(c, item);
	}
}

const partsCache = new WeakMap<Loop, Part[]>();
function parts(c: Ctx): Part[] {
	let list = partsCache.get(c.loop);
	if (!list) {
		list = cutList(c.design, c.loop).items.map((i) => i.part);
		partsCache.set(c.loop, list);
	}
	return list;
}

function paginate(c: Ctx, blocks: readonly Block[], first: string): Page[] {
	const pages: Page[] = [];
	for (const block of blocks) {
		const page = pages.at(-1);
		const used =
			page?.blocks.reduce((sum, b) => sum + b.height + 4, 0) ??
			Number.POSITIVE_INFINITY;
		if (page && used + block.height <= BODY.height) page.blocks.push(block);
		else
			pages.push({
				sheet: pages.length === 0 ? first : c.m.sheets.cutting,
				scale: "",
				blocks: [block],
			});
	}
	for (const page of pages) {
		const scales = [
			...new Set(
				page.blocks.map((b) => b.scale).filter((s) => s !== undefined),
			),
		];
		page.scale =
			scales.length === 0
				? "—"
				: scales.length === 1
					? (scales[0] ?? "")
					: c.m.asNoted;
		if (page.sheet !== c.m.sheets.cutting && page.blocks.length > 1) {
			page.sheet = `${c.m.sheets.bom} · ${c.m.sheets.cutting}`;
		}
	}
	return pages;
}

function titleBlock(c: Ctx, page: Page, number: number, count: number): string {
	const m = c.m;
	const d = c.design;
	const params = [
		fill(m.paramsLine, {
			edge: c.len(d.edge),
			section: stock(c),
			gap: c.len(d.gap),
		}),
		...(d.profile.shape === "round"
			? [
					fill(m.radiusParam, { radius: c.len(d.profile.bendRadius) }),
					c.messages.ui.joints[d.profile.joint],
				]
			: []),
	].join(" · ");
	const cell = (cls: string, label: string, value: string) =>
		`<div class="${cls}"><span>${esc(label)}</span><b>${value}</b></div>`;
	const symbolWidth = projectionSymbolWidth() + 2;
	const symbol = `<svg viewBox="0 -3.2 ${symbolWidth} 6.4" width="${symbolWidth * 0.8}mm" height="5.1mm">${projectionSymbol([1, 0], c.angle)}</svg>`;
	const date = [
		c.date.getFullYear(),
		String(c.date.getMonth() + 1).padStart(2, "0"),
		String(c.date.getDate()).padStart(2, "0"),
	].join("-");
	return `<div class="lc-block">
<div class="t-title"><b>${esc(m.title)}</b><span>${esc(m.subtitle)}</span><em>${esc(page.sheet)}</em></div>
${cell("t-params", m.block.params, esc(params))}
${cell("t-date", m.block.date, date)}
${cell("t-unit", m.block.unit, esc(m.units[c.unit]))}
${cell("t-scale", m.block.scale, esc(page.scale))}
${cell("t-page", m.block.page, `${number}/${count}`)}
${cell("t-std", m.block.standard, esc(m.standardName))}
${cell("t-tol", m.block.tolerance, esc(m.tolerance[c.unit]))}
${cell("t-proj", m.block.projection, `${symbol}${esc(m.projectionName)}`)}
</div>`;
}

/**
 * Bar of a known length in the filing margin, to check with a rule that the
 * sheet was printed at 100 %: 100 mm, or 4" on an inch drawing.
 */
function scaleCheck(c: Ctx): string {
	const inch = c.unit === "in";
	const length = inch ? inchesToMm(4) : 100;
	const step = inch ? inchesToMm(0.5) : 10;
	const major = inch ? 2 : 5;
	const ticks = Array.from(
		{ length: Math.round(length / step) + 1 },
		(_, k) => {
			const y = k * step;
			const end = k === 0 || k * step >= length - 1e-6;
			return line(
				[end ? 8.5 : 11, y],
				[k % major === 0 ? 13.5 : 12.5, y],
				end ? "thick" : "thin",
			);
		},
	);
	const label = `${c.m.printAt} · ${fill(c.m.checkBar, { length: c.len(length) })}`;
	return `<svg class="lc-drawing lc-check" viewBox="0 -1 14 ${length + 2}" width="14mm" height="${length + 2}mm" style="top:${((297 - length) / 2 - 1).toFixed(2)}mm">${line([11, 0], [11, length], "thick")}${ticks.join("")}${text([7, length / 2], label, { rotate: -90, size: 2.5, bold: true })}</svg>`;
}

const SITE_URL = "https://cedric-ruiu.github.io/loopcube/";

function credit(c: Ctx): string {
	return `<div class="lc-credit">${esc(c.m.credit)} · <a href="${SITE_URL}">${esc(SITE_URL)}</a></div>`;
}

function contextOf(design: Design, context: PlanContext): Ctx {
	const m = context.messages.plan;
	const std = m.standard;
	return {
		...context,
		design,
		loop: buildLoop(design),
		std,
		angle: std === "iso" ? "first" : "third",
		m,
		dim: (mm) => formatDimension(mm, context.unit, context.locale),
		len: (mm) => formatLength(mm, context.unit, context.locale),
	};
}

export function axoLeaders(
	design: Design,
	context: PlanContext,
): { mark: string; clear: boolean }[] {
	const c = contextOf(design, context);
	const { axo } = layout(c);
	const { weld, marks } = axoLabels(c, axo, axoPlacement(c, axo));
	return [
		{ mark: "weld", clear: weld.clear },
		...marks.map(({ mark, placed }) => ({ mark, clear: placed.clear })),
	];
}

export function planHtml(design: Design, context: PlanContext): string {
	const c = contextOf(design, context);
	const list = cutList(design, c.loop);
	const pages = [
		overview(c),
		...paginate(
			c,
			[bom(c, list), ...list.items.map((item) => cutCard(c, item))],
			c.m.sheets.bom,
		),
	];
	return pages
		.map(
			(page, i) =>
				`<section class="lc-page"><div class="lc-frame"></div><div class="lc-body">${page.blocks.map((b) => b.html).join("")}</div>${titleBlock(c, page, i + 1, pages.length)}${scaleCheck(c)}${credit(c)}</section>`,
		)
		.join("");
}
