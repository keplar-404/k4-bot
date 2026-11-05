import assert from "node:assert/strict";
import { formatReport } from "./research-format";

// The shape Tavily's research agent returns (from a real report): plain "References", "[n] url" lines, inline [3], [4].
const body = [
  "Executive summary",
  "",
  "The unwind erased hundreds of billions in equity value [3], [4]. Capex jumped [9].",
  "",
  "References",
  "",
  "[3] https://internationalfinance.com/markets/if-insights",
  "[4] https://www.linkedin.com/posts/lucia",
  "[9] https://rhg.com/research/examining-chinas-ai-financing",
].join("\n");
const sources = [
  { title: "IF Insights: China's AI bubble bursts", url: "https://internationalfinance.com/markets/if-insights" },
  { title: "Examining China's AI Financing – Rhodium Group", url: "https://rhg.com/research/examining-chinas-ai-financing" },
];
const out = formatReport(body, sources);

assert.match(out, /value \[\[3\]\]\(https:\/\/internationalfinance\.com\/markets\/if-insights\), \[\[4\]\]\(https:\/\/www\.linkedin\.com\/posts\/lucia\)\./, "citations link to their reference");
assert.match(out, /^## References$/m, "plain heading becomes a heading");
assert.match(out, /^3\. \[IF Insights: China's AI bubble bursts\]\(https:\/\/internationalfinance\.com\/markets\/if-insights\) · internationalfinance\.com$/m, "title + domain");
assert.match(out, /^4\. \[linkedin\.com\]\(https:\/\/www\.linkedin\.com\/posts\/lucia\) · linkedin\.com$/m, "no title: the domain");
assert.doesNotMatch(out, /## Sources/, "Tavily's own list is used, no second list");
assert.equal((out.match(/rhg\.com\/research/g) ?? []).length, 2, "rhg once in the text link, once in the list");

// No list in the report: one is added from the returned sources, and [n] maps to the n-th source.
const plain = formatReport("Growth slowed [2].", sources);
assert.match(plain, /slowed \[\[2\]\]\(https:\/\/rhg\.com\/research\/examining-chinas-ai-financing\)/);
assert.match(plain, /## Sources\n1\. \[IF Insights[^\n]+\n2\. \[Examining/);

// Unknown numbers and existing links are left alone.
assert.equal(formatReport("See [7] and [[1]](https://x.y).", []), "See [7] and [[1]](https://x.y).");
console.log("research format: all checks passed");
