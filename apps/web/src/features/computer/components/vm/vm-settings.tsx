"use client";

import { Loader2Icon } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChatHttpError } from "@/features/chat/lib/client";
import {
  type ComputerSettings,
  getSettings,
  saveSettings,
} from "@/features/computer/api";
import { fieldSetter, useLocalStore } from "@/lib/store/local-store";

/** The user's own limits. Each can only be shorter than the server's, so the inputs stop at its ceiling. */
export function VmSettings() {
  const [{ saved, idle, session, busy, note }, , store] = useLocalStore(() => ({
    saved: null as ComputerSettings | null,
    idle: "",
    session: "",
    busy: false,
    note: null as { ok: boolean; text: string } | null,
  }));
  const setSaved = fieldSetter(store, "saved");
  const setIdle = fieldSetter(store, "idle");
  const setSession = fieldSetter(store, "session");
  const setBusy = fieldSetter(store, "busy");
  const setNote = fieldSetter(store, "note");

  useEffect(() => {
    getSettings()
      .then((s) => {
        setSaved(s);
        setIdle(String(s.idleMinutes));
        setSession(String(s.sessionMinutes));
      })
      .catch(() =>
        setNote({ ok: false, text: "Could not load the settings." }),
      );
  }, [setIdle, setNote, setSaved, setSession]);

  const idleN = Number(idle);
  const sessionN = Number(session);
  const valid =
    saved !== null &&
    Number.isInteger(idleN) &&
    idleN >= 1 &&
    idleN <= saved.maxIdleMinutes &&
    Number.isInteger(sessionN) &&
    sessionN >= 1 &&
    sessionN <= saved.maxSessionMinutes;
  const changed =
    saved !== null &&
    (idleN !== saved.idleMinutes || sessionN !== saved.sessionMinutes);

  const save = async () => {
    setBusy(true);
    setNote(null);
    try {
      setSaved(
        await saveSettings({ idleMinutes: idleN, sessionMinutes: sessionN }),
      );
      setNote({
        ok: true,
        text: "Saved. A session already running keeps its end time.",
      });
    } catch (e) {
      setNote({
        ok: false,
        text: e instanceof ChatHttpError ? e.info.message : "Could not save.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Settings</CardTitle>
        <CardDescription>
          Shorter limits save computer time. A sleeping computer keeps its files
          and open apps.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid && changed) void save();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="vm-idle">Sleep after idle (minutes)</Label>
              <Input
                id="vm-idle"
                type="number"
                inputMode="numeric"
                min={1}
                max={saved?.maxIdleMinutes}
                value={idle}
                disabled={!saved}
                onChange={(e) => setIdle(e.target.value)}
              />
              {saved && (
                <p className="text-xs text-muted-foreground">
                  1 to {saved.maxIdleMinutes}. Nobody using it this long puts it
                  to sleep.
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="vm-session">Session length (minutes)</Label>
              <Input
                id="vm-session"
                type="number"
                inputMode="numeric"
                min={1}
                max={saved?.maxSessionMinutes}
                value={session}
                disabled={!saved}
                onChange={(e) => setSession(e.target.value)}
              />
              {saved && (
                <p className="text-xs text-muted-foreground">
                  1 to {saved.maxSessionMinutes}. Each wake-up lasts at most
                  this long.
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={!valid || !changed || busy}>
              {busy && <Loader2Icon className="animate-spin" />}
              Save
            </Button>
            {note && (
              <p
                role={note.ok ? "status" : "alert"}
                className={
                  note.ok
                    ? "text-sm text-muted-foreground"
                    : "text-sm text-destructive"
                }
              >
                {note.text}
              </p>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
