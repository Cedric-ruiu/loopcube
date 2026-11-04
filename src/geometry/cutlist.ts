import { buildLoop, type Loop } from "./loop";
import type { Design } from "./params";
import { type Part, parts, quantity } from "./parts";
import { type PieceEnds, pieceEnds } from "./pieces";
import { mitredBar } from "./shapes";
import { cyclic, sub } from "./vec";

export type SectionPart = Extract<Part, { kind: "section" }>;

export interface MitreLengths {
	/** Corner to corner, at the bar axis */
	axis: number;
	/** Tip to tip, on the outside of the corners */
	outside: number;
	/** Between the heels of the mitres, on the inside of the corners */
	inside: number;
}

export function mitreLengths(loop: Loop, index: number): MitreLengths {
	const { start, end } = mitredBar(loop, index);
	const edges = start.map((p, k) => Math.hypot(...sub(cyclic(end, k), p)));
	return {
		axis: cyclic(loop.segments, index).length,
		outside: Math.max(...edges),
		inside: Math.min(...edges),
	};
}

export interface CutItem {
	part: Part;
	quantity: number;
	/** Stock length of one piece; null for bought fittings (elbows) */
	cut: number | null;
	total: number;
}

export interface CutList {
	items: CutItem[];
	/** Stock length of the whole cube, saw kerf and offcuts not included */
	total: number;
}

function cutLength(part: Part, loop: Loop): number | null {
	switch (part.kind) {
		case "bar":
			return mitreLengths(loop, part.segments[0] ?? 0).outside;
		case "tube":
		case "section":
			return part.length;
		case "elbow":
			return null;
	}
}

export function cutList(d: Design, loop: Loop = buildLoop(d)): CutList {
	const items = parts(d, loop).map((part): CutItem => {
		const cut = cutLength(part, loop);
		return {
			part,
			quantity: quantity(part),
			cut,
			total: (cut ?? 0) * quantity(part),
		};
	});
	return { items, total: items.reduce((sum, i) => sum + i.total, 0) };
}

export interface BendMark {
	/** Distances from end 1 along the tube axis to the tangent points */
	start: number;
	end: number;
	angle: number;
	/** Tube rotation since the previous bend, in degrees; null for the first one */
	twist: number | null;
}

export interface SectionLayout {
	/** Corner to corner lengths at the tube axis, from weld to weld */
	axis: number[];
	bends: BendMark[];
	welds: { mark: string; twist: PieceEnds["twist"] }[];
}

export function sectionLayout(part: SectionPart, loop: Loop): SectionLayout {
	const [first] = part.sections;
	const arc = (Math.PI * part.radius) / 2;
	const axis = (first?.segments ?? []).map((i, k, all) => {
		const { length } = cyclic(loop.segments, i);
		return k === 0 || k === all.length - 1 ? length / 2 : length;
	});
	let at = 0;
	const bends = part.straights.slice(0, -1).map((straight, k): BendMark => {
		const start = at + straight;
		at = start + arc;
		return {
			start,
			end: at,
			angle: 90,
			twist: k === 0 ? null : (part.twists[k - 1] ?? null),
		};
	});
	const ends = pieceEnds(loop);
	const welds = part.sections.map(({ segments }, k) => ({
		mark: part.marks[k] ?? "",
		twist: cyclic(ends, segments[0] ?? 0).twist,
	}));
	return { axis, bends, welds };
}
