import type { Loop } from "./loop";
import { cross, cyclic, dot, neg, type Vec3 } from "./vec";

export type EndRelation = "same-side" | "opposite" | "twisted";

export interface PieceEnds {
	segment: number;
	length: number;
	/** Direction of the neighbouring bar at each end, seen from this piece */
	startArm: Vec3;
	endArm: Vec3;
	relation: EndRelation;
	/**
	 * Rotation from the start arm to the end arm around the piece axis, in degrees.
	 * Same value as the tube rotation between two successive bends.
	 */
	twist: 0 | 180 | 90 | -90;
	/** Handedness of a twisted piece; 0 when the piece is its own mirror image */
	chirality: -1 | 0 | 1;
}

export interface PieceType {
	id: string;
	length: number;
	relation: EndRelation;
	twist: PieceEnds["twist"];
	chirality: PieceEnds["chirality"];
	segments: number[];
}

export function pieceEnds(loop: Loop): PieceEnds[] {
	return loop.segments.map((s) => {
		const startArm = neg(cyclic(loop.segments, s.index - 1).dir);
		const endArm = cyclic(loop.segments, s.index + 1).dir;
		const cos = dot(startArm, endArm);
		const base = { segment: s.index, length: s.length, startArm, endArm };
		if (cos > 0.5) {
			return { ...base, relation: "same-side", twist: 0, chirality: 0 };
		}
		if (cos < -0.5) {
			return { ...base, relation: "opposite", twist: 180, chirality: 0 };
		}
		const right = dot(cross(startArm, endArm), s.dir) > 0;
		return {
			...base,
			relation: "twisted",
			twist: right ? 90 : -90,
			chirality: right ? 1 : -1,
		};
	});
}

const TWIST_ORDER: readonly PieceEnds["twist"][] = [0, 180, 90, -90];
const lengthKey = (length: number): number => Math.round(length * 1e6) / 1e6;

/**
 * Groups the bars of a square profile mitred at 45° into types that are cut
 * identically: same length, same relative orientation of the two mitres, same
 * handedness.
 */
export function classifyPieces(loop: Loop): PieceType[] {
	const groups = new Map<string, Omit<PieceType, "id">>();
	for (const { segment, length, relation, twist, chirality } of pieceEnds(
		loop,
	)) {
		const key = `${lengthKey(length)}|${twist}`;
		const group = groups.get(key) ?? {
			length,
			relation,
			twist,
			chirality,
			segments: [],
		};
		group.segments.push(segment);
		groups.set(key, group);
	}
	return [...groups.values()]
		.sort(
			(a, b) =>
				lengthKey(b.length) - lengthKey(a.length) ||
				TWIST_ORDER.indexOf(a.twist) - TWIST_ORDER.indexOf(b.twist),
		)
		.map((group, i) => ({ id: String.fromCharCode(65 + i), ...group }));
}
