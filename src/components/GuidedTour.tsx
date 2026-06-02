import { useRef, useEffect } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { aoe4Units } from '@/data/unified-units';
import type { AoE4Unit } from '@/data/unified-units';

interface GuidedTourProps {
  setSelectedCiv1: (civ: string) => void;
  setUnit1: (unit: AoE4Unit | null) => void;
  setSelectedAge1: (age: number) => void;
  applyFullUpgrade1: (age: number) => void;
  toggleAbility1: (id: string) => void;
  setSelectedCiv2: (civ: string) => void;
  setUnit2: (unit: AoE4Unit | null) => void;
  setSelectedAge2: (age: number) => void;
  applyFullUpgrade2: (age: number) => void;
  toggleAbility2: (id: string) => void;
  setIsVersus: (v: boolean) => void;
  setAtEqualCost: (v: boolean) => void;
  setAllowKiting: (v: boolean) => void;
  setMultiUnitModelKey: (key: 'aggregated' | 'focusFire' | 'focusFireBatchesMC') => void;
}

export function GuidedTour({
  setSelectedCiv1, setUnit1, setSelectedAge1, applyFullUpgrade1, toggleAbility1,
  setSelectedCiv2, setUnit2, setSelectedAge2, applyFullUpgrade2, toggleAbility2,
  setIsVersus, setAtEqualCost, setAllowKiting, setMultiUnitModelKey,
}: GuidedTourProps) {
  const fns = useRef({ applyFullUpgrade1, applyFullUpgrade2, toggleAbility1, toggleAbility2 });
  useEffect(() => {
    fns.current = { applyFullUpgrade1, applyFullUpgrade2, toggleAbility1, toggleAbility2 };
  });

  const startTour = () => {
    const royalKnight = aoe4Units.find(u => u.id === 'royal-knight') ?? null;
    const mountedSamurai = aoe4Units.find(u => u.id === 'mounted-samurai') ?? null;

    // Reset to clean state before starting the tour
    setUnit1(null);
    setUnit2(null);
    setIsVersus(false);
    setAtEqualCost(false);
    setAllowKiting(false);

    let driverObj: ReturnType<typeof driver>;

    driverObj = driver({
      showProgress: true,
      animate: true,
      progressText: '{{current}} / {{total}}',
      nextBtnText: 'Next →',
      prevBtnText: '← Back',
      doneBtnText: 'Done ✓',
      steps: [
        // ── 0 ── Welcome
        {
          popover: {
            title: 'Welcome to Sandbox Mode',
            description:
              'This guided tour walks you through the tool step by step. Each step automatically sets up the UI — just follow along and click <b>Next</b>.',
          },
        },

        // ── 1 ── Civ 1: select French
        {
          element: '#tour-civ1',
          onHighlightStarted: () => { setSelectedCiv1('fr'); },
          popover: {
            title: '1 — Civilization (Civ 1)',
            description:
              'The <b>French</b> civilization has been selected. Each civ has unique units, technologies, and playstyles. The unit list below updates accordingly.',
            side: 'bottom', align: 'start',
          },
        },

        // ── 2 ── Unit 1: select Royal Knight
        {
          element: '#tour-unit1',
          onHighlightStarted: () => { if (royalKnight) setUnit1(royalKnight); },
          popover: {
            title: '2 — Unit (Civ 1)',
            description:
              'The <b>Royal Knight</b> has been loaded. Units are grouped by category — Infantry, Cavalry, Siege, and more. Unique units are marked with a tag.',
            side: 'bottom', align: 'start',
          },
        },

        // ── 3 ── Civ 2: select Japanese
        {
          element: '#tour-civ2',
          onHighlightStarted: () => { setSelectedCiv2('ja'); },
          popover: {
            title: '3 — Civilization (Civ 2)',
            description:
              '<b>Japanese</b> civilization selected for the Civ 2 side. You can mix any two civilizations to compare their units.',
            side: 'bottom', align: 'end',
          },
        },

        // ── 4 ── Unit 2: select Mounted Samurai
        {
          element: '#tour-unit2',
          onHighlightStarted: () => { if (mountedSamurai) setUnit2(mountedSamurai); },
          popover: {
            title: '4 — Unit (Civ 2)',
            description:
              'The <b>Mounted Samurai</b> has been loaded. We now have a French cavalry unit facing a Japanese cavalry unit.',
            side: 'bottom', align: 'end',
          },
        },

        // ── 5 ── Age 1: set to Castle Age (III)
        {
          element: '#tour-age1',
          onHighlightStarted: () => { setSelectedAge1(3); },
          popover: {
            title: '5 — Age (Civ 1)',
            description:
              'Switched to <b>Castle Age (III)</b>. As units age up they gain tiers — <b>Hardened</b>, <b>Veteran</b>, and <b>Elite</b>.',
            side: 'right', align: 'start',
          },
        },

        // ── 6 ── Age 2: set to Castle Age (III)
        {
          element: '#tour-age2',
          onHighlightStarted: () => { setSelectedAge2(3); },
          popover: {
            title: '6 — Age (Civ 2)',
            description:
              'Same age set for the Civ 2 unit. Both sides are now at <b>Castle Age (III)</b> for a fair comparison.',
            side: 'left', align: 'start',
          },
        },

        // ── 7 ── Full upgrade age III for civ 1
        {
          element: '#tour-techs1',
          onHighlightStarted: () => { fns.current.applyFullUpgrade1(3); },
          popover: {
            title: '7 — Technologies (Civ 1)',
            description:
              '<b>Full upgrade</b> applied at Castle Age for the Royal Knight. Technologies let you simulate a fully researched unit — toggle individual techs to fine-tune the loadout.',
            side: 'right', align: 'start',
          },
        },

        // ── 8 ── Charge ability for civ 1
        {
          element: '#tour-abilities1',
          onHighlightStarted: () => { fns.current.toggleAbility1('charge-attack'); },
          popover: {
            title: '8 — Abilities (Civ 1)',
            description:
              '<b>Charge Attack</b> activated for the Royal Knight. Abilities add passive bonuses, special attacks, or auras. Some have counters or timed durations.',
            side: 'right', align: 'start',
          },
        },

        // ── 9 ── Full upgrade age III for civ 2
        {
          element: '#tour-techs2',
          onHighlightStarted: () => { fns.current.applyFullUpgrade2(3); },
          popover: {
            title: '9 — Technologies (Civ 2)',
            description:
              '<b>Full upgrade</b> applied at Castle Age for the Mounted Samurai. Both units are now fully upgraded — ready for a balanced combat simulation.',
            side: 'left', align: 'start',
          },
        },

        // ── 10 ── Charge + Uma Bannerman aura for civ 2
        {
          element: '#tour-abilities2',
          onHighlightStarted: () => {
            fns.current.toggleAbility2('charge-attack');
            fns.current.toggleAbility2('ability-uma-bannerman-aura');
          },
          popover: {
            title: '10 — Abilities (Civ 2)',
            description:
              '<b>Charge Attack</b> and <b>Uma Bannerman Aura</b> activated for the Mounted Samurai.',
            side: 'left', align: 'start',
          },
        },

        // ── 11 ── Switch to Versus mode
        {
          element: '#tour-mode-toggle',
          onHighlightStarted: () => { setIsVersus(true); },
          popover: {
            title: '11 — Versus Mode',
            description:
              'Switched to <b>Versus</b> mode. The tool now runs a full combat simulation: Time to Kill, DPS, hits to kill, remaining HP, and a clear winner.',
            side: 'bottom', align: 'center',
          },
        },



        // ── 12 ── Versus stats explained
        {
          element: '#tour-combat-results',
          popover: {
            title: '12 — Combat Statistics',
            description:
              '<b>DPS</b>: damage per second dealt to this opponent (after armor &amp; resistance).<br><b>DPS/Cost</b>: efficiency — DPS relative to the unit\'s resource cost.<br><b>Hits to Kill</b>: number of attacks needed to kill the opponent.<br><b>TTK</b>: time to kill in seconds.<br><br><b>🏆 Winner Stats</b>: <b>HP Remaining</b> — Health the winner has theoretically left after the fight (and a percentage of max HP). In At Equal Cost mode, also shows <b>Units Remaining</b> and <b>Resource Saved</b>.',
            side: 'top', align: 'center',
          },
        },

        // ── 13 ── At Equal Cost
        {
          element: '#tour-atEqualCost',
          onHighlightStarted: () => { setAtEqualCost(true); },
          popover: {
            title: '13 — At Equal Cost',
            description:
              '<b>At Equal Cost</b> enabled. Instead of 1v1, the simulation scales each side to the same total resource budget — showing how many units each side can field and who wins the exchange.',
            side: 'bottom', align: 'center',
          },
        },

        // ── 14 ── Model selector
        {
          element: '#tour-model',
          onHighlightStarted: () => { setMultiUnitModelKey('focusFireBatchesMC'); },
          popover: {
            title: '14 — Combat Model',
            description:
              'The default model is <b>Target Focus</b>: both sides concentrate fire on one target at a time.<br><b>Attack Move</b>: Monte Carlo simulation with random batch assignment (200 iterations) — gives win rates and statistical spread.<br>Choose based on the scenario you want to model.',
            side: 'bottom', align: 'center',
          },
        },

        // ── 15 ── MC distribution stats
        {
          element: '#tour-mc-stats',
          popover: {
            title: '15 — Monte Carlo Results',
            description:
              'With <b>Attack Move</b> selected, each unit card shows the outcome statistics across 200 simulations.<br><br>' +
              '<b>% wins</b>: share of simulations where that side wins.<br>' +
              '<b>HP Remaining</b>: median surviving HP <i>when that side wins</i>, with ±std deviation showing spread.<br>' +
              '<b>Units Remaining</b> (equal-cost): median surviving units ±std.<br>' +
              '<b>Resource Saved</b>: median resource advantage ±std.<br><br>' +
              'A low std means the outcome is consistent; a high std means high variance — the fight is luck-sensitive.',
            side: 'top', align: 'center',
          },
        },

        // ── 16 ── Allow Kiting
        {
          element: '#tour-kiting',
          popover: {
            title: '16 — Allow Kiting',
            description:
              '<b>Allow Kiting</b> is another independent mod. While in 1v1 versus or equal cost versus, it models a kiting back fight for ranged units. After each shot the ranged unit steps back while reloading to gain distance, while the melee unit closes the gap. The start distance slider controls how far apart they begin.',
            side: 'bottom', align: 'center',
          },
        },
      ],
    });

    driverObj.drive();
  };

  return (
    <button
      onClick={startTour}
      className="absolute top-0 right-0 w-8 h-8 rounded-full bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary transition-colors text-sm font-semibold flex items-center justify-center"
      title="Open guided tour"
      aria-label="Open guided tour"
    >
      ?
    </button>
  );
}
