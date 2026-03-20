import { z } from "zod";
import { extractFigmaUrlInfo, formatVariables } from "../../core/figma-api.js";
import { searchComponents as searchManifestComponents, DesignSystemManifestCache, createEmptyManifest, figmaColorToHex } from "../../core/design-system-manifest.js";
import type { ToolDefinition } from "../types.js";
import { figmaRGBAToHex, normalizeColor, numericClose, resolveVisualNode } from "../../core/design-code-tools.js";

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
	codeSpec: z.object({
		filePath: z.string().optional(),
		visual: z.object({
			backgroundColor: z.string().optional(),
			borderColor: z.string().optional(),
			borderRadius: z.number().optional(),
			borderWidth: z.number().optional(),
			opacity: z.number().optional(),
		}).optional(),
		spacing: z.object({
			paddingTop: z.number().optional(),
			paddingRight: z.number().optional(),
			paddingBottom: z.number().optional(),
			paddingLeft: z.number().optional(),
			gap: z.number().optional(),
			width: z.union([z.number(), z.string()]).optional(),
			height: z.union([z.number(), z.string()]).optional(),
		}).optional(),
		typography: z.object({
			fontFamily: z.string().optional(),
			fontSize: z.number().optional(),
			fontWeight: z.union([z.number(), z.string()]).optional(),
			lineHeight: z.union([z.number(), z.string()]).optional(),
			letterSpacing: z.number().optional(),
		}).optional(),
		metadata: z.object({
			name: z.string().optional(),
			description: z.string().optional(),
		}).optional(),
	}),
	canonicalSource: z.enum(["design", "code"]).optional().default("design"),
});

const executeInputSchema = z.object({
	code: z.string(),
	timeout: z.number().int().min(1).max(30000).optional().default(5000),
});

type VariablesInput = z.infer<typeof variablesInputSchema>;
type SearchComponentsInput = z.infer<typeof searchComponentsInputSchema>;
type ParityInput = z.infer<typeof parityInputSchema>;
type ExecuteInput = z.infer<typeof executeInputSchema>;

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
			"Registry-backed parity check for HTTP/CLI. Compares visual, spacing, typography, and metadata properties between Figma and code input.",
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
			const nodesResponse = await api.getNodes(fileKey, [input.nodeId], { depth: 3 });
			const nodeData = nodesResponse?.nodes?.[input.nodeId];
			if (!nodeData?.document) {
				throw new Error(`Node ${input.nodeId} not found in file ${fileKey}`);
			}

			const node = nodeData.document;
			const visualNode = resolveVisualNode(node);
			const discrepancies = buildParityDiscrepancies(visualNode, node, input.codeSpec);
			const counts = summarizeSeverities(discrepancies);
			const parityScore = Math.max(0, 100 - (counts.critical * 15 + counts.major * 8 + counts.minor * 3 + counts.info));

			return {
				summary: {
					totalDiscrepancies: discrepancies.length,
					parityScore,
					byCritical: counts.critical,
					byMajor: counts.major,
					byMinor: counts.minor,
					byInfo: counts.info,
				},
				discrepancies,
				canonicalSource: input.canonicalSource,
				designData: {
					name: node.name,
					type: node.type,
					nodeId: input.nodeId,
					fills: visualNode.fills,
					strokes: visualNode.strokes,
					cornerRadius: visualNode.cornerRadius,
					opacity: visualNode.opacity,
					spacing: extractSpacing(visualNode),
					typography: extractTypography(visualNode),
				},
				codeData: input.codeSpec,
			};
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

	return [getVariablesTool, searchComponentsTool, parityTool, executeTool];
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

function buildParityDiscrepancies(visualNode: any, node: any, codeSpec: ParityInput["codeSpec"]) {
	const discrepancies: any[] = [];

	const designFill = extractFirstFillColor(visualNode.fills);
	const designStroke = extractFirstStrokeColor(visualNode.strokes);
	const designSpacing = extractSpacing(visualNode);
	const designTypography = extractTypography(visualNode);

	if (codeSpec.visual?.backgroundColor && designFill && normalizeColor(codeSpec.visual.backgroundColor) !== normalizeColor(designFill)) {
		discrepancies.push(makeDiscrepancy("visual", "backgroundColor", "major", designFill, codeSpec.visual.backgroundColor));
	}
	if (codeSpec.visual?.borderColor && designStroke && normalizeColor(codeSpec.visual.borderColor) !== normalizeColor(designStroke)) {
		discrepancies.push(makeDiscrepancy("visual", "borderColor", "major", designStroke, codeSpec.visual.borderColor));
	}
	if (codeSpec.visual?.borderRadius !== undefined && !numericClose(Number(visualNode.cornerRadius || 0), codeSpec.visual.borderRadius)) {
		discrepancies.push(makeDiscrepancy("visual", "borderRadius", "major", visualNode.cornerRadius || 0, codeSpec.visual.borderRadius));
	}
	if (codeSpec.visual?.borderWidth !== undefined && !numericClose(Number(visualNode.strokeWeight || 0), codeSpec.visual.borderWidth)) {
		discrepancies.push(makeDiscrepancy("visual", "borderWidth", "minor", visualNode.strokeWeight || 0, codeSpec.visual.borderWidth));
	}
	if (codeSpec.visual?.opacity !== undefined && !numericClose(Number(visualNode.opacity ?? 1), codeSpec.visual.opacity, 0.01)) {
		discrepancies.push(makeDiscrepancy("visual", "opacity", "minor", visualNode.opacity ?? 1, codeSpec.visual.opacity));
	}

	for (const prop of ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "gap"] as const) {
		const codeValue = codeSpec.spacing?.[prop];
		const designValue = designSpacing[prop];
		if (codeValue !== undefined && designValue !== undefined && !numericClose(Number(designValue), Number(codeValue))) {
			discrepancies.push(makeDiscrepancy("spacing", prop, "major", designValue, codeValue));
		}
	}

	for (const prop of ["width", "height"] as const) {
		const codeValue = codeSpec.spacing?.[prop];
		const designValue = designSpacing[prop];
		if (typeof codeValue === "number" && designValue !== undefined && !numericClose(Number(designValue), codeValue)) {
			discrepancies.push(makeDiscrepancy("spacing", prop, "minor", designValue, codeValue));
		}
	}

	if (codeSpec.typography?.fontFamily && designTypography.fontFamily && codeSpec.typography.fontFamily !== designTypography.fontFamily) {
		discrepancies.push(makeDiscrepancy("typography", "fontFamily", "major", designTypography.fontFamily, codeSpec.typography.fontFamily));
	}
	if (codeSpec.typography?.fontSize !== undefined && designTypography.fontSize !== undefined && !numericClose(Number(designTypography.fontSize), codeSpec.typography.fontSize)) {
		discrepancies.push(makeDiscrepancy("typography", "fontSize", "major", designTypography.fontSize, codeSpec.typography.fontSize));
	}
	if (codeSpec.typography?.fontWeight !== undefined && designTypography.fontWeight !== undefined && String(designTypography.fontWeight) !== String(codeSpec.typography.fontWeight)) {
		discrepancies.push(makeDiscrepancy("typography", "fontWeight", "minor", designTypography.fontWeight, codeSpec.typography.fontWeight));
	}

	if (codeSpec.metadata?.name && node.name && codeSpec.metadata.name !== node.name) {
		discrepancies.push(makeDiscrepancy("naming", "componentName", "info", node.name, codeSpec.metadata.name));
	}

	const designDescription = node.description || "";
	if (codeSpec.metadata?.description && designDescription && normalizeText(designDescription) !== normalizeText(codeSpec.metadata.description)) {
		discrepancies.push(makeDiscrepancy("metadata", "description", "info", designDescription, codeSpec.metadata.description));
	}

	return discrepancies;
}

function makeDiscrepancy(category: string, property: string, severity: string, designValue: unknown, codeValue: unknown) {
	return {
		category,
		property,
		severity,
		designValue,
		codeValue,
		message: `${property} differs between design and code`,
	};
}

function summarizeSeverities(discrepancies: Array<{ severity: string }>) {
	return discrepancies.reduce(
		(acc, discrepancy) => {
			if (discrepancy.severity in acc) {
				acc[discrepancy.severity as keyof typeof acc] += 1;
			}
			return acc;
		},
		{ critical: 0, major: 0, minor: 0, info: 0 },
	);
}

function extractFirstFillColor(fills: any[]): string | null {
	if (!fills || !Array.isArray(fills)) return null;
	const solid = fills.find((fill: any) => fill.type === "SOLID" && fill.visible !== false);
	if (!solid?.color) return null;
	return figmaRGBAToHex({ ...solid.color, a: solid.opacity ?? solid.color.a ?? 1 });
}

function extractFirstStrokeColor(strokes: any[]): string | null {
	if (!strokes || !Array.isArray(strokes)) return null;
	const solid = strokes.find((stroke: any) => stroke.type === "SOLID" && stroke.visible !== false);
	if (!solid?.color) return null;
	return figmaRGBAToHex({ ...solid.color, a: solid.opacity ?? solid.color.a ?? 1 });
}

function extractSpacing(node: any) {
	return {
		paddingTop: node.paddingTop,
		paddingRight: node.paddingRight,
		paddingBottom: node.paddingBottom,
		paddingLeft: node.paddingLeft,
		gap: node.itemSpacing,
		width: node.absoluteBoundingBox?.width,
		height: node.absoluteBoundingBox?.height,
	};
}

function extractTypography(node: any) {
	const targetNode = findFirstTextNode(node);
	const style = targetNode?.style || {};
	return {
		fontFamily: style.fontFamily,
		fontSize: style.fontSize,
		fontWeight: style.fontWeight,
		lineHeight: style.lineHeightPx,
		letterSpacing: style.letterSpacing,
	};
}

function findFirstTextNode(node: any): any | null {
	if (!node) return null;
	if (node.type === "TEXT") return node;
	if (!Array.isArray(node.children)) return null;
	for (const child of node.children) {
		const found = findFirstTextNode(child);
		if (found) return found;
	}
	return null;
}

function normalizeText(value: string): string {
	return value.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
}
