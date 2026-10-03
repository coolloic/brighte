import Link from "next/link";
import { Icon } from "@/components/atoms/Icon";

/**
 * Header link to the chat (/chat), for the public pages. "Chat" on phones, where the header is
 * narrow; "Chat with us" from sm up. On the chat page itself it is marked as the current page.
 */
export function ChatLink({ current = false }: { current?: boolean }) {
  return (
    <Link
      href="/chat"
      aria-current={current ? "page" : undefined}
      className="inline-flex min-h-11 items-center gap-2 rounded-control px-3 font-semibold text-fg-brand transition-[background-color] hover:bg-surface-brand focus-visible:focus-ring aria-[current=page]:bg-surface-brand"
    >
      <Icon name="sparkles" />
      {/* One element: the flex gap would otherwise also open up before " with us". */}
      <span>
        Chat<span className="hidden sm:inline"> with us</span>
      </span>
    </Link>
  );
}
