import { z } from "zod";
import { normalizeToolDefinitions } from "./conventions.js";
import type { ToolDefinition } from "../types.js";

const executeInputSchema = z.object({
	code: z.string(),
	timeout: z.number().int().min(1).max(30000).optional().default(5000),
});

const updateVariableInputSchema = z.object({
	variableId: z.string(),
	modeId: z.string(),
	value: z.union([z.string(), z.number(), z.boolean()]),
});

const createVariableInputSchema = z.object({
	name: z.string(),
	collectionId: z.string(),
	resolvedType: z.enum(["COLOR", "FLOAT", "STRING", "BOOLEAN"]),
	description: z.string().optional(),
	valuesByMode: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
});

const createVariableCollectionInputSchema = z.object({
	name: z.string(),
	initialModeName: z.string().optional(),
	additionalModes: z.array(z.string()).optional(),
});

const deleteVariableInputSchema = z.object({
	variableId: z.string(),
});

const deleteVariableCollectionInputSchema = z.object({
	collectionId: z.string(),
});

const renameVariableInputSchema = z.object({
	variableId: z.string(),
	newName: z.string(),
});

const addModeInputSchema = z.object({
	collectionId: z.string(),
	modeName: z.string(),
});

const renameModeInputSchema = z.object({
	collectionId: z.string(),
	modeId: z.string(),
	newName: z.string(),
});

const batchCreateVariablesInputSchema = z.object({
	collectionId: z.string(),
	variables: z.array(
		z.object({
			name: z.string(),
			resolvedType: z.enum(["COLOR", "FLOAT", "STRING", "BOOLEAN"]),
			description: z.string().optional(),
			valuesByMode: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
		}),
	).min(1).max(100),
});

const batchUpdateVariablesInputSchema = z.object({
	updates: z.array(
		z.object({
			variableId: z.string(),
			modeId: z.string(),
			value: z.union([z.string(), z.number(), z.boolean()]),
		}),
	).min(1).max(100),
});

const setupDesignTokensInputSchema = z.object({
	collectionName: z.string(),
	modes: z.array(z.string()).min(1).max(4),
	tokens: z.array(
		z.object({
			name: z.string(),
			resolvedType: z.enum(["COLOR", "FLOAT", "STRING", "BOOLEAN"]),
			description: z.string().optional(),
			values: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
		}),
	).min(1).max(100),
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

type ExecuteInput = z.infer<typeof executeInputSchema>;
type UpdateVariableInput = z.infer<typeof updateVariableInputSchema>;
type CreateVariableInput = z.infer<typeof createVariableInputSchema>;
type CreateVariableCollectionInput = z.infer<typeof createVariableCollectionInputSchema>;
type DeleteVariableInput = z.infer<typeof deleteVariableInputSchema>;
type DeleteVariableCollectionInput = z.infer<typeof deleteVariableCollectionInputSchema>;
type RenameVariableInput = z.infer<typeof renameVariableInputSchema>;
type AddModeInput = z.infer<typeof addModeInputSchema>;
type RenameModeInput = z.infer<typeof renameModeInputSchema>;
type BatchCreateVariablesInput = z.infer<typeof batchCreateVariablesInputSchema>;
type BatchUpdateVariablesInput = z.infer<typeof batchUpdateVariablesInputSchema>;
type SetupDesignTokensInput = z.infer<typeof setupDesignTokensInputSchema>;
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

const pluginRequiredErrors = [
	{
		code: "PLUGIN_REQUIRED",
		message: "Desktop Bridge plugin is not connected.",
		hint: "Open the Desktop Bridge plugin in the target Figma file and retry.",
	},
];

function buildHexColorBatchHelpers(): string {
	return `
function hexToRgba(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  return {
    r: parseInt(hex.substring(0, 2), 16) / 255,
    g: parseInt(hex.substring(2, 4), 16) / 255,
    b: parseInt(hex.substring(4, 6), 16) / 255,
    a: hex.length === 8 ? parseInt(hex.substring(6, 8), 16) / 255 : 1
  };
}`;
}

export function createLocalWriteToolDefinitions(): ToolDefinition<any, any>[] {
	const executeTool: ToolDefinition<ExecuteInput, any> = {
		name: "figma_execute",
		summary: "Execute JavaScript in Figma's plugin context.",
		description:
			"Registry-backed write tool for HTTP/CLI. Runs arbitrary JavaScript against the Figma Plugin API through the Desktop Bridge plugin.",
		tags: ["figma", "write", "plugin", "execute"],
		discoveryGroup: "execute",
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
		commonErrors: pluginRequiredErrors,
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

	const updateVariableTool: ToolDefinition<UpdateVariableInput, any> = {
		name: "figma_update_variable",
		summary: "Update a single variable value in a collection mode.",
		description:
			"Registry-backed write tool for HTTP/CLI. Updates one Figma variable value through the Desktop Bridge plugin. Prefer batch updates for larger token changes.",
		tags: ["figma", "write", "variables", "tokens"],
		discoveryGroup: "variables",
		inputSchema: updateVariableInputSchema,
		capabilities: {
			requiresPlugin: true,
			requiresRestToken: false,
			supportsCli: true,
			supportsHttp: true,
			supportsMcp: true,
			responseShape: "medium",
			sideEffects: "document_write",
		},
		examples: [{ title: "Update one variable value", input: { variableId: "VariableID:123:456", modeId: "1:0", value: "#FF0000" } }],
		relatedTools: ["figma_get_variables", "figma_batch_update_variables"],
		commonErrors: pluginRequiredErrors,
		handler: async ({ runtime }, input: UpdateVariableInput) => {
			const connector = await runtime.getDesktopConnector();
			const result = await connector.updateVariable(input.variableId, input.modeId, input.value);
			return {
				success: true,
				message: `Variable "${result.variable.name}" updated successfully`,
				variable: result.variable,
				timestamp: Date.now(),
			};
		},
	};

	const createVariableTool: ToolDefinition<CreateVariableInput, any> = {
		name: "figma_create_variable",
		summary: "Create a single Figma variable.",
		description:
			"Registry-backed write tool for HTTP/CLI. Creates one variable through the Desktop Bridge plugin with optional description and initial mode values.",
		tags: ["figma", "write", "variables", "tokens"],
		discoveryGroup: "variables",
		inputSchema: createVariableInputSchema,
		capabilities: {
			requiresPlugin: true,
			requiresRestToken: false,
			supportsCli: true,
			supportsHttp: true,
			supportsMcp: true,
			responseShape: "medium",
			sideEffects: "document_write",
		},
		examples: [{ title: "Create a color variable", input: { name: "color/primary", collectionId: "VariableCollectionId:123:456", resolvedType: "COLOR", valuesByMode: { "1:0": "#FF0000" } } }],
		relatedTools: ["figma_get_variables", "figma_batch_create_variables"],
		commonErrors: pluginRequiredErrors,
		handler: async ({ runtime }, input: CreateVariableInput) => {
			const connector = await runtime.getDesktopConnector();
			const result = await connector.createVariable(input.name, input.collectionId, input.resolvedType, {
				description: input.description,
				valuesByMode: input.valuesByMode,
			});
			return {
				success: true,
				message: `Variable "${input.name}" created successfully`,
				variable: result.variable,
				timestamp: Date.now(),
			};
		},
	};

	const createVariableCollectionTool: ToolDefinition<CreateVariableCollectionInput, any> = {
		name: "figma_create_variable_collection",
		summary: "Create a variable collection.",
		description:
			"Registry-backed write tool for HTTP/CLI. Creates a new variable collection with optional additional modes through the Desktop Bridge plugin.",
		tags: ["figma", "write", "variables", "collections"],
		discoveryGroup: "variables",
		inputSchema: createVariableCollectionInputSchema,
		capabilities: {
			requiresPlugin: true,
			requiresRestToken: false,
			supportsCli: true,
			supportsHttp: true,
			supportsMcp: true,
			responseShape: "medium",
			sideEffects: "document_write",
		},
		examples: [{ title: "Create a collection with modes", input: { name: "Brand Tokens", initialModeName: "Light", additionalModes: ["Dark"] } }],
		relatedTools: ["figma_create_variable", "figma_setup_design_tokens"],
		commonErrors: pluginRequiredErrors,
		handler: async ({ runtime }, input: CreateVariableCollectionInput) => {
			const connector = await runtime.getDesktopConnector();
			const result = await connector.createVariableCollection(input.name, {
				initialModeName: input.initialModeName,
				additionalModes: input.additionalModes,
			});
			return {
				success: true,
				message: `Collection "${input.name}" created successfully`,
				collection: result.collection,
				timestamp: Date.now(),
			};
		},
	};

	const deleteVariableTool: ToolDefinition<DeleteVariableInput, any> = {
		name: "figma_delete_variable",
		summary: "Delete a variable.",
		description:
			"Registry-backed write tool for HTTP/CLI. Deletes a variable through the Desktop Bridge plugin.",
		tags: ["figma", "write", "variables", "delete"],
		discoveryGroup: "variables",
		inputSchema: deleteVariableInputSchema,
		capabilities: {
			requiresPlugin: true,
			requiresRestToken: false,
			supportsCli: true,
			supportsHttp: true,
			supportsMcp: true,
			responseShape: "medium",
			sideEffects: "document_write",
		},
		examples: [{ title: "Delete a variable", input: { variableId: "VariableID:123:456" } }],
		relatedTools: ["figma_get_variables", "figma_delete_variable_collection"],
		commonErrors: pluginRequiredErrors,
		handler: async ({ runtime }, input: DeleteVariableInput) => {
			const connector = await runtime.getDesktopConnector();
			const result = await connector.deleteVariable(input.variableId);
			return {
				success: true,
				message: `Variable "${result.deleted.name}" deleted successfully`,
				deleted: result.deleted,
				warning: "This action cannot be undone programmatically. Use Figma's Edit > Undo if needed.",
				timestamp: Date.now(),
			};
		},
	};

	const deleteVariableCollectionTool: ToolDefinition<DeleteVariableCollectionInput, any> = {
		name: "figma_delete_variable_collection",
		summary: "Delete a variable collection and its variables.",
		description:
			"Registry-backed write tool for HTTP/CLI. Deletes a collection and all of its variables through the Desktop Bridge plugin.",
		tags: ["figma", "write", "variables", "collections"],
		discoveryGroup: "variables",
		inputSchema: deleteVariableCollectionInputSchema,
		capabilities: {
			requiresPlugin: true,
			requiresRestToken: false,
			supportsCli: true,
			supportsHttp: true,
			supportsMcp: true,
			responseShape: "medium",
			sideEffects: "document_write",
		},
		examples: [{ title: "Delete a variable collection", input: { collectionId: "VariableCollectionId:123:456" } }],
		relatedTools: ["figma_delete_variable", "figma_get_variables"],
		commonErrors: pluginRequiredErrors,
		handler: async ({ runtime }, input: DeleteVariableCollectionInput) => {
			const connector = await runtime.getDesktopConnector();
			const result = await connector.deleteVariableCollection(input.collectionId);
			return {
				success: true,
				message: `Collection "${result.deleted.name}" and ${result.deleted.variableCount} variables deleted successfully`,
				deleted: result.deleted,
				warning: "This action cannot be undone programmatically. Use Figma's Edit > Undo if needed.",
				timestamp: Date.now(),
			};
		},
	};

	const renameVariableTool: ToolDefinition<RenameVariableInput, any> = {
		name: "figma_rename_variable",
		summary: "Rename a variable.",
		description:
			"Registry-backed write tool for HTTP/CLI. Renames a variable while preserving its values and settings through the Desktop Bridge plugin.",
		tags: ["figma", "write", "variables", "rename"],
		discoveryGroup: "variables",
		inputSchema: renameVariableInputSchema,
		capabilities: {
			requiresPlugin: true,
			requiresRestToken: false,
			supportsCli: true,
			supportsHttp: true,
			supportsMcp: true,
			responseShape: "medium",
			sideEffects: "document_write",
		},
		examples: [{ title: "Rename a variable", input: { variableId: "VariableID:123:456", newName: "colors/primary/background" } }],
		relatedTools: ["figma_get_variables", "figma_update_variable"],
		commonErrors: pluginRequiredErrors,
		handler: async ({ runtime }, input: RenameVariableInput) => {
			const connector = await runtime.getDesktopConnector();
			const result = await connector.renameVariable(input.variableId, input.newName);
			return {
				success: true,
				message: `Variable renamed from "${result.oldName}" to "${result.variable.name}"`,
				oldName: result.oldName,
				variable: result.variable,
				timestamp: Date.now(),
			};
		},
	};

	const addModeTool: ToolDefinition<AddModeInput, any> = {
		name: "figma_add_mode",
		summary: "Add a mode to a variable collection.",
		description:
			"Registry-backed write tool for HTTP/CLI. Adds a new mode to an existing variable collection through the Desktop Bridge plugin.",
		tags: ["figma", "write", "variables", "modes"],
		discoveryGroup: "variables",
		inputSchema: addModeInputSchema,
		capabilities: {
			requiresPlugin: true,
			requiresRestToken: false,
			supportsCli: true,
			supportsHttp: true,
			supportsMcp: true,
			responseShape: "medium",
			sideEffects: "document_write",
		},
		examples: [{ title: "Add a dark mode", input: { collectionId: "VariableCollectionId:123:456", modeName: "Dark" } }],
		relatedTools: ["figma_rename_mode", "figma_get_variables"],
		commonErrors: pluginRequiredErrors,
		handler: async ({ runtime }, input: AddModeInput) => {
			const connector = await runtime.getDesktopConnector();
			const result = await connector.addMode(input.collectionId, input.modeName);
			return {
				success: true,
				message: `Mode "${input.modeName}" added to collection "${result.collection.name}"`,
				newMode: result.newMode,
				collection: result.collection,
				timestamp: Date.now(),
			};
		},
	};

	const renameModeTool: ToolDefinition<RenameModeInput, any> = {
		name: "figma_rename_mode",
		summary: "Rename a collection mode.",
		description:
			"Registry-backed write tool for HTTP/CLI. Renames a variable collection mode through the Desktop Bridge plugin.",
		tags: ["figma", "write", "variables", "modes"],
		discoveryGroup: "variables",
		inputSchema: renameModeInputSchema,
		capabilities: {
			requiresPlugin: true,
			requiresRestToken: false,
			supportsCli: true,
			supportsHttp: true,
			supportsMcp: true,
			responseShape: "medium",
			sideEffects: "document_write",
		},
		examples: [{ title: "Rename a mode", input: { collectionId: "VariableCollectionId:123:456", modeId: "1:0", newName: "Dark Theme" } }],
		relatedTools: ["figma_add_mode", "figma_get_variables"],
		commonErrors: pluginRequiredErrors,
		handler: async ({ runtime }, input: RenameModeInput) => {
			const connector = await runtime.getDesktopConnector();
			const result = await connector.renameMode(input.collectionId, input.modeId, input.newName);
			return {
				success: true,
				message: `Mode renamed from "${result.oldName}" to "${input.newName}"`,
				oldName: result.oldName,
				collection: result.collection,
				timestamp: Date.now(),
			};
		},
	};

	const batchCreateVariablesTool: ToolDefinition<BatchCreateVariablesInput, any> = {
		name: "figma_batch_create_variables",
		summary: "Create multiple variables in one plugin roundtrip.",
		description:
			"Registry-backed write tool for HTTP/CLI. Creates up to 100 variables in one Desktop Bridge execution, which is much faster than repeated single-variable calls.",
		tags: ["figma", "write", "variables", "batch"],
		discoveryGroup: "variables",
		inputSchema: batchCreateVariablesInputSchema,
		capabilities: {
			requiresPlugin: true,
			requiresRestToken: false,
			supportsCli: true,
			supportsHttp: true,
			supportsMcp: true,
			responseShape: "medium",
			sideEffects: "document_write",
		},
		examples: [{ title: "Create token variables in bulk", input: { collectionId: "VariableCollectionId:123:456", variables: [{ name: "color/primary", resolvedType: "COLOR", valuesByMode: { "1:0": "#FF0000" } }] } }],
		relatedTools: ["figma_create_variable", "figma_get_variables"],
		commonErrors: pluginRequiredErrors,
		handler: async ({ runtime }, input: BatchCreateVariablesInput) => {
			const connector = await runtime.getDesktopConnector();
			const script = `
const results = [];
const collectionId = ${JSON.stringify(input.collectionId)};
const vars = ${JSON.stringify(input.variables)};
${buildHexColorBatchHelpers()}

const collection = await figma.variables.getVariableCollectionByIdAsync(collectionId);
if (!collection) return { created: 0, failed: vars.length, results: vars.map(v => ({ success: false, name: v.name, error: 'Collection not found: ' + collectionId })) };

for (const v of vars) {
  try {
    const variable = figma.variables.createVariable(v.name, collection, v.resolvedType);
    if (v.description) variable.description = v.description;
    if (v.valuesByMode) {
      for (const [modeId, value] of Object.entries(v.valuesByMode)) {
        const processed = v.resolvedType === 'COLOR' && typeof value === 'string' ? hexToRgba(value) : value;
        variable.setValueForMode(modeId, processed);
      }
    }
    results.push({ success: true, name: v.name, id: variable.id });
  } catch (err) {
    results.push({ success: false, name: v.name, error: String(err) });
  }
}

return {
  created: results.filter(r => r.success).length,
  failed: results.filter(r => !r.success).length,
  results
};`;
			const timeout = Math.max(5000, input.variables.length * 200);
			const result = await connector.executeCodeViaUI(script, Math.min(timeout, 30000));
			return {
				success: true,
				message: `Batch created ${result.result?.created ?? 0} variables (${result.result?.failed ?? 0} failed)`,
				...result.result,
				timestamp: Date.now(),
			};
		},
	};

	const batchUpdateVariablesTool: ToolDefinition<BatchUpdateVariablesInput, any> = {
		name: "figma_batch_update_variables",
		summary: "Update multiple variables in one plugin roundtrip.",
		description:
			"Registry-backed write tool for HTTP/CLI. Updates up to 100 variable values in one Desktop Bridge execution for better performance.",
		tags: ["figma", "write", "variables", "batch"],
		discoveryGroup: "variables",
		inputSchema: batchUpdateVariablesInputSchema,
		capabilities: {
			requiresPlugin: true,
			requiresRestToken: false,
			supportsCli: true,
			supportsHttp: true,
			supportsMcp: true,
			responseShape: "medium",
			sideEffects: "document_write",
		},
		examples: [{ title: "Update token values in bulk", input: { updates: [{ variableId: "VariableID:123:456", modeId: "1:0", value: "#000000" }] } }],
		relatedTools: ["figma_update_variable", "figma_get_variables"],
		commonErrors: pluginRequiredErrors,
		handler: async ({ runtime }, input: BatchUpdateVariablesInput) => {
			const connector = await runtime.getDesktopConnector();
			const script = `
const results = [];
const updates = ${JSON.stringify(input.updates)};
${buildHexColorBatchHelpers()}

for (const u of updates) {
  try {
    const variable = await figma.variables.getVariableByIdAsync(u.variableId);
    if (!variable) throw new Error('Variable not found: ' + u.variableId);
    const isColor = variable.resolvedType === 'COLOR';
    const processed = isColor && typeof u.value === 'string' ? hexToRgba(u.value) : u.value;
    variable.setValueForMode(u.modeId, processed);
    results.push({ success: true, variableId: u.variableId, name: variable.name });
  } catch (err) {
    results.push({ success: false, variableId: u.variableId, error: String(err) });
  }
}

return {
  updated: results.filter(r => r.success).length,
  failed: results.filter(r => !r.success).length,
  results
};`;
			const timeout = Math.max(5000, input.updates.length * 150);
			const result = await connector.executeCodeViaUI(script, Math.min(timeout, 30000));
			return {
				success: true,
				message: `Batch updated ${result.result?.updated ?? 0} variables (${result.result?.failed ?? 0} failed)`,
				...result.result,
				timestamp: Date.now(),
			};
		},
	};

	const setupDesignTokensTool: ToolDefinition<SetupDesignTokensInput, any> = {
		name: "figma_setup_design_tokens",
		summary: "Create a token collection, modes, and variables in one operation.",
		description:
			"Registry-backed write tool for HTTP/CLI. Creates a collection, configures up to four modes, and seeds up to 100 tokens in one Desktop Bridge execution.",
		tags: ["figma", "write", "variables", "tokens", "batch"],
		discoveryGroup: "variables",
		inputSchema: setupDesignTokensInputSchema,
		capabilities: {
			requiresPlugin: true,
			requiresRestToken: false,
			supportsCli: true,
			supportsHttp: true,
			supportsMcp: true,
			responseShape: "medium",
			sideEffects: "document_write",
		},
		examples: [{ title: "Create a Light/Dark token collection", input: { collectionName: "Brand Tokens", modes: ["Light", "Dark"], tokens: [{ name: "color/primary", resolvedType: "COLOR", values: { Light: "#FFFFFF", Dark: "#000000" } }] } }],
		relatedTools: ["figma_create_variable_collection", "figma_batch_create_variables"],
		commonErrors: pluginRequiredErrors,
		handler: async ({ runtime }, input: SetupDesignTokensInput) => {
			const connector = await runtime.getDesktopConnector();
			const script = `
const collectionName = ${JSON.stringify(input.collectionName)};
const modeNames = ${JSON.stringify(input.modes)};
const tokenDefs = ${JSON.stringify(input.tokens)};
${buildHexColorBatchHelpers()}

const collection = figma.variables.createVariableCollection(collectionName);
const modeMap = {};
const defaultModeId = collection.modes[0].modeId;
collection.renameMode(defaultModeId, modeNames[0]);
modeMap[modeNames[0]] = defaultModeId;

for (let i = 1; i < modeNames.length; i++) {
  const newModeId = collection.addMode(modeNames[i]);
  modeMap[modeNames[i]] = newModeId;
}

const results = [];
for (const t of tokenDefs) {
  try {
    const variable = figma.variables.createVariable(t.name, collection, t.resolvedType);
    if (t.description) variable.description = t.description;
    for (const [modeName, value] of Object.entries(t.values)) {
      const modeId = modeMap[modeName];
      if (!modeId) { results.push({ success: false, name: t.name, error: 'Unknown mode: ' + modeName }); continue; }
      const processed = t.resolvedType === 'COLOR' && typeof value === 'string' ? hexToRgba(value) : value;
      variable.setValueForMode(modeId, processed);
    }
    results.push({ success: true, name: t.name, id: variable.id });
  } catch (err) {
    results.push({ success: false, name: t.name, error: String(err) });
  }
}

return {
  collectionId: collection.id,
  collectionName: collectionName,
  modes: modeMap,
  created: results.filter(r => r.success).length,
  failed: results.filter(r => !r.success).length,
  results
};`;
			const timeout = Math.max(10000, input.tokens.length * 200 + input.modes.length * 500);
			const result = await connector.executeCodeViaUI(script, Math.min(timeout, 30000));
			return {
				success: true,
				message: `Created collection "${input.collectionName}" with ${input.modes.length} mode(s) and ${result.result?.created ?? 0} tokens`,
				...result.result,
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
		discoveryGroup: "components",
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
		commonErrors: pluginRequiredErrors,
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
		discoveryGroup: "components",
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
		commonErrors: pluginRequiredErrors,
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
		discoveryGroup: "components",
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
		commonErrors: pluginRequiredErrors,
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
		discoveryGroup: "metadata",
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
		commonErrors: pluginRequiredErrors,
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
		discoveryGroup: "nodes",
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
		commonErrors: pluginRequiredErrors,
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
		discoveryGroup: "styling",
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
		commonErrors: pluginRequiredErrors,
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
		discoveryGroup: "styling",
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
		commonErrors: pluginRequiredErrors,
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
		discoveryGroup: "styling",
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
				title: "Set node opacity to 50%",
				input: {
					nodeId: "123:456",
					opacity: 0.5,
				},
			},
		],
		relatedTools: ["figma_set_fills", "figma_set_strokes"],
		commonErrors: pluginRequiredErrors,
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
		tags: ["figma", "write", "visual", "corners"],
		discoveryGroup: "styling",
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
				title: "Set corner radius on a rectangle",
				input: {
					nodeId: "123:456",
					radius: 8,
				},
			},
		],
		relatedTools: ["figma_resize_node", "figma_set_fills"],
		commonErrors: pluginRequiredErrors,
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
		summary: "Move a node to an absolute position.",
		description:
			"Registry-backed write tool for HTTP/CLI. Repositions a node through the Desktop Bridge plugin.",
		tags: ["figma", "write", "layout", "position"],
		discoveryGroup: "nodes",
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
				title: "Move a node to a new position",
				input: {
					nodeId: "123:456",
					x: 240,
					y: 320,
				},
			},
		],
		relatedTools: ["figma_resize_node", "figma_clone_node"],
		commonErrors: pluginRequiredErrors,
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
		summary: "Rename a node.",
		description:
			"Registry-backed write tool for HTTP/CLI. Renames a node through the Desktop Bridge plugin.",
		tags: ["figma", "write", "metadata", "naming"],
		discoveryGroup: "metadata",
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
		relatedTools: ["figma_set_description", "figma_check_design_parity"],
		commonErrors: pluginRequiredErrors,
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
		summary: "Clone an existing node.",
		description:
			"Registry-backed write tool for HTTP/CLI. Duplicates a node through the Desktop Bridge plugin.",
		tags: ["figma", "write", "nodes", "duplicate"],
		discoveryGroup: "nodes",
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
		relatedTools: ["figma_move_node", "figma_delete_node"],
		commonErrors: pluginRequiredErrors,
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
		summary: "Delete a node.",
		description:
			"Registry-backed write tool for HTTP/CLI. Removes a node through the Desktop Bridge plugin.",
		tags: ["figma", "write", "nodes", "delete"],
		discoveryGroup: "nodes",
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
		relatedTools: ["figma_clone_node", "figma_create_child"],
		commonErrors: pluginRequiredErrors,
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
		summary: "Set text content and optional font properties.",
		description:
			"Registry-backed write tool for HTTP/CLI. Updates a text node's characters and optional font properties through the Desktop Bridge plugin.",
		tags: ["figma", "write", "text", "typography"],
		discoveryGroup: "content",
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
				title: "Update text and font sizing",
				input: {
					nodeId: "123:456",
					text: "Save changes",
					fontSize: 14,
					fontWeight: 600,
					fontFamily: "Inter",
				},
			},
		],
		relatedTools: ["figma_check_design_parity", "figma_capture_screenshot"],
		commonErrors: pluginRequiredErrors,
		handler: async ({ runtime }, input: SetTextContentInput) => {
			const connector = await runtime.getDesktopConnector();
			const result = await connector.setTextContent(input.nodeId, input.text, {
				fontSize: input.fontSize,
				fontWeight: input.fontWeight,
				fontFamily: input.fontFamily,
			});

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
		summary: "Create a child node under an existing parent.",
		description:
			"Registry-backed write tool for HTTP/CLI. Creates a RECTANGLE, ELLIPSE, FRAME, TEXT, or LINE node through the Desktop Bridge plugin.",
		tags: ["figma", "write", "nodes", "create"],
		discoveryGroup: "nodes",
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
				title: "Create a text label inside a frame",
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
		relatedTools: ["figma_set_text_content", "figma_delete_node"],
		commonErrors: pluginRequiredErrors,
		handler: async ({ runtime }, input: CreateChildInput) => {
			const connector = await runtime.getDesktopConnector();
			const result = await connector.createChildNode(input.parentId, input.nodeType, input.properties);

			if (!result.success) {
				throw new Error(result.error || "Failed to create child node");
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
			"Registry-backed write tool for HTTP/CLI. Uploads image data and applies it as an image fill through the Desktop Bridge plugin.",
		tags: ["figma", "write", "images", "fills"],
		discoveryGroup: "content",
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
				title: "Apply a PNG image fill",
				input: {
					nodeIds: ["123:456"],
					imageData: "iVBORw0KGgoAAAANSUhEUgAA...",
					scaleMode: "FILL",
				},
			},
		],
		relatedTools: ["figma_set_fills", "figma_capture_screenshot"],
		commonErrors: pluginRequiredErrors,
		handler: async ({ runtime }, input: SetImageFillInput) => {
			const connector = await runtime.getDesktopConnector();
			const result = await connector.setImageFill(input.nodeIds, input.imageData, input.scaleMode);

			if (!result.success) {
				throw new Error(result.error || "Failed to set image fill");
			}

			return {
				success: true,
				message: `Image fill applied to ${result.updatedCount || input.nodeIds.length} node(s)`,
				imageHash: result.imageHash,
				nodes: result.nodes,
				timestamp: Date.now(),
			};
		},
	};

	const editComponentPropertyTool: ToolDefinition<EditComponentPropertyInput, any> = {
		name: "figma_edit_component_property",
		summary: "Edit an existing component property definition.",
		description:
			"Registry-backed write tool for HTTP/CLI. Renames or updates property defaults and preferred values through the Desktop Bridge plugin.",
		tags: ["figma", "write", "components", "properties"],
		discoveryGroup: "components",
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
				title: "Rename a component property and change its default",
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
		commonErrors: pluginRequiredErrors,
		handler: async ({ runtime }, input: EditComponentPropertyInput) => {
			const connector = await runtime.getDesktopConnector();
			const result = await connector.editComponentProperty(
				input.nodeId,
				input.propertyName,
				input.newValue,
			);

			if (!result.success) {
				throw new Error(result.error || "Failed to edit component property");
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
		summary: "Delete a component property definition.",
		description:
			"Registry-backed write tool for HTTP/CLI. Removes a component property through the Desktop Bridge plugin.",
		tags: ["figma", "write", "components", "properties"],
		discoveryGroup: "components",
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
				title: "Delete a component property",
				input: {
					nodeId: "123:456",
					propertyName: "Show Icon#123:456",
				},
			},
		],
		relatedTools: ["figma_add_component_property", "figma_edit_component_property"],
		commonErrors: pluginRequiredErrors,
		handler: async ({ runtime }, input: DeleteComponentPropertyInput) => {
			const connector = await runtime.getDesktopConnector();
			const result = await connector.deleteComponentProperty(
				input.nodeId,
				input.propertyName,
			);

			if (!result.success) {
				throw new Error(result.error || "Failed to delete component property");
			}

			return {
				success: true,
				message: "Component property deleted",
				timestamp: Date.now(),
			};
		},
	};

	return normalizeToolDefinitions([
		executeTool,
		updateVariableTool,
		createVariableTool,
		createVariableCollectionTool,
		deleteVariableTool,
		deleteVariableCollectionTool,
		renameVariableTool,
		addModeTool,
		renameModeTool,
		batchCreateVariablesTool,
		batchUpdateVariablesTool,
		setupDesignTokensTool,
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
	]);
}
