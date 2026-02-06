# Migration Guide: CreditClaw to Next.js v16

This project is currently built with Vite + React + TailwindCSS v4. Here is a guide to help you migrate it to Next.js v16.

## 1. Dependencies

Ensure you install the equivalent dependencies in your Next.js project:

```bash
npm install framer-motion lucide-react clsx tailwind-merge date-fns react-hook-form zod @hookform/resolvers @tanstack/react-query
# Install Radix UI primitives used in components/ui (check package.json for full list)
npm install @radix-ui/react-slot @radix-ui/react-dialog @radix-ui/react-tooltip @radix-ui/react-toast @radix-ui/react-label
```

## 2. Font Setup

This project uses **Plus Jakarta Sans** and **JetBrains Mono**. In Next.js, use `next/font/google`:

```tsx
// app/layout.tsx
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google'

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-sans' })
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' })

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${jakarta.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  )
}
```

## 3. Component Migration

- **Routing:** Replace `wouter`'s `<Link href="...">` with `next/link`.
- **Images:** Replace standard `<img>` tags with `<Image />` from `next/image` for optimization.
- **Client Components:** This is a highly interactive landing page. Most components (Hero, Features, etc.) using `framer-motion` or `useState` will need `'use client'` at the top of the file.

## 4. Tailwind CSS

This project uses Tailwind CSS v4 with the new CSS-first configuration approach (variables defined in `@theme` block in `index.css`).
- If your Next.js setup uses Tailwind v3, you MUST move the theme variables from `index.css` into `tailwind.config.js`.
- If using Tailwind v4 with Next.js, ensure you follow the official Next.js + Tailwind v4 guide. The current `index.css` should work largely as-is with v4.

## 5. Directory Structure

- Move `client/src/components` -> `components`
- Move `client/src/lib` -> `lib`
- Move `client/src/hooks` -> `hooks`
- `client/src/pages/home.tsx` content should go to `app/page.tsx`

## 6. Animations

The project relies heavily on `framer-motion`. Ensure `AnimatePresence` and `motion` components are used within Client Components.
