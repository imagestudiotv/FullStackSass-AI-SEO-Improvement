import { walkthroughWatchUrl } from "@/lib/marketing/walkthrough";

import { AutoVideo } from "../auto-video";
import styles from "../home.module.css";
import type { SectionProps } from "../types";
import own from "./story.module.css";

/**
 * The two-minute walkthrough. The hero's "watch" link scrolls here, so the id
 * is the design's and must not change.
 *
 * The title and subtitle are the old homepage's (m.home), already translated;
 * only the eyebrow, caption and muted hint are new. "Watch on YouTube" stays
 * for a browser that blocks the embed and for the page without JavaScript,
 * where the play button cannot work.
 */
export function VideoSection({ c, m, locale }: SectionProps) {
  return (
    <section id="repget-demo-video" className={styles.video} aria-labelledby="repget-demo-video-title">
      <div className={styles.videoInner}>
        <header className={`${own.videoHead} ${styles.reveal}`} data-reveal>
          <span className={styles.kicker}>{c.video.eyebrow}</span>
          <h2 id="repget-demo-video-title" className={styles.sectionTitle}>
            {m.home.videoTitle}
          </h2>
          <p className={styles.sectionSub}>{m.home.videoSub}</p>
        </header>

        <div className={`${styles.videoFrame} ${styles.reveal}`} data-reveal data-delay="1">
          <AutoVideo
            playLabel={m.home.videoPlay}
            frameTitle={m.home.videoFrameTitle}
            mutedHint={c.video.mutedHint}
            lang={locale}
          />
        </div>

        <div className={styles.videoCaption}>
          <span>{c.video.caption}</span>
          <a href={walkthroughWatchUrl()} target="_blank" rel="noopener" className={own.focusRing}>
            {m.home.videoWatchOnYouTube} <span aria-hidden="true">↗</span>
            <span className={styles.srOnly}> {m.home.opensInNewTab}</span>
          </a>
        </div>
      </div>
    </section>
  );
}
