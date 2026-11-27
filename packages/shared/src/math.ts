// mathjs for the calculate tool, loaded on first use (keeps it off cold starts that
// never do math). Locked down per mathjs's security guide: an expression can't import
// code, define units or evaluate a nested string. `parse` stays on (derivative and
// simplify need it); a parsed node runs in this same instance, so the blocks still hold.
import type { MathJsInstance } from "mathjs";

let instance:
	| Promise<{ math: MathJsInstance; evaluate: MathJsInstance["evaluate"] }>
	| undefined;

function load() {
	instance ??= import("mathjs").then(({ create, all }) => {
		const math = create(all, { number: "number", precision: 64 });
		const evaluate = math.evaluate;
		const blocked = (name: string) => () => {
			throw new Error(`${name} is not available`);
		};
		math.import(
			Object.fromEntries(
				["import", "createUnit", "reviver", "evaluate"].map((n) => [
					n,
					blocked(n),
				]),
			),
			{ override: true },
		);
		return { math, evaluate };
	});
	return instance;
}

export const MAX_EXPRESSION = 2000;

/** Evaluates one expression (or several, one per line). Returns the last result as text. */
export async function evaluateMath(expression: string) {
	if (expression.length > MAX_EXPRESSION)
		throw new Error("Expression too long");
	const { math, evaluate } = await load();
	const result = evaluate(expression);
	// Several lines give a ResultSet: report the last value, like a calculator.
	const last =
		result && typeof result === "object" && "entries" in result
			? (result.entries as unknown[]).at(-1)
			: result;
	if (typeof last === "function")
		throw new Error("That defines a function; call it too.");
	return math.format(last, { precision: 14 });
}
