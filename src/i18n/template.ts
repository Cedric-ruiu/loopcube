export const fill = (
	template: string,
	values: Record<string, string | number>,
): string =>
	template.replace(/\{(\w+)\}/g, (match, key: string) =>
		String(values[key] ?? match),
	);
