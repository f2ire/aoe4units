import { Link } from "react-router-dom";
import { Head } from "vite-react-ssg";
import { seoUnits } from "@/data/unified-units";
import { CIVILIZATIONS } from "@/data/civilizations";

const SITE = "https://aoe4units.com";

// Civilizations that have at least one unit page, with their unit count.
const CIVS_WITH_COUNT = CIVILIZATIONS.map((civ) => ({
  civ,
  count: seoUnits.filter((u) => u.civs.includes(civ.abbr)).length,
})).filter((c) => c.count > 0);

export default function UnitsIndex() {
  const title = "Age of Empires IV Units by Civilization — Stats & Counters";
  const description =
    "Pick an Age of Empires IV civilization to browse all its units with full stats, costs, counters and technologies.";

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={`${SITE}/units`} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={`${SITE}/units`} />
      </Head>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-3xl font-bold">Choose a Civilization</h1>
        <p className="mt-2 text-muted-foreground">
          Pick a civilization to see its units, or open the{" "}
          <Link to="/" className="text-primary underline">
            comparison Sandbox
          </Link>
          .
        </p>

        <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
          {CIVS_WITH_COUNT.map(({ civ, count }) => (
            <li key={civ.abbr}>
              <Link
                to={`/units/${civ.abbr}`}
                className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-3 hover:bg-accent hover:text-accent-foreground"
              >
                <img src={civ.flagPath} alt="" className="h-8 w-12 rounded-sm object-cover" />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{civ.name}</span>
                  <span className="block text-xs text-muted-foreground">{count} units</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
