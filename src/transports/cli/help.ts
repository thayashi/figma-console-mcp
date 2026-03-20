import type { ToolDescriptor } from "../../tools/types.js";

export function formatToolList(tools: ToolDescriptor[]): string {
	if (tools.length === 0) {
		return JSON.stringify({ tools: [] }, null, 2);
	}

	return JSON.stringify(
		{
			tools: tools.map((tool) => ({
				name: tool.name,
				summary: tool.summary,
				discoveryGroup: tool.discoveryGroup,
				tags: tool.tags,
				capabilities: tool.capabilities,
			})),
		},
		null,
		2,
	);
}

export function formatToolDetails(tool: ToolDescriptor): string {
	return JSON.stringify(tool, null, 2);
}

export function formatCliUsage(): string {
	return [
		"Usage:",
		"  figma-console tools list --json",
		"  figma-console tools show <tool> --json",
		"  figma-console invoke <tool> --input @payload.json",
		"  figma-console daemon status",
	].join("\n");
}
