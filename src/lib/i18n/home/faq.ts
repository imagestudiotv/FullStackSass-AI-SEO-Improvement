import type { Locale } from "@/lib/i18n/config";

/**
 * The homepage's questions (client's design, 2026-11-03; client 2026-11-04:
 * "i updated the faq with more options once there are more features now"):
 * the design's 14 questions in its three groups, with its answers, in every
 * language.
 *
 * These are the homepage's own list. The /faq page keeps its own
 * (messages.ts `faq`), and only /faq publishes FAQPage structured data.
 */

export type FaqItem = { question: string; answer: string };
export type FaqGroup = { title: string; items: FaqItem[] };

export type FaqCopy = {
  eyebrow: string;
  title: string;
  intro: string;
  contactLead: string;
  contact: string;
  groups: FaqGroup[];
};

const en: FaqCopy = {
  eyebrow: "FAQ",
  title: "Frequently asked questions",
  intro: "Clear answers about how RepGet works, what is included, and what to expect as you grow.",
  contactLead: "Still have a question?",
  contact: "Contact us",
  groups: [
    {
      title: "SEO & getting started",
      items: [
        {
          question: "Do I need to know anything about SEO?",
          answer:
            "No. RepGet researches what your customers are searching for, helps prepare relevant articles, and explains your website improvements in straightforward language.",
        },
        {
          question: "How long before I see results?",
          answer:
            "SEO takes time. New pages commonly need two to four months to start attracting visitors, and competitive markets can take longer. We track progress instead of promising immediate rankings.",
        },
        {
          question: "Do you guarantee I will rank first on Google?",
          answer:
            "No. Nobody can guarantee a first-place Google ranking. RepGet helps identify realistic search opportunities, improve your pages, and track what changes.",
        },
        {
          question: "Will the articles sound like a robot wrote them?",
          answer:
            "Articles are AI-generated for your business and market. You should review them before publication. Use the editor to adjust wording, tone, facts, and style.",
        },
        {
          question: "Do the articles go on my website automatically?",
          answer:
            "Only if you connect your website and choose to publish. You can otherwise keep articles as drafts for review, editing, or manual publishing.",
        },
        {
          question: "What are credits?",
          answer:
            "Credits are used for services such as backlink placements and other add-ons. Your available balance and how credits are spent can be checked in your account.",
        },
        {
          question: "Why do you suggest smaller search terms?",
          answer:
            "Lower-competition, highly relevant searches may bring more useful visitors than high-volume terms that are very difficult to rank for.",
        },
      ],
    },
    {
      title: "Social, content & Copilot",
      items: [
        {
          question: "Which social platforms can I connect?",
          answer:
            "RepGet is designed to work with major social platforms. The channels available to you depend on integrations, platform permissions, and your account configuration.",
        },
        {
          question: "Can I approve social posts before publishing?",
          answer:
            "Yes, the planned social workflow allows you to review content, edit captions and media, and control scheduling or publishing settings.",
        },
        {
          question: "Can one article become content for several social platforms?",
          answer:
            "That is part of the combined workflow: repurpose an article or idea into platform-specific posts, then review the versions before publishing.",
        },
        {
          question: "How do my monthly social posts work?",
          answer:
            "Launch offers 60 social posts a month, Grow 90 and Scale 240. Each post uses 1 credit from your plan's monthly credits, which cover these amounts and can also be spent on other tools. Exact channel rules and usage are displayed during setup.",
        },
        {
          question: "What does Growth AI Chat Copilot do?",
          answer:
            "Growth AI Chat Copilot brings SEO, content, AI visibility, and social planning into one conversation. Ask for ideas, a proposed plan, or next steps, then decide what to approve.",
        },
      ],
    },
    {
      title: "Account & billing",
      items: [
        {
          question: "Can I cancel any time?",
          answer: "Yes. Cancel from your billing page with no cancellation fee. Access continues until the end of your paid period.",
        },
        {
          question: "What happens to my articles if I leave?",
          answer: "You own the articles we write for you. Anything already published on your website stays there after cancellation.",
        },
      ],
    },
  ],
};

const es: FaqCopy = {
  eyebrow: "FAQ",
  title: "Preguntas frecuentes",
  intro: "Respuestas claras sobre cómo funciona RepGet, qué incluye y qué puede esperar a medida que crece.",
  contactLead: "¿Le queda alguna duda?",
  contact: "Contáctenos",
  groups: [
    {
      title: "SEO y primeros pasos",
      items: [
        {
          question: "¿Necesito saber algo de SEO?",
          answer:
            "No. RepGet investiga lo que buscan sus clientes, le ayuda a preparar artículos relevantes y le explica las mejoras de su sitio web en un lenguaje sencillo.",
        },
        {
          question: "¿Cuánto tardaré en ver resultados?",
          answer:
            "El SEO lleva tiempo. Las páginas nuevas suelen necesitar de dos a cuatro meses para empezar a atraer visitas, y en mercados competitivos puede tardar más. Medimos el progreso en lugar de prometer posiciones inmediatas.",
        },
        {
          question: "¿Garantizan que apareceré el primero en Google?",
          answer:
            "No. Nadie puede garantizar el primer puesto en Google. RepGet le ayuda a identificar oportunidades de búsqueda realistas, mejorar sus páginas y seguir lo que cambia.",
        },
        {
          question: "¿Parecerá que los artículos los ha escrito un robot?",
          answer:
            "Los artículos se generan con IA para su negocio y su mercado. Le recomendamos revisarlos antes de publicarlos. Con el editor puede ajustar la redacción, el tono, los datos y el estilo.",
        },
        {
          question: "¿Los artículos se publican en mi sitio web automáticamente?",
          answer:
            "Solo si conecta su sitio web y decide publicarlos. Si no, puede conservarlos como borradores para revisarlos, editarlos o publicarlos manualmente.",
        },
        {
          question: "¿Qué son los créditos?",
          answer:
            "Los créditos se usan en servicios como la colocación de backlinks y otros complementos. En su cuenta puede consultar su saldo disponible y en qué se gastan los créditos.",
        },
        {
          question: "¿Por qué sugieren términos de búsqueda más pequeños?",
          answer:
            "Las búsquedas muy relevantes y con menos competencia pueden traer visitas más útiles que los términos de gran volumen en los que es muy difícil posicionarse.",
        },
      ],
    },
    {
      title: "Redes, contenido y Copilot",
      items: [
        {
          question: "¿Qué redes sociales puedo conectar?",
          answer:
            "RepGet está diseñado para funcionar con las principales redes sociales. Los canales disponibles dependen de las integraciones, de los permisos de cada plataforma y de la configuración de su cuenta.",
        },
        {
          question: "¿Puedo aprobar las publicaciones antes de que se publiquen?",
          answer:
            "Sí. El flujo de redes sociales previsto le permite revisar el contenido, editar textos e imágenes y controlar la programación o la publicación.",
        },
        {
          question: "¿Un artículo puede convertirse en contenido para varias redes sociales?",
          answer:
            "Forma parte del flujo combinado: reutilice un artículo o una idea en publicaciones adaptadas a cada plataforma y revise las versiones antes de publicarlas.",
        },
        {
          question: "¿Cómo funcionan mis publicaciones mensuales en redes?",
          answer:
            "Launch ofrece 60 publicaciones en redes al mes, Grow 90 y Scale 240. Cada publicación usa 1 crédito de los créditos mensuales de su plan, que cubren estas cantidades y también pueden usarse en otras herramientas. Las reglas exactas de cada canal y el uso se muestran durante la configuración.",
        },
        {
          question: "¿Qué hace Growth AI Chat Copilot?",
          answer:
            "Growth AI Chat Copilot reúne el SEO, el contenido, la visibilidad en IA y la planificación de redes en una sola conversación. Pida ideas, un plan propuesto o los próximos pasos y decida usted qué aprobar.",
        },
      ],
    },
    {
      title: "Cuenta y facturación",
      items: [
        {
          question: "¿Puedo cancelar en cualquier momento?",
          answer: "Sí. Cancele desde su página de facturación sin cargos por cancelación. El acceso continúa hasta el final del periodo pagado.",
        },
        {
          question: "¿Qué pasa con mis artículos si me voy?",
          answer: "Los artículos que escribimos para usted son suyos. Todo lo que ya esté publicado en su sitio web permanece allí después de cancelar.",
        },
      ],
    },
  ],
};

const fr: FaqCopy = {
  eyebrow: "FAQ",
  title: "Questions fréquentes",
  intro: "Des réponses claires sur le fonctionnement de RepGet, ce qui est inclus et ce qui vous attend à mesure que vous grandissez.",
  contactLead: "Une autre question ?",
  contact: "Contactez-nous",
  groups: [
    {
      title: "SEO et premiers pas",
      items: [
        {
          question: "Dois-je m’y connaître en SEO ?",
          answer:
            "Non. RepGet recherche ce que vos clients tapent dans les moteurs de recherche, vous aide à préparer des articles pertinents et vous explique les améliorations de votre site en termes simples.",
        },
        {
          question: "Combien de temps avant de voir des résultats ?",
          answer:
            "Le SEO prend du temps. Les nouvelles pages mettent généralement deux à quatre mois à attirer des visiteurs, et davantage sur les marchés concurrentiels. Nous suivons les progrès plutôt que de promettre des positions immédiates.",
        },
        {
          question: "Garantissez-vous la première place sur Google ?",
          answer:
            "Non. Personne ne peut garantir la première place sur Google. RepGet vous aide à repérer des opportunités de recherche réalistes, à améliorer vos pages et à suivre ce qui évolue.",
        },
        {
          question: "Les articles sembleront-ils écrits par un robot ?",
          answer:
            "Les articles sont générés par IA pour votre activité et votre marché. Nous vous conseillons de les relire avant publication. L’éditeur vous permet d’ajuster la formulation, le ton, les faits et le style.",
        },
        {
          question: "Les articles sont-ils publiés automatiquement sur mon site ?",
          answer:
            "Uniquement si vous connectez votre site et choisissez de publier. Sinon, vous pouvez garder les articles en brouillon pour les relire, les modifier ou les publier manuellement.",
        },
        {
          question: "Que sont les crédits ?",
          answer:
            "Les crédits servent à des services comme le placement de backlinks et d’autres options. Vous pouvez consulter votre solde disponible et l’utilisation de vos crédits dans votre compte.",
        },
        {
          question: "Pourquoi suggérez-vous des requêtes plus modestes ?",
          answer:
            "Des recherches très pertinentes et moins concurrentielles peuvent apporter des visiteurs plus utiles que des termes à fort volume sur lesquels il est très difficile de se positionner.",
        },
      ],
    },
    {
      title: "Réseaux, contenus et Copilot",
      items: [
        {
          question: "Quels réseaux sociaux puis-je connecter ?",
          answer:
            "RepGet est conçu pour fonctionner avec les principaux réseaux sociaux. Les canaux disponibles dépendent des intégrations, des autorisations de chaque plateforme et de la configuration de votre compte.",
        },
        {
          question: "Puis-je valider les publications avant leur diffusion ?",
          answer:
            "Oui. Le flux social prévu vous permet de relire les contenus, de modifier les légendes et les visuels, et de contrôler la programmation ou la publication.",
        },
        {
          question: "Un article peut-il devenir du contenu pour plusieurs réseaux sociaux ?",
          answer:
            "C’est le principe du flux combiné : transformez un article ou une idée en publications adaptées à chaque plateforme, puis relisez les versions avant de publier.",
        },
        {
          question: "Comment fonctionnent mes publications sociales mensuelles ?",
          answer:
            "Launch propose 60 publications sociales par mois, Grow 90 et Scale 240. Chaque publication utilise 1 crédit sur les crédits mensuels de votre offre, qui couvrent ces quantités et peuvent aussi servir pour d’autres outils. Les règles précises de chaque canal et votre utilisation s’affichent lors de la configuration.",
        },
        {
          question: "Que fait Growth AI Chat Copilot ?",
          answer:
            "Growth AI Chat Copilot réunit le SEO, les contenus, la visibilité IA et la planification sociale dans une seule conversation. Demandez des idées, un plan ou les prochaines étapes, puis décidez de ce que vous validez.",
        },
      ],
    },
    {
      title: "Compte et facturation",
      items: [
        {
          question: "Puis-je résilier à tout moment ?",
          answer: "Oui. Résiliez depuis votre page de facturation, sans frais de résiliation. Votre accès reste actif jusqu’à la fin de la période payée.",
        },
        {
          question: "Que deviennent mes articles si je pars ?",
          answer: "Les articles que nous rédigeons pour vous vous appartiennent. Tout ce qui est déjà publié sur votre site y reste après la résiliation.",
        },
      ],
    },
  ],
};

const it: FaqCopy = {
  eyebrow: "FAQ",
  title: "Domande frequenti",
  intro: "Risposte chiare su come funziona RepGet, cosa è incluso e cosa aspettarsi man mano che cresce.",
  contactLead: "Ha ancora una domanda?",
  contact: "Ci contatti",
  groups: [
    {
      title: "SEO e primi passi",
      items: [
        {
          question: "Devo sapere qualcosa di SEO?",
          answer:
            "No. RepGet analizza cosa cercano i Suoi clienti, La aiuta a preparare articoli pertinenti e Le spiega i miglioramenti del sito con parole semplici.",
        },
        {
          question: "Quanto tempo serve per vedere i risultati?",
          answer:
            "La SEO richiede tempo. Le nuove pagine di solito impiegano da due a quattro mesi per iniziare ad attirare visitatori, e nei mercati competitivi può volerci di più. Monitoriamo i progressi invece di promettere posizionamenti immediati.",
        },
        {
          question: "Garantite il primo posto su Google?",
          answer:
            "No. Nessuno può garantire il primo posto su Google. RepGet La aiuta a individuare opportunità di ricerca realistiche, migliorare le Sue pagine e monitorare cosa cambia.",
        },
        {
          question: "Gli articoli sembreranno scritti da un robot?",
          answer:
            "Gli articoli sono generati con l’IA per la Sua attività e il Suo mercato. Le consigliamo di rivederli prima della pubblicazione. Con l’editor può modificare testo, tono, dati e stile.",
        },
        {
          question: "Gli articoli vengono pubblicati automaticamente sul mio sito?",
          answer:
            "Solo se collega il Suo sito e sceglie di pubblicarli. Altrimenti può tenerli come bozze da rivedere, modificare o pubblicare manualmente.",
        },
        {
          question: "Cosa sono i crediti?",
          answer:
            "I crediti si usano per servizi come l’inserimento di backlink e altri servizi aggiuntivi. Nel Suo account può controllare il saldo disponibile e come vengono usati i crediti.",
        },
        {
          question: "Perché suggerite termini di ricerca più piccoli?",
          answer:
            "Ricerche molto pertinenti e meno competitive possono portare visitatori più utili rispetto a termini ad alto volume per cui è molto difficile posizionarsi.",
        },
      ],
    },
    {
      title: "Social, contenuti e Copilot",
      items: [
        {
          question: "Quali piattaforme social posso collegare?",
          answer:
            "RepGet è pensato per funzionare con le principali piattaforme social. I canali disponibili dipendono dalle integrazioni, dalle autorizzazioni delle piattaforme e dalla configurazione del Suo account.",
        },
        {
          question: "Posso approvare i post prima della pubblicazione?",
          answer:
            "Sì. Il flusso social previsto Le permette di rivedere i contenuti, modificare testi e immagini e controllare la programmazione o la pubblicazione.",
        },
        {
          question: "Un articolo può diventare contenuto per più piattaforme social?",
          answer:
            "È parte del flusso combinato: trasformi un articolo o un’idea in post specifici per ogni piattaforma, poi riveda le versioni prima di pubblicarle.",
        },
        {
          question: "Come funzionano i miei post social mensili?",
          answer:
            "Launch offre 60 post social al mese, Grow 90 e Scale 240. Ogni post utilizza 1 credito dei crediti mensili del Suo piano, che coprono queste quantità e possono essere usati anche per altri strumenti. Le regole esatte dei canali e l’utilizzo vengono mostrati durante la configurazione.",
        },
        {
          question: "Cosa fa Growth AI Chat Copilot?",
          answer:
            "Growth AI Chat Copilot riunisce SEO, contenuti, visibilità nell’IA e pianificazione social in un’unica conversazione. Chieda idee, un piano o i prossimi passi, poi decida cosa approvare.",
        },
      ],
    },
    {
      title: "Account e fatturazione",
      items: [
        {
          question: "Posso disdire in qualsiasi momento?",
          answer: "Sì. Disdica dalla pagina di fatturazione senza costi di disdetta. L’accesso resta attivo fino alla fine del periodo pagato.",
        },
        {
          question: "Cosa succede ai miei articoli se me ne vado?",
          answer: "Gli articoli che scriviamo per Lei sono Suoi. Tutto ciò che è già pubblicato sul Suo sito resta lì anche dopo la disdetta.",
        },
      ],
    },
  ],
};

const de: FaqCopy = {
  eyebrow: "FAQ",
  title: "Häufige Fragen",
  intro: "Klare Antworten darauf, wie RepGet funktioniert, was enthalten ist und was Sie erwartet, während Sie wachsen.",
  contactLead: "Noch eine Frage?",
  contact: "Kontaktieren Sie uns",
  groups: [
    {
      title: "SEO & erste Schritte",
      items: [
        {
          question: "Muss ich mich mit SEO auskennen?",
          answer:
            "Nein. RepGet recherchiert, wonach Ihre Kunden suchen, hilft Ihnen bei der Vorbereitung relevanter Artikel und erklärt Verbesserungen an Ihrer Website in verständlicher Sprache.",
        },
        {
          question: "Wie lange dauert es, bis ich Ergebnisse sehe?",
          answer:
            "SEO braucht Zeit. Neue Seiten benötigen meist zwei bis vier Monate, bis sie Besucher anziehen, in umkämpften Märkten auch länger. Wir verfolgen den Fortschritt, statt sofortige Rankings zu versprechen.",
        },
        {
          question: "Garantieren Sie mir Platz eins bei Google?",
          answer:
            "Nein. Niemand kann einen ersten Platz bei Google garantieren. RepGet hilft Ihnen, realistische Suchchancen zu finden, Ihre Seiten zu verbessern und Veränderungen zu verfolgen.",
        },
        {
          question: "Klingen die Artikel, als hätte sie ein Roboter geschrieben?",
          answer:
            "Die Artikel werden per KI für Ihr Unternehmen und Ihren Markt erstellt. Prüfen Sie sie vor der Veröffentlichung. Im Editor können Sie Formulierungen, Tonalität, Fakten und Stil anpassen.",
        },
        {
          question: "Erscheinen die Artikel automatisch auf meiner Website?",
          answer:
            "Nur wenn Sie Ihre Website verbinden und die Veröffentlichung wählen. Andernfalls können Sie Artikel als Entwürfe behalten, um sie zu prüfen, zu bearbeiten oder manuell zu veröffentlichen.",
        },
        {
          question: "Was sind Credits?",
          answer:
            "Credits werden für Leistungen wie Backlink-Platzierungen und andere Zusatzleistungen verwendet. Ihr verfügbares Guthaben und wofür Credits verbraucht werden, sehen Sie in Ihrem Konto.",
        },
        {
          question: "Warum schlagen Sie kleinere Suchbegriffe vor?",
          answer:
            "Relevante Suchanfragen mit geringerer Konkurrenz können nützlichere Besucher bringen als Begriffe mit hohem Suchvolumen, für die ein Ranking sehr schwierig ist.",
        },
      ],
    },
    {
      title: "Social, Content & Copilot",
      items: [
        {
          question: "Welche Social-Media-Plattformen kann ich verbinden?",
          answer:
            "RepGet ist für die großen Social-Media-Plattformen ausgelegt. Welche Kanäle Ihnen zur Verfügung stehen, hängt von den Integrationen, den Berechtigungen der Plattformen und Ihrer Kontokonfiguration ab.",
        },
        {
          question: "Kann ich Social-Posts vor der Veröffentlichung freigeben?",
          answer:
            "Ja. Der geplante Social-Workflow ermöglicht es Ihnen, Inhalte zu prüfen, Texte und Medien zu bearbeiten und Planung oder Veröffentlichung zu steuern.",
        },
        {
          question: "Kann aus einem Artikel Content für mehrere Social-Media-Plattformen werden?",
          answer:
            "Das ist Teil des kombinierten Workflows: Machen Sie aus einem Artikel oder einer Idee plattformgerechte Posts und prüfen Sie die Versionen vor der Veröffentlichung.",
        },
        {
          question: "Wie funktionieren meine monatlichen Social-Posts?",
          answer:
            "Launch bietet 60 Social-Posts pro Monat, Grow 90 und Scale 240. Jeder Post verbraucht 1 Credit aus den monatlichen Credits Ihres Pakets, die diese Mengen abdecken und auch für andere Tools genutzt werden können. Die genauen Kanalregeln und Ihre Nutzung werden bei der Einrichtung angezeigt.",
        },
        {
          question: "Was macht der Growth AI Chat Copilot?",
          answer:
            "Der Growth AI Chat Copilot bringt SEO, Content, KI-Sichtbarkeit und Social-Media-Planung in einem Gespräch zusammen. Fragen Sie nach Ideen, einem Planvorschlag oder nächsten Schritten und entscheiden Sie dann, was Sie freigeben.",
        },
      ],
    },
    {
      title: "Konto & Abrechnung",
      items: [
        {
          question: "Kann ich jederzeit kündigen?",
          answer: "Ja. Kündigen Sie über Ihre Abrechnungsseite ohne Kündigungsgebühr. Der Zugang bleibt bis zum Ende Ihres bezahlten Zeitraums bestehen.",
        },
        {
          question: "Was passiert mit meinen Artikeln, wenn ich kündige?",
          answer: "Die Artikel, die wir für Sie schreiben, gehören Ihnen. Alles, was bereits auf Ihrer Website veröffentlicht ist, bleibt dort auch nach der Kündigung.",
        },
      ],
    },
  ],
};

const COPY: Record<Locale, FaqCopy> = { en, es, fr, it, de };

export function faqCopy(locale: Locale): FaqCopy {
  return COPY[locale] ?? en;
}
