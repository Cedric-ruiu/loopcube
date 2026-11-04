import { axisLengths, type CubeParams } from "./loop";

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

export type ParamName = "edge" | "width" | "gap" | "wall" | "bendRadius";

export type IssueCode =
	| "notPositive"
	| "wallTooThick"
	| "bendRadiusTooSmall"
	| "straightTooShort";

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
	},
	imperial: {
		edge: 304.8,
		width: 25.4,
		gap: 12.7,
		wall: 2.1082,
		profile: { shape: "square" },
	},
} as const satisfies Record<string, Design>;

/**
 * Shortest straight run in the loop, the first thing to vanish when the cube
 * shrinks: inner edge of a short mitred bar, straight tube between two elbows,
 * or straight tube between a bend and the mid-bar weld of a bent section.
 */
export function shortestStraight(d: Design): number {
	const { short } = axisLengths(d);
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
		issues.push({
			code: "straightTooShort",
			param: "edge",
			limit: bounds(d).edge.min,
		});
	}
	return issues;
}

/**
 * Slider limits for each parameter, the others being fixed (or following the
 * width, see Links). Any value inside these ranges passes validate().
 *
 * Every limit comes from one linear constraint on the shortest straight run:
 * A − 3W − 2G − E ≥ k·MIN_STRAIGHT, where E is W for a square profile or 2R
 * for a round tube, and k is 2 for a bent tube (the weld splits the run).
 */
export function bounds(d: Design, links: Links = {}): Bounds {
	const p = d.profile;
	const k = p.shape === "round" && p.joint === "bent" ? 2 : 1;
	const reserve = k * MIN_STRAIGHT;
	const extra = p.shape === "square" ? d.width : 2 * p.bendRadius;

	const widthFactor =
		3 +
		(links.gapRatio === undefined ? 0 : 2 * links.gapRatio) +
		(p.shape === "square"
			? 1
			: links.bendRadiusRatio === undefined
				? 0
				: 2 * links.bendRadiusRatio);
	const widthFixed =
		(links.gapRatio === undefined ? 2 * d.gap : 0) +
		(p.shape === "round" && links.bendRadiusRatio === undefined
			? 2 * p.bendRadius
			: 0);
	let widthMax = (d.edge - reserve - widthFixed) / widthFactor;
	if (p.shape === "round" && links.bendRadiusRatio === undefined) {
		widthMax = Math.min(widthMax, p.bendRadius / MIN_BEND_RADIUS_RATIO);
	}

	const result: Bounds = {
		edge: {
			min: 3 * d.width + 2 * d.gap + extra + reserve,
			max: Number.POSITIVE_INFINITY,
		},
		width: { min: 2 * d.wall, max: widthMax },
		gap: { min: 0, max: (d.edge - 3 * d.width - extra - reserve) / 2 },
		wall: { min: 0, max: d.width / 2 },
	};
	if (p.shape === "round") {
		result.bendRadius = {
			min: d.width * MIN_BEND_RADIUS_RATIO,
			max: (d.edge - 3 * d.width - 2 * d.gap - reserve) / 2,
		};
	}
	return result;
}
