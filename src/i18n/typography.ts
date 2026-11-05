/**
 * French typography: a no-break space keeps ? ! ; : and » on the line of the
 * word before, and « on the line of the word after. Applied to every string
 * of a messages object, so the source can keep plain spaces.
 */
export function frenchSpacing<T>(value: T): T {
	if (typeof value === "string") {
		return value
			.replace(/[ \u202f]([?!;:»])/g, "\u00a0$1")
			.replace(/« /g, "«\u00a0") as T;
	}
	if (Array.isArray(value)) return value.map(frenchSpacing) as T;
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value).map(([key, v]) => [key, frenchSpacing(v)]),
		) as T;
	}
	return value;
}
