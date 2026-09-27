import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb, type TestDb } from "@/test/db";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));

/**
 * A key for the encryption helper. Not a real secret: this is the value
 * lib/crypto.ts derives from, and it must exist before that module is imported.
 */
process.env.CREDENTIALS_ENCRYPTION_KEY =
  "test-only-encryption-key-not-a-real-secret";

import { encryptSecret } from "@/lib/crypto";
import { integrations, organization, websites } from "@/lib/db/schema";

import {
  loadCredentialsById,
  resolveIntegration,
} from "./credentials";

/**
 * Issue 12: decrypted credentials must not appear in persisted job data.
 *
 * The publish job's first step used to return `credentials`, and Inngest
 * persists every step's return value so a retry can resume from it. A
 * customer's WordPress application password therefore ended up in durable job
 * state and in the Inngest dashboard.
 *
 * These tests pin the two halves of the fix: the resolver hands back
 * identifiers only, and the plaintext is reachable solely through an explicit
 * by-id call that a step makes for itself.
 */

let test: TestDb;

const ORG = "org_creds";
/** Distinctive, so a substring search over serialized data is meaningful. */
const PASSWORD = "wp-app-password-SHOULD-NEVER-BE-PERSISTED-9f3a";

let websiteId: string;
let integrationId: string;

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(async () => {
  await test.client.exec(`
    delete from integrations;
    delete from websites;
    delete from organization;
  `);
  await test.db
    .insert(organization)
    .values({ id: ORG, name: "Org", slug: "org-creds", createdAt: new Date() });

  const [site] = await test.db
    .insert(websites)
    .values({ organizationId: ORG, domain: "wp.example", url: "https://wp.example" })
    .returning({ id: websites.id });
  websiteId = site.id;

  const [row] = await test.db
    .insert(integrations)
    .values({
      websiteId,
      kind: "wordpress",
      status: "connected",
      verifiedAt: new Date(),
      // Stored exactly as the app stores it: secret fields encrypted
      // individually inside a jsonb object.
      credentials: {
        siteUrl: "https://wp.example",
        username: "editor",
        applicationPassword: encryptSecret(PASSWORD),
      },
    })
    .returning({ id: integrations.id });
  integrationId = row.id;
});

describe("resolveIntegration", () => {
  it("returns identifiers and NOTHING else", async () => {
    const resolved = await resolveIntegration(websiteId);

    expect(resolved).toEqual({
      integrationId,
      providerId: "wordpress",
    });
    // Belt and braces: the key must be absent, not merely undefined-valued.
    expect(Object.keys(resolved ?? {})).not.toContain("credentials");
  });

  /**
   * THE ASSERTION THAT WOULD HAVE CAUGHT THE ORIGINAL BUG.
   *
   * Inngest serializes a step's return value to JSON to persist it. Serializing
   * what the step now returns must not contain the plaintext anywhere.
   */
  it("serializes without the secret, the way a step result is persisted", async () => {
    const resolved = await resolveIntegration(websiteId);
    const persisted = JSON.stringify(resolved);

    expect(persisted).not.toContain(PASSWORD);
    expect(persisted).not.toContain("applicationPassword");
    // The identifiers we do rely on survive.
    expect(persisted).toContain(integrationId);
  });

  it("returns null when nothing is connected", async () => {
    await test.client.exec("delete from integrations");
    expect(await resolveIntegration(websiteId)).toBeNull();
  });
});

describe("loadCredentialsById", () => {
  it("decrypts for the step that actually sends the request", async () => {
    const loaded = await loadCredentialsById(integrationId);

    expect(loaded?.providerId).toBe("wordpress");
    expect(loaded?.credentials.applicationPassword).toBe(PASSWORD);
    expect(loaded?.credentials.username).toBe("editor");
  });

  it("refuses an integration that is no longer connected", async () => {
    await test.client.exec(
      "update integrations set status = 'disconnected'",
    );
    // "Reconnect", not "retry": a disconnected row will not heal by itself.
    expect(await loadCredentialsById(integrationId)).toBeNull();
  });

  it("returns null for an unknown id rather than throwing", async () => {
    expect(
      await loadCredentialsById("00000000-0000-0000-0000-000000000000"),
    ).toBeNull();
  });

  /**
   * Retries must pick up a rotated credential. A value captured in a step
   * result would keep retrying with the stale secret until the attempts ran
   * out; loading per attempt is what makes rotation mid-retry work.
   */
  it("reads the current secret, so a rotation between attempts is used", async () => {
    const rotated = "rotated-password-7c21";
    await test.db
      .update(integrations)
      .set({
        credentials: {
          siteUrl: "https://wp.example",
          username: "editor",
          applicationPassword: encryptSecret(rotated),
        },
      });

    const loaded = await loadCredentialsById(integrationId);
    expect(loaded?.credentials.applicationPassword).toBe(rotated);
  });
});
