import type { ToolDescriptor } from "../../tools/types.js";

const discoveryGroupLabels: Record<string, string> = {
	runtime: "Runtime",
	"design-system": "Design System",
	document: "Document",
	analysis: "Analysis",
	execute: "Execute",
	variables: "Variables",
	components: "Components",
	content: "Content",
	styling: "Styling",
	metadata: "Metadata",
	nodes: "Nodes",
	write: "Write",
};

const discoveryGroupOrder = [
	"runtime",
	"design-system",
	"document",
	"analysis",
	"execute",
	"variables",
	"components",
	"content",
	"styling",
	"metadata",
	"nodes",
	"write",
];

export function formatToolList(tools: ToolDescriptor[]): string {
	if (tools.length === 0) {
		return JSON.stringify({ tools: [] }, null, 2);
	}

	const groups = buildToolGroups(tools);

	return JSON.stringify(
		{
			totalTools: tools.length,
			groupCount: groups.length,
			groups,
		},
		null,
		2,
	);
}

export function formatToolDetails(tool: ToolDescriptor): string {
	const transports = {
		cli: tool.capabilities.supportsCli ?? false,
		http: tool.capabilities.supportsHttp ?? false,
		mcp: tool.capabilities.supportsMcp ?? false,
	};
	const requirements = {
		pluginConnection: tool.capabilities.requiresPlugin ?? false,
		restToken: tool.capabilities.requiresRestToken ?? false,
	};

	return JSON.stringify(
		{
			name: tool.name,
			summary: tool.summary,
			description: tool.description,
			discovery: {
				group: tool.discoveryGroup,
				label: discoveryGroupLabels[tool.discoveryGroup] || tool.discoveryGroup,
				tags: tool.tags,
				relatedTools: tool.relatedTools,
			},
			agentGuidance: {
				whenToUse: buildWhenToUse(tool),
				startWith: buildStartWith(tool),
				requirementNotes: buildRequirementNotes(requirements),
				invocationPattern: "Inspect inputSchema first, then invoke with a focused input object.",
			},
			requirements,
			transports,
			output: {
				responseShape: tool.capabilities.responseShape || "medium",
				sideEffects: tool.capabilities.sideEffects || "none",
			},
			examples: tool.examples,
			commonErrors: tool.commonErrors,
			inputSchema: tool.inputSchema,
			outputSchema: tool.outputSchema,
		},
		null,
		2,
	);
}

export function formatCliUsage(): string {
	return [
		"Usage:",
		"  figma-console tools list",
		"  figma-console tools show <tool>",
		"  figma-console invoke <tool> --input @payload.json",
		"  figma-console invoke <tool> --input '{\"query\":\"Button\"}'",
		"  figma-console daemon status",
		"",
		"Notes:",
		"  All commands emit JSON.",
		"  Start the daemon first with `figma-console daemon start`.",
	].join("\n");
}

function buildToolGroups(tools: ToolDescriptor[]) {
	const grouped = new Map<string, ToolDescriptor[]>();

	for (const tool of tools) {
		const group = tool.discoveryGroup || "other";
		const existing = grouped.get(group) || [];
		existing.push(tool);
		grouped.set(group, existing);
	}

	const sortedGroupIds = Array.from(grouped.keys()).sort((a, b) => {
		const aIndex = discoveryGroupOrder.indexOf(a);
		const bIndex = discoveryGroupOrder.indexOf(b);
		if (aIndex === -1 && bIndex === -1) {
			return a.localeCompare(b);
		}
		if (aIndex === -1) {
			return 1;
		}
		if (bIndex === -1) {
			return -1;
		}
		return aIndex - bIndex;
	});

	return sortedGroupIds.map((groupId) => {
		const groupTools = (grouped.get(groupId) || []).slice().sort((a, b) => a.name.localeCompare(b.name));
		return {
			id: groupId,
			label: discoveryGroupLabels[groupId] || groupId,
			count: groupTools.length,
			tools: groupTools.map((tool) => ({
				name: tool.name,
				summary: tool.summary,
				tags: tool.tags,
				requiresPlugin: tool.capabilities.requiresPlugin ?? false,
				requiresRestToken: tool.capabilities.requiresRestToken ?? false,
				transports: summarizeTransports(tool),
				responseShape: tool.capabilities.responseShape || "medium",
				sideEffects: tool.capabilities.sideEffects || "none",
			})),
		};
	});
}

function summarizeTransports(tool: ToolDescriptor): string[] {
	const transports: string[] = [];
	if (tool.capabilities.supportsCli) {
		transports.push("cli");
	}
	if (tool.capabilities.supportsHttp) {
		transports.push("http");
	}
	if (tool.capabilities.supportsMcp) {
		transports.push("mcp");
	}
	return transports;
}

function buildWhenToUse(tool: ToolDescriptor): string {
	switch (tool.discoveryGroup) {
		case "runtime":
			return "Use this to understand daemon state, active files, selection state, or plugin-side activity before invoking deeper reads or writes.";
		case "design-system":
			return "Use this to discover variables, components, library assets, or design-system structure before choosing a concrete node or write action.";
		case "document":
			return "Use this to inspect file structure or fetch stable REST-backed visual/document data for a specific node.";
		case "analysis":
			return "Use this after discovery or writes when you need validation, linting, screenshots, or parity analysis.";
		case "execute":
			return "Use this only when higher-level tools are insufficient and you need direct Plugin API execution.";
		case "variables":
			return "Use this when creating, updating, renaming, or deleting variables, modes, or token collections.";
		case "components":
			return "Use this when instantiating components or editing component and instance properties.";
		case "content":
			return "Use this when editing text content or applying uploaded image content to nodes.";
		case "styling":
			return "Use this when changing fills, strokes, opacity, or corner radius on existing nodes.";
		case "metadata":
			return "Use this when changing names or descriptions rather than visual layout or content.";
		case "nodes":
			return "Use this when creating, moving, resizing, duplicating, or deleting nodes.";
		default:
			return "Use this when its summary matches the task more closely than the surrounding discovery or write tools.";
	}
}

function buildStartWith(tool: ToolDescriptor): string[] {
	const defaults = ["Read the summary and description.", "Inspect the inputSchema for required fields and defaults."];

	if (tool.discoveryGroup === "components") {
		return ["Start with figma_search_components or figma_get_component_details to identify the correct component or variant.", ...defaults];
	}
	if (tool.discoveryGroup === "variables") {
		return ["Start with figma_get_variables or figma_get_design_system_summary to confirm current token structure.", ...defaults];
	}
	if (tool.discoveryGroup === "styling" || tool.discoveryGroup === "nodes" || tool.discoveryGroup === "content" || tool.discoveryGroup === "metadata") {
		return ["Start with figma_get_selection or figma_get_file_data to confirm the target node IDs.", ...defaults];
	}
	if (tool.discoveryGroup === "analysis") {
		return ["Start with runtime or design-system discovery tools to narrow the target file or node before running analysis.", ...defaults];
	}

	return defaults;
}

function buildRequirementNotes(requirements: { pluginConnection: boolean; restToken: boolean }): string[] {
	const notes: string[] = [];
	if (requirements.pluginConnection) {
		notes.push("Requires an active Desktop Bridge plugin connection.");
	}
	if (requirements.restToken) {
		notes.push("Requires REST authentication, usually via FIGMA_ACCESS_TOKEN.");
	}
	if (notes.length === 0) {
		notes.push("No extra runtime prerequisites beyond the daemon itself.");
	}
	return notes;
}
