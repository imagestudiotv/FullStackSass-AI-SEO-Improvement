"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "./select";

/**
 * The app's dropdown, written like a native <select>.
 *
 * Every dropdown in RepGet looks like this one (client, 2026-11-03: "All
 * check box styles are like the previous language checkbox style so please
 * change all"). The native list was drawn by the operating system: white in
 * night mode with the page's light text on it, unreadable, and never matching
 * the rest of the app in either theme.
 *
 * Takes the same props and the same <option>/<optgroup> children as <select>,
 * so a page changes its tag and nothing else:
 *  - value + onChange (controlled) or defaultValue (uncontrolled);
 *  - onChange receives { target: { value, name } }, as a change event would;
 *  - `name` submits the value with its form, through a hidden input - so the
 *    server actions reading FormData see exactly what the native one sent;
 *  - an option whose value is "" works (Radix refuses empty item values, so
 *    it is carried under a private stand-in and given back as "").
 */

const EMPTY = "__repget_empty__";
const toItem = (value: string) => (value === "" ? EMPTY : value);
const fromItem = (value: string) => (value === EMPTY ? "" : value);

type Option = { kind: "option"; value: string; label: React.ReactNode; disabled: boolean };
type Group = { kind: "group"; label: string; options: Option[] };

function textOf(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) return textOf(node.props.children);
  return "";
}

/** <option> and <optgroup> elements, through arrays (.map) and fragments, in order. */
function readOptions(children: React.ReactNode): Array<Option | Group> {
  const out: Array<Option | Group> = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    if (child.type === React.Fragment) {
      out.push(...readOptions((child.props as { children?: React.ReactNode }).children));
      return;
    }
    if (child.type === "option") {
      const props = child.props as React.OptionHTMLAttributes<HTMLOptionElement>;
      out.push({
        kind: "option",
        value: props.value === undefined ? textOf(props.children) : String(props.value),
        label: props.children,
        disabled: Boolean(props.disabled),
      });
    } else if (child.type === "optgroup") {
      const props = child.props as React.OptgroupHTMLAttributes<HTMLOptGroupElement>;
      out.push({
        kind: "group",
        label: String(props.label ?? ""),
        options: readOptions(props.children).flatMap((o) => (o.kind === "option" ? [o] : o.options)),
      });
    }
  });
  return out;
}

export type NativeLikeChange = {
  target: { value: string; name: string };
  currentTarget: { value: string; name: string };
};

export type NativeLikeSelectProps = {
  id?: string;
  name?: string;
  form?: string;
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (event: NativeLikeChange) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  /** Classes for the open list. */
  contentClassName?: string;
  size?: "sm" | "default";
  placeholder?: React.ReactNode;
  title?: string;
  children: React.ReactNode;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
  "aria-required"?: boolean | "true" | "false";
};

export function NativeLikeSelect({
  id,
  name,
  form,
  value,
  defaultValue,
  onChange,
  disabled,
  required,
  className,
  contentClassName,
  size = "default",
  placeholder,
  title,
  children,
  ...aria
}: NativeLikeSelectProps) {
  const all = readOptions(children);
  const allFlat = all.flatMap((o) => (o.kind === "option" ? [o] : o.options));
  // Like a native select with no value given: the first option is chosen.
  const [inner, setInner] = React.useState(() =>
    defaultValue !== undefined ? String(defaultValue) : (allFlat.find((o) => !o.disabled)?.value ?? ""),
  );
  const current = value !== undefined ? String(value) : inner;

  /*
    <option value="" disabled>Choose…</option> is how a native select says
    "nothing chosen yet". Here it is the placeholder, in the muted colour,
    rather than a dead row in the list.
  */
  const prompt = all.find((o): o is Option => o.kind === "option" && o.value === "" && o.disabled);
  const options = prompt ? all.filter((o) => o !== prompt) : all;
  const flat = options.flatMap((o) => (o.kind === "option" ? [o] : o.options));
  const selected = flat.find((o) => o.value === current);

  function change(next: string) {
    const v = fromItem(next);
    if (value === undefined) setInner(v);
    const target = { value: v, name: name ?? "" };
    onChange?.({ target, currentTarget: target });
  }

  const item = (o: Option) => (
    <SelectItem key={o.value} value={toItem(o.value)} disabled={o.disabled}>
      {o.label}
    </SelectItem>
  );

  return (
    <>
      <Select value={selected ? toItem(current) : ""} onValueChange={change} disabled={disabled}>
        <SelectTrigger id={id} size={size} title={title} className={cn("w-full min-w-0", className)} {...aria}>
          {/*
            The chosen label is written out rather than left to Radix, which
            only learns it once the list has mounted in the browser: the page
            as first sent showed an empty box until it loaded.
          */}
          <SelectValue placeholder={placeholder ?? prompt?.label}>{selected ? selected.label : undefined}</SelectValue>
        </SelectTrigger>
        <SelectContent position="popper" className={cn("min-w-(--radix-select-trigger-width)", contentClassName)}>
          {options.map((o) =>
            o.kind === "option" ? (
              item(o)
            ) : (
              <SelectGroup key={`group:${o.label}`}>
                <SelectLabel>{o.label}</SelectLabel>
                {o.options.map(item)}
              </SelectGroup>
            ),
          )}
        </SelectContent>
      </Select>
      {name ? (
        required ? (
          /* Visible to the browser's form validation, not to anyone looking: a required choice still blocks submit. */
          <input
            tabIndex={-1}
            aria-hidden="true"
            className="pointer-events-none absolute size-px opacity-0"
            name={name}
            form={form}
            value={current}
            required
            disabled={disabled}
            onChange={() => {}}
          />
        ) : (
          <input type="hidden" name={name} form={form} value={current} disabled={disabled} />
        )
      ) : null}
    </>
  );
}
