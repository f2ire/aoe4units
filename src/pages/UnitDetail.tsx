import { Link, useParams } from "react-router-dom";
import { Head } from "vite-react-ssg";
import { UnitCard } from "@/components/UnitCard";
import { AgeSelector } from "@/components/AgeSelector";
import { TechnologySelector } from "@/components/TechnologySelector";
import { AbilitySelector } from "@/components/AbilitySelector";
import { useUnitSlot } from "@/hooks/useUnitSlot";
import { buildModifiedVariation } from "@/lib/buildVariation";
import { getUnitById, getAvailableAges, getUnitGroup } from "@/data/unified-units";
import { getCivilizationName } from "@/data/civilizations";

const SITE = "https://aoe4units.com";

function UnitDetailView({ civ, id }: { civ?: string; id?: string }) {
  const unit = id ? getUnitById(id) : undefined;
  const civValid = !!unit && !!civ && unit.civs.includes(civ);

  // Hook must run unconditionally; seeded with the unit + civ so SSG renders the
  // real, civ-specific stats and technologies.
  const slot = useUnitSlot(unit ?? null, civ);

  if (!unit || !civValid) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Unit not found</h1>
        <Link to="/units" className="mt-4 inline-block text-primary underline">
          Browse all units
        </Link>
      </main>
    );
  }

  const source = slot.variation ?? slot.unit ?? unit;
  const isVariation = !!slot.variation;
  const modified = buildModifiedVariation(source, slot.modifiedStats, {
    baseId: isVariation ? (source as any).baseId : (source as any).id, // eslint-disable-line @typescript-eslint/no-explicit-any
    activeTechnologies: slot.activeTechnologies,
    activeAbilities: slot.activeAbilities,
    abilityCounters: slot.abilityCounters,
    selectedAge: slot.selectedAge,
    secondaryWeapons: slot.secondaryWeapons,
    applyCostMultiplier: true,
  });

  const unitId = slot.variation?.baseId ?? slot.unit?.id;
  const civName = getCivilizationName(civ!);
  // Counterparts on other civs, including same-role units named differently
  // (e.g. Lancer ≈ Knight). Excludes the current civ+unit page.
  const otherVersions = getUnitGroup(unit.id)
    .flatMap((gid) => {
      const gUnit = getUnitById(gid);
      if (!gUnit) return [];
      return gUnit.civs
        .filter((c) => !(gid === unit.id && c === civ))
        .map((c) => ({ civ: c, id: gid, name: gUnit.name }));
    })
    .sort((a, b) => getCivilizationName(a.civ).localeCompare(getCivilizationName(b.civ)));

  const title = `${unit.name} (${civName}) — AoE4 Stats, Cost & Counters`;
  const description = `${unit.name} stats for ${civName} in Age of Empires IV: hitpoints, armor, attack, movement speed, cost and bonus damage, with ${civName}'s technologies and abilities. Compare the ${unit.name} against any other unit.`;
  const url = `${SITE}/units/${civ}/${unit.id}`;

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={url} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={url} />
      </Head>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <nav className="mb-4 text-sm">
          <Link to="/units" className="text-muted-foreground hover:text-foreground">
            ← All units
          </Link>
        </nav>

        <h1 className="text-3xl font-bold">
          {unit.name} ({civName}) — Age of Empires IV
        </h1>
        {unit.description && (
          <p className="mt-2 whitespace-pre-line text-muted-foreground">{unit.description}</p>
        )}
        {otherVersions.length > 0 && (
          <p className="mt-2 text-sm text-muted-foreground">
            Other civilizations:{" "}
            {otherVersions.map((v, i) => (
              <span key={`${v.civ}/${v.id}`}>
                {i > 0 && ", "}
                <Link to={`/units/${v.civ}/${v.id}`} className="text-primary hover:underline">
                  {getCivilizationName(v.civ)}
                  {v.id !== unit.id && ` (${v.name})`}
                </Link>
              </span>
            ))}
          </p>
        )}

        <div className="mt-6 flex flex-col items-start gap-4 sm:flex-row sm:justify-center">
          <div className="flex flex-col gap-3">
            <AgeSelector
              availableAges={getAvailableAges(unit.id, slot.selectedCiv)}
              selectedAge={slot.selectedAge}
              onAgeChange={slot.setSelectedAge}
              orientation="left"
            />
            <TechnologySelector
              technologies={slot.techs}
              activeTechnologies={slot.activeTechnologies}
              onToggle={slot.toggleTechnology}
              unitMinAge={slot.unitMinAge}
              fullUpgradeAge={slot.fullUpgradeAge}
              onApplyFullUpgrade={slot.applyFullUpgrade}
              onReset={slot.resetTechnologies}
              orientation="left"
              selectedCiv={slot.selectedCiv}
              lockedTechnologies={slot.lockedTechnologies}
              unitId={unitId}
              selectedAge={slot.selectedAge}
            />
            <AbilitySelector
              abilities={slot.abilities}
              activeAbilities={slot.activeAbilities}
              onToggle={slot.toggleAbility}
              orientation="left"
              selectedCiv={slot.selectedCiv}
              lockedAbilities={slot.lockedAbilities}
              abilityCounters={slot.abilityCounters}
              onIncrement={slot.incrementAbility}
              onDecrement={slot.decrementAbility}
              onSetCounter={slot.setAbilityCounter}
              unitId={unitId}
            />
          </div>

          <div className="min-w-0 w-full max-w-sm">
            <UnitCard
              className="w-full"
              variation={isVariation ? (modified as any) : undefined} // eslint-disable-line @typescript-eslint/no-explicit-any
              unit={isVariation ? slot.unit! : (modified as any)} // eslint-disable-line @typescript-eslint/no-explicit-any
              side="left"
              isSelected
              bonusDamage={slot.modifiedStats.bonusDamage}
              secondaryWeapons={modified.secondaryWeapons ?? slot.secondaryWeapons}
              showSecondaryWeaponRow={slot.secondaryWeapons.length > 0}
              maxHpBonusFraction={slot.modifiedStats.maxHpBonusFraction ?? 0}
            />
          </div>
        </div>

        <div className="mt-8 text-center">
          <Link
            to="/"
            className="inline-block rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:opacity-90"
          >
            Compare the {unit.name} in the Sandbox →
          </Link>
        </div>
      </main>
    </>
  );
}

// Remount the view when the civ/unit in the URL changes, so useUnitSlot
// re-seeds (techs/abilities/stats follow the new civ on client-side navigation).
export default function UnitDetail() {
  const { civ, id } = useParams<{ civ: string; id: string }>();
  return <UnitDetailView key={`${civ}/${id}`} civ={civ} id={id} />;
}
