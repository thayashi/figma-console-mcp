import { buildMockupRecipeLibrary, filterMockupRecipes } from "../src/core/mockup-recipes";

describe("mockup recipe library", () => {
	it("omits starter code by default and includes project-policy-free fallback hints", () => {
		const library = buildMockupRecipeLibrary();

		expect(library.recipes.length).toBeGreaterThan(5);
		expect(library.recipes[0].starterCode).toBeUndefined();
		expect(library.projectPolicyHints[0]).toContain("No project policy is loaded");
	});

	it("filters recipes by query and includes starter code when requested", () => {
		const filtered = filterMockupRecipes(
			buildMockupRecipeLibrary({ includeStarterCode: true }),
			{ query: "screen" },
		);

		expect(filtered.recipes.length).toBeGreaterThan(0);
		expect(filtered.recipes.some((recipe) => recipe.name === "screen-frame")).toBe(true);
		expect(filtered.recipes.find((recipe) => recipe.name === "screen-frame")?.starterCode).toContain("figma.createFrame");
	});
});
