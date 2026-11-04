import { describe, expect, it } from "vitest";
import {
	formatDecimalInches,
	formatDimension,
	formatField,
	formatInches,
	formatLength,
	formatMeasure,
	formatMm,
	formatSection,
	inchesToMm,
	mmToInches,
	parseLength,
	toSixteenths,
	type Unit,
} from "./units";

describe("mm ↔ inches", () => {
	it("uses the exact 25.4 factor", () => {
		expect(inchesToMm(1)).toBe(25.4);
		expect(mmToInches(304.8)).toBeCloseTo(12, 12);
		expect(mmToInches(inchesToMm(1.375))).toBeCloseTo(1.375, 12);
	});
});

describe("formatInches", () => {
	it.each([
		[238, '9-3/8"'],
		[201, '7-15/16"'],
		[12.7, '1/2"'],
		[6.35, '1/4"'],
		[19.05, '3/4"'],
		[304.8, '12"'],
		[0, '0"'],
		[-31.75, '-1-1/4"'],
	])("%f mm → %s", (mm, expected) => {
		expect(formatInches(mm)).toBe(expected);
	});

	it("carries a rounded-up fraction into the next inch", () => {
		expect(formatInches(inchesToMm(15.99 / 16))).toBe('1"');
		expect(formatInches(inchesToMm(2 + 31.9 / 32))).toBe('3"');
	});

	it("reduces fractions to lowest terms", () => {
		expect(toSixteenths(0.5)).toEqual({
			sign: 1,
			whole: 0,
			numerator: 1,
			denominator: 2,
		});
		expect(toSixteenths(3 + 10 / 16)).toEqual({
			sign: 1,
			whole: 3,
			numerator: 5,
			denominator: 8,
		});
		expect(toSixteenths(3 + 3 / 16)).toEqual({
			sign: 1,
			whole: 3,
			numerator: 3,
			denominator: 16,
		});
	});
});

describe("formatMm", () => {
	it("follows the locale decimal separator, with a non-breaking space", () => {
		expect(formatMm(12.5, "fr")).toBe("12,5\u00a0mm");
		expect(formatMm(12.5, "en")).toBe("12.5\u00a0mm");
	});

	it("keeps one decimal at most", () => {
		expect(formatMm(238, "fr")).toBe("238\u00a0mm");
		expect(formatMm(12.46, "fr")).toBe("12,5\u00a0mm");
		expect(formatMm(-0.01, "en")).toBe("0\u00a0mm");
	});

	it("is dispatched by formatLength", () => {
		expect(formatLength(238, "mm", "fr")).toBe("238\u00a0mm");
		expect(formatLength(238, "in", "fr")).toBe('9-3/8"');
	});
});

describe("parseLength", () => {
	it.each([
		["1-1/4", 31.75],
		["1 1/4", 31.75],
		['3/4"', 19.05],
		["1.25", 31.75],
		["1,25", 31.75],
		["12 in", 304.8],
		["5/16", 7.9375],
	])("reads %s in inches", (text, mm) => {
		expect(parseLength(text, "in")).toBeCloseTo(mm, 9);
	});

	it.each([
		["12,5", 12.5],
		["12.5", 12.5],
		[" 300 ", 300],
		["1 000", 1000],
		["25 mm", 25],
	])("reads %s in mm", (text, mm) => {
		expect(parseLength(text, "mm")).toBeCloseTo(mm, 9);
	});

	it("lets an explicit suffix override the current unit", () => {
		expect(parseLength("25 mm", "in")).toBe(25);
		expect(parseLength('1"', "mm")).toBe(25.4);
	});

	it.each(["", "abc", "1/0", "-5", "1 2", "1//2", "mm"])(
		"rejects %j",
		(text) => {
			expect(parseLength(text, "in")).toBeNull();
		},
	);
});

describe("stock sizes in inches", () => {
	it.each([
		[0.083, "en", '0.083"'],
		[1, "en", '1"'],
		[1.315, "en", '1.315"'],
		[0.75, "en", '0.75"'],
		[0.083, "fr", '0,083"'],
	])("writes %f in as decimals (%s)", (inches, locale, text) => {
		expect(formatDecimalInches(inchesToMm(inches), locale)).toBe(text);
	});

	it("keeps shop fractions for lengths and decimals for sizes", () => {
		const mm = inchesToMm(1.315);
		expect(formatMeasure(mm, "in", "en", "length")).toBe('1-5/16"');
		expect(formatMeasure(mm, "in", "en", "size")).toBe('1.315"');
		expect(formatMeasure(26.9, "mm", "fr", "size")).toBe("26,9\u00a0mm");
	});
});

describe("formatSection", () => {
	it.each([
		["square", 25, 2, "mm", "fr", "25 × 25 × 2\u00a0mm"],
		["round", 26.9, 2.6, "mm", "fr", "Ø 26,9 × 2,6\u00a0mm"],
		["square", 25.4, inchesToMm(0.083), "in", "en", '1" × 1" × 0.083"'],
		[
			"round",
			inchesToMm(1.315),
			inchesToMm(0.133),
			"in",
			"en",
			'Ø 1.315" × 0.133"',
		],
	] as const)(
		"writes a %s section",
		(shape, width, wall, unit, locale, text) => {
			expect(formatSection(shape, width, wall, unit, locale)).toBe(text);
		},
	);
});

describe("formatField", () => {
	const values = [0.5, 2.1082, 12.5, 25.4, 33.4, 168.3, 304.8, 1500, 2345.6];
	const cases: [Unit, string, "length" | "size", number][] = [
		["mm", "fr", "length", 0.05],
		["mm", "en", "length", 0.05],
		["mm", "en", "size", 0.05],
		["in", "en", "length", 25.4 / 32],
		["in", "fr", "length", 25.4 / 32],
		["in", "en", "size", 0.0127],
		["in", "fr", "size", 0.0127],
	];

	it.each(cases)(
		"is read back by parseLength (%s, %s, %s)",
		(unit, locale, measure, tolerance) => {
			for (const mm of values) {
				const text = formatField(mm, unit, locale, measure);
				expect(
					Math.abs((parseLength(text, unit) ?? Number.NaN) - mm),
				).toBeLessThanOrEqual(tolerance);
			}
		},
	);

	it("leaves out the unit and digit grouping", () => {
		expect(formatField(1500, "mm", "en", "length")).toBe("1500");
		expect(formatField(12.5, "mm", "fr", "length")).toBe("12,5");
		expect(formatField(inchesToMm(9.375), "in", "en", "length")).toBe("9-3/8");
		expect(formatField(inchesToMm(0.083), "in", "en", "size")).toBe("0.083");
	});
});

describe("formatDimension", () => {
	it("leaves the unit to the title block", () => {
		expect(formatDimension(12.5, "mm", "fr")).toBe("12,5");
		expect(formatDimension(262.5, "mm", "en")).toBe("262.5");
		expect(formatDimension(1500, "mm", "fr")).toBe("1500");
		expect(formatDimension(inchesToMm(9.375), "in", "en")).toBe("9-3/8");
		expect(formatDimension(inchesToMm(0.5), "in", "fr")).toBe("1/2");
	});
});
