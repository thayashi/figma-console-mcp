import type { ToolDefinition } from "../types.js";

export function normalizeToolDefinitions(
	definitions: ToolDefinition<any, any>[],
): ToolDefinition<any, any>[] {
	return definitions.map((definition) => normalizeToolDefinition(definition));
}

function normalizeToolDefinition(
	definition: ToolDefinition<any, any>,
): ToolDefinition<any, any> {
	return {
		...definition,
		summary: normalizeSentence(definition.summary),
		description: normalizeDescription(definition.description),
		tags: normalizeStringList(definition.tags, { prioritize: "figma" }),
		relatedTools: normalizeStringList(
			(definition.relatedTools || []).filter((toolName) => toolName !== definition.name),
		),
	};
}

function normalizeSentence(value: string): string {
	const trimmed = value.trim();
	if (!trimmed) {
		return trimmed;
	}
	if (/[.!?]$/.test(trimmed)) {
		return trimmed;
	}
	return `${trimmed}.`;
}

function normalizeDescription(value: string): string {
	return value.trim().replace(/\s+/g, " ");
}

function normalizeStringList(values: string[], options?: { prioritize?: string }): string[] {
	const seen = new Set<string>();
	const normalized: string[] = [];

	for (const value of values) {
		const trimmed = value.trim();
		if (!trimmed || seen.has(trimmed)) {
			continue;
		}
		seen.add(trimmed);
		normalized.push(trimmed);
	}

	if (options?.prioritize) {
		const priority = options.prioritize;
		const index = normalized.indexOf(priority);
		if (index > 0) {
			normalized.splice(index, 1);
			normalized.unshift(priority);
		}
	}

	return normalized;
}
