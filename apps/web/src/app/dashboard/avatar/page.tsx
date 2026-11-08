"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DEFAULT_EXPRESSION } from "@/features/avatar/bloub/bot/expressions";
import {
  DEFAULT_COLOR,
  DEFAULT_SHAPE,
} from "@/features/avatar/bloub/bot/skins";
import { BloubAvatar } from "@/features/avatar/components/bloub-avatar";
import {
  BloubCustomizer,
  type BloubCustomizerValue,
} from "@/features/avatar/components/bloub-customizer";

const STORAGE_KEY = "k4bloub:avatar";

const DEFAULT_VALUE: BloubCustomizerValue = {
  shape: DEFAULT_SHAPE,
  color: DEFAULT_COLOR,
  expression: DEFAULT_EXPRESSION,
};

export default function AvatarPage() {
  const [value, setValue] = useState<BloubCustomizerValue>(DEFAULT_VALUE);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setValue({ ...DEFAULT_VALUE, ...JSON.parse(raw) });
    } catch {
      // ignore
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch {
      // ignore
    }
  }, [value, loaded]);

  return (
    <>
      <PageHeader title="Avatar" />
      <div className="flex flex-1 flex-col gap-4 p-4 lg:flex-row">
        <div className="flex items-center justify-center lg:w-2/3">
          <BloubAvatar
            size={320}
            shape={value.shape}
            color={value.color}
            expression={value.expression}
            animated
          />
        </div>
        <div className="lg:w-1/3">
          <BloubCustomizer value={value} onChange={setValue} />
        </div>
      </div>
    </>
  );
}
