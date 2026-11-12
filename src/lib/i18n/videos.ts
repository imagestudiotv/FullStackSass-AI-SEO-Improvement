import type { Locale } from "@/lib/i18n/config";

/**
 * The Videos page's words (lib/video; client, 2026-10-29). Five languages,
 * formal address, like the rest of the app. {placeholders} are filled with
 * format() (lib/i18n/format.ts); "one|other" pairs with plural().
 */
export type VideosCopy = {
  title: string;
  intro: string;
  tabs: { ideas: string; videos: string; posted: string; settings: string };
  /** The day's progress: "{approved} of {goal} made today". */
  today: string;
  dayComplete: string;
  dayCompleteBody: string;
  newIdeas: string;
  /** On the disabled New ideas button: the day already has its ideas. */
  dayFull: string;
  ideasQueued: string;
  writingIdeas: string;
  writingIdeasBody: string;
  noIdeasLeft: string;
  noIdeasLeftBody: string;
  ideaOf: string;
  reel: string;
  carousel: string;
  styles: { bold: string; numbers: string; story: string };
  styleHelp: { bold: string; numbers: string; story: string };
  skip: string;
  undo: string;
  /** After Undo on a make: not made, credit back. */
  undone: string;
  edit: string;
  /** "Make it · {price}" */
  approve: string;
  approved: string;
  swipeHint: string;
  previewNote: string;
  slide: string;
  // Editing an idea
  editTitle: string;
  hook: string;
  point: string;
  pointTitle: string;
  pointDetail: string;
  stat: string;
  statValue: string;
  statSuffix: string;
  statLabel: string;
  addPoint: string;
  removePoint: string;
  proof: string;
  cta: string;
  caption: string;
  style: string;
  format: string;
  voice: string;
  voiceOff: string;
  music: string;
  musicAuto: string;
  musicNone: string;
  captions: string;
  pictures: string;
  addPicture: string;
  noPictures: string;
  save: string;
  saved: string;
  cancel: string;
  saveAndApprove: string;
  // Your videos
  noVideos: string;
  noVideosBody: string;
  status: {
    approved: string;
    making: string;
    ready: string;
    scheduled: string;
    posting: string;
    posted: string;
    failed: string;
  };
  makingBody: string;
  scheduledFor: string;
  download: string;
  downloadSlide: string;
  publishTo: string;
  publishNow: string;
  publishBest: string;
  publishAt: string;
  schedule: string;
  unschedule: string;
  publishing: string;
  published: string;
  scheduledToast: string;
  retry: string;
  failedBody: string;
  connectFirst: string;
  carouselNote: string;
  // Posted
  noPosted: string;
  views: string;
  likes: string;
  comments: string;
  shares: string;
  totalViews: string;
  open: string;
  statsUpdated: string;
  // Settings
  accounts: string;
  accountsBody: string;
  connect: string;
  connecting: string;
  disconnect: string;
  connected: string;
  paused: string;
  resume: string;
  notConfigured: string;
  defaults: string;
  defaultStyle: string;
  defaultVoice: string;
  musicOn: string;
  captionsOn: string;
  publishMode: string;
  publishManual: string;
  publishManualHelp: string;
  publishAuto: string;
  publishAutoHelp: string;
  platforms: string;
  logo: string;
  logoHelp: string;
  uploadLogo: string;
  removeLogo: string;
  library: string;
  libraryHelp: string;
  upload: string;
  uploading: string;
  remove: string;
  safety: string;
  safetyPoints: string[];
  trialNote: string;
  notice: { connected: string; not_connected: string; connect_failed: string };
  /** The strip above the tabs (client, 2026-11-02): three real numbers. "one|other" where a count decides. */
  meta: { ideas: string; ideasLabel: string; madeLabel: string; credits: string };
  /** Today's ideas by format. */
  filter: { label: string; all: string; reel: string; carousel: string };
  /** Focus mode: the preview and Create only. */
  focus: { on: string; off: string; hint: string };
  /** The panel beside the preview. */
  detail: {
    eyebrow: string;
    carouselSlides: string;
    hook: string;
    concept: string;
    captionMore: string;
    captionLess: string;
    readyFor: string;
    noPlatforms: string;
  };
  /** Your videos: the search, the cards and their dialogs. */
  list: {
    search: string;
    all: string;
    reels: string;
    carousels: string;
    count: string;
    empty: string;
    preview: string;
    publish: string;
    close: string;
    seconds: string;
    slides: string;
  };
  postedEmpty: { ideas: string; videos: string };
  /** The Settings tab's cards (the accounts card keeps accounts/accountsBody). */
  cards: { style: string; styleBody: string; publishing: string; publishingBody: string; brand: string; brandBody: string };
  /** Pinterest's board: the one the social Pins use, chosen on Opportunities. */
  pinterest: { board: string; noBoard: string; chooseBoard: string; shared: string };
  errors: {
    view_only: string;
    no_plan: string;
    not_found: string;
    already_handled: string;
    not_enough_credits: string;
    bad_script: string;
    no_accounts: string;
    no_board: string;
    not_configured: string;
    connect_failed: string;
    bad_file: string;
    too_big: string;
    bad_time: string;
    day_full: string;
    generic: string;
  };
  /** The viral social content additions (2026-11-12). */
  viral: ViralCopy;
};

/**
 * The viral social content words (client, 2026-11-12; the mockup
 * RepGet_Social_Content_Viral_Settings.html). Honest by design: ideas are
 * "trend-inspired", never "currently trending" without data, and nothing
 * promises views.
 */
export type ViralCopy = {
  /** The New ideas menu: ten free ideas a click, three times a day. */
  newIdeas: {
    kinds: Record<"mixed" | "viral" | "website", { title: string; body: string }>;
    /** "Free · {left} of {total} left today" */
    left: string;
    free: string;
    writing: string;
    queued: string;
    busy: string;
    usedUp: string;
    tooSoon: string;
  };
  categories: { all: string; viral: string; educational: string; authority: string; promotional: string };
  categoryHelp: { all: string; viral: string; educational: string; authority: string; promotional: string };
  filters: { label: string; empty: string; emptyBody: string; clear: string };
  browse: { previous: string; next: string; hint: string };
  undoSkip: string;
  viralBadge: string;
  formats: { reel: string; story: string; carousel: string; stories: string };
  directions: { meme: string; footage: string; storytelling: string; text_music: string; voiceover: string; animated: string };
  audio: { voiceover: string; text_music: string };
  narration: { natural: string; warm: string; energetic: string };
  captionStyles: { bold: string; editorial: string; minimal: string };
  music: { auto: string; cinematic: string; upbeat: string; ambient: string; none: string };
  durations: { "15-30": string; "30-45": string; "45-60": string; "60-90": string };
  techniques: {
    curiosity_hooks: string;
    trend_inspired: string;
    myth_busting: string;
    hot_takes: string;
    before_after: string;
    unexpected_facts: string;
    comparisons: string;
    storytelling: string;
  };
  tonePresets: Record<"professional" | "bold" | "playful", { title: string; body: string }>;
  frequencies: { "3_week": string; "5_week": string; "1_day": string; "2_day": string; legacy: string };
  why: { title: string; note: string };
  /** An idea a person should check before automatic posting. "{reasons}" lists why. */
  review: {
    title: string;
    reasons: { unverified_claim: string; controversial: string; sensitive: string };
    what: string;
    note: string;
    approve: string;
    done: string;
    checked: string;
  };
  previewConcept: string;
  noCta: string;
  edit: {
    description: string;
    script: string;
    making: string;
    title: string;
    category: string;
    direction: string;
    audio: string;
    narration: string;
    captionStyle: string;
    musicDirection: string;
    duration: string;
    showHook: string;
    includeCta: string;
    ctaText: string;
    ctaHint: string;
    onlyThis: string;
    onlyThisBody: string;
    audience: string;
    tonePreset: string;
    tone: string;
    avoid: string;
    sameAsBrand: string;
    samePlaceholder: string;
    rewrite: string;
    rewriteHelp: string;
    rewritten: string;
  };
  /** Platform checks; {platform} and {length} are filled in. */
  compat: { title: string; no_story: string; too_long: string; no_carousel: string; other: string };
  draft: { badge: string; body: string };
  destinations: { label: string; status: { pending: string; scheduled: string; posting: string; posted: string; failed: string; skipped: string } };
  nativeAudio: {
    button: string;
    title: string;
    honest: string;
    unavailable: string;
    search: string;
    searchButton: string;
    none: string;
    trending: string;
    use: string;
    current: string;
    remove: string;
    saved: string;
    removed: string;
    /** "Instagram audio: {title} {artist}" */
    chosen: string;
  };
  x: { needsSetup: string; budget: string };
  linkedin: { help: string };
  settings: {
    open: string;
    sidebar: string;
    panes: { strategy: string; audience: string; video: string; publishing: string; safety: string; brand: string };
    save: string;
    reset: string;
    resetTitle: string;
    resetBody: string;
    resetDone: string;
    unsaved: string;
    savedNote: string;
    brandNote: string;
    problems: { no_format: string; cta_too_long: string; profile_too_long: string; bad_value: string };
    strategy: {
      title: string;
      body: string;
      badge: string;
      mix: string;
      mixHelp: string;
      mixBadge: string;
      mixLow: string;
      mixMid: string;
      mixHigh: string;
      viralCount: string;
      otherCount: string;
      goal: string;
      goalBody: string;
      goals: Record<"reach" | "balanced" | "leads", { title: string; body: string }>;
      techniques: string;
      techniquesBody: string;
      trends: string;
      trendsHelp: string;
      disclaimer: string;
    };
    audience: {
      title: string;
      body: string;
      shared: string;
      targetAudience: string;
      topics: string;
      language: string;
      languageHint: string;
      languageAuto: string;
      market: string;
      global: string;
      voice: string;
      voiceBody: string;
      toneNotes: string;
      toneNotesHint: string;
      avoid: string;
      avoidPlaceholder: string;
    };
    video: {
      title: string;
      body: string;
      formats: string;
      formatsBody: string;
      formatNames: { reel: string; story: string; carousel: string };
      audio: string;
      audioBody: string;
      audioModes: Record<"auto" | "voiceover" | "text_music", { title: string; body: string }>;
      duration: string;
      narration: string;
      captions: string;
      captionsHelp: string;
      music: string;
      musicNote: string;
      hook: string;
      hookHelp: string;
      cta: string;
      ctaHelp: string;
      defaultCta: string;
      defaultCtaHint: string;
      defaultCtaPlaceholder: string;
      animated: string;
      animatedBody: string;
    };
    publishing: {
      title: string;
      body: string;
      platformsBody: string;
      modes: Record<"manual" | "draft" | "auto", { title: string; body: string }>;
      autoNote: string;
      frequency: string;
      frequencyHint: string;
    };
    safety: {
      title: string;
      body: string;
      always: string;
      clickbait: string;
      clickbaitHelp: string;
      facts: string;
      factsHelp: string;
      competitors: string;
      competitorsHelp: string;
      controversy: string;
      controversyHelp: string;
      hint: string;
      creative: string;
      creativeBody: string;
      humor: { none: { title: string; body: string }; light: { title: string; body: string }; bold: { title: string; body: string } };
      controversial: string;
      controversialHelp: string;
      language: string;
      languageHelp: string;
      core: string;
    };
  };
  /** Error codes added with the viral content work (the server's VideoError). */
  errors: {
    extra_used_up: string;
    busy: string;
    too_soon: string;
    bad_settings: string;
    bad_profile: string;
    review_required: string;
    x_not_configured: string;
    x_budget: string;
    no_story: string;
    too_long: string;
    no_carousel: string;
    audio_unavailable: string;
  };
};

const viralEn: ViralCopy = {
  newIdeas: {
    kinds: {
      mixed: { title: "New daily ideas", body: "Explore more relevant topics" },
      viral: { title: "Generate viral ideas", body: "Reach-focused hooks and formats" },
      website: { title: "Ideas from your website", body: "Showcase products and services" },
    },
    left: "Free · {left} of {total} left today",
    free: "Each click adds 10 ideas. Ideas are free; only making a video uses credits.",
    writing: "Writing ideas…",
    queued: "Writing 10 new ideas. They appear here in a minute.",
    busy: "New ideas are being written. They appear here in a minute.",
    usedUp: "You have used today's 3 free batches. More ideas arrive tomorrow morning.",
    tooSoon: "Please wait a moment before asking for more ideas.",
  },
  categories: { all: "All ideas", viral: "Viral", educational: "Educational", authority: "Authority", promotional: "Promotional" },
  categoryHelp: {
    all: "Choose the kind of content you want to make",
    viral: "Curiosity-led content built for discovery and shares",
    educational: "Useful tips and answers your customers look for",
    authority: "Your expertise and how you work behind the scenes",
    promotional: "Your products and services, with a clear next step",
  },
  filters: {
    label: "Content type",
    empty: "No ideas match these filters",
    emptyBody: "Try another content type or format, or ask for new ideas.",
    clear: "Clear filters",
  },
  browse: {
    previous: "Previous idea",
    next: "Next idea",
    hint: "‹ › only browse the ideas. Create makes the video; Skip sets the idea aside.",
  },
  undoSkip: "The idea is back.",
  viralBadge: "✦ Viral",
  formats: { reel: "Reel", story: "Story", carousel: "Carousel", stories: "Stories" },
  directions: {
    meme: "Meme",
    footage: "Real footage",
    storytelling: "Storytelling",
    text_music: "Text + music",
    voiceover: "Voiceover",
    animated: "Animated",
  },
  audio: { voiceover: "Voiceover", text_music: "Text + music" },
  narration: { natural: "Natural and conversational", warm: "Warm and cinematic", energetic: "Energetic and upbeat" },
  captionStyles: { bold: "Bold highlighted words", editorial: "Clean editorial subtitles", minimal: "Minimal captions" },
  music: { auto: "Auto-match content", cinematic: "Cinematic", upbeat: "Upbeat", ambient: "Ambient / minimal", none: "No music" },
  durations: { "15-30": "15–30 seconds", "30-45": "30–45 seconds", "45-60": "45–60 seconds", "60-90": "60–90 seconds" },
  techniques: {
    curiosity_hooks: "Curiosity hooks",
    trend_inspired: "Trend-inspired formats",
    myth_busting: "Myth-busting",
    hot_takes: "Hot takes",
    before_after: "Before and after",
    unexpected_facts: "Unexpected facts",
    comparisons: "Comparisons",
    storytelling: "Storytelling",
  },
  tonePresets: {
    professional: { title: "Professional", body: "Clear, refined and confident." },
    bold: { title: "Bold", body: "More energy and stronger openers." },
    playful: { title: "Playful", body: "Witty, informal and engaging." },
  },
  frequencies: {
    "3_week": "3 times per week",
    "5_week": "5 times per week",
    "1_day": "1 post per day",
    "2_day": "2 posts per day",
    legacy: "As videos are made (up to 3 a day)",
  },
  why: { title: "Why this could perform well", note: "A strong idea helps, but nothing guarantees views." },
  review: {
    title: "Needs your check: {reasons}",
    reasons: { unverified_claim: "figures or facts", controversial: "a controversial angle", sensitive: "a sensitive topic" },
    what: "Check these against your own information:",
    note: "This only stops automatic posting. You can still create and publish it yourself.",
    approve: "I checked this",
    done: "Checked. It can now be posted automatically.",
    checked: "Checked by you",
  },
  previewConcept: "Concept preview, muted. Footage, voice and music are chosen when the video is made.",
  noCta: "No call to action",
  edit: {
    description: "Change the idea before it is made. Saving is free; only creating uses credits.",
    script: "Script",
    making: "How it is made",
    title: "Title",
    category: "Content type",
    direction: "Creative direction",
    audio: "Audio",
    narration: "Narration style",
    captionStyle: "Caption style",
    musicDirection: "Music direction",
    duration: "Length",
    showHook: "Show the opening hook on screen",
    includeCta: "Include a call to action",
    ctaText: "Call to action",
    ctaHint: "Leave empty to use the closing line.",
    onlyThis: "Only this video",
    onlyThisBody: "These change this video only. Your business profile and brand voice stay as they are.",
    audience: "Audience",
    tonePreset: "Brand voice",
    tone: "Tone",
    avoid: "Avoid",
    sameAsBrand: "Same as your brand voice",
    samePlaceholder: "Same as your business profile",
    rewrite: "Rewrite with these",
    rewriteHelp: "Rewriting is free: RepGet writes the script again with your choices.",
    rewritten: "Rewritten. The new script is in the idea.",
  },
  compat: {
    title: "Check before publishing",
    no_story: "{platform} takes no Stories from RepGet, so this Story is not sent there.",
    too_long: "{platform} does not take videos of {length}.",
    no_carousel: "{platform} takes no carousels here, so this carousel is not sent there.",
    other: "{platform} cannot take this video.",
  },
  draft: { badge: "Draft", body: "Draft - publish when you are ready." },
  destinations: {
    label: "Where it went",
    status: { pending: "Waiting", scheduled: "Scheduled", posting: "Publishing", posted: "Posted", failed: "Failed", skipped: "Skipped" },
  },
  nativeAudio: {
    button: "Instagram audio",
    title: "Instagram audio",
    honest: "The final mix with Instagram's audio can only be heard on Instagram. Other platforms and the download keep RepGet's licensed music.",
    unavailable: "Instagram's audio is not available for this account yet.",
    search: "Search Instagram's audio",
    searchButton: "Search",
    none: "Nothing found. Try other words.",
    trending: "Trending on Instagram",
    use: "Use",
    current: "Chosen",
    remove: "Remove Instagram audio",
    saved: "Instagram audio chosen for this reel.",
    removed: "Instagram audio removed.",
    chosen: "Instagram audio: {title} {artist}",
  },
  x: {
    needsSetup: "X needs setup: RepGet posts there only once X is configured with a spending limit.",
    budget: "X has reached its spending limit for now. RepGet posts there again when the limit allows.",
  },
  linkedin: { help: "Your profile or a company page." },
  settings: {
    open: "Content settings",
    sidebar: "Preferences",
    panes: {
      strategy: "Content strategy",
      audience: "Audience & topics",
      video: "Video & audio",
      publishing: "Publishing",
      safety: "Brand safety",
      brand: "Brand media",
    },
    save: "Save settings",
    reset: "Reset",
    resetTitle: "Reset to the suggested settings?",
    resetBody: "Strategy, video, publishing and safety go back to RepGet's suggestions. Your accounts, logo, pictures and business profile stay as they are.",
    resetDone: "Settings reset to the suggested defaults.",
    unsaved: "You have unsaved changes.",
    savedNote: "Settings are saved for this website.",
    brandNote: "Your logo and pictures are saved as soon as you upload them.",
    problems: {
      no_format: "Choose at least one format.",
      cta_too_long: "Keep the call to action under 120 characters.",
      profile_too_long: "One of the texts is too long.",
      bad_value: "One of the choices is not valid. Please reload the page.",
    },
    strategy: {
      title: "Content strategy",
      body: "Choose the kind of social content RepGet should suggest and how much of it should be designed for discovery and sharing.",
      badge: "NEW · Viral",
      mix: "Viral content mix",
      mixHelp: "How many of your daily ideas should use shareable hooks, stories and trend-inspired formats.",
      mixBadge: "{value}% viral",
      mixLow: "0% · Business as usual",
      mixMid: "50% · Balanced",
      mixHigh: "100% · Reach-first",
      viralCount: "{count} viral ideas / {total}",
      otherCount: "{count} other ideas",
      goal: "Primary content goal",
      goalBody: "RepGet adapts its suggestions to the outcome you want.",
      goals: {
        reach: { title: "Grow reach", body: "Discoverability, views, shares and curiosity." },
        balanced: { title: "Balanced growth", body: "Useful content, trust and shareability." },
        leads: { title: "Generate leads", body: "Proof, services and stronger calls to action." },
      },
      techniques: "Viral content techniques",
      techniquesBody: "Choose the formats that suit your business. RepGet uses them to develop ideas, never to invent claims.",
      trends: "Trend-inspired ideas",
      trendsHelp: "Ideas use proven formats and knowledge of your field. RepGet never says something is trending without data.",
      disclaimer: "Viral content is made for engagement and sharing. It does not guarantee views, rankings or a viral result.",
    },
    audience: {
      title: "Audience & topics",
      body: "Describe who you want to reach and what your customers care about.",
      shared: "These are your business profile and brand voice. Saving here updates them everywhere in RepGet.",
      targetAudience: "Target audience",
      topics: "Topics to prioritize",
      language: "Content language",
      languageHint: "The language your videos and posts are written in.",
      languageAuto: "Your website's language",
      market: "Target market",
      global: "Global / international",
      voice: "Brand voice",
      voiceBody: "How your content sounds across platforms.",
      toneNotes: "Your tone in your own words",
      toneNotesHint: "Kept next to the choice above, as in your brand voice settings.",
      avoid: "Avoid these topics or phrases",
      avoidPlaceholder: "Subjects, promises or phrases your brand should avoid",
    },
    video: {
      title: "Video & audio",
      body: "Formats, length and presentation for your videos and carousels.",
      formats: "Allowed formats",
      formatsBody: "Ideas adapt to the formats you choose.",
      formatNames: { reel: "Reels / Shorts", story: "Stories", carousel: "Photo carousels" },
      audio: "Audio",
      audioBody: "How your videos sound.",
      audioModes: {
        auto: { title: "Auto (recommended)", body: "RepGet picks voiceover or text and music for each idea." },
        voiceover: { title: "Voiceover", body: "AI narration with captions and music." },
        text_music: { title: "Text + music", body: "No narration: strong visuals, animated text and music." },
      },
      duration: "Target video length",
      narration: "Narration style",
      captions: "Caption style",
      captionsHelp: "Words on screen as they are said.",
      music: "Music direction",
      musicNote: "Music is licensed for commercial use on social platforms.",
      hook: "Show on-screen opening hook",
      hookHelp: "Start videos with a clear visual hook in the first seconds.",
      cta: "Include calls to action",
      ctaHelp: "Add a short next step at the end of the video.",
      defaultCta: "Default call to action",
      defaultCtaHint: "Used when an idea has no closing line of its own.",
      defaultCtaPlaceholder: "Follow us for more practical tips",
      animated: "Animated style",
      animatedBody: "For animated videos made with RepGet's templates.",
    },
    publishing: {
      title: "Publishing",
      body: "Choose where your videos go and how much you review before they go live.",
      platformsBody: "New platforms such as LinkedIn and X are never added for you.",
      modes: {
        manual: { title: "Review before publishing", body: "Ready videos wait for you to press Publish." },
        draft: { title: "Save as draft", body: "Made videos stay in Your videos as drafts. Nothing is posted until you publish." },
        auto: { title: "Auto-publish approved ideas", body: "Each video you make is published at the best available time." },
      },
      autoNote: "Automatic posting never creates or charges for videos by itself. It only publishes the videos you make, at most 3 a day.",
      frequency: "Posting frequency",
      frequencyHint: "Used for automatic posting. RepGet spreads posts over the best times.",
    },
    safety: {
      title: "Brand safety",
      body: "Protect your reputation while you make engaging content.",
      always: "Always on: a core protection",
      clickbait: "Avoid misleading clickbait",
      clickbaitHelp: "Hooks can spark curiosity, but must match the video and avoid false promises.",
      facts: "Check figures before automatic posting",
      factsHelp: "Figures, rankings and comparisons not found on your website wait for your check.",
      competitors: "Avoid unverifiable competitor claims",
      competitorsHelp: "No allegations or unsupported statements about other brands.",
      controversy: "Approval for controversial angles",
      controversyHelp: "Sensitive topics and provocative takes wait for your approval.",
      hint: "Keep these on even with a high viral mix. They only hold back automatic posting.",
      creative: "Creative preferences",
      creativeBody: "Adjust these to suit your brand.",
      humor: {
        none: { title: "No humor", body: "Serious and to the point." },
        light: { title: "Light humor", body: "A smile now and then." },
        bold: { title: "Bold humor", body: "Memes and playful jokes." },
      },
      controversial: "Allow controversial topics",
      controversialHelp: "Debated subjects in your field, handled with care.",
      language: "Stronger language",
      languageHelp: "Punchier wording, never offensive.",
      core: "Copyright, false claims, impersonation and unlawful content are always protected, whatever you choose here.",
    },
  },
  errors: {
    extra_used_up: "You have used today's 3 free batches of ideas. More arrive tomorrow morning.",
    busy: "Ideas are already being written. They appear here in a minute.",
    too_soon: "Please wait a moment before asking for more ideas.",
    bad_settings: "Some settings could not be saved. Please check them and try again.",
    bad_profile: "The audience details could not be saved. Please check them and try again.",
    review_required: "This video needs your check before it can be posted automatically.",
    x_not_configured: "X is not set up yet.",
    x_budget: "X spending limit reached",
    no_story: "Stories are not supported there",
    too_long: "Too long for this platform",
    no_carousel: "Carousels are not supported there",
    audio_unavailable: "Instagram's audio is not available for this account.",
  },
};

const viralEs: ViralCopy = {
  newIdeas: {
    kinds: {
      mixed: { title: "Nuevas ideas del día", body: "Explore más temas relevantes" },
      viral: { title: "Generar ideas virales", body: "Ganchos y formatos pensados para el alcance" },
      website: { title: "Ideas de su sitio web", body: "Muestre sus productos y servicios" },
    },
    left: "Gratis · quedan {left} de {total} hoy",
    free: "Cada clic añade 10 ideas. Las ideas son gratis; solo crear un vídeo usa créditos.",
    writing: "Escribiendo ideas…",
    queued: "Escribiendo 10 ideas nuevas. Aparecerán aquí en un minuto.",
    busy: "Se están escribiendo ideas nuevas. Aparecerán aquí en un minuto.",
    usedUp: "Ya ha usado los 3 lotes gratuitos de hoy. Mañana por la mañana llegan más ideas.",
    tooSoon: "Espere un momento antes de pedir más ideas.",
  },
  categories: { all: "Todas las ideas", viral: "Virales", educational: "Educativas", authority: "Autoridad", promotional: "Promocionales" },
  categoryHelp: {
    all: "Elija el tipo de contenido que quiere crear",
    viral: "Contenido que despierta curiosidad, pensado para descubrirse y compartirse",
    educational: "Consejos útiles y respuestas que buscan sus clientes",
    authority: "Su experiencia y cómo trabaja entre bastidores",
    promotional: "Sus productos y servicios, con un siguiente paso claro",
  },
  filters: {
    label: "Tipo de contenido",
    empty: "Ninguna idea coincide con estos filtros",
    emptyBody: "Pruebe otro tipo de contenido u otro formato, o pida ideas nuevas.",
    clear: "Quitar filtros",
  },
  browse: {
    previous: "Idea anterior",
    next: "Idea siguiente",
    hint: "‹ › solo sirven para ver las ideas. Crear hace el vídeo; Omitir aparta la idea.",
  },
  undoSkip: "La idea ha vuelto.",
  viralBadge: "✦ Viral",
  formats: { reel: "Reel", story: "Historia", carousel: "Carrusel", stories: "Historias" },
  directions: {
    meme: "Meme",
    footage: "Imágenes reales",
    storytelling: "Narrativa",
    text_music: "Texto + música",
    voiceover: "Voz en off",
    animated: "Animado",
  },
  audio: { voiceover: "Voz en off", text_music: "Texto + música" },
  narration: { natural: "Natural y cercana", warm: "Cálida y cinematográfica", energetic: "Enérgica y animada" },
  captionStyles: { bold: "Palabras destacadas", editorial: "Subtítulos editoriales limpios", minimal: "Subtítulos mínimos" },
  music: { auto: "Adaptada al contenido", cinematic: "Cinematográfica", upbeat: "Animada", ambient: "Ambiental / mínima", none: "Sin música" },
  durations: { "15-30": "15–30 segundos", "30-45": "30–45 segundos", "45-60": "45–60 segundos", "60-90": "60–90 segundos" },
  techniques: {
    curiosity_hooks: "Ganchos de curiosidad",
    trend_inspired: "Formatos inspirados en tendencias",
    myth_busting: "Desmentir mitos",
    hot_takes: "Opiniones atrevidas",
    before_after: "Antes y después",
    unexpected_facts: "Datos inesperados",
    comparisons: "Comparaciones",
    storytelling: "Narrativa",
  },
  tonePresets: {
    professional: { title: "Profesional", body: "Claro, cuidado y seguro." },
    bold: { title: "Atrevido", body: "Más energía y comienzos más fuertes." },
    playful: { title: "Desenfadado", body: "Ingenioso, informal y cercano." },
  },
  frequencies: {
    "3_week": "3 veces por semana",
    "5_week": "5 veces por semana",
    "1_day": "1 publicación al día",
    "2_day": "2 publicaciones al día",
    legacy: "Según se crean los vídeos (hasta 3 al día)",
  },
  why: { title: "Por qué podría funcionar bien", note: "Una buena idea ayuda, pero nada garantiza visualizaciones." },
  review: {
    title: "Necesita su revisión: {reasons}",
    reasons: { unverified_claim: "cifras o datos", controversial: "un enfoque polémico", sensitive: "un tema delicado" },
    what: "Compruébelos con su propia información:",
    note: "Esto solo detiene la publicación automática. Puede crearlo y publicarlo usted mismo.",
    approve: "Lo he comprobado",
    done: "Comprobado. Ya se puede publicar automáticamente.",
    checked: "Comprobado por usted",
  },
  previewConcept: "Vista previa del concepto, sin sonido. Las imágenes, la voz y la música se eligen al crear el vídeo.",
  noCta: "Sin llamada a la acción",
  edit: {
    description: "Cambie la idea antes de crearla. Guardar es gratis; solo crear usa créditos.",
    script: "Guion",
    making: "Cómo se crea",
    title: "Título",
    category: "Tipo de contenido",
    direction: "Dirección creativa",
    audio: "Audio",
    narration: "Estilo de narración",
    captionStyle: "Estilo de subtítulos",
    musicDirection: "Estilo de música",
    duration: "Duración",
    showHook: "Mostrar el gancho inicial en pantalla",
    includeCta: "Incluir una llamada a la acción",
    ctaText: "Llamada a la acción",
    ctaHint: "Déjelo vacío para usar la frase final.",
    onlyThis: "Solo este vídeo",
    onlyThisBody: "Esto cambia solo este vídeo. Su perfil de empresa y su Voz de marca no cambian.",
    audience: "Público",
    tonePreset: "Voz de marca",
    tone: "Tono",
    avoid: "Evitar",
    sameAsBrand: "Igual que su Voz de marca",
    samePlaceholder: "Igual que su perfil de empresa",
    rewrite: "Reescribir con estos cambios",
    rewriteHelp: "Reescribir es gratis: RepGet vuelve a escribir el guion con sus elecciones.",
    rewritten: "Reescrito. El nuevo guion está en la idea.",
  },
  compat: {
    title: "Revise antes de publicar",
    no_story: "{platform} no acepta Historias de RepGet, así que esta Historia no se envía allí.",
    too_long: "{platform} no acepta vídeos de {length}.",
    no_carousel: "{platform} no acepta carruseles aquí, así que este carrusel no se envía allí.",
    other: "{platform} no puede recibir este vídeo.",
  },
  draft: { badge: "Borrador", body: "Borrador: publíquelo cuando quiera." },
  destinations: {
    label: "Dónde se publicó",
    status: { pending: "En espera", scheduled: "Programado", posting: "Publicando", posted: "Publicado", failed: "Error", skipped: "Omitido" },
  },
  nativeAudio: {
    button: "Audio de Instagram",
    title: "Audio de Instagram",
    honest: "La mezcla final con el audio de Instagram solo se oye en Instagram. Las demás plataformas y la descarga mantienen la música con licencia de RepGet.",
    unavailable: "El audio de Instagram aún no está disponible para esta cuenta.",
    search: "Buscar en el audio de Instagram",
    searchButton: "Buscar",
    none: "No se ha encontrado nada. Pruebe con otras palabras.",
    trending: "Tendencia en Instagram",
    use: "Usar",
    current: "Elegido",
    remove: "Quitar el audio de Instagram",
    saved: "Audio de Instagram elegido para este reel.",
    removed: "Audio de Instagram quitado.",
    chosen: "Audio de Instagram: {title} {artist}",
  },
  x: {
    needsSetup: "X necesita configuración: RepGet solo publica allí cuando X está configurado con un límite de gasto.",
    budget: "X ha alcanzado su límite de gasto por ahora. RepGet volverá a publicar allí cuando el límite lo permita.",
  },
  linkedin: { help: "Su perfil o una página de empresa." },
  settings: {
    open: "Ajustes de contenido",
    sidebar: "Preferencias",
    panes: {
      strategy: "Estrategia de contenido",
      audience: "Público y temas",
      video: "Vídeo y audio",
      publishing: "Publicación",
      safety: "Seguridad de marca",
      brand: "Medios de la marca",
    },
    save: "Guardar ajustes",
    reset: "Restablecer",
    resetTitle: "¿Volver a los ajustes recomendados?",
    resetBody: "La estrategia, el vídeo, la publicación y la seguridad vuelven a las recomendaciones de RepGet. Sus cuentas, su logotipo, sus imágenes y su perfil de empresa no cambian.",
    resetDone: "Ajustes restablecidos a los valores recomendados.",
    unsaved: "Tiene cambios sin guardar.",
    savedNote: "Los ajustes se guardan para este sitio web.",
    brandNote: "Su logotipo y sus imágenes se guardan en cuanto los sube.",
    problems: {
      no_format: "Elija al menos un formato.",
      cta_too_long: "La llamada a la acción debe tener menos de 120 caracteres.",
      profile_too_long: "Uno de los textos es demasiado largo.",
      bad_value: "Una de las opciones no es válida. Vuelva a cargar la página.",
    },
    strategy: {
      title: "Estrategia de contenido",
      body: "Elija qué tipo de contenido social debe sugerir RepGet y cuánto debe estar pensado para descubrirse y compartirse.",
      badge: "NUEVO · Viral",
      mix: "Proporción de contenido viral",
      mixHelp: "Cuántas de sus ideas diarias deben usar ganchos para compartir, historias y formatos inspirados en tendencias.",
      mixBadge: "{value}% viral",
      mixLow: "0% · Como siempre",
      mixMid: "50% · Equilibrado",
      mixHigh: "100% · Máximo alcance",
      viralCount: "{count} ideas virales / {total}",
      otherCount: "{count} ideas de otro tipo",
      goal: "Objetivo principal",
      goalBody: "RepGet adapta sus sugerencias al resultado que busca.",
      goals: {
        reach: { title: "Ganar alcance", body: "Visibilidad, visualizaciones, compartidos y curiosidad." },
        balanced: { title: "Crecimiento equilibrado", body: "Contenido útil, confianza y facilidad para compartir." },
        leads: { title: "Conseguir clientes", body: "Pruebas, servicios y llamadas a la acción más claras." },
      },
      techniques: "Técnicas de contenido viral",
      techniquesBody: "Elija los formatos que encajan con su negocio. RepGet los usa para desarrollar ideas, nunca para inventar afirmaciones.",
      trends: "Ideas inspiradas en tendencias",
      trendsHelp: "Las ideas usan formatos probados y conocimiento de su sector. RepGet nunca dice que algo es tendencia sin datos.",
      disclaimer: "El contenido viral está pensado para generar interacción y compartirse. No garantiza visualizaciones, posiciones ni un resultado viral.",
    },
    audience: {
      title: "Público y temas",
      body: "Describa a quién quiere llegar y qué les importa a sus clientes.",
      shared: "Estos datos son su perfil de empresa y su Voz de marca. Al guardarlos aquí se actualizan en todo RepGet.",
      targetAudience: "Público objetivo",
      topics: "Temas prioritarios",
      language: "Idioma del contenido",
      languageHint: "El idioma en que se escriben sus vídeos y publicaciones.",
      languageAuto: "El idioma de su sitio web",
      market: "Mercado objetivo",
      global: "Global / internacional",
      voice: "Voz de marca",
      voiceBody: "Cómo suena su contenido en todas las plataformas.",
      toneNotes: "Su tono, con sus palabras",
      toneNotesHint: "Se mantiene junto a la opción de arriba, como en Voz de marca.",
      avoid: "Evitar estos temas o frases",
      avoidPlaceholder: "Temas, promesas o frases que su marca debe evitar",
    },
    video: {
      title: "Vídeo y audio",
      body: "Formatos, duración y presentación de sus vídeos y carruseles.",
      formats: "Formatos permitidos",
      formatsBody: "Las ideas se adaptan a los formatos que elija.",
      formatNames: { reel: "Reels / Shorts", story: "Historias", carousel: "Carruseles de fotos" },
      audio: "Audio",
      audioBody: "Cómo suenan sus vídeos.",
      audioModes: {
        auto: { title: "Automático (recomendado)", body: "RepGet elige voz en off o texto y música para cada idea." },
        voiceover: { title: "Voz en off", body: "Narración con IA, subtítulos y música." },
        text_music: { title: "Texto + música", body: "Sin narración: imágenes potentes, texto animado y música." },
      },
      duration: "Duración del vídeo",
      narration: "Estilo de narración",
      captions: "Estilo de subtítulos",
      captionsHelp: "Las palabras aparecen en pantalla al decirse.",
      music: "Estilo de música",
      musicNote: "La música tiene licencia para uso comercial en redes sociales.",
      hook: "Mostrar el gancho inicial en pantalla",
      hookHelp: "Empiece los vídeos con un gancho visual claro en los primeros segundos.",
      cta: "Incluir llamadas a la acción",
      ctaHelp: "Añada un siguiente paso breve al final del vídeo.",
      defaultCta: "Llamada a la acción por defecto",
      defaultCtaHint: "Se usa cuando una idea no tiene frase final propia.",
      defaultCtaPlaceholder: "Síganos para más consejos prácticos",
      animated: "Estilo animado",
      animatedBody: "Para vídeos animados hechos con las plantillas de RepGet.",
    },
    publishing: {
      title: "Publicación",
      body: "Elija dónde se publican sus vídeos y cuánto los revisa antes de que salgan.",
      platformsBody: "Las plataformas nuevas, como LinkedIn y X, nunca se añaden por usted.",
      modes: {
        manual: { title: "Revisar antes de publicar", body: "Los vídeos listos esperan a que pulse Publicar." },
        draft: { title: "Guardar como borrador", body: "Los vídeos creados quedan en Sus vídeos como borradores. No se publica nada hasta que usted lo haga." },
        auto: { title: "Publicar automáticamente las ideas aprobadas", body: "Cada vídeo que crea se publica en el mejor momento disponible." },
      },
      autoNote: "La publicación automática nunca crea vídeos ni cobra por sí sola. Solo publica los vídeos que usted crea, como máximo 3 al día.",
      frequency: "Frecuencia de publicación",
      frequencyHint: "Para la publicación automática. RepGet reparte las publicaciones en los mejores horarios.",
    },
    safety: {
      title: "Seguridad de marca",
      body: "Proteja su reputación mientras crea contenido atractivo.",
      always: "Siempre activa: una protección básica",
      clickbait: "Evitar el clickbait engañoso",
      clickbaitHelp: "Los ganchos pueden despertar curiosidad, pero deben coincidir con el vídeo y no hacer falsas promesas.",
      facts: "Revisar las cifras antes de publicar automáticamente",
      factsHelp: "Las cifras, clasificaciones y comparaciones que no están en su sitio web esperan su revisión.",
      competitors: "Evitar afirmaciones no verificables sobre la competencia",
      competitorsHelp: "Nada de acusaciones ni afirmaciones sin fundamento sobre otras marcas.",
      controversy: "Aprobación para enfoques polémicos",
      controversyHelp: "Los temas delicados y las opiniones provocadoras esperan su aprobación.",
      hint: "Manténgalas activas aunque la proporción viral sea alta. Solo detienen la publicación automática.",
      creative: "Preferencias creativas",
      creativeBody: "Ajústelas según su marca.",
      humor: {
        none: { title: "Sin humor", body: "Serio y directo." },
        light: { title: "Humor ligero", body: "Una sonrisa de vez en cuando." },
        bold: { title: "Humor atrevido", body: "Memes y bromas desenfadadas." },
      },
      controversial: "Permitir temas polémicos",
      controversialHelp: "Temas debatidos de su sector, tratados con cuidado.",
      language: "Lenguaje más directo",
      languageHelp: "Frases más contundentes, nunca ofensivas.",
      core: "Los derechos de autor, las afirmaciones falsas, la suplantación y el contenido ilegal siempre están protegidos, elija lo que elija aquí.",
    },
  },
  errors: {
    extra_used_up: "Ya ha usado los 3 lotes gratuitos de ideas de hoy. Mañana por la mañana llegan más.",
    busy: "Ya se están escribiendo ideas. Aparecerán aquí en un minuto.",
    too_soon: "Espere un momento antes de pedir más ideas.",
    bad_settings: "No se han podido guardar algunos ajustes. Revíselos e inténtelo de nuevo.",
    bad_profile: "No se han podido guardar los datos del público. Revíselos e inténtelo de nuevo.",
    review_required: "Este vídeo necesita su revisión antes de publicarse automáticamente.",
    x_not_configured: "X aún no está configurado.",
    x_budget: "Límite de gasto de X alcanzado",
    no_story: "Allí no se admiten Historias",
    too_long: "Demasiado largo para esta plataforma",
    no_carousel: "Allí no se admiten carruseles",
    audio_unavailable: "El audio de Instagram no está disponible para esta cuenta.",
  },
};

const viralFr: ViralCopy = {
  newIdeas: {
    kinds: {
      mixed: { title: "Nouvelles idées du jour", body: "Explorez d’autres sujets pertinents" },
      viral: { title: "Générer des idées virales", body: "Accroches et formats pensés pour la portée" },
      website: { title: "Idées tirées de votre site", body: "Mettez en avant vos produits et services" },
    },
    left: "Gratuit · encore {left} sur {total} aujourd’hui",
    free: "Chaque clic ajoute 10 idées. Les idées sont gratuites ; seule la création d’une vidéo utilise des crédits.",
    writing: "Rédaction des idées…",
    queued: "Rédaction de 10 nouvelles idées. Elles apparaîtront ici dans une minute.",
    busy: "De nouvelles idées sont en cours de rédaction. Elles apparaîtront ici dans une minute.",
    usedUp: "Vous avez utilisé les 3 lots gratuits du jour. De nouvelles idées arrivent demain matin.",
    tooSoon: "Patientez un instant avant de demander d’autres idées.",
  },
  categories: { all: "Toutes les idées", viral: "Virales", educational: "Pédagogiques", authority: "Expertise", promotional: "Promotionnelles" },
  categoryHelp: {
    all: "Choisissez le type de contenu que vous voulez créer",
    viral: "Du contenu qui éveille la curiosité, pensé pour être découvert et partagé",
    educational: "Des conseils utiles et les réponses que vos clients cherchent",
    authority: "Votre savoir-faire et vos coulisses",
    promotional: "Vos produits et services, avec une prochaine étape claire",
  },
  filters: {
    label: "Type de contenu",
    empty: "Aucune idée ne correspond à ces filtres",
    emptyBody: "Essayez un autre type de contenu ou un autre format, ou demandez de nouvelles idées.",
    clear: "Effacer les filtres",
  },
  browse: {
    previous: "Idée précédente",
    next: "Idée suivante",
    hint: "‹ › servent seulement à parcourir les idées. Créer fait la vidéo ; Ignorer met l’idée de côté.",
  },
  undoSkip: "L’idée est revenue.",
  viralBadge: "✦ Virale",
  formats: { reel: "Reel", story: "Story", carousel: "Carrousel", stories: "Stories" },
  directions: {
    meme: "Mème",
    footage: "Images réelles",
    storytelling: "Récit",
    text_music: "Texte + musique",
    voiceover: "Voix off",
    animated: "Animé",
  },
  audio: { voiceover: "Voix off", text_music: "Texte + musique" },
  narration: { natural: "Naturelle et conversationnelle", warm: "Chaleureuse et cinématographique", energetic: "Énergique et entraînante" },
  captionStyles: { bold: "Mots clés mis en avant", editorial: "Sous-titres éditoriaux sobres", minimal: "Sous-titres minimalistes" },
  music: { auto: "Adaptée au contenu", cinematic: "Cinématographique", upbeat: "Entraînante", ambient: "Ambiance / minimaliste", none: "Sans musique" },
  durations: { "15-30": "15 à 30 secondes", "30-45": "30 à 45 secondes", "45-60": "45 à 60 secondes", "60-90": "60 à 90 secondes" },
  techniques: {
    curiosity_hooks: "Accroches de curiosité",
    trend_inspired: "Formats inspirés des tendances",
    myth_busting: "Idées reçues démontées",
    hot_takes: "Avis tranchés",
    before_after: "Avant / après",
    unexpected_facts: "Faits surprenants",
    comparisons: "Comparaisons",
    storytelling: "Récit",
  },
  tonePresets: {
    professional: { title: "Professionnel", body: "Clair, soigné et assuré." },
    bold: { title: "Audacieux", body: "Plus d’énergie et des débuts plus forts." },
    playful: { title: "Décontracté", body: "Spirituel, informel et engageant." },
  },
  frequencies: {
    "3_week": "3 fois par semaine",
    "5_week": "5 fois par semaine",
    "1_day": "1 publication par jour",
    "2_day": "2 publications par jour",
    legacy: "Au fil des vidéos créées (jusqu’à 3 par jour)",
  },
  why: { title: "Pourquoi cela pourrait bien marcher", note: "Une bonne idée aide, mais rien ne garantit des vues." },
  review: {
    title: "À vérifier par vous : {reasons}",
    reasons: { unverified_claim: "des chiffres ou des faits", controversial: "un angle polémique", sensitive: "un sujet sensible" },
    what: "Vérifiez-les avec vos propres informations :",
    note: "Cela bloque seulement la publication automatique. Vous pouvez toujours la créer et la publier vous-même.",
    approve: "J’ai vérifié",
    done: "Vérifié. Elle peut maintenant être publiée automatiquement.",
    checked: "Vérifié par vous",
  },
  previewConcept: "Aperçu du concept, sans son. Les images, la voix et la musique sont choisies lors de la création de la vidéo.",
  noCta: "Pas d’appel à l’action",
  edit: {
    description: "Modifiez l’idée avant sa création. Enregistrer est gratuit ; seule la création utilise des crédits.",
    script: "Script",
    making: "Comment elle est faite",
    title: "Titre",
    category: "Type de contenu",
    direction: "Direction créative",
    audio: "Audio",
    narration: "Style de narration",
    captionStyle: "Style des sous-titres",
    musicDirection: "Style de musique",
    duration: "Durée",
    showHook: "Afficher l’accroche à l’écran",
    includeCta: "Ajouter un appel à l’action",
    ctaText: "Appel à l’action",
    ctaHint: "Laissez vide pour utiliser la phrase de fin.",
    onlyThis: "Cette vidéo uniquement",
    onlyThisBody: "Ces choix ne changent que cette vidéo. Votre profil d’entreprise et le ton de votre marque restent tels quels.",
    audience: "Public",
    tonePreset: "Ton de la marque",
    tone: "Ton",
    avoid: "À éviter",
    sameAsBrand: "Comme le ton de votre marque",
    samePlaceholder: "Comme votre profil d’entreprise",
    rewrite: "Réécrire avec ces choix",
    rewriteHelp: "La réécriture est gratuite : RepGet rédige à nouveau le script avec vos choix.",
    rewritten: "Réécrit. Le nouveau script est dans l’idée.",
  },
  compat: {
    title: "À vérifier avant de publier",
    no_story: "{platform} n’accepte pas de Stories de RepGet : cette Story n’y est donc pas envoyée.",
    too_long: "{platform} n’accepte pas de vidéos de {length}.",
    no_carousel: "{platform} n’accepte pas de carrousels ici : ce carrousel n’y est donc pas envoyé.",
    other: "{platform} ne peut pas recevoir cette vidéo.",
  },
  draft: { badge: "Brouillon", body: "Brouillon : publiez-le quand vous êtes prêt." },
  destinations: {
    label: "Où elle a été publiée",
    status: { pending: "En attente", scheduled: "Programmée", posting: "Publication…", posted: "Publiée", failed: "Échec", skipped: "Ignorée" },
  },
  nativeAudio: {
    button: "Audio Instagram",
    title: "Audio Instagram",
    honest: "Le mixage final avec l’audio d’Instagram ne s’écoute que sur Instagram. Les autres plateformes et le téléchargement gardent la musique sous licence de RepGet.",
    unavailable: "L’audio d’Instagram n’est pas encore disponible pour ce compte.",
    search: "Rechercher dans l’audio d’Instagram",
    searchButton: "Rechercher",
    none: "Aucun résultat. Essayez d’autres mots.",
    trending: "Tendance sur Instagram",
    use: "Utiliser",
    current: "Choisi",
    remove: "Retirer l’audio Instagram",
    saved: "Audio Instagram choisi pour ce reel.",
    removed: "Audio Instagram retiré.",
    chosen: "Audio Instagram : {title} {artist}",
  },
  x: {
    needsSetup: "X doit être configuré : RepGet n’y publie qu’une fois X configuré avec une limite de dépenses.",
    budget: "X a atteint sa limite de dépenses pour le moment. RepGet y publiera de nouveau quand la limite le permettra.",
  },
  linkedin: { help: "Votre profil ou une page entreprise." },
  settings: {
    open: "Réglages du contenu",
    sidebar: "Préférences",
    panes: {
      strategy: "Stratégie de contenu",
      audience: "Public et sujets",
      video: "Vidéo et audio",
      publishing: "Publication",
      safety: "Sécurité de la marque",
      brand: "Médias de la marque",
    },
    save: "Enregistrer les réglages",
    reset: "Réinitialiser",
    resetTitle: "Revenir aux réglages conseillés ?",
    resetBody: "La stratégie, la vidéo, la publication et la sécurité reviennent aux suggestions de RepGet. Vos comptes, votre logo, vos images et votre profil d’entreprise restent tels quels.",
    resetDone: "Réglages remis aux valeurs conseillées.",
    unsaved: "Vous avez des modifications non enregistrées.",
    savedNote: "Les réglages sont enregistrés pour ce site.",
    brandNote: "Votre logo et vos images sont enregistrés dès leur envoi.",
    problems: {
      no_format: "Choisissez au moins un format.",
      cta_too_long: "L’appel à l’action doit faire moins de 120 caractères.",
      profile_too_long: "Un des textes est trop long.",
      bad_value: "Un des choix n’est pas valide. Rechargez la page.",
    },
    strategy: {
      title: "Stratégie de contenu",
      body: "Choisissez le type de contenu social que RepGet doit proposer, et quelle part doit être pensée pour être découverte et partagée.",
      badge: "NOUVEAU · Viral",
      mix: "Part de contenu viral",
      mixHelp: "Combien de vos idées du jour doivent utiliser des accroches à partager, des récits et des formats inspirés des tendances.",
      mixBadge: "{value} % viral",
      mixLow: "0 % · Comme d’habitude",
      mixMid: "50 % · Équilibré",
      mixHigh: "100 % · Portée avant tout",
      viralCount: "{count} idées virales / {total}",
      otherCount: "{count} autres idées",
      goal: "Objectif principal",
      goalBody: "RepGet adapte ses suggestions au résultat que vous visez.",
      goals: {
        reach: { title: "Gagner en portée", body: "Visibilité, vues, partages et curiosité." },
        balanced: { title: "Croissance équilibrée", body: "Contenu utile, confiance et partage." },
        leads: { title: "Générer des contacts", body: "Preuves, services et appels à l’action plus forts." },
      },
      techniques: "Techniques de contenu viral",
      techniquesBody: "Choisissez les formats qui conviennent à votre activité. RepGet s’en sert pour développer des idées, jamais pour inventer des affirmations.",
      trends: "Idées inspirées des tendances",
      trendsHelp: "Les idées reposent sur des formats éprouvés et la connaissance de votre secteur. RepGet ne dit jamais qu’un sujet est tendance sans données.",
      disclaimer: "Le contenu viral est conçu pour l’engagement et le partage. Il ne garantit ni vues, ni classement, ni résultat viral.",
    },
    audience: {
      title: "Public et sujets",
      body: "Décrivez qui vous voulez toucher et ce qui compte pour vos clients.",
      shared: "Ce sont votre profil d’entreprise et le ton de votre marque. Les enregistrer ici les met à jour partout dans RepGet.",
      targetAudience: "Public cible",
      topics: "Sujets prioritaires",
      language: "Langue du contenu",
      languageHint: "La langue dans laquelle vos vidéos et publications sont rédigées.",
      languageAuto: "La langue de votre site",
      market: "Marché cible",
      global: "Mondial / international",
      voice: "Ton de la marque",
      voiceBody: "Comment votre contenu sonne sur toutes les plateformes.",
      toneNotes: "Votre ton, avec vos mots",
      toneNotesHint: "Conservé avec le choix ci-dessus, comme dans le ton de la marque.",
      avoid: "Sujets ou expressions à éviter",
      avoidPlaceholder: "Sujets, promesses ou expressions que votre marque doit éviter",
    },
    video: {
      title: "Vidéo et audio",
      body: "Formats, durée et présentation de vos vidéos et carrousels.",
      formats: "Formats autorisés",
      formatsBody: "Les idées s’adaptent aux formats choisis.",
      formatNames: { reel: "Reels / Shorts", story: "Stories", carousel: "Carrousels photo" },
      audio: "Audio",
      audioBody: "Comment vos vidéos sonnent.",
      audioModes: {
        auto: { title: "Automatique (conseillé)", body: "RepGet choisit la voix off ou le texte et la musique pour chaque idée." },
        voiceover: { title: "Voix off", body: "Narration par IA avec sous-titres et musique." },
        text_music: { title: "Texte + musique", body: "Sans narration : des images fortes, du texte animé et de la musique." },
      },
      duration: "Durée visée",
      narration: "Style de narration",
      captions: "Style des sous-titres",
      captionsHelp: "Les mots s’affichent à l’écran quand ils sont prononcés.",
      music: "Style de musique",
      musicNote: "La musique est sous licence pour un usage commercial sur les réseaux sociaux.",
      hook: "Afficher l’accroche à l’écran",
      hookHelp: "Commencez les vidéos par une accroche visuelle claire dans les premières secondes.",
      cta: "Ajouter des appels à l’action",
      ctaHelp: "Ajoutez une courte prochaine étape à la fin de la vidéo.",
      defaultCta: "Appel à l’action par défaut",
      defaultCtaHint: "Utilisé quand une idée n’a pas sa propre phrase de fin.",
      defaultCtaPlaceholder: "Suivez-nous pour plus de conseils pratiques",
      animated: "Style animé",
      animatedBody: "Pour les vidéos animées réalisées avec les modèles de RepGet.",
    },
    publishing: {
      title: "Publication",
      body: "Choisissez où vont vos vidéos et ce que vous relisez avant leur mise en ligne.",
      platformsBody: "Les nouvelles plateformes comme LinkedIn et X ne sont jamais ajoutées à votre place.",
      modes: {
        manual: { title: "Relire avant de publier", body: "Les vidéos prêtes attendent que vous cliquiez sur Publier." },
        draft: { title: "Enregistrer comme brouillon", body: "Les vidéos créées restent dans Vos vidéos comme brouillons. Rien n’est publié tant que vous ne le faites pas." },
        auto: { title: "Publier automatiquement les idées approuvées", body: "Chaque vidéo que vous créez est publiée au meilleur moment disponible." },
      },
      autoNote: "La publication automatique ne crée ni ne facture jamais de vidéos d’elle-même. Elle publie seulement les vidéos que vous créez, 3 par jour au maximum.",
      frequency: "Fréquence de publication",
      frequencyHint: "Pour la publication automatique. RepGet répartit les publications aux meilleurs horaires.",
    },
    safety: {
      title: "Sécurité de la marque",
      body: "Protégez votre réputation tout en créant du contenu engageant.",
      always: "Toujours active : une protection de base",
      clickbait: "Éviter le clickbait trompeur",
      clickbaitHelp: "Les accroches peuvent éveiller la curiosité, mais doivent correspondre à la vidéo et éviter les fausses promesses.",
      facts: "Vérifier les chiffres avant la publication automatique",
      factsHelp: "Les chiffres, classements et comparaisons absents de votre site attendent votre vérification.",
      competitors: "Éviter les affirmations invérifiables sur les concurrents",
      competitorsHelp: "Aucune accusation ni affirmation sans fondement sur d’autres marques.",
      controversy: "Approbation des angles polémiques",
      controversyHelp: "Les sujets sensibles et les avis provocateurs attendent votre accord.",
      hint: "Gardez-les actives même avec une forte part virale. Elles bloquent seulement la publication automatique.",
      creative: "Préférences créatives",
      creativeBody: "Adaptez-les à votre marque.",
      humor: {
        none: { title: "Sans humour", body: "Sérieux et direct." },
        light: { title: "Humour léger", body: "Un sourire de temps en temps." },
        bold: { title: "Humour marqué", body: "Mèmes et blagues décalées." },
      },
      controversial: "Autoriser les sujets polémiques",
      controversialHelp: "Des sujets débattus dans votre secteur, traités avec soin.",
      language: "Langage plus direct",
      languageHelp: "Des formulations plus percutantes, jamais offensantes.",
      core: "Le droit d’auteur, les fausses affirmations, l’usurpation d’identité et les contenus illégaux sont toujours protégés, quels que soient vos choix ici.",
    },
  },
  errors: {
    extra_used_up: "Vous avez utilisé les 3 lots d’idées gratuits du jour. D’autres arrivent demain matin.",
    busy: "Des idées sont déjà en cours de rédaction. Elles apparaîtront ici dans une minute.",
    too_soon: "Patientez un instant avant de demander d’autres idées.",
    bad_settings: "Certains réglages n’ont pas pu être enregistrés. Vérifiez-les et réessayez.",
    bad_profile: "Les informations sur le public n’ont pas pu être enregistrées. Vérifiez-les et réessayez.",
    review_required: "Cette vidéo doit être vérifiée par vous avant d’être publiée automatiquement.",
    x_not_configured: "X n’est pas encore configuré.",
    x_budget: "Limite de dépenses X atteinte",
    no_story: "Les Stories n’y sont pas prises en charge",
    too_long: "Trop longue pour cette plateforme",
    no_carousel: "Les carrousels n’y sont pas pris en charge",
    audio_unavailable: "L’audio d’Instagram n’est pas disponible pour ce compte.",
  },
};

const viralIt: ViralCopy = {
  newIdeas: {
    kinds: {
      mixed: { title: "Nuove idee del giorno", body: "Esplori altri argomenti pertinenti" },
      viral: { title: "Genera idee virali", body: "Ganci e formati pensati per la copertura" },
      website: { title: "Idee dal suo sito web", body: "Metta in mostra prodotti e servizi" },
    },
    left: "Gratis · ne restano {left} su {total} oggi",
    free: "Ogni clic aggiunge 10 idee. Le idee sono gratuite; solo creare un video usa crediti.",
    writing: "Scrittura delle idee…",
    queued: "Stiamo scrivendo 10 nuove idee. Compariranno qui tra un minuto.",
    busy: "Si stanno scrivendo nuove idee. Compariranno qui tra un minuto.",
    usedUp: "Ha già usato i 3 gruppi gratuiti di oggi. Altre idee arrivano domani mattina.",
    tooSoon: "Attenda un momento prima di chiedere altre idee.",
  },
  categories: { all: "Tutte le idee", viral: "Virali", educational: "Educative", authority: "Autorevolezza", promotional: "Promozionali" },
  categoryHelp: {
    all: "Scelga il tipo di contenuto che vuole creare",
    viral: "Contenuti che stimolano la curiosità, pensati per essere scoperti e condivisi",
    educational: "Consigli utili e risposte che i suoi clienti cercano",
    authority: "La sua competenza e il suo lavoro dietro le quinte",
    promotional: "I suoi prodotti e servizi, con un passo successivo chiaro",
  },
  filters: {
    label: "Tipo di contenuto",
    empty: "Nessuna idea corrisponde a questi filtri",
    emptyBody: "Provi un altro tipo di contenuto o un altro formato, oppure chieda nuove idee.",
    clear: "Rimuovi i filtri",
  },
  browse: {
    previous: "Idea precedente",
    next: "Idea successiva",
    hint: "‹ › servono solo a scorrere le idee. Crea realizza il video; Salta mette da parte l’idea.",
  },
  undoSkip: "L’idea è tornata.",
  viralBadge: "✦ Virale",
  formats: { reel: "Reel", story: "Storia", carousel: "Carosello", stories: "Storie" },
  directions: {
    meme: "Meme",
    footage: "Riprese reali",
    storytelling: "Racconto",
    text_music: "Testo + musica",
    voiceover: "Voce fuori campo",
    animated: "Animato",
  },
  audio: { voiceover: "Voce fuori campo", text_music: "Testo + musica" },
  narration: { natural: "Naturale e colloquiale", warm: "Calda e cinematografica", energetic: "Energica e vivace" },
  captionStyles: { bold: "Parole evidenziate", editorial: "Sottotitoli editoriali puliti", minimal: "Sottotitoli minimi" },
  music: { auto: "Adatta al contenuto", cinematic: "Cinematografica", upbeat: "Vivace", ambient: "Ambient / minimale", none: "Senza musica" },
  durations: { "15-30": "15–30 secondi", "30-45": "30–45 secondi", "45-60": "45–60 secondi", "60-90": "60–90 secondi" },
  techniques: {
    curiosity_hooks: "Ganci di curiosità",
    trend_inspired: "Formati ispirati alle tendenze",
    myth_busting: "Sfatare i miti",
    hot_takes: "Opinioni forti",
    before_after: "Prima e dopo",
    unexpected_facts: "Fatti inaspettati",
    comparisons: "Confronti",
    storytelling: "Racconto",
  },
  tonePresets: {
    professional: { title: "Professionale", body: "Chiaro, curato e sicuro." },
    bold: { title: "Deciso", body: "Più energia e aperture più forti." },
    playful: { title: "Giocoso", body: "Spiritoso, informale e coinvolgente." },
  },
  frequencies: {
    "3_week": "3 volte a settimana",
    "5_week": "5 volte a settimana",
    "1_day": "1 post al giorno",
    "2_day": "2 post al giorno",
    legacy: "Man mano che i video sono creati (fino a 3 al giorno)",
  },
  why: { title: "Perché potrebbe funzionare bene", note: "Una buona idea aiuta, ma nulla garantisce visualizzazioni." },
  review: {
    title: "Da controllare: {reasons}",
    reasons: { unverified_claim: "cifre o fatti", controversial: "un taglio controverso", sensitive: "un tema delicato" },
    what: "Li verifichi con le sue informazioni:",
    note: "Questo blocca solo la pubblicazione automatica. Può comunque crearlo e pubblicarlo lei.",
    approve: "Ho controllato",
    done: "Controllato. Ora può essere pubblicato automaticamente.",
    checked: "Controllato da lei",
  },
  previewConcept: "Anteprima del concept, senza audio. Riprese, voce e musica vengono scelte quando il video viene creato.",
  noCta: "Nessun invito all’azione",
  edit: {
    description: "Modifichi l’idea prima della creazione. Salvare è gratis; solo creare usa crediti.",
    script: "Testo",
    making: "Come viene realizzato",
    title: "Titolo",
    category: "Tipo di contenuto",
    direction: "Direzione creativa",
    audio: "Audio",
    narration: "Stile di narrazione",
    captionStyle: "Stile dei sottotitoli",
    musicDirection: "Stile musicale",
    duration: "Durata",
    showHook: "Mostra il gancio iniziale sullo schermo",
    includeCta: "Includi un invito all’azione",
    ctaText: "Invito all’azione",
    ctaHint: "Lasci vuoto per usare la frase finale.",
    onlyThis: "Solo questo video",
    onlyThisBody: "Queste scelte cambiano solo questo video. Il profilo aziendale e la voce del brand restano come sono.",
    audience: "Pubblico",
    tonePreset: "Voce del brand",
    tone: "Tono",
    avoid: "Da evitare",
    sameAsBrand: "Come la voce del brand",
    samePlaceholder: "Come il profilo aziendale",
    rewrite: "Riscrivi con queste scelte",
    rewriteHelp: "Riscrivere è gratis: RepGet scrive di nuovo il testo con le sue scelte.",
    rewritten: "Riscritto. Il nuovo testo è nell’idea.",
  },
  compat: {
    title: "Da controllare prima di pubblicare",
    no_story: "{platform} non accetta Storie da RepGet, quindi questa Storia non viene inviata lì.",
    too_long: "{platform} non accetta video di {length}.",
    no_carousel: "{platform} non accetta caroselli qui, quindi questo carosello non viene inviato lì.",
    other: "{platform} non può ricevere questo video.",
  },
  draft: { badge: "Bozza", body: "Bozza: la pubblichi quando è pronto." },
  destinations: {
    label: "Dove è stato pubblicato",
    status: { pending: "In attesa", scheduled: "Programmato", posting: "In pubblicazione", posted: "Pubblicato", failed: "Non riuscito", skipped: "Saltato" },
  },
  nativeAudio: {
    button: "Audio di Instagram",
    title: "Audio di Instagram",
    honest: "Il mix finale con l’audio di Instagram si sente solo su Instagram. Le altre piattaforme e il download mantengono la musica con licenza di RepGet.",
    unavailable: "L’audio di Instagram non è ancora disponibile per questo account.",
    search: "Cerca nell’audio di Instagram",
    searchButton: "Cerca",
    none: "Nessun risultato. Provi con altre parole.",
    trending: "Di tendenza su Instagram",
    use: "Usa",
    current: "Scelto",
    remove: "Rimuovi l’audio di Instagram",
    saved: "Audio di Instagram scelto per questo reel.",
    removed: "Audio di Instagram rimosso.",
    chosen: "Audio di Instagram: {title} {artist}",
  },
  x: {
    needsSetup: "X va configurato: RepGet pubblica lì solo quando X è configurato con un limite di spesa.",
    budget: "X ha raggiunto il suo limite di spesa per ora. RepGet tornerà a pubblicare lì quando il limite lo permetterà.",
  },
  linkedin: { help: "Il suo profilo o una pagina aziendale." },
  settings: {
    open: "Impostazioni dei contenuti",
    sidebar: "Preferenze",
    panes: {
      strategy: "Strategia dei contenuti",
      audience: "Pubblico e argomenti",
      video: "Video e audio",
      publishing: "Pubblicazione",
      safety: "Sicurezza del brand",
      brand: "Media del brand",
    },
    save: "Salva le impostazioni",
    reset: "Ripristina",
    resetTitle: "Tornare alle impostazioni consigliate?",
    resetBody: "Strategia, video, pubblicazione e sicurezza tornano ai suggerimenti di RepGet. Gli account, il logo, le immagini e il profilo aziendale restano come sono.",
    resetDone: "Impostazioni riportate ai valori consigliati.",
    unsaved: "Ci sono modifiche non salvate.",
    savedNote: "Le impostazioni vengono salvate per questo sito.",
    brandNote: "Il logo e le immagini vengono salvati appena li carica.",
    problems: {
      no_format: "Scelga almeno un formato.",
      cta_too_long: "L’invito all’azione deve avere meno di 120 caratteri.",
      profile_too_long: "Uno dei testi è troppo lungo.",
      bad_value: "Una delle scelte non è valida. Ricarichi la pagina.",
    },
    strategy: {
      title: "Strategia dei contenuti",
      body: "Scelga quali contenuti social RepGet deve suggerire e quanta parte deve essere pensata per essere scoperta e condivisa.",
      badge: "NOVITÀ · Virale",
      mix: "Quota di contenuti virali",
      mixHelp: "Quante idee del giorno devono usare ganci da condividere, racconti e formati ispirati alle tendenze.",
      mixBadge: "{value}% virale",
      mixLow: "0% · Come sempre",
      mixMid: "50% · Equilibrato",
      mixHigh: "100% · Massima copertura",
      viralCount: "{count} idee virali / {total}",
      otherCount: "{count} altre idee",
      goal: "Obiettivo principale",
      goalBody: "RepGet adatta i suggerimenti al risultato che desidera.",
      goals: {
        reach: { title: "Aumentare la copertura", body: "Visibilità, visualizzazioni, condivisioni e curiosità." },
        balanced: { title: "Crescita equilibrata", body: "Contenuti utili, fiducia e condivisione." },
        leads: { title: "Generare contatti", body: "Prove, servizi e inviti all’azione più forti." },
      },
      techniques: "Tecniche per contenuti virali",
      techniquesBody: "Scelga i formati adatti alla sua attività. RepGet li usa per sviluppare le idee, mai per inventare affermazioni.",
      trends: "Idee ispirate alle tendenze",
      trendsHelp: "Le idee usano formati collaudati e la conoscenza del suo settore. RepGet non dice mai che qualcosa è di tendenza senza dati.",
      disclaimer: "I contenuti virali sono pensati per coinvolgere ed essere condivisi. Non garantiscono visualizzazioni, posizionamenti o un risultato virale.",
    },
    audience: {
      title: "Pubblico e argomenti",
      body: "Descriva chi vuole raggiungere e che cosa conta per i suoi clienti.",
      shared: "Sono il suo profilo aziendale e la voce del brand. Salvandoli qui si aggiornano ovunque in RepGet.",
      targetAudience: "Pubblico di riferimento",
      topics: "Argomenti prioritari",
      language: "Lingua dei contenuti",
      languageHint: "La lingua in cui sono scritti video e post.",
      languageAuto: "La lingua del suo sito",
      market: "Mercato di riferimento",
      global: "Globale / internazionale",
      voice: "Voce del brand",
      voiceBody: "Come suonano i suoi contenuti su tutte le piattaforme.",
      toneNotes: "Il suo tono, con parole sue",
      toneNotesHint: "Resta insieme alla scelta qui sopra, come in Voce del brand.",
      avoid: "Argomenti o frasi da evitare",
      avoidPlaceholder: "Argomenti, promesse o frasi che il suo brand deve evitare",
    },
    video: {
      title: "Video e audio",
      body: "Formati, durata e presentazione dei suoi video e caroselli.",
      formats: "Formati consentiti",
      formatsBody: "Le idee si adattano ai formati scelti.",
      formatNames: { reel: "Reel / Shorts", story: "Storie", carousel: "Caroselli di foto" },
      audio: "Audio",
      audioBody: "Come suonano i suoi video.",
      audioModes: {
        auto: { title: "Automatico (consigliato)", body: "RepGet sceglie voce fuori campo oppure testo e musica per ogni idea." },
        voiceover: { title: "Voce fuori campo", body: "Narrazione IA con sottotitoli e musica." },
        text_music: { title: "Testo + musica", body: "Senza narrazione: immagini forti, testo animato e musica." },
      },
      duration: "Durata del video",
      narration: "Stile di narrazione",
      captions: "Stile dei sottotitoli",
      captionsHelp: "Le parole compaiono sullo schermo mentre vengono dette.",
      music: "Stile musicale",
      musicNote: "La musica ha la licenza per l’uso commerciale sui social.",
      hook: "Mostra il gancio iniziale sullo schermo",
      hookHelp: "Apra i video con un gancio visivo chiaro nei primi secondi.",
      cta: "Includi inviti all’azione",
      ctaHelp: "Aggiunga un breve passo successivo alla fine del video.",
      defaultCta: "Invito all’azione predefinito",
      defaultCtaHint: "Usato quando un’idea non ha una propria frase finale.",
      defaultCtaPlaceholder: "Ci segua per altri consigli pratici",
      animated: "Stile animato",
      animatedBody: "Per i video animati realizzati con i modelli di RepGet.",
    },
    publishing: {
      title: "Pubblicazione",
      body: "Scelga dove vanno i suoi video e quanto li controlla prima che vengano pubblicati.",
      platformsBody: "Le nuove piattaforme come LinkedIn e X non vengono mai aggiunte al posto suo.",
      modes: {
        manual: { title: "Controlla prima di pubblicare", body: "I video pronti aspettano che prema Pubblica." },
        draft: { title: "Salva come bozza", body: "I video creati restano in I suoi video come bozze. Nulla viene pubblicato finché non lo fa lei." },
        auto: { title: "Pubblica automaticamente le idee approvate", body: "Ogni video che crea viene pubblicato nel miglior momento disponibile." },
      },
      autoNote: "La pubblicazione automatica non crea né addebita mai video da sola. Pubblica solo i video che crea lei, al massimo 3 al giorno.",
      frequency: "Frequenza di pubblicazione",
      frequencyHint: "Per la pubblicazione automatica. RepGet distribuisce i post negli orari migliori.",
    },
    safety: {
      title: "Sicurezza del brand",
      body: "Protegga la sua reputazione mentre crea contenuti coinvolgenti.",
      always: "Sempre attiva: una protezione di base",
      clickbait: "Evitare il clickbait ingannevole",
      clickbaitHelp: "I ganci possono stimolare la curiosità, ma devono corrispondere al video ed evitare false promesse.",
      facts: "Controllare le cifre prima della pubblicazione automatica",
      factsHelp: "Cifre, classifiche e confronti che non sono sul suo sito aspettano il suo controllo.",
      competitors: "Evitare affermazioni non verificabili sui concorrenti",
      competitorsHelp: "Nessuna accusa né affermazione infondata su altri brand.",
      controversy: "Approvazione per i tagli controversi",
      controversyHelp: "Temi delicati e opinioni provocatorie aspettano la sua approvazione.",
      hint: "Le tenga attive anche con una quota virale alta. Bloccano solo la pubblicazione automatica.",
      creative: "Preferenze creative",
      creativeBody: "Le adatti al suo brand.",
      humor: {
        none: { title: "Niente umorismo", body: "Serio e diretto." },
        light: { title: "Umorismo leggero", body: "Un sorriso ogni tanto." },
        bold: { title: "Umorismo deciso", body: "Meme e battute scherzose." },
      },
      controversial: "Consentire temi controversi",
      controversialHelp: "Argomenti dibattuti nel suo settore, trattati con cura.",
      language: "Linguaggio più diretto",
      languageHelp: "Frasi più incisive, mai offensive.",
      core: "Diritto d’autore, affermazioni false, furto d’identità e contenuti illeciti sono sempre protetti, qualunque cosa scelga qui.",
    },
  },
  errors: {
    extra_used_up: "Ha già usato i 3 gruppi gratuiti di idee di oggi. Altre arrivano domani mattina.",
    busy: "Le idee sono già in scrittura. Compariranno qui tra un minuto.",
    too_soon: "Attenda un momento prima di chiedere altre idee.",
    bad_settings: "Alcune impostazioni non sono state salvate. Le controlli e riprovi.",
    bad_profile: "I dati sul pubblico non sono stati salvati. Li controlli e riprovi.",
    review_required: "Questo video va controllato prima di essere pubblicato automaticamente.",
    x_not_configured: "X non è ancora configurato.",
    x_budget: "Limite di spesa di X raggiunto",
    no_story: "Lì le Storie non sono supportate",
    too_long: "Troppo lungo per questa piattaforma",
    no_carousel: "Lì i caroselli non sono supportati",
    audio_unavailable: "L’audio di Instagram non è disponibile per questo account.",
  },
};

const viralDe: ViralCopy = {
  newIdeas: {
    kinds: {
      mixed: { title: "Neue Ideen für heute", body: "Weitere passende Themen entdecken" },
      viral: { title: "Virale Ideen erzeugen", body: "Aufhänger und Formate für mehr Reichweite" },
      website: { title: "Ideen aus Ihrer Website", body: "Produkte und Leistungen zeigen" },
    },
    left: "Kostenlos · heute noch {left} von {total}",
    free: "Jeder Klick bringt 10 Ideen. Ideen sind kostenlos; nur das Erstellen eines Videos kostet Credits.",
    writing: "Ideen werden geschrieben…",
    queued: "10 neue Ideen werden geschrieben. Sie erscheinen hier in einer Minute.",
    busy: "Neue Ideen werden gerade geschrieben. Sie erscheinen hier in einer Minute.",
    usedUp: "Sie haben die 3 kostenlosen Pakete von heute genutzt. Neue Ideen kommen morgen früh.",
    tooSoon: "Bitte warten Sie einen Moment, bevor Sie weitere Ideen anfordern.",
  },
  categories: { all: "Alle Ideen", viral: "Viral", educational: "Lehrreich", authority: "Expertise", promotional: "Werbend" },
  categoryHelp: {
    all: "Wählen Sie, welche Art von Inhalt Sie erstellen möchten",
    viral: "Inhalte, die neugierig machen, gemacht zum Entdecken und Teilen",
    educational: "Nützliche Tipps und Antworten, die Ihre Kunden suchen",
    authority: "Ihr Fachwissen und ein Blick hinter die Kulissen",
    promotional: "Ihre Produkte und Leistungen, mit einem klaren nächsten Schritt",
  },
  filters: {
    label: "Inhaltsart",
    empty: "Keine Ideen passen zu diesen Filtern",
    emptyBody: "Versuchen Sie eine andere Inhaltsart oder ein anderes Format, oder fordern Sie neue Ideen an.",
    clear: "Filter zurücksetzen",
  },
  browse: {
    previous: "Vorherige Idee",
    next: "Nächste Idee",
    hint: "‹ › blättern nur durch die Ideen. Erstellen macht das Video; Überspringen legt die Idee beiseite.",
  },
  undoSkip: "Die Idee ist zurück.",
  viralBadge: "✦ Viral",
  formats: { reel: "Reel", story: "Story", carousel: "Karussell", stories: "Storys" },
  directions: {
    meme: "Meme",
    footage: "Echte Aufnahmen",
    storytelling: "Storytelling",
    text_music: "Text + Musik",
    voiceover: "Sprecherstimme",
    animated: "Animiert",
  },
  audio: { voiceover: "Sprecherstimme", text_music: "Text + Musik" },
  narration: { natural: "Natürlich und im Gesprächston", warm: "Warm und filmisch", energetic: "Energisch und schwungvoll" },
  captionStyles: { bold: "Hervorgehobene Wörter", editorial: "Klare redaktionelle Untertitel", minimal: "Dezente Untertitel" },
  music: { auto: "Passend zum Inhalt", cinematic: "Filmisch", upbeat: "Schwungvoll", ambient: "Ambient / dezent", none: "Keine Musik" },
  durations: { "15-30": "15–30 Sekunden", "30-45": "30–45 Sekunden", "45-60": "45–60 Sekunden", "60-90": "60–90 Sekunden" },
  techniques: {
    curiosity_hooks: "Neugier-Aufhänger",
    trend_inspired: "Von Trends inspirierte Formate",
    myth_busting: "Mythen widerlegen",
    hot_takes: "Steile Thesen",
    before_after: "Vorher und nachher",
    unexpected_facts: "Überraschende Fakten",
    comparisons: "Vergleiche",
    storytelling: "Storytelling",
  },
  tonePresets: {
    professional: { title: "Professionell", body: "Klar, souverän und gepflegt." },
    bold: { title: "Mutig", body: "Mehr Energie und stärkere Einstiege." },
    playful: { title: "Verspielt", body: "Witzig, locker und einnehmend." },
  },
  frequencies: {
    "3_week": "3-mal pro Woche",
    "5_week": "5-mal pro Woche",
    "1_day": "1 Beitrag pro Tag",
    "2_day": "2 Beiträge pro Tag",
    legacy: "Sobald Videos erstellt sind (bis zu 3 am Tag)",
  },
  why: { title: "Warum das gut ankommen könnte", note: "Eine gute Idee hilft, aber nichts garantiert Aufrufe." },
  review: {
    title: "Bitte prüfen: {reasons}",
    reasons: { unverified_claim: "Zahlen oder Fakten", controversial: "ein kontroverser Ansatz", sensitive: "ein heikles Thema" },
    what: "Prüfen Sie diese anhand Ihrer eigenen Informationen:",
    note: "Das hält nur das automatische Posten an. Sie können es trotzdem selbst erstellen und veröffentlichen.",
    approve: "Ich habe es geprüft",
    done: "Geprüft. Es kann jetzt automatisch gepostet werden.",
    checked: "Von Ihnen geprüft",
  },
  previewConcept: "Konzeptvorschau, ohne Ton. Aufnahmen, Stimme und Musik werden beim Erstellen des Videos gewählt.",
  noCta: "Kein Handlungsaufruf",
  edit: {
    description: "Ändern Sie die Idee, bevor sie erstellt wird. Speichern ist kostenlos; nur das Erstellen kostet Credits.",
    script: "Skript",
    making: "So wird es gemacht",
    title: "Titel",
    category: "Inhaltsart",
    direction: "Kreative Richtung",
    audio: "Ton",
    narration: "Sprechstil",
    captionStyle: "Untertitelstil",
    musicDirection: "Musikrichtung",
    duration: "Länge",
    showHook: "Aufhänger am Anfang einblenden",
    includeCta: "Handlungsaufruf einfügen",
    ctaText: "Handlungsaufruf",
    ctaHint: "Leer lassen, um den Schlusssatz zu verwenden.",
    onlyThis: "Nur dieses Video",
    onlyThisBody: "Das ändert nur dieses Video. Ihr Unternehmensprofil und Ihre Markenstimme bleiben, wie sie sind.",
    audience: "Zielgruppe",
    tonePreset: "Markenstimme",
    tone: "Tonfall",
    avoid: "Vermeiden",
    sameAsBrand: "Wie Ihre Markenstimme",
    samePlaceholder: "Wie in Ihrem Unternehmensprofil",
    rewrite: "Damit neu schreiben",
    rewriteHelp: "Neu schreiben ist kostenlos: RepGet schreibt das Skript mit Ihren Vorgaben neu.",
    rewritten: "Neu geschrieben. Das neue Skript steht in der Idee.",
  },
  compat: {
    title: "Vor dem Veröffentlichen prüfen",
    no_story: "{platform} nimmt keine Storys von RepGet an, daher wird diese Story nicht dorthin gesendet.",
    too_long: "{platform} nimmt keine Videos mit {length} an.",
    no_carousel: "{platform} nimmt hier keine Karussells an, daher wird dieses Karussell nicht dorthin gesendet.",
    other: "{platform} kann dieses Video nicht annehmen.",
  },
  draft: { badge: "Entwurf", body: "Entwurf - veröffentlichen Sie ihn, wann Sie möchten." },
  destinations: {
    label: "Wohin es ging",
    status: { pending: "Wartet", scheduled: "Geplant", posting: "Wird veröffentlicht", posted: "Gepostet", failed: "Fehlgeschlagen", skipped: "Ausgelassen" },
  },
  nativeAudio: {
    button: "Instagram-Audio",
    title: "Instagram-Audio",
    honest: "Die fertige Mischung mit dem Instagram-Audio ist nur auf Instagram zu hören. Andere Plattformen und der Download behalten die lizenzierte Musik von RepGet.",
    unavailable: "Instagram-Audio ist für dieses Konto noch nicht verfügbar.",
    search: "Instagram-Audio durchsuchen",
    searchButton: "Suchen",
    none: "Nichts gefunden. Versuchen Sie andere Wörter.",
    trending: "Im Trend auf Instagram",
    use: "Verwenden",
    current: "Gewählt",
    remove: "Instagram-Audio entfernen",
    saved: "Instagram-Audio für dieses Reel gewählt.",
    removed: "Instagram-Audio entfernt.",
    chosen: "Instagram-Audio: {title} {artist}",
  },
  x: {
    needsSetup: "X muss eingerichtet werden: RepGet postet dort erst, wenn X mit einem Ausgabenlimit eingerichtet ist.",
    budget: "X hat sein Ausgabenlimit vorerst erreicht. RepGet postet dort wieder, sobald das Limit es erlaubt.",
  },
  linkedin: { help: "Ihr Profil oder eine Unternehmensseite." },
  settings: {
    open: "Inhaltseinstellungen",
    sidebar: "Präferenzen",
    panes: {
      strategy: "Inhaltsstrategie",
      audience: "Zielgruppe und Themen",
      video: "Video und Ton",
      publishing: "Veröffentlichen",
      safety: "Markensicherheit",
      brand: "Markenmedien",
    },
    save: "Einstellungen speichern",
    reset: "Zurücksetzen",
    resetTitle: "Auf die empfohlenen Einstellungen zurücksetzen?",
    resetBody: "Strategie, Video, Veröffentlichen und Sicherheit gehen auf die Empfehlungen von RepGet zurück. Ihre Konten, Ihr Logo, Ihre Bilder und Ihr Unternehmensprofil bleiben, wie sie sind.",
    resetDone: "Einstellungen auf die Empfehlungen zurückgesetzt.",
    unsaved: "Sie haben ungespeicherte Änderungen.",
    savedNote: "Die Einstellungen werden für diese Website gespeichert.",
    brandNote: "Ihr Logo und Ihre Bilder werden gespeichert, sobald Sie sie hochladen.",
    problems: {
      no_format: "Wählen Sie mindestens ein Format.",
      cta_too_long: "Der Handlungsaufruf darf höchstens 120 Zeichen haben.",
      profile_too_long: "Einer der Texte ist zu lang.",
      bad_value: "Eine der Auswahlen ist ungültig. Bitte laden Sie die Seite neu.",
    },
    strategy: {
      title: "Inhaltsstrategie",
      body: "Wählen Sie, welche Social-Media-Inhalte RepGet vorschlagen soll und wie viel davon auf Entdecken und Teilen ausgelegt ist.",
      badge: "NEU · Viral",
      mix: "Anteil viraler Inhalte",
      mixHelp: "Wie viele Ihrer täglichen Ideen teilbare Aufhänger, Geschichten und von Trends inspirierte Formate nutzen sollen.",
      mixBadge: "{value} % viral",
      mixLow: "0 % · Wie gewohnt",
      mixMid: "50 % · Ausgewogen",
      mixHigh: "100 % · Reichweite zuerst",
      viralCount: "{count} virale Ideen / {total}",
      otherCount: "{count} andere Ideen",
      goal: "Wichtigstes Ziel",
      goalBody: "RepGet passt seine Vorschläge an das Ergebnis an, das Sie wollen.",
      goals: {
        reach: { title: "Reichweite steigern", body: "Sichtbarkeit, Aufrufe, Teilen und Neugier." },
        balanced: { title: "Ausgewogenes Wachstum", body: "Nützliche Inhalte, Vertrauen und Teilbarkeit." },
        leads: { title: "Anfragen gewinnen", body: "Belege, Leistungen und stärkere Handlungsaufrufe." },
      },
      techniques: "Techniken für virale Inhalte",
      techniquesBody: "Wählen Sie die Formate, die zu Ihrem Unternehmen passen. RepGet nutzt sie für Ideen, nie für erfundene Behauptungen.",
      trends: "Von Trends inspirierte Ideen",
      trendsHelp: "Die Ideen nutzen bewährte Formate und Wissen aus Ihrer Branche. RepGet sagt nie ohne Daten, dass etwas im Trend liegt.",
      disclaimer: "Virale Inhalte sind auf Interaktion und Teilen ausgelegt. Sie garantieren keine Aufrufe, Platzierungen oder virale Wirkung.",
    },
    audience: {
      title: "Zielgruppe und Themen",
      body: "Beschreiben Sie, wen Sie erreichen möchten und was Ihren Kunden wichtig ist.",
      shared: "Das sind Ihr Unternehmensprofil und Ihre Markenstimme. Wenn Sie hier speichern, ändern sie sich überall in RepGet.",
      targetAudience: "Zielgruppe",
      topics: "Themen mit Vorrang",
      language: "Sprache der Inhalte",
      languageHint: "Die Sprache, in der Ihre Videos und Beiträge geschrieben werden.",
      languageAuto: "Die Sprache Ihrer Website",
      market: "Zielmarkt",
      global: "Weltweit / international",
      voice: "Markenstimme",
      voiceBody: "Wie Ihre Inhalte auf allen Plattformen klingen.",
      toneNotes: "Ihr Tonfall in Ihren Worten",
      toneNotesHint: "Bleibt neben der Auswahl oben erhalten, wie bei der Markenstimme.",
      avoid: "Diese Themen oder Formulierungen vermeiden",
      avoidPlaceholder: "Themen, Versprechen oder Formulierungen, die Ihre Marke vermeiden soll",
    },
    video: {
      title: "Video und Ton",
      body: "Formate, Länge und Darstellung Ihrer Videos und Karussells.",
      formats: "Erlaubte Formate",
      formatsBody: "Die Ideen richten sich nach den gewählten Formaten.",
      formatNames: { reel: "Reels / Shorts", story: "Storys", carousel: "Foto-Karussells" },
      audio: "Ton",
      audioBody: "Wie Ihre Videos klingen.",
      audioModes: {
        auto: { title: "Automatisch (empfohlen)", body: "RepGet wählt für jede Idee Sprecherstimme oder Text und Musik." },
        voiceover: { title: "Sprecherstimme", body: "KI-Sprecher mit Untertiteln und Musik." },
        text_music: { title: "Text + Musik", body: "Ohne Sprecher: starke Bilder, animierter Text und Musik." },
      },
      duration: "Gewünschte Videolänge",
      narration: "Sprechstil",
      captions: "Untertitelstil",
      captionsHelp: "Die Wörter erscheinen, während sie gesprochen werden.",
      music: "Musikrichtung",
      musicNote: "Die Musik ist für die gewerbliche Nutzung in sozialen Netzwerken lizenziert.",
      hook: "Aufhänger am Anfang einblenden",
      hookHelp: "Videos mit einem klaren visuellen Aufhänger in den ersten Sekunden beginnen.",
      cta: "Handlungsaufrufe einfügen",
      ctaHelp: "Am Ende des Videos einen kurzen nächsten Schritt zeigen.",
      defaultCta: "Standard-Handlungsaufruf",
      defaultCtaHint: "Wird verwendet, wenn eine Idee keinen eigenen Schlusssatz hat.",
      defaultCtaPlaceholder: "Folgen Sie uns für mehr praktische Tipps",
      animated: "Animierter Stil",
      animatedBody: "Für animierte Videos aus den Vorlagen von RepGet.",
    },
    publishing: {
      title: "Veröffentlichen",
      body: "Wählen Sie, wohin Ihre Videos gehen und wie viel Sie vor dem Veröffentlichen prüfen.",
      platformsBody: "Neue Plattformen wie LinkedIn und X werden nie ohne Ihre Wahl hinzugefügt.",
      modes: {
        manual: { title: "Vor dem Veröffentlichen prüfen", body: "Fertige Videos warten, bis Sie auf Veröffentlichen tippen." },
        draft: { title: "Als Entwurf speichern", body: "Erstellte Videos bleiben als Entwürfe unter Ihre Videos. Nichts wird gepostet, bis Sie veröffentlichen." },
        auto: { title: "Freigegebene Ideen automatisch veröffentlichen", body: "Jedes Video, das Sie erstellen, wird zur besten freien Zeit veröffentlicht." },
      },
      autoNote: "Automatisches Posten erstellt oder berechnet nie selbst Videos. Es veröffentlicht nur die Videos, die Sie erstellen, höchstens 3 am Tag.",
      frequency: "Posting-Häufigkeit",
      frequencyHint: "Für automatisches Posten. RepGet verteilt die Beiträge auf die besten Zeiten.",
    },
    safety: {
      title: "Markensicherheit",
      body: "Schützen Sie Ihren Ruf, während Sie ansprechende Inhalte erstellen.",
      always: "Immer aktiv: ein Grundschutz",
      clickbait: "Irreführenden Clickbait vermeiden",
      clickbaitHelp: "Aufhänger dürfen neugierig machen, müssen aber zum Video passen und dürfen nichts Falsches versprechen.",
      facts: "Zahlen vor dem automatischen Posten prüfen",
      factsHelp: "Zahlen, Rankings und Vergleiche, die nicht auf Ihrer Website stehen, warten auf Ihre Prüfung.",
      competitors: "Unbelegbare Aussagen über Wettbewerber vermeiden",
      competitorsHelp: "Keine Vorwürfe oder unbelegten Aussagen über andere Marken.",
      controversy: "Freigabe für kontroverse Ansätze",
      controversyHelp: "Heikle Themen und provokante Thesen warten auf Ihre Freigabe.",
      hint: "Lassen Sie diese auch bei hohem viralem Anteil an. Sie halten nur das automatische Posten an.",
      creative: "Kreative Vorlieben",
      creativeBody: "Passen Sie diese an Ihre Marke an.",
      humor: {
        none: { title: "Kein Humor", body: "Ernst und sachlich." },
        light: { title: "Leichter Humor", body: "Ab und zu ein Lächeln." },
        bold: { title: "Kräftiger Humor", body: "Memes und verspielte Witze." },
      },
      controversial: "Kontroverse Themen erlauben",
      controversialHelp: "Umstrittene Themen Ihrer Branche, mit Sorgfalt behandelt.",
      language: "Deutlichere Sprache",
      languageHelp: "Pointiertere Formulierungen, nie beleidigend.",
      core: "Urheberrecht, falsche Behauptungen, Identitätsmissbrauch und rechtswidrige Inhalte sind immer geschützt, egal was Sie hier wählen.",
    },
  },
  errors: {
    extra_used_up: "Sie haben die 3 kostenlosen Ideenpakete von heute genutzt. Neue kommen morgen früh.",
    busy: "Ideen werden bereits geschrieben. Sie erscheinen hier in einer Minute.",
    too_soon: "Bitte warten Sie einen Moment, bevor Sie weitere Ideen anfordern.",
    bad_settings: "Einige Einstellungen konnten nicht gespeichert werden. Bitte prüfen Sie sie und versuchen Sie es erneut.",
    bad_profile: "Die Angaben zur Zielgruppe konnten nicht gespeichert werden. Bitte prüfen Sie sie und versuchen Sie es erneut.",
    review_required: "Dieses Video muss geprüft werden, bevor es automatisch gepostet werden kann.",
    x_not_configured: "X ist noch nicht eingerichtet.",
    x_budget: "Ausgabenlimit für X erreicht",
    no_story: "Storys werden dort nicht unterstützt",
    too_long: "Zu lang für diese Plattform",
    no_carousel: "Karussells werden dort nicht unterstützt",
    audio_unavailable: "Instagram-Audio ist für dieses Konto nicht verfügbar.",
  },
};

const en: VideosCopy = {
  title: "Social Content",
  intro: "Short animated videos and photo carousels made from your website, with an AI voice, captions and music. Swipe through today's ideas: the ones you keep are made and published for you.",
  tabs: { ideas: "Today's ideas", videos: "Your videos", posted: "Posted", settings: "Settings" },
  today: "{approved} of {goal} made today",
  dayComplete: "Today is complete",
  dayCompleteBody: "You have made today's {goal} videos. You can make more from the ideas left; each one uses a credit.",
  newIdeas: "New ideas",
  dayFull: "Today's ideas are all written. New ones arrive tomorrow morning.",
  ideasQueued: "Writing today's ideas. They appear here in a minute.",
  writingIdeas: "Writing today's ideas…",
  writingIdeasBody: "RepGet is reading your website and writing 20 video ideas. This takes about a minute.",
  noIdeasLeft: "You have seen all of today's ideas",
  noIdeasLeftBody: "New ideas arrive every morning.",
  ideaOf: "Idea {index} of {count}",
  reel: "Reel",
  carousel: "Carousel",
  styles: { bold: "Bold", numbers: "Numbers", story: "Story" },
  styleHelp: {
    bold: "Big headlines and an animated checklist.",
    numbers: "Each point as a figure that counts up.",
    story: "Your pictures and clips, with the words over them.",
  },
  skip: "Skip",
  undo: "Undo",
  undone: "Taken back: it will not be made, and the credit is returned.",
  edit: "Edit",
  approve: "Create · {price}",
  approved: "Being made. You will find it under Your videos.",
  swipeHint: "Swipe right (on a phone) or press → to make it, left or ← to skip. Made one by mistake? Press Undo within 10 seconds.",
  previewNote: "Preview without the voice. The finished video has the AI voice, captions and music.",
  slide: "Slide {index}",
  editTitle: "Edit the idea",
  hook: "First line (the hook)",
  point: "Point {index}",
  pointTitle: "On screen",
  pointDetail: "The voice adds",
  stat: "A figure (optional)",
  statValue: "Number",
  statSuffix: "Unit",
  statLabel: "Label",
  addPoint: "Add a point",
  removePoint: "Remove",
  proof: "Proof",
  cta: "Closing line",
  caption: "Post text",
  style: "Style",
  format: "Format",
  voice: "Voice",
  voiceOff: "No voice",
  music: "Music",
  musicAuto: "Chosen for you",
  musicNone: "No music",
  captions: "Captions",
  pictures: "Pictures and clips",
  addPicture: "Add from your library",
  noPictures: "No pictures yet: the scenes use your brand colours.",
  save: "Save",
  saved: "Saved",
  cancel: "Cancel",
  saveAndApprove: "Save and make it",
  noVideos: "No videos yet",
  noVideosBody: "Approve an idea on Today's ideas and it is made here in a few minutes.",
  status: {
    approved: "Waiting",
    making: "Being made",
    ready: "Ready",
    scheduled: "Scheduled",
    posting: "Publishing",
    posted: "Posted",
    failed: "Not made",
  },
  makingBody: "The voice, captions and video are being made. This takes 2 to 5 minutes.",
  scheduledFor: "Publishes {date}",
  download: "Download",
  downloadSlide: "Slide {index}",
  publishTo: "Publish to",
  publishNow: "Publish now",
  publishBest: "At the best time",
  publishAt: "At a time",
  schedule: "Schedule",
  unschedule: "Unschedule",
  publishing: "Publishing…",
  published: "Sent to the platforms.",
  scheduledToast: "Scheduled for {date}.",
  retry: "Try again",
  failedBody: "Your credit was returned.",
  connectFirst: "Connect Instagram, TikTok, YouTube, Facebook or Pinterest in Settings to publish from here. You can always download the video.",
  carouselNote: "YouTube and Pinterest take videos only here, so carousels go to the other platforms.",
  noPosted: "Nothing posted yet.",
  views: "Views",
  likes: "Likes",
  comments: "Comments",
  shares: "Shares",
  totalViews: "{count} views",
  open: "Open",
  statsUpdated: "Updated {date}",
  accounts: "Accounts",
  accountsBody: "Connect the accounts RepGet publishes your videos to. You sign in on the platform itself; RepGet never sees your password.",
  connect: "Connect",
  connecting: "Opening…",
  disconnect: "Disconnect",
  connected: "Connected",
  paused: "Paused: {reason}",
  resume: "Resume",
  notConfigured: "Publishing is not set up on this RepGet yet. You can still make and download videos.",
  defaults: "Your videos",
  defaultStyle: "Style",
  defaultVoice: "Voice",
  musicOn: "Background music",
  captionsOn: "Captions",
  publishMode: "Publishing",
  publishManual: "I publish each video",
  publishManualHelp: "Ready videos wait for you to press Publish.",
  publishAuto: "Publish automatically",
  publishAutoHelp: "Each video you make is published at the next good time.",
  platforms: "Publish to",
  logo: "Logo",
  logoHelp: "Shown on the closing card. Without one, the first letter of your brand is shown.",
  uploadLogo: "Upload a logo",
  removeLogo: "Remove",
  library: "Your pictures and clips",
  libraryHelp: "Photos (PNG, JPG, WebP, up to 8 MB) and short clips (MP4, MOV, WebM, up to 50 MB) used in the Story style and anywhere you add them.",
  upload: "Upload",
  uploading: "Uploading…",
  remove: "Remove",
  safety: "How RepGet keeps your accounts safe",
  safetyPoints: [
    "At most 3 videos a day on each platform.",
    "Every video is different: no repeated content.",
    "If a platform refuses a video, RepGet pauses posting there until you resume it.",
    "Free music that is licensed for use in videos, and your own pictures.",
    "Video files are deleted 7 days after posting.",
  ],
  trialNote: "Videos are included in your trial.",
  notice: {
    connected: "{platform} is connected.",
    not_connected: "{platform} was not connected.",
    connect_failed: "{platform} could not be connected. Please try again.",
  },
  meta: { ideas: "{count} idea|{count} ideas", ideasLabel: "ready to review|ready to review", madeLabel: "made today", credits: "available|available" },
  filter: { label: "Format", all: "All formats", reel: "Reels", carousel: "Carousels" },
  focus: { on: "Focus mode", off: "Show details", hint: "Focus mode: only the preview and Create. Press Esc to leave it." },
  detail: {
    eyebrow: "Content idea",
    carouselSlides: "Carousel · {count} slides",
    hook: "The opening hook",
    concept: "The concept",
    captionMore: "View the full post text",
    captionLess: "Show less",
    readyFor: "Goes to",
    noPlatforms: "No platform is chosen in Settings.",
  },
  list: {
    search: "Search your videos and carousels",
    all: "All content",
    reels: "Videos",
    carousels: "Carousels",
    count: "{shown} of {total}",
    empty: "Nothing matches. Try another search or format.",
    preview: "Preview",
    publish: "Publish",
    close: "Close",
    seconds: "{seconds} s",
    slides: "{count} slides",
  },
  postedEmpty: { ideas: "Discover ideas", videos: "View your videos" },
  cards: {
    style: "Video and carousel style",
    styleBody: "How your content looks and sounds.",
    publishing: "Publishing",
    publishingBody: "How, when and where your posts go live.",
    brand: "Your brand media",
    brandBody: "Your logo, pictures and clips, so that every post is clearly yours.",
  },
  pinterest: {
    board: "Board: {board}",
    noBoard: "No board chosen yet. Pins need one.",
    chooseBoard: "Choose the board on Opportunities",
    shared: "The same account and board as your Pins on Opportunities. Pinterest takes the videos; carousels go to the other platforms.",
  },
  errors: {
    view_only: "You can view this website but not change it.",
    no_plan: "Choose a plan for this website to make videos.",
    not_found: "This idea is no longer there.",
    already_handled: "This idea has already been handled.",
    not_enough_credits: "This needs {price} and you have {available}. Buy credits on Credits.",
    bad_script: "Fill in the first line and at least two points.",
    no_accounts: "Connect at least one platform for this video in Settings.",
    no_board: "Choose a Pinterest board first, on Opportunities under Your accounts. Or untick Pinterest to publish to the other platforms.",
    not_configured: "This is not set up on this RepGet yet.",
    connect_failed: "The connection page could not be opened. Please try again.",
    bad_file: "Use a PNG, JPG or WebP picture, or an MP4, MOV or WebM clip.",
    too_big: "This file is too big.",
    bad_time: "Choose a time in the next 60 days.",
    day_full: "You have had today's ideas. New ones arrive tomorrow morning.",
    generic: "Something went wrong. Please try again.",
  },
  viral: viralEn,
};

const es: VideosCopy = {
  title: "Contenido social",
  intro: "Vídeos animados cortos y carruseles de fotos creados a partir de su sitio web, con voz de IA, subtítulos y música. Deslice las ideas de hoy: las que conserve se crean y se publican por usted.",
  tabs: { ideas: "Ideas de hoy", videos: "Sus vídeos", posted: "Publicados", settings: "Ajustes" },
  today: "{approved} de {goal} creados hoy",
  dayComplete: "El día de hoy está completo",
  dayCompleteBody: "Ya ha creado los {goal} vídeos de hoy. Puede crear más con las ideas restantes; cada uno usa un crédito.",
  newIdeas: "Nuevas ideas",
  dayFull: "Las ideas de hoy ya están escritas. Mañana por la mañana llegan nuevas.",
  ideasQueued: "Escribiendo las ideas de hoy. Aparecerán aquí en un minuto.",
  writingIdeas: "Escribiendo las ideas de hoy…",
  writingIdeasBody: "RepGet está leyendo su sitio web y escribiendo 20 ideas de vídeo. Tarda alrededor de un minuto.",
  noIdeasLeft: "Ha visto todas las ideas de hoy",
  noIdeasLeftBody: "Cada mañana llegan nuevas ideas.",
  ideaOf: "Idea {index} de {count}",
  reel: "Reel",
  carousel: "Carrusel",
  styles: { bold: "Impacto", numbers: "Cifras", story: "Historia" },
  styleHelp: {
    bold: "Grandes titulares y una lista animada.",
    numbers: "Cada punto como una cifra que va subiendo.",
    story: "Sus imágenes y clips, con el texto encima.",
  },
  skip: "Omitir",
  undo: "Deshacer",
  undone: "Deshecho: no se creará y se le devuelve el crédito.",
  edit: "Editar",
  approve: "Crear · {price}",
  approved: "Se está creando. Lo encontrará en Sus vídeos.",
  swipeHint: "Deslice a la derecha (en el móvil) o pulse → para crearlo, a la izquierda o ← para omitirlo. ¿Lo creó por error? Pulse Deshacer en 10 segundos.",
  previewNote: "Vista previa sin la voz. El vídeo final tiene la voz de IA, subtítulos y música.",
  slide: "Diapositiva {index}",
  editTitle: "Editar la idea",
  hook: "Primera línea (el gancho)",
  point: "Punto {index}",
  pointTitle: "En pantalla",
  pointDetail: "La voz añade",
  stat: "Una cifra (opcional)",
  statValue: "Número",
  statSuffix: "Unidad",
  statLabel: "Etiqueta",
  addPoint: "Añadir un punto",
  removePoint: "Quitar",
  proof: "Prueba",
  cta: "Frase final",
  caption: "Texto de la publicación",
  style: "Estilo",
  format: "Formato",
  voice: "Voz",
  voiceOff: "Sin voz",
  music: "Música",
  musicAuto: "Elegida para usted",
  musicNone: "Sin música",
  captions: "Subtítulos",
  pictures: "Imágenes y clips",
  addPicture: "Añadir de su biblioteca",
  noPictures: "Aún no hay imágenes: las escenas usan los colores de su marca.",
  save: "Guardar",
  saved: "Guardado",
  cancel: "Cancelar",
  saveAndApprove: "Guardar y crear",
  noVideos: "Aún no hay vídeos",
  noVideosBody: "Apruebe una idea en Ideas de hoy y se creará aquí en unos minutos.",
  status: {
    approved: "En espera",
    making: "En creación",
    ready: "Listo",
    scheduled: "Programado",
    posting: "Publicando",
    posted: "Publicado",
    failed: "No creado",
  },
  makingBody: "Se están creando la voz, los subtítulos y el vídeo. Tarda de 2 a 5 minutos.",
  scheduledFor: "Se publica el {date}",
  download: "Descargar",
  downloadSlide: "Diapositiva {index}",
  publishTo: "Publicar en",
  publishNow: "Publicar ahora",
  publishBest: "A la mejor hora",
  publishAt: "A una hora",
  schedule: "Programar",
  unschedule: "Desprogramar",
  publishing: "Publicando…",
  published: "Enviado a las plataformas.",
  scheduledToast: "Programado para el {date}.",
  retry: "Reintentar",
  failedBody: "Se le ha devuelto el crédito.",
  connectFirst: "Conecte Instagram, TikTok, YouTube, Facebook o Pinterest en Ajustes para publicar desde aquí. Siempre puede descargar el vídeo.",
  carouselNote: "Aquí YouTube y Pinterest solo reciben vídeos, así que los carruseles van a las demás plataformas.",
  noPosted: "Todavía no hay nada publicado.",
  views: "Visualizaciones",
  likes: "Me gusta",
  comments: "Comentarios",
  shares: "Compartidos",
  totalViews: "{count} visualizaciones",
  open: "Abrir",
  statsUpdated: "Actualizado el {date}",
  accounts: "Cuentas",
  accountsBody: "Conecte las cuentas en las que RepGet publica sus vídeos. Usted inicia sesión en la propia plataforma; RepGet nunca ve su contraseña.",
  connect: "Conectar",
  connecting: "Abriendo…",
  disconnect: "Desconectar",
  connected: "Conectado",
  paused: "En pausa: {reason}",
  resume: "Reanudar",
  notConfigured: "La publicación todavía no está configurada en este RepGet. Puede seguir creando y descargando vídeos.",
  defaults: "Sus vídeos",
  defaultStyle: "Estilo",
  defaultVoice: "Voz",
  musicOn: "Música de fondo",
  captionsOn: "Subtítulos",
  publishMode: "Publicación",
  publishManual: "Publico cada vídeo yo",
  publishManualHelp: "Los vídeos listos esperan a que pulse Publicar.",
  publishAuto: "Publicar automáticamente",
  publishAutoHelp: "Cada vídeo que cree se publica en el siguiente buen momento.",
  platforms: "Publicar en",
  logo: "Logotipo",
  logoHelp: "Se muestra en la tarjeta final. Si no tiene uno, se muestra la inicial de su marca.",
  uploadLogo: "Subir un logotipo",
  removeLogo: "Quitar",
  library: "Sus imágenes y clips",
  libraryHelp: "Fotos (PNG, JPG, WebP, hasta 8 MB) y clips cortos (MP4, MOV, WebM, hasta 50 MB) que se usan en el estilo Historia y donde usted los añada.",
  upload: "Subir",
  uploading: "Subiendo…",
  remove: "Quitar",
  safety: "Cómo RepGet mantiene seguras sus cuentas",
  safetyPoints: [
    "Como máximo 3 vídeos al día en cada plataforma.",
    "Cada vídeo es distinto: sin contenido repetido.",
    "Si una plataforma rechaza un vídeo, RepGet pausa las publicaciones allí hasta que usted las reanude.",
    "Música gratuita con licencia para usarse en vídeos, y sus propias imágenes.",
    "Los archivos de vídeo se eliminan 7 días después de publicarse.",
  ],
  trialNote: "Los vídeos están incluidos en su prueba.",
  notice: {
    connected: "{platform} está conectado.",
    not_connected: "No se conectó {platform}.",
    connect_failed: "No se pudo conectar {platform}. Inténtelo de nuevo.",
  },
  meta: { ideas: "{count} idea|{count} ideas", ideasLabel: "lista para revisar|listas para revisar", madeLabel: "creados hoy", credits: "disponible|disponibles" },
  filter: { label: "Formato", all: "Todos los formatos", reel: "Reels", carousel: "Carruseles" },
  focus: { on: "Modo enfoque", off: "Mostrar detalles", hint: "Modo enfoque: solo la vista previa y Crear. Pulse Esc para salir." },
  detail: {
    eyebrow: "Idea de contenido",
    carouselSlides: "Carrusel · {count} diapositivas",
    hook: "El gancho inicial",
    concept: "El concepto",
    captionMore: "Ver el texto completo",
    captionLess: "Ver menos",
    readyFor: "Se publica en",
    noPlatforms: "No hay ninguna plataforma elegida en Ajustes.",
  },
  list: {
    search: "Buscar en sus vídeos y carruseles",
    all: "Todo el contenido",
    reels: "Vídeos",
    carousels: "Carruseles",
    count: "{shown} de {total}",
    empty: "No hay resultados. Pruebe otra búsqueda u otro formato.",
    preview: "Vista previa",
    publish: "Publicar",
    close: "Cerrar",
    seconds: "{seconds} s",
    slides: "{count} diapositivas",
  },
  postedEmpty: { ideas: "Descubrir ideas", videos: "Ver sus vídeos" },
  cards: {
    style: "Estilo de vídeos y carruseles",
    styleBody: "Cómo se ve y cómo suena su contenido.",
    publishing: "Publicación",
    publishingBody: "Cómo, cuándo y dónde se publica su contenido.",
    brand: "Los medios de su marca",
    brandBody: "Su logotipo, sus imágenes y sus clips, para que cada publicación sea claramente suya.",
  },
  pinterest: {
    board: "Tablero: {board}",
    noBoard: "Aún no ha elegido un tablero. Los pines lo necesitan.",
    chooseBoard: "Elegir el tablero en Oportunidades",
    shared: "La misma cuenta y el mismo tablero que sus pines en Oportunidades. Pinterest recibe los vídeos; los carruseles van a las demás plataformas.",
  },
  errors: {
    view_only: "Puede ver este sitio web, pero no modificarlo.",
    no_plan: "Elija un plan para este sitio web para crear vídeos.",
    not_found: "Esta idea ya no está disponible.",
    already_handled: "Esta idea ya se ha gestionado.",
    not_enough_credits: "Esto cuesta {price} y tiene {available}. Compre créditos en Créditos.",
    bad_script: "Rellene la primera línea y al menos dos puntos.",
    no_accounts: "Conecte al menos una plataforma para este vídeo en Ajustes.",
    no_board: "Elija primero un tablero de Pinterest, en Oportunidades, en Sus cuentas. O desmarque Pinterest para publicar en las demás plataformas.",
    not_configured: "Esto todavía no está configurado en este RepGet.",
    connect_failed: "No se pudo abrir la página de conexión. Inténtelo de nuevo.",
    bad_file: "Use una imagen PNG, JPG o WebP, o un clip MP4, MOV o WebM.",
    too_big: "Este archivo es demasiado grande.",
    bad_time: "Elija una hora dentro de los próximos 60 días.",
    day_full: "Ya ha recibido las ideas de hoy. Mañana por la mañana llegan nuevas.",
    generic: "Algo salió mal. Inténtelo de nuevo.",
  },
  viral: viralEs,
};

const fr: VideosCopy = {
  title: "Contenu social",
  intro: "De courtes vidéos animées et des carrousels de photos créés à partir de votre site, avec une voix IA, des sous-titres et de la musique. Faites défiler les idées du jour : celles que vous gardez sont créées et publiées pour vous.",
  tabs: { ideas: "Idées du jour", videos: "Vos vidéos", posted: "Publiées", settings: "Paramètres" },
  today: "{approved} sur {goal} créées aujourd’hui",
  dayComplete: "La journée est terminée",
  dayCompleteBody: "Vous avez créé les {goal} vidéos du jour. Vous pouvez en créer d’autres avec les idées restantes ; chacune utilise un crédit.",
  newIdeas: "Nouvelles idées",
  dayFull: "Les idées du jour sont toutes écrites. De nouvelles arrivent demain matin.",
  ideasQueued: "Rédaction des idées du jour. Elles apparaîtront ici d’ici une minute.",
  writingIdeas: "Rédaction des idées du jour…",
  writingIdeasBody: "RepGet lit votre site et rédige 20 idées de vidéos. Cela prend environ une minute.",
  noIdeasLeft: "Vous avez vu toutes les idées du jour",
  noIdeasLeftBody: "De nouvelles idées arrivent chaque matin.",
  ideaOf: "Idée {index} sur {count}",
  reel: "Reel",
  carousel: "Carrousel",
  styles: { bold: "Percutant", numbers: "Chiffres", story: "Récit" },
  styleHelp: {
    bold: "De grands titres et une liste animée.",
    numbers: "Chaque point sous forme de chiffre qui défile.",
    story: "Vos images et vos clips, avec le texte par-dessus.",
  },
  skip: "Ignorer",
  undo: "Annuler",
  undone: "Annulé : elle ne sera pas créée et le crédit vous est rendu.",
  edit: "Modifier",
  approve: "Créer · {price}",
  approved: "En cours de création. Vous la trouverez dans Vos vidéos.",
  swipeHint: "Balayez vers la droite (sur mobile) ou appuyez sur → pour la créer, vers la gauche ou ← pour l’ignorer. Créée par erreur ? Appuyez sur Annuler dans les 10 secondes.",
  previewNote: "Aperçu sans la voix. La vidéo finale comporte la voix IA, les sous-titres et la musique.",
  slide: "Diapositive {index}",
  editTitle: "Modifier l’idée",
  hook: "Première ligne (l’accroche)",
  point: "Point {index}",
  pointTitle: "À l’écran",
  pointDetail: "La voix ajoute",
  stat: "Un chiffre (facultatif)",
  statValue: "Nombre",
  statSuffix: "Unité",
  statLabel: "Libellé",
  addPoint: "Ajouter un point",
  removePoint: "Retirer",
  proof: "Preuve",
  cta: "Phrase de fin",
  caption: "Texte de la publication",
  style: "Style",
  format: "Format",
  voice: "Voix",
  voiceOff: "Sans voix",
  music: "Musique",
  musicAuto: "Choisie pour vous",
  musicNone: "Sans musique",
  captions: "Sous-titres",
  pictures: "Images et clips",
  addPicture: "Ajouter depuis votre bibliothèque",
  noPictures: "Pas encore d’images : les scènes utilisent les couleurs de votre marque.",
  save: "Enregistrer",
  saved: "Enregistré",
  cancel: "Annuler",
  saveAndApprove: "Enregistrer et créer",
  noVideos: "Pas encore de vidéos",
  noVideosBody: "Approuvez une idée dans Idées du jour et elle sera créée ici en quelques minutes.",
  status: {
    approved: "En attente",
    making: "En création",
    ready: "Prête",
    scheduled: "Programmée",
    posting: "Publication",
    posted: "Publiée",
    failed: "Non créée",
  },
  makingBody: "La voix, les sous-titres et la vidéo sont en cours de création. Cela prend de 2 à 5 minutes.",
  scheduledFor: "Publication le {date}",
  download: "Télécharger",
  downloadSlide: "Diapositive {index}",
  publishTo: "Publier sur",
  publishNow: "Publier maintenant",
  publishBest: "Au meilleur moment",
  publishAt: "À une heure précise",
  schedule: "Programmer",
  unschedule: "Déprogrammer",
  publishing: "Publication…",
  published: "Envoyée aux plateformes.",
  scheduledToast: "Programmée pour le {date}.",
  retry: "Réessayer",
  failedBody: "Votre crédit vous a été rendu.",
  connectFirst: "Connectez Instagram, TikTok, YouTube, Facebook ou Pinterest dans Paramètres pour publier d’ici. Vous pouvez toujours télécharger la vidéo.",
  carouselNote: "Ici, YouTube et Pinterest n’acceptent que les vidéos : les carrousels vont donc sur les autres plateformes.",
  noPosted: "Rien n’a encore été publié.",
  views: "Vues",
  likes: "J’aime",
  comments: "Commentaires",
  shares: "Partages",
  totalViews: "{count} vues",
  open: "Ouvrir",
  statsUpdated: "Mis à jour le {date}",
  accounts: "Comptes",
  accountsBody: "Connectez les comptes sur lesquels RepGet publie vos vidéos. Vous vous connectez sur la plateforme elle-même ; RepGet ne voit jamais votre mot de passe.",
  connect: "Connecter",
  connecting: "Ouverture…",
  disconnect: "Déconnecter",
  connected: "Connecté",
  paused: "En pause : {reason}",
  resume: "Reprendre",
  notConfigured: "La publication n’est pas encore configurée sur ce RepGet. Vous pouvez tout de même créer et télécharger des vidéos.",
  defaults: "Vos vidéos",
  defaultStyle: "Style",
  defaultVoice: "Voix",
  musicOn: "Musique de fond",
  captionsOn: "Sous-titres",
  publishMode: "Publication",
  publishManual: "Je publie chaque vidéo",
  publishManualHelp: "Les vidéos prêtes attendent que vous cliquiez sur Publier.",
  publishAuto: "Publier automatiquement",
  publishAutoHelp: "Chaque vidéo que vous créez est publiée au prochain bon moment.",
  platforms: "Publier sur",
  logo: "Logo",
  logoHelp: "Affiché sur la carte de fin. Sans logo, l’initiale de votre marque est affichée.",
  uploadLogo: "Importer un logo",
  removeLogo: "Retirer",
  library: "Vos images et clips",
  libraryHelp: "Photos (PNG, JPG, WebP, jusqu’à 8 MB) et courts clips (MP4, MOV, WebM, jusqu’à 50 MB) utilisés dans le style Récit et partout où vous les ajoutez.",
  upload: "Importer",
  uploading: "Importation…",
  remove: "Retirer",
  safety: "Comment RepGet protège vos comptes",
  safetyPoints: [
    "Au maximum 3 vidéos par jour sur chaque plateforme.",
    "Chaque vidéo est différente : aucun contenu répété.",
    "Si une plateforme refuse une vidéo, RepGet suspend la publication sur celle-ci jusqu’à ce que vous la repreniez.",
    "De la musique gratuite sous licence pour les vidéos, et vos propres images.",
    "Les fichiers vidéo sont supprimés 7 jours après la publication.",
  ],
  trialNote: "Les vidéos sont incluses dans votre essai.",
  notice: {
    connected: "{platform} est connecté.",
    not_connected: "{platform} n’a pas été connecté.",
    connect_failed: "{platform} n’a pas pu être connecté. Veuillez réessayer.",
  },
  meta: { ideas: "{count} idée|{count} idées", ideasLabel: "à examiner|à examiner", madeLabel: "créées aujourd’hui", credits: "disponible|disponibles" },
  filter: { label: "Format", all: "Tous les formats", reel: "Reels", carousel: "Carrousels" },
  focus: { on: "Mode concentration", off: "Afficher les détails", hint: "Mode concentration : seulement l’aperçu et Créer. Appuyez sur Échap pour le quitter." },
  detail: {
    eyebrow: "Idée de contenu",
    carouselSlides: "Carrousel · {count} diapositives",
    hook: "L’accroche d’ouverture",
    concept: "Le concept",
    captionMore: "Voir tout le texte",
    captionLess: "Afficher moins",
    readyFor: "Publiée sur",
    noPlatforms: "Aucune plateforme n’est choisie dans Paramètres.",
  },
  list: {
    search: "Rechercher dans vos vidéos et carrousels",
    all: "Tout le contenu",
    reels: "Vidéos",
    carousels: "Carrousels",
    count: "{shown} sur {total}",
    empty: "Aucun résultat. Essayez une autre recherche ou un autre format.",
    preview: "Aperçu",
    publish: "Publier",
    close: "Fermer",
    seconds: "{seconds} s",
    slides: "{count} diapositives",
  },
  postedEmpty: { ideas: "Découvrir des idées", videos: "Voir vos vidéos" },
  cards: {
    style: "Style des vidéos et carrousels",
    styleBody: "L’apparence et le son de votre contenu.",
    publishing: "Publication",
    publishingBody: "Comment, quand et où votre contenu est publié.",
    brand: "Les médias de votre marque",
    brandBody: "Votre logo, vos images et vos clips, pour que chaque publication soit clairement la vôtre.",
  },
  pinterest: {
    board: "Tableau : {board}",
    noBoard: "Aucun tableau choisi pour l’instant. Les épingles en ont besoin.",
    chooseBoard: "Choisir le tableau dans Opportunités",
    shared: "Le même compte et le même tableau que vos épingles dans Opportunités. Pinterest reçoit les vidéos ; les carrousels vont sur les autres plateformes.",
  },
  errors: {
    view_only: "Vous pouvez consulter ce site, mais pas le modifier.",
    no_plan: "Choisissez un forfait pour ce site afin de créer des vidéos.",
    not_found: "Cette idée n’est plus disponible.",
    already_handled: "Cette idée a déjà été traitée.",
    not_enough_credits: "Cela coûte {price} et vous en avez {available}. Achetez des crédits dans Crédits.",
    bad_script: "Remplissez la première ligne et au moins deux points.",
    no_accounts: "Connectez au moins une plateforme pour cette vidéo dans Paramètres.",
    no_board: "Choisissez d’abord un tableau Pinterest, dans Opportunités, sous Vos comptes. Ou décochez Pinterest pour publier sur les autres plateformes.",
    not_configured: "Ce n’est pas encore configuré sur ce RepGet.",
    connect_failed: "La page de connexion n’a pas pu s’ouvrir. Veuillez réessayer.",
    bad_file: "Utilisez une image PNG, JPG ou WebP, ou un clip MP4, MOV ou WebM.",
    too_big: "Ce fichier est trop volumineux.",
    bad_time: "Choisissez une heure dans les 60 prochains jours.",
    day_full: "Vous avez déjà reçu les idées du jour. De nouvelles arrivent demain matin.",
    generic: "Une erreur s’est produite. Veuillez réessayer.",
  },
  viral: viralFr,
};

const it: VideosCopy = {
  title: "Contenuti social",
  intro: "Brevi video animati e caroselli di foto creati dal suo sito, con voce IA, sottotitoli e musica. Scorra le idee di oggi: quelle che tiene vengono create e pubblicate per lei.",
  tabs: { ideas: "Idee di oggi", videos: "I suoi video", posted: "Pubblicati", settings: "Impostazioni" },
  today: "{approved} di {goal} creati oggi",
  dayComplete: "La giornata è completa",
  dayCompleteBody: "Ha creato i {goal} video di oggi. Può crearne altri con le idee rimaste; ognuno usa un credito.",
  newIdeas: "Nuove idee",
  dayFull: "Le idee di oggi sono tutte scritte. Le nuove arrivano domani mattina.",
  ideasQueued: "Sto scrivendo le idee di oggi. Appariranno qui fra un minuto.",
  writingIdeas: "Scrittura delle idee di oggi…",
  writingIdeasBody: "RepGet sta leggendo il suo sito e scrivendo 20 idee per video. Ci vuole circa un minuto.",
  noIdeasLeft: "Ha visto tutte le idee di oggi",
  noIdeasLeftBody: "Nuove idee arrivano ogni mattina.",
  ideaOf: "Idea {index} di {count}",
  reel: "Reel",
  carousel: "Carosello",
  styles: { bold: "Impatto", numbers: "Numeri", story: "Racconto" },
  styleHelp: {
    bold: "Grandi titoli e una checklist animata.",
    numbers: "Ogni punto come una cifra che sale.",
    story: "Le sue immagini e clip, con il testo sopra.",
  },
  skip: "Salta",
  undo: "Annulla",
  undone: "Annullato: non verrà creato e il credito le viene restituito.",
  edit: "Modifica",
  approve: "Crea · {price}",
  approved: "In creazione. Lo troverà in I suoi video.",
  swipeHint: "Scorra a destra (sul telefono) o prema → per crearlo, a sinistra o ← per saltarlo. Creato per errore? Prema Annulla entro 10 secondi.",
  previewNote: "Anteprima senza voce. Il video finito ha la voce IA, i sottotitoli e la musica.",
  slide: "Slide {index}",
  editTitle: "Modifica l’idea",
  hook: "Prima riga (il gancio)",
  point: "Punto {index}",
  pointTitle: "Sullo schermo",
  pointDetail: "La voce aggiunge",
  stat: "Una cifra (facoltativa)",
  statValue: "Numero",
  statSuffix: "Unità",
  statLabel: "Etichetta",
  addPoint: "Aggiungi un punto",
  removePoint: "Rimuovi",
  proof: "Prova",
  cta: "Frase finale",
  caption: "Testo del post",
  style: "Stile",
  format: "Formato",
  voice: "Voce",
  voiceOff: "Senza voce",
  music: "Musica",
  musicAuto: "Scelta per lei",
  musicNone: "Senza musica",
  captions: "Sottotitoli",
  pictures: "Immagini e clip",
  addPicture: "Aggiungi dalla sua libreria",
  noPictures: "Ancora nessuna immagine: le scene usano i colori del suo marchio.",
  save: "Salva",
  saved: "Salvato",
  cancel: "Annulla",
  saveAndApprove: "Salva e crea",
  noVideos: "Ancora nessun video",
  noVideosBody: "Approvi un’idea in Idee di oggi e verrà creata qui in pochi minuti.",
  status: {
    approved: "In attesa",
    making: "In creazione",
    ready: "Pronto",
    scheduled: "Programmato",
    posting: "Pubblicazione",
    posted: "Pubblicato",
    failed: "Non creato",
  },
  makingBody: "Voce, sottotitoli e video sono in creazione. Ci vogliono da 2 a 5 minuti.",
  scheduledFor: "Pubblicazione il {date}",
  download: "Scarica",
  downloadSlide: "Slide {index}",
  publishTo: "Pubblica su",
  publishNow: "Pubblica ora",
  publishBest: "All’orario migliore",
  publishAt: "A un orario",
  schedule: "Programma",
  unschedule: "Annulla programmazione",
  publishing: "Pubblicazione…",
  published: "Inviato alle piattaforme.",
  scheduledToast: "Programmato per il {date}.",
  retry: "Riprova",
  failedBody: "Il suo credito è stato restituito.",
  connectFirst: "Colleghi Instagram, TikTok, YouTube, Facebook o Pinterest in Impostazioni per pubblicare da qui. Può sempre scaricare il video.",
  carouselNote: "Qui YouTube e Pinterest accettano solo video, quindi i caroselli vanno sulle altre piattaforme.",
  noPosted: "Ancora niente di pubblicato.",
  views: "Visualizzazioni",
  likes: "Mi piace",
  comments: "Commenti",
  shares: "Condivisioni",
  totalViews: "{count} visualizzazioni",
  open: "Apri",
  statsUpdated: "Aggiornato il {date}",
  accounts: "Account",
  accountsBody: "Colleghi gli account su cui RepGet pubblica i suoi video. Accede sulla piattaforma stessa; RepGet non vede mai la sua password.",
  connect: "Collega",
  connecting: "Apertura…",
  disconnect: "Scollega",
  connected: "Collegato",
  paused: "In pausa: {reason}",
  resume: "Riprendi",
  notConfigured: "La pubblicazione non è ancora configurata su questo RepGet. Può comunque creare e scaricare video.",
  defaults: "I suoi video",
  defaultStyle: "Stile",
  defaultVoice: "Voce",
  musicOn: "Musica di sottofondo",
  captionsOn: "Sottotitoli",
  publishMode: "Pubblicazione",
  publishManual: "Pubblico io ogni video",
  publishManualHelp: "I video pronti aspettano che lei prema Pubblica.",
  publishAuto: "Pubblica automaticamente",
  publishAutoHelp: "Ogni video che crea viene pubblicato al prossimo momento adatto.",
  platforms: "Pubblica su",
  logo: "Logo",
  logoHelp: "Mostrato nella scheda finale. Senza logo, si mostra l’iniziale del suo marchio.",
  uploadLogo: "Carica un logo",
  removeLogo: "Rimuovi",
  library: "Le sue immagini e clip",
  libraryHelp: "Foto (PNG, JPG, WebP, fino a 8 MB) e brevi clip (MP4, MOV, WebM, fino a 50 MB) usate nello stile Racconto e ovunque le aggiunga.",
  upload: "Carica",
  uploading: "Caricamento…",
  remove: "Rimuovi",
  safety: "Come RepGet protegge i suoi account",
  safetyPoints: [
    "Al massimo 3 video al giorno su ogni piattaforma.",
    "Ogni video è diverso: nessun contenuto ripetuto.",
    "Se una piattaforma rifiuta un video, RepGet sospende la pubblicazione lì finché lei non la riprende.",
    "Musica gratuita con licenza per l’uso nei video, e le sue immagini.",
    "I file video vengono eliminati 7 giorni dopo la pubblicazione.",
  ],
  trialNote: "I video sono inclusi nella sua prova.",
  notice: {
    connected: "{platform} è collegato.",
    not_connected: "{platform} non è stato collegato.",
    connect_failed: "Non è stato possibile collegare {platform}. Riprovi.",
  },
  meta: { ideas: "{count} idea|{count} idee", ideasLabel: "da valutare|da valutare", madeLabel: "creati oggi", credits: "disponibile|disponibili" },
  filter: { label: "Formato", all: "Tutti i formati", reel: "Reel", carousel: "Caroselli" },
  focus: { on: "Modalità focus", off: "Mostra i dettagli", hint: "Modalità focus: solo l’anteprima e Crea. Prema Esc per uscire." },
  detail: {
    eyebrow: "Idea di contenuto",
    carouselSlides: "Carosello · {count} slide",
    hook: "Il gancio iniziale",
    concept: "Il concetto",
    captionMore: "Veda tutto il testo",
    captionLess: "Mostra meno",
    readyFor: "Va su",
    noPlatforms: "Nessuna piattaforma scelta in Impostazioni.",
  },
  list: {
    search: "Cerchi tra i suoi video e caroselli",
    all: "Tutti i contenuti",
    reels: "Video",
    carousels: "Caroselli",
    count: "{shown} di {total}",
    empty: "Nessun risultato. Provi un’altra ricerca o un altro formato.",
    preview: "Anteprima",
    publish: "Pubblica",
    close: "Chiudi",
    seconds: "{seconds} s",
    slides: "{count} slide",
  },
  postedEmpty: { ideas: "Scopra le idee", videos: "Veda i suoi video" },
  cards: {
    style: "Stile di video e caroselli",
    styleBody: "Come appaiono e come suonano i suoi contenuti.",
    publishing: "Pubblicazione",
    publishingBody: "Come, quando e dove vengono pubblicati i suoi contenuti.",
    brand: "I media del suo marchio",
    brandBody: "Il suo logo, le sue immagini e le sue clip, perché ogni post sia chiaramente suo.",
  },
  pinterest: {
    board: "Bacheca: {board}",
    noBoard: "Nessuna bacheca ancora scelta. I Pin ne hanno bisogno.",
    chooseBoard: "Scelga la bacheca in Opportunità",
    shared: "Lo stesso account e la stessa bacheca dei suoi Pin in Opportunità. Pinterest riceve i video; i caroselli vanno sulle altre piattaforme.",
  },
  errors: {
    view_only: "Può vedere questo sito ma non modificarlo.",
    no_plan: "Scelga un piano per questo sito per creare video.",
    not_found: "Questa idea non è più disponibile.",
    already_handled: "Questa idea è già stata gestita.",
    not_enough_credits: "Costa {price} e ne ha {available}. Acquisti crediti in Crediti.",
    bad_script: "Compili la prima riga e almeno due punti.",
    no_accounts: "Colleghi almeno una piattaforma per questo video in Impostazioni.",
    no_board: "Scelga prima una bacheca Pinterest, in Opportunità, sotto I suoi account. Oppure deselezioni Pinterest per pubblicare sulle altre piattaforme.",
    not_configured: "Non è ancora configurato su questo RepGet.",
    connect_failed: "Non è stato possibile aprire la pagina di collegamento. Riprovi.",
    bad_file: "Usi un’immagine PNG, JPG o WebP, o una clip MP4, MOV o WebM.",
    too_big: "Questo file è troppo grande.",
    bad_time: "Scelga un orario entro i prossimi 60 giorni.",
    day_full: "Ha già ricevuto le idee di oggi. Le nuove arrivano domani mattina.",
    generic: "Qualcosa è andato storto. Riprovi.",
  },
  viral: viralIt,
};

const de: VideosCopy = {
  title: "Social Content",
  intro: "Kurze animierte Videos und Foto-Karussells aus Ihrer Website, mit KI-Stimme, Untertiteln und Musik. Wischen Sie durch die Ideen von heute: Die, die Sie behalten, werden für Sie erstellt und veröffentlicht.",
  tabs: { ideas: "Ideen von heute", videos: "Ihre Videos", posted: "Gepostet", settings: "Einstellungen" },
  today: "{approved} von {goal} heute erstellt",
  dayComplete: "Für heute erledigt",
  dayCompleteBody: "Sie haben die {goal} Videos von heute erstellt. Mit den übrigen Ideen können Sie weitere erstellen; jedes kostet einen Credit.",
  newIdeas: "Neue Ideen",
  dayFull: "Die Ideen von heute sind alle geschrieben. Neue kommen morgen früh.",
  ideasQueued: "Die Ideen von heute werden geschrieben. Sie erscheinen hier in einer Minute.",
  writingIdeas: "Ideen von heute werden geschrieben…",
  writingIdeasBody: "RepGet liest Ihre Website und schreibt 20 Videoideen. Das dauert etwa eine Minute.",
  noIdeasLeft: "Sie haben alle Ideen von heute gesehen",
  noIdeasLeftBody: "Jeden Morgen kommen neue Ideen.",
  ideaOf: "Idee {index} von {count}",
  reel: "Reel",
  carousel: "Karussell",
  styles: { bold: "Plakativ", numbers: "Zahlen", story: "Story" },
  styleHelp: {
    bold: "Große Überschriften und eine animierte Checkliste.",
    numbers: "Jeder Punkt als Zahl, die hochzählt.",
    story: "Ihre Bilder und Clips, mit dem Text darüber.",
  },
  skip: "Überspringen",
  undo: "Rückgängig",
  undone: "Zurückgenommen: Es wird nicht erstellt, und der Credit ist zurück.",
  edit: "Bearbeiten",
  approve: "Erstellen · {price}",
  approved: "Wird erstellt. Sie finden es unter Ihre Videos.",
  swipeHint: "Nach rechts wischen (am Handy) oder → drücken zum Erstellen, nach links oder ← zum Überspringen. Versehentlich erstellt? Innerhalb von 10 Sekunden auf Rückgängig tippen.",
  previewNote: "Vorschau ohne Stimme. Das fertige Video hat KI-Stimme, Untertitel und Musik.",
  slide: "Folie {index}",
  editTitle: "Idee bearbeiten",
  hook: "Erste Zeile (der Aufhänger)",
  point: "Punkt {index}",
  pointTitle: "Auf dem Bildschirm",
  pointDetail: "Die Stimme ergänzt",
  stat: "Eine Zahl (optional)",
  statValue: "Zahl",
  statSuffix: "Einheit",
  statLabel: "Beschriftung",
  addPoint: "Punkt hinzufügen",
  removePoint: "Entfernen",
  proof: "Beleg",
  cta: "Schlusssatz",
  caption: "Beitragstext",
  style: "Stil",
  format: "Format",
  voice: "Stimme",
  voiceOff: "Keine Stimme",
  music: "Musik",
  musicAuto: "Für Sie ausgewählt",
  musicNone: "Keine Musik",
  captions: "Untertitel",
  pictures: "Bilder und Clips",
  addPicture: "Aus Ihrer Mediathek hinzufügen",
  noPictures: "Noch keine Bilder: Die Szenen verwenden Ihre Markenfarben.",
  save: "Speichern",
  saved: "Gespeichert",
  cancel: "Abbrechen",
  saveAndApprove: "Speichern und erstellen",
  noVideos: "Noch keine Videos",
  noVideosBody: "Genehmigen Sie eine Idee unter Ideen von heute, und sie wird hier in wenigen Minuten erstellt.",
  status: {
    approved: "Wartet",
    making: "Wird erstellt",
    ready: "Bereit",
    scheduled: "Geplant",
    posting: "Wird veröffentlicht",
    posted: "Gepostet",
    failed: "Nicht erstellt",
  },
  makingBody: "Stimme, Untertitel und Video werden erstellt. Das dauert 2 bis 5 Minuten.",
  scheduledFor: "Wird am {date} veröffentlicht",
  download: "Herunterladen",
  downloadSlide: "Folie {index}",
  publishTo: "Veröffentlichen auf",
  publishNow: "Jetzt veröffentlichen",
  publishBest: "Zur besten Zeit",
  publishAt: "Zu einer Uhrzeit",
  schedule: "Planen",
  unschedule: "Planung aufheben",
  publishing: "Wird veröffentlicht…",
  published: "An die Plattformen gesendet.",
  scheduledToast: "Geplant für {date}.",
  retry: "Erneut versuchen",
  failedBody: "Ihr Credit wurde zurückerstattet.",
  connectFirst: "Verbinden Sie Instagram, TikTok, YouTube, Facebook oder Pinterest in den Einstellungen, um von hier aus zu veröffentlichen. Herunterladen können Sie das Video jederzeit.",
  carouselNote: "YouTube und Pinterest nehmen hier nur Videos an, daher gehen Karussells an die anderen Plattformen.",
  noPosted: "Noch nichts gepostet.",
  views: "Aufrufe",
  likes: "Likes",
  comments: "Kommentare",
  shares: "Geteilt",
  totalViews: "{count} Aufrufe",
  open: "Öffnen",
  statsUpdated: "Aktualisiert {date}",
  accounts: "Konten",
  accountsBody: "Verbinden Sie die Konten, auf denen RepGet Ihre Videos veröffentlicht. Sie melden sich auf der Plattform selbst an; RepGet sieht Ihr Passwort nie.",
  connect: "Verbinden",
  connecting: "Wird geöffnet…",
  disconnect: "Trennen",
  connected: "Verbunden",
  paused: "Pausiert: {reason}",
  resume: "Fortsetzen",
  notConfigured: "Das Veröffentlichen ist auf diesem RepGet noch nicht eingerichtet. Sie können trotzdem Videos erstellen und herunterladen.",
  defaults: "Ihre Videos",
  defaultStyle: "Stil",
  defaultVoice: "Stimme",
  musicOn: "Hintergrundmusik",
  captionsOn: "Untertitel",
  publishMode: "Veröffentlichung",
  publishManual: "Ich veröffentliche jedes Video selbst",
  publishManualHelp: "Fertige Videos warten, bis Sie auf Veröffentlichen klicken.",
  publishAuto: "Automatisch veröffentlichen",
  publishAutoHelp: "Jedes Video, das Sie erstellen, wird zur nächsten guten Zeit veröffentlicht.",
  platforms: "Veröffentlichen auf",
  logo: "Logo",
  logoHelp: "Wird auf der Schlusskarte angezeigt. Ohne Logo wird der Anfangsbuchstabe Ihrer Marke gezeigt.",
  uploadLogo: "Logo hochladen",
  removeLogo: "Entfernen",
  library: "Ihre Bilder und Clips",
  libraryHelp: "Fotos (PNG, JPG, WebP, bis 8 MB) und kurze Clips (MP4, MOV, WebM, bis 50 MB), die im Stil Story und überall dort verwendet werden, wo Sie sie hinzufügen.",
  upload: "Hochladen",
  uploading: "Wird hochgeladen…",
  remove: "Entfernen",
  safety: "So schützt RepGet Ihre Konten",
  safetyPoints: [
    "Höchstens 3 Videos pro Tag auf jeder Plattform.",
    "Jedes Video ist anders: keine wiederholten Inhalte.",
    "Lehnt eine Plattform ein Video ab, pausiert RepGet das Posten dort, bis Sie es fortsetzen.",
    "Kostenlose Musik mit Lizenz für die Nutzung in Videos, und Ihre eigenen Bilder.",
    "Videodateien werden 7 Tage nach dem Posten gelöscht.",
  ],
  trialNote: "Videos sind in Ihrer Testphase enthalten.",
  notice: {
    connected: "{platform} ist verbunden.",
    not_connected: "{platform} wurde nicht verbunden.",
    connect_failed: "{platform} konnte nicht verbunden werden. Bitte versuchen Sie es erneut.",
  },
  meta: { ideas: "{count} Idee|{count} Ideen", ideasLabel: "zum Prüfen|zum Prüfen", madeLabel: "heute erstellt", credits: "verfügbar|verfügbar" },
  filter: { label: "Format", all: "Alle Formate", reel: "Reels", carousel: "Karussells" },
  focus: { on: "Fokusmodus", off: "Details anzeigen", hint: "Fokusmodus: nur die Vorschau und Erstellen. Mit Esc verlassen Sie ihn." },
  detail: {
    eyebrow: "Inhaltsidee",
    carouselSlides: "Karussell · {count} Folien",
    hook: "Der Aufhänger",
    concept: "Das Konzept",
    captionMore: "Ganzen Beitragstext anzeigen",
    captionLess: "Weniger anzeigen",
    readyFor: "Geht an",
    noPlatforms: "In den Einstellungen ist keine Plattform gewählt.",
  },
  list: {
    search: "Ihre Videos und Karussells durchsuchen",
    all: "Alle Inhalte",
    reels: "Videos",
    carousels: "Karussells",
    count: "{shown} von {total}",
    empty: "Keine Treffer. Versuchen Sie eine andere Suche oder ein anderes Format.",
    preview: "Vorschau",
    publish: "Veröffentlichen",
    close: "Schließen",
    seconds: "{seconds} s",
    slides: "{count} Folien",
  },
  postedEmpty: { ideas: "Ideen entdecken", videos: "Ihre Videos ansehen" },
  cards: {
    style: "Stil von Videos und Karussells",
    styleBody: "Wie Ihre Inhalte aussehen und klingen.",
    publishing: "Veröffentlichung",
    publishingBody: "Wie, wann und wo Ihre Inhalte erscheinen.",
    brand: "Ihre Markenmedien",
    brandBody: "Ihr Logo, Ihre Bilder und Clips, damit jeder Beitrag klar als Ihrer erkennbar ist.",
  },
  pinterest: {
    board: "Pinnwand: {board}",
    noBoard: "Noch keine Pinnwand gewählt. Pins brauchen eine.",
    chooseBoard: "Pinnwand unter Chancen wählen",
    shared: "Dasselbe Konto und dieselbe Pinnwand wie Ihre Pins unter Chancen. Pinterest erhält die Videos; Karussells gehen an die anderen Plattformen.",
  },
  errors: {
    view_only: "Sie können diese Website ansehen, aber nicht ändern.",
    no_plan: "Wählen Sie einen Tarif für diese Website, um Videos zu erstellen.",
    not_found: "Diese Idee ist nicht mehr verfügbar.",
    already_handled: "Diese Idee wurde bereits bearbeitet.",
    not_enough_credits: "Das kostet {price}, und Sie haben {available}. Kaufen Sie Credits unter Credits.",
    bad_script: "Füllen Sie die erste Zeile und mindestens zwei Punkte aus.",
    no_accounts: "Verbinden Sie in den Einstellungen mindestens eine Plattform für dieses Video.",
    no_board: "Wählen Sie zuerst eine Pinterest-Pinnwand, unter Chancen bei Ihre Konten. Oder entfernen Sie das Häkchen bei Pinterest, um auf den anderen Plattformen zu veröffentlichen.",
    not_configured: "Das ist auf diesem RepGet noch nicht eingerichtet.",
    connect_failed: "Die Verbindungsseite konnte nicht geöffnet werden. Bitte versuchen Sie es erneut.",
    bad_file: "Verwenden Sie ein PNG-, JPG- oder WebP-Bild oder einen MP4-, MOV- oder WebM-Clip.",
    too_big: "Diese Datei ist zu groß.",
    bad_time: "Wählen Sie eine Uhrzeit in den nächsten 60 Tagen.",
    day_full: "Sie haben die Ideen von heute bereits erhalten. Neue kommen morgen früh.",
    generic: "Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.",
  },
  viral: viralDe,
};

/** One full translation per locale; keep the five objects in step when a key changes. */
export const VIDEOS_COPY: Record<Locale, VideosCopy> = { en, es, fr, it, de };
