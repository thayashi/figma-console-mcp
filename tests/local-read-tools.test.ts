import { createLocalReadToolDefinitions } from "../src/tools/catalog/local-read-tools";

describe("Local Read Tool Definitions", () => {
	it("instantiate component tool schema accepts key, nodeId, and placement options", () => {
		const instantiateTool = createLocalReadToolDefinitions().find((tool) => tool.name === "figma_instantiate_component");
		expect(instantiateTool).toBeDefined();

		const parsed = instantiateTool!.inputSchema.parse({
			componentKey: "component-key-123",
			nodeId: "123:456",
			variant: { State: "Hover" },
			overrides: { "Button Label": "Save", Disabled: false },
			position: { x: 100, y: 200 },
			parentId: "789:1011",
		});

		expect(parsed.componentKey).toBe("component-key-123");
		expect(parsed.nodeId).toBe("123:456");
		expect(parsed.variant?.State).toBe("Hover");
		expect(parsed.position).toEqual({ x: 100, y: 200 });
	});

	it("instantiate component handler proxies to the desktop connector", async () => {
		const instantiateTool = createLocalReadToolDefinitions().find((tool) => tool.name === "figma_instantiate_component");
		expect(instantiateTool).toBeDefined();

		const connector = {
			instantiateComponent: jest.fn().mockResolvedValue({
				success: true,
				instance: {
					id: "999:111",
					name: "Button/Primary",
				},
			}),
		};

		const runtime = {
			getDesktopConnector: async () => connector,
		} as any;

		const result = await instantiateTool!.handler(
			{ runtime } as any,
			{
				componentKey: "component-key-123",
				nodeId: "123:456",
				variant: { State: "Hover" },
				overrides: { "Button Label": "Save" },
				position: { x: 100, y: 200 },
				parentId: "789:1011",
			},
		);

		expect(connector.instantiateComponent).toHaveBeenCalledWith("component-key-123", {
			nodeId: "123:456",
			position: { x: 100, y: 200 },
			overrides: { "Button Label": "Save" },
			variant: { State: "Hover" },
			parentId: "789:1011",
		});
		expect(result.success).toBe(true);
		expect(result.instance).toMatchObject({ id: "999:111", name: "Button/Primary" });
	});

	it("instantiate component handler requires either componentKey or nodeId", async () => {
		const instantiateTool = createLocalReadToolDefinitions().find((tool) => tool.name === "figma_instantiate_component");
		expect(instantiateTool).toBeDefined();

		await expect(
			instantiateTool!.handler(
				{ runtime: { getDesktopConnector: async () => ({}) } } as any,
				{},
			),
		).rejects.toThrow("Either componentKey or nodeId is required.");
	});

	it("set instance properties schema accepts string and boolean values", () => {
		const setInstanceTool = createLocalReadToolDefinitions().find((tool) => tool.name === "figma_set_instance_properties");
		expect(setInstanceTool).toBeDefined();

		const parsed = setInstanceTool!.inputSchema.parse({
			nodeId: "123:456",
			properties: {
				Label: "Save",
				"Show Icon": true,
				State: "Hover",
			},
		});

		expect(parsed.nodeId).toBe("123:456");
		expect(parsed.properties.Label).toBe("Save");
		expect(parsed.properties["Show Icon"]).toBe(true);
	});

	it("set instance properties handler proxies to the desktop connector", async () => {
		const setInstanceTool = createLocalReadToolDefinitions().find((tool) => tool.name === "figma_set_instance_properties");
		expect(setInstanceTool).toBeDefined();

		const connector = {
			setInstanceProperties: jest.fn().mockResolvedValue({
				success: true,
				instance: {
					id: "123:456",
					componentProperties: {
						Label: "Save",
						"Show Icon": true,
					},
				},
			}),
		};

		const runtime = {
			getDesktopConnector: async () => connector,
		} as any;

		const result = await setInstanceTool!.handler(
			{ runtime } as any,
			{
				nodeId: "123:456",
				properties: {
					Label: "Save",
					"Show Icon": true,
				},
			},
		);

		expect(connector.setInstanceProperties).toHaveBeenCalledWith("123:456", {
			Label: "Save",
			"Show Icon": true,
		});
		expect(result.success).toBe(true);
		expect(result.instance).toMatchObject({ id: "123:456" });
		expect(result.metadata.note).toContain("Instance properties updated successfully");
	});

	it("add component property schema accepts supported property types", () => {
		const addPropertyTool = createLocalReadToolDefinitions().find((tool) => tool.name === "figma_add_component_property");
		expect(addPropertyTool).toBeDefined();

		const parsed = addPropertyTool!.inputSchema.parse({
			nodeId: "123:456",
			propertyName: "Show Icon",
			type: "BOOLEAN",
			defaultValue: true,
		});

		expect(parsed.nodeId).toBe("123:456");
		expect(parsed.propertyName).toBe("Show Icon");
		expect(parsed.type).toBe("BOOLEAN");
		expect(parsed.defaultValue).toBe(true);
	});

	it("add component property handler proxies to the desktop connector", async () => {
		const addPropertyTool = createLocalReadToolDefinitions().find((tool) => tool.name === "figma_add_component_property");
		expect(addPropertyTool).toBeDefined();

		const connector = {
			addComponentProperty: jest.fn().mockResolvedValue({
				success: true,
				propertyName: "Show Icon#123:456",
			}),
		};

		const runtime = {
			getDesktopConnector: async () => connector,
		} as any;

		const result = await addPropertyTool!.handler(
			{ runtime } as any,
			{
				nodeId: "123:456",
				propertyName: "Show Icon",
				type: "BOOLEAN",
				defaultValue: true,
			},
		);

		expect(connector.addComponentProperty).toHaveBeenCalledWith(
			"123:456",
			"Show Icon",
			"BOOLEAN",
			true,
		);
		expect(result.success).toBe(true);
		expect(result.propertyName).toBe("Show Icon#123:456");
		expect(result.hint).toContain("unique suffix");
	});

	it("set description schema accepts plain text and markdown", () => {
		const setDescriptionTool = createLocalReadToolDefinitions().find((tool) => tool.name === "figma_set_description");
		expect(setDescriptionTool).toBeDefined();

		const parsed = setDescriptionTool!.inputSchema.parse({
			nodeId: "123:456",
			description: "Primary call to action button.",
			descriptionMarkdown: "## Usage\nUse for primary actions.",
		});

		expect(parsed.nodeId).toBe("123:456");
		expect(parsed.description).toContain("Primary call to action");
		expect(parsed.descriptionMarkdown).toContain("## Usage");
	});

	it("set description handler proxies to the desktop connector", async () => {
		const setDescriptionTool = createLocalReadToolDefinitions().find((tool) => tool.name === "figma_set_description");
		expect(setDescriptionTool).toBeDefined();

		const connector = {
			setNodeDescription: jest.fn().mockResolvedValue({
				success: true,
				node: {
					id: "123:456",
					description: "Primary call to action button.",
				},
			}),
		};

		const runtime = {
			getDesktopConnector: async () => connector,
		} as any;

		const result = await setDescriptionTool!.handler(
			{ runtime } as any,
			{
				nodeId: "123:456",
				description: "Primary call to action button.",
				descriptionMarkdown: "## Usage\nUse for primary actions.",
			},
		);

		expect(connector.setNodeDescription).toHaveBeenCalledWith(
			"123:456",
			"Primary call to action button.",
			"## Usage\nUse for primary actions.",
		);
		expect(result.success).toBe(true);
		expect(result.message).toBe("Description set successfully");
		expect(result.node).toMatchObject({ id: "123:456" });
	});

	it("edit component property handler proxies to the desktop connector", async () => {
		const editTool = createLocalReadToolDefinitions().find((tool) => tool.name === "figma_edit_component_property");
		expect(editTool).toBeDefined();

		const connector = {
			editComponentProperty: jest.fn().mockResolvedValue({
				success: true,
				propertyName: "Show Leading Icon#123:456",
			}),
		};

		const result = await editTool!.handler(
			{ runtime: { getDesktopConnector: async () => connector } } as any,
			{
				nodeId: "123:456",
				propertyName: "Show Icon#123:456",
				newValue: {
					name: "Show Leading Icon",
					defaultValue: true,
				},
			},
		);

		expect(connector.editComponentProperty).toHaveBeenCalledWith(
			"123:456",
			"Show Icon#123:456",
			{
				name: "Show Leading Icon",
				defaultValue: true,
			},
		);
		expect(result.message).toBe("Component property updated");
		expect(result.propertyName).toBe("Show Leading Icon#123:456");
	});

	it("delete component property handler proxies to the desktop connector", async () => {
		const deletePropertyTool = createLocalReadToolDefinitions().find((tool) => tool.name === "figma_delete_component_property");
		expect(deletePropertyTool).toBeDefined();

		const connector = {
			deleteComponentProperty: jest.fn().mockResolvedValue({
				success: true,
			}),
		};

		const result = await deletePropertyTool!.handler(
			{ runtime: { getDesktopConnector: async () => connector } } as any,
			{
				nodeId: "123:456",
				propertyName: "Show Icon#123:456",
			},
		);

		expect(connector.deleteComponentProperty).toHaveBeenCalledWith(
			"123:456",
			"Show Icon#123:456",
		);
		expect(result.message).toBe("Component property deleted");
	});

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
