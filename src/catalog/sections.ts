import type { ProfileShape } from "../geometry";
import { inchesToMm, type Unit } from "../units/units";

export interface Wall {
	value: number;
	/** Gauge or schedule, when the trade uses one */
	name?: string;
}

export interface StandardSize {
	/** Square width or round outer diameter, mm */
	width: number;
	name?: string;
	walls: Wall[];
	defaultWall: number;
}

const metric = (
	width: number,
	walls: number[],
	defaultWall: number,
	name?: string,
): StandardSize => ({
	width,
	...(name ? { name } : {}),
	walls: walls.map((value) => ({ value })),
	defaultWall: walls.indexOf(defaultWall),
});

const imperial = (
	width: number,
	walls: [string, number][],
	defaultWall: string,
	name?: string,
): StandardSize => ({
	width: inchesToMm(width),
	...(name ? { name } : {}),
	walls: walls.map(([wallName, value]) => ({
		value: inchesToMm(value),
		name: wallName,
	})),
	defaultWall: walls.findIndex(([wallName]) => wallName === defaultWall),
});

const GA16: [string, number] = ["16 ga", 0.065];
const GA14: [string, number] = ["14 ga", 0.083];
const GA11: [string, number] = ["11 ga", 0.12];
const T3_16: [string, number] = ['3/16"', 0.1875];
const T1_4: [string, number] = ['1/4"', 0.25];

export const STANDARD_SIZES: Record<
	Unit,
	Record<ProfileShape, readonly StandardSize[]>
> = {
	mm: {
		// EN 10219 square hollow sections
		square: [
			metric(20, [1.5, 2], 2),
			metric(25, [1.5, 2, 2.5, 3], 2),
			metric(30, [2, 2.5, 3], 2),
			metric(35, [2, 3], 2),
			metric(40, [2, 3, 4], 3),
			metric(50, [2, 3, 4, 5], 3),
			metric(60, [2, 3, 4, 5], 3),
			metric(70, [3, 4, 5], 4),
			metric(80, [3, 4, 5], 4),
		],
		// EN 10255 tube, light / medium / heavy series
		round: [
			metric(17.2, [1.8, 2.3, 2.9], 2.3, "DN 10"),
			metric(21.3, [2, 2.6, 3.2], 2.6, "DN 15"),
			metric(26.9, [2.3, 2.6, 3.2], 2.6, "DN 20"),
			metric(33.7, [2.6, 3.2, 4], 3.2, "DN 25"),
			metric(42.4, [2.6, 3.2, 4], 3.2, "DN 32"),
			metric(48.3, [2.9, 3.2, 4], 3.2, "DN 40"),
			metric(60.3, [2.9, 3.6, 4.5], 3.6, "DN 50"),
			metric(76.1, [3.2, 3.6, 4.5], 3.6, "DN 65"),
		],
	},
	in: {
		// ASTM A500 / A513 square tube
		square: [
			imperial(0.5, [GA16, GA14], "16 ga"),
			imperial(0.75, [GA16, GA14, GA11], "14 ga"),
			imperial(1, [GA16, GA14, GA11], "14 ga"),
			imperial(1.25, [GA16, GA14, GA11], "14 ga"),
			imperial(1.5, [GA16, GA14, GA11, T3_16], "14 ga"),
			imperial(2, [GA14, GA11, T3_16, T1_4], "11 ga"),
			imperial(3, [GA11, T3_16, T1_4], '3/16"'),
		],
		// ASME B36.10M pipe: real outer diameter, schedules 40 and 80
		round: [
			imperial(
				0.84,
				[
					["Sch 40", 0.109],
					["Sch 80", 0.147],
				],
				"Sch 40",
				"NPS 1/2",
			),
			imperial(
				1.05,
				[
					["Sch 40", 0.113],
					["Sch 80", 0.154],
				],
				"Sch 40",
				"NPS 3/4",
			),
			imperial(
				1.315,
				[
					["Sch 40", 0.133],
					["Sch 80", 0.179],
				],
				"Sch 40",
				"NPS 1",
			),
			imperial(
				1.66,
				[
					["Sch 40", 0.14],
					["Sch 80", 0.191],
				],
				"Sch 40",
				"NPS 1-1/4",
			),
			imperial(
				1.9,
				[
					["Sch 40", 0.145],
					["Sch 80", 0.2],
				],
				"Sch 40",
				"NPS 1-1/2",
			),
			imperial(
				2.375,
				[
					["Sch 40", 0.154],
					["Sch 80", 0.218],
				],
				"Sch 40",
				"NPS 2",
			),
		],
	},
};

const EPS = 1e-6;

export function nearestSize(
	unit: Unit,
	shape: ProfileShape,
	width: number,
): StandardSize {
	const sizes = STANDARD_SIZES[unit][shape];
	const nearest = sizes.reduce<StandardSize | undefined>(
		(best, size) =>
			!best || Math.abs(size.width - width) < Math.abs(best.width - width)
				? size
				: best,
		undefined,
	);
	if (!nearest) throw new Error(`No ${shape} stock in ${unit}`);
	return nearest;
}

export const defaultWall = (size: StandardSize): number =>
	size.walls[size.defaultWall]?.value ?? size.width / 10;

export function findSection(
	unit: Unit,
	shape: ProfileShape,
	width: number,
	wall: number,
): { size: number; wall: number } | null {
	const sizes = STANDARD_SIZES[unit][shape];
	const size = sizes.findIndex((s) => Math.abs(s.width - width) < EPS);
	const walls = sizes[size]?.walls ?? [];
	const w = walls.findIndex((t) => Math.abs(t.value - wall) < EPS);
	return size < 0 || w < 0 ? null : { size, wall: w };
}
