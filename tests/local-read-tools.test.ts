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

	it("resize node schema defaults withConstraints to true", () => {
		const resizeTool = createLocalReadToolDefinitions().find((tool) => tool.name === "figma_resize_node");
		expect(resizeTool).toBeDefined();

		const parsed = resizeTool!.inputSchema.parse({
			nodeId: "123:456",
			width: 320,
			height: 120,
		});

		expect(parsed.withConstraints).toBe(true);
	});

	it("resize node handler proxies to the desktop connector", async () => {
		const resizeTool = createLocalReadToolDefinitions().find((tool) => tool.name === "figma_resize_node");
		expect(resizeTool).toBeDefined();

		const connector = {
			resizeNode: jest.fn().mockResolvedValue({
				success: true,
				node: { id: "123:456", width: 320, height: 120 },
			}),
		};

		const result = await resizeTool!.handler(
			{ runtime: { getDesktopConnector: async () => connector } } as any,
			{ nodeId: "123:456", width: 320, height: 120, withConstraints: true },
		);

		expect(connector.resizeNode).toHaveBeenCalledWith("123:456", 320, 120, true);
		expect(result.message).toBe("Node resized to 320x120");
	});

	it("set fills handler proxies to the desktop connector", async () => {
		const fillsTool = createLocalReadToolDefinitions().find((tool) => tool.name === "figma_set_fills");
		expect(fillsTool).toBeDefined();

		const fills = [{ type: "SOLID", color: "#FF0000" }];
		const connector = {
			setNodeFills: jest.fn().mockResolvedValue({
				success: true,
				node: { id: "123:456", fills },
			}),
		};

		const result = await fillsTool!.handler(
			{ runtime: { getDesktopConnector: async () => connector } } as any,
			{ nodeId: "123:456", fills },
		);

		expect(connector.setNodeFills).toHaveBeenCalledWith("123:456", fills);
		expect(result.message).toBe("Fills updated successfully");
	});

	it("set strokes handler proxies to the desktop connector", async () => {
		const strokesTool = createLocalReadToolDefinitions().find((tool) => tool.name === "figma_set_strokes");
		expect(strokesTool).toBeDefined();

		const strokes = [{ type: "SOLID", color: "#111111" }];
		const connector = {
			setNodeStrokes: jest.fn().mockResolvedValue({
				success: true,
				node: { id: "123:456", strokes, strokeWeight: 2 },
			}),
		};

		const result = await strokesTool!.handler(
			{ runtime: { getDesktopConnector: async () => connector } } as any,
			{ nodeId: "123:456", strokes, strokeWeight: 2 },
		);

		expect(connector.setNodeStrokes).toHaveBeenCalledWith("123:456", strokes, 2);
		expect(result.message).toBe("Strokes updated successfully");
	});

	it("set opacity schema constrains values to 0-1", () => {
		const opacityTool = createLocalReadToolDefinitions().find((tool) => tool.name === "figma_set_opacity");
		expect(opacityTool).toBeDefined();

		const parsed = opacityTool!.inputSchema.parse({
			nodeId: "123:456",
			opacity: 0.5,
		});

		expect(parsed.opacity).toBe(0.5);
	});

	it("set opacity handler proxies to the desktop connector", async () => {
		const opacityTool = createLocalReadToolDefinitions().find((tool) => tool.name === "figma_set_opacity");
		expect(opacityTool).toBeDefined();

		const connector = {
			setNodeOpacity: jest.fn().mockResolvedValue({
				success: true,
				node: { id: "123:456", opacity: 0.5 },
			}),
		};

		const result = await opacityTool!.handler(
			{ runtime: { getDesktopConnector: async () => connector } } as any,
			{ nodeId: "123:456", opacity: 0.5 },
		);

		expect(connector.setNodeOpacity).toHaveBeenCalledWith("123:456", 0.5);
		expect(result.message).toBe("Opacity updated successfully");
	});

	it("set corner radius handler proxies to the desktop connector", async () => {
		const radiusTool = createLocalReadToolDefinitions().find((tool) => tool.name === "figma_set_corner_radius");
		expect(radiusTool).toBeDefined();

		const connector = {
			setNodeCornerRadius: jest.fn().mockResolvedValue({
				success: true,
				node: { id: "123:456", cornerRadius: 8 },
			}),
		};

		const result = await radiusTool!.handler(
			{ runtime: { getDesktopConnector: async () => connector } } as any,
			{ nodeId: "123:456", radius: 8 },
		);

		expect(connector.setNodeCornerRadius).toHaveBeenCalledWith("123:456", 8);
		expect(result.message).toBe("Corner radius updated successfully");
	});

	it("move node handler proxies to the desktop connector", async () => {
		const moveTool = createLocalReadToolDefinitions().find((tool) => tool.name === "figma_move_node");
		expect(moveTool).toBeDefined();

		const connector = {
			moveNode: jest.fn().mockResolvedValue({
				success: true,
				node: { id: "123:456", x: 240, y: 320 },
			}),
		};

		const result = await moveTool!.handler(
			{ runtime: { getDesktopConnector: async () => connector } } as any,
			{ nodeId: "123:456", x: 240, y: 320 },
		);

		expect(connector.moveNode).toHaveBeenCalledWith("123:456", 240, 320);
		expect(result.message).toBe("Node moved to (240, 320)");
	});

	it("rename node handler proxies to the desktop connector", async () => {
		const renameTool = createLocalReadToolDefinitions().find((tool) => tool.name === "figma_rename_node");
		expect(renameTool).toBeDefined();

		const connector = {
			renameNode: jest.fn().mockResolvedValue({
				success: true,
				node: { id: "123:456", name: "Primary Button / Hover" },
			}),
		};

		const result = await renameTool!.handler(
			{ runtime: { getDesktopConnector: async () => connector } } as any,
			{ nodeId: "123:456", newName: "Primary Button / Hover" },
		);

		expect(connector.renameNode).toHaveBeenCalledWith("123:456", "Primary Button / Hover");
		expect(result.message).toBe('Node renamed to "Primary Button / Hover"');
	});

	it("clone node handler proxies to the desktop connector", async () => {
		const cloneTool = createLocalReadToolDefinitions().find((tool) => tool.name === "figma_clone_node");
		expect(cloneTool).toBeDefined();

		const connector = {
			cloneNode: jest.fn().mockResolvedValue({
				success: true,
				node: { id: "999:111", name: "Clone of Button" },
			}),
		};

		const result = await cloneTool!.handler(
			{ runtime: { getDesktopConnector: async () => connector } } as any,
			{ nodeId: "123:456" },
		);

		expect(connector.cloneNode).toHaveBeenCalledWith("123:456");
		expect(result.message).toBe("Node cloned");
		expect(result.clonedNode).toMatchObject({ id: "999:111" });
	});

	it("delete node handler proxies to the desktop connector", async () => {
		const deleteTool = createLocalReadToolDefinitions().find((tool) => tool.name === "figma_delete_node");
		expect(deleteTool).toBeDefined();

		const connector = {
			deleteNode: jest.fn().mockResolvedValue({
				success: true,
				deleted: true,
			}),
		};

		const result = await deleteTool!.handler(
			{ runtime: { getDesktopConnector: async () => connector } } as any,
			{ nodeId: "123:456" },
		);

		expect(connector.deleteNode).toHaveBeenCalledWith("123:456");
		expect(result.message).toBe("Node deleted");
		expect(result.deleted).toBe(true);
	});

	it("set text content schema accepts optional font overrides", () => {
		const textTool = createLocalReadToolDefinitions().find((tool) => tool.name === "figma_set_text_content");
		expect(textTool).toBeDefined();

		const parsed = textTool!.inputSchema.parse({
			nodeId: "123:456",
			text: "Save changes",
			fontSize: 14,
			fontWeight: 600,
			fontFamily: "Inter",
		});

		expect(parsed.text).toBe("Save changes");
		expect(parsed.fontSize).toBe(14);
		expect(parsed.fontWeight).toBe(600);
		expect(parsed.fontFamily).toBe("Inter");
	});

	it("set text content handler proxies to the desktop connector", async () => {
		const textTool = createLocalReadToolDefinitions().find((tool) => tool.name === "figma_set_text_content");
		expect(textTool).toBeDefined();

		const connector = {
			setTextContent: jest.fn().mockResolvedValue({
				success: true,
				node: { id: "123:456", characters: "Save changes" },
			}),
		};

		const result = await textTool!.handler(
			{ runtime: { getDesktopConnector: async () => connector } } as any,
			{
				nodeId: "123:456",
				text: "Save changes",
				fontSize: 14,
				fontWeight: 600,
				fontFamily: "Inter",
			},
		);

		expect(connector.setTextContent).toHaveBeenCalledWith("123:456", "Save changes", {
			fontSize: 14,
			fontWeight: 600,
			fontFamily: "Inter",
		});
		expect(result.message).toBe("Text content updated");
	});

	it("create child handler proxies to the desktop connector", async () => {
		const createChildTool = createLocalReadToolDefinitions().find((tool) => tool.name === "figma_create_child");
		expect(createChildTool).toBeDefined();

		const connector = {
			createChildNode: jest.fn().mockResolvedValue({
				success: true,
				node: { id: "999:111", type: "TEXT", name: "Label" },
			}),
		};

		const input = {
			parentId: "123:456",
			nodeType: "TEXT" as const,
			properties: {
				name: "Label",
				x: 16,
				y: 12,
				text: "Save changes",
			},
		};

		const result = await createChildTool!.handler(
			{ runtime: { getDesktopConnector: async () => connector } } as any,
			input,
		);

		expect(connector.createChildNode).toHaveBeenCalledWith("123:456", "TEXT", input.properties);
		expect(result.message).toBe("Created TEXT node");
		expect(result.node).toMatchObject({ id: "999:111" });
	});

	it("set image fill handler proxies to the desktop connector", async () => {
		const imageFillTool = createLocalReadToolDefinitions().find((tool) => tool.name === "figma_set_image_fill");
		expect(imageFillTool).toBeDefined();

		const connector = {
			setImageFill: jest.fn().mockResolvedValue({
				success: true,
				updatedCount: 1,
				imageHash: "hash123",
				nodes: [{ id: "123:456" }],
			}),
		};

		const result = await imageFillTool!.handler(
			{ runtime: { getDesktopConnector: async () => connector } } as any,
			{
				nodeIds: ["123:456"],
				imageData: "iVBORw0KGgoAAAANSUhEUgAA...",
				scaleMode: "FILL",
			},
		);

		expect(connector.setImageFill).toHaveBeenCalledWith(
			["123:456"],
			"iVBORw0KGgoAAAANSUhEUgAA...",
			"FILL",
		);
		expect(result.message).toBe("Image fill applied to 1 node(s)");
		expect(result.imageHash).toBe("hash123");
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

	it("capture screenshot handler proxies to the desktop connector", async () => {
		const screenshotTool = createLocalReadToolDefinitions().find((tool) => tool.name === "figma_capture_screenshot");
		expect(screenshotTool).toBeDefined();

		const connector = {
			captureScreenshot: jest.fn().mockResolvedValue({
				success: true,
				image: {
					base64: "abc123",
					format: "PNG",
					scale: 2,
					byteLength: 1024,
					node: { id: "123:456" },
					bounds: { x: 0, y: 0, width: 100, height: 100 },
				},
			}),
		};

		const result = await screenshotTool!.handler(
			{ runtime: { getDesktopConnector: async () => connector } } as any,
			{ nodeId: "123:456", format: "PNG", scale: 2 },
		);

		expect(connector.captureScreenshot).toHaveBeenCalledWith("123:456", { format: "PNG", scale: 2 });
		expect(result.success).toBe(true);
		expect(result.image.base64).toBe("abc123");
	});

	it("lint design handler proxies to the desktop connector", async () => {
		const lintTool = createLocalReadToolDefinitions().find((tool) => tool.name === "figma_lint_design");
		expect(lintTool).toBeDefined();

		const connector = {
			lintDesign: jest.fn().mockResolvedValue({
				success: true,
				data: {
					summary: { totalFindings: 1 },
					findings: [{ id: "wcag-contrast", severity: "critical" }],
				},
			}),
		};

		const result = await lintTool!.handler(
			{ runtime: { getDesktopConnector: async () => connector } } as any,
			{ nodeId: "123:456", rules: ["wcag"], maxDepth: 5, maxFindings: 20 },
		);

		expect(connector.lintDesign).toHaveBeenCalledWith("123:456", ["wcag"], 5, 20);
		expect(result.summary.totalFindings).toBe(1);
		expect(result.findings[0].id).toBe("wcag-contrast");
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
