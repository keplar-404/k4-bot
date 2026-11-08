"use client";

import { Loader2Icon, MoonIcon, PowerIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useBotList } from "@/features/bots/hooks/use-bot-list";
import {
  ComputerProvider,
  useComputerContext,
} from "@/features/computer/components/computer-provider";
import { Activity } from "@/features/computer/components/panel/activity";
import { StateBadge } from "@/features/computer/components/panel/state-badge";
import { Usage } from "@/features/computer/components/panel/usage";
import { ResetComputer } from "./reset-computer";
import { VmSettings } from "./vm-settings";

/** The computer page: its state, the user's settings, every bot's activity, and the reset. */
export function VmPage() {
  return (
    <ComputerProvider>
      <PageHeader title="VM machine" />
      <VmContent />
    </ComputerProvider>
  );
}

function VmContent() {
  const computer = useComputerContext();
  const { status, busy, pending, error } = computer;
  const { bots } = useBotList();
  const names = Object.fromEntries(bots.map((b) => [b.id, b.name]));
  const running = status?.state === "running";

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Computer</h1>
        <p className="max-w-prose text-sm text-muted-foreground">
          One computer shared by all your bots. Each bot has its own folder and
          browser on it.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Status {status && <StateBadge status={status} />}
          </CardTitle>
          {status?.message && (
            <CardDescription>{status.message}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {status && <Usage status={status} />}
          <div className="flex flex-wrap gap-2">
            {running ? (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void computer.pause()}
              >
                {pending === "pause" ? (
                  <Loader2Icon className="animate-spin" />
                ) : (
                  <MoonIcon />
                )}
                Put to sleep
              </Button>
            ) : (
              <Button
                disabled={
                  busy ||
                  !status ||
                  status.state === "starting" ||
                  status.limitReached
                }
                onClick={() => void computer.wake()}
              >
                {pending === "wake" ? (
                  <Loader2Icon className="animate-spin" />
                ) : (
                  <PowerIcon />
                )}
                Wake up
              </Button>
            )}
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </CardContent>
      </Card>

      <VmSettings />

      <Card>
        <CardHeader>
          <CardTitle>Activity</CardTitle>
          <CardDescription>What each bot did on the computer.</CardDescription>
        </CardHeader>
        <CardContent>
          <Activity
            events={computer.activity}
            names={names}
            className="max-h-80"
          />
        </CardContent>
      </Card>

      <ResetComputer disabled={!status || status.state === "starting"} />
    </div>
  );
}
