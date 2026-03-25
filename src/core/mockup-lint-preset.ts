import type { LoadedProjectPolicy } from "../daemon/project-policy.js";

export const mockupQualityLintRules = [
	"no-autolayout",
	"empty-container",
	"default-name",
	"detached-component",
	"hardcoded-color",
	"no-text-style",
	"wcag-text-size",
	"wcag-line-height",
] as const;

export const lintRulePresets = {
	"mockup-quality": [...mockupQualityLintRules],
} as const;

export type LintRulePresetName = keyof typeof lintRulePresets;

export function resolveLintRuleRequest(options: {
	rules?: string[];
	preset?: LintRulePresetName;
	policy?: LoadedProjectPolicy | null;
}): {
	requestSource: "input" | "project-policy" | "default";
	appliedPresets: LintRulePresetName[];
	resolvedRules: string[];
} {
	const requestedRules = normalizeRequestedRules(options.rules, options.preset);
	const requestSource = requestedRules.length > 0
		? "input"
		: options.policy?.policy.validation.lintRules?.length
			? "project-policy"
			: "default";
	const ruleSource = requestedRules.length > 0
		? requestedRules
		: options.policy?.policy.validation.lintRules?.length
			? options.policy.policy.validation.lintRules
			: ["all"];

	return expandRequestedRules(ruleSource, requestSource);
}

function normalizeRequestedRules(rules?: string[], preset?: LintRulePresetName): string[] {
	const values = [...(rules || [])];
	if (preset) {
		values.push(preset);
	}
	return dedupe(values);
}

function expandRequestedRules(
	requestedRules: string[],
	requestSource: "input" | "project-policy" | "default",
): {
	requestSource: "input" | "project-policy" | "default";
	appliedPresets: LintRulePresetName[];
	resolvedRules: string[];
} {
	if (requestedRules.includes("all")) {
		return {
			requestSource,
			appliedPresets: requestedRules.filter(isPresetName) as LintRulePresetName[],
			resolvedRules: ["all"],
		};
	}

	const appliedPresets = requestedRules.filter(isPresetName) as LintRulePresetName[];
	const explicitRules = requestedRules.filter((rule) => !isPresetName(rule));
	const presetRules = appliedPresets.flatMap((preset) => lintRulePresets[preset]);

	return {
		requestSource,
		appliedPresets,
		resolvedRules: dedupe([...explicitRules, ...presetRules]),
	};
}

function isPresetName(value: string): value is LintRulePresetName {
	return value in lintRulePresets;
}

function dedupe(values: string[]): string[] {
	return Array.from(new Set(values.filter(Boolean)));
}
