// Vercel Routing Middleware — Markdown Negotiation for AI agents + dynamic sitemap
// 1) Serves a markdown version of key public pages (static + dynamic, in en/es/fr)
//    when Accept: text/markdown is requested, OR when the request comes from a known
//    AI/agent crawler User-Agent (most of these do not execute JavaScript, so
//    without this they would see an empty SPA shell). Browsers keep receiving
//    the normal SPA HTML in all cases. See RFC/Cloudflare "Markdown for Agents".
// 2) Serves /sitemap.xml generated on the fly from live property/experience
//    data plus the localized (/es, /fr) variants of every static page.

export const config = {
  matcher: [
    '/', '/es', '/fr',
    '/how-it-works', '/es/how-it-works', '/fr/how-it-works',
    '/faq', '/es/faq', '/fr/faq',
    '/search', '/es/search', '/fr/search',
    '/experiences', '/es/experiences', '/fr/experiences',
    '/property/:id', '/es/property/:id', '/fr/property/:id',
    '/experiences/:id', '/es/experiences/:id', '/fr/experiences/:id',
    '/sitemap.xml',
  ],
};

const SITE = 'https://reservas-app-blue.vercel.app';
const API_BASE = 'https://booking-platform-f8co.onrender.com/api';

// Known AI/agent crawlers that generally do NOT execute JavaScript.
// These get markdown even without an explicit Accept: text/markdown header.
const BOT_UA_PATTERN = /GPTBot|ChatGPT-User|OAI-SearchBot|ClaudeBot|Claude-User|Claude-SearchBot|anthropic-ai|PerplexityBot|Perplexity-User|Google-Extended|CCBot|Diffbot|YouBot|Applebot-Extended/i;

// ---- URL <-> locale helpers (standalone: this file runs on Vercel Edge Runtime,
// which has no localStorage, so it cannot import frontend/js/i18n.js) ----

function getLocaleFromPath(pathname) {
  const seg = pathname.split('/')[1];
  return ['es', 'fr'].includes(seg) ? seg : 'en';
}

function stripLocaleFromPath(pathname) {
  const parts = pathname.split('/');
  if (['es', 'fr'].includes(parts[1])) {
    const rest = '/' + parts.slice(2).join('/');
    return rest.length > 1 ? rest.replace(/\/$/, '') : '/';
  }
  return pathname;
}

// ---- Static markdown content, per locale ----

const LOCALE_MD = {
  en: {
    HOME: `# Elysio Experiences

Where hospitality meets exploration. Connect with authentic accommodations and trusted hosts across Latin America and the Caribbean.

## What this platform does

Elysio Experiences is a booking platform connecting international tourists with local hosts offering vacation rentals and experiences across Latin America and the Caribbean.

## Key links

- Search properties: ${SITE}/search
- Experiences: ${SITE}/experiences
- How it works: ${SITE}/how-it-works
- FAQ: ${SITE}/faq
- API catalog (for agents): ${SITE}/.well-known/api-catalog

## Contact / support

- Email: elysio.support@gmail.com
- WhatsApp: +1 6055003653
`,
    HOW_IT_WORKS: `# How It Works — Elysio Experiences

## For Tourists

1. **Search Properties** — Browse verified accommodations across Latin America and the Caribbean. Filter by location, price, guests, and amenities. No login required to search.
2. **Book & Pay Fee** — Select dates and number of guests, then pay a $7 USD booking fee to secure the reservation. This fee is non-refundable. The remainder is paid directly at the accommodation.
3. **Admin Approval** — The admin team reviews the reservation, typically within 24 hours, and sends an email notification once approved or rejected.
4. **Enjoy Your Stay** — Once approved, check-in details are shared. Pay the remainder directly at the accommodation, then leave a review.

## For Hosts

1. **Register as Host** — Create an account and select "List my property." The team reviews and approves host accounts.
2. **Publish Your Property** — Add photos, description, amenities, pricing, and availability.
3. **Get Approved** — The admin team reviews the listing before it becomes visible to tourists.
4. **Receive Bookings** — Guest contact info is shared after admin approval to coordinate check-in. Payment is collected directly from the guest at the accommodation.

## Payment Process

- A $7 USD booking fee secures the reservation and is non-refundable (except if a rejection is due to platform error).
- The remaining balance is paid directly at the accommodation, either in full on arrival or day by day.

## Cancellation Policy

The $7 USD booking fee is non-refundable if the booking is cancelled or rejected for not meeting requirements, except when the rejection is due to platform error.

## Support

- Email: elysio.support@gmail.com
- WhatsApp: +1 6055003653
`,
    FAQ: `# Frequently Asked Questions — Elysio Experiences

## How does the booking process work?
Search properties without logging in, book by paying a $7 USD fee to secure the reservation, wait for admin approval (within 24 hours), then pay the remainder directly at the accommodation.

## What happens if my booking is rejected?
You'll be notified by email. If the rejection is due to platform error, the $7 USD fee is refunded; otherwise it is non-refundable.

## Can I cancel my booking? Do I get a refund?
You can cancel before admin approval, but the $7 USD fee is non-refundable under any circumstance. After approval, cancellation terms are between the tourist and the host.

## How do I become a host?
Register and select "List my property," get approved by the admin team, then publish your property with photos, description, amenities, pricing, and availability. There is no fee to list a property.

## Is it safe to use Elysio Experiences?
Listings are reviewed by the admin team before going live. Passwords are encrypted with bcrypt, data is transmitted via HTTPS, and each tenant's data is isolated.

## How do I contact support?
- Email: elysio.support@gmail.com
- WhatsApp: +1 6055003653
- Feedback form: ${SITE}/feedback

## What happens with my personal data?
Only name, email, phone (optional), and booking information are collected. Data is shared only with the host after booking approval and with the payment processor. Read the full privacy policy: ${SITE}/privacy
`,
    SEARCH: `# Search Properties — Elysio Experiences

Browse verified vacation rental properties across Latin America and the Caribbean. No login required to search.

## Filters available

Location, price range, number of guests, and amenities.

## Machine-readable data

For a structured, real-time list of properties, use the public read-only API instead of scraping this page:

- \`GET ${SITE}/api/properties\`
- API catalog: ${SITE}/.well-known/api-catalog

## Related pages

- Home: ${SITE}/
- How it works: ${SITE}/how-it-works
- FAQ: ${SITE}/faq
`,
    EXPERIENCES: `# Experiences — Elysio Experiences

Browse local experiences and activities across Latin America and the Caribbean, hosted by verified organizers. Pricing may vary by currency (CUP/USD/USDT) and audience (local/tourist).

## Machine-readable data

For a structured, real-time list of experiences, use the public read-only API instead of scraping this page:

- \`GET ${SITE}/api/experiences\`
- API catalog: ${SITE}/.well-known/api-catalog

## Related pages

- Home: ${SITE}/
- How it works: ${SITE}/how-it-works
- FAQ: ${SITE}/faq
`,
  },

  es: {
    HOME: `# Elysio Experiences

Donde la hospitalidad se encuentra con la exploración. Conectate con alojamientos auténticos y anfitriones de confianza en Latinoamérica y el Caribe.

## Qué hace esta plataforma

Elysio Experiences es una plataforma de reservas que conecta a turistas internacionales con anfitriones locales que ofrecen alquileres vacacionales y experiencias en Latinoamérica y el Caribe.

## Links clave

- Buscar propiedades: ${SITE}/es/search
- Experiencias: ${SITE}/es/experiences
- Cómo funciona: ${SITE}/es/how-it-works
- Preguntas frecuentes: ${SITE}/es/faq
- Catálogo de API (para agentes): ${SITE}/.well-known/api-catalog

## Contacto / soporte

- Email: elysio.support@gmail.com
- WhatsApp: +1 6055003653
`,
    HOW_IT_WORKS: `# Cómo Funciona — Elysio Experiences

## Para Turistas

1. **Buscar Propiedades** — Explorá alojamientos verificados en Latinoamérica y el Caribe. Filtrá por ubicación, precio, huéspedes y comodidades. No hace falta iniciar sesión para buscar.
2. **Reservar y Pagar la Seña** — Elegí fechas y cantidad de huéspedes, luego pagá una seña de $7 USD para asegurar la reserva. Esta seña no es reembolsable. El resto se paga directamente en el alojamiento.
3. **Aprobación del Admin** — El equipo de administración revisa la reserva, normalmente en menos de 24 horas, y envía un email cuando se aprueba o rechaza.
4. **Disfrutá tu Estadía** — Una vez aprobada, se comparten los detalles del check-in. Pagá el resto directamente en el alojamiento y después dejá una reseña.

## Para Anfitriones

1. **Registrate como Anfitrión** — Creá una cuenta y elegí "Publicar mi propiedad". El equipo revisa y aprueba las cuentas de anfitrión.
2. **Publicá tu Propiedad** — Agregá fotos, descripción, comodidades, precios y disponibilidad.
3. **Conseguí la Aprobación** — El equipo de administración revisa la publicación antes de que sea visible para los turistas.
4. **Recibí Reservas** — Los datos de contacto del huésped se comparten después de la aprobación del admin para coordinar el check-in. El pago se cobra directamente al huésped en el alojamiento.

## Proceso de Pago

- Una seña de $7 USD asegura la reserva y no es reembolsable (excepto si el rechazo se debe a un error de la plataforma).
- El saldo restante se paga directamente en el alojamiento, ya sea completo al llegar o día por día.

## Política de Cancelación

La seña de $7 USD no es reembolsable si la reserva se cancela o se rechaza por no cumplir los requisitos, excepto cuando el rechazo se debe a un error de la plataforma.

## Soporte

- Email: elysio.support@gmail.com
- WhatsApp: +1 6055003653
`,
    FAQ: `# Preguntas Frecuentes — Elysio Experiences

## ¿Cómo funciona el proceso de reserva?
Buscá propiedades sin necesidad de iniciar sesión, reservá pagando una seña de $7 USD para asegurar la reserva, esperá la aprobación del admin (dentro de 24 horas), y después pagá el resto directamente en el alojamiento.

## ¿Qué pasa si rechazan mi reserva?
Te vamos a notificar por email. Si el rechazo se debe a un error de la plataforma, se reembolsa la seña de $7 USD; en caso contrario, no es reembolsable.

## ¿Puedo cancelar mi reserva? ¿Me devuelven el dinero?
Podés cancelar antes de la aprobación del admin, pero la seña de $7 USD no es reembolsable bajo ninguna circunstancia. Después de la aprobación, los términos de cancelación quedan entre el turista y el anfitrión.

## ¿Cómo me convierto en anfitrión?
Registrate y elegí "Publicar mi propiedad", conseguí la aprobación del equipo de administración, y después publicá tu propiedad con fotos, descripción, comodidades, precios y disponibilidad. No hay costo por publicar una propiedad.

## ¿Es seguro usar Elysio Experiences?
Las publicaciones son revisadas por el equipo de administración antes de estar visibles. Las contraseñas se encriptan con bcrypt, los datos se transmiten por HTTPS, y los datos de cada tenant están aislados.

## ¿Cómo contacto a soporte?
- Email: elysio.support@gmail.com
- WhatsApp: +1 6055003653
- Formulario de feedback: ${SITE}/feedback

## ¿Qué pasa con mis datos personales?
Solo se recopilan nombre, email, teléfono (opcional) e información de la reserva. Los datos se comparten solo con el anfitrión después de aprobada la reserva y con el procesador de pagos. Leé la política de privacidad completa: ${SITE}/es/privacy
`,
    SEARCH: `# Buscar Propiedades — Elysio Experiences

Explorá propiedades de alquiler vacacional verificadas en Latinoamérica y el Caribe. No hace falta iniciar sesión para buscar.

## Filtros disponibles

Ubicación, rango de precio, cantidad de huéspedes y comodidades.

## Datos legibles por máquina

Para una lista estructurada y en tiempo real de propiedades, usá la API pública de solo lectura en vez de scrapear esta página:

- \`GET ${SITE}/api/properties\`
- Catálogo de API: ${SITE}/.well-known/api-catalog

## Páginas relacionadas

- Inicio: ${SITE}/es
- Cómo funciona: ${SITE}/es/how-it-works
- Preguntas frecuentes: ${SITE}/es/faq
`,
    EXPERIENCES: `# Experiencias — Elysio Experiences

Explorá experiencias y actividades locales en Latinoamérica y el Caribe, organizadas por organizadores verificados. Los precios pueden variar según la moneda (CUP/USD/USDT) y el público (local/turista).

## Datos legibles por máquina

Para una lista estructurada y en tiempo real de experiencias, usá la API pública de solo lectura en vez de scrapear esta página:

- \`GET ${SITE}/api/experiences\`
- Catálogo de API: ${SITE}/.well-known/api-catalog

## Páginas relacionadas

- Inicio: ${SITE}/es
- Cómo funciona: ${SITE}/es/how-it-works
- Preguntas frecuentes: ${SITE}/es/faq
`,
  },

  fr: {
    HOME: `# Elysio Experiences

Là où l'hospitalité rencontre l'exploration. Connectez-vous à des hébergements authentiques et des hôtes de confiance en Amérique Latine et dans les Caraïbes.

## Ce que fait cette plateforme

Elysio Experiences est une plateforme de réservation qui connecte les touristes internationaux avec des hôtes locaux proposant des locations de vacances et des expériences en Amérique Latine et dans les Caraïbes.

## Liens clés

- Rechercher des propriétés : ${SITE}/fr/search
- Expériences : ${SITE}/fr/experiences
- Comment ça marche : ${SITE}/fr/how-it-works
- FAQ : ${SITE}/fr/faq
- Catalogue API (pour agents) : ${SITE}/.well-known/api-catalog

## Contact / support

- Email : elysio.support@gmail.com
- WhatsApp : +1 6055003653
`,
    HOW_IT_WORKS: `# Comment ça Marche — Elysio Experiences

## Pour les Touristes

1. **Rechercher des Propriétés** — Parcourez des hébergements vérifiés en Amérique Latine et dans les Caraïbes. Filtrez par lieu, prix, nombre d'invités et équipements. Aucune connexion requise pour rechercher.
2. **Réserver et Payer les Frais** — Sélectionnez les dates et le nombre d'invités, puis payez des frais de réservation de 7 USD pour sécuriser la réservation. Ces frais ne sont pas remboursables. Le reste est payé directement à l'hébergement.
3. **Approbation de l'Administrateur** — L'équipe d'administration examine la réservation, généralement sous 24 heures, et envoie une notification par email une fois approuvée ou rejetée.
4. **Profitez de votre Séjour** — Une fois approuvés, les détails d'arrivée sont partagés. Payez le solde directement à l'hébergement, puis laissez un avis.

## Pour les Hôtes

1. **S'inscrire comme Hôte** — Créez un compte et sélectionnez "Publier mon bien". L'équipe examine et approuve les comptes hôtes.
2. **Publier votre Bien** — Ajoutez des photos, une description, des équipements, des tarifs et des disponibilités.
3. **Obtenir l'Approbation** — L'équipe d'administration examine l'annonce avant qu'elle ne devienne visible pour les touristes.
4. **Recevoir des Réservations** — Les coordonnées de l'invité sont partagées après approbation de l'administrateur pour coordonner l'arrivée. Le paiement est collecté directement auprès de l'invité à l'hébergement.

## Processus de Paiement

- Des frais de réservation de 7 USD sécurisent la réservation et ne sont pas remboursables (sauf si le rejet est dû à une erreur de la plateforme).
- Le solde restant est payé directement à l'hébergement, en totalité à l'arrivée ou au jour le jour.

## Politique d'Annulation

Les frais de réservation de 7 USD ne sont pas remboursables si la réservation est annulée ou rejetée pour non-conformité, sauf si le rejet est dû à une erreur de la plateforme.

## Support

- Email : elysio.support@gmail.com
- WhatsApp : +1 6055003653
`,
    FAQ: `# Questions Fréquentes — Elysio Experiences

## Comment fonctionne le processus de réservation ?
Recherchez des propriétés sans vous connecter, réservez en payant des frais de 7 USD pour sécuriser la réservation, attendez l'approbation de l'administrateur (sous 24 heures), puis payez le solde directement à l'hébergement.

## Que se passe-t-il si ma réservation est rejetée ?
Vous serez notifié par email. Si le rejet est dû à une erreur de la plateforme, les frais de 7 USD sont remboursés ; sinon, ils ne sont pas remboursables.

## Puis-je annuler ma réservation ? Suis-je remboursé ?
Vous pouvez annuler avant l'approbation de l'administrateur, mais les frais de 7 USD ne sont remboursables en aucune circonstance. Après approbation, les conditions d'annulation sont convenues entre le touriste et l'hôte.

## Comment devenir hôte ?
Inscrivez-vous et sélectionnez "Publier mon bien", obtenez l'approbation de l'équipe d'administration, puis publiez votre bien avec photos, description, équipements, tarifs et disponibilités. La publication d'un bien est gratuite.

## Est-il sûr d'utiliser Elysio Experiences ?
Les annonces sont examinées par l'équipe d'administration avant leur mise en ligne. Les mots de passe sont chiffrés avec bcrypt, les données sont transmises via HTTPS, et les données de chaque tenant sont isolées.

## Comment contacter le support ?
- Email : elysio.support@gmail.com
- WhatsApp : +1 6055003653
- Formulaire de feedback : ${SITE}/feedback

## Que deviennent mes données personnelles ?
Seuls le nom, l'email, le téléphone (facultatif) et les informations de réservation sont collectés. Les données ne sont partagées avec l'hôte qu'après approbation de la réservation, et avec le prestataire de paiement. Lisez la politique de confidentialité complète : ${SITE}/fr/privacy
`,
    SEARCH: `# Rechercher des Propriétés — Elysio Experiences

Parcourez des locations de vacances vérifiées en Amérique Latine et dans les Caraïbes. Aucune connexion requise pour rechercher.

## Filtres disponibles

Lieu, gamme de prix, nombre d'invités et équipements.

## Données lisibles par machine

Pour une liste structurée et en temps réel des propriétés, utilisez l'API publique en lecture seule plutôt que d'extraire cette page :

- \`GET ${SITE}/api/properties\`
- Catalogue API : ${SITE}/.well-known/api-catalog

## Pages associées

- Accueil : ${SITE}/fr
- Comment ça marche : ${SITE}/fr/how-it-works
- FAQ : ${SITE}/fr/faq
`,
    EXPERIENCES: `# Expériences — Elysio Experiences

Parcourez des expériences et activités locales en Amérique Latine et dans les Caraïbes, proposées par des organisateurs vérifiés. Les tarifs peuvent varier selon la devise (CUP/USD/USDT) et le public (local/touriste).

## Données lisibles par machine

Pour une liste structurée et en temps réel des expériences, utilisez l'API publique en lecture seule plutôt que d'extraire cette page :

- \`GET ${SITE}/api/experiences\`
- Catalogue API : ${SITE}/.well-known/api-catalog

## Pages associées

- Accueil : ${SITE}/fr
- Comment ça marche : ${SITE}/fr/how-it-works
- FAQ : ${SITE}/fr/faq
`,
  },
};

// ---- Labels for the dynamic property/experience markdown templates ----

const LABELS = {
  en: {
    location: 'Location', type: 'Type', price: 'Price', night: 'night', capacity: 'Capacity',
    guests: 'guests', bedroom: 'bedroom(s)', bathroom: 'bathroom(s)', rating: 'Rating',
    noReviews: 'No reviews yet', reviewsWord: 'reviews', description: 'Description', amenities: 'Amenities',
    notSpecified: 'Not specified', booking: 'Booking', relatedPages: 'Related pages',
    searchMore: 'Search more properties', howItWorks: 'How it works', faq: 'FAQ',
    date: 'Date', availability: 'Availability', seeListingDates: 'See listing for dates',
    seeListingAvail: 'See listing for availability', pricing: 'Pricing',
    contactPricing: 'Contact organizer for pricing', moreExperiences: 'More experiences',
    spotsOf: 'of', spotsAvailable: 'spots available',
    propertyBooking: 'A $7 USD non-refundable booking fee secures the reservation, followed by 24h admin approval. Full details:',
    expBooking: 'No platform fee on experiences. Full details:',
  },
  es: {
    location: 'Ubicación', type: 'Tipo', price: 'Precio', night: 'noche', capacity: 'Capacidad',
    guests: 'huéspedes', bedroom: 'habitación(es)', bathroom: 'baño(s)', rating: 'Calificación',
    noReviews: 'Sin reseñas todavía', reviewsWord: 'reseñas', description: 'Descripción', amenities: 'Comodidades',
    notSpecified: 'No especificado', booking: 'Reserva', relatedPages: 'Páginas relacionadas',
    searchMore: 'Buscar más propiedades', howItWorks: 'Cómo funciona', faq: 'Preguntas frecuentes',
    date: 'Fecha', availability: 'Disponibilidad', seeListingDates: 'Ver fechas en la publicación',
    seeListingAvail: 'Ver disponibilidad en la publicación', pricing: 'Precios',
    contactPricing: 'Contactar al organizador para precios', moreExperiences: 'Más experiencias',
    spotsOf: 'de', spotsAvailable: 'cupos disponibles',
    propertyBooking: 'Una seña de $7 USD no reembolsable asegura la reserva, seguida de aprobación del admin en 24h. Detalles completos:',
    expBooking: 'Sin costo de plataforma en experiencias. Detalles completos:',
  },
  fr: {
    location: 'Lieu', type: 'Type', price: 'Prix', night: 'nuit', capacity: 'Capacité',
    guests: 'invités', bedroom: 'chambre(s)', bathroom: 'salle(s) de bain', rating: 'Note',
    noReviews: "Pas encore d'avis", reviewsWord: 'avis', description: 'Description', amenities: 'Équipements',
    notSpecified: 'Non spécifié', booking: 'Réservation', relatedPages: 'Pages associées',
    searchMore: 'Rechercher plus de propriétés', howItWorks: 'Comment ça marche', faq: 'FAQ',
    date: 'Date', availability: 'Disponibilité', seeListingDates: "Voir les dates sur l'annonce",
    seeListingAvail: "Voir la disponibilité sur l'annonce", pricing: 'Tarifs',
    contactPricing: "Contactez l'organisateur pour les tarifs", moreExperiences: "Plus d'expériences",
    spotsOf: 'sur', spotsAvailable: 'places disponibles',
    propertyBooking: "Des frais de réservation de 7 USD non remboursables sécurisent la réservation, suivis d'une approbation de l'administrateur sous 24h. Détails complets :",
    expBooking: 'Aucun frais de plateforme sur les expériences. Détails complets :',
  },
};

function formatPrice(amount, currency) {
  return `${amount} ${currency}`;
}

function localePrefix(locale) {
  return locale === 'en' ? '' : `/${locale}`;
}

async function buildPropertyMd(id, locale) {
  const L = LABELS[locale] || LABELS.en;
  const prefix = localePrefix(locale);
  let res;
  try {
    res = await fetch(`${API_BASE}/properties/${id}`);
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const json = await res.json();
  const p = json && json.data && json.data.property;
  if (!p) return null;

  const loc = [p.location && p.location.neighborhood, p.location && p.location.city].filter(Boolean).join(', ');
  const amenities = (p.amenities || []).map((a) => `- ${a}`).join('\n') || `- ${L.notSpecified}`;
  const rating = p.rating ? `${p.rating} / 5 (${p.reviews_count || 0} ${L.reviewsWord})` : L.noReviews;

  return `# ${p.name} — Elysio Experiences

**${L.location}:** ${loc}
**${L.type}:** ${p.type}
**${L.price}:** ${formatPrice(p.price_per_night, p.currency)} / ${L.night}
**${L.capacity}:** ${p.max_guests} ${L.guests}, ${p.bedrooms} ${L.bedroom}, ${p.bathrooms} ${L.bathroom}
**${L.rating}:** ${rating}

## ${L.description}

${p.description}

## ${L.amenities}

${amenities}

## ${L.booking}

${L.propertyBooking} ${SITE}${prefix}/property/${id}

## ${L.relatedPages}

- ${L.searchMore}: ${SITE}${prefix}/search
- ${L.howItWorks}: ${SITE}${prefix}/how-it-works
- ${L.faq}: ${SITE}${prefix}/faq
`;
}

async function buildExperienceMd(id, locale) {
  const L = LABELS[locale] || LABELS.en;
  const prefix = localePrefix(locale);
  let res;
  try {
    res = await fetch(`${API_BASE}/experiences/${id}`);
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const json = await res.json();
  const exp = json && json.data && json.data.experience;
  if (!exp) return null;

  const pricing = (exp.pricing || [])
    .map((pr) => `- ${pr.audience}: ${formatPrice(pr.amount, pr.currency)}`)
    .join('\n') || `- ${L.contactPricing}`;
  const date = exp.date ? new Date(exp.date).toISOString().slice(0, 10) : L.seeListingDates;
  const spots = typeof exp.max_participants === 'number'
    ? `${Math.max((exp.max_participants || 0) - (exp.current_participants || 0), 0)} ${L.spotsOf} ${exp.max_participants} ${L.spotsAvailable}`
    : L.seeListingAvail;

  return `# ${exp.title} — Elysio Experiences

**${L.location}:** ${(exp.location && exp.location.city) || L.notSpecified}
**${L.date}:** ${date}
**${L.availability}:** ${spots}

## ${L.description}

${exp.description}

## ${L.pricing}

${pricing}

## ${L.booking}

${L.expBooking} ${SITE}${prefix}/experiences/${id}

## ${L.relatedPages}

- ${L.moreExperiences}: ${SITE}${prefix}/experiences
- ${L.howItWorks}: ${SITE}${prefix}/how-it-works
- ${L.faq}: ${SITE}${prefix}/faq
`;
}

async function getMarkdown(pathname) {
  const locale = getLocaleFromPath(pathname);
  const stripped = stripLocaleFromPath(pathname);

  const propertyMatch = stripped.match(/^\/property\/([^/]+)$/);
  if (propertyMatch) {
    return buildPropertyMd(propertyMatch[1], locale);
  }
  const experienceMatch = stripped.match(/^\/experiences\/([^/]+)$/);
  if (experienceMatch) {
    return buildExperienceMd(experienceMatch[1], locale);
  }

  const docs = LOCALE_MD[locale] || LOCALE_MD.en;
  switch (stripped) {
    case '/':
      return docs.HOME;
    case '/how-it-works':
      return docs.HOW_IT_WORKS;
    case '/faq':
      return docs.FAQ;
    case '/search':
      return docs.SEARCH;
    case '/experiences':
      return docs.EXPERIENCES;
    default:
      return null;
  }
}

// ---- Dynamic sitemap.xml ----

const STATIC_SITEMAP_ENTRIES = [
  { loc: '/', changefreq: 'weekly', priority: '1.0' },
  { loc: '/search', changefreq: 'daily', priority: '0.9' },
  { loc: '/experiences', changefreq: 'daily', priority: '0.9' },
  { loc: '/how-it-works', changefreq: 'monthly', priority: '0.7' },
  { loc: '/faq', changefreq: 'monthly', priority: '0.6' },
  { loc: '/register', changefreq: 'monthly', priority: '0.6' },
  { loc: '/terms', changefreq: 'yearly', priority: '0.3' },
  { loc: '/privacy', changefreq: 'yearly', priority: '0.3' },
];

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function fetchAllItems(endpoint) {
  const items = [];
  let page = 1;
  for (;;) {
    let res;
    try {
      res = await fetch(`${API_BASE}/${endpoint}?per_page=200&page=${page}`);
    } catch {
      break;
    }
    if (!res.ok) break;
    const json = await res.json();
    const list = (json && json.data && json.data[endpoint]) || [];
    items.push(...list);
    const total = (json && json.data && json.data.total_count) || items.length;
    if (items.length >= total || list.length === 0 || page > 10) break;
    page += 1;
  }
  return items;
}

async function buildSitemapXml() {
  let properties = [];
  let experiences = [];
  try {
    [properties, experiences] = await Promise.all([
      fetchAllItems('properties'),
      fetchAllItems('experiences'),
    ]);
  } catch {
    // fall back to static entries only if the API is unreachable
  }

  const LOCALES = ['en', 'es', 'fr'];
  const urls = [];

  const localized = (entryLoc, locale) =>
    locale === 'en' ? entryLoc : `/${locale}${entryLoc === '/' ? '' : entryLoc}`;

  function pushLocaleVariants(entry) {
    const alternates = LOCALES.map((locale) => ({ hreflang: locale, loc: localized(entry.loc, locale) }));
    alternates.push({ hreflang: 'x-default', loc: entry.loc });
    for (const locale of LOCALES) {
      urls.push({ ...entry, loc: localized(entry.loc, locale), alternates });
    }
  }

  for (const entry of STATIC_SITEMAP_ENTRIES) {
    pushLocaleVariants(entry);
  }

  for (const p of properties) {
    if (p.status && p.status !== 'active') continue;
    pushLocaleVariants({
      loc: `/property/${p._id}`,
      changefreq: 'weekly',
      priority: '0.8',
      lastmod: p.updated_at ? String(p.updated_at).slice(0, 10) : undefined,
    });
  }

  for (const e of experiences) {
    if (e.status && e.status !== 'active' && e.status !== 'approved') continue;
    pushLocaleVariants({
      loc: `/experiences/${e._id}`,
      changefreq: 'weekly',
      priority: '0.8',
      lastmod: e.updated_at ? String(e.updated_at).slice(0, 10) : undefined,
    });
  }

  const xmlUrls = urls
    .map((u) => {
      const lastmod = u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : '';
      const alts = (u.alternates || [])
        .map((a) => `\n    <xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${SITE}${escapeXml(a.loc)}"/>`)
        .join('');
      return `  <url>\n    <loc>${SITE}${escapeXml(u.loc)}</loc>${alts}${lastmod}\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${xmlUrls}\n</urlset>\n`;
}

// ---- Social preview (Open Graph) HTML for link-preview crawlers ----
// Facebook/WhatsApp/X/LinkedIn/etc. do not execute JavaScript, so without this they
// would always show the generic home-page card for every property/experience link.

const SOCIAL_UA_PATTERN = /facebookexternalhit|Facebot|Twitterbot|WhatsApp|LinkedInBot|Slackbot|TelegramBot|Discordbot|Pinterest|SkypeUriPreview/i;

const OG_LOCALES = { en: 'en_US', es: 'es_ES', fr: 'fr_FR' };

function pickImageUrl(images) {
  const list = Array.isArray(images) ? images.filter((img) => img && img.url) : [];
  if (list.length === 0) return `${SITE}/assets/og-image.png`;
  const primary = list.find((img) => img.is_primary);
  if (primary) return primary.url;
  return [...list].sort((a, b) => (a.order || 0) - (b.order || 0))[0].url;
}

function shorten(text, max) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

async function buildSocialHtml(pathname) {
  const locale = getLocaleFromPath(pathname);
  const stripped = stripLocaleFromPath(pathname);
  const propertyMatch = stripped.match(/^\/property\/([^/]+)$/);
  const experienceMatch = stripped.match(/^\/experiences\/([^/]+)$/);
  if (!propertyMatch && !experienceMatch) return null;

  const endpoint = propertyMatch ? `properties/${propertyMatch[1]}` : `experiences/${experienceMatch[1]}`;
  let res;
  try {
    res = await fetch(`${API_BASE}/${endpoint}`);
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const json = await res.json();
  const item = json && json.data && (propertyMatch ? json.data.property : json.data.experience);
  if (!item) return null;

  const name = propertyMatch ? item.name : item.title;
  if (!name) return null;
  const title = `${name} | Elysio Experiences`;
  const description = shorten(item.description, 200) || 'Book authentic stays and local experiences with trusted hosts across Latin America and the Caribbean.';
  const image = pickImageUrl(item.images);
  const url = `${SITE}${localePrefix(locale)}${stripped}`;

  const t = escapeXml(title);
  const d = escapeXml(description);
  const img = escapeXml(image);
  const u = escapeXml(url);

  return `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="UTF-8">
  <title>${t}</title>
  <meta name="description" content="${d}">
  <link rel="canonical" href="${u}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Elysio Experiences">
  <meta property="og:locale" content="${OG_LOCALES[locale] || 'en_US'}">
  <meta property="og:title" content="${t}">
  <meta property="og:description" content="${d}">
  <meta property="og:url" content="${u}">
  <meta property="og:image" content="${img}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${t}">
  <meta name="twitter:description" content="${d}">
  <meta name="twitter:image" content="${img}">
</head>
<body>
  <h1>${escapeXml(name)}</h1>
  <p>${d}</p>
  <p><a href="${u}">${u}</a></p>
</body>
</html>
`;
}

export default async function middleware(request) {
  const url = new URL(request.url);

  if (url.pathname === '/sitemap.xml') {
    const xml = await buildSitemapXml();
    return new Response(xml, {
      status: 200,
      headers: {
        'content-type': 'application/xml; charset=utf-8',
        'cache-control': 'public, max-age=3600',
      },
    });
  }

  const accept = request.headers.get('accept') || '';
  const userAgent = request.headers.get('user-agent') || '';
  const wantsMarkdown = accept.includes('text/markdown');
  const isKnownAgent = BOT_UA_PATTERN.test(userAgent);
  if (!wantsMarkdown && SOCIAL_UA_PATTERN.test(userAgent)) {
    const html = await buildSocialHtml(url.pathname);
    if (html) {
      return new Response(html, {
        status: 200,
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'public, max-age=3600',
        },
      });
    }
    return;
  }

  if (!wantsMarkdown && !isKnownAgent) {
    return; // let normal SPA/static handling continue
  }

  const md = await getMarkdown(url.pathname);
  if (!md) {
    return;
  }

  return new Response(md, {
    status: 200,
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
}
