import type { P2 } from "./render";

/** ISO 128 / ISO 129 (aligned text) or ASME Y14.5 (unidirectional text). */
export type Standard = "iso" | "asme";

/** Line types, styled in plan.css. */
export type Line = "thick" | "thin" | "hidden" | "center" | "weld" | "fill";

const n = (v: number): string => (Math.round(v * 100) / 100).toString();

export const esc = (text: string): string =>
	text
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");

export const line = (a: P2, b: P2, kind: Line = "thin"): string =>
	`<line class="${kind}" x1="${n(a[0])}" y1="${n(a[1])}" x2="${n(b[0])}" y2="${n(b[1])}"/>`;

export const polyline = (points: readonly P2[], kind: Line = "thin"): string =>
	`<polyline class="${kind}" points="${points.map((p) => `${n(p[0])},${n(p[1])}`).join(" ")}"/>`;

export const polygon = (points: readonly P2[], kind: Line = "thin"): string =>
	`<polygon class="${kind}" points="${points.map((p) => `${n(p[0])},${n(p[1])}`).join(" ")}"/>`;

export const circle = (
	c: P2,
	r: number,
	kind: Line | "fill" = "thin",
): string =>
	`<circle class="${kind}" cx="${n(c[0])}" cy="${n(c[1])}" r="${n(r)}"/>`;

export interface TextOptions {
	size?: number;
	anchor?: "start" | "middle" | "end";
	/** Degrees, clockwise on the sheet */
	rotate?: number;
	bold?: boolean;
}

export function text(at: P2, content: string, o: TextOptions = {}): string {
	const size = o.size ?? DIM_TEXT;
	const rotate = o.rotate
		? ` transform="rotate(${n(o.rotate)} ${n(at[0])} ${n(at[1])})"`
		: "";
	const weight = o.bold ? ` font-weight="700"` : "";
	return `<text x="${n(at[0])}" y="${n(at[1])}" font-size="${n(size)}" text-anchor="${o.anchor ?? "middle"}"${weight}${rotate}>${esc(content)}</text>`;
}

export const DIM_TEXT = 2.5;
const ARROW = 2.5;
const ARROW_HALF = 0.42;
const GAP = 1;
const OVERSHOOT = 1.5;

export const textWidth = (content: string, size = DIM_TEXT): number =>
	content.length * size * 0.58;

const unit = (a: P2, b: P2): P2 => {
	const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
	return [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
};
const along = (p: P2, u: P2, d: number): P2 => [
	p[0] + u[0] * d,
	p[1] + u[1] * d,
];

export function arrow(tip: P2, dir: P2): string {
	const back = along(tip, dir, -ARROW);
	const side: P2 = [-dir[1] * ARROW_HALF, dir[0] * ARROW_HALF];
	return polygon(
		[
			tip,
			[back[0] + side[0], back[1] + side[1]],
			[back[0] - side[0], back[1] - side[1]],
		],
		"fill",
	);
}

export function linear(
	std: Standard,
	a: P2,
	b: P2,
	axis: "x" | "y",
	at: number,
	label: string,
	before = false,
): string {
	const i = axis === "x" ? 0 : 1;
	const j = axis === "x" ? 1 : 0;
	const pt = (u: number, v: number): P2 => (i === 0 ? [u, v] : [v, u]);
	const [lo, hi] = a[i] <= b[i] ? [a, b] : [b, a];
	const out: string[] = [];
	for (const p of [lo, hi]) {
		const side = Math.sign(at - p[j]) || 1;
		if (Math.abs(at - p[j]) > GAP) {
			out.push(
				line(pt(p[i], p[j] + side * GAP), pt(p[i], at + side * OVERSHOOT)),
			);
		}
	}
	const length = hi[i] - lo[i];
	const width = textWidth(label);
	const inside = length >= 2 * ARROW + 1.5;
	const fitsText =
		std === "iso" ? length >= width + 2 : length >= width + 2 * ARROW + 3;
	const s = pt(lo[i], at);
	const e = pt(hi[i], at);
	const dir = unit(s, e);
	const back: P2 = [-dir[0], -dir[1]];
	if (inside) {
		out.push(arrow(s, back), arrow(e, dir));
	} else {
		out.push(arrow(s, dir), arrow(e, back));
		out.push(
			line(along(s, back, ARROW + 2), s),
			line(e, along(e, dir, ARROW + 2)),
		);
	}
	const middle = (lo[i] + hi[i]) / 2;
	if (std === "iso") {
		out.push(line(s, e));
		const textAt = fitsText
			? middle
			: before
				? lo[i] - ARROW - 3 - width / 2
				: hi[i] + ARROW + 3 + width / 2;
		out.push(
			i === 0
				? text(pt(textAt, at - 0.8), label)
				: text(pt(textAt, at - 0.8), label, { rotate: -90 }),
		);
		return out.join("");
	}
	// ASME: horizontal text in a break of the dimension line
	const half = i === 0 ? width / 2 + 1 : DIM_TEXT / 2 + 1;
	if (fitsText && length >= 2 * half + 2 * ARROW) {
		out.push(line(s, pt(middle - half, at)), line(pt(middle + half, at), e));
		out.push(
			text(
				i === 0 ? [middle, at + DIM_TEXT / 2.8] : [at, middle + DIM_TEXT / 2.8],
				label,
			),
		);
	} else {
		out.push(line(s, e));
		const beyond = before ? lo[i] - ARROW - 3 : hi[i] + ARROW + 3;
		out.push(
			i === 0
				? text(
						[beyond + (before ? -1 : 1) * (width / 2), at + DIM_TEXT / 2.8],
						label,
					)
				: text([at, before ? beyond : beyond + DIM_TEXT], label),
		);
	}
	return out.join("");
}

/** Angle between two rays from `c` (paper radians, clockwise on the sheet). */
export function angular(
	c: P2,
	r: number,
	from: number,
	to: number,
	label: string,
	textAt?: P2,
): string {
	const p = (t: number): P2 => [c[0] + r * Math.cos(t), c[1] + r * Math.sin(t)];
	const large = Math.abs(to - from) > Math.PI ? 1 : 0;
	const sweep = to > from ? 1 : 0;
	const [s, e] = [p(from), p(to)];
	const mid = (from + to) / 2;
	const tangent = (t: number, sign: number): P2 => [
		-Math.sin(t) * sign,
		Math.cos(t) * sign,
	];
	const turn = Math.sign(to - from);
	return [
		`<path class="thin" d="M${n(s[0])} ${n(s[1])} A${n(r)} ${n(r)} 0 ${large} ${sweep} ${n(e[0])} ${n(e[1])}"/>`,
		arrow(s, tangent(from, -turn)),
		arrow(e, tangent(to, turn)),
		text(textAt ?? along(p(mid), [Math.cos(mid), Math.sin(mid)], 2.8), label),
	].join("");
}

export function radius(c: P2, r: number, angle: number, label: string): string {
	const dir: P2 = [Math.cos(angle), Math.sin(angle)];
	const tip = along(c, dir, r);
	const elbow = along(tip, dir, 6);
	const right = dir[0] >= 0 ? 1 : -1;
	const end: P2 = [elbow[0] + right * (textWidth(label) + 1), elbow[1]];
	return [
		line(c, elbow),
		line(elbow, end),
		arrow(tip, dir),
		text([(elbow[0] + end[0]) / 2, elbow[1] - 0.8], label),
	].join("");
}

export const BALLOON = 2.6;

export function balloon(at: P2, on: P2, label: string, size = BALLOON): string {
	const dir = unit(at, on);
	return [
		line(along(at, dir, size), on),
		circle(on, 0.45, "fill"),
		`<circle class="thin balloon" cx="${n(at[0])}" cy="${n(at[1])}" r="${n(size)}"/>`,
		text([at[0], at[1] + size * 0.36], label, {
			size: size * 0.95,
			bold: true,
		}),
	].join("");
}

/**
 * Projection symbol (ISO 5456-2), drawn as the projection it stands for: a
 * truncated cone, small end to the left, and its view from the left placed on
 * the right (first angle) or on the left (third angle).
 */
export function projectionSymbol(
	origin: P2,
	angle: "first" | "third",
	h = 2.4,
): string {
	const [x, y] = origin;
	const big = h * 1.25;
	const small = h * 0.625;
	const length = h * 2;
	const gap = h * 0.9;
	const circles = angle === "first" ? x + length + gap + big : x + big;
	const cone = angle === "first" ? x : x + 2 * big + gap;
	return [
		polygon(
			[
				[cone, y - small],
				[cone + length, y - big],
				[cone + length, y + big],
				[cone, y + small],
			],
			"thick",
		),
		circle([circles, y], big, "thick"),
		circle([circles, y], small, "thick"),
		line([cone - 1, y], [cone + length + 1, y], "center"),
		line([circles - big - 1, y], [circles + big + 1, y], "center"),
		line([circles, y - big - 1], [circles, y + big + 1], "center"),
	].join("");
}

export const projectionSymbolWidth = (h = 2.4): number =>
	h * 2 + h * 0.9 + h * 2.5;

const WELD_REFERENCE = 13;
const WELD_SYMBOL_AT = 6;

export function weldSymbolBox(
	junction: P2,
	side: 1 | -1,
	tail: string,
): { min: P2; max: P2 } {
	const [x, y] = junction;
	const far = x + side * (WELD_REFERENCE + 2.8 + textWidth(tail));
	const near = x - side * 1.6;
	return {
		min: [Math.min(near, far), y - 3],
		max: [Math.max(near, far), y + 3],
	};
}

/**
 * Weld symbol: square butt weld, all around, with a note in the tail. ISO 2553
 * (system A) puts the symbol on the continuous reference line, with the dashed
 * identification line on the other side; AWS A2.4 puts an arrow side weld
 * below its single reference line. `side` is where the reference line goes
 * from the junction with the arrow line.
 */
export function weldSymbol(
	std: Standard,
	tip: P2,
	junction: P2,
	side: 1 | -1,
	tail: string,
): string {
	const [x, y] = junction;
	const end = x + side * WELD_REFERENCE;
	const symbol = x + side * WELD_SYMBOL_AT;
	const up = std === "iso" ? -1 : 1;
	const out = [
		line(junction, tip),
		arrow(tip, unit(junction, tip)),
		line(junction, [end, y]),
		circle(junction, 1.3),
		line([symbol - 0.6, y], [symbol - 0.6, y + up * 2.5]),
		line([symbol + 0.6, y], [symbol + 0.6, y + up * 2.5]),
		line([end, y], [end + side * 2, y - 2]),
		line([end, y], [end + side * 2, y + 2]),
		text([end + side * 2.8, y + 0.9], tail, {
			anchor: side > 0 ? "start" : "end",
		}),
	];
	if (std === "iso")
		out.push(line([x + side * 1.8, y + 1], [end, y + 1], "hidden"));
	return out.join("");
}
