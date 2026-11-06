import type { PatternKind } from "../geometry";
import type { Unit } from "../units/units";

// Umami custom events. The tracker script is loaded with `defer` from the
// stats host and may be missing (ad blocker, network error, or a domain
// outside `data-domains`), so every call is a guarded no-op in that case.

/**
 * Every custom event and its data. Plain links send theirs through
 * `data-umami-event` attributes: contact-email (mailto), github-repo,
 * github-issues, author-site, lang-switch (`to`).
 */
interface Events {
	/** First setting changed by the visitor, once per page load */
	"configurator-use": undefined;
	"unit-change": { unit: Unit };
	"view-option": {
		option: "colors" | "marks" | "human";
		value: string | boolean;
	};
	"diagonal-view": undefined;
	/** From the plan button or the browser's own print command */
	"plan-print": {
		unit: Unit;
		pattern: PatternKind;
		profile: "square" | "round-elbow" | "round-bent";
		method: "button" | "browser";
	};
	"contact-email": { method: "mailto" | "copy" };
	share: { method: "native" | "copy" };
}

declare global {
	interface Window {
		umami?: { track: (name: string, data?: object) => void };
	}
}

export function track<E extends keyof Events>(
	name: E,
	...data: Events[E] extends undefined ? [] : [Events[E]]
): void {
	try {
		window.umami?.track(name, data[0]);
	} catch {
		// Analytics must never break the page.
	}
}
