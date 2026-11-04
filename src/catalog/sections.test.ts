import { describe, expect, it } from "vitest";
import { DEFAULT_DESIGNS } from "../geometry";
import { inchesToMm } from "../units/units";
import {
	defaultWall,
	findSection,
	nearestSize,
	STANDARD_SIZES,
} from "./sections";

const ALL = Object.entries(STANDARD_SIZES).flatMap(([unit, shapes]) =>
	Object.entries(shapes).map(([shape, sizes]) => [unit, shape, sizes] as const),
);

describe.each(ALL)("standard %s %s sizes", (_, __, sizes) => {
	it("go from the smallest to the largest", () => {
		const widths = sizes.map((s) => s.width);
		expect(widths).toEqual([...widths].sort((a, b) => a - b));
	});

	it("have a usual wall among thin to thick walls that fit the section", () => {
		for (const size of sizes) {
			expect(size.walls[size.defaultWall]).toBeDefined();
			const walls = size.walls.map((w) => w.value);
			expect(walls).toEqual([...walls].sort((a, b) => a - b));
			expect(Math.max(...walls)).toBeLessThan(size.width / 2);
		}
	});
});

describe("standard sizes", () => {
	it("contain the default designs", () => {
		const { metric, imperial } = DEFAULT_DESIGNS;
		expect(
			findSection("mm", "square", metric.width, metric.wall),
		).not.toBeNull();
		expect(
			findSection("in", "square", imperial.width, imperial.wall),
		).not.toBeNull();
	});

	it("give pipe its real outer diameter", () => {
		const nps1 = STANDARD_SIZES.in.round.find((s) => s.name === "NPS 1");
		expect(nps1?.width).toBeCloseTo(inchesToMm(1.315), 9);
	});

	it("pick the closest size when the profile changes", () => {
		expect(nearestSize("mm", "round", 25).width).toBe(26.9);
		expect(nearestSize("mm", "square", 26.9).width).toBe(25);
		expect(nearestSize("in", "round", 25.4).name).toBe("NPS 3/4");
		expect(defaultWall(nearestSize("mm", "round", 25))).toBe(2.6);
	});

	it("tell a custom section from a standard one", () => {
		expect(findSection("mm", "round", 26.9, 2.6)).toEqual({
			size: 2,
			wall: 1,
		});
		expect(findSection("mm", "round", 26.9, 2.7)).toBeNull();
		expect(findSection("mm", "round", 27, 2.6)).toBeNull();
	});
});
