import { createLocalReadToolDefinitions as createReadToolDefinitions } from "../src/tools/catalog/local-read-tools";
import { createLocalWriteToolDefinitions } from "../src/tools/catalog/local-write-tools";
import { DesignSystemManifestCache } from "../src/core/design-system-manifest";

const createLocalReadToolDefinitions = () => [
	...createReadToolDefinitions(),
	...createLocalWriteToolDefinitions(),
];

describe("Local Read Tool Definitions", () => {
	beforeEach(() => {
		DesignSystemManifestCache.getInstance().invalidateAll();
	});

	it("splits read and write catalogs without overlapping tools", () => {
		const readToolNames = new Set(createReadToolDefinitions().map((tool) => tool.name));
		const writeToolNames = new Set(createLocalWriteToolDefinitions().map((tool) => tool.name));

		expect(readToolNames.has("figma_check_design_parity")).toBe(true);
		expect(readToolNames.has("figma_capture_screenshot")).toBe(true);
		expect(readToolNames.has("figma_get_component_details")).toBe(true);
		expect(readToolNames.has("figma_get_component")).toBe(true);
		expect(readToolNames.has("figma_get_library_components")).toBe(true);
		expect(readToolNames.has("figma_get_design_system_kit")).toBe(true);
		expect(readToolNames.has("figma_get_design_system_summary")).toBe(true);
		expect(readToolNames.has("figma_get_token_values")).toBe(true);
		expect(readToolNames.has("figma_get_styles")).toBe(true);
		expect(readToolNames.has("figma_get_component_image")).toBe(true);
		expect(readToolNames.has("figma_get_component_for_development")).toBe(true);
		expect(readToolNames.has("figma_generate_component_doc")).toBe(true);
		expect(readToolNames.has("figma_get_status")).toBe(true);
		expect(readToolNames.has("figma_get_selection")).toBe(true);
		expect(readToolNames.has("figma_list_open_files")).toBe(true);
		expect(readToolNames.has("figma_get_comments")).toBe(true);
		expect(readToolNames.has("figma_get_file_data")).toBe(true);
		expect(readToolNames.has("figma_get_file_for_plugin")).toBe(true);
		expect(readToolNames.has("figma_get_design_changes")).toBe(true);
		expect(readToolNames.has("figma_get_console_logs")).toBe(true);
		expect(readToolNames.has("figma_clear_console")).toBe(true);
		expect(readToolNames.has("figma_watch_console")).toBe(true);
		expect(readToolNames.has("figma_reconnect")).toBe(true);
		expect(readToolNames.has("figma_reload_plugin")).toBe(true);
		expect(readToolNames.has("figma_execute")).toBe(false);
		expect(writeToolNames.has("figma_execute")).toBe(true);
		expect(writeToolNames.has("figma_update_variable")).toBe(true);
		expect(writeToolNames.has("figma_batch_create_variables")).toBe(true);
		expect(writeToolNames.has("figma_setup_design_tokens")).toBe(true);
		expect(writeToolNames.has("figma_instantiate_component")).toBe(true);
		expect(writeToolNames.has("figma_post_comment")).toBe(true);
		expect(writeToolNames.has("figma_delete_comment")).toBe(true);
		expect(writeToolNames.has("figma_check_design_parity")).toBe(false);

		for (const toolName of readToolNames) {
			expect(writeToolNames.has(toolName)).toBe(false);
		}
	});

	it("normalizes descriptor metadata across read and write catalogs", () => {
		const tools = createLocalReadToolDefinitions();

		for (const tool of tools) {
			expect(tool.summary).toBe(tool.summary.trim());
			expect(tool.summary).toMatch(/[.!?]$/);
			expect(tool.description).toBe(tool.description.trim());
			expect(tool.description.startsWith("Registry-backed")).toBe(true);
			expect(tool.tags[0]).toBe("figma");
			expect(new Set(tool.tags).size).toBe(tool.tags.length);
			expect(new Set(tool.relatedTools || []).size).toBe((tool.relatedTools || []).length);
			expect((tool.relatedTools || []).includes(tool.name)).toBe(false);
		}
	});

	it("splits write tools into functional discovery groups", () => {
		const writeTools = createLocalWriteToolDefinitions();
		const discoveryGroupByName = new Map(writeTools.map((tool) => [tool.name, tool.discoveryGroup]));

		expect(discoveryGroupByName.get("figma_execute")).toBe("execute");
		expect(discoveryGroupByName.get("figma_update_variable")).toBe("variables");
		expect(discoveryGroupByName.get("figma_instantiate_component")).toBe("components");
		expect(discoveryGroupByName.get("figma_post_comment")).toBe("comments");
		expect(discoveryGroupByName.get("figma_set_text_content")).toBe("content");
		expect(discoveryGroupByName.get("figma_set_fills")).toBe("styling");
		expect(discoveryGroupByName.get("figma_set_description")).toBe("metadata");
		expect(discoveryGroupByName.get("figma_create_child")).toBe("nodes");
	});

	it("get status tool returns runtime status with timestamp", async () => {
		const statusTool = createReadToolDefinitions().find((tool) => tool.name === "figma_get_status");
		expect(statusTool).toBeDefined();

		const result = await statusTool!.handler(
			{
				runtime: {
					getStatus: async () => ({
						connected: true,
						mode: "local",
						activeFileUrl: "https://www.figma.com/design/abc123/Test",
						pluginConnected: true,
						restAuthenticated: false,
						selectionCount: 2,
						warnings: [],
					}),
				},
			} as any,
			{},
		);

		expect(result.connected).toBe(true);
		expect(result.activeFileUrl).toContain("abc123");
		expect(typeof result.timestamp).toBe("number");
	});

	it("get selection tool returns cached active selection", async () => {
		const selectionTool = createReadToolDefinitions().find((tool) => tool.name === "figma_get_selection");
		expect(selectionTool).toBeDefined();

		const result = await selectionTool!.handler(
			{
				runtime: {
					getCurrentSelection: () => ({
						nodes: [{ id: "123:456", name: "Button", type: "COMPONENT", width: 120, height: 40 }],
						count: 1,
						page: "Components",
						timestamp: 1234567890,
					}),
				},
			} as any,
			{},
		);

		expect(result.count).toBe(1);
		expect(result.selection[0]).toMatchObject({ id: "123:456", name: "Button" });
		expect(result.page).toBe("Components");
	});

	it("list open files tool returns active connected files", async () => {
		const filesTool = createReadToolDefinitions().find((tool) => tool.name === "figma_list_open_files");
		expect(filesTool).toBeDefined();

		const result = await filesTool!.handler(
			{
				runtime: {
					getConnectedFiles: () => ([
						{
							fileName: "Design System",
							fileKey: "abc123",
							currentPage: "Buttons",
							currentPageId: "1:2",
							connectedAt: 1234567890,
							isActive: true,
						},
					]),
				},
			} as any,
			{},
		);

		expect(result.totalFiles).toBe(1);
		expect(result.activeFileKey).toBe("abc123");
		expect(result.files[0].url).toContain("/abc123/");
	});

	it("get comments tool returns only active comments by default", async () => {
		const tool = createReadToolDefinitions().find((candidate) => candidate.name === "figma_get_comments");
		expect(tool).toBeDefined();

		const api = {
			getComments: jest.fn().mockResolvedValue({
				comments: [
					{ id: "1", message: "Open thread", resolved_at: null },
					{ id: "2", message: "Resolved thread", resolved_at: "2026-03-22T00:00:00Z" },
				],
			}),
		};

		const result = await tool!.handler(
			{
				runtime: {
					getCurrentFileUrl: () => "https://www.figma.com/design/abc123/Design-System",
					getFigmaAPI: async () => api,
				},
			} as any,
			{},
		);

		expect(api.getComments).toHaveBeenCalledWith("abc123", { as_md: false });
		expect(result.fileKey).toBe("abc123");
		expect(result.comments).toHaveLength(1);
		expect(result.summary.total).toBe(2);
		expect(result.summary.active).toBe(1);
		expect(result.summary.resolved).toBe(1);
	});

	it("get file data tool fetches and filters file structure", async () => {
		const tool = createReadToolDefinitions().find((candidate) => candidate.name === "figma_get_file_data");
		expect(tool).toBeDefined();

		const mockApi = {
			getFile: jest.fn().mockResolvedValue({
				name: "Design System",
				lastModified: "2026-03-22T00:00:00Z",
				version: "123",
				document: {
					id: "0:0",
					name: "Document",
					type: "DOCUMENT",
					children: [
						{
							id: "1:1",
							name: "Buttons",
							type: "CANVAS",
							visible: true,
							children: [],
						},
					],
				},
				components: { a: {}, b: {} },
				styles: { c: {} },
			}),
		};

		const result = await tool!.handler(
			{
				runtime: {
					getCurrentFileUrl: () => "https://www.figma.com/design/abc123/Design-System",
					getFigmaAPI: async () => mockApi,
				},
			} as any,
			{ depth: 1, verbosity: "summary" },
		);

		expect(mockApi.getFile).toHaveBeenCalledWith("abc123", { depth: 1, ids: undefined });
		expect(result.name).toBe("Design System");
		expect(result.components).toBe(2);
		expect(result.document.children[0]).toEqual({
			id: "1:1",
			name: "Buttons",
			type: "CANVAS",
			children: [],
		});
	});

	it("get styles tool fetches and filters styles", async () => {
		const tool = createReadToolDefinitions().find((candidate) => candidate.name === "figma_get_styles");
		expect(tool).toBeDefined();

		const api = {
			getStyles: jest.fn().mockResolvedValue({
				meta: {
					styles: [
						{
							key: "style-1",
							name: "Color/Primary",
							description: "Primary brand color",
							style_type: "FILL",
							remote: true,
							extra: "ignored-in-standard",
						},
					],
				},
			}),
		};

		const result = await tool!.handler(
			{
				runtime: {
					getCurrentFileUrl: () => "https://www.figma.com/design/abc123/Design-System",
					getFigmaAPI: async () => api,
				},
			} as any,
			{ verbosity: "standard" },
		);

		expect(api.getStyles).toHaveBeenCalledWith("abc123");
		expect(result.fileKey).toBe("abc123");
		expect(result.totalStyles).toBe(1);
		expect(result.styles[0]).toEqual({
			key: "style-1",
			name: "Color/Primary",
			description: "Primary brand color",
			style_type: "FILL",
			remote: true,
		});
	});

	it("get file for plugin tool filters file data to plugin-relevant fields", async () => {
		const tool = createReadToolDefinitions().find((candidate) => candidate.name === "figma_get_file_for_plugin");
		expect(tool).toBeDefined();

		const api = {
			getFile: jest.fn().mockResolvedValue({
				name: "Plugin File",
				lastModified: "2026-03-22T00:00:00Z",
				version: "456",
				document: {
					id: "0:0",
					name: "Document",
					type: "DOCUMENT",
					children: [
						{
							id: "1:1",
							name: "Frame",
							type: "FRAME",
							visible: true,
							absoluteBoundingBox: { x: 10, y: 20, width: 300, height: 200 },
							pluginData: { token: "abc" },
							fills: [{ type: "SOLID" }],
							children: [],
						},
					],
				},
				components: { comp1: {} },
				styles: { style1: {} },
			}),
		};

		const result = await tool!.handler(
			{
				runtime: {
					getCurrentFileUrl: () => "https://www.figma.com/design/abc123/Design-System",
					getFigmaAPI: async () => api,
				},
			} as any,
			{ depth: 2 },
		);

		expect(api.getFile).toHaveBeenCalledWith("abc123", { depth: 2, ids: undefined });
		expect(result.fileKey).toBe("abc123");
		expect(result.metadata.purpose).toBe("plugin_development");
		expect(result.document.children[0]).toEqual({
			id: "1:1",
			name: "Frame",
			type: "FRAME",
			visible: true,
			bounds: { x: 10, y: 20, width: 300, height: 200 },
			pluginData: { token: "abc" },
			children: [],
		});
		expect(result.components).toBe(1);
		expect(result.styles).toBe(1);
	});

	it("get component details tool returns local component set details", async () => {
		const tool = createReadToolDefinitions().find((candidate) => candidate.name === "figma_get_component_details");
		expect(tool).toBeDefined();

		const connector = {
			getVariables: jest.fn().mockResolvedValue({
				success: true,
				variables: [],
				variableCollections: [],
			}),
			getLocalComponents: jest.fn().mockResolvedValue({
				success: true,
				data: {
					components: [],
					componentSets: [
						{
							name: "Button",
							key: "set-key",
							nodeId: "1:1",
							description: "Primary button set",
							variantAxes: [{ name: "Size", values: ["sm", "md"] }],
							variants: [{ name: "Size=sm", key: "variant-key", nodeId: "1:2" }],
							properties: [{ name: "Label", type: "TEXT", defaultValue: "Save" }],
						},
					],
					totalComponents: 0,
					totalComponentSets: 1,
					fileKey: "abc123",
					timestamp: 123,
				},
			}),
		};

		const result = await tool!.handler(
			{
				runtime: {
					getCurrentFileUrl: () => "https://www.figma.com/design/abc123/Design-System",
					getDesktopConnector: async () => connector,
				},
			} as any,
			{ componentKey: "set-key" },
		);

		expect(result.success).toBe(true);
		expect(result.source).toBe("local");
		expect(result.type).toBe("componentSet");
		expect(result.component.variantAxes[0].name).toBe("Size");
		expect(result.instantiation.example).toContain("variant-key");
	});

	it("get component tool returns REST metadata by default", async () => {
		const tool = createReadToolDefinitions().find((candidate) => candidate.name === "figma_get_component");
		expect(tool).toBeDefined();

		const api = {
			getComponentData: jest.fn().mockResolvedValue({
				document: {
					id: "10:20",
					name: "Button",
					type: "COMPONENT",
					description: "Primary action button",
					componentPropertyDefinitions: { Label: { type: "TEXT" } },
					children: [{ id: "10:21", name: "Label", type: "TEXT" }],
					absoluteBoundingBox: { x: 0, y: 0, width: 120, height: 40 },
					fills: [{ type: "SOLID" }],
					strokes: [],
					effects: [],
				},
			}),
		};

		const result = await tool!.handler(
			{
				runtime: {
					getCurrentFileUrl: () => "https://www.figma.com/design/abc123/Design-System",
					getFigmaAPI: async () => api,
					getDesktopConnector: async () => {
						throw new Error("plugin unavailable");
					},
				},
			} as any,
			{ nodeId: "10:20" },
		);

		expect(api.getComponentData).toHaveBeenCalledWith("abc123", "10:20");
		expect(result.source).toBe("rest_api");
		expect(result.component.name).toBe("Button");
		expect(result.component.properties.Label.type).toBe("TEXT");
	});

	it("get component tool returns reconstruction spec", async () => {
		const tool = createReadToolDefinitions().find((candidate) => candidate.name === "figma_get_component");
		expect(tool).toBeDefined();

		const api = {
			getComponentData: jest.fn().mockResolvedValue({
				document: {
					id: "10:20",
					name: "Badge",
					type: "COMPONENT",
					absoluteBoundingBox: { width: 80, height: 24 },
					children: [],
				},
			}),
		};

		const result = await tool!.handler(
			{
				runtime: {
					getCurrentFileUrl: () => "https://www.figma.com/design/abc123/Design-System",
					getFigmaAPI: async () => api,
				},
			} as any,
			{ nodeId: "10:20", format: "reconstruction" },
		);

		expect(result.name).toBe("Badge");
		expect(result.type).toBe("COMPONENT");
	});

	it("get component details tool returns published library variant details", async () => {
		const tool = createReadToolDefinitions().find((candidate) => candidate.name === "figma_get_component_details");
		expect(tool).toBeDefined();

		const api = {
			getComponents: jest.fn().mockResolvedValue({
				meta: {
					components: [
						{
							name: "Size=md, State=default",
							key: "variant-key",
							node_id: "2:2",
							description: "Default button variant",
							component_set_id: "2:1",
							component_set_name: "Button",
						},
					],
				},
			}),
			getComponentSets: jest.fn().mockResolvedValue({
				meta: {
					component_sets: [
						{
							name: "Button",
							key: "set-key",
							node_id: "2:1",
							description: "Shared library button",
						},
					],
				},
			}),
		};

		const result = await tool!.handler(
			{
				runtime: {
					getFigmaAPI: async () => api,
				},
			} as any,
			{ libraryFileKey: "library123", componentKey: "variant-key" },
		);

		expect(result.success).toBe(true);
		expect(result.source).toBe("library");
		expect(result.type).toBe("componentVariant");
		expect(result.component.parentSetName).toBe("Button");
		expect(result.instantiation.key).toBe("variant-key");
	});

	it("get design system summary tool returns category and token summaries", async () => {
		const tool = createReadToolDefinitions().find((candidate) => candidate.name === "figma_get_design_system_summary");
		expect(tool).toBeDefined();

		const connector = {
			getVariables: jest.fn().mockResolvedValue({
				success: true,
				variables: [
					{
						id: "var-1",
						name: "color/primary",
						resolvedType: "COLOR",
						scopes: ["FILL"],
						variableCollectionId: "col-1",
						valuesByMode: { "1:0": { r: 1, g: 0, b: 0 } },
					},
				],
				variableCollections: [
					{
						id: "col-1",
						name: "Primitives",
						defaultModeId: "1:0",
						modes: [{ modeId: "1:0", name: "Light" }],
					},
				],
			}),
			getLocalComponents: jest.fn().mockResolvedValue({
				success: true,
				data: {
					components: [
						{ name: "Button/Primary", key: "comp-1", nodeId: "1:1", width: 120, height: 40 },
					],
					componentSets: [],
					totalComponents: 1,
					totalComponentSets: 0,
					fileKey: "abc123",
					timestamp: 123,
				},
			}),
		};

		const result = await tool!.handler(
			{
				runtime: {
					getCurrentFileUrl: () => "https://www.figma.com/design/abc123/Design-System",
					getDesktopConnector: async () => connector,
				},
			} as any,
			{},
		);

		expect(result.success).toBe(true);
		expect(result.fileKey).toBe("abc123");
		expect(result.totals.components).toBe(1);
		expect(result.tokens.collections).toContain("Primitives");
		expect(result.categories[0].name).toBe("Button");
	});

	it("get token values tool filters color tokens", async () => {
		const tool = createReadToolDefinitions().find((candidate) => candidate.name === "figma_get_token_values");
		expect(tool).toBeDefined();

		const connector = {
			getVariables: jest.fn().mockResolvedValue({
				success: true,
				variables: [
					{
						id: "var-1",
						name: "color/primary",
						resolvedType: "COLOR",
						scopes: ["FILL"],
						variableCollectionId: "col-1",
						valuesByMode: { "1:0": { r: 1, g: 0, b: 0 } },
					},
					{
						id: "var-2",
						name: "space/medium",
						resolvedType: "FLOAT",
						variableCollectionId: "col-1",
						valuesByMode: { "1:0": 16 },
					},
				],
				variableCollections: [
					{
						id: "col-1",
						name: "Primitives",
						defaultModeId: "1:0",
						modes: [{ modeId: "1:0", name: "Light" }],
					},
				],
			}),
			getLocalComponents: jest.fn().mockResolvedValue({
				success: true,
				data: {
					components: [],
					componentSets: [],
					totalComponents: 0,
					totalComponentSets: 0,
					fileKey: "abc123",
					timestamp: 123,
				},
			}),
		};

		const result = await tool!.handler(
			{
				runtime: {
					getCurrentFileUrl: () => "https://www.figma.com/design/abc123/Design-System",
					getDesktopConnector: async () => connector,
				},
			} as any,
			{ type: "colors", filter: "primary", limit: 10 },
		);

		expect(result.success).toBe(true);
		expect(result.tokens.colors["color/primary"].value).toBe("#FF0000");
		expect(result.tokens.spacing).toBeUndefined();
	});

	it("get library components tool returns component sets and variants", async () => {
		const tool = createReadToolDefinitions().find((candidate) => candidate.name === "figma_get_library_components");
		expect(tool).toBeDefined();

		const api = {
			getComponents: jest.fn().mockResolvedValue({
				meta: {
					components: [
						{
							name: "Size=md, State=default",
							key: "variant-key",
							node_id: "2:2",
							description: "Default button variant",
							component_set_id: "2:1",
							component_set_name: "Button",
						},
						{
							name: "Icon",
							key: "icon-key",
							node_id: "2:3",
							description: "Standalone icon",
						},
					],
				},
			}),
			getComponentSets: jest.fn().mockResolvedValue({
				meta: {
					component_sets: [
						{
							name: "Button",
							key: "set-key",
							node_id: "2:1",
							description: "Shared library button",
						},
					],
				},
			}),
		};

		const result = await tool!.handler(
			{
				runtime: {
					getFigmaAPI: async () => api,
				},
			} as any,
			{ libraryFileKey: "library123", includeVariants: true },
		);

		expect(result.success).toBe(true);
		expect(result.summary.totalComponentSets).toBe(1);
		expect(result.summary.totalStandaloneComponents).toBe(1);
		expect(result.results.some((entry: any) => entry.type === "VARIANT")).toBe(true);
	});

	it("get component image tool returns image URL for renderable node", async () => {
		const tool = createReadToolDefinitions().find((candidate) => candidate.name === "figma_get_component_image");
		expect(tool).toBeDefined();

		const api = {
			getNodes: jest.fn().mockResolvedValue({
				nodes: {
					"10:20": {
						document: {
							id: "10:20",
							name: "Button",
							type: "COMPONENT",
						},
					},
				},
			}),
			getImages: jest.fn().mockResolvedValue({
				images: {
					"10:20": "https://figma.example/image.png",
				},
			}),
		};

		const result = await tool!.handler(
			{
				runtime: {
					getCurrentFileUrl: () => "https://www.figma.com/design/abc123/Design-System",
					getFigmaAPI: async () => api,
				},
			} as any,
			{ nodeId: "10:20", scale: 2, format: "png" },
		);

		expect(api.getNodes).toHaveBeenCalledWith("abc123", ["10:20"]);
		expect(api.getImages).toHaveBeenCalledWith("abc123", "10:20", {
			scale: 2,
			format: "png",
			contents_only: true,
		});
		expect(result.imageUrl).toBe("https://figma.example/image.png");
		expect(result.expiresIn).toBe("30 days");
	});

	it("get component image tool returns variant guidance for component sets", async () => {
		const tool = createReadToolDefinitions().find((candidate) => candidate.name === "figma_get_component_image");
		expect(tool).toBeDefined();

		const api = {
			getNodes: jest.fn().mockResolvedValue({
				nodes: {
					"10:20": {
						document: {
							id: "10:20",
							name: "Button",
							type: "COMPONENT_SET",
							children: [
								{ id: "10:21", name: "Size=sm", type: "COMPONENT" },
								{ id: "10:22", name: "Size=md", type: "COMPONENT" },
							],
						},
					},
				},
			}),
			getImages: jest.fn(),
		};

		const result = await tool!.handler(
			{
				runtime: {
					getCurrentFileUrl: () => "https://www.figma.com/design/abc123/Design-System",
					getFigmaAPI: async () => api,
				},
			} as any,
			{ nodeId: "10:20" },
		);

		expect(result.error).toBe("COMPONENT_SET_NOT_RENDERABLE");
		expect(result.availableVariants).toEqual(["Size=sm", "Size=md"]);
		expect(api.getImages).not.toHaveBeenCalled();
	});

	it("get component for development tool returns filtered implementation data and image", async () => {
		const tool = createReadToolDefinitions().find((candidate) => candidate.name === "figma_get_component_for_development");
		expect(tool).toBeDefined();

		const api = {
			getNodes: jest.fn().mockResolvedValue({
				nodes: {
					"10:20": {
						document: {
							id: "10:20",
							name: "Button",
							type: "COMPONENT",
							absoluteBoundingBox: { x: 1, y: 2, width: 120, height: 40 },
							layoutMode: "HORIZONTAL",
							paddingLeft: 16,
							paddingRight: 16,
							itemSpacing: 8,
							fills: [{ type: "SOLID" }],
							characters: "Save",
							style: { fontFamily: "Inter", fontSize: 14 },
							componentProperties: { Label: { type: "TEXT", value: "Save" } },
							visible: true,
							locked: false,
							pluginData: { ignored: true },
							children: [
								{
									id: "10:21",
									name: "Label",
									type: "TEXT",
									characters: "Save",
								},
							],
						},
					},
				},
			}),
			getImages: jest.fn().mockResolvedValue({
				images: {
					"10:20": "https://figma.example/dev-component.png",
				},
			}),
		};

		const result = await tool!.handler(
			{
				runtime: {
					getCurrentFileUrl: () => "https://www.figma.com/design/abc123/Design-System",
					getFigmaAPI: async () => api,
				},
			} as any,
			{ nodeId: "10:20", includeImage: true },
		);

		expect(api.getNodes).toHaveBeenCalledWith("abc123", ["10:20"], { depth: 2 });
		expect(api.getImages).toHaveBeenCalledWith("abc123", "10:20", {
			scale: 2,
			format: "png",
			contents_only: true,
		});
		expect(result.imageUrl).toBe("https://figma.example/dev-component.png");
		expect(result.component).toMatchObject({
			id: "10:20",
			name: "Button",
			type: "COMPONENT",
			layoutMode: "HORIZONTAL",
			paddingLeft: 16,
			itemSpacing: 8,
			characters: "Save",
			componentProperties: { Label: { type: "TEXT", value: "Save" } },
		});
		expect(result.component.pluginData).toBeUndefined();
	});

	it("generate component doc tool returns markdown and chunks", async () => {
		const tool = createReadToolDefinitions().find((candidate) => candidate.name === "figma_generate_component_doc");
		expect(tool).toBeDefined();

		const api = {
			getNodes: jest.fn().mockResolvedValue({
				nodes: {
					"10:20": {
						document: {
							id: "10:20",
							name: "Button",
							type: "COMPONENT",
							description: "Primary action button",
							style: { fontFamily: "Inter", fontWeight: 600, fontSize: 14, lineHeightPx: 20 },
							children: [
								{ id: "10:21", name: "Label", type: "TEXT", characters: "Save", style: { fontFamily: "Inter", fontWeight: 600, fontSize: 14, lineHeightPx: 20 } },
							],
						},
					},
				},
			}),
		};

		const result = await tool!.handler(
			{
				runtime: {
					getCurrentFileUrl: () => "https://www.figma.com/design/abc123/Design-System",
					getFigmaAPI: async () => api,
				},
			} as any,
			{ nodeId: "10:20", includeFrontmatter: true },
		);

		expect(result.componentName).toBe("Button");
		expect(result.markdown).toContain("## Overview");
		expect(result.markdown).toContain("## Anatomy");
		expect(result.chunks.length).toBeGreaterThan(0);
	});

	it("get design system kit tool aggregates tokens, components, and styles", async () => {
		const tool = createReadToolDefinitions().find((candidate) => candidate.name === "figma_get_design_system_kit");
		expect(tool).toBeDefined();

		const api = {
			getLocalVariables: jest.fn().mockResolvedValue({
				variableCollections: {
					"col-1": { name: "Primitives", modes: [{ modeId: "1:0", name: "Light" }], variableIds: ["var-1"] },
				},
				variables: {
					"var-1": { name: "color/primary", resolvedType: "COLOR", valuesByMode: { "1:0": "#FF0000" }, variableCollectionId: "col-1" },
				},
			}),
			getComponents: jest.fn().mockResolvedValue({
				meta: {
					components: [{ name: "Icon", key: "comp-key", node_id: "2:2", description: "Standalone icon" }],
				},
			}),
			getComponentSets: jest.fn().mockResolvedValue({
				meta: {
					component_sets: [{ name: "Button", key: "set-key", node_id: "2:1", description: "Button set" }],
				},
			}),
			getNodes: jest.fn().mockImplementation(async (_fileKey: string, ids: string[]) => ({
				nodes: Object.fromEntries(ids.map((id) => [id, {
					document: id === "2:1"
						? {
							id,
							name: "Button",
							type: "COMPONENT_SET",
							componentPropertyDefinitions: { Size: { type: "VARIANT" } },
							children: [{ id: "2:3", name: "Size=md", type: "COMPONENT", fills: [{ type: "SOLID", color: { r: 1, g: 0, b: 0 } }] }],
						}
						: {
							id,
							name: "Icon",
							type: "COMPONENT",
						},
				}])),
			})),
			getStyles: jest.fn().mockResolvedValue({
				meta: {
					styles: [{ key: "style-1", name: "Color/Primary", style_type: "FILL", node_id: "5:1" }],
				},
			}),
		};

		const result = await tool!.handler(
			{
				runtime: {
					getCurrentFileUrl: () => "https://www.figma.com/design/abc123/Design-System",
					getFigmaAPI: async () => api,
					getVariablesCache: () => new Map(),
				},
			} as any,
			{},
		);

		expect(result.fileKey).toBe("abc123");
		expect(result.tokens.summary.totalVariables).toBe(1);
		expect(result.components.summary.totalComponentSets).toBe(1);
		expect(result.styles.summary.totalStyles).toBe(1);
	});

	it("get design changes tool returns buffered events and clears when requested", async () => {
		const tool = createReadToolDefinitions().find((candidate) => candidate.name === "figma_get_design_changes");
		expect(tool).toBeDefined();

		const runtime = {
			getDocumentChanges: jest.fn().mockReturnValue([
				{
					hasStyleChanges: false,
					hasNodeChanges: true,
					changedNodeIds: ["123:456"],
					changeCount: 1,
					timestamp: 1000,
				},
			]),
			clearDocumentChanges: jest.fn().mockReturnValue(1),
		};

		const result = await tool!.handler(
			{ runtime } as any,
			{ count: 10, clear: true },
		);

		expect(runtime.getDocumentChanges).toHaveBeenCalledWith({ since: undefined, count: 10 });
		expect(runtime.clearDocumentChanges).toHaveBeenCalled();
		expect(result.summary.uniqueNodesChanged).toBe(1);
		expect(result.clearedCount).toBe(1);
	});

	it("get console logs tool returns logs and status", async () => {
		const tool = createReadToolDefinitions().find((candidate) => candidate.name === "figma_get_console_logs");
		expect(tool).toBeDefined();

		const logs = [
			{ timestamp: 1000, level: "error", message: "boom", args: [], source: "plugin" },
		];
		const result = await tool!.handler(
			{
				runtime: {
					getConsoleLogs: jest.fn().mockReturnValue(logs),
					getConsoleStatus: jest.fn().mockReturnValue({
						isMonitoring: true,
						anyClientConnected: true,
						logCount: 1,
						bufferSize: 1000,
						workerCount: 0,
						oldestTimestamp: 1000,
						newestTimestamp: 1000,
					}),
				},
			} as any,
			{ count: 50, level: "error" },
		);

		expect(result.logs[0].message).toBe("boom");
		expect(result.status.isMonitoring).toBe(true);
	});

	it("clear console tool clears buffered logs", async () => {
		const tool = createReadToolDefinitions().find((candidate) => candidate.name === "figma_clear_console");
		expect(tool).toBeDefined();

		const runtime = {
			clearConsoleLogs: jest.fn().mockReturnValue(3),
		};

		const result = await tool!.handler({ runtime } as any, {});
		expect(runtime.clearConsoleLogs).toHaveBeenCalled();
		expect(result.clearedCount).toBe(3);
	});

	it("watch console tool returns logs collected since start", async () => {
		const tool = createReadToolDefinitions().find((candidate) => candidate.name === "figma_watch_console");
		expect(tool).toBeDefined();

		const runtime = {
			getConsoleStatus: jest
				.fn()
				.mockReturnValueOnce({ logCount: 1, isMonitoring: true, anyClientConnected: true, bufferSize: 1000, workerCount: 0 })
				.mockReturnValueOnce({ logCount: 3, isMonitoring: true, anyClientConnected: true, bufferSize: 1000, workerCount: 0 }),
			getConsoleLogs: jest.fn().mockReturnValue([
				{ timestamp: Date.now(), level: "log", message: "hello", args: [], source: "plugin" },
				{ timestamp: Date.now(), level: "warn", message: "watch", args: [], source: "plugin" },
			]),
		};

		const result = await tool!.handler(
			{ runtime } as any,
			{ duration: 0, level: "all" },
		);

		expect(runtime.getConsoleLogs).toHaveBeenCalled();
		expect(result.statistics.logsAddedDuringWatch).toBe(2);
		expect(result.logs).toHaveLength(2);
	});

	it("reconnect tool delegates to runtime reconnect", async () => {
		const tool = createReadToolDefinitions().find((candidate) => candidate.name === "figma_reconnect");
		expect(tool).toBeDefined();

		const runtime = {
			reconnect: jest.fn().mockResolvedValue({
				connected: true,
				mode: "local",
				activeFileUrl: "https://www.figma.com/design/abc123/Test",
				pluginConnected: true,
				restAuthenticated: true,
				selectionCount: 1,
				warnings: [],
			}),
		};

		const result = await tool!.handler({ runtime } as any, {});
		expect(runtime.reconnect).toHaveBeenCalled();
		expect(result.status).toBe("reconnected");
		expect(result.connected).toBe(true);
	});

	it("reload plugin tool delegates to runtime reload", async () => {
		const tool = createReadToolDefinitions().find((candidate) => candidate.name === "figma_reload_plugin");
		expect(tool).toBeDefined();

		const runtime = {
			reloadPluginUi: jest.fn().mockResolvedValue({
				status: "reloaded",
				transport: "websocket",
				consoleCleared: true,
				clearedCount: 2,
				timestamp: 1234567890,
			}),
		};

		const result = await tool!.handler({ runtime } as any, { clearConsole: true });
		expect(runtime.reloadPluginUi).toHaveBeenCalledWith({ clearConsole: true });
		expect(result.transport).toBe("websocket");
		expect(result.clearedCount).toBe(2);
	});

	it("update variable handler proxies to the desktop connector", async () => {
		const tool = createLocalWriteToolDefinitions().find((candidate) => candidate.name === "figma_update_variable");
		expect(tool).toBeDefined();

		const connector = {
			updateVariable: jest.fn().mockResolvedValue({
				variable: { id: "VariableID:123:456", name: "color/primary" },
			}),
		};

		const result = await tool!.handler(
			{ runtime: { getDesktopConnector: async () => connector } } as any,
			{ variableId: "VariableID:123:456", modeId: "1:0", value: "#FF0000" },
		);

		expect(connector.updateVariable).toHaveBeenCalledWith("VariableID:123:456", "1:0", "#FF0000");
		expect(result.variable.name).toBe("color/primary");
	});

	it("create variable collection handler proxies to the desktop connector", async () => {
		const tool = createLocalWriteToolDefinitions().find((candidate) => candidate.name === "figma_create_variable_collection");
		expect(tool).toBeDefined();

		const connector = {
			createVariableCollection: jest.fn().mockResolvedValue({
				collection: { id: "VariableCollectionId:123:456", name: "Brand Tokens" },
			}),
		};

		const result = await tool!.handler(
			{ runtime: { getDesktopConnector: async () => connector } } as any,
			{ name: "Brand Tokens", initialModeName: "Light", additionalModes: ["Dark"] },
		);

		expect(connector.createVariableCollection).toHaveBeenCalledWith("Brand Tokens", {
			initialModeName: "Light",
			additionalModes: ["Dark"],
		});
		expect(result.collection.name).toBe("Brand Tokens");
	});

	it("batch create variables handler executes generated script", async () => {
		const tool = createLocalWriteToolDefinitions().find((candidate) => candidate.name === "figma_batch_create_variables");
		expect(tool).toBeDefined();

		const connector = {
			executeCodeViaUI: jest.fn().mockResolvedValue({
				result: {
					created: 1,
					failed: 0,
					results: [{ success: true, name: "color/primary", id: "VariableID:1" }],
				},
			}),
		};

		const result = await tool!.handler(
			{ runtime: { getDesktopConnector: async () => connector } } as any,
			{
				collectionId: "VariableCollectionId:123:456",
				variables: [{ name: "color/primary", resolvedType: "COLOR", valuesByMode: { "1:0": "#FF0000" } }],
			},
		);

		expect(connector.executeCodeViaUI).toHaveBeenCalled();
		expect(connector.executeCodeViaUI.mock.calls[0][0]).toContain("figma.variables.createVariable");
		expect(result.created).toBe(1);
	});

	it("setup design tokens handler executes generated script", async () => {
		const tool = createLocalWriteToolDefinitions().find((candidate) => candidate.name === "figma_setup_design_tokens");
		expect(tool).toBeDefined();

		const connector = {
			executeCodeViaUI: jest.fn().mockResolvedValue({
				result: {
					collectionId: "VariableCollectionId:123:456",
					collectionName: "Brand Tokens",
					modes: { Light: "1:0", Dark: "1:1" },
					created: 1,
					failed: 0,
					results: [{ success: true, name: "color/primary", id: "VariableID:1" }],
				},
			}),
		};

		const result = await tool!.handler(
			{ runtime: { getDesktopConnector: async () => connector } } as any,
			{
				collectionName: "Brand Tokens",
				modes: ["Light", "Dark"],
				tokens: [{ name: "color/primary", resolvedType: "COLOR", values: { Light: "#FFFFFF", Dark: "#000000" } }],
			},
		);

		expect(connector.executeCodeViaUI).toHaveBeenCalled();
		expect(connector.executeCodeViaUI.mock.calls[0][0]).toContain("createVariableCollection");
		expect(result.collectionName).toBe("Brand Tokens");
		expect(result.created).toBe(1);
	});

	it("post comment handler proxies to the Figma API", async () => {
		const tool = createLocalWriteToolDefinitions().find((candidate) => candidate.name === "figma_post_comment");
		expect(tool).toBeDefined();

		const api = {
			postComment: jest.fn().mockResolvedValue({
				id: "c1",
				message: "Please review this.",
				created_at: "2026-03-22T00:00:00Z",
				user: { id: "u1", handle: "designer" },
				client_meta: { node_id: "123:456", node_offset: { x: 0, y: 0 } },
				order_id: "100",
			}),
		};

		const result = await tool!.handler(
			{
				runtime: {
					getCurrentFileUrl: () => "https://www.figma.com/design/abc123/Design-System",
					getFigmaAPI: async () => api,
				},
			} as any,
			{
				message: "Please review this.",
				node_id: "123:456",
			},
		);

		expect(api.postComment).toHaveBeenCalledWith(
			"abc123",
			"Please review this.",
			{ node_id: "123:456", node_offset: { x: 0, y: 0 } },
			undefined,
		);
		expect(result.success).toBe(true);
		expect(result.comment.id).toBe("c1");
	});

	it("delete comment handler proxies to the Figma API", async () => {
		const tool = createLocalWriteToolDefinitions().find((candidate) => candidate.name === "figma_delete_comment");
		expect(tool).toBeDefined();

		const api = {
			deleteComment: jest.fn().mockResolvedValue(undefined),
		};

		const result = await tool!.handler(
			{
				runtime: {
					getCurrentFileUrl: () => "https://www.figma.com/design/abc123/Design-System",
					getFigmaAPI: async () => api,
				},
			} as any,
			{
				comment_id: "c1",
			},
		);

		expect(api.deleteComment).toHaveBeenCalledWith("abc123", "c1");
		expect(result.success).toBe(true);
		expect(result.deletedCommentId).toBe("c1");
	});

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
