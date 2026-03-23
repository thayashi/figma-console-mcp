import { z } from "zod";
import { extractFigmaUrlInfo, formatVariables } from "../../core/figma-api.js";
import { searchComponents as searchManifestComponents, DesignSystemManifestCache, createEmptyManifest, figmaColorToHex } from "../../core/design-system-manifest.js";
import type { CodeSpec } from "../../core/types/design-code.js";
import type { ToolDefinition } from "../types.js";
import { codeSpecSchema, runDesignParityCheck } from "../../core/design-code-tools.js";

const variablesInputSchema = z.object({
	fileUrl: z.string().url().optional(),
	includePublished: z.boolean().optional().default(true),
	refreshCache: z.boolean().optional().default(false),
});

const searchComponentsInputSchema = z.object({
	query: z.string().optional().default(""),
	category: z.string().optional(),
	libraryFileKey: z.string().optional(),
	libraryFileUrl: z.string().optional(),
	limit: z.number().int().min(1).max(25).optional().default(10),
	offset: z.number().int().min(0).optional().default(0),
});

const parityInputSchema = z.object({
	fileUrl: z.string().url().optional(),
	nodeId: z.string(),
	codeSpec: codeSpecSchema,
	canonicalSource: z.enum(["design", "code"]).optional().default("design"),
	enrich: z.boolean().optional().default(true),
});

const executeInputSchema = z.object({
	code: z.string(),
	timeout: z.number().int().min(1).max(30000).optional().default(5000),
});

const instantiateComponentInputSchema = z.object({
	componentKey: z.string().optional(),
	nodeId: z.string().optional(),
	variant: z.record(z.string()).optional(),
	overrides: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
	position: z.object({
		x: z.number(),
		y: z.number(),
	}).optional(),
	parentId: z.string().optional(),
});

const setInstancePropertiesInputSchema = z.object({
	nodeId: z.string(),
	properties: z.record(z.string(), z.union([z.string(), z.boolean()])),
});

const addComponentPropertyInputSchema = z.object({
	nodeId: z.string(),
	propertyName: z.string(),
	type: z.enum(["BOOLEAN", "TEXT", "INSTANCE_SWAP", "VARIANT"]),
	defaultValue: z.union([z.string(), z.number(), z.boolean()]),
});

const setDescriptionInputSchema = z.object({
	nodeId: z.string(),
	description: z.string(),
	descriptionMarkdown: z.string().optional(),
});

const resizeNodeInputSchema = z.object({
	nodeId: z.string(),
	width: z.number(),
	height: z.number(),
	withConstraints: z.boolean().optional().default(true),
});

const fillSchema = z.object({
	type: z.string(),
}).passthrough();

const strokeSchema = z.object({
	type: z.string(),
}).passthrough();

const setFillsInputSchema = z.object({
	nodeId: z.string(),
	fills: z.array(fillSchema),
});

const setStrokesInputSchema = z.object({
	nodeId: z.string(),
	strokes: z.array(strokeSchema),
	strokeWeight: z.number().optional(),
});

const setOpacityInputSchema = z.object({
	nodeId: z.string(),
	opacity: z.number().min(0).max(1),
});

const setCornerRadiusInputSchema = z.object({
	nodeId: z.string(),
	radius: z.number(),
});

const moveNodeInputSchema = z.object({
	nodeId: z.string(),
	x: z.number(),
	y: z.number(),
});

const renameNodeInputSchema = z.object({
	nodeId: z.string(),
	newName: z.string(),
});

const cloneNodeInputSchema = z.object({
	nodeId: z.string(),
});

const deleteNodeInputSchema = z.object({
	nodeId: z.string(),
});

const setTextContentInputSchema = z.object({
	nodeId: z.string(),
	text: z.string(),
	fontSize: z.number().optional(),
	fontWeight: z.number().optional(),
	fontFamily: z.string().optional(),
});

const createChildInputSchema = z.object({
	parentId: z.string(),
	nodeType: z.enum(["RECTANGLE", "ELLIPSE", "FRAME", "TEXT", "LINE"]),
	properties: z.object({
		name: z.string().optional(),
		x: z.number().optional(),
		y: z.number().optional(),
		width: z.number().optional(),
		height: z.number().optional(),
		fills: z.array(z.object({
			type: z.literal("SOLID"),
			color: z.string(),
		})).optional(),
		text: z.string().optional(),
	}).optional(),
});

const setImageFillInputSchema = z.object({
	nodeIds: z.array(z.string()),
	imageData: z.string(),
	scaleMode: z.enum(["FILL", "FIT", "CROP", "TILE"]).optional(),
});

const editComponentPropertyInputSchema = z.object({
	nodeId: z.string(),
	propertyName: z.string(),
	newValue: z.object({
		name: z.string().optional(),
		defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
		preferredValues: z.array(
			z.object({
				type: z.enum(["COMPONENT", "COMPONENT_SET"]),
				key: z.string(),
			}),
		).optional(),
	}),
});

const deleteComponentPropertyInputSchema = z.object({
	nodeId: z.string(),
	propertyName: z.string(),
});

const captureScreenshotInputSchema = z.object({
	nodeId: z.string().optional(),
	format: z.enum(["PNG", "JPG", "SVG"]).optional().default("PNG"),
	scale: z.number().min(0.5).max(4).optional().default(2),
});

const lintDesignInputSchema = z.object({
	nodeId: z.string().optional(),
	rules: z.array(z.string()).optional(),
	maxDepth: z.number().optional(),
	maxFindings: z.number().optional(),
});

type VariablesInput = z.infer<typeof variablesInputSchema>;
type SearchComponentsInput = z.infer<typeof searchComponentsInputSchema>;
type ParityInput = z.infer<typeof parityInputSchema>;
type ExecuteInput = z.infer<typeof executeInputSchema>;
type InstantiateComponentInput = z.infer<typeof instantiateComponentInputSchema>;
type SetInstancePropertiesInput = z.infer<typeof setInstancePropertiesInputSchema>;
type AddComponentPropertyInput = z.infer<typeof addComponentPropertyInputSchema>;
type SetDescriptionInput = z.infer<typeof setDescriptionInputSchema>;
type ResizeNodeInput = z.infer<typeof resizeNodeInputSchema>;
type SetFillsInput = z.infer<typeof setFillsInputSchema>;
type SetStrokesInput = z.infer<typeof setStrokesInputSchema>;
type SetOpacityInput = z.infer<typeof setOpacityInputSchema>;
type SetCornerRadiusInput = z.infer<typeof setCornerRadiusInputSchema>;
type MoveNodeInput = z.infer<typeof moveNodeInputSchema>;
type RenameNodeInput = z.infer<typeof renameNodeInputSchema>;
type CloneNodeInput = z.infer<typeof cloneNodeInputSchema>;
type DeleteNodeInput = z.infer<typeof deleteNodeInputSchema>;
type SetTextContentInput = z.infer<typeof setTextContentInputSchema>;
type CreateChildInput = z.infer<typeof createChildInputSchema>;
type SetImageFillInput = z.infer<typeof setImageFillInputSchema>;
type EditComponentPropertyInput = z.infer<typeof editComponentPropertyInputSchema>;
type DeleteComponentPropertyInput = z.infer<typeof deleteComponentPropertyInputSchema>;
type CaptureScreenshotInput = z.infer<typeof captureScreenshotInputSchema>;
type LintDesignInput = z.infer<typeof lintDesignInputSchema>;

function resolveFileKey(url: string): string {
	const urlInfo = extractFigmaUrlInfo(url);
	if (!urlInfo) {
		throw new Error(`Invalid Figma URL: ${url}`);
	}
	return urlInfo.branchId || urlInfo.fileKey;
}

export function createLocalReadToolDefinitions(): ToolDefinition<any, any>[] {
	const getVariablesTool: ToolDefinition<VariablesInput, any> = {
			name: "figma_get_variables",
			summary: "Read variables from the active file or a provided file URL.",
			description:
				"Fetch variables using the Desktop Bridge plugin when available, with REST fallback when a file URL and FIGMA_ACCESS_TOKEN are available.",
			tags: ["figma", "variables", "design-system"],
			discoveryGroup: "design-system",
			inputSchema: variablesInputSchema,
			capabilities: {
				requiresPlugin: false,
				requiresRestToken: false,
				supportsCli: true,
				supportsHttp: true,
				supportsMcp: true,
				responseShape: "large",
				sideEffects: "none",
			},
			examples: [
				{
					title: "Read variables from the connected file",
					input: {},
				},
				{
					title: "Read variables from a specific file URL",
					input: {
						fileUrl: "https://www.figma.com/design/FILE_KEY/Design-System",
					},
				},
			],
			relatedTools: ["figma_search_components"],
			handler: async ({ runtime }, input: VariablesInput) => {
				const currentUrl = runtime.getCurrentFileUrl();
				const targetUrl = input.fileUrl || currentUrl;
				const cache = runtime.getVariablesCache();

				if (!targetUrl) {
					throw new Error("No Figma file URL available. Pass fileUrl or connect the Desktop Bridge plugin.");
				}

				const fileKey = resolveFileKey(targetUrl);
				const cached = cache.get(fileKey);
				if (cached && !input.refreshCache) {
					return cached.data;
				}

				let responseData: any;

				try {
					const connector = await runtime.getDesktopConnector();
					const pluginResult = await connector.getVariables(fileKey);
					if (pluginResult?.success && pluginResult.variables && pluginResult.variableCollections) {
						responseData = {
							source: "plugin",
							fileKey,
							fileUrl: targetUrl,
							local: formatVariables({
								variables: Object.fromEntries(pluginResult.variables.map((v: any) => [v.id, v])),
								variableCollections: Object.fromEntries(pluginResult.variableCollections.map((c: any) => [c.id, c])),
							}),
							published: input.includePublished ? null : undefined,
							timestamp: Date.now(),
						};
						cache.set(fileKey, { data: responseData, timestamp: Date.now() });
						return responseData;
					}
				} catch {
					// Fall through to REST path.
				}

				const api = await runtime.getFigmaAPI();
				const { local, published, localError, publishedError } = await api.getAllVariables(fileKey);
				if (localError) {
					throw new Error(localError);
				}

				responseData = {
					source: "rest",
					fileKey,
					fileUrl: targetUrl,
					local: formatVariables(local),
					published: input.includePublished ? formatVariables(published) : null,
					publishedError,
					timestamp: Date.now(),
				};
				cache.set(fileKey, { data: responseData, timestamp: Date.now() });
				return responseData;
			},
		};

	const searchComponentsTool: ToolDefinition<SearchComponentsInput, any> = {
			name: "figma_search_components",
			summary: "Search components in the active file or a published library file.",
			description:
				"Search local components via the Desktop Bridge plugin, or use FIGMA_ACCESS_TOKEN to search a published library file over REST.",
			tags: ["figma", "components", "design-system", "search"],
			discoveryGroup: "design-system",
			inputSchema: searchComponentsInputSchema,
			capabilities: {
				requiresPlugin: false,
				requiresRestToken: false,
				supportsCli: true,
				supportsHttp: true,
				supportsMcp: true,
				responseShape: "medium",
				sideEffects: "none",
			},
			examples: [
				{
					title: "Search in the active file",
					input: { query: "Button" },
				},
				{
					title: "Search a published library file",
					input: { libraryFileKey: "FILE_KEY", query: "Button" },
				},
			],
			relatedTools: ["figma_get_variables"],
			handler: async ({ runtime }, input: SearchComponentsInput) => {
				let resolvedLibraryKey = input.libraryFileKey;
				if (!resolvedLibraryKey && input.libraryFileUrl) {
					resolvedLibraryKey = resolveFileKey(input.libraryFileUrl);
				}

				if (resolvedLibraryKey) {
					const api = await runtime.getFigmaAPI();
					const [componentsResponse, componentSetsResponse] = await Promise.all([
						api.getComponents(resolvedLibraryKey).catch(() => ({ meta: { components: [] } })),
						api.getComponentSets(resolvedLibraryKey).catch(() => ({ meta: { component_sets: [] } })),
					]);

					const rawComponents = componentsResponse?.meta?.components || [];
					const rawComponentSets = componentSetsResponse?.meta?.component_sets || [];
					let results: any[] = [];

					for (const cs of rawComponentSets) {
						const variants = rawComponents.filter((c: any) => {
							const ccs = c.containing_frame?.containingComponentSet;
							if (ccs && typeof ccs === "object" && ccs.nodeId === cs.node_id) return true;
							if (ccs && c.containing_frame?.nodeId === cs.node_id) return true;
							if (c.component_set_id === cs.node_id) return true;
							return false;
						});

						results.push({
							name: cs.name,
							key: cs.key,
							nodeId: cs.node_id,
							description: cs.description || undefined,
							type: "COMPONENT_SET",
							variantCount: variants.length,
							variants: variants.slice(0, 5).map((v: any) => ({ name: v.name, key: v.key })),
							source: "library",
						});
					}

					for (const component of rawComponents) {
						const isVariant = component.containing_frame?.containingComponentSet || component.component_set_id;
						if (!isVariant) {
							results.push({
								name: component.name,
								key: component.key,
								nodeId: component.node_id,
								description: component.description || undefined,
								type: "COMPONENT",
								source: "library",
							});
						}
					}

					results = filterComponentResults(results, input.query, input.category);
					results.sort((a, b) => a.name.localeCompare(b.name));

					return {
						success: true,
						source: "library",
						libraryFileKey: resolvedLibraryKey,
						query: input.query || "(all)",
						category: input.category || "(all)",
						results: results.slice(input.offset, input.offset + input.limit),
						pagination: {
							offset: input.offset,
							limit: input.limit,
							total: results.length,
							hasMore: input.offset + input.limit < results.length,
						},
					};
				}

				const { manifest } = await loadLocalManifest(runtime);
				const results = searchManifestComponents(manifest, input.query || "", {
					category: input.category,
					limit: input.limit,
					offset: input.offset,
				});

				return {
					success: true,
					source: "local",
					query: input.query || "(all)",
					category: input.category || "(all)",
					results: results.results,
					pagination: {
						offset: input.offset,
						limit: input.limit,
						total: results.total,
						hasMore: results.hasMore,
					},
				};
			},
		};

	const parityTool: ToolDefinition<ParityInput, any> = {
		name: "figma_check_design_parity",
		summary: "Compare a Figma node against code-side spec data.",
		description:
			"Registry-backed parity check for HTTP/CLI. Mirrors the original MCP parity flow, including visual, spacing, typography, tokens, component API, accessibility, and metadata analysis.",
		tags: ["figma", "parity", "design-system", "analysis"],
		discoveryGroup: "analysis",
		inputSchema: parityInputSchema,
		capabilities: {
			requiresPlugin: false,
			requiresRestToken: true,
			supportsCli: true,
			supportsHttp: true,
			supportsMcp: true,
			responseShape: "medium",
			sideEffects: "none",
		},
		examples: [
			{
				title: "Compare a component node against code-side data",
				input: {
					fileUrl: "https://www.figma.com/design/FILE_KEY/Design-System",
					nodeId: "123:456",
					codeSpec: {
						visual: { backgroundColor: "#006699", borderRadius: 8 },
						spacing: { paddingTop: 12, paddingRight: 16, paddingBottom: 12, paddingLeft: 16 },
					},
				},
			},
		],
		relatedTools: ["figma_get_variables", "figma_search_components"],
		handler: async ({ runtime }, input: ParityInput) => {
			const currentUrl = runtime.getCurrentFileUrl();
			const targetUrl = input.fileUrl || currentUrl;
			if (!targetUrl) {
				throw new Error("No Figma file URL available. Pass fileUrl or connect the Desktop Bridge plugin.");
			}

			const fileKey = resolveFileKey(targetUrl);
			const api = await runtime.getFigmaAPI();
			return runDesignParityCheck({
				api,
				fileKey,
				nodeId: input.nodeId,
				codeSpec: input.codeSpec as CodeSpec,
				canonicalSource: input.canonicalSource,
				enrich: input.enrich,
			});
		},
	};

	const executeTool: ToolDefinition<ExecuteInput, any> = {
		name: "figma_execute",
		summary: "Execute JavaScript in Figma's plugin context.",
		description:
			"Registry-backed write tool for HTTP/CLI. Runs arbitrary JavaScript against the Figma Plugin API through the Desktop Bridge plugin.",
		tags: ["figma", "write", "plugin", "execute"],
		discoveryGroup: "write",
		inputSchema: executeInputSchema,
		capabilities: {
			requiresPlugin: true,
			requiresRestToken: false,
			supportsCli: true,
			supportsHttp: true,
			supportsMcp: true,
			responseShape: "medium",
			sideEffects: "document_write",
		},
		examples: [
			{
				title: "Create a frame in the current page",
				input: {
					code: "const frame = figma.createFrame(); frame.name = 'New Frame'; figma.currentPage.appendChild(frame); return { id: frame.id, name: frame.name };",
				},
			},
		],
		relatedTools: ["figma_search_components", "figma_check_design_parity"],
		commonErrors: [
			{
				code: "PLUGIN_REQUIRED",
				message: "Desktop Bridge plugin is not connected.",
				hint: "Open the Desktop Bridge plugin in the target Figma file and retry.",
			},
		],
		handler: async ({ runtime }, input: ExecuteInput) => {
			const connector = await runtime.getDesktopConnector();
			const result = await connector.executeCodeViaUI(input.code, input.timeout);
			return {
				success: result.success,
				result: result.result,
				error: result.error,
				resultAnalysis: result.resultAnalysis,
				fileContext: result.fileContext,
				timestamp: Date.now(),
			};
		},
	};

	const instantiateComponentTool: ToolDefinition<InstantiateComponentInput, any> = {
		name: "figma_instantiate_component",
		summary: "Instantiate a component in the connected Figma file.",
		description:
			"Registry-backed write tool for HTTP/CLI. Creates an instance from a component key or nodeId through the Desktop Bridge plugin, with variant selection, overrides, positioning, and optional parent placement.",
		tags: ["figma", "write", "components", "instantiate"],
		discoveryGroup: "write",
		inputSchema: instantiateComponentInputSchema,
		capabilities: {
			requiresPlugin: true,
			requiresRestToken: false,
			supportsCli: true,
			supportsHttp: true,
			supportsMcp: true,
			responseShape: "medium",
			sideEffects: "document_write",
		},
		examples: [
			{
				title: "Instantiate a variant by key and place it at a position",
				input: {
					componentKey: "123abcVariantKey",
					nodeId: "456:789",
					position: { x: 120, y: 240 },
					variant: { State: "Hover" },
					overrides: { "Button Label": "Click Me" },
				},
			},
		],
		relatedTools: ["figma_search_components", "figma_execute"],
		commonErrors: [
			{
				code: "PLUGIN_REQUIRED",
				message: "Desktop Bridge plugin is not connected.",
				hint: "Open the Desktop Bridge plugin in the target Figma file and retry.",
			},
		],
		handler: async ({ runtime }, input: InstantiateComponentInput) => {
			if (!input.componentKey && !input.nodeId) {
				throw new Error("Either componentKey or nodeId is required.");
			}

			const connector = await runtime.getDesktopConnector();
			const result = await connector.instantiateComponent(input.componentKey || "", {
				nodeId: input.nodeId,
				position: input.position,
				overrides: input.overrides,
				variant: input.variant,
				parentId: input.parentId,
			});

			if (!result.success) {
				throw new Error(result.error || "Failed to instantiate component");
			}

			return {
				success: true,
				message: "Component instantiated successfully",
				instance: result.instance,
				timestamp: Date.now(),
			};
		},
	};

	const setInstancePropertiesTool: ToolDefinition<SetInstancePropertiesInput, any> = {
		name: "figma_set_instance_properties",
		summary: "Set component properties on an instance node.",
		description:
			"Registry-backed write tool for HTTP/CLI. Updates TEXT, BOOLEAN, and VARIANT component properties on an instance through the Desktop Bridge plugin.",
		tags: ["figma", "write", "instances", "components"],
		discoveryGroup: "write",
		inputSchema: setInstancePropertiesInputSchema,
		capabilities: {
			requiresPlugin: true,
			requiresRestToken: false,
			supportsCli: true,
			supportsHttp: true,
			supportsMcp: true,
			responseShape: "medium",
			sideEffects: "document_write",
		},
		examples: [
			{
				title: "Set text and boolean properties on an instance",
				input: {
					nodeId: "123:456",
					properties: {
						Label: "Save",
						"Show Icon": true,
					},
				},
			},
		],
		relatedTools: ["figma_instantiate_component", "figma_execute"],
		commonErrors: [
			{
				code: "PLUGIN_REQUIRED",
				message: "Desktop Bridge plugin is not connected.",
				hint: "Open the Desktop Bridge plugin in the target Figma file and retry.",
			},
		],
		handler: async ({ runtime }, input: SetInstancePropertiesInput) => {
			const connector = await runtime.getDesktopConnector();
			const result = await connector.setInstanceProperties(input.nodeId, input.properties);

			if (!result.success) {
				throw new Error(result.error || "Failed to set instance properties");
			}

			return {
				success: true,
				instance: result.instance,
				metadata: {
					note: "Instance properties updated successfully. Use figma_capture_screenshot to verify visual changes.",
				},
				timestamp: Date.now(),
			};
		},
	};

	const addComponentPropertyTool: ToolDefinition<AddComponentPropertyInput, any> = {
		name: "figma_add_component_property",
		summary: "Add a component property to a component or component set.",
		description:
			"Registry-backed write tool for HTTP/CLI. Adds BOOLEAN, TEXT, INSTANCE_SWAP, or VARIANT properties through the Desktop Bridge plugin.",
		tags: ["figma", "write", "components", "properties"],
		discoveryGroup: "write",
		inputSchema: addComponentPropertyInputSchema,
		capabilities: {
			requiresPlugin: true,
			requiresRestToken: false,
			supportsCli: true,
			supportsHttp: true,
			supportsMcp: true,
			responseShape: "medium",
			sideEffects: "document_write",
		},
		examples: [
			{
				title: "Add a boolean property to a component set",
				input: {
					nodeId: "123:456",
					propertyName: "Show Icon",
					type: "BOOLEAN",
					defaultValue: true,
				},
			},
		],
		relatedTools: ["figma_instantiate_component", "figma_set_instance_properties"],
		commonErrors: [
			{
				code: "PLUGIN_REQUIRED",
				message: "Desktop Bridge plugin is not connected.",
				hint: "Open the Desktop Bridge plugin in the target Figma file and retry.",
			},
		],
		handler: async ({ runtime }, input: AddComponentPropertyInput) => {
			const connector = await runtime.getDesktopConnector();
			const result = await connector.addComponentProperty(
				input.nodeId,
				input.propertyName,
				input.type,
				input.defaultValue,
			);

			if (!result.success) {
				throw new Error(result.error || "Failed to add property");
			}

			return {
				success: true,
				message: "Component property added",
				propertyName: result.propertyName,
				hint: "The property name includes a unique suffix (e.g., 'Show Icon#123:456'). Use the full name for editing/deleting.",
				timestamp: Date.now(),
			};
		},
	};

	const setDescriptionTool: ToolDefinition<SetDescriptionInput, any> = {
		name: "figma_set_description",
		summary: "Set the description on a component, component set, or style.",
		description:
			"Registry-backed write tool for HTTP/CLI. Updates plain text and optional markdown descriptions through the Desktop Bridge plugin.",
		tags: ["figma", "write", "metadata", "documentation"],
		discoveryGroup: "write",
		inputSchema: setDescriptionInputSchema,
		capabilities: {
			requiresPlugin: true,
			requiresRestToken: false,
			supportsCli: true,
			supportsHttp: true,
			supportsMcp: true,
			responseShape: "medium",
			sideEffects: "document_write",
		},
		examples: [
			{
				title: "Set a component description with markdown",
				input: {
					nodeId: "123:456",
					description: "Primary call to action button.",
					descriptionMarkdown: "## Usage\nUse for primary actions.",
				},
			},
		],
		relatedTools: ["figma_add_component_property", "figma_check_design_parity"],
		commonErrors: [
			{
				code: "PLUGIN_REQUIRED",
				message: "Desktop Bridge plugin is not connected.",
				hint: "Open the Desktop Bridge plugin in the target Figma file and retry.",
			},
		],
		handler: async ({ runtime }, input: SetDescriptionInput) => {
			const connector = await runtime.getDesktopConnector();
			const result = await connector.setNodeDescription(
				input.nodeId,
				input.description,
				input.descriptionMarkdown,
			);

			if (!result.success) {
				throw new Error(result.error || "Failed to set description");
			}

			return {
				success: true,
				message: "Description set successfully",
				node: result.node,
				timestamp: Date.now(),
			};
		},
	};

	const resizeNodeTool: ToolDefinition<ResizeNodeInput, any> = {
		name: "figma_resize_node",
		summary: "Resize a node to specific dimensions.",
		description:
			"Registry-backed write tool for HTTP/CLI. Resizes a node through the Desktop Bridge plugin, optionally respecting child constraints.",
		tags: ["figma", "write", "layout", "resize"],
		discoveryGroup: "write",
		inputSchema: resizeNodeInputSchema,
		capabilities: {
			requiresPlugin: true,
			requiresRestToken: false,
			supportsCli: true,
			supportsHttp: true,
			supportsMcp: true,
			responseShape: "medium",
			sideEffects: "document_write",
		},
		examples: [
			{
				title: "Resize a node while respecting constraints",
				input: {
					nodeId: "123:456",
					width: 320,
					height: 120,
					withConstraints: true,
				},
			},
		],
		relatedTools: ["figma_set_fills", "figma_set_strokes"],
		commonErrors: [
			{
				code: "PLUGIN_REQUIRED",
				message: "Desktop Bridge plugin is not connected.",
				hint: "Open the Desktop Bridge plugin in the target Figma file and retry.",
			},
		],
		handler: async ({ runtime }, input: ResizeNodeInput) => {
			const connector = await runtime.getDesktopConnector();
			const result = await connector.resizeNode(
				input.nodeId,
				input.width,
				input.height,
				input.withConstraints,
			);

			if (!result.success) {
				throw new Error(result.error || "Failed to resize node");
			}

			return {
				success: true,
				message: `Node resized to ${input.width}x${input.height}`,
				node: result.node,
				timestamp: Date.now(),
			};
		},
	};

	const setFillsTool: ToolDefinition<SetFillsInput, any> = {
		name: "figma_set_fills",
		summary: "Set the fills on a node.",
		description:
			"Registry-backed write tool for HTTP/CLI. Replaces a node's fills through the Desktop Bridge plugin.",
		tags: ["figma", "write", "visual", "fills"],
		discoveryGroup: "write",
		inputSchema: setFillsInputSchema,
		capabilities: {
			requiresPlugin: true,
			requiresRestToken: false,
			supportsCli: true,
			supportsHttp: true,
			supportsMcp: true,
			responseShape: "medium",
			sideEffects: "document_write",
		},
		examples: [
			{
				title: "Set a solid fill",
				input: {
					nodeId: "123:456",
					fills: [{ type: "SOLID", color: "#FF0000" }],
				},
			},
		],
		relatedTools: ["figma_set_strokes", "figma_resize_node"],
		commonErrors: [
			{
				code: "PLUGIN_REQUIRED",
				message: "Desktop Bridge plugin is not connected.",
				hint: "Open the Desktop Bridge plugin in the target Figma file and retry.",
			},
		],
		handler: async ({ runtime }, input: SetFillsInput) => {
			const connector = await runtime.getDesktopConnector();
			const result = await connector.setNodeFills(input.nodeId, input.fills);

			if (!result.success) {
				throw new Error(result.error || "Failed to set fills");
			}

			return {
				success: true,
				message: "Fills updated successfully",
				node: result.node,
				timestamp: Date.now(),
			};
		},
	};

	const setStrokesTool: ToolDefinition<SetStrokesInput, any> = {
		name: "figma_set_strokes",
		summary: "Set the strokes on a node.",
		description:
			"Registry-backed write tool for HTTP/CLI. Replaces a node's strokes and optional stroke weight through the Desktop Bridge plugin.",
		tags: ["figma", "write", "visual", "strokes"],
		discoveryGroup: "write",
		inputSchema: setStrokesInputSchema,
		capabilities: {
			requiresPlugin: true,
			requiresRestToken: false,
			supportsCli: true,
			supportsHttp: true,
			supportsMcp: true,
			responseShape: "medium",
			sideEffects: "document_write",
		},
		examples: [
			{
				title: "Set a solid stroke and weight",
				input: {
					nodeId: "123:456",
					strokes: [{ type: "SOLID", color: "#111111" }],
					strokeWeight: 2,
				},
			},
		],
		relatedTools: ["figma_set_fills", "figma_resize_node"],
		commonErrors: [
			{
				code: "PLUGIN_REQUIRED",
				message: "Desktop Bridge plugin is not connected.",
				hint: "Open the Desktop Bridge plugin in the target Figma file and retry.",
			},
		],
		handler: async ({ runtime }, input: SetStrokesInput) => {
			const connector = await runtime.getDesktopConnector();
			const result = await connector.setNodeStrokes(input.nodeId, input.strokes, input.strokeWeight);

			if (!result.success) {
				throw new Error(result.error || "Failed to set strokes");
			}

			return {
				success: true,
				message: "Strokes updated successfully",
				node: result.node,
				timestamp: Date.now(),
			};
		},
	};

	const setOpacityTool: ToolDefinition<SetOpacityInput, any> = {
		name: "figma_set_opacity",
		summary: "Set the opacity on a node.",
		description:
			"Registry-backed write tool for HTTP/CLI. Updates a node's opacity through the Desktop Bridge plugin.",
		tags: ["figma", "write", "visual", "opacity"],
		discoveryGroup: "write",
		inputSchema: setOpacityInputSchema,
		capabilities: {
			requiresPlugin: true,
			requiresRestToken: false,
			supportsCli: true,
			supportsHttp: true,
			supportsMcp: true,
			responseShape: "medium",
			sideEffects: "document_write",
		},
		examples: [
			{
				title: "Set a node to 50% opacity",
				input: {
					nodeId: "123:456",
					opacity: 0.5,
				},
			},
		],
		relatedTools: ["figma_set_fills", "figma_set_corner_radius"],
		commonErrors: [
			{
				code: "PLUGIN_REQUIRED",
				message: "Desktop Bridge plugin is not connected.",
				hint: "Open the Desktop Bridge plugin in the target Figma file and retry.",
			},
		],
		handler: async ({ runtime }, input: SetOpacityInput) => {
			const connector = await runtime.getDesktopConnector();
			const result = await connector.setNodeOpacity(input.nodeId, input.opacity);

			if (!result.success) {
				throw new Error(result.error || "Failed to set opacity");
			}

			return {
				success: true,
				message: "Opacity updated successfully",
				node: result.node,
				timestamp: Date.now(),
			};
		},
	};

	const setCornerRadiusTool: ToolDefinition<SetCornerRadiusInput, any> = {
		name: "figma_set_corner_radius",
		summary: "Set the corner radius on a node.",
		description:
			"Registry-backed write tool for HTTP/CLI. Updates a node's corner radius through the Desktop Bridge plugin.",
		tags: ["figma", "write", "visual", "radius"],
		discoveryGroup: "write",
		inputSchema: setCornerRadiusInputSchema,
		capabilities: {
			requiresPlugin: true,
			requiresRestToken: false,
			supportsCli: true,
			supportsHttp: true,
			supportsMcp: true,
			responseShape: "medium",
			sideEffects: "document_write",
		},
		examples: [
			{
				title: "Set a node to 8px corner radius",
				input: {
					nodeId: "123:456",
					radius: 8,
				},
			},
		],
		relatedTools: ["figma_set_opacity", "figma_set_strokes"],
		commonErrors: [
			{
				code: "PLUGIN_REQUIRED",
				message: "Desktop Bridge plugin is not connected.",
				hint: "Open the Desktop Bridge plugin in the target Figma file and retry.",
			},
		],
		handler: async ({ runtime }, input: SetCornerRadiusInput) => {
			const connector = await runtime.getDesktopConnector();
			const result = await connector.setNodeCornerRadius(input.nodeId, input.radius);

			if (!result.success) {
				throw new Error(result.error || "Failed to set corner radius");
			}

			return {
				success: true,
				message: "Corner radius updated successfully",
				node: result.node,
				timestamp: Date.now(),
			};
		},
	};

	const moveNodeTool: ToolDefinition<MoveNodeInput, any> = {
		name: "figma_move_node",
		summary: "Move a node to a new position.",
		description:
			"Registry-backed write tool for HTTP/CLI. Moves a node within its parent through the Desktop Bridge plugin.",
		tags: ["figma", "write", "layout", "move"],
		discoveryGroup: "write",
		inputSchema: moveNodeInputSchema,
		capabilities: {
			requiresPlugin: true,
			requiresRestToken: false,
			supportsCli: true,
			supportsHttp: true,
			supportsMcp: true,
			responseShape: "medium",
			sideEffects: "document_write",
		},
		examples: [
			{
				title: "Move a node within its parent",
				input: {
					nodeId: "123:456",
					x: 240,
					y: 320,
				},
			},
		],
		relatedTools: ["figma_resize_node", "figma_rename_node"],
		commonErrors: [
			{
				code: "PLUGIN_REQUIRED",
				message: "Desktop Bridge plugin is not connected.",
				hint: "Open the Desktop Bridge plugin in the target Figma file and retry.",
			},
		],
		handler: async ({ runtime }, input: MoveNodeInput) => {
			const connector = await runtime.getDesktopConnector();
			const result = await connector.moveNode(input.nodeId, input.x, input.y);

			if (!result.success) {
				throw new Error(result.error || "Failed to move node");
			}

			return {
				success: true,
				message: `Node moved to (${input.x}, ${input.y})`,
				node: result.node,
				timestamp: Date.now(),
			};
		},
	};

	const renameNodeTool: ToolDefinition<RenameNodeInput, any> = {
		name: "figma_rename_node",
		summary: "Rename a node in the layer panel.",
		description:
			"Registry-backed write tool for HTTP/CLI. Renames a node through the Desktop Bridge plugin.",
		tags: ["figma", "write", "metadata", "rename"],
		discoveryGroup: "write",
		inputSchema: renameNodeInputSchema,
		capabilities: {
			requiresPlugin: true,
			requiresRestToken: false,
			supportsCli: true,
			supportsHttp: true,
			supportsMcp: true,
			responseShape: "medium",
			sideEffects: "document_write",
		},
		examples: [
			{
				title: "Rename a node",
				input: {
					nodeId: "123:456",
					newName: "Primary Button / Hover",
				},
			},
		],
		relatedTools: ["figma_set_description", "figma_move_node"],
		commonErrors: [
			{
				code: "PLUGIN_REQUIRED",
				message: "Desktop Bridge plugin is not connected.",
				hint: "Open the Desktop Bridge plugin in the target Figma file and retry.",
			},
		],
		handler: async ({ runtime }, input: RenameNodeInput) => {
			const connector = await runtime.getDesktopConnector();
			const result = await connector.renameNode(input.nodeId, input.newName);

			if (!result.success) {
				throw new Error(result.error || "Failed to rename node");
			}

			return {
				success: true,
				message: `Node renamed to "${input.newName}"`,
				node: result.node,
				timestamp: Date.now(),
			};
		},
	};

	const cloneNodeTool: ToolDefinition<CloneNodeInput, any> = {
		name: "figma_clone_node",
		summary: "Duplicate a node.",
		description:
			"Registry-backed write tool for HTTP/CLI. Clones a node through the Desktop Bridge plugin.",
		tags: ["figma", "write", "nodes", "clone"],
		discoveryGroup: "write",
		inputSchema: cloneNodeInputSchema,
		capabilities: {
			requiresPlugin: true,
			requiresRestToken: false,
			supportsCli: true,
			supportsHttp: true,
			supportsMcp: true,
			responseShape: "medium",
			sideEffects: "document_write",
		},
		examples: [
			{
				title: "Clone a node",
				input: {
					nodeId: "123:456",
				},
			},
		],
		relatedTools: ["figma_delete_node", "figma_move_node"],
		commonErrors: [
			{
				code: "PLUGIN_REQUIRED",
				message: "Desktop Bridge plugin is not connected.",
				hint: "Open the Desktop Bridge plugin in the target Figma file and retry.",
			},
		],
		handler: async ({ runtime }, input: CloneNodeInput) => {
			const connector = await runtime.getDesktopConnector();
			const result = await connector.cloneNode(input.nodeId);

			if (!result.success) {
				throw new Error(result.error || "Failed to clone node");
			}

			return {
				success: true,
				message: "Node cloned",
				clonedNode: result.node,
				timestamp: Date.now(),
			};
		},
	};

	const deleteNodeTool: ToolDefinition<DeleteNodeInput, any> = {
		name: "figma_delete_node",
		summary: "Delete a node from the canvas.",
		description:
			"Registry-backed write tool for HTTP/CLI. Deletes a node through the Desktop Bridge plugin. This is a destructive operation.",
		tags: ["figma", "write", "nodes", "delete"],
		discoveryGroup: "write",
		inputSchema: deleteNodeInputSchema,
		capabilities: {
			requiresPlugin: true,
			requiresRestToken: false,
			supportsCli: true,
			supportsHttp: true,
			supportsMcp: true,
			responseShape: "medium",
			sideEffects: "document_write",
		},
		examples: [
			{
				title: "Delete a node",
				input: {
					nodeId: "123:456",
				},
			},
		],
		relatedTools: ["figma_clone_node", "figma_move_node"],
		commonErrors: [
			{
				code: "PLUGIN_REQUIRED",
				message: "Desktop Bridge plugin is not connected.",
				hint: "Open the Desktop Bridge plugin in the target Figma file and retry.",
			},
		],
		handler: async ({ runtime }, input: DeleteNodeInput) => {
			const connector = await runtime.getDesktopConnector();
			const result = await connector.deleteNode(input.nodeId);

			if (!result.success) {
				throw new Error(result.error || "Failed to delete node");
			}

			return {
				success: true,
				message: "Node deleted",
				deleted: result.deleted,
				timestamp: Date.now(),
			};
		},
	};

	const setTextContentTool: ToolDefinition<SetTextContentInput, any> = {
		name: "figma_set_text_content",
		summary: "Set the text content of a text node.",
		description:
			"Registry-backed write tool for HTTP/CLI. Updates a text node's characters and optional font settings through the Desktop Bridge plugin. For component instances, prefer figma_set_instance_properties when text is driven by component properties.",
		tags: ["figma", "write", "text", "content"],
		discoveryGroup: "write",
		inputSchema: setTextContentInputSchema,
		capabilities: {
			requiresPlugin: true,
			requiresRestToken: false,
			supportsCli: true,
			supportsHttp: true,
			supportsMcp: true,
			responseShape: "medium",
			sideEffects: "document_write",
		},
		examples: [
			{
				title: "Update text content and font size",
				input: {
					nodeId: "123:456",
					text: "Save changes",
					fontSize: 14,
				},
			},
		],
		relatedTools: ["figma_set_instance_properties", "figma_rename_node"],
		commonErrors: [
			{
				code: "PLUGIN_REQUIRED",
				message: "Desktop Bridge plugin is not connected.",
				hint: "Open the Desktop Bridge plugin in the target Figma file and retry.",
			},
		],
		handler: async ({ runtime }, input: SetTextContentInput) => {
			const connector = await runtime.getDesktopConnector();
			const options = input.fontSize !== undefined || input.fontWeight !== undefined || input.fontFamily !== undefined
				? {
					fontSize: input.fontSize,
					fontWeight: input.fontWeight,
					fontFamily: input.fontFamily,
				}
				: undefined;
			const result = await connector.setTextContent(input.nodeId, input.text, options);

			if (!result.success) {
				throw new Error(result.error || "Failed to set text content");
			}

			return {
				success: true,
				message: "Text content updated",
				node: result.node,
				timestamp: Date.now(),
			};
		},
	};

	const createChildTool: ToolDefinition<CreateChildInput, any> = {
		name: "figma_create_child",
		summary: "Create a child node inside a parent container.",
		description:
			"Registry-backed write tool for HTTP/CLI. Creates a RECTANGLE, ELLIPSE, FRAME, TEXT, or LINE inside an existing parent through the Desktop Bridge plugin.",
		tags: ["figma", "write", "nodes", "create"],
		discoveryGroup: "write",
		inputSchema: createChildInputSchema,
		capabilities: {
			requiresPlugin: true,
			requiresRestToken: false,
			supportsCli: true,
			supportsHttp: true,
			supportsMcp: true,
			responseShape: "medium",
			sideEffects: "document_write",
		},
		examples: [
			{
				title: "Create a text node inside a frame",
				input: {
					parentId: "123:456",
					nodeType: "TEXT",
					properties: {
						name: "Label",
						x: 16,
						y: 12,
						text: "Save changes",
					},
				},
			},
		],
		relatedTools: ["figma_set_text_content", "figma_set_fills"],
		commonErrors: [
			{
				code: "PLUGIN_REQUIRED",
				message: "Desktop Bridge plugin is not connected.",
				hint: "Open the Desktop Bridge plugin in the target Figma file and retry.",
			},
		],
		handler: async ({ runtime }, input: CreateChildInput) => {
			const connector = await runtime.getDesktopConnector();
			const result = await connector.createChildNode(
				input.parentId,
				input.nodeType,
				input.properties,
			);

			if (!result.success) {
				throw new Error(result.error || "Failed to create node");
			}

			return {
				success: true,
				message: `Created ${input.nodeType} node`,
				node: result.node,
				timestamp: Date.now(),
			};
		},
	};

	const setImageFillTool: ToolDefinition<SetImageFillInput, any> = {
		name: "figma_set_image_fill",
		summary: "Apply an image fill to one or more nodes.",
		description:
			"Registry-backed write tool for HTTP/CLI. Applies a base64-encoded image fill through the Desktop Bridge plugin.",
		tags: ["figma", "write", "images", "fills"],
		discoveryGroup: "write",
		inputSchema: setImageFillInputSchema,
		capabilities: {
			requiresPlugin: true,
			requiresRestToken: false,
			supportsCli: true,
			supportsHttp: true,
			supportsMcp: true,
			responseShape: "medium",
			sideEffects: "document_write",
		},
		examples: [
			{
				title: "Apply an image fill to a rectangle",
				input: {
					nodeIds: ["123:456"],
					imageData: "iVBORw0KGgoAAAANSUhEUgAA...",
					scaleMode: "FILL",
				},
			},
		],
		relatedTools: ["figma_set_fills", "figma_create_child"],
		commonErrors: [
			{
				code: "PLUGIN_REQUIRED",
				message: "Desktop Bridge plugin is not connected.",
				hint: "Open the Desktop Bridge plugin in the target Figma file and retry.",
			},
		],
		handler: async ({ runtime }, input: SetImageFillInput) => {
			const connector = await runtime.getDesktopConnector();
			const result = await connector.setImageFill(input.nodeIds, input.imageData, input.scaleMode || "FILL");

			if (!result.success) {
				throw new Error(result.error || "Failed to set image fill");
			}

			return {
				success: true,
				message: `Image fill applied to ${result.updatedCount || 0} node(s)`,
				imageHash: result.imageHash,
				nodes: result.nodes,
				timestamp: Date.now(),
			};
		},
	};

	const editComponentPropertyTool: ToolDefinition<EditComponentPropertyInput, any> = {
		name: "figma_edit_component_property",
		summary: "Edit an existing component property.",
		description:
			"Registry-backed write tool for HTTP/CLI. Updates a component property's name, default value, or preferred values through the Desktop Bridge plugin.",
		tags: ["figma", "write", "components", "properties"],
		discoveryGroup: "write",
		inputSchema: editComponentPropertyInputSchema,
		capabilities: {
			requiresPlugin: true,
			requiresRestToken: false,
			supportsCli: true,
			supportsHttp: true,
			supportsMcp: true,
			responseShape: "medium",
			sideEffects: "document_write",
		},
		examples: [
			{
				title: "Rename a component property and update its default value",
				input: {
					nodeId: "123:456",
					propertyName: "Show Icon#123:456",
					newValue: {
						name: "Show Leading Icon",
						defaultValue: true,
					},
				},
			},
		],
		relatedTools: ["figma_add_component_property", "figma_delete_component_property"],
		commonErrors: [
			{
				code: "PLUGIN_REQUIRED",
				message: "Desktop Bridge plugin is not connected.",
				hint: "Open the Desktop Bridge plugin in the target Figma file and retry.",
			},
		],
		handler: async ({ runtime }, input: EditComponentPropertyInput) => {
			const connector = await runtime.getDesktopConnector();
			const result = await connector.editComponentProperty(
				input.nodeId,
				input.propertyName,
				input.newValue,
			);

			if (!result.success) {
				throw new Error(result.error || "Failed to edit property");
			}

			return {
				success: true,
				message: "Component property updated",
				propertyName: result.propertyName,
				timestamp: Date.now(),
			};
		},
	};

	const deleteComponentPropertyTool: ToolDefinition<DeleteComponentPropertyInput, any> = {
		name: "figma_delete_component_property",
		summary: "Delete a component property.",
		description:
			"Registry-backed write tool for HTTP/CLI. Deletes a component property through the Desktop Bridge plugin. This is a destructive operation.",
		tags: ["figma", "write", "components", "properties"],
		discoveryGroup: "write",
		inputSchema: deleteComponentPropertyInputSchema,
		capabilities: {
			requiresPlugin: true,
			requiresRestToken: false,
			supportsCli: true,
			supportsHttp: true,
			supportsMcp: true,
			responseShape: "medium",
			sideEffects: "document_write",
		},
		examples: [
			{
				title: "Delete a component property by full name",
				input: {
					nodeId: "123:456",
					propertyName: "Show Icon#123:456",
				},
			},
		],
		relatedTools: ["figma_add_component_property", "figma_edit_component_property"],
		commonErrors: [
			{
				code: "PLUGIN_REQUIRED",
				message: "Desktop Bridge plugin is not connected.",
				hint: "Open the Desktop Bridge plugin in the target Figma file and retry.",
			},
		],
		handler: async ({ runtime }, input: DeleteComponentPropertyInput) => {
			const connector = await runtime.getDesktopConnector();
			const result = await connector.deleteComponentProperty(
				input.nodeId,
				input.propertyName,
			);

			if (!result.success) {
				throw new Error(result.error || "Failed to delete property");
			}

			return {
				success: true,
				message: "Component property deleted",
				timestamp: Date.now(),
			};
		},
	};

	const captureScreenshotTool: ToolDefinition<CaptureScreenshotInput, any> = {
		name: "figma_capture_screenshot",
		summary: "Capture a screenshot from the current plugin runtime state.",
		description:
			"Registry-backed validation tool for HTTP/CLI. Captures a screenshot via the Desktop Bridge plugin's exportAsync path, which reflects the current plugin runtime state rather than delayed cloud rendering.",
		tags: ["figma", "validation", "screenshot", "plugin"],
		discoveryGroup: "analysis",
		inputSchema: captureScreenshotInputSchema,
		capabilities: {
			requiresPlugin: true,
			requiresRestToken: false,
			supportsCli: true,
			supportsHttp: true,
			supportsMcp: true,
			responseShape: "large",
			sideEffects: "none",
		},
		examples: [
			{
				title: "Capture a PNG screenshot of a node",
				input: {
					nodeId: "123:456",
					format: "PNG",
					scale: 2,
				},
			},
		],
		relatedTools: ["figma_lint_design", "figma_check_design_parity"],
		commonErrors: [
			{
				code: "PLUGIN_REQUIRED",
				message: "Desktop Bridge plugin is not connected.",
				hint: "Open the Desktop Bridge plugin in the target Figma file and retry.",
			},
		],
		handler: async ({ runtime }, input: CaptureScreenshotInput) => {
			const connector = await runtime.getDesktopConnector();
			const result = await connector.captureScreenshot(input.nodeId || "", {
				format: input.format,
				scale: input.scale,
			});

			if (!result.success) {
				throw new Error(result.error || "Screenshot capture failed");
			}

			return {
				success: true,
				image: {
					base64: result.image?.base64,
					format: result.image?.format,
					scale: result.image?.scale,
					byteLength: result.image?.byteLength,
					node: result.image?.node,
					bounds: result.image?.bounds,
				},
				metadata: {
					source: "plugin_export_async",
					note: "Screenshot captured from the current plugin runtime state.",
				},
				timestamp: Date.now(),
			};
		},
	};

	const lintDesignTool: ToolDefinition<LintDesignInput, any> = {
		name: "figma_lint_design",
		summary: "Run accessibility and design quality checks.",
		description:
			"Registry-backed analysis tool for HTTP/CLI. Runs design linting through the Desktop Bridge plugin and returns categorized findings for WCAG, design-system, and layout issues.",
		tags: ["figma", "analysis", "lint", "accessibility"],
		discoveryGroup: "analysis",
		inputSchema: lintDesignInputSchema,
		capabilities: {
			requiresPlugin: true,
			requiresRestToken: false,
			supportsCli: true,
			supportsHttp: true,
			supportsMcp: true,
			responseShape: "large",
			sideEffects: "none",
		},
		examples: [
			{
				title: "Lint the current page",
				input: {
					rules: ["all"],
					maxDepth: 10,
					maxFindings: 100,
				},
			},
		],
		relatedTools: ["figma_capture_screenshot", "figma_check_design_parity"],
		commonErrors: [
			{
				code: "PLUGIN_REQUIRED",
				message: "Desktop Bridge plugin is not connected.",
				hint: "Open the Desktop Bridge plugin in the target Figma file and retry.",
			},
		],
		handler: async ({ runtime }, input: LintDesignInput) => {
			const connector = await runtime.getDesktopConnector();
			const result = await connector.lintDesign(
				input.nodeId,
				input.rules || ["all"],
				input.maxDepth || 10,
				input.maxFindings || 100,
			);

			if (!result.success) {
				throw new Error(result.error || "Lint failed");
			}

			return result.data || result;
		},
	};

	return [
		getVariablesTool,
		searchComponentsTool,
		parityTool,
		executeTool,
		instantiateComponentTool,
		setInstancePropertiesTool,
		addComponentPropertyTool,
		setDescriptionTool,
		resizeNodeTool,
		setFillsTool,
		setStrokesTool,
		setOpacityTool,
		setCornerRadiusTool,
		moveNodeTool,
		renameNodeTool,
		cloneNodeTool,
		deleteNodeTool,
		setTextContentTool,
		createChildTool,
		setImageFillTool,
		editComponentPropertyTool,
		deleteComponentPropertyTool,
		captureScreenshotTool,
		lintDesignTool,
	];
}

async function loadLocalManifest(runtime: { getCurrentFileUrl(): string | null; getDesktopConnector(): Promise<any> }) {
	const currentUrl = runtime.getCurrentFileUrl();
	const fileKey = currentUrl ? resolveFileKey(currentUrl) : "unknown";
	const cache = DesignSystemManifestCache.getInstance();
	const cached = cache.get(fileKey);
	if (cached) {
		return cached;
	}

	const connector = await runtime.getDesktopConnector();
	const manifest = createEmptyManifest(fileKey);
	manifest.fileUrl = currentUrl || undefined;

	const variablesResult = await connector.getVariables(fileKey);
	if (variablesResult.success && variablesResult.variableCollections) {
		for (const collection of variablesResult.variableCollections || []) {
			manifest.collections.push({
				id: collection.id,
				name: collection.name,
				modes: collection.modes.map((mode: any) => ({
					modeId: mode.modeId,
					name: mode.name,
				})),
				defaultModeId: collection.defaultModeId,
			});
		}

		for (const variable of variablesResult.variables || []) {
			const defaultModeId = manifest.collections.find((collection) => collection.id === variable.variableCollectionId)?.defaultModeId;
			const defaultValue = defaultModeId ? variable.valuesByMode?.[defaultModeId] : undefined;

			if (variable.resolvedType === "COLOR") {
				manifest.tokens.colors[variable.name] = {
					name: variable.name,
					value: figmaColorToHex(defaultValue),
					variableId: variable.id,
					scopes: variable.scopes,
				};
			} else if (variable.resolvedType === "FLOAT") {
				manifest.tokens.spacing[variable.name] = {
					name: variable.name,
					value: typeof defaultValue === "number" ? defaultValue : 0,
					variableId: variable.id,
				};
			}
		}
	}

	const componentsResult = await connector.getLocalComponents();
	let rawComponents: { components: any[]; componentSets: any[] } | undefined;
	if (componentsResult.success && componentsResult.data) {
		rawComponents = {
			components: componentsResult.data.components || [],
			componentSets: componentsResult.data.componentSets || [],
		};

		for (const component of rawComponents.components) {
			manifest.components[component.name] = {
				key: component.key,
				nodeId: component.nodeId,
				name: component.name,
				description: component.description || undefined,
				defaultSize: { width: component.width, height: component.height },
			};
		}

		for (const componentSet of rawComponents.componentSets) {
			manifest.componentSets[componentSet.name] = {
				key: componentSet.key,
				nodeId: componentSet.nodeId,
				name: componentSet.name,
				description: componentSet.description || undefined,
				variants: componentSet.variants?.map((variant: any) => ({
					key: variant.key,
					nodeId: variant.nodeId,
					name: variant.name,
				})) || [],
				variantAxes: componentSet.variantAxes?.map((axis: any) => ({
					name: axis.name,
					values: axis.values,
				})) || [],
			};
		}
	}

	manifest.summary = {
		totalTokens: Object.keys(manifest.tokens.colors).length + Object.keys(manifest.tokens.spacing).length,
		totalComponents: Object.keys(manifest.components).length,
		totalComponentSets: Object.keys(manifest.componentSets).length,
		colorPalette: Object.keys(manifest.tokens.colors).slice(0, 10),
		spacingScale: Object.values(manifest.tokens.spacing)
			.map((token) => token.value)
			.sort((a, b) => a - b)
			.slice(0, 10),
		typographyScale: [],
		componentCategories: [],
	};

	cache.set(fileKey, manifest, rawComponents);
	const cachedEntry = cache.get(fileKey);
	if (!cachedEntry) {
		throw new Error("Failed to cache local design system manifest.");
	}
	return cachedEntry;
}

function filterComponentResults(results: any[], query?: string, category?: string): any[] {
	const queryLower = query?.toLowerCase();
	const categoryLower = category?.toLowerCase();

	return results.filter((result) => {
		const matchesQuery =
			!queryLower ||
			result.name.toLowerCase().includes(queryLower) ||
			result.description?.toLowerCase().includes(queryLower);
		const matchesCategory =
			!categoryLower ||
			result.name.toLowerCase().includes(categoryLower) ||
			result.description?.toLowerCase().includes(categoryLower);
		return matchesQuery && matchesCategory;
	});
}
