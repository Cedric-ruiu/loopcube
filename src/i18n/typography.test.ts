import { describe, expect, it } from "vitest";
import { fr } from "./fr";
import { frenchSpacing } from "./typography";

describe("frenchSpacing", () => {
	it("puts a no-break space before ? ! ; : » and after «", () => {
		expect(frenchSpacing("Un mot ? Oui ! Non ; « Vue » : ok")).toBe(
			"Un mot\u00a0? Oui\u00a0! Non\u00a0; «\u00a0Vue\u00a0»\u00a0: ok",
		);
	});

	it("leaves other spaces and punctuation alone", () => {
		expect(frenchSpacing("12 mm, A — B: {x}?")).toBe("12 mm, A — B: {x}?");
	});

	it("walks nested objects and arrays", () => {
		expect(frenchSpacing({ a: ["x :"], b: { c: "y ?" } })).toEqual({
			a: ["x\u00a0:"],
			b: { c: "y\u00a0?" },
		});
	});

	it("leaves no breakable space before French punctuation in the messages", () => {
		expect(JSON.stringify(fr)).not.toMatch(/ [?!;:»]|« /);
	});
});
