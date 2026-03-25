import { mockupQualityLintRules, resolveLintRuleRequest } from "../src/core/mockup-lint-preset";

describe("mockup lint preset", () => {
	it("defines a focused mockup-quality rule set", () => {
		expect(mockupQualityLintRules).toEqual([
			"no-autolayout",
			"empty-container",
			"default-name",
			"detached-component",
			"hardcoded-color",
			"no-text-style",
			"wcag-text-size",
			"wcag-line-height",
		]);
	});

	it("expands the mockup-quality preset from explicit input", () => {
		const request = resolveLintRuleRequest({
			preset: "mockup-quality",
		});

		expect(request.requestSource).toBe("input");
		expect(request.appliedPresets).toEqual(["mockup-quality"]);
		expect(request.resolvedRules).toEqual([...mockupQualityLintRules]);
	});

	it("uses project policy lint rules when input is omitted", () => {
		const request = resolveLintRuleRequest({
			policy: {
				sourcePath: "/workspace/figma-console.project.json",
				workspaceRoot: "/workspace",
				policy: {
					version: 1,
					mockups: {
						preferredFonts: [],
						spacingScale: [],
						preferredComponents: {},
						componentLibraries: [],
						defaultScreenPresets: [],
						notes: [],
					},
					validation: {
						requireScreenshotReview: true,
						requireLint: true,
						lintRules: ["mockup-quality"],
						requireParity: false,
					},
				},
			},
		});

		expect(request.requestSource).toBe("project-policy");
		expect(request.appliedPresets).toEqual(["mockup-quality"]);
		expect(request.resolvedRules).toEqual([...mockupQualityLintRules]);
	});
});
