import type { CubeParams } from "./loop";

/** Shortest straight run of material (mm) that can still be cut and welded. */
export const MIN_STRAIGHT = 10;
export const MIN_BEND_RADIUS_RATIO = 1;
export const DEFAULT_BEND_RADIUS_RATIO = 1.5;
export const DEFAULT_GAP_RATIO = 0.5;

const EPS = 1e-6;

export type Profile =
	| { shape: "square" }
	| { shape: "round"; joint: "elbow" | "bent"; bendRadius: number };

export interface Design extends CubeParams {
	/** Wall thickness; half the width means solid bar */
	wall: number;
	profile: Profile;
}

export type ParamName =
	| "edge"
	| "length"
	| "depth"
	| "width"
	| "gap"
	| "wall"
	| "bendRadius";

export type IssueCode =
	| "notPositive"
	| "wallTooThick"
	| "bendRadiusTooSmall"
	| "straightTooShort"
	| "lengthTooShort";

export interface Issue {
	code: IssueCode;
	param: ParamName;
	limit?: number;
}

/** When a ratio is set, that parameter follows the width. */
export interface Links {
	gapRatio?: number;
	bendRadiusRatio?: number;
}

export interface Range {
	min: number;
	max: number;
}

export interface Bounds {
	edge: Range;
	length?: Range;
	depth?: Range;
	width: Range;
	gap: Range;
	wall: Range;
	bendRadius?: Range;
}

export const defaultGap = (width: number): number => width * DEFAULT_GAP_RATIO;
export const defaultBendRadius = (width: number): number =>
	width * DEFAULT_BEND_RADIUS_RATIO;

export const DEFAULT_DESIGNS = {
	metric: {
		edge: 300,
		width: 25,
		gap: 12.5,
		wall: 2,
		profile: { shape: "square" },
		pattern: { kind: "cube" },
	},
	imperial: {
		edge: 304.8,
		width: 25.4,
		gap: 12.7,
		wall: 2.1082,
		profile: { shape: "square" },
		pattern: { kind: "cube" },
	},
} as const satisfies Record<string, Design>;

interface ShortRun {
	param: "edge" | "depth";
	size: number;
	widths: number;
	gaps: number;
}

/**
 * Shortest centreline run along each size, `size − widths·W − gaps·G`:
 * across the edge A, and across the depth C of a box, whose shortest bars are
 * one bar and one gap longer. A box is never shorter than deep, so its length
 * adds nothing.
 */
function shortRuns(d: CubeParams): ShortRun[] {
	const edge: ShortRun = { param: "edge", size: d.edge, widths: 3, gaps: 2 };
	return d.pattern.kind === "box"
		? [edge, { param: "depth", size: d.pattern.depth, widths: 2, gaps: 1 }]
		: [edge];
}

const runLength = (d: CubeParams, run: ShortRun): number =>
	run.size - run.widths * d.width - run.gaps * d.gap;

/**
 * Shortest straight run in the loop, the first thing to vanish when the cube
 * shrinks: inner edge of a short mitred bar, straight tube between two elbows,
 * or straight tube between a bend and the mid-bar weld of a bent section.
 */
export function shortestStraight(d: Design): number {
	const short = Math.min(...shortRuns(d).map((run) => runLength(d, run)));
	const p = d.profile;
	if (p.shape === "square") return short - d.width;
	return p.joint === "elbow"
		? short - 2 * p.bendRadius
		: short / 2 - p.bendRadius;
}

export function validate(d: Design): Issue[] {
	const issues: Issue[] = [];
	for (const param of ["edge", "width", "gap", "wall"] as const) {
		if (!(d[param] > 0)) issues.push({ code: "notPositive", param });
	}
	if (d.profile.shape === "round" && !(d.profile.bendRadius > 0)) {
		issues.push({ code: "notPositive", param: "bendRadius" });
	}
	if (d.pattern.kind === "box") {
		for (const param of ["length", "depth"] as const) {
			if (!(d.pattern[param] > 0)) issues.push({ code: "notPositive", param });
		}
	}
	if (issues.length > 0) return issues;

	if (d.wall > d.width / 2 + EPS) {
		issues.push({ code: "wallTooThick", param: "wall", limit: d.width / 2 });
	}
	const minRadius = d.width * MIN_BEND_RADIUS_RATIO;
	if (d.profile.shape === "round" && d.profile.bendRadius < minRadius - EPS) {
		issues.push({
			code: "bendRadiusTooSmall",
			param: "bendRadius",
			limit: minRadius,
		});
	}
	if (shortestStraight(d) < MIN_STRAIGHT - EPS) {
		const runs = shortRuns(d);
		const shortest = runs.reduce((a, b) =>
			runLength(d, b) < runLength(d, a) ? b : a,
		);
		issues.push({
			code: "straightTooShort",
			param: shortest.param,
			limit: bounds(d)[shortest.param]?.min ?? 0,
		});
	}
	if (d.pattern.kind === "box" && d.pattern.length < d.pattern.depth - EPS) {
		issues.push({
			code: "lengthTooShort",
			param: "length",
			limit: d.pattern.depth,
		});
	}
	return issues;
}

/**
 * Slider limits for each parameter, the others being fixed (or following the
 * width, see Links). Any value inside these ranges passes validate().
 *
 * Every limit comes from linear constraints on the shortest straight runs:
 * A − 3W − 2G − E ≥ k·MIN_STRAIGHT, and C − 2W − G − E ≥ k·MIN_STRAIGHT for
 * the depth C of a box, where E is W for a square profile or 2R for a round
 * tube, and k is 2 for a bent tube (the weld splits the run). A box also
 * keeps its length B ≥ C.
 */
export function bounds(d: Design, links: Links = {}): Bounds {
	const p = d.profile;
	const k = p.shape === "round" && p.joint === "bent" ? 2 : 1;
	const reserve = k * MIN_STRAIGHT;
	const extra = p.shape === "square" ? d.width : 2 * p.bendRadius;

	const runs = shortRuns(d);
	const smallest = (f: (run: ShortRun) => number): number =>
		Math.min(...runs.map(f));
	const minSize = (run: ShortRun): number =>
		run.size - runLength(d, run) + extra + reserve;

	let widthMax = smallest((run) => {
		const factor =
			run.widths +
			(links.gapRatio === undefined ? 0 : run.gaps * links.gapRatio) +
			(p.shape === "square"
				? 1
				: links.bendRadiusRatio === undefined
					? 0
					: 2 * links.bendRadiusRatio);
		const fixed =
			(links.gapRatio === undefined ? run.gaps * d.gap : 0) +
			(p.shape === "round" && links.bendRadiusRatio === undefined
				? 2 * p.bendRadius
				: 0);
		return (run.size - reserve - fixed) / factor;
	});
	if (p.shape === "round" && links.bendRadiusRatio === undefined) {
		widthMax = Math.min(widthMax, p.bendRadius / MIN_BEND_RADIUS_RATIO);
	}

	const [edgeMin, depthMin] = runs.map(minSize);
	const result: Bounds = {
		edge: { min: edgeMin ?? 0, max: Number.POSITIVE_INFINITY },
		width: { min: 2 * d.wall, max: widthMax },
		gap: {
			min: 0,
			max: smallest(
				(run) => (run.size - run.widths * d.width - extra - reserve) / run.gaps,
			),
		},
		wall: { min: 0, max: d.width / 2 },
	};
	if (d.pattern.kind === "box" && depthMin !== undefined) {
		result.length = { min: d.pattern.depth, max: Number.POSITIVE_INFINITY };
		result.depth = { min: depthMin, max: d.pattern.length };
	}
	if (p.shape === "round") {
		result.bendRadius = {
			min: d.width * MIN_BEND_RADIUS_RATIO,
			max: smallest((run) => (runLength(d, run) - reserve) / 2),
		};
	}
	return result;
}
