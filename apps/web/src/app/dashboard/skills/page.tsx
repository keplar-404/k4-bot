import { PageHeader } from "@/components/layout/page-header";

export default function SkillsPage() {
  return (
    <>
      <PageHeader title="Skills" />
      <div className="flex flex-1 flex-col gap-4 p-4">
        <h1 className="text-2xl font-semibold">Skills</h1>
        <p className="text-muted-foreground">
          Installed skills and management.
        </p>
      </div>
    </>
  );
}
