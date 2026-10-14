import type { DocsTranslation } from "../docs";

/**
 * The setup guides in Spanish. Same steps and claims as the English guides
 * in ../docs.ts: change one, change all five.
 *
 * RepGet's own buttons and menus are named as the Spanish app shows them;
 * the WordPress plugin's screen is English-only, so its buttons keep their
 * English names (as the app's own Spanish text does). WordPress menus are
 * named as Spanish WordPress shows them. Ghost, Shopify, Webflow and Wix are
 * named as their English interfaces show them, which the guide says.
 */
export const es: DocsTranslation = {
  ui: {
    metaTitle: "Guías de integración",
    metaDescription: "Cómo conectar WordPress, Ghost, Shopify o su propio endpoint para que los artículos se publiquen automáticamente.",
    home: "Inicio",
    breadcrumb: "Guías de integración",
    title: "Conecte su web",
    intro:
      "Conéctela una vez y cada artículo que escribimos se publica solo en su web. Elija su plataforma para ver los pasos exactos, incluido dónde está cada dato en el panel de esa plataforma.",
    otherBefore: "¿Usa otra plataforma?",
    otherLink: "La integración por webhook",
    otherAfter: "envía los artículos terminados a cualquier endpoint que usted controle.",
    connectTitle: "Conectar {name}",
    notFound: "Guía no encontrada",
    before: "Antes de empezar",
    setup: "Configuración",
    wrong: "Si algo sale mal",
    official: "Documentación oficial de {name}:",
    readHere: "léala aquí",
    ready: "¿Listo para conectar?",
    readyBody:
      "Abra su web en la aplicación, vaya a Ajustes → Integraciones y elija {name}. Después pulse {button}: creamos un borrador real en su web para que compruebe que todo el recorrido funciona antes de programar nada.",
    publishTest: "Publicar artículo de prueba",
    goToWebsites: "Ir a mis sitios web",
    englishUi: "Los menús y botones de {name} se nombran tal como aparecen en su interfaz en inglés.",
  },
  docs: {
    "wordpress-plugin": {
      name: "Plugin de WordPress",
      summary: "Publique en WordPress con nuestro plugin. Funciona aunque la API REST esté bloqueada, y nunca guardamos una contraseña de su web.",
      requirements: [
        "Una web WordPress en la que pueda instalar plugins: autoalojada (wordpress.org) o un plan de WordPress.com que permita plugins (Business o superior)",
        "WordPress 5.6 o posterior, y PHP 7.4 o posterior",
        "Una cuenta de administrador en la web WordPress: los editores y autores no pueden instalar plugins ni ver la pantalla de RepGet",
        "Un plan activo para este sitio web en RepGet",
        "La dirección de su web en RepGet (Ajustes → Negocio) igual a la de su WordPress, para que los botones de abajo abran la web correcta",
      ],
      steps: [
        {
          title: "Descargue el plugin desde RepGet",
          body: "En RepGet, elija su web en el selector de arriba, abra Ajustes → Integraciones y busque el panel Plugin de WordPress. Pulse Descargar el plugin. Se guarda repget-connector.zip, de unos 35 KB. DÉJELO COMPRIMIDO: no lo descomprima ni lo abra antes. Algunos navegadores (Safari en un Mac, por ejemplo) descomprimen los zip automáticamente, y esa es la causa más frecuente de que la instalación falle.",
        },
        {
          title: "Instálelo en WordPress",
          body: "Pulse Abrir mi WordPress en el mismo panel. Se abre Plugins → Añadir nuevo plugin → Subir plugin en su propia web (también puede ir usted). Elija el archivo repget-connector.zip tal como se descargó, pulse Instalar ahora y después Activar plugin.",
        },
        {
          title: "WordPress abre la pantalla de RepGet",
          body: "Al activar el plugin llega directamente a su pantalla. Más adelante la encontrará como RepGet en el menú de la izquierda del escritorio de WordPress, entre Comentarios y Apariencia, y en el enlace Settings bajo el plugin en la página Plugins. Solo la ven los administradores, porque la clave controla lo que se publica en su web.",
        },
        {
          title: "Conectar - Opción A: empezar en RepGet (recomendado)",
          body: "Vuelva a la pestaña de RepGet (Ajustes → Integraciones → Plugin de WordPress). La tarjeta indica qué espacio de trabajo de RepGet está conectando: compruebe que es el correcto. Pulse Conectar WordPress: se abre la pantalla de RepGet en su WordPress, con el botón Finish connecting to RepGet. Púlselo. Su navegador visita RepGet un instante y vuelve enseguida: RepGet entrega la clave directamente a WordPress y nunca aparece en pantalla, no hay nada que copiar. Si WordPress le pide iniciar sesión, hágalo y pulse Abrir WordPress de nuevo en RepGet. Con el plugin 1.6, en cambio, se rellena el campo Integration Key: pulse Save and connect. Si su navegador bloqueó la pestaña nueva, RepGet muestra la clave con Copiar la clave: péguela en Advanced: use an Integration Key (plugin 1.7) o en el campo Integration Key (1.6) y pulse Save and connect.",
        },
        {
          title: "Conectar - Opción B: empezar en WordPress",
          body: "En lugar de la opción A, con el plugin 1.7 o posterior: en la pantalla de RepGet en WordPress, pulse Connect to RepGet. Inicie sesión en RepGet si se lo pide, con la cuenta que debe publicar en esta web. La página ¿Conectar sudominio a RepGet? muestra sus sitios web con este dominio y el espacio de trabajo de cada uno; pulse Conectar sudominio en el correcto. Vuelve directamente a WordPress. Si el dominio no está en ninguno de sus sitios web, RepGet se lo dice: añada primero el sitio web o pulse Usar otra cuenta.",
        },
        {
          title: "Si la web estaba conectada a otra cuenta",
          body: "Las dos opciones preguntan primero cuando esta web WordPress está conectada a otra cuenta o a otro sitio web de RepGet: el botón dice entonces Mover sudominio a, seguido del espacio de trabajo que eligió. La clave de la cuenta anterior deja de funcionar solo cuando la nueva conexión funciona, y se avisa a esa cuenta. Volver a conectar el mismo sitio web no pregunta nada.",
        },
        {
          title: "Compruebe que dice Connected, y con la cuenta correcta",
          body: "La pantalla dice Connected to, seguido del espacio de trabajo de RepGet y su dominio. En RepGet no hace falta recargar: en pocos segundos la tarjeta se pone verde y el paso de conectar su web queda marcado. Si nombra OTRA cuenta u otro sitio web, pulse Connect to a different RepGet account en WordPress (plugin 1.7), o Conectar WordPress en la cuenta que quiere, y vuelva a terminar: la conexión que guarda WordPress decide qué cuenta publica allí.",
        },
        {
          title: "Cómo llegan los artículos",
          body: "Su primer artículo se publica en cuanto está escrito. Después, RepGet envía los artículos según Ajustes → Ajustes de artículos → Cuando un artículo esté terminado: guardados en RepGet para que los revise, enviados como borrador el día previsto o publicados el día previsto. Pulsar Publicar en un artículo en RepGet lo publica al momento: RepGet pide al plugin que compruebe enseguida (plugin 1.4 o posterior). El plugin también comprueba por su cuenta cada hora, y Check for articles now, en la pantalla de RepGet en WordPress, trae al instante lo que toque.",
        },
        {
          title: "Encuentre sus artículos publicados",
          body: "En RepGet, abra el artículo: uno publicado tiene un botón Ver en su sitio web bajo el título, y su historial muestra el enlace. En WordPress, vaya a Entradas → Todas las entradas: los artículos de RepGet son entradas normales que puede editar, despublicar o borrar. En su web aparecen en su propia dirección (por ejemplo susitio.com/titulo-del-articulo/, según Ajustes → Enlaces permanentes) y en el listado de su blog, que es la página elegida en Ajustes → Lectura → Página de entradas.",
        },
      ],
      troubleshooting: [
        {
          problem: "«No se ha podido instalar el paquete»",
          fix: "El zip se descomprimió y se volvió a comprimir por el camino, algo que algunos navegadores hacen automáticamente al descargar. Descárguelo de nuevo y suba el archivo tal como llega, sin abrirlo antes.",
        },
        {
          problem: "No aparece el botón Subir plugin",
          fix: "Su cuenta no es de administrador, o la web está en un plan de WordPress.com que no permite plugins.",
        },
        {
          problem: "«The key was rejected. Check it was copied in full.»",
          fix: "Un único mensaje cubre todas las causas a propósito, para que quien pruebe claves al azar no aprenda nada de la respuesta. Compruebe tres cosas por orden: ¿se copió la clave COMPLETA? (una copia parcial es, con diferencia, la causa más común); ¿sigue ACTIVA o se revocó en RepGet?; ¿es la clave de ESTE sitio web y no de otra web de su espacio de trabajo? La solución más rápida: pulse Conectar WordPress en RepGet y termine en la pestaña de WordPress que se abre.",
        },
        {
          problem: "Abrir mi WordPress abre otra web",
          fix: "La dirección guardada en RepGet no es la de su WordPress. Corríjala en Ajustes → Negocio y vuelva a pulsar el botón.",
        },
        {
          problem: "No veo RepGet en el menú de WordPress",
          fix: "Necesita una cuenta de administrador. Los editores y autores no lo ven, porque la clave controla lo que se publica.",
        },
        {
          problem: "Conectado, pero no aparece ningún artículo",
          fix: "No se envía nada hasta que a un artículo le toca. Compruebe por orden: ¿está activada la publicación automática en RepGet?; ¿ha llegado la fecha prevista del artículo?; ¿está el artículo realmente escrito? (si sigue planificado o en redacción, aún no). Para enviar uno ahora de todos modos, abra el artículo en RepGet y pulse Publicar, y después pulse Check for articles now en WordPress.",
        },
        {
          problem: "El artículo aparece cortado, o parece una página de portfolio o de proyecto",
          fix: "Su tema muestra las entradas normales de WordPress con un diseño distinto al de su blog (a menudo una página de portfolio o de proyecto con un panel de texto corto), así que un artículo completo no cabe. En la pantalla de RepGet en WordPress, ponga Publish articles as en el tipo de contenido que usan los artículos de su blog (por ejemplo Editorial) y pulse Save (Save and connect antes del plugin 1.7). Los artículos que RepGet ya creó también se mueven allí, y RepGet recibe sus nuevas direcciones. Requiere el plugin 1.5 o posterior.",
        },
        {
          problem: "Los artículos llegan como borradores y no publicados",
          fix: "Ajustes → Ajustes de artículos → Cuando un artículo esté terminado está en Enviarlo a mi sitio como borrador, que hace exactamente eso. Elija Publicarlo el día previsto para los próximos artículos; los borradores ya creados se pueden publicar desde la pantalla Entradas de WordPress.",
        },
        {
          problem: "Al pulsar Publicar en RepGet, dice que el artículo está en cola",
          fix: "Su web no respondió cuando RepGet pidió al plugin que comprobara, así que el artículo espera a la comprobación horaria del plugin. Lo más habitual es que el plugin sea anterior a la 1.4.0: descárguelo de nuevo desde RepGet y súbalo igual (WordPress le ofrece reemplazar la versión actual por la subida; su clave se conserva). Desde el plugin 1.7, WordPress ofrece las versiones nuevas por sí mismo en Plugins, como con cualquier otro plugin. Si no, puede que un plugin de seguridad o un cortafuegos bloquee las peticiones externas a wp-admin/admin-ajax.php; permita las peticiones con action=repget_sync.",
        },
        {
          problem: "Los artículos llegan más de una hora después de lo previsto",
          fix: "El plugin comprueba cada hora por su cuenta, pero el programador de tareas de WordPress solo se ejecuta cuando alguien visita su web, así que en una web con pocas visitas la comprobación llega tarde. Así funciona WordPress, no es un fallo. Pulse Check for articles now para traerlos al momento, o pida a su hosting que configure un cron real si el horario le importa.",
        },
        {
          problem: "WordPress dice Connected, pero RepGet sigue esperando",
          fix: "WordPress está conectado con otra clave: a menudo de otra cuenta de RepGet para la misma web, o de una prueba anterior. En la cuenta de RepGet que quiere usar, pulse Conectar WordPress y termine en la pestaña de WordPress que se abre. La conexión que guarda WordPress decide qué cuenta publica en la web. No necesita buscar ni copiar ninguna clave antigua.",
        },
        {
          problem: "RepGet dice que mi web aún no está en esta cuenta",
          fix: "Ha iniciado sesión en una cuenta de RepGet que no tiene ningún sitio web con esta dirección de WordPress. Pulse Usar otra cuenta e inicie sesión en la que lo tiene, o añada primero el sitio web y vuelva a pulsar Connect to RepGet en WordPress. La dirección del sitio web en RepGet debe ser la de WordPress (con www. o sin él, da igual). Si WordPress funciona a propósito en otra dirección (por ejemplo blog.example.com para example.com), conéctelo con una clave: en RepGet abra Claves (avanzado) y pulse Nueva clave; después, en WordPress, péguela en Advanced: use an Integration Key y pulse Save and connect.",
        },
        {
          problem: "«Esta conexión se abrió en otro lugar»",
          fix: "Una conexión solo se puede completar en el navegador que la abrió primero, así que un enlace copiado a otro navegador o enviado a otra persona no aprueba nada. Vuelva a WordPress y pulse Connect to RepGet de nuevo, en el navegador en el que tiene la sesión de RepGet iniciada.",
        },
        {
          problem: "He perdido mi clave",
          fix: "Nunca vuelve a necesitar una clave antigua: pulse Conectar WordPress en RepGet y termine en WordPress. Las claves sin usar se eliminan automáticamente cuando WordPress se conecta. Para que una web deje de publicar, pulse Disconnect en WordPress (plugin 1.7), o abra Claves (avanzado) en RepGet y pulse Revocar: la web recibe el aviso al instante.",
        },
      ],
    },
    wordpress: {
      name: "WordPress",
      summary:
        "Publique directamente en un WordPress autoalojado con una contraseña de aplicación. Sin plugin; si su hosting bloquea la API REST, vea la guía del plugin.",
      requirements: [
        "Una web WordPress autoalojada (wordpress.org, no un plan gratuito de wordpress.com)",
        "Una cuenta en ella con el rol Editor o Administrador",
        "WordPress 5.6 o posterior, la versión en la que llegaron las contraseñas de aplicación",
      ],
      steps: [
        {
          title: "Abra su perfil de WordPress",
          body: "Inicie sesión en WordPress y vaya a Usuarios → Perfil. Si administra varias cuentas, use aquella con la que quiere publicar los artículos: el autor que aparece en cada entrada es esta cuenta.",
        },
        {
          title: "Cree una contraseña de aplicación",
          body: "Baje hasta el final de esa página, a Contraseñas de aplicación. Escriba un nombre que reconozca después, como RepGet, y pulse Añadir nueva contraseña de aplicación.",
        },
        {
          title: "Copie la contraseña exactamente",
          body: "WordPress la muestra una sola vez, en grupos separados por espacios. Cópiela entera, espacios incluidos: no es su contraseña de acceso, y su contraseña de acceso no funciona aquí.",
        },
        {
          title: "Conéctela aquí",
          body: "En RepGet, abra Ajustes → Integraciones y elija WordPress. Escriba la dirección de su web, su nombre de usuario de WordPress y la contraseña de aplicación que acaba de copiar.",
        },
        {
          title: "Publique un artículo de prueba",
          body: "Pulse Publicar artículo de prueba. Creamos un borrador real en su web y le devolvemos un enlace. Si funciona, los artículos programados también funcionarán, y puede borrar el borrador sin problema.",
        },
      ],
      troubleshooting: [
        {
          problem: "Falta Contraseñas de aplicación en la página del perfil",
          fix: "La sección se oculta cuando WordPress no se sirve por HTTPS, y en algunos hostings gestionados que la desactivan. Compruebe primero que la web carga con https:// y luego pregunte a su hosting si la API REST está activada.",
        },
        {
          problem: "«Lo siento, no tienes permisos para crear entradas»",
          fix: "La cuenta se identifica pero no puede publicar. Dele el rol Editor o Administrador: Autor no basta para todo lo que hacemos.",
        },
        {
          problem: "Un plugin de seguridad bloquea la conexión",
          fix: "Wordfence, iThemes y plugins parecidos pueden bloquear las peticiones a la API REST. Permita /wp-json/wp/v2/ para las peticiones autenticadas, o permita específicamente las nuestras.",
        },
      ],
    },
    ghost: {
      name: "Ghost",
      summary: "Publique en un blog de Ghost, autoalojado o Ghost(Pro), con una clave de la Admin API de una integración personalizada.",
      requirements: ["Una web Ghost que usted administre, autoalojada o en Ghost(Pro)", "Ghost 4.0 o posterior"],
      steps: [
        { title: "Abra los ajustes de integraciones", body: "En el panel de Ghost, vaya a Settings → Advanced → Integrations." },
        {
          title: "Añada una integración personalizada",
          body: "Elija Add custom integration y llámela RepGet. Ghost muestra entonces una Content API key y una Admin API key.",
        },
        {
          title: "Copie la clave ADMIN",
          body: "Tome la Admin API key, no la Content API key. Parece dos valores unidos por dos puntos: copie la cadena entera, dos puntos incluidos. La clave Content solo puede leer, así que falla en la primera publicación.",
        },
        {
          title: "Conéctela aquí",
          body: "En RepGet, abra Ajustes → Integraciones, elija Ghost y escriba la dirección de su web Ghost junto con la Admin API key.",
        },
        { title: "Publique un artículo de prueba", body: "Pulse Publicar artículo de prueba. Creamos un borrador en Ghost y le devolvemos un enlace." },
      ],
      troubleshooting: [
        {
          problem: "«Invalid token» o 401 al conectar",
          fix: "Casi siempre es la Content API key en lugar de la Admin. La clave Admin contiene dos puntos; la Content, no.",
        },
        {
          problem: "Se rechaza la dirección de la web",
          fix: "Use la dirección de su panel de Ghost, sin ninguna ruta al final: https://example.com, no https://example.com/ghost.",
        },
      ],
    },
    shopify: {
      name: "Shopify",
      summary: "Publique artículos en un blog de su tienda Shopify mediante una app personalizada y su token de acceso de la Admin API.",
      requirements: [
        "Una tienda Shopify de la que sea propietario o administrador como miembro del personal",
        "Permiso para crear una app personalizada en esa tienda",
        "Al menos un blog creado en Online Store → Blog posts",
      ],
      steps: [
        {
          title: "Permita el desarrollo de apps personalizadas",
          body: "En el panel de Shopify, vaya a Settings → Apps and sales channels → Develop apps. Si es la primera vez, pulse Allow custom app development y confirme.",
        },
        { title: "Cree la app", body: "Pulse Create an app, llámela RepGet y abra Configuration → Admin API integration." },
        {
          title: "Conceda los permisos del blog",
          body: "Active write_content y read_content. Esos dos cubren crear y actualizar artículos del blog; no hace falta nada más, y conviene no conceder más de lo necesario.",
        },
        {
          title: "Instale la app y copie el token",
          body: "Pulse Install app y muestre el Admin API access token. Shopify lo muestra una sola vez. Empieza por shpat_.",
        },
        {
          title: "Conéctelo aquí",
          body: "En RepGet, abra Ajustes → Integraciones, elija Shopify y escriba la dirección de su tienda (example.myshopify.com) y el token de acceso, y elija en qué blog publicar.",
        },
      ],
      troubleshooting: [
        {
          problem: "No aparece ningún blog en la lista",
          fix: "Las tiendas Shopify empiezan sin ninguno. Cree un blog en Online Store → Blog posts → Manage blogs y vuelva a conectar.",
        },
        {
          problem: "«Access denied» al publicar",
          fix: "Al token le falta write_content. Vuelva a abrir la configuración de la app, añádalo y reinstálela: cambiar los permisos genera un token nuevo.",
        },
      ],
    },
    webflow: {
      name: "Webflow",
      summary: "Publique en una colección del CMS de su web Webflow con un Site API token.",
      requirements: [
        "Una web Webflow con un plan de pago: la API del CMS no está disponible en el plan gratuito",
        "Una colección del CMS para su blog, con un campo de texto enriquecido para el cuerpo",
        "Permiso para crear tokens de API en esa web",
      ],
      steps: [
        {
          title: "Cree un Site API token",
          body: "En Webflow, abra Site settings → Apps & integrations → API access y luego Generate API token. Dele lectura y escritura del CMS: un token de solo lectura conecta bien y después falla en la primera publicación.",
        },
        { title: "Copie el token", body: "Webflow lo muestra una sola vez. Copie el valor completo antes de cerrar el cuadro." },
        {
          title: "Busque el ID de la colección del blog",
          body: "Abra la colección en el Designer. El ID es la última parte de la URL, una cadena larga de letras y números.",
        },
        {
          title: "Conéctelo aquí",
          body: "En RepGet, abra Ajustes → Integraciones, elija Webflow y escriba el token y el ID de la colección. Antes de aceptarla, comprobamos que la colección tiene dónde poner el cuerpo de un artículo.",
        },
        {
          title: "Publique un artículo de prueba",
          body: "Pulse Publicar artículo de prueba. Creamos un elemento real en la colección para que compruebe que llega donde espera.",
        },
      ],
      troubleshooting: [
        {
          problem: "«That collection has no rich text field»",
          fix: "Las colecciones de Webflow son lo que haya construido quien diseñó la web, y un artículo necesita dónde poner su cuerpo. Añada un campo Rich Text a la colección, o indíquenos la colección de su blog en lugar de otra.",
        },
        {
          problem: "El artículo no aparece en la web publicada",
          fix: "Los elementos creados con la API de Webflow solo se publican cuando se publica la web. Pulse Publish en el Designer, o active la publicación automática de la colección.",
        },
        {
          problem: "«That token cannot write to the CMS»",
          fix: "El token se creó sin cms:write. Los tokens no se pueden editar una vez creados: genere uno nuevo con los dos permisos del CMS.",
        },
      ],
    },
    wix: {
      name: "Wix",
      summary: "Publique en el blog de su web Wix con una clave de API con permisos de blog y el ID de su sitio.",
      requirements: ["Una web Wix con la app Blog instalada", "Acceso de propietario o administrador, para poder crear claves de API"],
      steps: [
        { title: "Abra la página de claves de API", body: "En el panel de Wix, vaya a Settings → API keys y luego Generate API key." },
        {
          title: "Dele permisos de blog",
          body: "Asigne un rol que incluya Blog: sin él, la clave se identifica pero no puede crear entradas.",
        },
        {
          title: "Copie la clave y el Site ID",
          body: "La clave se muestra una sola vez. El Site ID aparece junto a la web en la misma pantalla. Hacen falta los dos: una cuenta de Wix puede tener varias webs, así que la clave sola no dice cuál.",
        },
        {
          title: "Conéctela aquí",
          body: "En RepGet, abra Ajustes → Integraciones, elija Wix y escriba los dos valores. Listamos sus entradas existentes para confirmar que la clave llega al blog.",
        },
      ],
      troubleshooting: [
        {
          problem: "«Wix could not find that site, or the site has no blog»",
          fix: "O el Site ID pertenece a otra web, o la app Blog no está instalada. Añada Blog desde el Wix App Market e inténtelo de nuevo.",
        },
        {
          problem: "El cuerpo del artículo aparece como un solo bloque en el editor",
          fix: "Es lo esperado. Wix guarda el contenido enriquecido en su propio formato; enviamos el artículo como un único bloque HTML, que se ve bien en la página publicada pero aparece como un solo elemento incrustado al editar.",
        },
      ],
    },
    webhook: {
      name: "Webhook personalizado",
      summary: "Envíe los artículos terminados a cualquier endpoint que controle, para plataformas que no admitimos directamente.",
      requirements: [
        "Un endpoint HTTPS que acepte un POST con un cuerpo JSON",
        "Un lugar donde guardar el secreto de firma para poder verificar las peticiones",
      ],
      steps: [
        {
          title: "Cree un endpoint",
          body: "Acepte POST con un cuerpo JSON que lleva el título, el cuerpo HTML, el slug, el extracto y el estado. Responda 2xx cuando lo haya guardado; cualquier otra respuesta se trata como un fallo y se reintenta.",
        },
        {
          title: "Conéctelo aquí",
          body: "En RepGet, abra Ajustes → Integraciones, elija Custom (webhook) y escriba la URL del endpoint y un secreto de firma que usted genere.",
        },
        {
          title: "Verifique la firma",
          body: "Cada petición lleva un HMAC-SHA256 del cuerpo sin procesar, con su secreto de firma como clave. Compárelo antes de fiarse del contenido: un endpoint que se salta esto acepta cualquier cosa que alguien le envíe.",
        },
        {
          title: "Publique un artículo de prueba",
          body: "Pulse Publicar artículo de prueba para enviar un contenido real y comprobar que su código lo procesa antes de que llegue ningún artículo programado.",
        },
      ],
      troubleshooting: [
        {
          problem: "Se reintentan las peticiones",
          fix: "Tratamos cualquier respuesta que no sea 2xx como un fallo. Devuelva 200 en cuanto el contenido esté guardado, y haga el trabajo más lento después.",
        },
        {
          problem: "La firma nunca coincide",
          fix: "Calcule el HMAC sobre el cuerpo SIN PROCESAR de la petición, antes de interpretar el JSON. Volver a serializar el objeto cambia los bytes, y la firma nunca coincidirá.",
        },
      ],
    },
  },
};
