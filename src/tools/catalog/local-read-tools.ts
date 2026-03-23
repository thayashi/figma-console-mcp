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

type VariablesInput = z.infer<typeof variablesInputSchema>;
type SearchComponentsInput = z.infer<typeof searchComponentsInputSchema>;
type ParityInput = z.infer<typeof parityInputSchema>;
type ExecuteInput = z.infer<typeof executeInputSchema>;
type InstantiateComponentInput = z.infer<typeof instantiateComponentInputSchema>;
type SetInstancePropertiesInput = z.infer<typeof setInstancePropertiesInputSchema>;
type AddComponentPropertyInput = z.infer<typeof addComponentPropertyInputSchema>;
type SetDescriptionInput = z.infer<typeof setDescriptionInputSchema>;
type EditComponentPropertyInput = z.infer<typeof editComponentPropertyInputSchema>;
type DeleteComponentPropertyInput = z.infer<typeof deleteComponentPropertyInputSchema>;

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

	return [
		getVariablesTool,
		searchComponentsTool,
		parityTool,
		executeTool,
		instantiateComponentTool,
		setInstancePropertiesTool,
		addComponentPropertyTool,
		setDescriptionTool,
		editComponentPropertyTool,
		deleteComponentPropertyTool,
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
