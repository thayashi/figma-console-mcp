import type { LoadedProjectPolicy } from "../daemon/project-policy.js";

export interface MockupRecipe {
	name: string;
	category: "screen" | "section" | "surface" | "form" | "data" | "components";
	summary: string;
	useWhen: string[];
	avoidWhen: string[];
	structureRules: string[];
	structuredToolsFirst: string[];
	figmaExecuteWhen: string[];
	validationSteps: string[];
	starterCode?: string;
}

export interface MockupRecipeLibrary {
	workflow: string[];
	globalRules: string[];
	projectPolicyHints: string[];
	recipes: MockupRecipe[];
}

interface BuildMockupRecipeLibraryOptions {
	policy?: LoadedProjectPolicy | null;
	includeStarterCode?: boolean;
}

const recipeDefinitions: MockupRecipe[] = [
	{
		name: "screen-frame",
		category: "screen",
		summary: "Create one top-level app screen frame with Auto Layout and consistent screen padding.",
		useWhen: [
			"Starting a new desktop or mobile screen.",
			"Creating sibling screens for a multi-screen flow.",
			"Establishing a root container before adding sections or cards.",
		],
		avoidWhen: [
			"Building a presentation board that intentionally lays out multiple screens in one wrapper.",
			"Editing a single existing component inside a screen.",
		],
		structureRules: [
			"Use one root Frame per screen.",
			"Set layoutMode on the screen root immediately.",
			"Use padding and itemSpacing instead of manual offsets for internal layout.",
			"Keep multiple screens as sibling frames on the page.",
		],
		structuredToolsFirst: ["figma_create_child", "figma_resize_node", "figma_set_fills"],
		figmaExecuteWhen: [
			"You need to create the root frame and several nested structural containers in one pass.",
			"You need reusable helper functions for screen scaffolding.",
		],
		validationSteps: [
			"Run figma_capture_screenshot on the screen root.",
			"Run figma_lint_design if the screen contains several nested layout containers.",
		],
		starterCode: `const screen = figma.createFrame();
screen.name = "App/Screen";
screen.layoutMode = "VERTICAL";
screen.primaryAxisSizingMode = "FIXED";
screen.counterAxisSizingMode = "FIXED";
screen.resize(1440, 1024);
screen.paddingTop = 32;
screen.paddingRight = 32;
screen.paddingBottom = 32;
screen.paddingLeft = 32;
screen.itemSpacing = 24;
screen.fills = [{ type: "SOLID", color: { r: 0.97, g: 0.97, b: 0.98 } }];
figma.currentPage.appendChild(screen);
return { id: screen.id, name: screen.name };`,
	},
	{
		name: "section-stack",
		category: "section",
		summary: "Build a vertical section stack where each section fills width and hugs its own content height.",
		useWhen: [
			"Stacking hero, filters, cards, and tables vertically in one screen.",
			"Creating dashboard or settings sections with clear vertical rhythm.",
		],
		avoidWhen: [
			"Arranging free-positioned marketing artboards.",
			"Creating a component set or variant matrix.",
		],
		structureRules: [
			"Use a vertical Auto Layout parent for the stack.",
			"Each child section should use FILL width and HUG height.",
			"Keep section frames structural unless they are intended surfaces.",
		],
		structuredToolsFirst: ["figma_create_child", "figma_set_fills", "figma_set_corner_radius"],
		figmaExecuteWhen: [
			"You need to create the parent stack and several nested sections together.",
		],
		validationSteps: [
			"Check screenshot spacing consistency between sections.",
			"Run lint if sections mix cards, forms, and data views.",
		],
		starterCode: `function createSection(name) {
  const section = figma.createFrame();
  section.name = name;
  section.layoutMode = "VERTICAL";
  section.primaryAxisSizingMode = "AUTO";
  section.counterAxisSizingMode = "AUTO";
  section.itemSpacing = 16;
  section.fills = [];
  return section;
}`,
	},
	{
		name: "card-list",
		category: "surface",
		summary: "Create repeated cards with one surface frame and one internal content frame per card.",
		useWhen: [
			"Building dashboards, summary panels, activity feeds, or search results.",
			"Repeating the same visual surface with consistent spacing.",
		],
		avoidWhen: [
			"The project already has a reusable card component you should instantiate.",
		],
		structureRules: [
			"Use one visual surface frame for the card.",
			"Use an inner content frame when the card body needs its own stacking logic.",
			"Do not place loose text and shapes directly on the page.",
		],
		structuredToolsFirst: ["figma_instantiate_component", "figma_create_child", "figma_set_text_content"],
		figmaExecuteWhen: [
			"You need to generate several cards with shared nested layout in one pass.",
		],
		validationSteps: [
			"Check screenshot for card padding and alignment consistency.",
			"Run lint if the list includes badges, actions, or charts.",
		],
	},
	{
		name: "toolbar-header",
		category: "section",
		summary: "Create a horizontal header row with title, supporting actions, and aligned controls.",
		useWhen: [
			"Building application headers, section headers, and filter/action bars.",
			"Combining title text with buttons, inputs, or status chips.",
		],
		avoidWhen: [
			"The header is already available as a component instance.",
		],
		structureRules: [
			"Use horizontal Auto Layout.",
			"Use SPACE_BETWEEN only when the parent width is fixed or meaningfully constrained.",
			"Keep controls as HUG unless a field intentionally fills remaining space.",
		],
		structuredToolsFirst: ["figma_instantiate_component", "figma_set_instance_properties", "figma_set_text_content"],
		figmaExecuteWhen: [
			"You need one-shot construction of title, subtitle, actions, and nested filter rows.",
		],
		validationSteps: [
			"Check screenshot for vertical alignment and uneven control sizing.",
		],
	},
	{
		name: "modal-dialog",
		category: "surface",
		summary: "Create a dialog surface with stacked content and a dedicated footer action row.",
		useWhen: [
			"Building confirmation dialogs, settings overlays, and form modals.",
		],
		avoidWhen: [
			"You only need a single card embedded in a page rather than an overlay concept.",
		],
		structureRules: [
			"Use one dialog surface frame.",
			"Stack header, body, and footer vertically.",
			"Keep footer actions in a separate horizontal row.",
			"Use absolute positioning only for intentional overlay affordances like a close button.",
		],
		structuredToolsFirst: ["figma_instantiate_component", "figma_create_child", "figma_set_text_content"],
		figmaExecuteWhen: [
			"You need coordinated creation of the dialog shell and nested content regions.",
		],
		validationSteps: [
			"Check screenshot for modal proportions, footer spacing, and title hierarchy.",
			"Run lint if the dialog contains form fields or dense content.",
		],
	},
	{
		name: "settings-form",
		category: "form",
		summary: "Create a settings panel with stacked field groups and clear label-control relationships.",
		useWhen: [
			"Building preferences screens, account settings, or configuration panels.",
		],
		avoidWhen: [
			"The work is only text replacement in an existing form layout.",
		],
		structureRules: [
			"Group related settings into vertical sections.",
			"Use horizontal rows only for label/value or inline toggle layouts.",
			"Prefer existing input, select, switch, and button components over custom primitives.",
		],
		structuredToolsFirst: ["figma_search_components", "figma_instantiate_component", "figma_set_instance_properties"],
		figmaExecuteWhen: [
			"You need to scaffold multiple field groups and layout frames at once before placing components.",
		],
		validationSteps: [
			"Check screenshot for field alignment and cramped labels.",
			"Run lint because forms often surface accessibility and spacing issues.",
		],
	},
	{
		name: "data-table",
		category: "data",
		summary: "Create a readable table structure with a header row, repeated data rows, and consistent column rhythm.",
		useWhen: [
			"Building admin tables, billing lists, audit logs, or compact comparison grids.",
		],
		avoidWhen: [
			"The page only needs a loose list or card collection rather than a true table.",
		],
		structureRules: [
			"Use a dedicated table container frame.",
			"Separate header and row structures clearly.",
			"Use repeated row frames rather than manually placed text layers.",
			"Keep labels and values aligned to a consistent grid rhythm.",
		],
		structuredToolsFirst: ["figma_instantiate_component", "figma_create_child", "figma_set_text_content"],
		figmaExecuteWhen: [
			"You need to generate the table shell and repeated row scaffolding in one coordinated operation.",
		],
		validationSteps: [
			"Check screenshot for column alignment, row height consistency, and truncation problems.",
			"Run lint because tables often reveal weak spacing structure.",
		],
	},
	{
		name: "dashboard-section",
		category: "data",
		summary: "Compose KPI cards, charts, and tables into one dashboard section with readable hierarchy.",
		useWhen: [
			"Building analytics, operations, or reporting surfaces.",
		],
		avoidWhen: [
			"The screen is mostly editorial or marketing content rather than product UI.",
		],
		structureRules: [
			"Use one section root and split KPI summaries, charts, and tables into child regions.",
			"Treat charts as product UI, not decorative placeholders.",
			"Keep data regions readable before adding visual embellishment.",
		],
		structuredToolsFirst: ["figma_search_components", "figma_instantiate_component", "figma_create_child"],
		figmaExecuteWhen: [
			"You need to scaffold several nested regions and repeated KPI surfaces in one pass.",
		],
		validationSteps: [
			"Check screenshot specifically for chart legibility and odd proportions.",
			"Run lint after creation because dashboards accumulate structural debt quickly.",
		],
	},
	{
		name: "component-variants",
		category: "components",
		summary: "Create related component states as sibling components, then organize them into a clean variant set.",
		useWhen: [
			"Building button states, chip states, or other reusable component variants.",
		],
		avoidWhen: [
			"You only need one instance on a mockup screen rather than a reusable component asset.",
		],
		structureRules: [
			"Create each state as a structurally complete frame first.",
			"Convert frames to components only after the structure is correct.",
			"Use slash-separated naming consistently when preparing variants.",
		],
		structuredToolsFirst: ["figma_add_component_property", "figma_edit_component_property", "figma_arrange_component_set"],
		figmaExecuteWhen: [
			"You need direct Plugin API control for converting finished frames into components and variants.",
		],
		validationSteps: [
			"Check screenshot for variant spacing and label clarity.",
			"Use figma_arrange_component_set after creation when the variant grid needs normalization.",
		],
	},
];

export function buildMockupRecipeLibrary(options: BuildMockupRecipeLibraryOptions = {}): MockupRecipeLibrary {
	const recipes = recipeDefinitions.map((recipe) => ({
		...recipe,
		...(options.includeStarterCode ? {} : { starterCode: undefined }),
	}));

	return {
		workflow: [
			"Discover runtime state and target file before editing.",
			"Read project policy and design-system context before creating primitives.",
			"Prefer structured tools and library components first.",
			"Use figma_execute only for layout patterns or coordinated edits that structured tools cannot express cleanly.",
			"Validate with screenshot and iterate when structure or spacing is weak.",
		],
		globalRules: [
			"Use Frames, not Groups.",
			"Default to Auto Layout for screens, sections, cards, rows, and stacked content.",
			"Use padding and itemSpacing before manual offsets.",
			"Avoid manual x/y positioning inside Auto Layout containers.",
			"Prefer HUG and FILL over unnecessary fixed sizes.",
			"Load fonts before writing text in Plugin API code.",
			"Normalize colors to Figma's 0-1 RGB range.",
		],
		projectPolicyHints: buildProjectPolicyHints(options.policy),
		recipes,
	};
}

export function filterMockupRecipes(
	library: MockupRecipeLibrary,
	options: { names?: string[]; query?: string } = {},
): MockupRecipeLibrary {
	const requestedNames = new Set((options.names || []).map((name) => name.trim()).filter(Boolean));
	const query = options.query?.trim().toLowerCase();

	const recipes = library.recipes.filter((recipe) => {
		if (requestedNames.size > 0 && !requestedNames.has(recipe.name)) {
			return false;
		}

		if (!query) {
			return true;
		}

		const haystack = [
			recipe.name,
			recipe.category,
			recipe.summary,
			...recipe.useWhen,
			...recipe.structureRules,
		].join(" ").toLowerCase();

		return haystack.includes(query);
	});

	return {
		...library,
		recipes,
	};
}

function buildProjectPolicyHints(policy: LoadedProjectPolicy | null | undefined): string[] {
	if (!policy) {
		return [
			"No project policy is loaded. Use generic structure recipes and validate with screenshot plus lint.",
		];
	}

	const hints: string[] = [];
	const mockups = policy.policy.mockups;
	const validation = policy.policy.validation;

	if (policy.policy.projectName) {
		hints.push(`Apply the loaded project policy for ${policy.policy.projectName}.`);
	}
	if (mockups.preferredFonts.length > 0) {
		hints.push(`Prefer these fonts when creating raw text nodes: ${mockups.preferredFonts.join(", ")}.`);
	}
	if (Object.keys(mockups.preferredComponents).length > 0) {
		hints.push(`Check preferred component groups from project policy before creating custom primitives.`);
	}
	if (mockups.componentLibraries.length > 0) {
		hints.push(`Search configured component libraries before drawing raw controls with figma_execute.`);
	}
	if (validation.requireScreenshotReview) {
		hints.push("The project policy requires screenshot review before considering a mockup complete.");
	}
	if (validation.requireLint) {
		hints.push(`The project policy expects lint validation with rules: ${validation.lintRules.join(", ")}.`);
	}

	return hints;
}
