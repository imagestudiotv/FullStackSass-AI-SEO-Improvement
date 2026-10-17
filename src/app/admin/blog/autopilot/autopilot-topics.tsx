"use client";

import { ArrowDown, ArrowUp, ListPlus, PenLine, Pencil, Plus, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  addBlogAutopilotTopics,
  deleteBlogAutopilotTopic,
  moveBlogAutopilotTopic,
  retryBlogAutopilotTopic,
  saveBlogAutopilotTopic,
  writeBlogAutopilotNow,
  type AdminAutopilotTopic,
} from "@/lib/admin/blog-autopilot";

import { ConfirmDialog } from "../confirm-dialog";
import { AdminStatus } from "../../_ui/status";

type Result = { ok: true } | { ok: false; error: string };

/** One line of a pasted list: "topic" or "topic | search phrase". */
export function parseTopicLines(text: string): { topic: string; keyword: string }[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [topic, ...rest] = line.split("|");
      return { topic: topic.trim(), keyword: rest.join("|").trim() };
    });
}

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  function run(action: () => Promise<Result>, done?: string, after?: () => void) {
    start(async () => {
      const result = await action().catch(() => null);
      if (!result) {
        toast.error("The server did not finish this. Try again.");
        return;
      }
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (done) toast.success(done);
      after?.();
      router.refresh();
    });
  }
  return { pending, run };
}

/** While an article is being written, the page looks again every 20 seconds, so the draft shows up by itself. */
function RefreshWhileWriting() {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), 20_000);
    return () => clearInterval(timer);
  }, [router]);
  return null;
}

/** Writes the first topic in the list now, as a draft, without waiting for the day's hour. */
function WriteNow({ next, busy }: { next: AdminAutopilotTopic | undefined; busy: boolean }) {
  const { pending, run } = useRun();
  return (
    <Button
      size="sm"
      disabled={pending || busy || !next}
      title={busy ? "An article is being written" : next ? `Writes "${next.topic}" now` : "Add a topic first"}
      onClick={() =>
        run(
          writeBlogAutopilotNow,
          "Writing started. The draft appears here in about 10 minutes.",
        )
      }
    >
      <PenLine aria-hidden />
      {pending ? "Starting…" : "Write the next one now"}
    </Button>
  );
}

/** The topics: what is next, in order, then what could not be written and what has been. */
export function AutopilotTopics({
  queued,
  writing,
  failed,
  written,
}: {
  queued: AdminAutopilotTopic[];
  writing: AdminAutopilotTopic[];
  failed: AdminAutopilotTopic[];
  written: AdminAutopilotTopic[];
}) {
  const id = useId();
  return (
    <section aria-labelledby={`${id}-heading`} className="rounded-xl border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-4 sm:px-5">
        <div className="min-w-60 flex-1">
          <h2 id={`${id}-heading`} className="font-medium">
            Topics
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Written from the top, one a day. When the list is empty, RepGet chooses topics itself from search data, skipping what the blog already
            covers.
          </p>
        </div>
        <WriteNow next={queued[0]} busy={writing.length > 0} />
      </div>
      {writing.length > 0 ? <RefreshWhileWriting /> : null}

      <AddTopics />

      {writing.length > 0 ? (
        <ul className="divide-y border-t">
          {writing.map((topic) => (
            <li key={topic.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
              <TopicText topic={topic} />
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                About 10 minutes; this page updates by itself.
                <AdminStatus tone="info" label="Being written now" />
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="border-t">
        <h3 className="px-4 pt-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase sm:px-5">
          Next up{queued.length > 0 ? ` (${queued.length})` : ""}
        </h3>
        {queued.length === 0 ? (
          <p className="px-4 pt-1 pb-4 text-sm text-muted-foreground sm:px-5">No topics waiting - RepGet will choose the next ones itself.</p>
        ) : (
          <ol className="divide-y">
            {queued.map((topic, index) => (
              <QueuedRow key={topic.id} topic={topic} place={index + 1} first={index === 0} last={index === queued.length - 1} />
            ))}
          </ol>
        )}
      </div>

      {failed.length > 0 ? (
        <div className="border-t">
          <h3 className="px-4 pt-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase sm:px-5">Could not be written</h3>
          <ul className="divide-y">
            {failed.map((topic) => (
              <FailedRow key={topic.id} topic={topic} />
            ))}
          </ul>
        </div>
      ) : null}

      {written.length > 0 ? (
        <div className="border-t">
          <h3 className="px-4 pt-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase sm:px-5">Written</h3>
          <ul className="divide-y">
            {written.map((topic) => (
              <li key={topic.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                <TopicText topic={topic} />
                {topic.post ? (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/admin/blog/${topic.post.id}`}>{topic.post.status === "published" ? "Published - open" : "Draft - review"}</Link>
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">Post deleted</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function TopicText({ topic, place }: { topic: AdminAutopilotTopic; place?: number }) {
  return (
    <div className="min-w-60 flex-1">
      <p className="text-sm font-medium">
        {place ? <span className="mr-2 text-muted-foreground tabular-nums">{place}.</span> : null}
        {topic.topic}
      </p>
      <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {topic.keyword ? <span>Search phrase: {topic.keyword}</span> : null}
        {topic.source === "suggested" ? (
          <span className="inline-flex items-center gap-1">
            <Sparkles className="size-3" aria-hidden="true" />
            Chosen by RepGet
          </span>
        ) : null}
        {topic.notes ? <span className="line-clamp-1 max-w-md">Notes: {topic.notes}</span> : null}
      </p>
    </div>
  );
}

function QueuedRow({ topic, place, first, last }: { topic: AdminAutopilotTopic; place: number; first: boolean; last: boolean }) {
  const { pending, run } = useRun();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  if (editing) {
    return (
      <li className="px-4 py-3 sm:px-5">
        <TopicForm
          initial={topic}
          submitLabel="Save topic"
          pending={pending}
          onCancel={() => setEditing(false)}
          onSubmit={(values) => run(() => saveBlogAutopilotTopic({ id: topic.id, ...values }), "Topic saved", () => setEditing(false))}
        />
      </li>
    );
  }
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
      <TopicText topic={topic} place={place} />
      <div className="flex shrink-0 items-center gap-1">
        <Button variant="ghost" size="icon-sm" disabled={pending || first} onClick={() => run(() => moveBlogAutopilotTopic(topic.id, "up"))} aria-label={`Move "${topic.topic}" up`}>
          <ArrowUp aria-hidden="true" />
        </Button>
        <Button variant="ghost" size="icon-sm" disabled={pending || last} onClick={() => run(() => moveBlogAutopilotTopic(topic.id, "down"))} aria-label={`Move "${topic.topic}" down`}>
          <ArrowDown aria-hidden="true" />
        </Button>
        <Button variant="outline" size="sm" disabled={pending} onClick={() => setEditing(true)}>
          <Pencil aria-hidden="true" />
          Edit
        </Button>
        <Button variant="ghost" size="sm" disabled={pending} onClick={() => setConfirming(true)}>
          <Trash2 aria-hidden="true" />
          Remove
        </Button>
      </div>
      {confirming ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => (open ? null : setConfirming(false))}
          title="Remove this topic?"
          description={`"${topic.topic}" will not be written.`}
          confirmLabel="Remove topic"
          tone="danger"
          pending={pending}
          onConfirm={() => run(() => deleteBlogAutopilotTopic(topic.id), "Topic removed", () => setConfirming(false))}
        />
      ) : null}
    </li>
  );
}

function FailedRow({ topic }: { topic: AdminAutopilotTopic }) {
  const { pending, run } = useRun();
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
      <div className="min-w-60 flex-1">
        <TopicText topic={topic} />
        {topic.error ? <p className="mt-1 text-xs text-danger">{topic.error}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => retryBlogAutopilotTopic(topic.id), "Queued first")}>
          <RotateCcw aria-hidden="true" />
          Try again
        </Button>
        <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => deleteBlogAutopilotTopic(topic.id), "Topic removed")}>
          <Trash2 aria-hidden="true" />
          Remove
        </Button>
      </div>
    </li>
  );
}

type TopicValues = { topic: string; keyword: string; notes: string };

function TopicForm({
  initial,
  submitLabel,
  pending,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<Pick<AdminAutopilotTopic, "topic" | "keyword" | "notes">>;
  submitLabel: string;
  pending: boolean;
  onSubmit: (values: TopicValues) => void;
  onCancel?: () => void;
}) {
  const id = useId();
  const [values, setValues] = useState<TopicValues>({
    topic: initial?.topic ?? "",
    keyword: initial?.keyword ?? "",
    notes: initial?.notes ?? "",
  });
  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(values);
      }}
    >
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
        <div className="space-y-1.5">
          <label htmlFor={`${id}-topic`} className="text-sm font-medium">
            What should the article be about?
          </label>
          <Input
            id={`${id}-topic`}
            value={values.topic}
            maxLength={200}
            placeholder="How a small business can get mentioned by ChatGPT"
            onChange={(event) => setValues({ ...values, topic: event.target.value })}
            required
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${id}-keyword`} className="text-sm font-medium">
            Search phrase <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <Input
            id={`${id}-keyword`}
            value={values.keyword}
            maxLength={150}
            placeholder="get mentioned by chatgpt"
            onChange={(event) => setValues({ ...values, keyword: event.target.value })}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <label htmlFor={`${id}-notes`} className="text-sm font-medium">
          Notes for the writer <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <Textarea
          id={`${id}-notes`}
          value={values.notes}
          maxLength={1000}
          rows={2}
          placeholder="Points to cover, an angle, anything to avoid."
          onChange={(event) => setValues({ ...values, notes: event.target.value })}
        />
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" disabled={pending || values.topic.trim().length < 3}>
          <Plus aria-hidden="true" />
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

/** The add form: one topic with its details, or a pasted list. */
function AddTopics() {
  const { pending, run } = useRun();
  const [pasting, setPasting] = useState(false);
  const [list, setList] = useState("");
  const [formKey, setFormKey] = useState(0);
  const id = useId();
  const lines = parseTopicLines(list);

  const added = (count: number, skipped: string[]) =>
    `${count === 1 ? "1 topic added" : `${count} topics added`}${skipped.length > 0 ? ` - ${skipped.length} already on the list` : ""}`;

  return (
    <div className="space-y-3 px-4 py-4 sm:px-5">
      {pasting ? (
        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            run(
              async () => {
                const result = await addBlogAutopilotTopics({ topics: lines });
                if (result.ok) toast.success(added(result.data.added, result.data.skipped));
                return result;
              },
              undefined,
              () => {
                setList("");
                setPasting(false);
              },
            );
          }}
        >
          <label htmlFor={`${id}-list`} className="text-sm font-medium">
            Paste topics, one per line
          </label>
          <Textarea
            id={`${id}-list`}
            value={list}
            rows={6}
            placeholder={"How to write a service page that ranks | service page seo\nLocal SEO for restaurants"}
            onChange={(event) => setList(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">Add &ldquo;| search phrase&rdquo; after a topic to set the phrase it should rank for. Topics already on the list are skipped.</p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setPasting(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || lines.length === 0}>
              <ListPlus aria-hidden="true" />
              {pending ? "Adding…" : lines.length > 1 ? `Add ${lines.length} topics` : "Add topic"}
            </Button>
          </div>
        </form>
      ) : (
        <>
          <TopicForm
            key={formKey}
            submitLabel="Add topic"
            pending={pending}
            onSubmit={(values) =>
              run(
                async () => {
                  const result = await addBlogAutopilotTopics({ topics: [values] });
                  if (result.ok) {
                    if (result.data.added === 0) return { ok: false as const, error: "That topic is already on the list" };
                    toast.success(added(result.data.added, result.data.skipped));
                  }
                  return result;
                },
                undefined,
                () => setFormKey((key) => key + 1),
              )
            }
          />
          <button type="button" className="text-sm text-primary underline-offset-4 hover:underline" onClick={() => setPasting(true)}>
            Paste several at once
          </button>
        </>
      )}
    </div>
  );
}
