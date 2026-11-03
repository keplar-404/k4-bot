/** What "Wrap up" and "Force shut down" do, under the close-computer question. */
export function CloseOptionsHelp() {
  return (
    <dl className="flex flex-col gap-2 text-xs text-muted-foreground">
      <div>
        <dt className="inline font-medium text-foreground">Wrap up: </dt>
        <dd className="inline">
          each bot finishes its step, saves its work and writes a summary. The
          computer sleeps by itself as soon as all of them are done.
        </dd>
      </div>
      <div>
        <dt className="inline font-medium text-foreground">
          Force shut down:{" "}
        </dt>
        <dd className="inline">
          the computer sleeps now. Each bot is told you closed it, stops, and
          says in the chat that it could not finish. Files are kept.
        </dd>
      </div>
    </dl>
  );
}
