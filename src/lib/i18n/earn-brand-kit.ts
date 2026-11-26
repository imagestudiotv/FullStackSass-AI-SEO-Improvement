import type { BrandKitKind } from "@/lib/earn/brand-kit";
import type { Locale } from "@/lib/i18n/config";

/**
 * The brand kit's words on Earn Credits (client, 2026-11-26). The files are in
 * English (RepGet's own brand material); the page around them is translated.
 */
export type EarnBrandKitCopy = {
  eyebrow: string;
  title: string;
  body: string;
  /** "Post it with your link, then claim {credits} credits under “Post about RepGet”." */
  claim: string;
  claimLink: string;
  kinds: Record<BrandKitKind, string>;
  items: Record<string, { title: string; body: string }>;
  download: string;
  /** "{width} x {height} px" */
  size: string;
  videoLabel: string;
  rules: string;
};

const en: EarnBrandKitCopy = {
  eyebrow: "Brand kit",
  title: "Ready-to-post graphics, logo and video",
  body: "Official RepGet files to use in your own posts about RepGet. Download them, add your words and your link.",
  claim: "Posted one? Claim {credits} credits under Post about RepGet.",
  claimLink: "Claim credits",
  kinds: { logo: "Logo", post: "Feed post", story: "Story", video: "Video" },
  items: {
    promoVideo: { title: "RepGet promo video", body: "A short vertical video for Reels, TikTok, Shorts and Stories." },
    postAutopilot: { title: "Post: on autopilot", body: "For Instagram, Facebook and LinkedIn feeds." },
    postOneplace: { title: "Post: all in one place", body: "For Instagram, Facebook and LinkedIn feeds." },
    storyAutopilot: { title: "Story: on autopilot", body: "For Instagram and Facebook Stories." },
    storyTry: { title: "Story: try RepGet", body: "Add your referral link as a link sticker." },
    logoColor: { title: "Logo", body: "For light backgrounds. Transparent PNG." },
    logoWhite: { title: "White logo", body: "For dark backgrounds. Transparent PNG." },
    logoIcon: { title: "Icon", body: "Square, for profile pictures and small spaces." },
  },
  download: "Download",
  size: "{width} x {height} px",
  videoLabel: "RepGet promo video",
  rules: "Please don't change the logo's colours or shape, and say in your post if you may receive credits for it.",
};

const es: EarnBrandKitCopy = {
  eyebrow: "Kit de marca",
  title: "Gráficos listos para publicar, logotipo y vídeo",
  body: "Archivos oficiales de RepGet para sus propias publicaciones sobre RepGet. Descárguelos y añada sus palabras y su enlace.",
  claim: "¿Ya lo publicó? Solicite {credits} créditos en «Publique sobre RepGet».",
  claimLink: "Solicitar créditos",
  kinds: { logo: "Logotipo", post: "Publicación", story: "Historia", video: "Vídeo" },
  items: {
    promoVideo: { title: "Vídeo promocional de RepGet", body: "Un vídeo vertical corto para Reels, TikTok, Shorts e Historias." },
    postAutopilot: { title: "Publicación: en piloto automático", body: "Para Instagram, Facebook y LinkedIn." },
    postOneplace: { title: "Publicación: todo en un solo lugar", body: "Para Instagram, Facebook y LinkedIn." },
    storyAutopilot: { title: "Historia: en piloto automático", body: "Para Historias de Instagram y Facebook." },
    storyTry: { title: "Historia: pruebe RepGet", body: "Añada su enlace de recomendación como sticker de enlace." },
    logoColor: { title: "Logotipo", body: "Para fondos claros. PNG transparente." },
    logoWhite: { title: "Logotipo blanco", body: "Para fondos oscuros. PNG transparente." },
    logoIcon: { title: "Icono", body: "Cuadrado, para fotos de perfil y espacios pequeños." },
  },
  download: "Descargar",
  size: "{width} x {height} px",
  videoLabel: "Vídeo promocional de RepGet",
  rules: "No cambie los colores ni la forma del logotipo, e indique en su publicación si puede recibir créditos por ella.",
};

const fr: EarnBrandKitCopy = {
  eyebrow: "Kit de marque",
  title: "Visuels prêts à publier, logo et vidéo",
  body: "Les fichiers officiels de RepGet pour vos propres publications sur RepGet. Téléchargez-les, ajoutez vos mots et votre lien.",
  claim: "Publié ? Demandez {credits} crédits dans « Publiez sur RepGet ».",
  claimLink: "Demander les crédits",
  kinds: { logo: "Logo", post: "Publication", story: "Story", video: "Vidéo" },
  items: {
    promoVideo: { title: "Vidéo promotionnelle RepGet", body: "Une courte vidéo verticale pour Reels, TikTok, Shorts et Stories." },
    postAutopilot: { title: "Publication : en pilote automatique", body: "Pour Instagram, Facebook et LinkedIn." },
    postOneplace: { title: "Publication : tout au même endroit", body: "Pour Instagram, Facebook et LinkedIn." },
    storyAutopilot: { title: "Story : en pilote automatique", body: "Pour les Stories Instagram et Facebook." },
    storyTry: { title: "Story : essayez RepGet", body: "Ajoutez votre lien de parrainage avec un sticker lien." },
    logoColor: { title: "Logo", body: "Pour les fonds clairs. PNG transparent." },
    logoWhite: { title: "Logo blanc", body: "Pour les fonds sombres. PNG transparent." },
    logoIcon: { title: "Icône", body: "Carrée, pour les photos de profil et les petits espaces." },
  },
  download: "Télécharger",
  size: "{width} x {height} px",
  videoLabel: "Vidéo promotionnelle RepGet",
  rules: "Ne modifiez pas les couleurs ni la forme du logo, et indiquez dans votre publication si vous pouvez recevoir des crédits pour celle-ci.",
};

const it: EarnBrandKitCopy = {
  eyebrow: "Kit del marchio",
  title: "Grafiche pronte da pubblicare, logo e video",
  body: "I file ufficiali di RepGet per i suoi post su RepGet. Li scarichi e aggiunga le sue parole e il suo link.",
  claim: "Pubblicato? Richieda {credits} crediti in «Pubblichi su RepGet».",
  claimLink: "Richiedi i crediti",
  kinds: { logo: "Logo", post: "Post", story: "Storia", video: "Video" },
  items: {
    promoVideo: { title: "Video promozionale RepGet", body: "Un breve video verticale per Reels, TikTok, Shorts e Storie." },
    postAutopilot: { title: "Post: in automatico", body: "Per Instagram, Facebook e LinkedIn." },
    postOneplace: { title: "Post: tutto in un unico posto", body: "Per Instagram, Facebook e LinkedIn." },
    storyAutopilot: { title: "Storia: in automatico", body: "Per le Storie di Instagram e Facebook." },
    storyTry: { title: "Storia: prova RepGet", body: "Aggiunga il suo link di invito come sticker link." },
    logoColor: { title: "Logo", body: "Per sfondi chiari. PNG trasparente." },
    logoWhite: { title: "Logo bianco", body: "Per sfondi scuri. PNG trasparente." },
    logoIcon: { title: "Icona", body: "Quadrata, per foto profilo e spazi piccoli." },
  },
  download: "Scarica",
  size: "{width} x {height} px",
  videoLabel: "Video promozionale RepGet",
  rules: "Non modifichi i colori o la forma del logo e indichi nel post se può ricevere crediti per esso.",
};

const de: EarnBrandKitCopy = {
  eyebrow: "Markenpaket",
  title: "Fertige Grafiken, Logo und Video",
  body: "Offizielle RepGet-Dateien für Ihre eigenen Beiträge über RepGet. Laden Sie sie herunter und ergänzen Sie Ihre Worte und Ihren Link.",
  claim: "Gepostet? Fordern Sie {credits} Credits unter „Posten Sie über RepGet“ an.",
  claimLink: "Credits anfordern",
  kinds: { logo: "Logo", post: "Beitrag", story: "Story", video: "Video" },
  items: {
    promoVideo: { title: "RepGet-Promovideo", body: "Ein kurzes Hochformat-Video für Reels, TikTok, Shorts und Stories." },
    postAutopilot: { title: "Beitrag: auf Autopilot", body: "Für Instagram, Facebook und LinkedIn." },
    postOneplace: { title: "Beitrag: alles an einem Ort", body: "Für Instagram, Facebook und LinkedIn." },
    storyAutopilot: { title: "Story: auf Autopilot", body: "Für Instagram- und Facebook-Stories." },
    storyTry: { title: "Story: RepGet testen", body: "Fügen Sie Ihren Empfehlungslink als Link-Sticker hinzu." },
    logoColor: { title: "Logo", body: "Für helle Hintergründe. Transparentes PNG." },
    logoWhite: { title: "Weißes Logo", body: "Für dunkle Hintergründe. Transparentes PNG." },
    logoIcon: { title: "Symbol", body: "Quadratisch, für Profilbilder und kleine Flächen." },
  },
  download: "Herunterladen",
  size: "{width} x {height} px",
  videoLabel: "RepGet-Promovideo",
  rules: "Bitte ändern Sie weder Farben noch Form des Logos und geben Sie im Beitrag an, wenn Sie dafür Credits erhalten können.",
};

export const EARN_BRAND_KIT_COPY: Record<Locale, EarnBrandKitCopy> = { en, es, fr, it, de };
