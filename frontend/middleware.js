// Vercel Routing Middleware â€” Markdown Negotiation for AI agents
// Returns a markdown version of key public pages when Accept: text/markdown is requested,
// while browsers keep receiving the normal SPA HTML. See RFC/Cloudflare "Markdown for Agents".

export const config = {
  matcher: ['/', '/how-it-works', '/faq', '/search', '/experiences'],
};

const SITE = 'https://reservas-app-blue.vercel.app';

const HOME_MD = `# Elysio Experiences

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
`;

const HOW_IT_WORKS_MD = `# How It Works â€” Elysio Experiences

## For Tourists

1. **Search Properties** â€” Browse verified accommodations across Latin America and the Caribbean. Filter by location, price, guests, and amenities. No login required to search.
2. **Book & Pay Fee** â€” Select dates and number of guests, then pay a $7 USD booking fee to secure the reservation. This fee is non-refundable. The remainder is paid directly at the accommodation.
3. **Admin Approval** â€” The admin team reviews the reservation, typically within 24 hours, and sends an email notification once approved or rejected.
4. **Enjoy Your Stay** â€” Once approved, check-in details are shared. Pay the remainder directly at the accommodation, then leave a review.

## For Hosts

1. **Register as Host** â€” Create an account and select "List my property." The team reviews and approves host accounts.
2. **Publish Your Property** â€” Add photos, description, amenities, pricing, and availability.
3. **Get Approved** â€” The admin team reviews the listing before it becomes visible to tourists.
4. **Receive Bookings** â€” Guest contact info is shared after admin approval to coordinate check-in. Payment is collected directly from the guest at the accommodation.

## Payment Process

- A $7 USD booking fee secures the reservation and is non-refundable (except if a rejection is due to platform error).
- The remaining balance is paid directly at the accommodation, either in full on arrival or day by day.

## Cancellation Policy

The $7 USD booking fee is non-refundable if the booking is cancelled or rejected for not meeting requirements, except when the rejection is due to platform error.

## Support

- Email: elysio.support@gmail.com
- WhatsApp: +1 6055003653
`;

const FAQ_MD = `# Frequently Asked Questions â€” Elysio Experiences

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
`;

const SEARCH_MD = `# Search Properties — Elysio Experiences

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
`;

const EXPERIENCES_MD = `# Experiences — Elysio Experiences

Browse local experiences and activities across Latin America and the Caribbean, hosted by verified organizers. Pricing may vary by currency (CUP/USD/USDT) and audience (local/tourist).

## Machine-readable data

For a structured, real-time list of experiences, use the public read-only API instead of scraping this page:

- \`GET ${SITE}/api/experiences\`
- API catalog: ${SITE}/.well-known/api-catalog

## Related pages

- Home: ${SITE}/
- How it works: ${SITE}/how-it-works
- FAQ: ${SITE}/faq
`;

function getMarkdown(pathname) {
  switch (pathname) {
    case '/':
      return HOME_MD;
    case '/how-it-works':
      return HOW_IT_WORKS_MD;
    case '/faq':
      return FAQ_MD;
    case '/search':
      return SEARCH_MD;
    case '/experiences':
      return EXPERIENCES_MD;
    default:
      return null;
  }
}

export default function middleware(request) {
  const accept = request.headers.get('accept') || '';
  if (!accept.includes('text/markdown')) {
    return; // let normal SPA/static handling continue
  }

  const url = new URL(request.url);
  const md = getMarkdown(url.pathname);
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
