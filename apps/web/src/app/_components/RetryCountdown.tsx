"use client";

import { useEffect, useState } from "react";
import { formatWait } from "@/lib/api/registration-feedback";

/**
 * "Please wait 53 seconds and try again", ticking down every second, then "You can try again now."
 * It sits in a status message, which screen readers re-read whenever its text changes, so they get
 * the starting wait once instead of every tick, and hear when the wait is over.
 */
export function RetryCountdown({ seconds }: { seconds: number }) {
  const [left, setLeft] = useState(seconds);

  useEffect(() => {
    const end = Date.now() + seconds * 1000;
    const timer = setInterval(() => {
      const next = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setLeft(next);
      if (next === 0) clearInterval(timer);
    }, 250);
    return () => clearInterval(timer);
  }, [seconds]);

  if (left === 0) return <>You can try again now.</>;
  return (
    <>
      <span aria-hidden="true" data-countdown>
        Please wait {formatWait(left)} and try again.
      </span>
      <span className="sr-only">Please wait {formatWait(seconds)} and try again.</span>
    </>
  );
}
