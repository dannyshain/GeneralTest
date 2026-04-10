# The General — Prototype

A browser-based turn-based strategy game inspired by the classic Windows XP game "The General."

## How to Run

No build step required. Open `index.html` in a modern browser that supports ES modules.

**Recommended:** use a local dev server (avoids module CORS issues in some browsers):

```bash
# Python
python -m http.server 8080

# Node (if you have npx)
npx serve .
```

Then open `http://localhost:8080` in your browser.

## How to Play

1. Choose the number of countries on the setup screen and click **Start Game**.
2. Your country is **Northmark** (always country 0, marked with a white ring on the map).
3. Each turn represents **one year**. The game runs for up to **120 years**.

### Each Turn

**Population Allocation**
- Adjust how many of your people are **Farmers** (produce money), **Scientists** (research), or **Soldiers** (fight).
- Farmers → Grain → Money. More farmers = more money.
- Scientists advance one of 6 science areas. Assign them individually.
- Soldiers sit in garrison until a general leads them to battle.

**Science**
- Assign scientists to any of 6 areas: Population Growth, Population Density, Military Strength, Scientific Efficiency, Grain Production, Grain Value.
- Each area levels up independently. Higher levels = exponentially more research required.

**Generals**
- You start with no general. Use the **Recruit General** panel to hire one.
- Set Age (20–60), Skill (1–30), Speed (1–99). Younger/more skilled/faster = more expensive.
- Each general chooses one action per turn:
  - **Attack** — select a neighbouring country and how many soldiers to commit.
  - **Defend** — garrison receives a 1.5× combat bonus if attacked.
  - **Rest** — restores 5 energy.
  - **Study** — gains +3 skill.

**Attacking**
- You can only attack countries that are **adjacent** (shown as lines on the map).
- Battles are multi-round (up to 25 rounds). Strength depends on soldier count, military science, general skill, morale, and energy.
- Victory: you capture territory. Territory capture = `(survivors / 100) × 20 × speed modifier`.
- Losing all territory eliminates a country.

**End Turn**
- Click **End Turn** to submit your orders and advance the year.
- AI countries act simultaneously.

### Map
- Circles = countries. Circle size reflects territory.
- Click any country to see its stats (bottom-left info bar).
- Yellow highlighted circles = your current country's neighbours (valid attack targets).

### Winning
- Last country standing wins immediately.
- At year 120, highest score wins: 50% territory + 30% population + 20% science, with +5% bonus per country you eliminated.

---

## Balancing / Tuning

All balance values live in **`src/config.js`**. Every constant is labeled `[TUNABLE]`. Key levers:

| Constant | Effect |
|---|---|
| `STARTING_MONEY` | How much seed money each country starts with |
| `DAMAGE_FACTOR` | How lethal combat is per round |
| `LAND_PER_100_SOLDIERS` | Territory captured per 100 surviving soldiers |
| `BORDER_TRANSFER_RATE` | How aggressively conquest shifts adjacencies |
| `GENERAL_DEATH_RATE_PER_YEAR` | Death probability per year over age 60 |
| `SCIENCE_BASE_THRESHOLD` | Points to reach science level 2 |
| `SCIENCE_LEVEL_SCALING` | How exponential science costs are |

---

## File Structure

```
index.html              # Game UI shell + styles
src/
  config.js             # ALL tunable constants
  gameState.js          # State shape, factory functions
  mapGen.js             # Gabriel-graph map generation, border weights, angles
  population.js         # Growth, density cap, allocation
  economy.js            # Grain production, income, general cost formula
  science.js            # Research allocation, level-up thresholds
  generals.js           # Recruitment, aging, death, skill gain
  combat.js             # Multi-round battle resolver
  flavorText.js         # Battle narrative templates (edit freely)
  landCapture.js        # Territory transfer + border weight updates
  hostility.js          # Hostility matrix, attack/elimination recording, decay
  ai.js                 # AI personality + order generation
  scoring.js            # Score calculation, yearly snapshot, victory check
  turnEngine.js         # 15-step turn pipeline
  ui/
    main.js             # Entry point, game loop, order submission
    map.js              # SVG map rendering
    hud.js              # Player control panel
    battleLog.js        # Battle results and postgame screen
```

---

## Known Prototype Limitations

- No async multiplayer yet (architecture supports it; Supabase layer not built).
- Map is a graph of nodes, not rendered polygons — border adjacency shifts are simulated by weights.
- One general per country recommended for early testing (code supports multiple).
- No surrender UI yet (AI takeover on surrender is wired in `turnEngine.js` via `isSurrendered` flag).
