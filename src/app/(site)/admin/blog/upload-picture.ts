import { finishBlogImageUpload, startBlogImageUpload } from "@/lib/admin/blog";

/**
 * Uploads one picture to the blog's library from the browser, as one of a
 * language's pictures (null: the blog folder, as before languages), and
 * returns its address.
 *
 * Sent straight to storage on a signed address (lib/admin/blog.ts
 * startBlogImageUpload), not through a server action: an action's request
 * body is limited to 1 MB, so a photo above that used to fail although the
 * limit said 8 MB. The server then checks the file that arrived before the
 * library has it (finishBlogImageUpload). Never throws: every failure is a
 * sentence to show.
 */
export async function uploadBlogPicture(file: File, language: string | null): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const failed = { ok: false as const, error: "The picture could not be uploaded. Check the connection and try again." };
  try {
    const started = await startBlogImageUpload({ type: file.type, size: file.size });
    if (!started.ok) return started;
    const sent = await fetch(started.data.signedUrl, { method: "PUT", headers: { "content-type": file.type }, body: file });
    if (!sent.ok) {
      console.error("[admin/blog] storage refused the picture", sent.status);
      return failed;
    }
    const finished = await finishBlogImageUpload({ upload: started.data.upload, name: file.name, locale: language });
    return finished.ok ? { ok: true, url: finished.data.url } : finished;
  } catch (error) {
    console.error("[admin/blog] image upload failed", error);
    return failed;
  }
}
