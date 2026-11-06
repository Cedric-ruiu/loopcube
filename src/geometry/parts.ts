import { buildLoop, cubeEdges, type Loop } from "./loop";
import type { Design } from "./params";
import { classifyPieces, type PieceType, pieceEnds } from "./pieces";
import { bend, bendPoint, midpoint } from "./shapes";
import { cyclic, type Vec3 } from "./vec";

export interface BentSection {
	/**
	 * Segments in loop order. The section starts in the middle of the first
	 * one and ends in the middle of the last one, where the butt welds are.
	 */
	segments: number[];
}

type PartShape =
	| ({ kind: "bar" } & Omit<PieceType, "id">)
	| {
			kind: "tube";
			length: number;
			segments: number[];
	  }
	| { kind: "elbow"; radius: number; corners: number[] }
	| {
			kind: "section";
			/** Developed length at the tube axis */
			length: number;
			/** Bend radius at the tube axis */
			radius: number;
			straights: number[];
			/** Tube rotation between two successive bends, in degrees */
			twists: number[];
			sections: BentSection[];
	  };

export type Part = PartShape & {
	id: string;
	/**
	 * Mark of each piece, in the order of its segments, corners or sections:
	 * A1, A2… Bought elbows are identical and fit any corner: they all bear
	 * the mark of their part.
	 */
	marks: string[];
};

const lengthKey = (length: number): number => Math.round(length * 1e6) / 1e6;

/**
 * A bent loop cannot be made from one tube: it is cut in the middle of the
 * bars of the single edges (spec §4.3), which gives planar sections.
 */
export function bentSections(loop: Loop): BentSection[] {
	const cuts = cubeEdges(loop)
		.filter((e) => e.segments.length === 1)
		.flatMap((e) => e.segments)
		.sort((a, b) => a - b);
	return cuts.map((first, i) => {
		const last = cyclic(cuts, i + 1);
		const count = (last - first + loop.segments.length) % loop.segments.length;
		return {
			segments: Array.from(
				{ length: count + 1 },
				(_, k) => (first + k) % loop.segments.length,
			),
		};
	});
}

function groupBy<T>(
	items: readonly T[],
	key: (item: T) => string,
): Map<string, T[]> {
	const groups = new Map<string, T[]>();
	for (const item of items) {
		const k = key(item);
		groups.set(k, [...(groups.get(k) ?? []), item]);
	}
	return groups;
}

function shapes(d: Design, loop: Loop): PartShape[] {
	const p = d.profile;
	if (p.shape === "square") {
		return classifyPieces(loop).map(({ id: _, ...piece }) => ({
			kind: "bar",
			...piece,
		}));
	}
	const radius = p.bendRadius;
	if (p.joint === "elbow") {
		const tubes = [
			...groupBy(loop.segments, (s) => `${lengthKey(s.length)}`).values(),
		]
			.map((group) => ({
				kind: "tube" as const,
				length: (group[0]?.length ?? 0) - 2 * radius,
				segments: group.map((s) => s.index),
			}))
			.sort((a, b) => b.length - a.length);
		return [
			...tubes,
			{
				kind: "elbow",
				radius,
				corners: loop.corners.map((_, i) => i),
			},
		];
	}

	const ends = pieceEnds(loop);
	const sections = bentSections(loop).map((section) => {
		const lengths = section.segments.map(
			(i) => cyclic(loop.segments, i).length,
		);
		const straights = lengths.map((l, k) =>
			k === 0 || k === lengths.length - 1 ? l / 2 - radius : l - 2 * radius,
		);
		const twists = section.segments
			.slice(1, -1)
			.map((i) => cyclic(ends, i).twist as number);
		return { section, straights, twists };
	});
	// A section read backwards is the same part (handedness does not change
	// with the reading direction): compare both directions.
	const signature = ({ straights, twists }: (typeof sections)[number]) => {
		const forward = `${straights.map(lengthKey)}|${twists}`;
		const backward = `${straights.map(lengthKey).reverse()}|${[...twists].reverse()}`;
		return [forward, backward].sort().join("/");
	};
	return [...groupBy(sections, signature).values()].map((group) => {
		const { straights, twists } = group[0] ?? { straights: [], twists: [] };
		const bends = straights.length - 1;
		return {
			kind: "section",
			length:
				straights.reduce((sum, l) => sum + l, 0) +
				(bends * Math.PI * radius) / 2,
			radius,
			straights,
			twists,
			sections: group.map((g) => g.section),
		};
	});
}

function pieces(shape: PartShape): readonly unknown[] {
	switch (shape.kind) {
		case "bar":
		case "tube":
			return shape.segments;
		case "elbow":
			return shape.corners;
		case "section":
			return shape.sections;
	}
}

export function parts(d: Design, loop: Loop = buildLoop(d)): Part[] {
	return shapes(d, loop).map((shape, i) => {
		const id = String.fromCharCode(65 + i);
		return {
			...shape,
			id,
			marks: pieces(shape).map((_, k) =>
				shape.kind === "elbow" ? id : `${id}${k + 1}`,
			),
		};
	});
}

export const quantity = (part: Part): number => part.marks.length;

export function markAnchors(part: Part, loop: Loop): Vec3[] {
	const middle = (i: number) => {
		const s = cyclic(loop.segments, i);
		return midpoint(s.start, s.end);
	};
	switch (part.kind) {
		case "bar":
		case "tube":
			return part.segments.map(middle);
		case "elbow":
			return part.corners.map((c) =>
				bendPoint(bend(loop, c, part.radius), Math.PI / 4),
			);
		case "section":
			return part.sections.map(({ segments }) =>
				middle(segments[1] ?? segments[0] ?? 0),
			);
	}
}
