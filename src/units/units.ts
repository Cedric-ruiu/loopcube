export type Unit = "mm" | "in";

export const MM_PER_INCH = 25.4;

export const mmToInches = (mm: number): number => mm / MM_PER_INCH;
export const inchesToMm = (inches: number): number => inches * MM_PER_INCH;

export interface Fraction {
	sign: 1 | -1;
	whole: number;
	numerator: number;
	denominator: number;
}

export function toSixteenths(inches: number): Fraction {
	const sixteenths = Math.round(Math.abs(inches) * 16);
	let numerator = sixteenths % 16;
	let denominator = 16;
	while (numerator > 0 && numerator % 2 === 0) {
		numerator /= 2;
		denominator /= 2;
	}
	return {
		sign: inches < 0 && sixteenths > 0 ? -1 : 1,
		whole: Math.floor(sixteenths / 16),
		numerator,
		denominator,
	};
}

export function formatInches(mm: number): string {
	const { sign, whole, numerator, denominator } = toSixteenths(mmToInches(mm));
	const fraction = numerator > 0 ? `${numerator}/${denominator}` : "";
	const body =
		whole > 0 && fraction ? `${whole}-${fraction}` : fraction || `${whole}`;
	return `${sign < 0 ? "-" : ""}${body}"`;
}

const mmFormats = new Map<string, Intl.NumberFormat>();

export function formatMm(mm: number, locale: string): string {
	let format = mmFormats.get(locale);
	if (!format) {
		format = new Intl.NumberFormat(locale, {
			maximumFractionDigits: 1,
			signDisplay: "negative",
		});
		mmFormats.set(locale, format);
	}
	return `${format.format(mm)}\u00a0mm`;
}

export function formatLength(mm: number, unit: Unit, locale: string): string {
	return unit === "in" ? formatInches(mm) : formatMm(mm, locale);
}

/** Dimension on a drawing, whose unit is stated in the title block: 12,5 or 9-3/8. */
export function formatDimension(
	mm: number,
	unit: Unit,
	locale: string,
): string {
	if (unit === "in") return formatInches(mm).slice(0, -1);
	return plainNumber(locale, 1).format(mm);
}

/** Lengths are cut and measured; sizes describe the stock (width, wall). */
export type Measure = "length" | "size";

const plainFormats = new Map<string, Intl.NumberFormat>();

function plainNumber(locale: string, digits: number): Intl.NumberFormat {
	const key = `${locale}|${digits}`;
	let format = plainFormats.get(key);
	if (!format) {
		format = new Intl.NumberFormat(locale, {
			maximumFractionDigits: digits,
			useGrouping: false,
		});
		plainFormats.set(key, format);
	}
	return format;
}

export function formatDecimalInches(mm: number, locale: string): string {
	return `${plainNumber(locale, 3).format(mmToInches(mm))}"`;
}

export function formatMeasure(
	mm: number,
	unit: Unit,
	locale: string,
	measure: Measure,
): string {
	if (unit === "in" && measure === "size") {
		return formatDecimalInches(mm, locale);
	}
	return formatLength(mm, unit, locale);
}

/** Value of an editable field, without unit or digit grouping, so that parseLength reads it back. */
export function formatField(
	mm: number,
	unit: Unit,
	locale: string,
	measure: Measure,
): string {
	if (unit === "mm") return plainNumber(locale, 1).format(mm);
	if (measure === "size") return plainNumber(locale, 3).format(mmToInches(mm));
	return formatInches(mm).slice(0, -1);
}

export function formatSection(
	shape: "square" | "round",
	width: number,
	wall: number,
	unit: Unit,
	locale: string,
): string {
	const sizes =
		unit === "mm"
			? [width, wall].map((v) => plainNumber(locale, 1).format(v))
			: [width, wall].map((v) => formatDecimalInches(v, locale));
	const [w, t] = sizes;
	const body = shape === "square" ? `${w} × ${w} × ${t}` : `Ø ${w} × ${t}`;
	return unit === "mm" ? `${body} mm` : body;
}

/**
 * Parses a positive length typed by the user and returns it in mm, or null.
 * An explicit suffix (mm, in, ") overrides the current unit.
 */
export function parseLength(text: string, unit: Unit): number | null {
	let value = text.trim();
	let inputUnit = unit;
	const suffix = value.match(/(mm|in|["″”])$/i);
	if (suffix) {
		inputUnit = suffix[0].toLowerCase() === "mm" ? "mm" : "in";
		value = value.slice(0, -suffix[0].length).trim();
	}
	if (inputUnit === "mm") return parseDecimal(value, true);
	const inches = parseInches(value);
	return inches === null ? null : inchesToMm(inches);
}

function parseDecimal(text: string, allowGrouping: boolean): number | null {
	const value = allowGrouping ? text.replace(/\s/g, "") : text;
	if (!/^(\d+([.,]\d*)?|[.,]\d+)$/.test(value)) return null;
	return Number(value.replace(",", "."));
}

function parseInches(text: string): number | null {
	const mixed = text.match(/^(?:(\d+)(?:\s+|\s*-\s*))?(\d+)\s*\/\s*(\d+)$/);
	if (!mixed) return parseDecimal(text, false);
	const [, whole = "0", numerator, denominator] = mixed;
	if (!numerator || !denominator || Number(denominator) === 0) return null;
	return Number(whole) + Number(numerator) / Number(denominator);
}
