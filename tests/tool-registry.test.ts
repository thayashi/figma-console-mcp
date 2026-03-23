import { z } from "zod";
import { normalizeToolDescriptor, serializeToolDefinition, ToolRegistry } from "../src/tools/registry";
import type { ToolDefinition } from "../src/tools/types";

describe("Tool registry descriptor normalization", () => {
	it("normalizes serialized descriptors with capability defaults and stable ordering", () => {
		const definition: ToolDefinition = {
			name: "figma_example_tool",
			summary: "Example tool",
			description: "  Example    descriptor for testing  ",
			tags: ["runtime", "figma", "runtime"],
			discoveryGroup: " runtime ",
			inputSchema: z.object({
				nodeId: z.string(),
			}),
			capabilities: {
				supportsCli: true,
			},
			examples: [
				{ title: "beta example", input: {} },
				{ title: "Alpha example", input: {}, notes: "  extra note  " },
			],
			relatedTools: ["figma_b", "figma_a", "figma_b"],
			commonErrors: [
				{ code: "Z_ERR", message: "validation failed" },
				{ code: "A_ERR", message: "missing node", hint: "  pass nodeId  " },
			],
			handler: async () => ({}),
		};

		const descriptor = serializeToolDefinition(definition);

		expect(descriptor.summary).toBe("Example tool.");
		expect(descriptor.description).toBe("Example descriptor for testing");
		expect(descriptor.tags).toEqual(["figma", "runtime"]);
		expect(descriptor.discoveryGroup).toBe("runtime");
		expect(descriptor.capabilities).toEqual({
			requiresPlugin: false,
			requiresRestToken: false,
			supportsHttp: false,
			supportsCli: true,
			supportsMcp: false,
			responseShape: "medium",
			sideEffects: "none",
		});
		expect(descriptor.examples.map((example) => example.title)).toEqual(["Alpha example.", "beta example."]);
		expect(descriptor.examples[0].notes).toBe("extra note");
		expect(descriptor.relatedTools).toEqual(["figma_a", "figma_b"]);
		expect(descriptor.commonErrors).toEqual([
			{ code: "A_ERR", message: "missing node.", hint: "pass nodeId" },
			{ code: "Z_ERR", message: "validation failed.", hint: undefined },
		]);
	});

	it("normalizes descriptors returned by registry describeAll", () => {
		const registry = new ToolRegistry();
		registry.register({
			name: "figma_registry_tool",
			summary: "Registry tool",
			description: "Registry descriptor",
			tags: ["figma", "runtime"],
			discoveryGroup: "runtime",
			inputSchema: z.object({}),
			capabilities: {},
			relatedTools: ["figma_registry_tool_helper", "figma_registry_tool_helper"],
			handler: async () => ({}),
		});

		const [descriptor] = registry.describeAll();
		expect(descriptor.relatedTools).toEqual(["figma_registry_tool_helper"]);
		expect(descriptor.capabilities.responseShape).toBe("medium");
		expect(descriptor.capabilities.sideEffects).toBe("none");
	});

	it("can normalize an already-serialized descriptor shape", () => {
		const descriptor = normalizeToolDescriptor({
			name: "figma_tool",
			summary: "Needs normalization",
			description: "  Some description ",
			tags: ["tools", "figma", "tools"],
			discoveryGroup: "analysis",
			capabilities: {},
			examples: [],
			relatedTools: [],
			commonErrors: [],
			inputSchema: {},
			outputSchema: undefined,
		});

		expect(descriptor.summary).toBe("Needs normalization.");
		expect(descriptor.tags).toEqual(["figma", "tools"]);
		expect(descriptor.capabilities.supportsCli).toBe(false);
	});
});
