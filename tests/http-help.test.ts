import { buildHelpDocument } from "../src/transports/http/server";
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

describe("HTTP help document", () => {
	it("includes agent-oriented discovery, workflow, and grouped tool guidance", () => {
		const registry = {
			describeAll: () => [
				createDescriptor({
					name: "figma_get_status",
					discoveryGroup: "runtime",
				}),
				createDescriptor({
					name: "figma_search_components",
					discoveryGroup: "design-system",
				}),
				createDescriptor({
					name: "figma_execute",
					discoveryGroup: "execute",
				}),
			],
		} as any;

		const output = buildHelpDocument(registry) as any;

		expect(output.audience).toContain("daemon-first");
		expect(output.discoveryFlow[0]).toContain("/v1/status");
		expect(output.recommendations.startingPoints[0]).toContain("figma_get_status");
		expect(output.workflows[0].name).toBe("Discover Then Edit");
		expect(output.groupedTools).toEqual([
			{ group: "design-system", toolCount: 1, tools: ["figma_search_components"] },
			{ group: "execute", toolCount: 1, tools: ["figma_execute"] },
			{ group: "runtime", toolCount: 1, tools: ["figma_get_status"] },
		]);
		expect(output.decisionHints[0].use).toContain("figma_get_status");
		expect(output.examples.status.path).toBe("/v1/status");
	});
});
