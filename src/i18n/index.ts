import type { Unit } from "../units/units";
import { en } from "./en";
import { fr, type Messages } from "./fr";

export const locales = ["fr", "en"] as const;
export type Locale = (typeof locales)[number];

/** Served to browsers whose language is not available (x-default audience). */
export const fallbackLocale: Locale = "en";

const config: Record<
	Locale,
	{ messages: Messages; unit: Unit; ogLocale: string }
> = {
	fr: { messages: fr, unit: "mm", ogLocale: "fr_FR" },
	en: { messages: en, unit: "in", ogLocale: "en_US" },
};

export const t = (locale: Locale): Messages => config[locale].messages;
export const defaultUnit = (locale: Locale): Unit => config[locale].unit;
export const ogLocale = (locale: Locale): string => config[locale].ogLocale;

export const rootPath = (): string => import.meta.env.BASE_URL;
export const ogImagePath = (): string => `${import.meta.env.BASE_URL}og.png`;
export const localePath = (locale: Locale): string =>
	`${import.meta.env.BASE_URL}${locale}/`;
