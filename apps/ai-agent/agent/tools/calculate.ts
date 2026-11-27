// Exact math with mathjs (lib/math.ts): arithmetic, big numbers, fractions, complex
// numbers, matrices, statistics, units and derivatives, instead of the model doing math
// in its head. Expressions run in a locked-down mathjs, never as code.
import { defineTool } from "eve/tools";
import { z } from "zod";
import { evaluateMath, MAX_EXPRESSION } from "@repo/shared/math";

export default defineTool({
	description: `Exact math (mathjs). One expression, or several on separate lines (variables like a = 3 carry over; the last line's value is returned). Supports + - * / ^ and %, percent like 15% * 1200, units ("4 mi to km", "100 degC to degF", "5 kg * 9.8 m/s^2 to N"), matrices ([1, 2; 3, 4], det, inv, transpose, multiply), statistics (mean, median, std, variance, sum), complex numbers, fractions (fraction(1, 3)), big numbers (bignumber("0.1") + bignumber("0.2")), combinatorics (factorial, combinations), log, exp, trig, and derivative("x^3", "x") / simplify("2x + 3x"). Use it for any number you report: money, totals, percentages, conversions, science. Pass the raw data to the built-in functions (std([2, 4, 4]), inv(...), derivative(...)) instead of writing formulas out by hand, and use it for matrix and calculus results too. It can't solve equations or integrate.`,
	inputSchema: z.object({ expression: z.string().min(1).max(MAX_EXPRESSION) }),
	label: { start: ({ expression }) => `Calculate ${expression.slice(0, 60)}` },
	async execute({ expression }) {
		try {
			return { result: await evaluateMath(expression) };
		} catch (e) {
			return { error: (e as Error).message };
		}
	},
});
