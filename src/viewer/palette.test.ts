import { describe, expect, it } from "vitest";
import { type Design, parts } from "../geometry";
import { PART_COLORS } from "./palette";

describe("part colours", () => {
	it("give every part type of a box its own colour", () => {
		const box: Design = {
			edge: 400,
			width: 25,
			gap: 12.5,
			wall: 2,
			profile: { shape: "square" },
			pattern: { kind: "box", length: 900, depth: 450 },
		};
		expect(parts(box).length).toBeLessThanOrEqual(PART_COLORS.length);
		expect(new Set(PART_COLORS).size).toBe(PART_COLORS.length);
	});
});
