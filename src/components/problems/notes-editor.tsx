"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { Eye, Pencil, Save, Check, Loader2 } from "lucide-react";
import { Card, Button, Input, Select, Textarea, Label } from "@/components/ui/primitives";
import { saveNote } from "@/lib/actions";
import { LANGUAGES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { CodeBlock } from "@/components/code-block";

const PLACEHOLDER = `## Approach

The trick is…

## Why it works

…

## Gotchas

- Watch out for the empty-input case
`;

type NoteShape = {
  content: string;
  code: string;
  language: string;
  timeComplexity: string | null;
  spaceComplexity: string | null;
  updatedAt: string;
} | null;

export function NotesEditor({
  problemId,
  note,
  defaultLanguage,
}: {
  problemId: string;
  note: NoteShape;
  defaultLanguage: string;
}) {
  const [tab, setTab] = useState<"notes" | "code">("notes");
  const [preview, setPreview] = useState(Boolean(note?.content));
  const [content, setContent] = useState(note?.content ?? "");
  const [code, setCode] = useState(note?.code ?? "");
  const [language, setLanguage] = useState(note?.language ?? defaultLanguage);
  const [tc, setTc] = useState(note?.timeComplexity ?? "");
  const [sc, setSc] = useState(note?.spaceComplexity ?? "");
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = () => {
    startTransition(async () => {
      try {
        await saveNote({
          problemId,
          content,
          code,
          language,
          timeComplexity: tc || null,
          spaceComplexity: sc || null,
        });
        setDirty(false);
        setSaved(true);
        if (savedTimer.current) clearTimeout(savedTimer.current);
        savedTimer.current = setTimeout(() => setSaved(false), 2200);
      } catch {
        toast.error("Couldn't save your notes");
      }
    });
  };

  // Ctrl/Cmd+S saves without leaving the keyboard.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (dirty) save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, content, code, language, tc, sc]);

  const touch = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setDirty(true);
    setSaved(false);
  };

  return (
    <Card className="flex min-h-[32rem] flex-col">
      <div className="flex items-center gap-1 border-b border-[var(--border)] px-3 py-2">
        <Tab active={tab === "notes"} onClick={() => setTab("notes")}>
          Notes
        </Tab>
        <Tab active={tab === "code"} onClick={() => setTab("code")}>
          Solution
          {code.trim() && <span className="ml-1 text-[var(--easy)]">•</span>}
        </Tab>

        <div className="flex-1" />

        {tab === "notes" && (
          <Button variant="ghost" size="sm" onClick={() => setPreview((p) => !p)}>
            {preview ? <Pencil className="size-3.5" /> : <Eye className="size-3.5" />}
            {preview ? "Edit" : "Preview"}
          </Button>
        )}

        <Button
          variant={dirty ? "primary" : "ghost"}
          size="sm"
          onClick={save}
          disabled={!dirty || isPending}
        >
          {isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : saved ? (
            <Check className="size-3.5" />
          ) : (
            <Save className="size-3.5" />
          )}
          {isPending ? "Saving" : saved ? "Saved" : dirty ? "Save" : "Saved"}
        </Button>
      </div>

      {tab === "notes" ? (
        <div className="flex-1 p-4">
          {preview ? (
            content.trim() ? (
              <div className="prose-notes">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({ className, children, ...props }) {
                      const lang = /language-(\w+)/.exec(className ?? "")?.[1];
                      const text = String(children).replace(/\n$/, "");
                      if (!lang) {
                        return (
                          <code className={className} {...props}>
                            {children}
                          </code>
                        );
                      }
                      return <CodeBlock code={text} language={lang} />;
                    },
                  }}
                >
                  {content}
                </ReactMarkdown>
              </div>
            ) : (
              <button
                onClick={() => setPreview(false)}
                className="flex h-full w-full items-center justify-center rounded-lg border border-dashed border-[var(--border)] text-sm text-[var(--fg-subtle)] transition-colors hover:border-[var(--accent)] hover:text-[var(--fg-muted)]"
              >
                No notes yet — click to write your approach
              </button>
            )
          ) : (
            <Textarea
              value={content}
              onChange={(e) => touch(setContent)(e.target.value)}
              placeholder={PLACEHOLDER}
              className="h-full min-h-[26rem] resize-none font-[inherit] text-[0.9375rem] leading-relaxed"
              spellCheck
            />
          )}
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-3 p-4">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label htmlFor="lang">Language</Label>
              <Select
                id="lang"
                className="mt-1"
                value={language}
                onChange={(e) => touch(setLanguage)(e.target.value)}
              >
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="tc">Time</Label>
              <Input
                id="tc"
                className="mt-1 font-mono text-[0.8125rem]"
                value={tc}
                onChange={(e) => touch(setTc)(e.target.value)}
                placeholder="O(n log n)"
              />
            </div>
            <div>
              <Label htmlFor="sc">Space</Label>
              <Input
                id="sc"
                className="mt-1 font-mono text-[0.8125rem]"
                value={sc}
                onChange={(e) => touch(setSc)(e.target.value)}
                placeholder="O(1)"
              />
            </div>
          </div>

          <Textarea
            value={code}
            onChange={(e) => touch(setCode)(e.target.value)}
            placeholder={`# Paste the solution you want to remember\n\ndef solve(nums):\n    ...`}
            className="min-h-[20rem] flex-1 resize-none font-mono text-[0.8125rem] leading-relaxed"
            spellCheck={false}
            onKeyDown={(e) => {
              // Tab should indent, not escape the field.
              if (e.key !== "Tab") return;
              e.preventDefault();
              const el = e.currentTarget;
              const { selectionStart: s, selectionEnd: en } = el;
              const next = `${code.slice(0, s)}    ${code.slice(en)}`;
              touch(setCode)(next);
              requestAnimationFrame(() => el.setSelectionRange(s + 4, s + 4));
            }}
          />

          {code.trim() && (
            <details className="rounded-lg border border-[var(--border)]">
              <summary className="cursor-pointer px-3 py-2 text-[0.8125rem] font-medium text-[var(--fg-muted)] hover:text-[var(--fg)]">
                Highlighted preview
              </summary>
              <div className="border-t border-[var(--border)] p-3">
                <CodeBlock code={code} language={language} />
              </div>
            </details>
          )}
        </div>
      )}
    </Card>
  );
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-lg px-3 py-1.5 text-[0.8125rem] font-medium transition-colors",
        active
          ? "bg-[var(--surface-2)] text-[var(--fg)]"
          : "text-[var(--fg-muted)] hover:text-[var(--fg)]",
      )}
    >
      {children}
    </button>
  );
}
