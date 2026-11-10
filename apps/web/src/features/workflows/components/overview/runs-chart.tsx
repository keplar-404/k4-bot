"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { RunRange, RunsBucket } from "../../api";
import { bucketLabel, RANGE_INFO } from "./range";

const chartConfig = {
  succeeded: { label: "Succeeded", color: "var(--chart-2)" },
  failed: { label: "Failed", color: "var(--destructive)" },
  other: { label: "Other", color: "var(--muted-foreground)" },
} satisfies ChartConfig;

/**
 * Runs over time, all workflows together (shadcn chart): one stacked bar per day, week, month or year, split into
 * succeeded, failed and other (running, cancelled, waiting). The period follows the overview's range toggle.
 */
export function RunsChart({
  series,
  range,
}: {
  series: RunsBucket[];
  range: RunRange;
}) {
  const info = RANGE_INFO[range];
  const data = series.map((b) => ({
    start: b.start,
    succeeded: b.succeeded,
    failed: b.failed,
    other: Math.max(0, b.total - b.succeeded - b.failed),
  }));
  const total = series.reduce((n, b) => n + b.total, 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{info.title}</CardTitle>
        <CardDescription>
          {total.toLocaleString()} run{total === 1 ? "" : "s"} ·{" "}
          {info.period.toLowerCase()}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-60 w-full"
        >
          <BarChart
            accessibilityLayer
            data={data}
            margin={{ left: -16, right: 4 }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="start"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={16}
              tickFormatter={(v: string) => bucketLabel(v, range)}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              width={40}
            />
            <ChartTooltip
              cursor={{ fill: "var(--muted)", opacity: 0.5 }}
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload) =>
                    payload?.[0]
                      ? bucketLabel(
                          String(payload[0].payload.start),
                          range,
                          true,
                        )
                      : ""
                  }
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar
              dataKey="succeeded"
              stackId="runs"
              fill="var(--color-succeeded)"
            />
            <Bar dataKey="failed" stackId="runs" fill="var(--color-failed)" />
            <Bar dataKey="other" stackId="runs" fill="var(--color-other)" />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
