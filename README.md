This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Customer accounts and checkout

Copy `.env.example` to `.env.local` and add your Supabase project URL, publishable key, and Paystack public key. To verify card payments and mark orders paid, also add the server-only Paystack secret key and Supabase service-role key. Never put a Supabase secret, Paystack secret, or `service_role` key in a `NEXT_PUBLIC_` variable.

Email/password signup and login require the Supabase Email provider to be enabled. Add your local and production site URLs to Supabase Auth's allowed redirect URLs. Guests can order through WhatsApp; card checkout asks customers to sign in or create an account first.

### Admin dashboard

Run `supabase/migrations/202611210001_admin_dashboard.sql` in the Supabase SQL Editor. It creates the product catalog, stock counts, customer profiles, order records, and row-level security policies. The shop reads active products from this catalog; the migration seeds the current sample listings.

To grant admin access, open the designated account in Supabase Authentication → Users and set its **app metadata** to include `"role": "admin"` (preserve any existing app-metadata fields). Do not use user metadata or a role selected on the login form: users can edit their own user metadata. Sign out and back in after changing the role. Only accounts with the server-controlled app-metadata role can open `/admin`; database policies also enforce that role.

The admin dashboard at `/admin` manages products, prices, photos, inventory, order statuses, customer accounts, and recorded sales. Paystack order status updates require the server-only keys in `.env.local`. In the Paystack dashboard, configure the webhook URL as `https://your-site.example/api/paystack/webhook`; the signed webhook and server-side transaction verification update paid orders and stock. Add the same variables to the production hosting environment and restart/redeploy after changing them.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
