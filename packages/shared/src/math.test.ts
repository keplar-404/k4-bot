import { expect, test } from "bun:test";
import { evaluateMath } from "./math";

test("science math", async () => {
	expect(await evaluateMath("2 + 3 * 4")).toBe("14");
	expect(await evaluateMath("-2 ^ 2")).toBe("-4");
	expect(await evaluateMath("15% * 1200")).toBe("180");
	expect(await evaluateMath("4 mi to km")).toBe("6.437376 km");
	expect(await evaluateMath("100 degC to degF")).toBe("212 degF");
	expect(await evaluateMath("det([1, 2; 3, 4])")).toBe("-2");
	expect(await evaluateMath("inv([1, 2; 3, 4])")).toBe(
		"[[-2, 1], [1.5, -0.5]]",
	);
	expect(await evaluateMath("sqrt(-4)")).toBe("2i");
	expect(await evaluateMath("mean([1, 2, 3, 4])")).toBe("2.5");
	expect(await evaluateMath("std([2, 4, 4, 4, 5, 5, 7, 9])")).toBe(
		"2.1380899352994",
	);
	expect(await evaluateMath("derivative('x^3 + 2x', 'x')")).toBe(
		"3 * x ^ 2 + 2",
	);
	expect(await evaluateMath("a = 3\nb = 4\nsqrt(a^2 + b^2)")).toBe("5");
	expect(await evaluateMath("factorial(20)")).toBe("2.4329020081766e+18");
});

test("locked down", async () => {
	await expect(evaluateMath("import({x: 1})")).rejects.toThrow("not available");
	await expect(evaluateMath("evaluate('1+1')")).rejects.toThrow(
		"not available",
	);
	await expect(evaluateMath("createUnit('foo')")).rejects.toThrow(
		"not available",
	);
	await expect(
		evaluateMath('parse("import({x: 1})").evaluate()'),
	).rejects.toThrow("not available");
	await expect(evaluateMath("x.constructor")).rejects.toThrow();
	await expect(evaluateMath("2 +")).rejects.toThrow();
	await expect(evaluateMath("9".repeat(3000))).rejects.toThrow("too long");
});
