import { createLocalReadToolDefinitions } from "../src/tools/catalog/local-read-tools";

describe("Local Read Tool Definitions", () => {
	it("parity tool schema accepts expanded MCP parity fields", () => {
		const parityTool = createLocalReadToolDefinitions().find((tool) => tool.name === "figma_check_design_parity");
		expect(parityTool).toBeDefined();

		const parsed = parityTool!.inputSchema.parse({
			fileUrl: "https://www.figma.com/design/abc123def456/Design-System",
			nodeId: "123:456",
			codeSpec: {
				filePath: "src/components/Button.tsx",
				visual: {
					backgroundColor: "#FFFFFF",
					borderRadius: "8",
					effects: [{ type: "DROP_SHADOW", blur: 4 }],
				},
				spacing: {
					paddingTop: 12,
					layoutDirection: "horizontal",
				},
				typography: {
					fontFamily: "Inter",
					textTransform: "uppercase",
				},
				tokens: {
					usedTokens: ["color.background.brand"],
					hardcodedValues: [{ property: "backgroundColor", value: "#FFFFFF" }],
				},
				componentAPI: {
					props: [{ name: "variant", type: "string", values: ["primary", "secondary"] }],
					events: ["click"],
					slots: ["icon"],
				},
				accessibility: {
					role: "button",
					contrastRatio: 4.5,
				},
				metadata: {
					name: "Button",
					status: "stable",
				},
			},
			canonicalSource: "code",
			enrich: false,
		});

		expect(parsed.enrich).toBe(false);
		expect(parsed.codeSpec.tokens?.usedTokens).toContain("color.background.brand");
		expect(parsed.codeSpec.componentAPI?.props?.[0]?.name).toBe("variant");
		expect(parsed.codeSpec.accessibility?.role).toBe("button");
	});

	it("parity tool handler returns shared parity analysis with action items", async () => {
		const parityTool = createLocalReadToolDefinitions().find((tool) => tool.name === "figma_check_design_parity");
		expect(parityTool).toBeDefined();

		const mockApi = {
			getNodes: jest.fn().mockResolvedValue({
				nodes: {
					"123:456": {
						document: {
							id: "123:456",
							type: "COMPONENT",
							name: "Button",
							description: "Stable button component.",
							fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1 }, opacity: 1 }],
							strokes: [{ type: "SOLID", color: { r: 0, g: 0, b: 0 }, opacity: 1 }],
							strokeWeight: 1,
							cornerRadius: 8,
							opacity: 1,
							paddingTop: 12,
							paddingRight: 16,
							paddingBottom: 12,
							paddingLeft: 16,
							itemSpacing: 8,
							absoluteBoundingBox: { width: 120, height: 40 },
							componentPropertyDefinitions: {
								State: {
									type: "VARIANT",
									defaultValue: "Default",
									variantOptions: ["Default", "Hover"],
								},
							},
							children: [
								{
									type: "TEXT",
									style: {
										fontFamily: "Inter",
										fontSize: 14,
										fontWeight: 500,
										lineHeightPx: 20,
										letterSpacing: 0,
									},
								},
							],
						},
					},
				},
			}),
			getComponents: jest.fn().mockResolvedValue({
				meta: {
					components: [
						{
							node_id: "123:456",
							description: "Stable button component.",
						},
					],
				},
			}),
		};

		const runtime = {
			getCurrentFileUrl: () => "https://www.figma.com/design/abc123def456/Design-System",
			getFigmaAPI: async () => mockApi,
		} as any;

		const result = await parityTool!.handler(
			{ runtime } as any,
			{
				nodeId: "123:456",
				canonicalSource: "code",
				enrich: false,
				codeSpec: {
					filePath: "src/components/Button.tsx",
					visual: {
						backgroundColor: "#000000",
						borderRadius: 4,
					},
					componentAPI: {
						props: [{ name: "variant", type: "string", values: ["primary", "secondary"] }],
					},
					accessibility: {
						role: "button",
						contrastRatio: 3.2,
					},
					metadata: {
						description: "Experimental button component.",
					},
				},
			},
		);

		expect(mockApi.getNodes).toHaveBeenCalledWith("abc123def456", ["123:456"], { depth: 2 });
		expect(result.summary.totalDiscrepancies).toBeGreaterThan(0);
		expect(result.summary.categories.visual).toBeGreaterThan(0);
		expect(result.summary.categories.componentAPI).toBeGreaterThan(0);
		expect(result.summary.categories.accessibility).toBeGreaterThan(0);
		expect(result.actionItems.some((item: any) => item.side === "design")).toBe(true);
		expect(result.actionItems.some((item: any) => item.figmaTool === "figma_set_fills")).toBe(true);
		expect(result.ai_instruction).toContain("Parity Report");
		expect(result.designData).toMatchObject({
			name: "Button",
			resolvedName: "Button",
			componentProperties: ["State"],
		});
	});
});
