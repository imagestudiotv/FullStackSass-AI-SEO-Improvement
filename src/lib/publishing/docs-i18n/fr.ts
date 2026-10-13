import type { DocsTranslation } from "../docs";

/**
 * The setup guides in French. Same steps and claims as the English guides
 * in ../docs.ts: change one, change all five. Naming rules as in ./es.ts.
 */
export const fr: DocsTranslation = {
  ui: {
    metaTitle: "Guides d’intégration",
    metaDescription: "Comment connecter WordPress, Ghost, Shopify ou votre propre endpoint pour que les articles se publient automatiquement.",
    home: "Accueil",
    breadcrumb: "Guides d’intégration",
    title: "Connectez votre site",
    intro:
      "Connectez-le une fois, et chaque article que nous rédigeons se publie tout seul sur votre site. Choisissez votre plateforme pour voir les étapes exactes, y compris où se trouve chaque information dans l’administration de cette plateforme.",
    otherBefore: "Vous utilisez autre chose ?",
    otherLink: "L’intégration par webhook",
    otherAfter: "envoie les articles terminés à n’importe quel endpoint que vous contrôlez.",
    connectTitle: "Connecter {name}",
    notFound: "Guide introuvable",
    before: "Avant de commencer",
    setup: "Configuration",
    wrong: "En cas de problème",
    official: "Documentation officielle de {name} :",
    readHere: "la lire ici",
    ready: "Prêt à connecter votre site ?",
    readyBody:
      "Ouvrez votre site dans l’application, allez dans Paramètres → Intégrations et choisissez {name}. Cliquez ensuite sur {button} : nous créons un vrai brouillon sur votre site pour que vous vérifiiez que tout le parcours fonctionne avant de programmer quoi que ce soit.",
    publishTest: "Publier un article de test",
    goToWebsites: "Aller à mes sites",
    englishUi: "Les menus et boutons de {name} sont nommés tels qu’ils apparaissent dans son interface en anglais.",
  },
  docs: {
    "wordpress-plugin": {
      name: "Plugin WordPress",
      summary:
        "Publiez sur WordPress avec notre plugin. Il fonctionne même quand l’API REST est bloquée, et nous ne détenons jamais de mot de passe de votre site.",
      requirements: [
        "Un site WordPress sur lequel vous pouvez installer des extensions : auto-hébergé (wordpress.org), ou une offre WordPress.com qui les autorise (Business ou supérieure)",
        "WordPress 5.6 ou plus récent, et PHP 7.4 ou plus récent",
        "Un compte administrateur sur le site WordPress : les éditeurs et les auteurs ne peuvent ni installer d’extensions ni voir l’écran RepGet",
        "Une formule active pour ce site dans RepGet",
        "L’adresse de votre site dans RepGet (Paramètres → Entreprise) identique à votre adresse WordPress, pour que les boutons ci-dessous ouvrent le bon site",
      ],
      steps: [
        {
          title: "Téléchargez le plugin depuis RepGet",
          body: "Dans RepGet, choisissez votre site dans le sélecteur en haut, puis ouvrez Paramètres → Intégrations et trouvez le panneau Plugin WordPress. Cliquez sur Télécharger le plugin. Cela enregistre repget-connector.zip, environ 35 Ko. LAISSEZ-LE COMPRESSÉ : ne le décompressez pas et ne l’ouvrez pas avant. Certains navigateurs (Safari sur Mac, par exemple) décompressent automatiquement les fichiers zip, et c’est la cause la plus fréquente d’échec de l’installation.",
        },
        {
          title: "Installez-le dans WordPress",
          body: "Cliquez sur Ouvrir mon WordPress dans le même panneau. Cela ouvre Extensions → Ajouter une extension → Téléverser une extension sur votre propre site (vous pouvez aussi y aller vous-même). Choisissez le fichier repget-connector.zip tel qu’il a été téléchargé, cliquez sur Installer maintenant, puis sur Activer l’extension.",
        },
        {
          title: "WordPress ouvre l’écran RepGet",
          body: "L’activation du plugin vous amène directement sur son écran. Par la suite, vous le trouverez sous le nom RepGet dans le menu de gauche de l’administration WordPress, entre Commentaires et Apparence, ainsi que via le lien Settings sous le plugin, sur la page Extensions. Seuls les administrateurs le voient, car la clé contrôle ce qui est publié sur votre site.",
        },
        {
          title: "Connexion - Option A : commencer dans RepGet (recommandé)",
          body: "Revenez dans l’onglet RepGet (Paramètres → Intégrations → Plugin WordPress). La carte indique quel espace de travail RepGet vous connectez : vérifiez que c’est le bon. Cliquez sur Connecter WordPress : l’écran RepGet s’ouvre dans votre WordPress, avec le bouton Finish connecting to RepGet. Cliquez dessus. Votre navigateur passe un instant par RepGet et revient aussitôt : RepGet remet la clé directement à WordPress, et elle n’apparaît jamais à l’écran, il n’y a rien à copier. Si WordPress vous demande d’abord de vous connecter, connectez-vous, puis cliquez sur Rouvrir WordPress dans RepGet. Avec le plugin 1.6, c’est le champ Integration Key qui se remplit : cliquez sur Save and connect. Si votre navigateur a bloqué le nouvel onglet, RepGet affiche la clé avec Copier la clé : collez-la sous Advanced: use an Integration Key (plugin 1.7) ou dans le champ Integration Key (1.6), puis cliquez sur Save and connect.",
        },
        {
          title: "Connexion - Option B : commencer dans WordPress",
          body: "À la place de l’option A, avec le plugin 1.7 ou plus récent : sur l’écran RepGet dans WordPress, cliquez sur Connect to RepGet. Connectez-vous à RepGet si on vous le demande, avec le compte qui doit publier sur ce site. La page Connecter votredomaine à RepGet ? liste vos sites portant ce domaine et l’espace de travail de chacun ; cliquez sur Connecter votredomaine sur le bon. Vous revenez directement dans WordPress. Si le domaine ne figure dans aucun de vos sites, RepGet vous le dit : ajoutez d’abord le site, ou cliquez sur Utiliser un autre compte.",
        },
        {
          title: "Si le site était connecté à un autre compte",
          body: "Les deux options demandent d’abord confirmation quand ce site WordPress est connecté à un autre compte ou à un autre site RepGet : le bouton indique alors Déplacer votredomaine vers, suivi de l’espace de travail choisi. La clé de l’ancien compte ne cesse de fonctionner qu’une fois la nouvelle connexion opérationnelle, et ce compte en est informé. Reconnecter le même site ne demande rien.",
        },
        {
          title: "Vérifiez qu’il indique Connected, avec le bon compte",
          body: "L’écran indique Connected to, suivi de l’espace de travail RepGet et de votre domaine. Dans RepGet, inutile d’actualiser : en quelques secondes la carte passe au vert et l’étape de connexion de votre site est cochée. S’il indique un AUTRE compte ou un autre site, cliquez sur Connect to a different RepGet account dans WordPress (plugin 1.7), ou sur Connecter WordPress dans le compte voulu, et terminez à nouveau : c’est la connexion enregistrée dans WordPress qui décide quel compte y publie.",
        },
        {
          title: "Comment les articles arrivent",
          body: "Votre premier article est publié dès qu’il est rédigé. Ensuite, RepGet envoie les articles selon Paramètres → Paramètres des articles → Quand un article est terminé : gardés dans RepGet pour que vous les relisiez, envoyés en brouillon le jour prévu, ou publiés le jour prévu. Cliquer sur Publier sur un article dans RepGet le publie immédiatement : RepGet demande au plugin de vérifier tout de suite (plugin 1.4 ou plus récent). Le plugin vérifie aussi de lui-même toutes les heures, et Check for articles now, sur l’écran RepGet dans WordPress, récupère aussitôt tout ce qui est dû.",
        },
        {
          title: "Retrouvez vos articles publiés",
          body: "Dans RepGet, ouvrez l’article : un article publié a un bouton Voir sur votre site sous son titre, et son historique indique le lien. Dans WordPress, allez dans Articles → Tous les articles : les articles RepGet sont des articles ordinaires que vous pouvez modifier, dépublier ou supprimer. Sur votre site, ils apparaissent à leur propre adresse (par exemple votresite.com/titre-de-l-article/, selon Réglages → Permaliens) et dans la liste de votre blog, c’est-à-dire la page choisie dans Réglages → Lecture → Page des articles.",
        },
      ],
      troubleshooting: [
        {
          problem: "« Le paquet n’a pas pu être installé »",
          fix: "Le zip a été décompressé puis recompressé en route, ce que certains navigateurs font automatiquement au téléchargement. Téléchargez-le à nouveau et téléversez le fichier tel qu’il arrive, sans l’ouvrir avant.",
        },
        {
          problem: "Il n’y a pas de bouton Téléverser une extension",
          fix: "Votre compte n’est pas administrateur, ou le site est sur une offre WordPress.com qui n’autorise pas les extensions.",
        },
        {
          problem: "« The key was rejected. Check it was copied in full. »",
          fix: "Un seul message couvre volontairement toutes les causes, pour que quelqu’un qui essaie des clés au hasard n’apprenne rien de la réponse. Vérifiez trois choses dans l’ordre : la clé a-t-elle été copiée EN ENTIER (une copie partielle est de loin la cause la plus fréquente) ; est-elle toujours ACTIVE, ou a-t-elle été révoquée dans RepGet ; est-ce bien la clé de CE site, et non d’un autre site de votre espace de travail. Le plus rapide : cliquez sur Connecter WordPress dans RepGet, puis terminez dans l’onglet WordPress qui s’ouvre.",
        },
        {
          problem: "Ouvrir mon WordPress ouvre le mauvais site",
          fix: "L’adresse enregistrée dans RepGet n’est pas votre adresse WordPress. Corrigez-la dans Paramètres → Entreprise, puis cliquez de nouveau sur le bouton.",
        },
        {
          problem: "Je ne vois pas RepGet dans le menu WordPress",
          fix: "Il vous faut un compte administrateur. Les éditeurs et les auteurs ne le voient pas, car la clé contrôle ce qui est publié.",
        },
        {
          problem: "Connecté, mais aucun article n’arrive",
          fix: "Rien n’est envoyé tant qu’aucun article n’est dû. Vérifiez dans l’ordre : la publication automatique est-elle activée dans RepGet ; la date prévue de l’article est-elle arrivée ; l’article est-il vraiment rédigé (s’il est encore planifié ou en rédaction, pas encore). Pour en envoyer un tout de suite malgré tout, ouvrez l’article dans RepGet et cliquez sur Publier, puis sur Check for articles now dans WordPress.",
        },
        {
          problem: "L’article est coupé, ou ressemble à une page de portfolio ou de projet",
          fix: "Votre thème affiche les articles WordPress ordinaires avec une mise en page différente de celle de votre blog (souvent une page de portfolio ou de projet avec un court panneau de texte), si bien qu’un article complet n’y tient pas. Sur l’écran RepGet dans WordPress, réglez Publish articles as sur le type de contenu qu’utilisent vos articles de blog existants (par exemple Editorial), puis cliquez sur Save (Save and connect avant le plugin 1.7). Les articles déjà créés par RepGet y sont déplacés aussi, et RepGet reçoit leurs nouvelles adresses. Nécessite le plugin 1.5 ou plus récent.",
        },
        {
          problem: "Les articles arrivent en brouillon au lieu d’être publiés",
          fix: "Paramètres → Paramètres des articles → Quand un article est terminé est réglé sur L’envoyer sur mon site en brouillon, qui fait exactement cela. Choisissez Le publier le jour prévu pour les prochains articles ; les brouillons déjà créés peuvent être publiés depuis l’écran Articles de WordPress.",
        },
        {
          problem: "Cliquer sur Publier dans RepGet indique que l’article est en file d’attente",
          fix: "Votre site n’a pas répondu quand RepGet a demandé au plugin de vérifier, donc l’article attend la vérification horaire du plugin. Le plus souvent, le plugin est antérieur à la 1.4.0 : téléchargez-le à nouveau depuis RepGet et téléversez-le de la même façon (WordPress propose de remplacer la version actuelle par celle téléversée ; votre clé est conservée). À partir du plugin 1.7, WordPress propose lui-même les nouvelles versions dans Extensions, comme pour toute autre extension. Sinon, une extension de sécurité ou un pare-feu bloque peut-être les requêtes externes vers wp-admin/admin-ajax.php ; autorisez les requêtes avec action=repget_sync.",
        },
        {
          problem: "Les articles arrivent plus d’une heure après leur échéance",
          fix: "Le plugin vérifie de lui-même toutes les heures, mais le planificateur de WordPress ne s’exécute que lorsque quelqu’un visite votre site : sur un site peu fréquenté, la vérification a donc lieu en retard. C’est le fonctionnement de WordPress, pas une panne. Cliquez sur Check for articles now pour récupérer immédiatement, ou demandez à votre hébergeur de configurer une vraie tâche cron si l’horaire compte pour vous.",
        },
        {
          problem: "WordPress indique Connected, mais RepGet attend toujours",
          fix: "WordPress est connecté avec une autre clé : souvent celle d’un autre compte RepGet pour le même site, ou d’un essai précédent. Dans le compte RepGet que vous voulez utiliser, cliquez sur Connecter WordPress, puis terminez dans l’onglet WordPress qui s’ouvre. C’est la connexion enregistrée dans WordPress qui décide quel compte publie sur le site. Inutile de retrouver ou de copier une ancienne clé.",
        },
        {
          problem: "RepGet indique que mon site n’est pas encore dans ce compte",
          fix: "Vous êtes connecté à un compte RepGet qui n’a aucun site à cette adresse WordPress. Cliquez sur Utiliser un autre compte et connectez-vous au compte qui l’a, ou ajoutez d’abord le site, puis cliquez de nouveau sur Connect to RepGet dans WordPress. L’adresse du site dans RepGet doit être l’adresse WordPress (avec ou sans www., peu importe). Si WordPress fonctionne volontairement à une autre adresse (par exemple blog.example.com pour example.com), connectez-le avec une clé : dans RepGet, ouvrez Clés (avancé) et cliquez sur Nouvelle clé, puis dans WordPress collez-la sous Advanced: use an Integration Key et cliquez sur Save and connect.",
        },
        {
          problem: "« Cette connexion a été ouverte ailleurs »",
          fix: "Une connexion ne peut être terminée que dans le navigateur qui l’a ouverte en premier : un lien copié dans un autre navigateur ou envoyé à quelqu’un d’autre n’approuve donc rien. Retournez dans WordPress et cliquez à nouveau sur Connect to RepGet, dans le navigateur où vous êtes connecté à RepGet.",
        },
        {
          problem: "J’ai perdu ma clé",
          fix: "Vous n’avez jamais besoin d’une ancienne clé : cliquez sur Connecter WordPress dans RepGet et terminez dans WordPress. Les clés inutilisées sont supprimées automatiquement une fois WordPress connecté. Pour qu’un site cesse de publier, cliquez sur Disconnect dans WordPress (plugin 1.7), ou ouvrez Clés (avancé) dans RepGet et cliquez sur Révoquer : le site en est informé immédiatement.",
        },
      ],
    },
    wordpress: {
      name: "WordPress",
      summary:
        "Publiez directement sur un site WordPress auto-hébergé avec un mot de passe d’application. Aucun plugin à installer, mais consultez le guide du plugin si votre hébergeur bloque l’API REST.",
      requirements: [
        "Un site WordPress auto-hébergé (wordpress.org, pas une offre gratuite wordpress.com)",
        "Un compte sur ce site avec le rôle Éditeur ou Administrateur",
        "WordPress 5.6 ou plus récent, la version où sont arrivés les mots de passe d’application",
      ],
      steps: [
        {
          title: "Ouvrez votre profil WordPress",
          body: "Connectez-vous à WordPress et allez dans Comptes → Profil (Utilisateurs → Profil selon la version). Si vous gérez plusieurs comptes, utilisez celui sous lequel les articles doivent être publiés : c’est lui qui apparaît comme auteur de chaque article.",
        },
        {
          title: "Créez un mot de passe d’application",
          body: "Descendez en bas de cette page, jusqu’à Mots de passe d’application. Saisissez un nom que vous reconnaîtrez plus tard, comme RepGet, et cliquez sur Ajouter un nouveau mot de passe d’application.",
        },
        {
          title: "Copiez le mot de passe à l’identique",
          body: "WordPress ne l’affiche qu’une fois, en groupes séparés par des espaces. Copiez-le en entier, espaces compris : ce n’est pas votre mot de passe de connexion, et votre mot de passe de connexion ne fonctionne pas ici.",
        },
        {
          title: "Connectez-le ici",
          body: "Dans RepGet, ouvrez Paramètres → Intégrations et choisissez WordPress. Saisissez l’adresse de votre site, votre identifiant WordPress et le mot de passe d’application que vous venez de copier.",
        },
        {
          title: "Publiez un article de test",
          body: "Cliquez sur Publier un article de test. Nous créons un vrai brouillon sur votre site et vous renvoyons un lien vers celui-ci. Si cela fonctionne, les articles programmés fonctionneront aussi, et le brouillon peut être supprimé sans risque.",
        },
      ],
      troubleshooting: [
        {
          problem: "Mots de passe d’application n’apparaît pas sur la page du profil",
          fix: "Cette section est masquée quand WordPress n’est pas servi en HTTPS, et chez certains hébergeurs infogérés qui la désactivent. Vérifiez d’abord que le site se charge en https://, puis demandez à votre hébergeur si l’API REST est activée.",
        },
        {
          problem: "« Désolé, vous n’avez pas l’autorisation de créer des articles »",
          fix: "Le compte s’authentifie mais ne peut pas publier. Donnez-lui le rôle Éditeur ou Administrateur : Auteur ne suffit pas pour tout ce que nous faisons.",
        },
        {
          problem: "Une extension de sécurité bloque la connexion",
          fix: "Wordfence, iThemes et les extensions similaires peuvent bloquer les requêtes vers l’API REST. Autorisez /wp-json/wp/v2/ pour les requêtes authentifiées, ou autorisez spécifiquement les nôtres.",
        },
      ],
    },
    ghost: {
      name: "Ghost",
      summary: "Publiez sur un blog Ghost avec une clé de l’Admin API.",
      requirements: ["Un site Ghost que vous administrez, auto-hébergé ou sur Ghost(Pro)", "Ghost 4.0 ou plus récent"],
      steps: [
        { title: "Ouvrez les réglages des intégrations", body: "Dans l’administration de Ghost, allez dans Settings → Advanced → Integrations." },
        {
          title: "Ajoutez une intégration personnalisée",
          body: "Choisissez Add custom integration et nommez-la RepGet. Ghost affiche alors une Content API key et une Admin API key.",
        },
        {
          title: "Copiez la clé ADMIN",
          body: "Prenez l’Admin API key, pas la Content API key. Elle ressemble à deux valeurs reliées par deux-points : copiez toute la chaîne, deux-points compris. La clé Content ne peut que lire, elle échoue donc à la première publication.",
        },
        {
          title: "Connectez-la ici",
          body: "Dans RepGet, ouvrez Paramètres → Intégrations, choisissez Ghost, puis saisissez l’adresse de votre site Ghost et l’Admin API key.",
        },
        { title: "Publiez un article de test", body: "Cliquez sur Publier un article de test. Nous créons un brouillon dans Ghost et vous renvoyons un lien vers celui-ci." },
      ],
      troubleshooting: [
        {
          problem: "« Invalid token » ou 401 à la connexion",
          fix: "C’est presque toujours la Content API key au lieu de l’Admin. La clé Admin contient deux-points ; la clé Content, non.",
        },
        {
          problem: "L’adresse du site est refusée",
          fix: "Utilisez l’adresse de votre administration Ghost, sans chemin à la fin : https://example.com, et non https://example.com/ghost.",
        },
      ],
    },
    shopify: {
      name: "Shopify",
      summary: "Publiez des articles sur un blog de votre boutique Shopify.",
      requirements: [
        "Une boutique Shopify dont vous êtes propriétaire ou que vous administrez en tant que membre du personnel",
        "L’autorisation de créer une application personnalisée dans cette boutique",
        "Au moins un blog créé dans Online Store → Blog posts",
      ],
      steps: [
        {
          title: "Autorisez le développement d’applications personnalisées",
          body: "Dans l’administration Shopify, allez dans Settings → Apps and sales channels → Develop apps. Si c’est la première fois, cliquez sur Allow custom app development et confirmez.",
        },
        { title: "Créez l’application", body: "Cliquez sur Create an app, nommez-la RepGet, puis ouvrez Configuration → Admin API integration." },
        {
          title: "Accordez les autorisations du blog",
          body: "Activez write_content et read_content. Ces deux autorisations couvrent la création et la mise à jour des articles de blog ; rien d’autre n’est nécessaire, et mieux vaut ne pas en accorder davantage.",
        },
        {
          title: "Installez l’application et copiez le jeton",
          body: "Cliquez sur Install app, puis affichez l’Admin API access token. Shopify ne l’affiche qu’une fois. Il commence par shpat_.",
        },
        {
          title: "Connectez-le ici",
          body: "Dans RepGet, ouvrez Paramètres → Intégrations, choisissez Shopify, saisissez l’adresse de votre boutique (example.myshopify.com) et le jeton d’accès, puis choisissez le blog où publier.",
        },
      ],
      troubleshooting: [
        {
          problem: "Aucun blog n’apparaît dans la liste",
          fix: "Les boutiques Shopify n’en ont pas au départ. Créez un blog dans Online Store → Blog posts → Manage blogs, puis reconnectez.",
        },
        {
          problem: "« Access denied » à la publication",
          fix: "Il manque write_content au jeton. Rouvrez la configuration de l’application, ajoutez-le et réinstallez-la : modifier les autorisations génère un nouveau jeton.",
        },
      ],
    },
    webflow: {
      name: "Webflow",
      summary: "Publiez dans une collection du CMS de votre site Webflow avec un Site API token.",
      requirements: [
        "Un site Webflow sur une offre payante : l’API du CMS n’est pas disponible dans l’offre gratuite",
        "Une collection CMS pour votre blog, avec un champ de texte enrichi pour le corps",
        "L’autorisation de créer des jetons d’API sur ce site",
      ],
      steps: [
        {
          title: "Créez un Site API token",
          body: "Dans Webflow, ouvrez Site settings → Apps & integrations → API access, puis Generate API token. Donnez-lui la lecture et l’écriture du CMS : un jeton en lecture seule se connecte sans problème, puis échoue à la première publication.",
        },
        { title: "Copiez le jeton", body: "Webflow ne l’affiche qu’une fois. Copiez la valeur complète avant de fermer la fenêtre." },
        {
          title: "Trouvez l’ID de la collection du blog",
          body: "Ouvrez la collection dans le Designer. L’ID est la dernière partie de l’URL, une longue chaîne de lettres et de chiffres.",
        },
        {
          title: "Connectez-le ici",
          body: "Dans RepGet, ouvrez Paramètres → Intégrations, choisissez Webflow, puis saisissez le jeton et l’ID de la collection. Avant de l’accepter, nous vérifions que la collection a un endroit où placer le corps d’un article.",
        },
        {
          title: "Publiez un article de test",
          body: "Cliquez sur Publier un article de test. Nous créons un vrai élément dans la collection pour que vous vérifiiez qu’il arrive où vous l’attendez.",
        },
      ],
      troubleshooting: [
        {
          problem: "« That collection has no rich text field »",
          fix: "Une collection Webflow est ce que la personne qui a conçu le site a construit, et un article a besoin d’un endroit pour son corps. Ajoutez un champ Rich Text à la collection, ou indiquez-nous la collection de votre blog plutôt qu’une autre.",
        },
        {
          problem: "L’article n’apparaît pas sur le site en ligne",
          fix: "Les éléments créés via l’API Webflow ne sont en ligne qu’une fois le site publié. Cliquez sur Publish dans le Designer, ou activez la publication automatique de la collection.",
        },
        {
          problem: "« That token cannot write to the CMS »",
          fix: "Le jeton a été créé sans cms:write. Un jeton ne peut pas être modifié après sa création : générez-en un nouveau avec les deux autorisations du CMS.",
        },
      ],
    },
    wix: {
      name: "Wix",
      summary: "Publiez sur le blog de votre site Wix avec une clé d’API.",
      requirements: ["Un site Wix avec l’application Blog installée", "Un accès propriétaire ou administrateur, pour pouvoir créer des clés d’API"],
      steps: [
        { title: "Ouvrez la page des clés d’API", body: "Dans le tableau de bord Wix, allez dans Settings → API keys, puis Generate API key." },
        {
          title: "Donnez-lui les autorisations du blog",
          body: "Attribuez un rôle qui inclut Blog : sans lui, la clé s’authentifie mais ne peut pas créer d’articles.",
        },
        {
          title: "Copiez la clé et le Site ID",
          body: "La clé ne s’affiche qu’une fois. Le Site ID figure à côté du site sur le même écran. Les deux sont nécessaires : un compte Wix peut posséder plusieurs sites, la clé seule ne dit donc pas lequel.",
        },
        {
          title: "Connectez-la ici",
          body: "Dans RepGet, ouvrez Paramètres → Intégrations, choisissez Wix et saisissez les deux valeurs. Nous listons vos articles existants pour confirmer que la clé atteint le blog.",
        },
      ],
      troubleshooting: [
        {
          problem: "« Wix could not find that site, or the site has no blog »",
          fix: "Soit le Site ID appartient à un autre site, soit l’application Blog n’est pas installée. Ajoutez Blog depuis le Wix App Market et réessayez.",
        },
        {
          problem: "Le corps de l’article apparaît comme un seul bloc dans l’éditeur",
          fix: "C’est normal. Wix stocke le contenu enrichi dans son propre format ; nous envoyons l’article sous forme d’un seul bloc HTML, qui s’affiche correctement sur la page publiée mais apparaît comme un seul élément intégré pendant l’édition.",
        },
      ],
    },
    webhook: {
      name: "Webhook personnalisé",
      summary: "Envoyez les articles terminés à n’importe quel endpoint que vous contrôlez, pour les plateformes que nous ne prenons pas en charge directement.",
      requirements: [
        "Un endpoint HTTPS qui accepte un POST avec un corps JSON",
        "Un endroit où conserver le secret de signature pour vérifier les requêtes",
      ],
      steps: [
        {
          title: "Créez un endpoint",
          body: "Acceptez un POST avec un corps JSON contenant le titre, le corps HTML, le slug, l’extrait et le statut. Répondez 2xx une fois qu’il est enregistré ; toute autre réponse est traitée comme un échec et la requête est renvoyée.",
        },
        {
          title: "Connectez-le ici",
          body: "Dans RepGet, ouvrez Paramètres → Intégrations, choisissez Custom (webhook), puis saisissez l’URL de l’endpoint et un secret de signature que vous générez.",
        },
        {
          title: "Vérifiez la signature",
          body: "Chaque requête porte un HMAC-SHA256 du corps brut, calculé avec votre secret de signature. Comparez-le avant de faire confiance au contenu : un endpoint qui saute cette étape accepte tout ce que n’importe qui lui envoie.",
        },
        {
          title: "Publiez un article de test",
          body: "Cliquez sur Publier un article de test pour envoyer un vrai contenu et vérifier que votre code le traite avant l’arrivée de tout article programmé.",
        },
      ],
      troubleshooting: [
        {
          problem: "Les requêtes sont renvoyées",
          fix: "Toute réponse autre que 2xx est traitée comme un échec. Renvoyez 200 dès que le contenu est enregistré, et faites le travail plus long ensuite.",
        },
        {
          problem: "La signature ne correspond jamais",
          fix: "Calculez le HMAC sur le corps BRUT de la requête, avant toute analyse du JSON. Resérialiser l’objet modifie les octets, et la signature ne correspondra jamais.",
        },
      ],
    },
  },
};
