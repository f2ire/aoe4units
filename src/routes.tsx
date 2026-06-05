import type { RouteRecord } from "vite-react-ssg";
import { ClientOnly, Head } from "vite-react-ssg";
import App from "./App";
import Sandbox from "./pages/Sandbox";
import NotFound from "./pages/NotFound";
import UnitDetail from "./pages/UnitDetail";
import UnitsIndex from "./pages/UnitsIndex";
import CivUnits from "./pages/CivUnits";
import { seoUnits } from "./data/unified-units";
import { CIVILIZATIONS } from "./data/civilizations";

const HOME_TITLE =
  "AoE4 Units — Age of Empires IV Unit Comparison & Combat Simulator";
const HOME_DESC =
  "Compare Age of Empires IV units with combat simulation, tech and ability toggles, kiting and equal-cost modes.";

// Pre-rendered metadata for the homepage (the Sandbox itself is client-only).
function HomeHead() {
  return (
    <Head>
      <title>{HOME_TITLE}</title>
      <meta name="description" content={HOME_DESC} />
      <link rel="canonical" href="https://aoe4units.com/" />
      <meta property="og:title" content={HOME_TITLE} />
      <meta property="og:description" content={HOME_DESC} />
      <meta property="og:type" content="website" />
      <meta property="og:url" content="https://aoe4units.com/" />
      <meta property="og:image" content="https://aoe4units.com/ram-icon.png" />
      <meta name="twitter:card" content="summary" />
    </Head>
  );
}

// The Sandbox is heavily interactive and uses browser-only APIs, so it is
// rendered client-side only. The SEO pages (/units, /units/:id) are static and
// get fully pre-rendered to HTML at build time via `getStaticPaths`.
export const routes: RouteRecord[] = [
  {
    path: "/",
    element: <App />,
    children: [
      {
        index: true,
        element: (
          <>
            <HomeHead />
            <ClientOnly>{() => <Sandbox />}</ClientOnly>
          </>
        ),
      },
      { path: "units", element: <UnitsIndex /> },
      {
        path: "units/:civ",
        element: <CivUnits />,
        getStaticPaths: () =>
          CIVILIZATIONS.filter((c) => seoUnits.some((u) => u.civs.includes(c.abbr))).map(
            (c) => `/units/${c.abbr}`,
          ),
      },
      {
        path: "units/:civ/:id",
        element: <UnitDetail />,
        getStaticPaths: () =>
          seoUnits.flatMap((u) => u.civs.map((c) => `/units/${c}/${u.id}`)),
      },
      { path: "*", element: <ClientOnly>{() => <NotFound />}</ClientOnly> },
    ],
  },
];
