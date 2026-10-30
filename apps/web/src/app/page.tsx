import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-col items-center gap-6">
        <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
          K4 Bot
        </h1>
        <Link href="/dashboard" className={cn(buttonVariants())}>
          Go to Dashboard
        </Link>
      </main>
    </div>
  );
}