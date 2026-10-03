import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import {
  Archivo, Audiowide, DotGothic16, Exo_2, IBM_Plex_Sans, Lexend_Exa, Pirata_One, Pixelify_Sans,
  Share_Tech_Mono, Space_Grotesk, Space_Mono, Unbounded,
} from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";
import ThemeFilters from "@/components/ThemeFilters";
import { THEME_COOKIE, themeColorOf, themeFrom } from "@/lib/themes";
import "./globals.css";
// The looks: each theme's colour variables (generated), then its type, texture and details.
// Imported here as their own stylesheets, after Tailwind's — see the note in globals.css.
import "./theme-palettes.css";
import "./themes.css";

// Each theme's typefaces (see app/themes.css). None is preloaded: a font file is only fetched once
// the active theme's CSS asks for it, so a theme never pays for another's fonts.
const archivo = Archivo({ subsets: ["latin"], variable: "--font-archivo", axes: ["wdth"], preload: false });
const unbounded = Unbounded({ subsets: ["latin"], variable: "--font-unbounded", preload: false });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk", preload: false });
const spaceMono = Space_Mono({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-space-mono", preload: false });
const pixelify = Pixelify_Sans({ subsets: ["latin"], variable: "--font-pixelify", preload: false });
const plexSans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-plex", preload: false });
const audiowide = Audiowide({ subsets: ["latin"], weight: "400", variable: "--font-audiowide", preload: false });
const exo2 = Exo_2({ subsets: ["latin"], variable: "--font-exo2", preload: false });
const lexendExa = Lexend_Exa({ subsets: ["latin"], variable: "--font-lexend-exa", preload: false });
const shareTechMono = Share_Tech_Mono({ subsets: ["latin"], weight: "400", variable: "--font-share-tech-mono", preload: false });
const dotGothic = DotGothic16({ subsets: ["latin"], weight: "400", variable: "--font-dotgothic", preload: false });
const pirata = Pirata_One({ subsets: ["latin"], weight: "400", variable: "--font-pirata", preload: false });

const FONT_VARIABLES = [
  archivo, unbounded, spaceGrotesk, spaceMono, pixelify, plexSans, audiowide, exo2, lexendExa, shareTechMono, dotGothic,
  pirata,
]
  .map((f) => f.variable)
  .join(" ");

export const metadata: Metadata = {
  title: "MyPortal",
  description: "Personal hub for all your apps and trackers.",
  appleWebApp: {
    capable: true,
    title: "Expenses",
    statusBarStyle: "default",
  },
};

export async function generateViewport(): Promise<Viewport> {
  const theme = themeFrom((await cookies()).get(THEME_COOKIE)?.value);
  return {
    themeColor: themeColorOf(theme),
    // Lets the layout extend under the notch / home indicator when installed.
    viewportFit: "cover",
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = themeFrom((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html lang="en" data-theme={theme} className={`${FONT_VARIABLES} h-full antialiased`}>
      <body className="min-h-screen bg-gray-50">
        <ThemeFilters />
        {children}
        <ServiceWorkerRegistrar />
        <SpeedInsights />
      </body>
    </html>
  );
}
