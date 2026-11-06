import {
	defaultWall,
	nearestSize,
	type StandardSize,
} from "../catalog/sections";
import {
	bounds,
	DEFAULT_BEND_RADIUS_RATIO,
	DEFAULT_DESIGNS,
	DEFAULT_GAP_RATIO,
	type Design,
	defaultBendRadius,
	defaultGap,
	type Issue,
	type Links,
	MIN_BEND_RADIUS_RATIO,
	type ParamName,
	type PatternKind,
	type ProfileShape,
	validate,
} from "../geometry";
import {
	inchesToMm,
	type Measure,
	mmToInches,
	type Unit,
} from "../units/units";

export type Joint = "elbow" | "bent";

export interface Settings {
	unit: Unit;
	pattern: PatternKind;
	shape: ProfileShape;
	joint: Joint;
	edge: number;
	/** Used by the box only */
	length: number;
	/** Used by the box only */
	depth: number;
	width: number;
	wall: number;
	/** null while the gap follows the width */
	gap: number | null;
	/** null while the bend radius follows the diameter */
	bendRadius: number | null;
}

export type Limit = "straight" | "solid" | "radius" | "length";

export interface FieldSpec {
	measure: Measure;
	/** Slider step, in the unit shown */
	step: Record<Unit, number>;
	/** Range offered when the geometry allows more, in mm */
	min: number;
	max: number;
}

export const FIELDS: readonly ParamName[] = [
	"width",
	"wall",
	"edge",
	"length",
	"depth",
	"gap",
	"bendRadius",
];

/** Fields of the form that apply to these settings */
export const fieldsOf = (s: Settings): ParamName[] =>
	FIELDS.filter(
		(p) =>
			(p !== "bendRadius" || s.shape === "round") &&
			(p !== "length" || s.pattern === "box") &&
			(p !== "depth" || s.pattern === "box"),
	);

export const FIELD_SPECS: Record<ParamName, FieldSpec> = {
	edge: { measure: "length", step: { mm: 1, in: 1 / 16 }, min: 50, max: 1500 },
	length: {
		measure: "length",
		step: { mm: 1, in: 1 / 16 },
		min: 50,
		max: 3000,
	},
	depth: { measure: "length", step: { mm: 1, in: 1 / 16 }, min: 50, max: 1500 },
	width: { measure: "size", step: { mm: 0.1, in: 1 / 16 }, min: 5, max: 150 },
	wall: { measure: "size", step: { mm: 0.1, in: 0.001 }, min: 0.5, max: 25 },
	gap: { measure: "length", step: { mm: 0.5, in: 1 / 16 }, min: 0.5, max: 300 },
	bendRadius: {
		measure: "length",
		step: { mm: 0.5, in: 1 / 16 },
		min: 5,
		max: 500,
	},
};

export const toDisplay = (mm: number, unit: Unit): number =>
	unit === "in" ? mmToInches(mm) : mm;
export const fromDisplay = (value: number, unit: Unit): number =>
	unit === "in" ? inchesToMm(value) : value;

export function toDesign(s: Settings): Design {
	return {
		pattern:
			s.pattern === "box"
				? { kind: "box", length: s.length, depth: s.depth }
				: { kind: s.pattern },
		edge: s.edge,
		width: s.width,
		gap: s.gap ?? defaultGap(s.width),
		wall: s.wall,
		profile:
			s.shape === "square"
				? { shape: "square" }
				: {
						shape: "round",
						joint: s.joint,
						bendRadius: s.bendRadius ?? defaultBendRadius(s.width),
					},
	};
}

export function links(s: Settings): Links {
	return {
		...(s.gap === null ? { gapRatio: DEFAULT_GAP_RATIO } : {}),
		...(s.bendRadius === null
			? { bendRadiusRatio: DEFAULT_BEND_RADIUS_RATIO }
			: {}),
	};
}

export const issuesOf = (s: Settings): Issue[] => validate(toDesign(s));

export function paramValue(s: Settings, param: ParamName): number {
	switch (param) {
		case "gap":
			return s.gap ?? defaultGap(s.width);
		case "bendRadius":
			return s.bendRadius ?? defaultBendRadius(s.width);
		default:
			return s[param];
	}
}

/** Sets a parameter; null puts the gap or radius back to following the width. */
export function withValue(
	s: Settings,
	param: ParamName,
	mm: number | null,
): Settings {
	switch (param) {
		case "gap":
			return { ...s, gap: mm };
		case "bendRadius":
			return { ...s, bendRadius: mm };
		default:
			return mm === null ? s : { ...s, [param]: mm };
	}
}

export function withShape(s: Settings, shape: ProfileShape): Settings {
	if (shape === s.shape) return s;
	const size = nearestSize(s.unit, shape, s.width);
	return { ...s, shape, width: size.width, wall: defaultWall(size) };
}

/**
 * A box starts as deep as the cube edge, and never shorter than deep: its
 * length then starts at twice its depth.
 */
export function withPattern(s: Settings, pattern: PatternKind): Settings {
	const next = { ...s, pattern };
	if (pattern !== "box" || s.pattern === "box") return next;
	const depth = s.edge;
	return {
		...next,
		depth,
		length:
			s.length < depth
				? snapToStep(2 * depth, "length", s.unit, "up")
				: s.length,
	};
}

export const withSection = (
	s: Settings,
	size: StandardSize,
	wall: number,
): Settings => ({ ...s, width: size.width, wall });

export function defaultSettings(
	unit: Unit,
	shape: ProfileShape = "square",
	joint: Joint = "elbow",
): Settings {
	const d = DEFAULT_DESIGNS[unit === "mm" ? "metric" : "imperial"];
	const square: Settings = {
		unit,
		pattern: "cube",
		shape: "square",
		joint,
		edge: d.edge,
		length: 2 * d.edge,
		depth: d.edge,
		width: d.width,
		wall: d.wall,
		gap: null,
		bendRadius: null,
	};
	return withShape(square, shape);
}

const sameSettings = (a: Settings, b: Settings): boolean =>
	(Object.keys(a) as (keyof Settings)[]).every((k) => a[k] === b[k]);

/**
 * Changes the unit shown. Untouched dimensions switch to the defaults of the
 * new unit (12" rather than 11-13/16"); edited ones are kept as they are.
 */
export function withUnit(s: Settings, unit: Unit): Settings {
	if (unit === s.unit) return s;
	const defaults = (u: Unit): Settings => ({
		...defaultSettings(u, s.shape, s.joint),
		pattern: s.pattern,
	});
	return sameSettings(s, defaults(s.unit)) ? defaults(unit) : { ...s, unit };
}

interface GeometricRange {
	min: number;
	max: number;
	minLimit: Limit | null;
	maxLimit: Limit | null;
}

function geometricRange(s: Settings, param: ParamName): GeometricRange {
	const d = toDesign(s);
	const b = bounds(d, links(s));
	switch (param) {
		case "edge":
			return { ...b.edge, minLimit: "straight", maxLimit: null };
		case "depth":
			return {
				...(b.depth ?? { min: 0, max: Number.POSITIVE_INFINITY }),
				minLimit: "straight",
				maxLimit: "length",
			};
		case "length":
			return {
				...(b.length ?? { min: 0, max: Number.POSITIVE_INFINITY }),
				minLimit: "length",
				maxLimit: null,
			};
		case "width": {
			const radiusCap =
				d.profile.shape === "round" &&
				s.bendRadius !== null &&
				Math.abs(b.width.max - d.profile.bendRadius / MIN_BEND_RADIUS_RATIO) <
					1e-9;
			return {
				...b.width,
				minLimit: "solid",
				maxLimit: radiusCap ? "radius" : "straight",
			};
		}
		case "wall":
			return { ...b.wall, minLimit: null, maxLimit: "solid" };
		case "gap":
			return { ...b.gap, minLimit: null, maxLimit: "straight" };
		case "bendRadius":
			return {
				...(b.bendRadius ?? { min: 0, max: Number.POSITIVE_INFINITY }),
				minLimit: "radius",
				maxLimit: "straight",
			};
	}
}

const decimals = (step: number): number =>
	(String(step).split(".")[1] ?? "").length;

export function snapToStep(
	mm: number,
	param: ParamName,
	unit: Unit,
	direction: "up" | "down",
): number {
	const step = FIELD_SPECS[param].step[unit];
	const steps = toDisplay(mm, unit) / step;
	const n =
		direction === "up" ? Math.ceil(steps - 1e-9) : Math.floor(steps + 1e-9);
	return fromDisplay(Number((n * step).toFixed(decimals(step))), unit);
}

export function typedRange(
	s: Settings,
	param: ParamName,
): { min: number; max: number } {
	const geo = geometricRange(s, param);
	return {
		min: Math.max(geo.min, FIELD_SPECS[param].min),
		max: geo.max,
	};
}

export interface SliderRange {
	/** In the unit shown */
	min: number;
	max: number;
	step: number;
	value: number;
	minLimit: Limit | null;
	maxLimit: Limit | null;
}

export function sliderRange(s: Settings, param: ParamName): SliderRange {
	const spec = FIELD_SPECS[param];
	const geo = geometricRange(s, param);
	const value = paramValue(s, param);
	const lo = Math.min(Math.max(geo.min, spec.min), value);
	const hi = Math.max(Math.min(geo.max, spec.max), value);
	const step = spec.step[s.unit];
	let min = toDisplay(snapToStep(lo, param, s.unit, "up"), s.unit);
	let max = toDisplay(snapToStep(hi, param, s.unit, "down"), s.unit);
	const shown = toDisplay(value, s.unit);
	if (min > max) {
		min = shown;
		max = shown;
	}
	return {
		min,
		max,
		step,
		value: shown,
		minLimit: geo.min >= spec.min && lo === geo.min ? geo.minLimit : null,
		maxLimit: geo.max <= spec.max && hi === geo.max ? geo.maxLimit : null,
	};
}

export function limitReached(range: SliderRange): Limit | null {
	const near = (a: number) => Math.abs(range.value - a) < range.step / 2;
	if (range.minLimit && near(range.min)) return range.minLimit;
	if (range.maxLimit && near(range.max)) return range.maxLimit;
	return null;
}
