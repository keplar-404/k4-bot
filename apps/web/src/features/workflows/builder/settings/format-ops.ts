/** The Formatter's operations as the builder shows them: grouped, named, and which settings each one uses. */
export type OptionField = { key: string; label: string; placeholder?: string };

export const FORMAT_GROUPS: Array<{
  group: string;
  ops: Array<{ op: string; label: string; options?: OptionField[] }>;
}> = [
  {
    group: "Text",
    ops: [
      { op: "trim", label: "Clean up spaces" },
      { op: "uppercase", label: "UPPER CASE" },
      { op: "lowercase", label: "lower case" },
      { op: "capitalize", label: "Capitalize Each Word" },
      {
        op: "replace",
        label: "Replace text",
        options: [
          { key: "find", label: "Find this text", placeholder: "e.g. Mr. " },
          {
            key: "replace",
            label: "Replace with (empty removes it)",
            placeholder: "Other text, or leave empty",
          },
        ],
      },
      {
        op: "split",
        label: "Split into a list",
        options: [
          { key: "separator", label: "Separator", placeholder: ", (a comma)" },
        ],
      },
      {
        op: "truncate",
        label: "Shorten",
        options: [
          { key: "length", label: "Max characters", placeholder: "100" },
        ],
      },
      { op: "extract_email", label: "Find an email address" },
      { op: "extract_url", label: "Find a link" },
      { op: "extract_number", label: "Find a number" },
    ],
  },
  {
    group: "Number",
    ops: [
      {
        op: "round",
        label: "Round",
        options: [
          {
            key: "decimals",
            label: "Digits after the point",
            placeholder: "2",
          },
        ],
      },
      {
        op: "add",
        label: "Add",
        options: [
          {
            key: "value",
            label: "Number",
            placeholder: "e.g. 10, or data with +",
          },
        ],
      },
      {
        op: "subtract",
        label: "Subtract",
        options: [
          {
            key: "value",
            label: "Number",
            placeholder: "e.g. 10, or data with +",
          },
        ],
      },
      {
        op: "multiply",
        label: "Multiply by",
        options: [
          {
            key: "value",
            label: "Number",
            placeholder: "e.g. 10, or data with +",
          },
        ],
      },
      {
        op: "divide",
        label: "Divide by",
        options: [
          {
            key: "value",
            label: "Number",
            placeholder: "e.g. 10, or data with +",
          },
        ],
      },
      {
        op: "format_number",
        label: "Format (1,234.50)",
        options: [
          {
            key: "decimals",
            label: "Digits after the point",
            placeholder: "2",
          },
          {
            key: "locale",
            label: "Language and region (e.g. en-US, bn-BD)",
            placeholder: "en-US",
          },
        ],
      },
    ],
  },
  {
    group: "Date & time",
    ops: [
      {
        op: "format_date",
        label: "Format a date",
        options: [
          { key: "timezone", label: "Time zone", placeholder: "Asia/Dhaka" },
          {
            key: "dateStyle",
            label: "Style (short, medium, long, full)",
            placeholder: "medium",
          },
          {
            key: "locale",
            label: "Language and region (e.g. en-US, bn-BD)",
            placeholder: "en-US",
          },
        ],
      },
      {
        op: "add_time",
        label: "Add time",
        options: [
          {
            key: "amount",
            label: "Amount (negative subtracts)",
            placeholder: "1",
          },
          {
            key: "unit",
            label: "Unit (minutes, hours, days, weeks)",
            placeholder: "days",
          },
        ],
      },
      {
        op: "to_timezone",
        label: "Show in a time zone",
        options: [
          { key: "timezone", label: "Time zone", placeholder: "Europe/Berlin" },
        ],
      },
    ],
  },
  {
    group: "List",
    ops: [
      {
        op: "join",
        label: "Join into text",
        options: [
          { key: "separator", label: "Between items", placeholder: ", " },
        ],
      },
      { op: "first", label: "First item" },
      { op: "last", label: "Last item" },
      { op: "count", label: "Count items" },
      { op: "unique", label: "Remove duplicates" },
    ],
  },
];

export const findOp = (op: string) =>
  FORMAT_GROUPS.flatMap((g) => g.ops).find((o) => o.op === op);
