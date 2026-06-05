import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Head } from "vite-react-ssg";
import { seoUnits } from "@/data/unified-units";
import { getCivilizationByAbbr } from "@/data/civilizations";
import { categorizeUnit } from "@/hooks/useUnitSlot";

const SITE = "https://aoe4units.com";

// Mirrors the Sandbox unit picker ordering/labels/icons.
const categoryOrder = [
  "jeanne",
  "melee_infantry",
  "ranged",
  "cavalry",
  "siege",
  "mercenary",
  "khaganate",
  "monk",
  "ship",
  "other",
];

const categoryNames: Record<string, string> = {
  jeanne: "Jeanne d'Arc",
  melee_infantry: "Melee Infantry",
  ranged: "Ranged Units",
  cavalry: "Cavalry",
  siege: "Siege",
  monk: "Monks",
  ship: "Ships",
  other: "Other",
  mercenary: "Mercenaries",
  khaganate: "Khaganate",
};

const categoryIcons: Record<string, string> = {
  jeanne: "https://data.aoe4world.com/images/units/jeanne-darc-peasant-1.png",
  melee_infantry: "https://data.aoe4world.com/images/buildings/barracks.png",
  ranged: "https://data.aoe4world.com/images/buildings/archery-range.png",
  cavalry: "https://data.aoe4world.com/images/buildings/stable.png",
  siege: "https://data.aoe4world.com/images/buildings/siege-workshop.png",
  monk: "https://data.aoe4world.com/images/buildings/monastery.png",
  ship: "https://data.aoe4world.com/images/buildings/dock.png",
  other: "https://data.aoe4world.com/images/buildings/house.png",
  mercenary: "https://data.aoe4world.com/images/buildings/barracks.png",
  khaganate: "https://data.aoe4world.com/images/buildings/khaganate-palace.png",
};

export default function CivUnits() {
  const { civ: civAbbr } = useParams<{ civ: string }>();
  const civ = civAbbr ? getCivilizationByAbbr(civAbbr) : undefined;
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  if (!civ) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Civilization not found</h1>
        <Link to="/units" className="mt-4 inline-block text-primary underline">
          Browse civilizations
        </Link>
      </main>
    );
  }

  const byCat: Record<string, typeof seoUnits> = {};
  for (const u of seoUnits) {
    if (!u.civs.includes(civ.abbr)) continue;
    (byCat[categorizeUnit(u, civ.abbr)] ??= []).push(u);
  }

  const cats = categoryOrder
    .map((key) => ({
      key,
      units: (byCat[key] ?? [])
        .filter((u) => !q || u.name.toLowerCase().includes(q))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .filter((c) => c.units.length > 0);

  const title = `${civ.name} Units — AoE4 Stats, Counters & Technologies`;
  const description = `All ${civ.name} units in Age of Empires IV, grouped by type (melee infantry, ranged, cavalry, siege, ships). Pick a unit for its stats, cost and technologies.`;
  const url = `${SITE}/units/${civ.abbr}`;

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={url} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={url} />
      </Head>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <nav className="mb-4 text-sm">
          <Link to="/units" className="text-muted-foreground hover:text-foreground">
            ← All civilizations
          </Link>
        </nav>

        <h1 className="flex items-center gap-3 text-3xl font-bold">
          <img src={civ.flagPath} alt="" className="h-7 w-10 rounded-sm object-cover" />
          {civ.name} Units
        </h1>

        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${civ.name} units…`}
          className="mt-4 w-full max-w-sm rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />

        {cats.length === 0 ? (
          <p className="mt-8 text-muted-foreground">No units found for “{query}”.</p>
        ) : (
          cats.map((c) => (
            <section key={c.key} className="mt-6">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-primary">
                <img src={categoryIcons[c.key]} alt="" className="h-5 w-5 object-contain" />
                {categoryNames[c.key]}
              </h2>
              <ul className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3 md:grid-cols-4">
                {c.units.map((u) => (
                  <li key={u.id}>
                    <Link
                      to={`/units/${civ.abbr}/${u.id}`}
                      className="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-accent hover:text-accent-foreground"
                    >
                      <img
                        src={u.icon}
                        alt=""
                        loading="lazy"
                        className="h-6 w-6 shrink-0 object-contain"
                      />
                      <span className="truncate">{u.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </main>
    </>
  );
}
