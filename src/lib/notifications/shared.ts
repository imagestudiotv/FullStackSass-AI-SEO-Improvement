/**
 * Types shared between the notification actions and the bell component.
 *
 * Kept out of actions.ts because that file carries "use server", where every
 * export must be an async function — a type exported from there is a build
 * error.
 */

export type NotificationView = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: Date | null;
  createdAt: Date;
};
