"use client";

import { cva } from "class-variance-authority";
import { createContext, useContext, type ReactNode } from "react";
import { FileChip, type FileChipProps } from "@/components/atoms/FileChip";
import { Icon } from "@/components/atoms/Icon";
import { Markdown, type MarkdownBlocks } from "@/components/atoms/Markdown";
import { Skeleton } from "@/components/atoms/Skeleton";
import { CoverLetter } from "@/components/molecules/CoverLetter";
import { CvButtons } from "@/components/molecules/CvButtons";
import { MatchReport } from "@/components/molecules/MatchReport";
import { ProfilePreview } from "@/components/molecules/ProfilePreview";
import { TailoredCv } from "@/components/molecules/TailoredCv";
import {
  COVER_LETTER_BLOCK,
  MATCH_BLOCK,
  parseCoverLetterBlock,
  parseMatchBlock,
  parseProfileBlock,
  parseTailoredBlock,
  PROFILE_BLOCK,
  TAILORED_BLOCK,
  tailorCv,
  type CoverLetterBlock,
  type MatchBlock,
  type Profile,
  type TailoredBlock,
} from "@/lib/chat";
import { cn } from "@/lib/cn";
import type { CvActions } from "@/lib/cv-pdf";

const bubbleVariants = cva("max-w-[85%] rounded-card px-4 py-2.5 break-words shadow-bubble sm:max-w-[75%]", {
  variants: {
    // The visitor's messages on the right in brand green; the assistant's on the left in grey, with a
    // "tail" corner pointing at the sender, as in messaging apps.
    from: {
      // The visitor's text as typed (line breaks kept); the assistant's replies are Markdown.
      user: "rounded-br-control whitespace-pre-wrap bg-bubble-own text-on-bubble-own",
      assistant: "rounded-bl-control border border-border bg-surface-muted text-fg",
    },
  },
});

export type ChatBubbleProps = {
  from: "user" | "assistant";
  /** Who sent it, for screen readers ("You", or the assistant's name): the side and color only show it visually. */
  author: string;
  /** The message. An empty assistant message is a reply on its way: it shows a typing indicator. */
  children?: string;
  /** Files sent with the message, shown above its text. */
  attachments?: Pick<FileChipProps, "name" | "kind" | "detail" | "previewSrc">[];
  /** The reply is still arriving: an incomplete component block shows a placeholder, not an error. */
  streaming?: boolean;
  /** Block languages to show collapsed (earlier versions: a newer one follows), e.g. ["profile"]. */
  collapse?: string[];
  /** The newest valid profile at or before this message: tailored CVs are checked against it, and cover letters take their letterhead from it. */
  referenceProfile?: Profile;
  /** A newer profile came after the reference one: tailored CVs here ask to be redone. */
  profileChanged?: boolean;
  /** The chat page's CV file actions: preview, download, save. */
  cvActions?: CvActions;
  className?: string;
};

/** What a bubble's blocks need to know: set per bubble, read by the module-level block renderers. */
type BlockContextValue = { streaming: boolean; collapse: readonly string[]; referenceProfile?: Profile; profileChanged?: boolean; cvActions?: CvActions };
const BlockContext = createContext<BlockContextValue>({ streaming: false, collapse: [] });

/** How a component block shows: its parser, its view, and what to say while it streams, when it fails, and when collapsed. */
type BlockSpec<T> = {
  language: string;
  parse: (code: string) => T | undefined;
  render: (value: T, context: BlockContextValue) => ReactNode;
  preparing: string;
  /** Usually a reply cut off by the length cap: the stream ends normally, so nothing else says so. */
  failed: string;
  /** The summary of an earlier, collapsed version. */
  earlier?: string;
};

const MATCH: BlockSpec<MatchBlock> = {
  language: MATCH_BLOCK,
  parse: parseMatchBlock,
  render: (report) => <MatchReport {...report} />,
  preparing: "Preparing match report…",
  failed: "This match report couldn't be shown. It may have been cut off: ask me to try again, or to check fewer requirements.",
};

const PROFILE: BlockSpec<Profile> = {
  language: PROFILE_BLOCK,
  parse: parseProfileBlock,
  render: (profile, { cvActions }) => (
    <ProfilePreview
      {...profile}
      actions={
        cvActions && (
          <CvButtons
            onDownload={() => cvActions.downloadPdf({ profile })}
            onPreview={() => cvActions.previewPdf({ profile })}
            onSave={() => cvActions.saveProfile(profile)}
            onSaveToMyData={cvActions.saveToMyData && (() => cvActions.saveToMyData!({ profile }))}
          />
        )
      }
    />
  ),
  preparing: "Preparing your profile…",
  failed: "This profile couldn't be shown. It may have been cut off: ask me to try again.",
  earlier: "Earlier version of your profile",
};

const TAILORED: BlockSpec<TailoredBlock> = {
  language: TAILORED_BLOCK,
  parse: parseTailoredBlock,
  render: (block, { referenceProfile, profileChanged, cvActions }) => {
    if (!referenceProfile) {
      return <p className="my-2 rounded-control border border-border bg-surface px-3 py-2 text-sm">This tailored CV needs your profile: ask me to read your CV first.</p>;
    }
    const result = tailorCv(referenceProfile, block, { profileChanged });
    const blocking = result.flags.filter((flag) => flag.level === "blocking").length;
    const source = { profile: referenceProfile, tailored: block };
    return (
      <TailoredCv
        job={block.job}
        {...result}
        actions={
          cvActions && (
            <CvButtons
              onDownload={() => cvActions.downloadPdf(source)}
              onPreview={() => cvActions.previewPdf(source)}
              onSaveToMyData={cvActions.saveToMyData && (() => cvActions.saveToMyData!(source))}
              disabledReason={blocking === 0 ? undefined : blocking === 1 ? "Fix 1 thing before downloading" : `Fix ${blocking} things before downloading`}
            />
          )
        }
      />
    );
  },
  preparing: "Preparing your tailored CV…",
  failed: "This tailored CV couldn't be shown. It may have been cut off: ask me to try again.",
  earlier: "Earlier version of your tailored CV",
};

const COVER_LETTER: BlockSpec<CoverLetterBlock> = {
  language: COVER_LETTER_BLOCK,
  parse: parseCoverLetterBlock,
  render: (letter, { referenceProfile, cvActions }) => {
    if (!referenceProfile) {
      return <p className="my-2 rounded-control border border-border bg-surface px-3 py-2 text-sm">This cover letter needs your profile: ask me to read your CV first.</p>;
    }
    const source = { profile: referenceProfile, coverLetter: letter };
    return (
      <CoverLetter
        {...letter}
        sender={referenceProfile.basics}
        actions={
          cvActions && (
            <CvButtons
              onDownload={() => cvActions.downloadPdf(source)}
              onPreview={() => cvActions.previewPdf(source)}
              onSaveToMyData={cvActions.saveToMyData && (() => cvActions.saveToMyData!(source))}
            />
          )
        }
      />
    );
  },
  preparing: "Writing your cover letter…",
  failed: "This cover letter couldn't be shown. It may have been cut off: ask me to try again.",
  earlier: "Earlier version of your cover letter",
};

/**
 * A reply's component block. Its JSON is judged by whether it parses: an open fence runs to the end
 * of the text, so a half-received block looks like a whole one. An earlier version shows collapsed.
 */
function BlockView<T>({ code, spec }: { code: string; spec: BlockSpec<T> }) {
  const context = useContext(BlockContext);
  const value = spec.parse(code);
  let view: ReactNode;
  if (value !== undefined) view = spec.render(value, context);
  else if (context.streaming) {
    view = (
      <div role="status" className="my-2 space-y-2 rounded-card border border-border bg-surface p-4">
        <p className="text-sm text-fg-muted">{spec.preparing}</p>
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-2 w-full rounded-full" />
        <Skeleton className="h-4 w-full" />
      </div>
    );
  } else view = <p className="my-2 rounded-control border border-border bg-surface px-3 py-2 text-sm">{spec.failed}</p>;

  if (!spec.earlier || !context.collapse.includes(spec.language)) return view;
  return (
    <details className="group my-2">
      {/* The browser's own marker differs per browser (Safari keeps it): hidden, a chevron instead. */}
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 rounded-control border border-border bg-surface px-3 text-sm font-semibold focus-visible:focus-ring [&::-webkit-details-marker]:hidden">
        {spec.earlier}
        <Icon name="chevron-down" className="size-4 group-open:rotate-180 motion-safe:transition-transform" />
      </summary>
      {view}
    </details>
  );
}

// One module-level map, so Markdown keeps reply blocks mounted while a reply streams in (a new map
// each render would remount them on every chunk). What changes per bubble (streaming, collapsed,
// reference profile) comes through BlockContext instead.
const BLOCKS: MarkdownBlocks = {
  [MATCH_BLOCK]: (code) => <BlockView code={code} spec={MATCH} />,
  [PROFILE_BLOCK]: (code) => <BlockView code={code} spec={PROFILE} />,
  [TAILORED_BLOCK]: (code) => <BlockView code={code} spec={TAILORED} />,
  [COVER_LETTER_BLOCK]: (code) => <BlockView code={code} spec={COVER_LETTER} />,
};

const NO_COLLAPSE: string[] = [];

/**
 * One chat message. The visitor's is plain text with its line breaks; the assistant's is Markdown
 * (lists, tables, code), with no raw HTML.
 */
export function ChatBubble({ from, author, children, attachments = [], streaming = false, collapse = NO_COLLAPSE, referenceProfile, profileChanged = false, cvActions, className }: ChatBubbleProps) {
  const typing = from === "assistant" && !children;
  return (
    <div className={cn("flex items-end gap-2", from === "user" && "justify-end", className)}>
      {from === "assistant" && (
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-brand text-fg-brand">
          <Icon name="sparkles" className="size-4" />
        </span>
      )}
      <div className={bubbleVariants({ from })}>
        <span className="sr-only">{author}: </span>
        {attachments.length > 0 && (
          <ul aria-label="Attached files" className={cn("flex flex-wrap gap-1.5 whitespace-normal", children && "mb-2")}>
            {attachments.map((file, index) => (
              // Names can repeat; the list never reorders.
              <li key={index} className="max-w-full">
                <FileChip {...file} />
              </li>
            ))}
          </ul>
        )}
        {typing ? (
          <span className="flex h-6 items-center gap-1">
            <span className="sr-only">typing</span>
            {/* Classes, not a style attribute: the CSP allows no inline styles. */}
            {["", "[animation-delay:150ms]", "[animation-delay:300ms]"].map((delay) => (
              <span key={delay} aria-hidden="true" className={cn("size-2 animate-bounce rounded-full bg-fg-muted motion-reduce:animate-none", delay)} />
            ))}
          </span>
        ) : from === "assistant" ? (
          <BlockContext value={{ streaming, collapse, referenceProfile, profileChanged, cvActions }}>
            <Markdown blocks={BLOCKS}>{children ?? ""}</Markdown>
          </BlockContext>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
