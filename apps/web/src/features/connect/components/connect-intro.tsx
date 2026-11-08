/** The page title and what connecting an app means, plus any load error. */
export function ConnectIntro({ error }: { error: string | null }) {
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="font-semibold text-2xl tracking-tight">
          Connected apps
        </h1>
        <p className="max-w-2xl text-muted-foreground text-sm">
          Connect your accounts once, then use them in workflows and let your
          bots act on them. Each connection is yours alone, and you can
          disconnect it at any time.
        </p>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-destructive text-sm"
        >
          {error}
        </p>
      )}
    </>
  );
}
