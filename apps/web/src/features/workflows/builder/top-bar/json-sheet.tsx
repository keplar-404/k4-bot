"use client";

import { BracesIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JsonExport } from "./json-export";
import { JsonImport } from "./json-import";

/** The top bar's JSON button: copy or download this workflow as a file, or replace it with one. */
export function JsonSheet() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <BracesIcon />
        JSON
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full gap-0 sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Workflow JSON</SheetTitle>
            <SheetDescription>
              Share this workflow as a file, or load one someone shared.
            </SheetDescription>
          </SheetHeader>
          <Tabs
            defaultValue="export"
            className="min-h-0 flex-1 gap-3 px-4 pb-4"
          >
            <TabsList variant="line">
              <TabsTrigger value="export">Copy / download</TabsTrigger>
              <TabsTrigger value="import">Import</TabsTrigger>
            </TabsList>
            <TabsContent value="export" className="flex min-h-0 flex-col">
              <JsonExport />
            </TabsContent>
            <TabsContent value="import" className="flex min-h-0 flex-col">
              <JsonImport onDone={() => setOpen(false)} />
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>
    </>
  );
}
