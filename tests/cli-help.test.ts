import { formatCliUsage, formatToolDetails, formatToolList } from "../src/transports/cli/help";
import type { ToolDescriptor } from "../src/tools/types";

function createDescriptor(overrides: Partial<ToolDescriptor> = {}): ToolDescriptor {
	return {
		name: "figma_get_status",
		summary: "Get runtime status.",
		description: "Returns daemon and plugin connectivity.",
		tags: ["figma", "runtime"],
		discoveryGroup: "runtime",
		capabilities: {
			requiresPlugin: false,
			requiresRestToken: false,
			supportsCli: true,
			supportsHttp: true,
			supportsMcp: true,
			responseShape: "small",
			sideEffects: "none",
		},
		examples: [{ title: "Read status", input: {} }],
		relatedTools: ["figma_get_selection"],
		commonErrors: [],
		inputSchema: { type: "object", properties: {} },
		outputSchema: undefined,
		...overrides,
	};
}

describe("CLI help formatting", () => {
	it("formats tool list grouped by discovery group in stable order", () => {
		const output = JSON.parse(
			formatToolList([
				createDescriptor({
					name: "figma_get_file_data",
					discoveryGroup: "document",
					tags: ["figma", "file"],
				}),
				createDescriptor({
					name: "figma_get_status",
					discoveryGroup: "runtime",
				}),
				createDescriptor({
					name: "figma_check_design_parity",
					discoveryGroup: "analysis",
					tags: ["figma", "analysis"],
				}),
			]),
		);

		expect(output.totalTools).toBe(3);
		expect(output.groups.map((group: any) => group.id)).toEqual([
			"runtime",
			"document",
			"analysis",
		]);
		expect(output.groups[0].tools[0].name).toBe("figma_get_status");
		expect(output.groups[1].tools[0].transports).toEqual(["cli", "http", "mcp"]);
	});

	it("formats tool details with discovery, requirement, and transport sections", () => {
		const output = JSON.parse(
			formatToolDetails(
				createDescriptor({
					name: "figma_get_component_image",
					summary: "Render a node as an image.",
					description: "Renders a node via the REST image endpoint.",
					discoveryGroup: "document",
					capabilities: {
						requiresPlugin: false,
						requiresRestToken: true,
						supportsCli: true,
						supportsHttp: true,
						supportsMcp: true,
						responseShape: "small",
						sideEffects: "none",
					},
				}),
			),
		);

		expect(output.discovery.group).toBe("document");
		expect(output.discovery.label).toBe("Document");
		expect(output.agentGuidance.whenToUse).toContain("document");
		expect(output.agentGuidance.startWith[0]).toBe("Read the summary and description.");
		expect(output.agentGuidance.requirementNotes[0]).toContain("REST authentication");
		expect(output.requirements.restToken).toBe(true);
		expect(output.transports).toEqual({ cli: true, http: true, mcp: true });
		expect(output.output.responseShape).toBe("small");
	});

	it("formats CLI usage without misleading json-only flags", () => {
		const output = formatCliUsage();

		expect(output).toContain("figma-console tools list");
		expect(output).toContain("All commands emit JSON.");
		expect(output).not.toContain("--json");
	});

	it("orders specialized write groups after read-side discovery groups", () => {
		const output = JSON.parse(
			formatToolList([
				createDescriptor({
					name: "figma_update_variable",
					discoveryGroup: "variables",
				}),
				createDescriptor({
					name: "figma_execute",
					discoveryGroup: "execute",
				}),
				createDescriptor({
					name: "figma_set_fills",
					discoveryGroup: "styling",
				}),
				createDescriptor({
					name: "figma_create_child",
					discoveryGroup: "nodes",
				}),
			]),
		);

		expect(output.groups.map((group: any) => group.id)).toEqual([
			"execute",
			"variables",
			"styling",
			"nodes",
		]);
		expect(output.groups.map((group: any) => group.label)).toEqual([
			"Execute",
			"Variables",
			"Styling",
			"Nodes",
		]);
	});
});
