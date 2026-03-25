import { z } from "zod";
import type { ConsoleLogEntry } from "../../core/types/index.js";
import { extractFigmaUrlInfo, formatComponentData, formatVariables } from "../../core/figma-api.js";
import { EnrichmentService } from "../../core/enrichment/index.js";
import { createChildLogger } from "../../core/logger.js";
import type { EnrichmentOptions } from "../../core/types/enriched.js";
import { resolveLintRuleRequest } from "../../core/mockup-lint-preset.js";
import {
	buildAnatomyTree,
	chunkMarkdownByHeaders,
	collectAllVariantData,
	collectTypographyData,
	parseComponentDescription,
	resolveVisualNode,
	sanitizeComponentName,
} from "../../core/design-code-tools.js";
import { extractNodeSpec, listVariants, validateReconstructionSpec } from "../../core/figma-reconstruction-spec.js";
import {
	createEmptyManifest,
	DesignSystemManifestCache,
	figmaColorToHex,
	getCategories,
	getTokenSummary,
	searchComponents as searchManifestComponents,
} from "../../core/design-system-manifest.js";
import { codeSpecSchema, runDesignParityCheck } from "../../core/design-code-tools.js";
import type { CodeSpec } from "../../core/types/design-code.js";
import { normalizeToolDefinitions } from "./conventions.js";
import type { ToolDefinition } from "../types.js";

const logger = createChildLogger({ component: "local-read-tools" });
const enrichmentService = new EnrichmentService(logger);

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

const componentDetailsInputSchema = z.object({
	componentKey: z.string().optional(),
	componentName: z.string().optional(),
	libraryFileKey: z.string().optional(),
	libraryFileUrl: z.string().optional(),
});

const componentInputSchema = z.object({
	fileUrl: z.string().url().optional(),
	nodeId: z.string(),
	format: z.enum(["metadata", "reconstruction"]).optional().default("metadata"),
	enrich: z.boolean().optional(),
});

const libraryComponentsInputSchema = z.object({
	libraryFileUrl: z.string().optional(),
	libraryFileKey: z.string().optional(),
	query: z.string().optional(),
	limit: z.number().int().min(1).max(100).optional().default(25),
	offset: z.number().int().min(0).optional().default(0),
	includeVariants: z.boolean().optional().default(false),
});

const designSystemSummaryInputSchema = z.object({
	forceRefresh: z.boolean().optional().default(false),
});

const tokenValuesInputSchema = z.object({
	type: z.enum(["colors", "spacing", "all"]).optional().default("all"),
	filter: z.string().optional(),
	limit: z.number().int().min(1).max(100).optional().default(50),
});

const componentImageInputSchema = z.object({
	fileUrl: z.string().url().optional(),
	nodeId: z.string(),
	scale: z.number().min(0.01).max(4).optional().default(2),
	format: z.enum(["png", "jpg", "svg", "pdf"]).optional().default("png"),
});

const componentForDevelopmentInputSchema = z.object({
	fileUrl: z.string().url().optional(),
	nodeId: z.string(),
	includeImage: z.boolean().optional().default(true),
});

const designSystemKitInputSchema = z.object({
	fileKey: z.string().optional(),
	include: z.array(z.enum(["tokens", "components", "styles"])).optional().default(["tokens", "components", "styles"]),
	componentIds: z.array(z.string()).optional(),
	includeImages: z.boolean().optional().default(false),
	format: z.enum(["full", "summary", "compact"]).optional().default("full"),
});

const parityInputSchema = z.object({
	fileUrl: z.string().url().optional(),
	nodeId: z.string(),
	codeSpec: codeSpecSchema,
	canonicalSource: z.enum(["design", "code"]).optional().default("design"),
	enrich: z.boolean().optional().default(true),
});

const getStatusInputSchema = z.object({});

const getProjectPolicyInputSchema = z.object({});

const getSelectionInputSchema = z.object({});

const listOpenFilesInputSchema = z.object({});

const getCommentsInputSchema = z.object({
	fileUrl: z.string().url().optional(),
	as_md: z.boolean().optional().default(false),
	include_resolved: z.boolean().optional().default(false),
});

const getFileDataInputSchema = z.object({
	fileUrl: z.string().url().optional(),
	depth: z.number().min(0).max(3).optional().default(1),
	verbosity: z.enum(["summary", "standard", "full"]).optional().default("summary"),
	nodeIds: z.array(z.string()).optional(),
	enrich: z.boolean().optional(),
});

const getStylesInputSchema = z.object({
	fileUrl: z.string().url().optional(),
	verbosity: z.enum(["summary", "standard", "full"]).optional().default("standard"),
	enrich: z.boolean().optional(),
	include_usage: z.boolean().optional(),
	include_exports: z.boolean().optional(),
	export_formats: z.array(z.enum(["css", "sass", "tailwind", "typescript", "json"])).optional(),
});

const getFileForPluginInputSchema = z.object({
	fileUrl: z.string().url().optional(),
	depth: z.number().min(0).max(5).optional().default(2),
	nodeIds: z.array(z.string()).optional(),
});

const codeDocInfoSchema = z.object({
	props: z.array(z.object({
		name: z.string(),
		type: z.string(),
		required: z.boolean().optional(),
		defaultValue: z.string().optional(),
		description: z.string().optional(),
	})).optional(),
	events: z.array(z.object({
		name: z.string(),
		payload: z.string().optional(),
		description: z.string().optional(),
	})).optional(),
	slots: z.array(z.object({
		name: z.string(),
		description: z.string().optional(),
	})).optional(),
	importStatement: z.string().optional(),
	usageExamples: z.array(z.object({
		title: z.string(),
		code: z.string(),
		language: z.string().optional(),
	})).optional(),
	changelog: z.array(z.object({
		version: z.string(),
		date: z.string(),
		changes: z.string(),
	})).optional(),
	filePath: z.string().optional(),
	packageName: z.string().optional(),
	variantDefinition: z.string().optional(),
	subComponents: z.array(z.object({
		name: z.string(),
		description: z.string().optional(),
		element: z.string().optional(),
		dataSlot: z.string().optional(),
		props: z.array(z.object({
			name: z.string(),
			type: z.string(),
			required: z.boolean().optional(),
			defaultValue: z.string().optional(),
			description: z.string().optional(),
		})).optional(),
	})).optional(),
	sourceFiles: z.array(z.object({
		path: z.string(),
		role: z.string(),
		variants: z.number().optional(),
		description: z.string().optional(),
	})).optional(),
	baseComponent: z.object({
		name: z.string(),
		url: z.string().optional(),
		description: z.string().optional(),
	}).optional(),
}).optional();

const componentDocInputSchema = z.object({
	fileUrl: z.string().url().optional(),
	nodeId: z.string(),
	codeInfo: codeDocInfoSchema,
	sections: z.object({
		overview: z.boolean().optional().default(true),
		anatomy: z.boolean().optional().default(true),
		statesAndVariants: z.boolean().optional().default(true),
		visualSpecs: z.boolean().optional().default(true),
		typography: z.boolean().optional().default(true),
		contentGuidelines: z.boolean().optional().default(true),
		behavior: z.boolean().optional().default(false),
		implementation: z.boolean().optional().default(true),
		accessibility: z.boolean().optional().default(true),
		relatedComponents: z.boolean().optional().default(false),
		changelog: z.boolean().optional().default(true),
		parity: z.boolean().optional().default(true),
	}).optional(),
	outputPath: z.string().optional(),
	systemName: z.string().optional(),
	enrich: z.boolean().optional().default(true),
	includeFrontmatter: z.boolean().optional().default(true),
});

const getDesignChangesInputSchema = z.object({
	since: z.number().optional(),
	count: z.number().optional(),
	clear: z.boolean().optional().default(false),
});

const getConsoleLogsInputSchema = z.object({
	count: z.number().optional().default(100),
	level: z.enum(["log", "info", "warn", "error", "debug", "all"]).optional().default("all"),
	since: z.number().optional(),
});

const clearConsoleInputSchema = z.object({});

const watchConsoleInputSchema = z.object({
	duration: z.number().optional().default(30),
	level: z.enum(["log", "info", "warn", "error", "debug", "all"]).optional().default("all"),
});

const reconnectInputSchema = z.object({});

const reloadPluginInputSchema = z.object({
	clearConsole: z.boolean().optional().default(true),
});

const captureScreenshotInputSchema = z.object({
	nodeId: z.string().optional(),
	format: z.enum(["PNG", "JPG", "SVG"]).optional().default("PNG"),
	scale: z.number().min(0.5).max(4).optional().default(2),
});

const lintDesignInputSchema = z.object({
	nodeId: z.string().optional(),
	preset: z.enum(["mockup-quality"]).optional(),
	rules: z.array(z.string()).optional(),
	maxDepth: z.number().optional(),
	maxFindings: z.number().optional(),
});

type VariablesInput = z.infer<typeof variablesInputSchema>;
type SearchComponentsInput = z.infer<typeof searchComponentsInputSchema>;
type ComponentInput = z.infer<typeof componentInputSchema>;
type ComponentDetailsInput = z.infer<typeof componentDetailsInputSchema>;
type LibraryComponentsInput = z.infer<typeof libraryComponentsInputSchema>;
type DesignSystemSummaryInput = z.infer<typeof designSystemSummaryInputSchema>;
type TokenValuesInput = z.infer<typeof tokenValuesInputSchema>;
type ComponentImageInput = z.infer<typeof componentImageInputSchema>;
type ComponentForDevelopmentInput = z.infer<typeof componentForDevelopmentInputSchema>;
type DesignSystemKitInput = z.infer<typeof designSystemKitInputSchema>;
type ParityInput = z.infer<typeof parityInputSchema>;
type GetStatusInput = z.infer<typeof getStatusInputSchema>;
type GetSelectionInput = z.infer<typeof getSelectionInputSchema>;
type ListOpenFilesInput = z.infer<typeof listOpenFilesInputSchema>;
type GetCommentsInput = z.infer<typeof getCommentsInputSchema>;
type GetFileDataInput = z.infer<typeof getFileDataInputSchema>;
type GetStylesInput = z.infer<typeof getStylesInputSchema>;
type GetFileForPluginInput = z.infer<typeof getFileForPluginInputSchema>;
type ComponentDocInput = z.infer<typeof componentDocInputSchema>;
type GetDesignChangesInput = z.infer<typeof getDesignChangesInputSchema>;
type GetConsoleLogsInput = z.infer<typeof getConsoleLogsInputSchema>;
type ClearConsoleInput = z.infer<typeof clearConsoleInputSchema>;
type WatchConsoleInput = z.infer<typeof watchConsoleInputSchema>;
type ReconnectInput = z.infer<typeof reconnectInputSchema>;
type ReloadPluginInput = z.infer<typeof reloadPluginInputSchema>;
type CaptureScreenshotInput = z.infer<typeof captureScreenshotInputSchema>;
type LintDesignInput = z.infer<typeof lintDesignInputSchema>;

const pluginRequiredErrors = [
	{
		code: "PLUGIN_REQUIRED",
		message: "Desktop Bridge plugin is not connected.",
		hint: "Open the Desktop Bridge plugin in the target Figma file and retry.",
	},
] as const;

function resolveFileKey(url: string): string {
	const urlInfo = extractFigmaUrlInfo(url);
	if (!urlInfo) {
		throw new Error(`Invalid Figma URL: ${url}`);
	}
	return urlInfo.branchId || urlInfo.fileKey;
}

function filterFileNode(node: any, level: "summary" | "standard" | "full"): any {
	if (!node) return node;

	if (level === "summary") {
		return {
			id: node.id,
			name: node.name,
			type: node.type,
			...(node.children && {
				children: node.children.map((child: any) => filterFileNode(child, level)),
			}),
		};
	}

	if (level === "standard") {
		const filtered: any = {
			id: node.id,
			name: node.name,
			type: node.type,
			visible: node.visible,
			locked: node.locked,
		};

		if (node.absoluteBoundingBox) filtered.absoluteBoundingBox = node.absoluteBoundingBox;
		if (node.size) filtered.size = node.size;
		if (node.componentId) filtered.componentId = node.componentId;
		if (node.componentPropertyReferences) filtered.componentPropertyReferences = node.componentPropertyReferences;
		if (node.fills && node.fills.length > 0) {
			filtered.fills = node.fills.map((fill: any) => ({
				type: fill.type,
				visible: fill.visible,
				...(fill.color && { color: fill.color }),
			}));
		}
		if (node.pluginData) filtered.pluginData = node.pluginData;
		if (node.sharedPluginData) filtered.sharedPluginData = node.sharedPluginData;
		if (node.children) {
			filtered.children = node.children.map((child: any) => filterFileNode(child, level));
		}
		return filtered;
	}

	return node;
}

function filterStyleNode(style: any, level: "summary" | "standard" | "full"): any {
	if (!style) {
		return style;
	}

	if (level === "summary") {
		return {
			key: style.key,
			name: style.name,
			style_type: style.style_type,
		};
	}

	if (level === "standard") {
		return {
			key: style.key,
			name: style.name,
			description: style.description,
			style_type: style.style_type,
			...(style.remote !== undefined && { remote: style.remote }),
		};
	}

	return style;
}

function filterFileNodeForPlugin(node: any): any {
	if (!node) {
		return node;
	}

	const filtered: any = {
		id: node.id,
		name: node.name,
		type: node.type,
		...(node.description && { description: node.description }),
		...(node.descriptionMarkdown && { descriptionMarkdown: node.descriptionMarkdown }),
	};

	if (node.visible !== undefined) filtered.visible = node.visible;
	if (node.locked) filtered.locked = node.locked;
	if (node.removed) filtered.removed = node.removed;

	if (node.absoluteBoundingBox) {
		filtered.bounds = {
			x: node.absoluteBoundingBox.x,
			y: node.absoluteBoundingBox.y,
			width: node.absoluteBoundingBox.width,
			height: node.absoluteBoundingBox.height,
		};
	}

	if (node.pluginData) filtered.pluginData = node.pluginData;
	if (node.sharedPluginData) filtered.sharedPluginData = node.sharedPluginData;
	if (node.componentId) filtered.componentId = node.componentId;
	if (node.mainComponent) filtered.mainComponent = node.mainComponent;
	if (node.componentPropertyReferences) filtered.componentPropertyReferences = node.componentPropertyReferences;
	if (node.instanceOf) filtered.instanceOf = node.instanceOf;
	if (node.exposedInstances) filtered.exposedInstances = node.exposedInstances;
	if (node.componentProperties) filtered.componentProperties = node.componentProperties;
	if (node.characters !== undefined) filtered.characters = node.characters;

	if (node.children) {
		filtered.children = node.children.map((child: any) => filterFileNodeForPlugin(child));
	}

	return filtered;
}

function filterComponentNodeForDevelopment(node: any): any {
	if (!node) {
		return node;
	}

	const filtered: any = {
		id: node.id,
		name: node.name,
		type: node.type,
		...(node.description && { description: node.description }),
		...(node.descriptionMarkdown && { descriptionMarkdown: node.descriptionMarkdown }),
	};

	if (node.absoluteBoundingBox) filtered.absoluteBoundingBox = node.absoluteBoundingBox;
	if (node.relativeTransform) filtered.relativeTransform = node.relativeTransform;
	if (node.size) filtered.size = node.size;
	if (node.constraints) filtered.constraints = node.constraints;
	if (node.layoutAlign) filtered.layoutAlign = node.layoutAlign;
	if (node.layoutGrow) filtered.layoutGrow = node.layoutGrow;
	if (node.layoutPositioning) filtered.layoutPositioning = node.layoutPositioning;

	if (node.layoutMode) filtered.layoutMode = node.layoutMode;
	if (node.primaryAxisSizingMode) filtered.primaryAxisSizingMode = node.primaryAxisSizingMode;
	if (node.counterAxisSizingMode) filtered.counterAxisSizingMode = node.counterAxisSizingMode;
	if (node.primaryAxisAlignItems) filtered.primaryAxisAlignItems = node.primaryAxisAlignItems;
	if (node.counterAxisAlignItems) filtered.counterAxisAlignItems = node.counterAxisAlignItems;
	if (node.paddingLeft !== undefined) filtered.paddingLeft = node.paddingLeft;
	if (node.paddingRight !== undefined) filtered.paddingRight = node.paddingRight;
	if (node.paddingTop !== undefined) filtered.paddingTop = node.paddingTop;
	if (node.paddingBottom !== undefined) filtered.paddingBottom = node.paddingBottom;
	if (node.itemSpacing !== undefined) filtered.itemSpacing = node.itemSpacing;
	if (node.itemReverseZIndex) filtered.itemReverseZIndex = node.itemReverseZIndex;
	if (node.strokesIncludedInLayout) filtered.strokesIncludedInLayout = node.strokesIncludedInLayout;

	if (node.fills) filtered.fills = node.fills;
	if (node.strokes) filtered.strokes = node.strokes;
	if (node.strokeWeight !== undefined) filtered.strokeWeight = node.strokeWeight;
	if (node.strokeAlign) filtered.strokeAlign = node.strokeAlign;
	if (node.strokeCap) filtered.strokeCap = node.strokeCap;
	if (node.strokeJoin) filtered.strokeJoin = node.strokeJoin;
	if (node.dashPattern) filtered.dashPattern = node.dashPattern;
	if (node.cornerRadius !== undefined) filtered.cornerRadius = node.cornerRadius;
	if (node.rectangleCornerRadii) filtered.rectangleCornerRadii = node.rectangleCornerRadii;
	if (node.effects) filtered.effects = node.effects;
	if (node.opacity !== undefined) filtered.opacity = node.opacity;
	if (node.blendMode) filtered.blendMode = node.blendMode;
	if (node.isMask) filtered.isMask = node.isMask;
	if (node.clipsContent) filtered.clipsContent = node.clipsContent;

	if (node.characters) filtered.characters = node.characters;
	if (node.style) filtered.style = node.style;
	if (node.characterStyleOverrides) filtered.characterStyleOverrides = node.characterStyleOverrides;
	if (node.styleOverrideTable) filtered.styleOverrideTable = node.styleOverrideTable;

	if (node.componentProperties) filtered.componentProperties = node.componentProperties;
	if (node.componentPropertyDefinitions) filtered.componentPropertyDefinitions = node.componentPropertyDefinitions;
	if (node.variantProperties) filtered.variantProperties = node.variantProperties;
	if (node.componentId) filtered.componentId = node.componentId;

	if (node.visible !== undefined) filtered.visible = node.visible;
	if (node.locked) filtered.locked = node.locked;

	if (node.children) {
		filtered.children = node.children.map((child: any) => filterComponentNodeForDevelopment(child));
	}

	return filtered;
}

function rgbaToHex(color: { r: number; g: number; b: number; a?: number }): string {
	const r = Math.round(color.r * 255);
	const g = Math.round(color.g * 255);
	const b = Math.round(color.b * 255);
	return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`.toUpperCase();
}

function extractVisualSpec(node: any): any {
	if (!node) return undefined;
	const spec: any = {};
	let hasData = false;

	if (node.fills?.length) {
		spec.fills = node.fills
			.filter((fill: any) => fill.visible !== false)
			.map((fill: any) => ({
				type: fill.type,
				...(fill.color && { color: rgbaToHex(fill.color) }),
				...(fill.opacity !== undefined && { opacity: fill.opacity }),
			}));
		if (spec.fills.length) hasData = true;
	}

	if (node.strokes?.length) {
		spec.strokes = node.strokes
			.filter((stroke: any) => stroke.visible !== false)
			.map((stroke: any) => ({
				type: stroke.type,
				...(stroke.color && { color: rgbaToHex(stroke.color) }),
				...(node.strokeWeight !== undefined && { weight: node.strokeWeight }),
				...(node.strokeAlign && { align: node.strokeAlign }),
			}));
		if (spec.strokes.length) hasData = true;
	}

	if (node.effects?.length) {
		spec.effects = node.effects
			.filter((effect: any) => effect.visible !== false)
			.map((effect: any) => ({
				type: effect.type,
				...(effect.color && { color: rgbaToHex(effect.color) }),
				...(effect.offset && { offset: effect.offset }),
				...(effect.radius !== undefined && { radius: effect.radius }),
				...(effect.spread !== undefined && { spread: effect.spread }),
			}));
		if (spec.effects.length) hasData = true;
	}

	if (node.cornerRadius !== undefined) {
		spec.cornerRadius = node.cornerRadius;
		hasData = true;
	}
	if (node.rectangleCornerRadii) {
		spec.rectangleCornerRadii = node.rectangleCornerRadii;
		hasData = true;
	}
	if (node.opacity !== undefined && node.opacity < 1) {
		spec.opacity = node.opacity;
		hasData = true;
	}
	if (node.layoutMode && node.layoutMode !== "NONE") {
		spec.layout = {
			mode: node.layoutMode,
			...(node.paddingTop !== undefined && { paddingTop: node.paddingTop }),
			...(node.paddingRight !== undefined && { paddingRight: node.paddingRight }),
			...(node.paddingBottom !== undefined && { paddingBottom: node.paddingBottom }),
			...(node.paddingLeft !== undefined && { paddingLeft: node.paddingLeft }),
			...(node.itemSpacing !== undefined && { itemSpacing: node.itemSpacing }),
			...(node.primaryAxisAlignItems && { primaryAxisAlign: node.primaryAxisAlignItems }),
			...(node.counterAxisAlignItems && { counterAxisAlign: node.counterAxisAlignItems }),
		};
		hasData = true;
	}
	if (node.type === "TEXT" && node.style) {
		spec.typography = {
			...(node.style.fontFamily && { fontFamily: node.style.fontFamily }),
			...(node.style.fontSize && { fontSize: node.style.fontSize }),
			...(node.style.fontWeight && { fontWeight: node.style.fontWeight }),
			...(node.style.lineHeightPx && { lineHeight: node.style.lineHeightPx }),
			...(node.style.letterSpacing && { letterSpacing: node.style.letterSpacing }),
			...(node.style.textAlignHorizontal && { textAlignHorizontal: node.style.textAlignHorizontal }),
		};
		hasData = true;
	}

	return hasData ? spec : undefined;
}

function extractComponentVisualData(node: any): any {
	if (!node) return {};
	const visualSpec = extractVisualSpec(node);
	const childSpecs = Array.isArray(node.children)
		? node.children.map((child: any) => ({
			name: child.name,
			type: child.type,
			...(extractVisualSpec(child) && { visualSpec: extractVisualSpec(child) }),
			...(child.characters && { characters: child.characters }),
		}))
		: [];
	return {
		...(visualSpec && { visualSpec }),
		...(childSpecs.length && { childSpecs }),
	};
}

async function resolveStyleValues(api: any, fileKey: string, styles: any[]): Promise<Map<string, any>> {
	const resolved = new Map<string, any>();
	const nodeIds = styles.filter((style) => style.nodeId).map((style) => style.nodeId as string);
	if (!nodeIds.length) return resolved;

	const batchSize = 50;
	for (let i = 0; i < nodeIds.length; i += batchSize) {
		const batch = nodeIds.slice(i, i + batchSize);
		const nodeResponse = await api.getNodes(fileKey, batch);
		for (const [nodeId, nodeData] of Object.entries(nodeResponse?.nodes || {})) {
			const doc = (nodeData as any)?.document;
			if (!doc) continue;
			const value: any = {};
			if (doc.fills?.length) {
				value.fills = doc.fills
					.filter((fill: any) => fill.visible !== false)
					.map((fill: any) => ({
						type: fill.type,
						...(fill.color && { color: rgbaToHex(fill.color) }),
						...(fill.opacity !== undefined && { opacity: fill.opacity }),
					}));
			}
			if (doc.type === "TEXT" && doc.style) {
				value.typography = {
					fontFamily: doc.style.fontFamily,
					fontSize: doc.style.fontSize,
					fontWeight: doc.style.fontWeight,
					lineHeight: doc.style.lineHeightPx,
					letterSpacing: doc.style.letterSpacing,
				};
			}
			if (doc.effects?.length) {
				value.effects = doc.effects
					.filter((effect: any) => effect.visible !== false)
					.map((effect: any) => ({
						type: effect.type,
						...(effect.color && { color: rgbaToHex(effect.color) }),
						...(effect.offset && { offset: effect.offset }),
						...(effect.radius !== undefined && { radius: effect.radius }),
						...(effect.spread !== undefined && { spread: effect.spread }),
					}));
			}
			resolved.set(nodeId, value);
		}
	}

	return resolved;
}

function groupVariablesByCollection(formatted: { collections: any[]; variables: any[] }) {
	return formatted.collections.map((collection) => ({
		id: collection.id,
		name: collection.name,
		modes: collection.modes,
		variables: formatted.variables
			.filter((variable) => variable.variableCollectionId === collection.id)
			.map((variable) => ({
				id: variable.id,
				name: variable.name,
				type: variable.resolvedType,
				description: variable.description || undefined,
				valuesByMode: variable.valuesByMode,
				scopes: variable.scopes,
			})),
	}));
}

function deduplicateComponents(components: any[], componentSets: any[]) {
	const setNodeIds = new Set(componentSets.map((set: any) => set.node_id));
	return {
		components: components.filter((component: any) => {
			const containingSetNodeId = component.containing_frame?.containingComponentSet?.nodeId;
			const containingFrameNodeId = component.containing_frame?.nodeId;
			return !(
				(containingSetNodeId && setNodeIds.has(containingSetNodeId)) ||
				(containingFrameNodeId && setNodeIds.has(containingFrameNodeId))
			);
		}),
		componentSets,
	};
}

function compressKit(kit: any, level: "summary" | "inventory" | "compact") {
	const compressed = { ...kit };

	if (compressed.tokens) {
		if (level === "compact") {
			compressed.tokens = {
				collections: [],
				summary: compressed.tokens.summary,
			};
		} else if (level === "inventory") {
			compressed.tokens = {
				...compressed.tokens,
				collections: compressed.tokens.collections.map((collection: any) => ({
					...collection,
					variables: collection.variables.map((variable: any) => ({
						id: variable.id,
						name: variable.name,
						type: variable.type,
						description: variable.description,
						valuesByMode: {},
						scopes: variable.scopes,
					})),
				})),
			};
		}
	}

	if (compressed.components) {
		if (level === "compact") {
			compressed.components = {
				...compressed.components,
				items: compressed.components.items.map((component: any) => ({
					id: component.id,
					name: component.name,
					variants: component.variants?.map((variant: any) => ({ name: variant.name, id: variant.id })),
					properties: component.properties
						? Object.fromEntries(
							Object.entries(component.properties).map(([key, value]: [string, any]) => [
								key,
								{ type: value.type, defaultValue: value.defaultValue },
							]),
						)
						: undefined,
				})),
			};
		} else if (level === "inventory") {
			compressed.components = {
				...compressed.components,
				items: compressed.components.items.map((component: any) => ({
					id: component.id,
					name: component.name,
					description: component.description,
					properties: component.properties
						? Object.fromEntries(
							Object.entries(component.properties).map(([key, value]: [string, any]) => [
								key,
								{ type: value.type, defaultValue: value.defaultValue },
							]),
						)
						: undefined,
				})),
			};
		} else if (level === "summary") {
			compressed.components = {
				...compressed.components,
				items: compressed.components.items.map((component: any) => ({
					...component,
					variants: component.variants?.map((variant: any) => ({ name: variant.name, id: variant.id })),
				})),
			};
		}
		compressed.components.items = compressed.components.items.map((component: any) => {
			const { imageUrl, ...rest } = component;
			return rest;
		});
	}

	if (compressed.styles) {
		if (level === "compact") {
			compressed.styles = {
				...compressed.styles,
				items: compressed.styles.items.map((style: any) => ({
					key: style.key,
					name: style.name,
					styleType: style.styleType,
				})),
			};
		} else if (level === "inventory") {
			compressed.styles = {
				...compressed.styles,
				items: compressed.styles.items.map((style: any) => ({
					key: style.key,
					name: style.name,
					styleType: style.styleType,
					description: style.description,
				})),
			};
		}
	}

	return compressed;
}

function stringifyValue(value: unknown): string {
	if (value === undefined || value === null) return "";
	if (typeof value === "string") return value;
	return JSON.stringify(value);
}

function buildMarkdownList(items: string[]): string {
	return items.map((item) => `- ${item}`).join("\n");
}

function buildVariantSummary(node: any, varNameMap: Map<string, string>): string {
	const variantData = collectAllVariantData(node, varNameMap);
	if (!variantData.length) {
		return "";
	}

	const parts = variantData.map((variant) => {
		const lines = [`### ${variant.variantName}`];
		if (variant.fills.length) {
			lines.push("Colors:");
			lines.push(...variant.fills.slice(0, 6).map((fill) => `- ${fill.nodeName || "Fill"}: ${fill.hex}${fill.variableName ? ` (${fill.variableName})` : ""}`));
		}
		if (variant.strokes.length) {
			lines.push("Strokes:");
			lines.push(...variant.strokes.slice(0, 4).map((stroke) => `- ${stroke.nodeName || "Stroke"}: ${stroke.hex}${stroke.variableName ? ` (${stroke.variableName})` : ""}`));
		}
		if (variant.textColors.length) {
			lines.push("Text colors:");
			lines.push(...variant.textColors.slice(0, 4).map((color) => `- ${color.nodeName || "Text"}: ${color.hex}${color.variableName ? ` (${color.variableName})` : ""}`));
		}
		if (variant.icons.length) {
			lines.push("Icons:");
			lines.push(...variant.icons.map((icon) => `- ${icon.name}`));
		}
		return lines.join("\n");
	});

	return parts.join("\n\n");
}

function buildVisualSpecSummary(node: any): string {
	const visualNode = resolveVisualNode(node);
	const visualSpec = extractVisualSpec(visualNode);
	if (!visualSpec) {
		return "";
	}
	return [
		visualSpec.fills?.length ? `- Fills: ${visualSpec.fills.map((fill: any) => fill.color || fill.type).join(", ")}` : "",
		visualSpec.strokes?.length ? `- Strokes: ${visualSpec.strokes.map((stroke: any) => `${stroke.weight || 1}px ${stroke.color || stroke.type}`).join(", ")}` : "",
		visualSpec.cornerRadius !== undefined ? `- Corner radius: ${visualSpec.cornerRadius}` : "",
		visualSpec.layout ? `- Layout: ${visualSpec.layout.mode || "NONE"}${visualSpec.layout.itemSpacing !== undefined ? `, gap ${visualSpec.layout.itemSpacing}` : ""}` : "",
		visualSpec.typography ? `- Typography: ${visualSpec.typography.fontFamily || "Unknown"} ${visualSpec.typography.fontSize || ""}/${visualSpec.typography.lineHeight || ""}` : "",
	].filter(Boolean).join("\n");
}

function buildImplementationSection(codeInfo: any): string {
	const parts: string[] = ["## Implementation"];
	if (codeInfo.importStatement) {
		parts.push("### Import");
		parts.push("```ts");
		parts.push(codeInfo.importStatement);
		parts.push("```");
	}
	if (codeInfo.props?.length) {
		parts.push("### Props");
		parts.push(buildMarkdownList(codeInfo.props.map((prop: any) => `\`${prop.name}\` (${prop.type})${prop.required ? " required" : ""}${prop.description ? ` - ${prop.description}` : ""}`)));
	}
	if (codeInfo.usageExamples?.length) {
		for (const example of codeInfo.usageExamples) {
			parts.push(`### ${example.title}`);
			parts.push(`\`\`\`${example.language || ""}`.trim());
			parts.push(example.code);
			parts.push("```");
		}
	}
	return parts.join("\n");
}

function buildAccessibilitySection(parsedDescription: any, codeInfo: any): string {
	const notes = [...(parsedDescription.accessibilityNotes || [])];
	if (codeInfo?.events?.length) {
		notes.push(`Events: ${codeInfo.events.map((event: any) => event.name).join(", ")}`);
	}
	if (!notes.length) {
		return "";
	}
	return ["## Accessibility", buildMarkdownList(notes)].join("\n");
}

export function createLocalReadToolDefinitions(): ToolDefinition<any, any>[] {
	const getVariablesTool: ToolDefinition<VariablesInput, any> = {
		name: "figma_get_variables",
		summary: "Read variables from the active file or a provided file URL.",
		description:
			"Registry-backed design-system read tool for HTTP/CLI. Reads variables from the active file through the Desktop Bridge plugin when available, with REST fallback when a file URL and FIGMA_ACCESS_TOKEN are available.",
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
			"Registry-backed design-system discovery tool for HTTP/CLI. Searches local components through the Desktop Bridge plugin, or uses FIGMA_ACCESS_TOKEN to search a published library file over REST.",
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

	const getComponentDetailsTool: ToolDefinition<ComponentDetailsInput, any> = {
		name: "figma_get_component_details",
		summary: "Get full details for a specific local or published component.",
		description:
			"Registry-backed component inspection tool for HTTP/CLI. Resolves a component or component set by key or name, returning variants, properties, and instantiation guidance.",
		tags: ["figma", "components", "design-system", "discovery"],
		discoveryGroup: "design-system",
		inputSchema: componentDetailsInputSchema,
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
				title: "Inspect a local component set by key",
				input: { componentKey: "abc123def456" },
			},
			{
				title: "Inspect a published library component by name",
				input: { libraryFileKey: "FILE_KEY", componentName: "Button" },
			},
		],
		relatedTools: ["figma_search_components", "figma_instantiate_component"],
		handler: async ({ runtime }, input: ComponentDetailsInput) => {
			if (!input.componentKey && !input.componentName) {
				throw new Error("Either componentKey or componentName is required.");
			}

			const resolvedLibraryKey = resolveOptionalLibraryKey(input.libraryFileKey, input.libraryFileUrl);
			if (resolvedLibraryKey) {
				const api = await runtime.getFigmaAPI();
				const catalog = await fetchLibraryComponentCatalog(api, resolvedLibraryKey);
				const match = findLibraryComponentMatch(catalog, input);

				if (!match) {
					throw new Error(`Component not found: ${input.componentKey || input.componentName}`);
				}

				return {
					success: true,
					source: "library",
					libraryFileKey: resolvedLibraryKey,
					type: match.kind,
					component: match.component,
					instantiation: buildInstantiationGuidance(match.component, match.kind),
				};
			}

			const cacheEntry = await loadLocalManifest(runtime);
			const match = findLocalComponentMatch(cacheEntry, input);
			if (!match) {
				throw new Error(`Component not found: ${input.componentKey || input.componentName}`);
			}

			return {
				success: true,
				source: "local",
				fileKey: cacheEntry.fileKey,
				type: match.kind,
				component: match.component,
				instantiation: buildInstantiationGuidance(match.component, match.kind),
			};
		},
	};

	const getComponentTool: ToolDefinition<ComponentInput, any> = {
		name: "figma_get_component",
		summary: "Read a single component's metadata or reconstruction spec.",
		description:
			"Registry-backed component inspection tool for HTTP/CLI. Returns component metadata by default and can emit a reconstruction spec for programmatic recreation.",
		tags: ["figma", "components", "metadata", "reconstruction"],
		discoveryGroup: "document",
		inputSchema: componentInputSchema,
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
				title: "Read component metadata",
				input: { nodeId: "123:456" },
			},
			{
				title: "Generate a reconstruction spec",
				input: { nodeId: "123:456", format: "reconstruction" },
			},
		],
		relatedTools: ["figma_get_component_for_development", "figma_get_component_image"],
		handler: async ({ runtime }, input: ComponentInput) => {
			const currentUrl = runtime.getCurrentFileUrl();
			const targetUrl = input.fileUrl || currentUrl;
			if (!targetUrl) {
				throw new Error("No Figma file URL available. Pass fileUrl or connect the Desktop Bridge plugin.");
			}

			const fileKey = resolveFileKey(targetUrl);
			let pluginError: string | null = null;

			if (runtime.getDesktopConnector) {
				try {
					const connector = await runtime.getDesktopConnector();
					const bridgeResult = await connector.getComponentFromPluginUI(input.nodeId);
					if (bridgeResult?.success && bridgeResult.component) {
						if (input.format === "reconstruction") {
							const reconstructionSpec = extractNodeSpec(bridgeResult.component);
							const validation = validateReconstructionSpec(reconstructionSpec);
							if (reconstructionSpec.type === "COMPONENT_SET") {
								return {
									error: "COMPONENT_SET_NOT_SUPPORTED",
									componentName: reconstructionSpec.name,
									availableVariants: listVariants(bridgeResult.component),
									instructions: [
										"Select a specific variant component instead of the component set container.",
										"Use figma_get_component again with the chosen variant node ID.",
									],
									validation,
								};
							}
							return reconstructionSpec;
						}

						let component = bridgeResult.component;
						if (input.enrich) {
							component = await enrichmentService.enrichComponent(component, fileKey, {
								enrich: true,
								include_usage: true,
							});
						}

						return {
							fileKey,
							fileUrl: targetUrl,
							nodeId: input.nodeId,
							component,
							source: "desktop_bridge_plugin",
							enriched: input.enrich ?? false,
							note: "Retrieved via Desktop Bridge plugin. Description fields are the most reliable on this path.",
							timestamp: Date.now(),
						};
					}
				} catch (error) {
					pluginError = error instanceof Error ? error.message : String(error);
				}
			}

			const api = await runtime.getFigmaAPI();
			const componentData = await api.getComponentData(fileKey, input.nodeId);
			const node = componentData?.document;
			if (!node) {
				throw new Error(`Component not found: ${input.nodeId}`);
			}

			if (input.format === "reconstruction") {
				const reconstructionSpec = extractNodeSpec(node);
				const validation = validateReconstructionSpec(reconstructionSpec);
				if (reconstructionSpec.type === "COMPONENT_SET") {
					return {
						error: "COMPONENT_SET_NOT_SUPPORTED",
						componentName: reconstructionSpec.name,
						availableVariants: listVariants(node),
						instructions: [
							"Select a specific variant component instead of the component set container.",
							"Use figma_get_component again with the chosen variant node ID.",
						],
						validation,
					};
				}
				return reconstructionSpec;
			}

			let component = formatComponentData(node);
			if (input.enrich) {
				component = await enrichmentService.enrichComponent(component, fileKey, {
					enrich: true,
					include_usage: true,
				});
			}

			return {
				fileKey,
				fileUrl: targetUrl,
				nodeId: input.nodeId,
				component,
				source: "rest_api",
				enriched: input.enrich ?? false,
				warning: !component.description && !component.descriptionMarkdown
					? "Description data may be incomplete on the REST API path."
					: undefined,
				pluginFallbackError: pluginError || undefined,
				timestamp: Date.now(),
			};
		},
	};

	const getLibraryComponentsTool: ToolDefinition<LibraryComponentsInput, any> = {
		name: "figma_get_library_components",
		summary: "Discover published components from a shared library file.",
		description:
			"Registry-backed library discovery tool for HTTP/CLI. Uses the REST API to enumerate component sets, standalone components, and optionally individual variants from a published Figma library.",
		tags: ["figma", "components", "library", "discovery"],
		discoveryGroup: "design-system",
		inputSchema: libraryComponentsInputSchema,
		capabilities: {
			requiresPlugin: false,
			requiresRestToken: true,
			supportsCli: true,
			supportsHttp: true,
			supportsMcp: true,
			responseShape: "large",
			sideEffects: "none",
		},
		examples: [
			{
				title: "Browse a published library",
				input: { libraryFileKey: "FILE_KEY" },
			},
			{
				title: "Search variants in a published library",
				input: { libraryFileKey: "FILE_KEY", query: "Button", includeVariants: true },
			},
		],
		relatedTools: ["figma_search_components", "figma_get_component_details"],
		handler: async ({ runtime }, input: LibraryComponentsInput) => {
			const fileKey = resolveOptionalLibraryKey(input.libraryFileKey, input.libraryFileUrl);
			if (!fileKey) {
				throw new Error("Either libraryFileKey or libraryFileUrl is required.");
			}
			const limit = input.limit ?? 25;
			const offset = input.offset ?? 0;
			const includeVariants = input.includeVariants ?? false;

			const api = await runtime.getFigmaAPI();
			const catalog = await fetchLibraryComponentCatalog(api, fileKey);
			let allResults: any[] = [
				...buildLibraryComponentSets(catalog.rawComponentSets, catalog.rawComponents),
				...buildLibraryStandaloneComponents(catalog.rawComponents),
			];

			if (includeVariants) {
				allResults = [...allResults, ...buildLibraryVariantComponents(catalog.rawComponents)];
			}

			const filteredResults = filterComponentResults(allResults, input.query);
			filteredResults.sort((a, b) => a.name.localeCompare(b.name));

			return {
				success: true,
				libraryFileKey: fileKey,
				query: input.query || "(all)",
				summary: {
					totalComponentSets: catalog.rawComponentSets.length,
					totalStandaloneComponents: buildLibraryStandaloneComponents(catalog.rawComponents).length,
					totalComponents: catalog.rawComponents.length,
				},
				results: filteredResults.slice(offset, offset + limit),
				pagination: {
					offset,
					limit,
					total: filteredResults.length,
					hasMore: offset + limit < filteredResults.length,
				},
				usage: {
					instantiate: "Use a variant key or standalone component key with figma_instantiate_component.",
					note: "For COMPONENT_SET results, choose a key from the variants array rather than the parent set key.",
				},
			};
		},
	};

	const getDesignSystemSummaryTool: ToolDefinition<DesignSystemSummaryInput, any> = {
		name: "figma_get_design_system_summary",
		summary: "Get a compact design-system overview for the active file.",
		description:
			"Registry-backed discovery summary for HTTP/CLI. Returns category counts, token collection names, and top-level totals without returning the full manifest.",
		tags: ["figma", "design-system", "summary", "discovery"],
		discoveryGroup: "design-system",
		inputSchema: designSystemSummaryInputSchema,
		capabilities: {
			requiresPlugin: true,
			requiresRestToken: false,
			supportsCli: true,
			supportsHttp: true,
			supportsMcp: true,
			responseShape: "medium",
			sideEffects: "none",
		},
		examples: [
			{
				title: "Summarize the current design system",
				input: {},
			},
		],
		relatedTools: ["figma_search_components", "figma_get_token_values"],
		commonErrors: pluginRequiredErrors as any,
		handler: async ({ runtime }, input: DesignSystemSummaryInput) => {
			const currentUrl = runtime.getCurrentFileUrl();
			if (!currentUrl) {
				throw new Error("No Figma file URL available. Connect the Desktop Bridge plugin first.");
			}

			const fileKey = resolveFileKey(currentUrl);
			if (input.forceRefresh) {
				DesignSystemManifestCache.getInstance().invalidate(fileKey);
			}

			const cacheEntry = await loadLocalManifest(runtime);
			const categories = getCategories(cacheEntry.manifest);
			const tokenSummary = getTokenSummary(cacheEntry.manifest);

			return {
				success: true,
				cached: !(input.forceRefresh ?? false),
				cacheAge: Math.round((Date.now() - cacheEntry.timestamp) / 1000),
				fileKey,
				categories: categories.slice(0, 15),
				tokens: tokenSummary,
				totals: {
					components: cacheEntry.manifest.summary.totalComponents,
					componentSets: cacheEntry.manifest.summary.totalComponentSets,
					tokens: cacheEntry.manifest.summary.totalTokens,
				},
			};
		},
	};

	const getTokenValuesTool: ToolDefinition<TokenValuesInput, any> = {
		name: "figma_get_token_values",
		summary: "Get concrete token values for the active design system.",
		description:
			"Registry-backed token read tool for HTTP/CLI. Returns color and spacing token values from the cached local design-system manifest with optional filtering.",
		tags: ["figma", "tokens", "design-system", "discovery"],
		discoveryGroup: "design-system",
		inputSchema: tokenValuesInputSchema,
		capabilities: {
			requiresPlugin: true,
			requiresRestToken: false,
			supportsCli: true,
			supportsHttp: true,
			supportsMcp: true,
			responseShape: "medium",
			sideEffects: "none",
		},
		examples: [
			{
				title: "List primary color tokens",
				input: { type: "colors", filter: "primary" },
			},
		],
		relatedTools: ["figma_get_design_system_summary", "figma_get_variables"],
		commonErrors: pluginRequiredErrors as any,
		handler: async ({ runtime }, input: TokenValuesInput) => {
			const cacheEntry = await loadLocalManifest(runtime);
			const limit = input.limit ?? 50;
			const filterLower = input.filter?.toLowerCase();
			const result: Record<string, any> = {};

			if (input.type === "colors" || input.type === "all") {
				result.colors = collectTokenValues(cacheEntry.manifest.tokens.colors, limit, filterLower, (token) => ({
					value: token.value,
					scopes: token.scopes,
				}));
			}

			if (input.type === "spacing" || input.type === "all") {
				result.spacing = collectTokenValues(cacheEntry.manifest.tokens.spacing, limit, filterLower, (token) => ({
					value: token.value,
				}));
			}

			return {
				success: true,
				type: input.type,
				filter: input.filter || "(none)",
				tokens: result,
			};
		},
	};

	const getComponentImageTool: ToolDefinition<ComponentImageInput, any> = {
		name: "figma_get_component_image",
		summary: "Render a specific node or component as an image URL.",
		description:
			"Registry-backed REST image tool for HTTP/CLI. Renders a concrete Figma node to PNG, JPG, SVG, or PDF for visual reference and documentation. For immediate post-edit validation, prefer figma_capture_screenshot.",
		tags: ["figma", "image", "components", "visual-reference"],
		discoveryGroup: "document",
		inputSchema: componentImageInputSchema,
		capabilities: {
			requiresPlugin: false,
			requiresRestToken: true,
			supportsCli: true,
			supportsHttp: true,
			supportsMcp: true,
			responseShape: "small",
			sideEffects: "none",
		},
		examples: [
			{
				title: "Render a component preview image",
				input: {
					fileUrl: "https://www.figma.com/design/FILE_KEY/Design-System",
					nodeId: "123:456",
					scale: 2,
					format: "png",
				},
			},
		],
		relatedTools: ["figma_get_component_details", "figma_capture_screenshot"],
		handler: async ({ runtime }, input: ComponentImageInput) => {
			const fileUrl = input.fileUrl || runtime.getCurrentFileUrl();
			if (!fileUrl) {
				throw new Error(
					"No Figma file URL available. Pass fileUrl or connect the Desktop Bridge plugin.",
				);
			}

			const fileKey = resolveFileKey(fileUrl);
			const scale = input.scale ?? 2;
			const format = input.format ?? "png";
			const api = await runtime.getFigmaAPI();
			const fileData = await api.getNodes(fileKey, [input.nodeId]);
			const node = fileData.nodes?.[input.nodeId]?.document;

			if (!node) {
				throw new Error(`Node ${input.nodeId} not found in file ${fileKey}.`);
			}

			if (node.type === "COMPONENT_SET") {
				return {
					error: "COMPONENT_SET_NOT_RENDERABLE",
					message: "Node is a COMPONENT_SET which cannot be rendered directly. Use a specific variant node ID instead.",
					componentName: node.name,
					availableVariants: listVariantNames(node),
					instructions: [
						"Expand the component set and choose a concrete variant component.",
						"Copy that variant node ID.",
						"Call figma_get_component_image again with the variant node ID.",
					],
					note: "COMPONENT_SET is a variant container. Only concrete component variants are renderable.",
				};
			}

			const result = await api.getImages(fileKey, input.nodeId, {
				scale,
				format,
				contents_only: true,
			});
			const imageUrl = result.images?.[input.nodeId];

			if (!imageUrl) {
				throw new Error(`Failed to render image for node ${input.nodeId}.`);
			}

			return {
				fileKey,
				nodeId: input.nodeId,
				imageUrl,
				scale,
				format,
				expiresIn: "30 days",
				note: "Use this image as a visual reference. For runtime-state validation after edits, use figma_capture_screenshot.",
			};
		},
	};

	const getComponentForDevelopmentTool: ToolDefinition<ComponentForDevelopmentInput, any> = {
		name: "figma_get_component_for_development",
		summary: "Read component data optimized for UI implementation.",
		description:
			"Registry-backed component development tool for HTTP/CLI. Reads implementation-oriented component data through the Figma REST API and can include a rendered image URL for visual reference.",
		tags: ["figma", "components", "development", "design-to-code", "image"],
		discoveryGroup: "document",
		inputSchema: componentForDevelopmentInputSchema,
		capabilities: {
			requiresPlugin: false,
			requiresRestToken: true,
			supportsCli: true,
			supportsHttp: true,
			supportsMcp: true,
			responseShape: "large",
			sideEffects: "none",
		},
		examples: [
			{
				title: "Read component implementation data with image",
				input: {
					fileUrl: "https://www.figma.com/design/FILE_KEY/Design-System",
					nodeId: "123:456",
				},
			},
		],
		relatedTools: ["figma_get_component_details", "figma_get_component_image", "figma_get_file_for_plugin"],
		commonErrors: [
			{
				code: "REST_AUTH_REQUIRED",
				message: "Figma REST API authentication is required.",
				hint: "Set FIGMA_ACCESS_TOKEN for local daemon usage and retry.",
			},
		],
		handler: async ({ runtime }, input: ComponentForDevelopmentInput) => {
			const currentUrl = runtime.getCurrentFileUrl();
			const targetUrl = input.fileUrl || currentUrl;
			const includeImage = input.includeImage ?? true;

			if (!targetUrl) {
				throw new Error("No Figma file URL available. Pass fileUrl or connect the Desktop Bridge plugin.");
			}

			const fileKey = resolveFileKey(targetUrl);
			const api = await runtime.getFigmaAPI();
			const nodeData = await api.getNodes(fileKey, [input.nodeId], { depth: 2 });
			const node = nodeData.nodes?.[input.nodeId]?.document;

			if (!node) {
				throw new Error(`Component not found: ${input.nodeId}`);
			}

			let imageUrl: string | null = null;
			if (includeImage) {
				try {
					const imageResult = await api.getImages(fileKey, input.nodeId, {
						scale: 2,
						format: "png",
						contents_only: true,
					});
					imageUrl = imageResult.images?.[input.nodeId] || null;
				} catch {
					imageUrl = null;
				}
			}

			return {
				fileKey,
				fileUrl: targetUrl,
				nodeId: input.nodeId,
				imageUrl,
				component: filterComponentNodeForDevelopment(node),
				metadata: {
					purpose: "component_development",
					note: imageUrl
						? "Image URL provided for visual reference. Component data is filtered for UI implementation."
						: "Component data is filtered for UI implementation.",
				},
				timestamp: Date.now(),
			};
		},
	};

	const generateComponentDocTool: ToolDefinition<ComponentDocInput, any> = {
		name: "figma_generate_component_doc",
		summary: "Generate markdown documentation for a Figma component.",
		description:
			"Registry-backed documentation tool for HTTP/CLI. Generates structured markdown for a component using Figma data and optional code-side information.",
		tags: ["figma", "components", "documentation", "markdown", "design-to-code"],
		discoveryGroup: "document",
		inputSchema: componentDocInputSchema,
		capabilities: {
			requiresPlugin: false,
			requiresRestToken: true,
			supportsCli: true,
			supportsHttp: true,
			supportsMcp: true,
			responseShape: "large",
			sideEffects: "none",
		},
		examples: [
			{
				title: "Generate component docs",
				input: { nodeId: "123:456" },
			},
		],
		relatedTools: ["figma_get_component", "figma_get_component_for_development"],
		commonErrors: [
			{
				code: "REST_AUTH_REQUIRED",
				message: "Figma REST API authentication is required.",
				hint: "Set FIGMA_ACCESS_TOKEN for local daemon usage and retry.",
			},
		],
		handler: async ({ runtime }, input: ComponentDocInput) => {
			const currentUrl = runtime.getCurrentFileUrl();
			const targetUrl = input.fileUrl || currentUrl;
			if (!targetUrl) {
				throw new Error("No Figma file URL available. Pass fileUrl or connect the Desktop Bridge plugin.");
			}

			const fileKey = resolveFileKey(targetUrl);
			const api = await runtime.getFigmaAPI();
			const nodesResponse = await api.getNodes(fileKey, [input.nodeId], { depth: 4 });
			const node = nodesResponse?.nodes?.[input.nodeId]?.document;
			if (!node) {
				throw new Error(`Node ${input.nodeId} not found in file ${fileKey}`);
			}

			let enrichedData: any = null;
			if (input.enrich) {
				try {
					enrichedData = await enrichmentService.enrichComponent(node, fileKey, {
						enrich: true,
						include_usage: true,
					});
				} catch {
					enrichedData = null;
				}
			}

			const parsedDescription = parseComponentDescription(node.descriptionMarkdown || node.description || "");
			const visualNode = resolveVisualNode(node);
			const typography = collectTypographyData(node);
			const varNameMap = new Map<string, string>();
			for (const variable of enrichedData?.variables_used || []) {
				if (variable?.id && variable?.name) {
					varNameMap.set(variable.id, variable.name);
				}
			}

			const componentName = input.systemName
				? `${input.systemName} ${node.name}`
				: (input.codeInfo?.filePath?.split("/").pop()?.replace(/\.\w+$/, "") || node.name);
			const suggestedPath = input.outputPath || `docs/components/${sanitizeComponentName(componentName)}.md`;
			const sections = {
				overview: true,
				anatomy: true,
				statesAndVariants: true,
				visualSpecs: true,
				typography: true,
				contentGuidelines: true,
				behavior: false,
				implementation: true,
				accessibility: true,
				relatedComponents: false,
				changelog: true,
				parity: true,
				...input.sections,
			};

			const parts: string[] = [];
			const includedSections: string[] = [];
			const fileUrlWithNode = `${targetUrl}${targetUrl.includes("?") ? "&" : "?"}node-id=${input.nodeId.replace(":", "-")}`;

			if (input.includeFrontmatter ?? true) {
				parts.push("---");
				parts.push(`title: ${JSON.stringify(componentName)}`);
				parts.push(`figmaNodeId: ${JSON.stringify(input.nodeId)}`);
				parts.push(`fileKey: ${JSON.stringify(fileKey)}`);
				parts.push(`generatedAt: ${JSON.stringify(new Date().toISOString())}`);
				parts.push("---");
				parts.push("");
			}

			if (sections.overview) {
				parts.push(`## Overview\n${parsedDescription.overview || `${componentName} component.`}\n\n- Figma: ${fileUrlWithNode}`);
				includedSections.push("overview");
			}

			if (sections.anatomy) {
				const anatomy = buildAnatomyTree(node);
				if (anatomy) {
					parts.push(`## Anatomy\n\`\`\`text\n${anatomy}\n\`\`\``);
					includedSections.push("anatomy");
				}
			}

			if (sections.statesAndVariants) {
				const variantsText = buildVariantSummary(node, varNameMap);
				if (variantsText) {
					parts.push(`## States And Variants\n${variantsText}`);
					includedSections.push("statesAndVariants");
				}
			}

			if (sections.visualSpecs) {
				const visualSummary = buildVisualSpecSummary(visualNode);
				if (visualSummary) {
					parts.push(`## Visual Specs\n${visualSummary}`);
					includedSections.push("visualSpecs");
				}
			}

			if (sections.typography && typography.length) {
				parts.push(`## Typography\n${buildMarkdownList(typography.map((entry) => `${entry.nodeName}: ${entry.fontFamily} ${entry.fontWeightName} ${entry.fontSize}px / ${entry.lineHeight}px`))}`);
				includedSections.push("typography");
			}

			if (sections.contentGuidelines) {
				const contentParts: string[] = [];
				if (parsedDescription.whenToUse.length) {
					contentParts.push("### When To Use");
					contentParts.push(buildMarkdownList(parsedDescription.whenToUse));
				}
				if (parsedDescription.whenNotToUse.length) {
					contentParts.push("### When Not To Use");
					contentParts.push(buildMarkdownList(parsedDescription.whenNotToUse));
				}
				for (const group of parsedDescription.contentGuidelines) {
					contentParts.push(`### ${group.heading}`);
					contentParts.push(buildMarkdownList(group.items));
				}
				if (contentParts.length) {
					parts.push(`## Content Guidelines\n${contentParts.join("\n")}`);
					includedSections.push("contentGuidelines");
				}
			}

			if (sections.implementation && input.codeInfo) {
				parts.push(buildImplementationSection(input.codeInfo));
				includedSections.push("implementation");
			}

			if (sections.accessibility) {
				const accessibility = buildAccessibilitySection(parsedDescription, input.codeInfo);
				if (accessibility) {
					parts.push(accessibility);
					includedSections.push("accessibility");
				}
			}

			if (sections.changelog && input.codeInfo?.changelog?.length) {
				parts.push(`## Changelog\n${buildMarkdownList(input.codeInfo.changelog.map((entry: any) => `${entry.version} (${entry.date}): ${entry.changes}`))}`);
				includedSections.push("changelog");
			}

			const markdown = parts.join("\n\n");
			return {
				componentName,
				figmaNodeId: input.nodeId,
				fileKey,
				timestamp: new Date().toISOString(),
				markdown,
				includedSections,
				suggestedPath,
				chunks: chunkMarkdownByHeaders(markdown),
			};
		},
	};

	const getDesignSystemKitTool: ToolDefinition<DesignSystemKitInput, any> = {
		name: "figma_get_design_system_kit",
		summary: "Read a combined design system kit in one call.",
		description:
			"Registry-backed aggregate design-system tool for HTTP/CLI. Returns tokens, components, and styles in a single response with optional image URLs and compact formats for larger systems.",
		tags: ["figma", "design-system", "tokens", "components", "styles"],
		discoveryGroup: "design-system",
		inputSchema: designSystemKitInputSchema,
		capabilities: {
			requiresPlugin: false,
			requiresRestToken: true,
			supportsCli: true,
			supportsHttp: true,
			supportsMcp: true,
			responseShape: "large",
			sideEffects: "none",
		},
		examples: [
			{
				title: "Read the full design system kit for the current file",
				input: {},
			},
			{
				title: "Read a compact kit with component images",
				input: { includeImages: true, format: "summary" },
			},
		],
		relatedTools: ["figma_get_variables", "figma_get_styles", "figma_get_component"],
		commonErrors: [
			{
				code: "REST_AUTH_REQUIRED",
				message: "Figma REST API authentication is required.",
				hint: "Set FIGMA_ACCESS_TOKEN for local daemon usage and retry.",
			},
		],
		handler: async ({ runtime }, input: DesignSystemKitInput) => {
			const api = await runtime.getFigmaAPI();
			const include = input.include ?? ["tokens", "components", "styles"];
			let resolvedFileKey = input.fileKey;
			if (!resolvedFileKey) {
				const currentUrl = runtime.getCurrentFileUrl();
				if (currentUrl) {
					resolvedFileKey = resolveFileKey(currentUrl);
				}
			}
			if (!resolvedFileKey) {
				throw new Error("No file key available. Pass fileKey or connect the Desktop Bridge plugin.");
			}

			const errors: Array<{ section: string; message: string }> = [];
			const kit: any = {
				fileKey: resolvedFileKey,
				generatedAt: new Date().toISOString(),
				format: input.format,
				ai_instruction: "",
			};

			if (include.includes("tokens")) {
				try {
					const cache = runtime.getVariablesCache();
					const cacheKey = `kit:vars:${resolvedFileKey}`;
					let variablesData = cache.get(cacheKey)?.data as any;
					if (!variablesData) {
						variablesData = await api.getLocalVariables(resolvedFileKey);
						cache.set(cacheKey, { data: variablesData, timestamp: Date.now() });
					}
					const formatted = formatVariables(variablesData);
					kit.tokens = {
						collections: groupVariablesByCollection(formatted),
						summary: formatted.summary,
					};
				} catch (error) {
					errors.push({ section: "tokens", message: error instanceof Error ? error.message : String(error) });
				}
			}

			if (include.includes("components")) {
				try {
					const [componentsResponse, componentSetsResponse] = await Promise.all([
						api.getComponents(resolvedFileKey),
						api.getComponentSets(resolvedFileKey),
					]);
					const allComponents = componentsResponse?.meta?.components || [];
					const allComponentSets = componentSetsResponse?.meta?.component_sets || [];
					const { components: standaloneComponents, componentSets } = deduplicateComponents(allComponents, allComponentSets);
					let targetComponents = standaloneComponents;
					let targetSets = componentSets;
					if (input.componentIds?.length) {
						const ids = new Set(input.componentIds);
						targetComponents = standaloneComponents.filter((component: any) => ids.has(component.node_id));
						targetSets = componentSets.filter((set: any) => ids.has(set.node_id));
					}

					const allNodeIds = [...targetSets.map((set: any) => set.node_id), ...targetComponents.map((component: any) => component.node_id)];
					const nodeDetailsMap: Record<string, any> = {};
					for (let i = 0; i < allNodeIds.length; i += 50) {
						const batch = allNodeIds.slice(i, i + 50);
						const nodesResponse = await api.getNodes(resolvedFileKey, batch, { depth: 2 });
						for (const [nodeId, nodeData] of Object.entries(nodesResponse?.nodes || {})) {
							nodeDetailsMap[nodeId] = (nodeData as any)?.document;
						}
					}

					const componentSpecs: any[] = [];
					for (const set of targetSets) {
						const setNode = nodeDetailsMap[set.node_id];
						const spec: any = {
							id: set.node_id,
							name: set.name,
							description: set.description || undefined,
						};
						const variants = allComponents
							.filter((component: any) =>
								component.component_set_id === set.node_id ||
								component.containing_frame?.nodeId === set.node_id ||
								component.containing_frame?.containingComponentSet?.nodeId === set.node_id,
							)
							.map((component: any) => {
								const variantNode = setNode?.children?.find((child: any) => child.id === component.node_id);
								return {
									name: component.name,
									id: component.node_id,
									...(variantNode && extractVisualSpec(variantNode) && { visualSpec: extractVisualSpec(variantNode) }),
								};
							});
						if (variants.length) spec.variants = variants;
						if (setNode?.componentPropertyDefinitions) spec.properties = setNode.componentPropertyDefinitions;
						if (setNode?.absoluteBoundingBox) {
							spec.bounds = {
								width: setNode.absoluteBoundingBox.width,
								height: setNode.absoluteBoundingBox.height,
							};
						}
						Object.assign(spec, extractComponentVisualData(setNode));
						componentSpecs.push(spec);
					}

					for (const component of targetComponents) {
						const node = nodeDetailsMap[component.node_id];
						const spec: any = {
							id: component.node_id,
							name: component.name,
							description: component.description || undefined,
						};
						if (node?.componentPropertyDefinitions) spec.properties = node.componentPropertyDefinitions;
						if (node?.absoluteBoundingBox) {
							spec.bounds = {
								width: node.absoluteBoundingBox.width,
								height: node.absoluteBoundingBox.height,
							};
						}
						Object.assign(spec, extractComponentVisualData(node));
						componentSpecs.push(spec);
					}

					if (input.includeImages && componentSpecs.length) {
						for (let i = 0; i < componentSpecs.length; i += 50) {
							const batch = componentSpecs.slice(i, i + 50);
							const imageResult = await api.getImages(resolvedFileKey, batch.map((component) => component.id), { scale: 2, format: "png" });
							for (const component of batch) {
								component.imageUrl = imageResult.images?.[component.id];
							}
						}
					}

					kit.components = {
						items: componentSpecs,
						summary: {
							totalComponents: componentSpecs.length,
							totalComponentSets: targetSets.length,
						},
					};
				} catch (error) {
					errors.push({ section: "components", message: error instanceof Error ? error.message : String(error) });
				}
			}

			if (include.includes("styles")) {
				try {
					const stylesResponse = await api.getStyles(resolvedFileKey);
					const styleSpecs = (stylesResponse?.meta?.styles || []).map((style: any) => ({
						key: style.key,
						name: style.name,
						styleType: style.style_type,
						description: style.description || undefined,
						nodeId: style.node_id,
					}));
					const resolvedValues = await resolveStyleValues(api, resolvedFileKey, styleSpecs);
					for (const style of styleSpecs) {
						if (style.nodeId && resolvedValues.has(style.nodeId)) {
							style.resolvedValue = resolvedValues.get(style.nodeId);
						}
					}
					const stylesByType = styleSpecs.reduce((acc: Record<string, number>, style: any) => {
						acc[style.styleType] = (acc[style.styleType] || 0) + 1;
						return acc;
					}, {});
					kit.styles = {
						items: styleSpecs,
						summary: {
							totalStyles: styleSpecs.length,
							stylesByType,
						},
					};
				} catch (error) {
					errors.push({ section: "styles", message: error instanceof Error ? error.message : String(error) });
				}
			}

			if (errors.length) {
				kit.errors = errors;
			}

			const sections: string[] = [];
			if (kit.tokens) sections.push(`${kit.tokens.summary.totalVariables} tokens in ${kit.tokens.summary.totalCollections} collections`);
			if (kit.components) sections.push(`${kit.components.summary.totalComponents} components (${kit.components.summary.totalComponentSets} sets)`);
			if (kit.styles) sections.push(`${kit.styles.summary.totalStyles} styles`);
			kit.ai_instruction =
				"DESIGN SYSTEM SPECIFICATION — STRICT VISUAL FIDELITY REQUIRED\n\n" +
				`Contains: ${sections.join(", ")}.\n\n` +
				"Use only values in this response when generating code or documentation.";

			if (input.format === "summary") {
				return compressKit(kit, "summary");
			}
			if (input.format === "compact") {
				return compressKit(kit, "compact");
			}
			return kit;
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

	const getStatusTool: ToolDefinition<GetStatusInput, any> = {
		name: "figma_get_status",
		summary: "Get daemon/runtime connection status for the active Figma session.",
		description:
			"Registry-backed runtime status tool for HTTP/CLI. Reports daemon connectivity, active file URL, plugin connectivity, REST auth availability, and current selection count.",
		tags: ["figma", "status", "runtime", "connection"],
		discoveryGroup: "runtime",
		inputSchema: getStatusInputSchema,
		capabilities: {
			requiresPlugin: false,
			requiresRestToken: false,
			supportsCli: true,
			supportsHttp: true,
			supportsMcp: true,
			responseShape: "small",
			sideEffects: "none",
		},
		examples: [
			{
				title: "Get current daemon/runtime status",
				input: {},
			},
		],
		relatedTools: ["figma_get_selection", "figma_list_open_files"],
		handler: async ({ runtime }) => {
			const status = await runtime.getStatus();
			return {
				...status,
				timestamp: Date.now(),
			};
		},
	};

	const getProjectPolicyTool: ToolDefinition<any, any> = {
		name: "figma_get_project_policy",
		summary: "Read the loaded project mockup policy for the current workspace.",
		description:
			"Registry-backed runtime policy tool for HTTP/CLI. Returns the daemon-loaded project mockup policy, its source path, workspace root, checked search paths, and validation preferences for future mockup generation.",
		tags: ["figma", "runtime", "policy", "mockups"],
		discoveryGroup: "runtime",
		inputSchema: getProjectPolicyInputSchema,
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
				title: "Read the current project mockup policy",
				input: {},
			},
		],
		relatedTools: ["figma_get_status", "figma_get_design_system_summary"],
		handler: async ({ runtime }) => {
			const state = runtime.getProjectPolicyState?.();
			const loaded = runtime.getProjectPolicy?.() || null;
			if (!state) {
				throw new Error("Runtime does not support project policy loading.");
			}

			return {
				status: state.status,
				cwd: state.cwd,
				checkedPaths: state.checkedPaths,
				sourcePath: loaded?.sourcePath,
				workspaceRoot: loaded?.workspaceRoot,
				projectName: loaded?.policy.projectName,
				policy: loaded?.policy || null,
				error: state.error,
				timestamp: Date.now(),
			};
		},
	};

	const getSelectionTool: ToolDefinition<GetSelectionInput, any> = {
		name: "figma_get_selection",
		summary: "Get the current selection in the active connected Figma file.",
		description:
			"Registry-backed runtime awareness tool for HTTP/CLI. Returns the active file selection from the Desktop Bridge WebSocket state without requiring a plugin roundtrip.",
		tags: ["figma", "selection", "runtime", "awareness"],
		discoveryGroup: "runtime",
		inputSchema: getSelectionInputSchema,
		capabilities: {
			requiresPlugin: true,
			requiresRestToken: false,
			supportsCli: true,
			supportsHttp: true,
			supportsMcp: true,
			responseShape: "small",
			sideEffects: "none",
		},
		examples: [
			{
				title: "Read the active selection",
				input: {},
			},
		],
		relatedTools: ["figma_get_status", "figma_list_open_files"],
		commonErrors: pluginRequiredErrors as any,
		handler: async ({ runtime }) => {
			const selection = runtime.getCurrentSelection?.() || null;
			if (!selection) {
				return {
					selection: [],
					count: 0,
					page: "unknown",
					message: "Nothing is selected in the active Figma file.",
					timestamp: Date.now(),
				};
			}

			return {
				selection: selection.nodes,
				count: selection.count,
				page: selection.page,
				timestamp: selection.timestamp,
			};
		},
	};

	const listOpenFilesTool: ToolDefinition<ListOpenFilesInput, any> = {
		name: "figma_list_open_files",
		summary: "List Figma files currently connected to the daemon runtime.",
		description:
			"Registry-backed runtime awareness tool for HTTP/CLI. Returns all files currently connected via the Desktop Bridge WebSocket and indicates the active target file.",
		tags: ["figma", "runtime", "files", "connection"],
		discoveryGroup: "runtime",
		inputSchema: listOpenFilesInputSchema,
		capabilities: {
			requiresPlugin: true,
			requiresRestToken: false,
			supportsCli: true,
			supportsHttp: true,
			supportsMcp: true,
			responseShape: "small",
			sideEffects: "none",
		},
		examples: [
			{
				title: "List all connected Figma files",
				input: {},
			},
		],
		relatedTools: ["figma_get_status", "figma_get_selection"],
		commonErrors: pluginRequiredErrors as any,
		handler: async ({ runtime }) => {
			const files = (runtime.getConnectedFiles?.() || []).map((file) => ({
				fileName: file.fileName,
				fileKey: file.fileKey,
				currentPage: file.currentPage,
				currentPageId: file.currentPageId,
				isActive: file.isActive,
				connectedAt: file.connectedAt,
				url: file.fileKey
					? `https://www.figma.com/design/${file.fileKey}/${encodeURIComponent(file.fileName || "Untitled")}`
					: undefined,
			}));

			return {
				files,
				totalFiles: files.length,
				activeFileKey: files.find((file) => file.isActive)?.fileKey || null,
				timestamp: Date.now(),
			};
		},
	};

	const getCommentsTool: ToolDefinition<GetCommentsInput, any> = {
		name: "figma_get_comments",
		summary: "Read comment threads from a Figma file.",
		description:
			"Registry-backed comments read tool for HTTP/CLI. Reads file comments through the Figma REST API and can optionally include resolved threads or markdown comment bodies.",
		tags: ["figma", "comments", "review", "collaboration"],
		discoveryGroup: "comments",
		inputSchema: getCommentsInputSchema,
		capabilities: {
			requiresPlugin: false,
			requiresRestToken: true,
			supportsCli: true,
			supportsHttp: true,
			supportsMcp: true,
			responseShape: "large",
			sideEffects: "none",
		},
		examples: [
			{
				title: "Read active comments from the current file",
				input: {},
			},
			{
				title: "Read all comments including resolved threads",
				input: {
					fileUrl: "https://www.figma.com/design/FILE_KEY/Design-System",
					include_resolved: true,
				},
			},
		],
		relatedTools: ["figma_post_comment", "figma_delete_comment"],
		commonErrors: [
			{
				code: "REST_AUTH_REQUIRED",
				message: "Figma REST API authentication is required.",
				hint: "Set FIGMA_ACCESS_TOKEN for local daemon usage and retry.",
			},
		],
		handler: async ({ runtime }, input: GetCommentsInput) => {
			const currentUrl = runtime.getCurrentFileUrl();
			const targetUrl = input.fileUrl || currentUrl;
			const asMarkdown = input.as_md ?? false;
			const includeResolved = input.include_resolved ?? false;

			if (!targetUrl) {
				throw new Error("No Figma file URL available. Pass fileUrl or connect the Desktop Bridge plugin.");
			}

			const fileKey = resolveFileKey(targetUrl);
			const api = await runtime.getFigmaAPI();
			const response = await api.getComments(fileKey, { as_md: asMarkdown });
			const allComments = response.comments || [];
			const comments = includeResolved
				? allComments
				: allComments.filter((comment: any) => !comment.resolved_at);

			return {
				fileKey,
				fileUrl: targetUrl,
				comments,
				summary: {
					total: allComments.length,
					active: allComments.filter((comment: any) => !comment.resolved_at).length,
					resolved: allComments.filter((comment: any) => comment.resolved_at).length,
					returned: comments.length,
				},
				timestamp: Date.now(),
			};
		},
	};

	const getStylesTool: ToolDefinition<GetStylesInput, any> = {
		name: "figma_get_styles",
		summary: "Read styles from a Figma file.",
		description:
			"Registry-backed styles read tool for HTTP/CLI. Reads styles through the Figma REST API with optional enrichment for resolved values, usage, and export examples.",
		tags: ["figma", "styles", "design-system", "typography", "colors"],
		discoveryGroup: "design-system",
		inputSchema: getStylesInputSchema,
		capabilities: {
			requiresPlugin: false,
			requiresRestToken: true,
			supportsCli: true,
			supportsHttp: true,
			supportsMcp: true,
			responseShape: "large",
			sideEffects: "none",
		},
		examples: [
			{
				title: "Read styles from the current file",
				input: {},
			},
			{
				title: "Read styles with code export enrichment",
				input: {
					fileUrl: "https://www.figma.com/design/FILE_KEY/Design-System",
					enrich: true,
					export_formats: ["css", "tailwind"],
				},
			},
		],
		relatedTools: ["figma_get_variables", "figma_get_design_system_summary"],
		commonErrors: [
			{
				code: "REST_AUTH_REQUIRED",
				message: "Figma REST API authentication is required.",
				hint: "Set FIGMA_ACCESS_TOKEN for local daemon usage and retry.",
			},
		],
		handler: async ({ runtime }, input: GetStylesInput) => {
			const currentUrl = runtime.getCurrentFileUrl();
			const targetUrl = input.fileUrl || currentUrl;
			const verbosity = input.verbosity ?? "standard";

			if (!targetUrl) {
				throw new Error("No Figma file URL available. Pass fileUrl or connect the Desktop Bridge plugin.");
			}

			const fileKey = resolveFileKey(targetUrl);
			const api = await runtime.getFigmaAPI();
			const stylesData = await api.getStyles(fileKey);
			let styles = (stylesData.meta?.styles || []).map((style: any) => filterStyleNode(style, verbosity));

			if (input.enrich) {
				const enrichmentOptions: EnrichmentOptions = {
					enrich: true,
					include_usage: input.include_usage !== false,
					include_exports: input.include_exports !== false,
					export_formats: input.export_formats || ["css", "sass", "tailwind", "typescript", "json"],
				};
				styles = await enrichmentService.enrichStyles(styles, fileKey, enrichmentOptions);
			}

			return {
				fileKey,
				fileUrl: targetUrl,
				styles,
				totalStyles: styles.length,
				verbosity,
				enriched: input.enrich ?? false,
				timestamp: Date.now(),
			};
		},
	};

	const getFileDataTool: ToolDefinition<GetFileDataInput, any> = {
		name: "figma_get_file_data",
		summary: "Get file structure and document tree data from the active or specified file.",
		description:
			"Registry-backed REST read tool for HTTP/CLI. Returns the Figma file document tree with depth and verbosity controls for structural exploration and node discovery.",
		tags: ["figma", "file", "structure", "rest"],
		discoveryGroup: "document",
		inputSchema: getFileDataInputSchema,
		capabilities: {
			requiresPlugin: false,
			requiresRestToken: true,
			supportsCli: true,
			supportsHttp: true,
			supportsMcp: true,
			responseShape: "large",
			sideEffects: "none",
		},
		examples: [
			{
				title: "Read top-level file structure",
				input: { depth: 1, verbosity: "summary" },
			},
			{
				title: "Read specific nodes with standard verbosity",
				input: { fileUrl: "https://www.figma.com/design/FILE_KEY/Design-System", nodeIds: ["123:456"], verbosity: "standard" },
			},
		],
		relatedTools: ["figma_get_selection", "figma_search_components"],
		handler: async ({ runtime }, input: GetFileDataInput) => {
			const targetUrl = input.fileUrl || runtime.getCurrentFileUrl();
			if (!targetUrl) {
				throw new Error("No Figma file URL available. Pass fileUrl or connect the Desktop Bridge plugin.");
			}

			const fileKey = resolveFileKey(targetUrl);
			const api = await runtime.getFigmaAPI();
			const fileData = await api.getFile(fileKey, {
				depth: input.depth,
				ids: input.nodeIds,
			});

			const document = input.verbosity === "full"
				? fileData.document
				: filterFileNode(fileData.document, input.verbosity || "summary");

			return {
				fileKey,
				name: fileData.name,
				lastModified: fileData.lastModified,
				version: fileData.version,
				document,
				components: fileData.components ? Object.keys(fileData.components).length : 0,
				styles: fileData.styles ? Object.keys(fileData.styles).length : 0,
				verbosity: input.verbosity || "summary",
				enriched: false,
				...(input.nodeIds && {
					requestedNodes: input.nodeIds,
					nodes: fileData.nodes,
				}),
			};
		},
	};

	const getFileForPluginTool: ToolDefinition<GetFileForPluginInput, any> = {
		name: "figma_get_file_for_plugin",
		summary: "Read file data optimized for plugin development.",
		description:
			"Registry-backed file read tool for HTTP/CLI. Reads file data through the Figma REST API and filters it to plugin-relevant IDs, structure, plugin data, and component relationships.",
		tags: ["figma", "file", "plugin", "development", "structure"],
		discoveryGroup: "file",
		inputSchema: getFileForPluginInputSchema,
		capabilities: {
			requiresPlugin: false,
			requiresRestToken: true,
			supportsCli: true,
			supportsHttp: true,
			supportsMcp: true,
			responseShape: "large",
			sideEffects: "none",
		},
		examples: [
			{
				title: "Read plugin-oriented file structure from the current file",
				input: {
					depth: 2,
				},
			},
			{
				title: "Read specific nodes for plugin development",
				input: {
					fileUrl: "https://www.figma.com/design/FILE_KEY/Design-System",
					nodeIds: ["123:456", "123:789"],
				},
			},
		],
		relatedTools: ["figma_get_file_data", "figma_get_component_details"],
		commonErrors: [
			{
				code: "REST_AUTH_REQUIRED",
				message: "Figma REST API authentication is required.",
				hint: "Set FIGMA_ACCESS_TOKEN for local daemon usage and retry.",
			},
		],
		handler: async ({ runtime }, input: GetFileForPluginInput) => {
			const currentUrl = runtime.getCurrentFileUrl();
			const targetUrl = input.fileUrl || currentUrl;

			if (!targetUrl) {
				throw new Error("No Figma file URL available. Pass fileUrl or connect the Desktop Bridge plugin.");
			}

			const fileKey = resolveFileKey(targetUrl);
			const api = await runtime.getFigmaAPI();
			const fileData = await api.getFile(fileKey, {
				depth: input.depth,
				ids: input.nodeIds,
			});

			return {
				fileKey,
				fileUrl: targetUrl,
				name: fileData.name,
				lastModified: fileData.lastModified,
				version: fileData.version,
				document: filterFileNodeForPlugin(fileData.document),
				components: fileData.components ? Object.keys(fileData.components).length : 0,
				styles: fileData.styles ? Object.keys(fileData.styles).length : 0,
				...(input.nodeIds && {
					requestedNodes: input.nodeIds,
					nodes: fileData.nodes,
				}),
				metadata: {
					purpose: "plugin_development",
					note: "Optimized for plugin development. Contains IDs, structure, plugin data, and component relationships.",
				},
				timestamp: Date.now(),
			};
		},
	};

	const getDesignChangesTool: ToolDefinition<GetDesignChangesInput, any> = {
		name: "figma_get_design_changes",
		summary: "Read recent buffered design change events from the active file.",
		description:
			"Registry-backed runtime awareness tool for HTTP/CLI. Returns recent document change events captured by the Desktop Bridge WebSocket for the active file.",
		tags: ["figma", "runtime", "changes", "awareness"],
		discoveryGroup: "runtime",
		inputSchema: getDesignChangesInputSchema,
		capabilities: {
			requiresPlugin: true,
			requiresRestToken: false,
			supportsCli: true,
			supportsHttp: true,
			supportsMcp: true,
			responseShape: "small",
			sideEffects: "none",
		},
		examples: [{ title: "Read the last 10 change events", input: { count: 10 } }],
		relatedTools: ["figma_get_status", "figma_get_selection"],
		commonErrors: pluginRequiredErrors as any,
		handler: async ({ runtime }, input: GetDesignChangesInput) => {
			const changes = runtime.getDocumentChanges?.({ since: input.since, count: input.count }) || [];
			const uniqueNodes = new Set<string>();
			for (const change of changes) {
				for (const nodeId of change.changedNodeIds) {
					uniqueNodes.add(nodeId);
				}
			}

			const clearedCount = input.clear ? runtime.clearDocumentChanges?.() || 0 : 0;

			return {
				changes,
				summary: {
					eventCount: changes.length,
					nodeChangeEvents: changes.filter((change) => change.hasNodeChanges).length,
					styleChangeEvents: changes.filter((change) => change.hasStyleChanges).length,
					uniqueNodesChanged: uniqueNodes.size,
					oldestTimestamp: changes[0]?.timestamp,
					newestTimestamp: changes[changes.length - 1]?.timestamp,
				},
				bufferCleared: input.clear,
				clearedCount,
				timestamp: Date.now(),
			};
		},
	};

	const getConsoleLogsTool: ToolDefinition<GetConsoleLogsInput, any> = {
		name: "figma_get_console_logs",
		summary: "Read buffered console logs from the active file.",
		description:
			"Registry-backed runtime awareness tool for HTTP/CLI. Returns console logs captured through the Desktop Bridge WebSocket and current buffer status.",
		tags: ["figma", "runtime", "console", "logs"],
		discoveryGroup: "runtime",
		inputSchema: getConsoleLogsInputSchema,
		capabilities: {
			requiresPlugin: true,
			requiresRestToken: false,
			supportsCli: true,
			supportsHttp: true,
			supportsMcp: true,
			responseShape: "medium",
			sideEffects: "none",
		},
		examples: [{ title: "Read recent error logs", input: { count: 50, level: "error" } }],
		relatedTools: ["figma_watch_console", "figma_clear_console"],
		commonErrors: pluginRequiredErrors as any,
		handler: async ({ runtime }, input: GetConsoleLogsInput) => {
			const logs = runtime.getConsoleLogs?.({
				count: input.count,
				level: input.level,
				since: input.since,
			}) || [];
			const status = runtime.getConsoleStatus?.() || {
				isMonitoring: false,
				anyClientConnected: false,
				logCount: logs.length,
				bufferSize: logs.length,
				workerCount: 0,
			};

			return {
				logs,
				totalCount: logs.length,
				oldestTimestamp: logs[0]?.timestamp,
				newestTimestamp: logs[logs.length - 1]?.timestamp,
				status,
				transport: "websocket",
				timestamp: Date.now(),
			};
		},
	};

	const clearConsoleTool: ToolDefinition<ClearConsoleInput, any> = {
		name: "figma_clear_console",
		summary: "Clear the buffered console logs for the active file.",
		description:
			"Registry-backed runtime awareness tool for HTTP/CLI. Clears the active file's WebSocket console log buffer without disconnecting the plugin.",
		tags: ["figma", "runtime", "console", "logs"],
		discoveryGroup: "runtime",
		inputSchema: clearConsoleInputSchema,
		capabilities: {
			requiresPlugin: true,
			requiresRestToken: false,
			supportsCli: true,
			supportsHttp: true,
			supportsMcp: true,
			responseShape: "small",
			sideEffects: "none",
		},
		examples: [{ title: "Clear the console buffer", input: {} }],
		relatedTools: ["figma_get_console_logs", "figma_watch_console"],
		commonErrors: pluginRequiredErrors as any,
		handler: async ({ runtime }) => {
			const clearedCount = runtime.clearConsoleLogs?.() || 0;
			return {
				status: "cleared",
				clearedCount,
				transport: "websocket",
				timestamp: Date.now(),
			};
		},
	};

	const watchConsoleTool: ToolDefinition<WatchConsoleInput, any> = {
		name: "figma_watch_console",
		summary: "Watch for new console logs during a time window.",
		description:
			"Registry-backed runtime awareness tool for HTTP/CLI. Waits for a specified duration and then returns console logs captured since the watch started.",
		tags: ["figma", "runtime", "console", "logs"],
		discoveryGroup: "runtime",
		inputSchema: watchConsoleInputSchema,
		capabilities: {
			requiresPlugin: true,
			requiresRestToken: false,
			supportsCli: true,
			supportsHttp: true,
			supportsMcp: true,
			responseShape: "medium",
			sideEffects: "none",
		},
		examples: [{ title: "Watch logs for 10 seconds", input: { duration: 10, level: "all" } }],
		relatedTools: ["figma_get_console_logs", "figma_clear_console"],
		commonErrors: pluginRequiredErrors as any,
		handler: async ({ runtime }, input: WatchConsoleInput) => {
			const startTime = Date.now();
			const startStatus = runtime.getConsoleStatus?.();
			await new Promise((resolve) => setTimeout(resolve, input.duration * 1000));
			const logs = runtime.getConsoleLogs?.({
				since: startTime,
				level: input.level,
			}) || [];
			const endStatus = runtime.getConsoleStatus?.();

			return {
				status: "completed",
				duration: `${input.duration} seconds`,
				startTime: new Date(startTime).toISOString(),
				endTime: new Date().toISOString(),
				filter: input.level,
				transport: "websocket",
				statistics: {
					totalLogsInBuffer: endStatus?.logCount ?? logs.length,
					logsAddedDuringWatch: Math.max((endStatus?.logCount ?? logs.length) - (startStatus?.logCount ?? 0), 0),
					logsMatchingFilter: logs.length,
				},
				logs,
			};
		},
	};

	const reconnectTool: ToolDefinition<ReconnectInput, any> = {
		name: "figma_reconnect",
		summary: "Reinitialize the daemon's active Desktop Bridge connection.",
		description:
			"Registry-backed runtime maintenance tool for HTTP/CLI. Clears the cached connector, reinitializes the WebSocket-backed Desktop Bridge connection, and returns updated runtime status.",
		tags: ["figma", "runtime", "connection", "maintenance"],
		discoveryGroup: "runtime",
		inputSchema: reconnectInputSchema,
		capabilities: {
			requiresPlugin: true,
			requiresRestToken: false,
			supportsCli: true,
			supportsHttp: true,
			supportsMcp: true,
			responseShape: "small",
			sideEffects: "none",
		},
		examples: [{ title: "Reconnect to the active Desktop Bridge session", input: {} }],
		relatedTools: ["figma_get_status", "figma_reload_plugin"],
		commonErrors: pluginRequiredErrors as any,
		handler: async ({ runtime }) => {
			if (!runtime.reconnect) {
				throw new Error("Runtime does not support reconnect.");
			}

			const status = await runtime.reconnect();
			return {
				status: "reconnected",
				...status,
				timestamp: Date.now(),
			};
		},
	};

	const reloadPluginTool: ToolDefinition<ReloadPluginInput, any> = {
		name: "figma_reload_plugin",
		summary: "Reload the Desktop Bridge plugin UI for the active file.",
		description:
			"Registry-backed runtime maintenance tool for HTTP/CLI. Reloads the plugin UI iframe via WebSocket, optionally clearing the active console buffer first. This does not perform browser/CDP page navigation.",
		tags: ["figma", "runtime", "plugin", "maintenance"],
		discoveryGroup: "runtime",
		inputSchema: reloadPluginInputSchema,
		capabilities: {
			requiresPlugin: true,
			requiresRestToken: false,
			supportsCli: true,
			supportsHttp: true,
			supportsMcp: true,
			responseShape: "small",
			sideEffects: "none",
		},
		examples: [{ title: "Reload the plugin UI and clear logs first", input: { clearConsole: true } }],
		relatedTools: ["figma_reconnect", "figma_clear_console"],
		commonErrors: pluginRequiredErrors as any,
		handler: async ({ runtime }, input: ReloadPluginInput) => {
			if (!runtime.reloadPluginUi) {
				throw new Error("Runtime does not support plugin reload.");
			}

			return runtime.reloadPluginUi({ clearConsole: input.clearConsole });
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
		commonErrors: pluginRequiredErrors as any,
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
			"Registry-backed analysis tool for HTTP/CLI. Runs design linting through the Desktop Bridge plugin and returns categorized findings for WCAG, design-system, and layout issues. Supports the mockup-quality preset for screen, form, table, and dashboard review loops.",
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
			{
				title: "Run the mockup-quality preset on a node",
				input: {
					nodeId: "123:456",
					preset: "mockup-quality",
					maxDepth: 10,
					maxFindings: 50,
				},
			},
		],
		relatedTools: ["figma_capture_screenshot", "figma_check_design_parity"],
		commonErrors: pluginRequiredErrors as any,
		handler: async ({ runtime }, input: LintDesignInput) => {
			const lintRequest = resolveLintRuleRequest({
				rules: input.rules,
				preset: input.preset,
				policy: runtime.getProjectPolicy?.() || null,
			});
			const connector = await runtime.getDesktopConnector();
			const result = await connector.lintDesign(
				input.nodeId,
				lintRequest.resolvedRules,
				input.maxDepth || 10,
				input.maxFindings || 100,
			);

			if (!result.success) {
				throw new Error(result.error || "Lint failed");
			}

			return {
				...(result.data || result),
				lintRequest: {
					preset: input.preset || null,
					appliedPresets: lintRequest.appliedPresets,
					resolvedRules: lintRequest.resolvedRules,
					requestSource: lintRequest.requestSource,
					maxDepth: input.maxDepth || 10,
					maxFindings: input.maxFindings || 100,
				},
				timestamp: Date.now(),
			};
		},
	};

	return normalizeToolDefinitions([
		getVariablesTool,
		searchComponentsTool,
		getComponentTool,
		getComponentDetailsTool,
		getLibraryComponentsTool,
		getDesignSystemKitTool,
		getDesignSystemSummaryTool,
		getTokenValuesTool,
		getStylesTool,
		getComponentImageTool,
		getComponentForDevelopmentTool,
		generateComponentDocTool,
		parityTool,
		getStatusTool,
		getProjectPolicyTool,
		getSelectionTool,
		listOpenFilesTool,
		getCommentsTool,
		getFileDataTool,
		getFileForPluginTool,
		getDesignChangesTool,
		getConsoleLogsTool,
		clearConsoleTool,
		watchConsoleTool,
		reconnectTool,
		reloadPluginTool,
		captureScreenshotTool,
		lintDesignTool,
	]);
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

function resolveOptionalLibraryKey(libraryFileKey?: string, libraryFileUrl?: string): string | undefined {
	if (libraryFileKey) {
		return libraryFileKey;
	}
	if (libraryFileUrl) {
		return resolveFileKey(libraryFileUrl);
	}
	return undefined;
}

async function fetchLibraryComponentCatalog(api: { getComponents(fileKey: string): Promise<any>; getComponentSets(fileKey: string): Promise<any> }, fileKey: string) {
	const [componentsResponse, componentSetsResponse] = await Promise.all([
		api.getComponents(fileKey),
		api.getComponentSets(fileKey),
	]);

	return {
		rawComponents: componentsResponse?.meta?.components || [],
		rawComponentSets: componentSetsResponse?.meta?.component_sets || [],
	};
}

function isLibraryVariantOf(component: any, componentSetNodeId: string): boolean {
	const containingComponentSet = component.containing_frame?.containingComponentSet;
	if (containingComponentSet && typeof containingComponentSet === "object" && containingComponentSet.nodeId === componentSetNodeId) {
		return true;
	}
	if (containingComponentSet && component.containing_frame?.nodeId === componentSetNodeId) {
		return true;
	}
	return component.component_set_id === componentSetNodeId;
}

function isLibraryVariant(component: any): boolean {
	return !!(component.containing_frame?.containingComponentSet || component.component_set_id);
}

function getLibraryParentSetName(component: any): string | undefined {
	const containingComponentSet = component.containing_frame?.containingComponentSet;
	if (containingComponentSet && typeof containingComponentSet === "object" && containingComponentSet.name) {
		return containingComponentSet.name;
	}
	return component.containing_frame?.name || component.component_set_name || undefined;
}

function buildLibraryComponentSets(rawComponentSets: any[], rawComponents: any[]) {
	return rawComponentSets.map((componentSet) => {
		const variants = rawComponents.filter((component) => isLibraryVariantOf(component, componentSet.node_id));

		return {
			name: componentSet.name,
			key: componentSet.key,
			nodeId: componentSet.node_id,
			description: componentSet.description || undefined,
			type: "COMPONENT_SET" as const,
			variantCount: variants.length,
			variants: variants.map((variant) => ({
				name: variant.name,
				key: variant.key,
				nodeId: variant.node_id,
			})),
		};
	});
}

function buildLibraryStandaloneComponents(rawComponents: any[]) {
	return rawComponents
		.filter((component) => !isLibraryVariant(component))
		.map((component) => ({
			name: component.name,
			key: component.key,
			nodeId: component.node_id,
			description: component.description || undefined,
			type: "COMPONENT" as const,
		}));
}

function buildLibraryVariantComponents(rawComponents: any[]) {
	return rawComponents
		.filter((component) => isLibraryVariant(component))
		.map((component) => ({
			name: component.name,
			key: component.key,
			nodeId: component.node_id,
			description: component.description || undefined,
			type: "VARIANT" as const,
			parentSetName: getLibraryParentSetName(component),
		}));
}

function findLocalComponentMatch(cacheEntry: Awaited<ReturnType<typeof loadLocalManifest>>, input: ComponentDetailsInput) {
	for (const componentSet of cacheEntry.rawComponents?.componentSets || []) {
		if (
			(input.componentKey && componentSet.key === input.componentKey) ||
			(input.componentName && componentSet.name === input.componentName)
		) {
			return {
				kind: "componentSet",
				component: {
					...componentSet,
					type: "COMPONENT_SET",
				},
			};
		}
	}

	for (const component of cacheEntry.rawComponents?.components || []) {
		if (
			(input.componentKey && component.key === input.componentKey) ||
			(input.componentName && component.name === input.componentName)
		) {
			return {
				kind: "component",
				component: {
					...component,
					type: "COMPONENT",
				},
			};
		}
	}

	for (const [name, componentSet] of Object.entries(cacheEntry.manifest.componentSets)) {
		if (
			(input.componentKey && componentSet.key === input.componentKey) ||
			(input.componentName && name === input.componentName)
		) {
			return { kind: "componentSet", component: { ...componentSet, type: "COMPONENT_SET" } };
		}
	}

	for (const [name, component] of Object.entries(cacheEntry.manifest.components)) {
		if (
			(input.componentKey && component.key === input.componentKey) ||
			(input.componentName && name === input.componentName)
		) {
			return { kind: "component", component: { ...component, type: "COMPONENT" } };
		}
	}

	return null;
}

function findLibraryComponentMatch(
	catalog: Awaited<ReturnType<typeof fetchLibraryComponentCatalog>>,
	input: ComponentDetailsInput,
) {
	for (const componentSet of buildLibraryComponentSets(catalog.rawComponentSets, catalog.rawComponents)) {
		if (
			(input.componentKey && componentSet.key === input.componentKey) ||
			(input.componentName && componentSet.name === input.componentName)
		) {
			return { kind: "componentSet", component: componentSet };
		}
	}

	for (const component of catalog.rawComponents) {
		if (
			(input.componentKey && component.key === input.componentKey) ||
			(input.componentName && component.name === input.componentName)
		) {
			return {
				kind: isLibraryVariant(component) ? "componentVariant" : "component",
				component: {
					name: component.name,
					key: component.key,
					nodeId: component.node_id,
					description: component.description || undefined,
					type: isLibraryVariant(component) ? "VARIANT" : "COMPONENT",
					parentSetName: getLibraryParentSetName(component),
				},
			};
		}
	}

	return null;
}

function buildInstantiationGuidance(component: any, kind: string) {
	if (kind === "componentSet") {
		const exampleKey = component.variants?.[0]?.key;
		return {
			key: component.key,
			example: exampleKey
				? `Use figma_instantiate_component with componentKey: "${exampleKey}" from the variants array.`
				: "Use a specific variant key from this component set with figma_instantiate_component.",
		};
	}

	return {
		key: component.key,
		example: `Use figma_instantiate_component with componentKey: "${component.key}"`,
	};
}

function collectTokenValues<T extends { value: unknown }>(
	tokens: Record<string, T>,
	limit: number,
	filterLower: string | undefined,
	mapper: (token: T) => any,
) {
	const collected: Record<string, any> = {};
	let count = 0;

	for (const [name, token] of Object.entries(tokens)) {
		if (count >= limit) {
			break;
		}
		if (!filterLower || name.toLowerCase().includes(filterLower)) {
			collected[name] = mapper(token);
			count++;
		}
	}

	return collected;
}

function listVariantNames(componentSet: any): string[] {
	if (!componentSet?.children || !Array.isArray(componentSet.children)) {
		return [];
	}

	return componentSet.children
		.filter((child: any) => child.type === "COMPONENT")
		.map((child: any) => child.name);
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
