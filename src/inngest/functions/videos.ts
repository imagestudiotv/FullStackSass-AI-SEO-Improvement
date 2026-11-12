
/**
 * Videos (docs/videos.md):
 *  - video-ideas-daily: every morning, each ready website with a plan gets
 *    its day's ideas (the Videos page also asks for them when opened);
 *  - suggest-video-ideas: one website's ideas, topped up to the day's 20;
 *  - make-video: an approved idea - voice, render, stored - ready;
 *  - publish-video: a ready video, published at its time and followed until
 *    the platforms have it;
 *  - video-followup-daily: the posted videos' numbers, the 1,000-views
 *    email, and old files deleted.
 */

export { suggestVideoIdeasJob, videoIdeasDaily } from "./videos-ideas";
export { makeVideo } from "./videos-make";
export { publishVideoJob, videoFollowupDaily } from "./videos-publish";
