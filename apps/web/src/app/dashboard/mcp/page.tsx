import { PageHeader } from "@/components/layout/page-header";

export default function McpPage() {
  return (
    <>
      <PageHeader title="MCP" />
      <div className="flex flex-1 flex-col gap-4 p-4">
        <h1 className="text-2xl font-semibold">MCP</h1>
        <p className="text-muted-foreground">MCP servers and configuration.</p>
      </div>
    </>
  );
}
