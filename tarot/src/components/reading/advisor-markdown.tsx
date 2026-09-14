"use client";

import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { prepareAdvisorMarkdown } from "@/lib/prepare-advisor-markdown";
import { cn } from "@/lib/utils";

const components: Components = {
  p: ({ children }) => (
    <p className="mb-2 last:mb-0 leading-relaxed text-foreground/95">{children}</p>
  ),
  h1: ({ children }) => (
    <h3 className="mb-1.5 mt-3 first:mt-0 text-sm font-semibold tracking-wide text-amber-200/90">
      {children}
    </h3>
  ),
  h2: ({ children }) => (
    <h3 className="mb-1.5 mt-3 first:mt-0 text-sm font-semibold tracking-wide text-amber-200/90">
      {children}
    </h3>
  ),
  h3: ({ children }) => (
    <h4 className="mb-1 mt-2.5 first:mt-0 text-sm font-medium text-amber-100/85">
      {children}
    </h4>
  ),
  ul: ({ children }) => (
    <ul className="mb-2 list-disc space-y-1 pl-4 last:mb-0 marker:text-amber-400/70">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-2 list-decimal space-y-1 pl-4 last:mb-0 marker:text-amber-400/70">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="leading-relaxed text-foreground/95">{children}</li>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-primary">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-amber-100/80">{children}</em>
  ),
  a: ({ href, children }) => {
    if (!href || href.startsWith("javascript:")) {
      return <span className="text-primary/90">{children}</span>;
    }
    const safe =
      href.startsWith("http://") ||
      href.startsWith("https://") ||
      href.startsWith("mailto:");
    if (!safe) {
      return <span className="text-primary/90">{children}</span>;
    }
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline-offset-2 hover:underline"
      >
        {children}
      </a>
    );
  },
  hr: () => <hr className="my-2 border-amber-500/20" />,
  blockquote: ({ children }) => (
    <blockquote className="mb-2 border-l-2 border-amber-500/35 pl-2.5 text-foreground/80 last:mb-0">
      {children}
    </blockquote>
  ),
  code: ({ children }) => (
    <code className="rounded bg-amber-500/10 px-1 py-0.5 text-[0.9em] text-amber-100/90">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="mb-2 overflow-x-auto rounded-md border border-amber-500/20 bg-card/40 p-2 text-xs last:mb-0">
      {children}
    </pre>
  ),
};

const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), "strong", "em"],
};

type AdvisorMarkdownProps = {
  children: string;
  className?: string;
};

/** Candle-themed Markdown for advisor (assistant) chat bubbles. */
export function AdvisorMarkdown({ children, className }: AdvisorMarkdownProps) {
  const prepared = prepareAdvisorMarkdown(children);
  return (
    <div className={cn("advisor-md text-sm leading-relaxed", className)}>
      <ReactMarkdown
        components={components}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema]]}
      >
        {prepared}
      </ReactMarkdown>
    </div>
  );
}
