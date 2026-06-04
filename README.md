# AOE4 Matchup

## 🎮 Project Overview

AOE4 Matchup is an educational tool that helps Age of Empires IV players understand unit matchups. Its core is a **Sandbox** where you pick two units and run a detailed **combat simulation** to see who wins, why, and by how much. Whether you're learning the basics or fine-tuning advanced engagements, it makes the rock-paper-scissors dynamics of AoE IV combat explicit.

## 🎯 How to Use

The app opens directly on the **Sandbox** (route `/`).

1. **Pick two units** from the civilization/unit selectors.
2. **Toggle technologies and abilities** on each side to model upgrades and buffs.
3. **Enable Versus mode** to run the combat simulation and read the predicted winner, remaining HP, and time-to-kill.
4. **Tune the engagement** with the combat options:
   - **Kiting** — model ranged units retreating while shooting (focus-fire or attack-move).
   - **Equal-cost** — normalize both sides to the same resource cost and compare groups, with selectable resolution models (aggregated DPS, focus fire, Monte-Carlo batches).
   - **Start distance** — control the approach phase before contact.

A short guided tour walks you through the interface on first use.

## 🛠️ Tech Stack

- **[React 18](https://react.dev/)** — UI library
- **[TypeScript](https://www.typescriptlang.org/)** — type-safe JavaScript
- **[Vite](https://vitejs.dev/)** — build tool and dev server
- **[TailwindCSS](https://tailwindcss.com/)** — utility-first CSS
- **[shadcn/ui](https://ui.shadcn.com/)** + **[Radix UI](https://www.radix-ui.com/)** — accessible component primitives
- **[Framer Motion](https://www.framer.com/motion/)** — animations
- **[TanStack Query](https://tanstack.com/query)** — data/state management
- **[React Router](https://reactrouter.com/)** — client-side routing
- **[driver.js](https://driverjs.com/)** — guided tour
- **[lucide-react](https://lucide.dev/)** — icons

## 🚀 Setup

### Prerequisites
- Node.js 18+
- npm (or yarn / bun)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/f2ire/aoe-matchup-game.git
   cd aoe-matchup-game
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the dev server**
   ```bash
   npm run dev
   ```

4. **Open your browser** at `http://localhost:8080`.

### Build for Production

```bash
npm run build
npm run preview
```

## 📊 Data

Unit, ability, and technology data come from the **[AOE4World data repository](https://github.com/aoe4world/data)** and are bundled as static JSON in `src/data/` — no API call happens at runtime. Unit corrections and synthetic ability/tech rules live in `src/data/patches/`.

Refresh the bundled data from upstream with the helper script:

```bash
npm run update-data        # download and apply if upstream changed
npm run update-data:dry    # preview changes without writing
npm run update-data:force  # rewrite files even if unchanged
```

## 📁 Project Structure

```
aoe4-matchup-master1/
├── src/
│   ├── pages/
│   │   └── Sandbox.tsx       # Main page (route /): unit comparison + combat sim
│   ├── components/           # UnitCard, AbilitySelector, TechnologySelector, VersusPanel, ui/
│   ├── lib/
│   │   └── combat.ts         # Combat simulation logic
│   ├── hooks/
│   │   └── useUnitSlot.ts    # Unit selection + applied techs/abilities
│   └── data/
│       ├── *.json            # Raw units / abilities / technologies
│       └── patches/          # Unit corrections + synthetic ability/tech rules
├── scripts/
│   └── update-data.mjs       # Refresh bundled data from aoe4world/data
├── public/                   # Static assets
└── package.json
```

## 📝 License

Licensed under the **MIT License** — see the [LICENSE](LICENSE) file.

## 🙏 Acknowledgments

- **Inspiration**: design principles of [Aegis UI](https://aoe-aegis.vercel.app/)
- **Data Source**: unit data and icons from [AOE4World](https://aoe4world.com/)

## 🤝 Contributing

Contributions, issues, and feature requests are welcome — check the [issues page](https://github.com/f2ire/aoe-matchup-game/issues).

## 📧 Contact

For questions or suggestions, please open an issue on GitHub.

---

Made with ❤️ for the Age of Empires IV community
