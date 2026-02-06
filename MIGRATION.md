# Migration Guide: CreditClaw to Next.js v16

This project is built with Vite + React + TailwindCSS v4. Use this guide to migrate to Next.js v16.

## 1. Dependencies

Install these dependencies in your new Next.js project:

```bash
npm install lucide-react clsx tailwind-merge date-fns react-hook-form zod @hookform/resolvers @tanstack/react-query
# Install Radix UI primitives (check package.json for full list if needed)
npm install @radix-ui/react-slot @radix-ui/react-dialog @radix-ui/react-tooltip @radix-ui/react-toast @radix-ui/react-label @radix-ui/react-avatar @radix-ui/react-dropdown-menu
```

## 2. Key Adaptations (Detailed)

### A. Routing: Replace `wouter` with `next/link`
Search for all instances of `Link` from `wouter` and replace them.

**Before (Vite/wouter):**
```tsx
import { Link } from "wouter";
<Link href="/app">Go to App</Link>
```

**After (Next.js):**
```tsx
import Link from "next/link";
<Link href="/app">Go to App</Link>
```
*Note: `useLocation` hooks need to be replaced with `usePathname` from `next/navigation`.*

### B. Image Handling
Next.js optimizes images. You can keep importing local images, but use the `<Image />` component.

**Before:**
```tsx
import logo from "@/assets/images/logo.png";
<img src={logo} alt="Logo" />
```

**After:**
```tsx
import Image from "next/image";
import logo from "@/assets/images/logo.png";
<Image src={logo} alt="Logo" width={40} height={40} />
```

### C. "use client" Directives
In Next.js (App Router), components are Server Components by default. You must add `"use client";` to the top of any component that uses:
- `useState`, `useEffect`, `useRef`
- Event listeners (`onClick`, `onChange`)
- Browser APIs (`window`, `localStorage`)

**Files requiring "use client":**
- `components/dashboard/sidebar.tsx` (uses useLocation)
- `components/waitlist-form.tsx` (uses useState/Forms)
- `components/nav.tsx` (if mobile menu state is added)
- `pages/dashboard/overview.tsx` (interactive elements)
- `components/ui/*` (Radix primitives usually require client context)

### D. CSS & Theming
This project uses **Tailwind CSS v4** with variables defined in `index.css`.

1. **Copy `client/src/index.css` content** into your Next.js `app/globals.css`.
2. Ensure you keep the `@import "tailwindcss";` and `@theme` blocks.
3. If your Next.js project was set up with Tailwind v3, you might need to migrate the config. Ideally, use a fresh Next.js setup with Tailwind v4 or standard v3 config.

### E. Import Aliases (`@/`)
Next.js supports `@/` aliases by default.
- Ensure your `tsconfig.json` has `"paths": { "@/*": ["./*"] }` (or `./src/*` depending on structure).
- The imports in this project (e.g., `import { Button } from "@/components/ui/button"`) should work automatically if folder structure matches.

## 3. Directory Mapping

| Vite Source | Next.js Destination |
|-------------|---------------------|
| `client/src/components` | `components` (or `src/components`) |
| `client/src/lib` | `lib` (or `src/lib`) |
| `client/src/hooks` | `hooks` (or `src/hooks`) |
| `client/src/pages/home.tsx` | `app/page.tsx` |
| `client/src/pages/dashboard/overview.tsx` | `app/app/page.tsx` |
| `client/src/pages/dashboard/cards.tsx` | `app/app/cards/page.tsx` |
| `client/src/layouts` | *Migrate to `app/layout.tsx` or per-page layouts* |

## 4. Font Setup (Google Fonts)

**app/layout.tsx:**
```tsx
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
