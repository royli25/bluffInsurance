"use client";
import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";

/** Refresh server-rendered policy state only while the page is visible. */
export default function AutoRefresh({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    if (!enabled) return;
    const refresh = () => {
      if (!document.hidden && !pending) startTransition(() => router.refresh());
    };
    const timer = setInterval(refresh, 4000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [enabled, pending, router]);
  return null;
}
