import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router";
import { ThemeProvider, THEME_INIT_SCRIPT } from "@/components/ThemeToggle";
import appCss from "@/styles.css?url";

// Document shell for every page. `head` replaces the Next.js `metadata`
// export — add per-route metadata with a `head` on that route's file.
export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "WeekCurve — Plan the week. Ship the goal." },
      {
        name: "description",
        content:
          "Weekly planning for software teams that want clear goals, useful approvals, and a Friday finish.",
      },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "WeekCurve" },
      { property: "og:title", content: "WeekCurve — Plan the week. Ship the goal." },
      {
        property: "og:description",
        content:
          "Weekly planning for software teams that want clear goals, useful approvals, and a Friday finish.",
      },
      { property: "og:image", content: "/og-weekcurve.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "WeekCurve — Plan the week. Ship the goal." },
      {
        name: "twitter:description",
        content:
          "Weekly planning for software teams that want clear goals, useful approvals, and a Friday finish.",
      },
      { name: "twitter:image", content: "/og-weekcurve.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.png", sizes: "32x32", type: "image/png" },
      { rel: "icon", href: "/icon.svg", type: "image/svg+xml" },
    ],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <HeadContent />
      </head>
      <body className="antialiased min-h-screen bg-background text-foreground transition-colors duration-150">
        <ThemeProvider>
          {children}
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  );
}
