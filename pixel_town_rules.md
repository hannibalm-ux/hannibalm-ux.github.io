# Pixel Town — Rules, Mechanics and Engine Reference

This document describes everything Pixel Town simulates and how. It covers the clock, the map, every villager system, the economy, government, justice, family life, the frontier, rendering, saving and testing. Numbers are the ones the code actually uses (`pixel_town.html` and `civ/*.js`); where a rule is probabilistic, the odds are given.

Pixel Town has **two modes**:

- **Civilization mode** (every new game). 100 people make camp by a river with crude shelters and about a week of food. There is no town, no jobs, no market, no government and no bridge. Everything else has to emerge from what they decide to do. It is described in **Part II** (sections 24 to 44).
- **Classic mode** (old saves, or `pixel_town.html?mode=classic`). The established medieval town with 50 villagers, described in sections 1 to 23. Classic towns also gain the new minds, knowledge, research, prospecting and neighbouring settlements (section 39).

---

## Contents

1. [What Pixel Town is](#1-what-pixel-town-is)
2. [Files and how to run it](#2-files-and-how-to-run-it)
3. [Time and the clock](#3-time-and-the-clock)
4. [The engine: tick order, randomness, saving](#4-the-engine-tick-order-randomness-saving)
5. [The map and the world](#5-the-map-and-the-world)
6. [Villagers](#6-villagers)
7. [A villager's day](#7-a-villagers-day)
8. [The economy](#8-the-economy)
9. [Property, construction and social class](#9-property-construction-and-social-class)
10. [Government, laws and elections](#10-government-laws-and-elections)
11. [Minds: memory, beliefs, opinions and trust](#11-minds-memory-beliefs-opinions-and-trust)
12. [Society: emotions, goals, teams, schemes, careers](#12-society-emotions-goals-teams-schemes-careers)
13. [Crime and justice](#13-crime-and-justice)
14. [Love, family, birth, death and migration](#14-love-family-birth-death-and-migration)
15. [The frontier: exploration, annexation and resources](#15-the-frontier-exploration-annexation-and-resources)
16. [Food security: granary and caravans](#16-food-security-granary-and-caravans)
17. [Weather, seasons, festivals and the bridge](#17-weather-seasons-festivals-and-the-bridge)
18. [Rendering: 2D and 3D](#18-rendering-2d-and-3d)
19. [The interface](#19-the-interface)
20. [Logs, weekly reports and music](#20-logs-weekly-reports-and-music)
21. [What the player can and cannot do](#21-what-the-player-can-and-cannot-do)
22. [Save compatibility and automated tests](#22-save-compatibility-and-automated-tests)
23. [Known limitations](#23-known-limitations)

**Part II — Civilization mode**

24. [Design principle](#24-design-principle)
25. [The starting world](#25-the-starting-world)
26. [Time tiers and performance](#26-time-tiers-and-performance)
27. [People: bodies, minds, knowledge, skills](#27-people-bodies-minds-knowledge-skills)
28. [The decision loop, goals and plans](#28-the-decision-loop-goals-and-plans)
29. [Work, food and ecology](#29-work-food-and-ecology)
30. [Emergent occupations and learning](#30-emergent-occupations-and-learning)
31. [Building, land, farms, ranches, bridges and roads](#31-building-land-farms-ranches-bridges-and-roads)
32. [Exchange: gifts, barter, money and markets](#32-exchange-gifts-barter-money-and-markets)
33. [Organisations, businesses, jobs and contracts](#33-organisations-businesses-jobs-and-contracts)
34. [Credit, banks, shares and bankruptcy](#34-credit-banks-shares-and-bankruptcy)
35. [Government and justice from the ground up](#35-government-and-justice-from-the-ground-up)
36. [Education, health and sport](#36-education-health-and-sport)
37. [Science, technology and resources](#37-science-technology-and-resources)
38. [Neighbours, imports and migration](#38-neighbours-imports-and-migration)
39. [Classic towns: what they gain](#39-classic-towns-what-they-gain)
40. [Civilization mode: interface, saves and tests](#40-civilization-mode-interface-saves-and-tests)
41. [Civilization mode: crime, investigation and the courts](#41-civilization-mode-crime-investigation-and-the-courts)
42. [Civilization mode: memory, beliefs and opinions](#42-civilization-mode-memory-beliefs-and-opinions)
43. [Civilization mode: the frontier](#43-civilization-mode-the-frontier)
44. [Civilization mode: construction and housing](#44-civilization-mode-construction-and-housing)
45. [Civilization mode: street lighting and transport](#45-civilization-mode-street-lighting-and-transport)

---

## 1. What Pixel Town is

Pixel Town is a self-running life simulation of a small medieval-style town. It starts with 50 villagers who live, work, trade, gossip, fall in love, vote, commit crimes and grow old on a single shared clock. The player mostly watches; the town governs itself. The player can nudge it: pay for expeditions, petition for annexation, commission buildings, sell or demolish town property, add villagers from a template, and choose the music.

The design goal is emergent history. The town remembers what happened, villagers learn from it, institutions (courts, jails, investigators) appear only when the town's own history calls for them, and the map physically grows when land and resources run short.

---

## 2. Files and how to run it

| File | Purpose |
|---|---|
| `pixel_town.html` | The engine, the classic town, the art generator, UI, 2D and 3D renderers. Loads the 3D engine from `vendor/` only when 3D is switched on. |
| `civ/civ_defs.js` | Data: knowledge domains, skills, cognition, goods, activities, occupations, structures, business types, organisation types, technologies, theories, minerals, neighbours, stage names. |
| `civ/civ_core.js` | Mode flag, the wild world, people and households, structures and land, time tiers, moving agents, eating, health, births, deaths, marriage, weekly log. |
| `civ/civ_mind.js` | Cognition, the decision loop, goals, learning, mentorship, technology discovery, emergent occupations. |
| `civ/civ_build.js` | Projects, housing, fields, pens, animals, bridges, roads, property values, sales, rent, conversion, demolition. |
| `civ/civ_econ.js` | Barter, money, markets, organisations, business formation, jobs, contracts, loans, banks, shares, the exchange, bankruptcy. |
| `civ/civ_society.js` | Gatherings and government, justice, education, health care, sport, neighbours, food imports, migration. |
| `civ/civ_justice.js` | Civilization mode's crime and justice: crimes at the time and place they happen, witnesses, statements, investigation, suspects and alibis, rough justice, magistrates and trials, recusal, bribery, sentencing, jail, legal history. |
| `civ/civ_cognition.js` | Civilization mode's link to the memory engine: lived experiences, gossip, gatherings, newspapers, votes, protests, discontent. |
| `civ/civ_frontier.js` | Civilization mode's frontier: fog beyond the valley, expeditions, regions, annexation votes, districts, upkeep, new ecology and minerals. |
| `civ/civ_housing.js` | Civilization mode's construction support and housing: evening and rest-day building, building bees, construction contracts, buying and substituting materials, stalled projects, reclaiming abandoned property, sheltering and taking in the homeless. |
| `civ/civ_transport.js` | Civilization mode's street lighting (torches to electric lights), transport buildings, and the vehicles that the town's techniques put on its paths, water, rails and sky. |
| `civ/civ_science.js` | Hidden deposits, prospecting, claims, mines, oil and gas, research and the scientific method. |
| `civ/civ_render.js`, `civ/civ_3d.js`, `civ/civ_ui.js` | 2D art for the new mode; voxel people and voxel animals, props, crops, building condition and interiors (both modes); the panels. |
| `civ/civ_overlay.js` | New systems for classic towns. |
| `pixel_town_standalone.html` | The same game with Three.js inlined, so it runs from a single file by double-clicking. |
| `vendor/three.module.min.js`, `vendor/three.LICENSE` | Three.js r169 (MIT) for the 3D view. |
| `pixel_town_citizen_template.md` | Format for adding villagers from text or JSON. |
| `tests/pixel_town.tests.js`, `tests/civ.tests.js`, `tests/run_tests.js` | 43 classic and 111 civilization-mode scenario tests (Playwright). |

There is no server and no build step. Everything, including every sprite, building and tile, is drawn procedurally at startup from code. The town saves itself in the browser's `localStorage`. The standalone file inlines the `civ/` scripts as well as Three.js.

**Starting a game:** a new game is a civilization with a random seed. `?seed=N` fixes the seed (the same seed gives the same world and the same first days). `?mode=classic` starts the classic town instead. An existing save always loads in the mode it was made in.

---

## 3. Time and the clock

| Unit | Length |
|---|---|
| Game minute | 2.5 real seconds at 1× (so 1 real hour = 1 game day) |
| Day | 1,440 game minutes |
| Week | 7 days: Moonday, Tideday, Windsday, Thornsday, Fireday, Starday, **Hallday** |
| Season | 28 days (4 weeks): Spring, Summer, Fall, Winter |
| Year | 112 days (16 weeks) |

- **Speeds:** pause, 1×, 10×, 60×, 360×.
- **Hallday** is the town hall day. Proposals are voted on at 18:00.
- **Aging:** every villager ages one year every 112 days (one game year). Children come of age at 16.
- **Festivals:** a season festival starts every 28th day on the town square.
- **Away time:** the town keeps running while the page is closed. On return, all the missed time is simulated in fast-forward (there is no cap), in short slices so the page stays responsive, with a progress bar and an estimate of the time left. The town is saved every 10 game days during the catch-up, so closing the tab loses nothing already caught up. **Play now** stops the catch-up and skips the rest. A summary of important events is shown.
- **Saving:** the city autosaves every 15 to 90 seconds (less often for big cities) and when the page is hidden or closed. The autosave goes to IndexedDB in the background, gzip-compressed by the browser. It is no longer compressed on the main thread, which used to freeze big cities for seconds on tablets. Saves small enough for localStorage are kept there too. At start the newer of the two is loaded, and the browser is asked to keep the data.
- **Cities (💾 Cities, below the map):** save a named copy of the current city, open a saved city (it resumes exactly where it was saved), delete one, download the current or a saved city as a `.pixeltown` file, or open a city file (from any device). A downloaded file is the safest backup: Safari may delete a site's stored data if it is not visited for a few weeks.
- **Background tab:** if the tab falls far behind while hidden, the same catch-up runs.

---

## 4. The engine: tick order, randomness, saving

### Tick order

Every game minute runs `simTick()` in a fixed order:

1. **Time.** Advance the minute. At midnight, `dayStarted()` runs the daily systems (weather, aging, bridge wear, markets, life events, society, justice, frontier, careers, land).
2. **Governance.** Town hall meetings, vote casting, elections.
3. **Agents.** Every villager in a stable order: needs decay, follow the day's plan, walk, act (work, eat, socialise, trade).
4. **Economy (hourly).** Prices reprice, moods update, villagers reflect on memories.
5. **Timed events.** Sports matches at 16:55, protests resolve at 17:50, trials start at 14:00 and verdicts come at 16:00, expeditions return at 10:00, granary rations at 07:30, 12:00 and 18:30.

### Randomness

All simulation randomness comes from one seeded generator (`RNG.s`, stored in the save). Map features use fixed seeds (`mapRand`), and many choices use stable hashes of names and ids. The same save played from the same point makes the same decisions. Purely cosmetic motion (animal wandering, rain particles) uses the browser's random numbers and does not affect history.

### Saving

- **Where:** state is saved to `localStorage` under `pixeltown.save.v2` (schema `v:3`).
- **When:** on a timer, when the tab is hidden, and when the page closes.
- **What:** the save holds all villagers, relationships, minds, properties, laws, cases, the frontier, the chronicle and the weekly reports.
- **Old saves:** they are upgraded in place when loaded. New fields get defaults, and nothing is fabricated (see §22).

---

## 5. The map and the world

### Tiles

The world is a grid of 16-pixel tiles. The original town is 110 × 50 tiles. Tile types: grass, path, water, bridge, tree, building, field, plaza, rock, object, flower, dock, sand, pasture, fence, and fog (unexplored land, not walkable).

### Places in the original town

| Place | What happens there |
|---|---|
| Town Square and Town Hall steps | Socialising, protests, festivals, speeches; the town hall hosts votes and early trials |
| Market stalls | Merchants' base |
| Wheatfields (south) | Farming |
| West Pasture | Ranching; cows, sheep, pigs and chickens wander there |
| Lake Docks | Fishing |
| East Grove (across the river) | Woodcutting and odd jobs |
| Deepvein Mine (north-east) | Mining |
| Town Well | Households fetch water |
| Tipsy Lantern | Tavern: ale, hot meals, evenings, lodging |
| Marsh Bakery, Brandt Smithy, Holt & Finch Carpentry, Hock & Cleaver Butchery, Lakeside Fish Hut, Red Barn, Clinic | Trade workplaces |
| 19 houses | Homes |

A river runs north to south and feeds a lake in the south. The only crossing is the old river bridge, which links the town to the grove and the mine.

### Starting territories

| Territory | Status at start | Annex cost | Perk |
|---|---|---|---|
| Pixel Town (core) | Claimed | – | Founding land |
| East Grove & Deepvein | Claimed | – | Grove and mine |
| Southshore | Unclaimed | 350¢ | +20% fishing |
| Eastmarch Meadows | Unclaimed | 600¢ | +20% harvests |
| Highcrest | Unclaimed | 800¢ | +25% mining |

Plots (4 × 4 building sites) are laid out in each territory. Plots in unclaimed land cannot be bought or built on.

### The growing world

Beyond the original map lies fog. The world is a grid of **regions** (28 × 25 tiles). Two rings of regions surround the original town on every side, giving 40 regions to discover. The original town never moves: new land to the north and west uses negative coordinates, so every existing coordinate and save stays valid. The map always shows one ring of fog around known land. See §15.

### Pathfinding

Villagers walk tile by tile using A*. Paths and plazas are cheapest; grass costs more; fields are slow. Water, fog, rocks and buildings (except their doors) block movement. If the bridge collapses, the east side is cut off until it is repaired.

---

## 6. Villagers

### Attributes

| Attribute | Range / values | Effect |
|---|---|---|
| Name, age | – | Age 0–15 is a child; 16+ is an adult |
| Gender | Woman or man | Follows the first name; unisex names are settled once at random. Only men have beards. |
| Orientation | Straight (~88%), gay (~6%), bisexual (~6%) | Who they can fall for |
| Profession | See below | Where they work and what they make |
| Personality | Openness, conscientiousness, extraversion, agreeableness, neuroticism (0–1) | Sociability, restraint, stubbornness, gossip spread |
| Traits (2–4) | Frugal, Generous, Greedy, Ambitious, Lazy, Hardworking, Gossip, Shy, Charismatic, Stubborn, Honest, Cunning, Romantic, Cautious, Reckless | Many rules check these. Opposites cannot combine. |
| Values (1–3) | Prosperity, Community, Tradition, Freedom, Order, Nature, Craftsmanship, Family | Voting, platforms, opinions, causes |
| Agenda (optional) | Make a fortune, Win office, Open a business, Find love, Raise a family, Protect the land, Stir up trouble, Bring order, Start over quietly | A life goal that biases behaviour |
| Politics | Economic −1…+1, Order −1…+1, Civic engagement 0…1 | Voting and running for office |
| Intelligence (wit) | 0–1 | Spotting what the town needs, scheming, investigating, avoiding capture |
| Needs | Hunger, energy, social, comfort, fun (0–100) | Drive eating, sleeping and leisure |
| Mood | Valence, stress, named emotion | Happiness; long misery leads to emigration |
| Wallet, inventory | Coins (¢) and goods | Trading |
| Tool condition | 0–100 | Tool users work at half speed with worn-out tools |
| Relationships | Affinity −100…100, trust 0–1, tags | Friend, Rival, Family, Spouse, Lover, Secret, Crush, Coworker, Strained |
| Mind | Memories, beliefs, opinions, trust, knowledge of crimes, legal record | See §11 |

### Needs decay (per game minute)

| Need | Change per minute |
|---|---|
| Hunger | −0.062 (−0.025 on an expedition) |
| Energy | −0.058 awake (−0.1 if sick); +0.21 asleep |
| Social | −0.035 × (0.6 + extraversion) |
| Fun | −0.03 |
| Comfort | −0.024 awake; +0.028 asleep |

When hunger drops below 12 and the villager cannot find food, they "go hungry". This is logged, remembered, and counts toward the week's hungry list.

### Professions

- **Founding trades:** Farmer, Rancher, Butcher, Fisher, Baker, Woodcutter, Miner, Blacksmith, Carpenter, Tavern keeper, Doctor, Merchant, Unemployed.
- **Careers villagers invent when the town needs them:** Musician, Athlete, Journalist, Teacher, Constable.
- **Justice careers (§13):** Investigator, Magistrate, Advocate, Prosecutor.
- **Business staff:** Hotelier, Bath keeper, Showman.
- **Gentry (wealthy, no manual work):** Proprietor, Investor.
- **Children:** go to school.

Starting mix: 9 farmers, 4 ranchers, 3 butchers, 5 fishers, 4 bakers, 4 woodcutters, 4 miners, 2 blacksmiths, 4 carpenters, 3 tavern keepers, 2 doctors, 2 merchants, 4 unemployed. Twelve villagers are hand-written; the rest are generated into households.

---

## 7. A villager's day

Each villager builds a plan for the day at midnight: a list of timed blocks (sleep, eat, work, chores, trade, socialise, leisure, town hall). In civilization mode the plans are spread over the first quarter hour of the day (about a fifteenth of the people each minute, everyone by 00:16), so midnight never stalls the page in a big town.

- **Wake time** depends on the job (bakers 04:30, fishers 05:00, farmers and ranchers 05:30, tavern keepers and musicians 08:00; others about 06:00), plus up to 25 minutes of personal variation. Lazy villagers wake an hour later.
- **Breakfast** at home, then **chores.** One member of each household fetches water from the well each day.
- **The sick** see the doctor.
- **Work** until about 17:30 (bakers stop at 15:00, the hardworking at 18:00, the lazy at 16:30), with lunch at a tavern or at home. Carpenters are sent to building sites. Woodcutters, miners, fishers and farmers may be sent to an annexed region with better resources (§15).
- **Evening:** supper, the tavern, a stroll, sports matches, festivals.
- **Hallday:** town hall at 18:00. Villagers with low civic engagement often skip it.

Plans change for:
- Storms: outdoor workers shelter at home.
- The bridge being out.
- Strikes and protests.
- Trials the villager must attend.
- Jail (the whole day is spent in the cell).
- Community service (sweeping the square).
- Expeditions: explorers walk to a camp at the edge of the known world and disappear into the fog until they return.

Children go to school on weekdays (with a teacher if the town has one), play on the square, watch matches, and are given food money by their parents. Orphans are fed by the treasury.

---

## 8. The economy

### Goods and services

| Good | Made by | Base ¢ | Floor–ceiling | Spoils after | Recipe | Satisfies |
|---|---|---|---|---|---|---|
| Wheat | Farmer | 3 | 1–9 | 45 days | – | – |
| Vegetables | Farmer | 4 | 1–12 | 5 days | – | Hunger 35 |
| Timber | Woodcutter | 12 | 4–40 | – | – | – |
| Iron ore | Miner | 10 | 3–35 | – | – | – |
| Bread | Baker | 6 | 2–20 | 3 days | 1 wheat | Hunger 45 |
| Fish | Fisher | 5 | 1–16 | 2 days | – | Hunger 40 |
| Meat | Butcher | 9 | 3–28 | 3 days | 1 livestock → 6 meat | Hunger 55 |
| Eggs | Rancher | 3 | 1–10 | 5 days | – | Hunger 18 |
| Milk | Rancher | 3 | 1–10 | 2 days | – | Hunger 12, fun 4 |
| Livestock | Rancher | 20 | 8–32 | – | – | – |
| Ale | Tavern keeper | 5 | 2–16 | – | 1 wheat | Fun 20, social 8 |
| Iron tools | Blacksmith | 40 | 15–120 | – | 2 ore + 1 timber | Restores tools |
| Furniture | Carpenter | 60 | 20–180 | – | 2 timber + 1 ore | Comfort 30 |
| Newspaper | Journalist | 2 | 1–6 | 1 day | – | Fun 6; news (§11) |
| Medical checkup | Doctor (service) | 20 | 8–60 | – | – | Comfort 20; treats illness |
| Hot meal | Tavern keeper (service) | 8 | 3–14 | – | Ingredients | Hunger 50, social 10 |
| Bathhouse visit | Bath keeper (service) | 12 | 4–36 | – | – | Comfort 25, fun 10 |
| Theater show | Showman (service) | 15 | 5–45 | – | – | Fun 40, social 15 |
| Home repair | Carpenter (service) | 15 | 5–45 | – | – | Comfort 22 |

### Production

A worker accumulates work minutes and produces one unit (or the recipe's yield) every *N* minutes:

| Job | Minutes per unit |
|---|---|
| Farmer | 40 (60% wheat, 40% vegetables) |
| Rancher | 30 (milk or eggs; the herd also breeds) |
| Baker | 45 |
| Fisher | 70 |
| Woodcutter | 55 |
| Miner | 75 |
| Tavern keeper | 60 |
| Butcher | 90 |
| Blacksmith | 220 (max 3 listed per smith) |
| Carpenter | 150 (max 3 listed per carpenter) |
| Journalist | 80 |
| Unemployed | 95 (timber from odd jobs) |

Modifiers:
- **Farming:** snow ×2 time, winter ×1.4, rain ×0.85.
- **Fishing:** snow ×1.4, winter ×1.2, rain ×0.8.
- **Territory perks** make each unit 20–25% faster.
- **Worn-out tools** double the time.
- **Resource stocks** (timber, ore, fish) slow work as they deplete (§15).
- **Fertile annexed land** speeds farming.

A producer stops once they have 24 units of a good on the market; at autumn harvest, farmers may stockpile up to 45 wheat.

### Markets and prices

Goods are listed on a shared market and bought by whoever needs them. Every hour each price moves toward a target:

```
target = base × ((demand + 5) / (supply + 5)) ^ elasticity × law multiplier
price  = clamp(price + adjust_rate × (target − price), floor, ceiling)
```

- **Demand and supply:** recorded over the last 24 hours. Unsold listings count a quarter toward supply.
- **Spoilage:** perishable listings spoil after their shelf life.
- **Merchants** take an 8% fee on trades of goods they broker.
- **Sales taxes** set by law (capped at 30% in total) go to the treasury.
- **Services:** customers pick the provider where they are standing, otherwise the cheapest competitor.

### Money flows

- **Wages:** paid by the treasury to teachers and constables (8¢ a day), investigators (9¢), prosecutors (10¢) and magistrates (12¢).
- **Staff pay:** business owners pay their staff 8¢ a day; other workers at a business pay its owner a 3¢ lease.
- **Rent:** 3¢ a day for a house (4¢ for an apartment), capped by any rent law. Lodgers pay 4¢ at the tavern or 6¢ at a hotel.
- **Subsidies** and relief come from the treasury by law.
- **Poor dividend:** when the treasury holds over 500¢, half the surplus is shared among the 8 poorest villagers (jailed villagers excluded).
- **Inheritance:** goes to the spouse or eldest adult child, otherwise to the treasury.

---

## 9. Property, construction and social class

### Ownership

Every home, business and plot has an owner (a villager, a team, or the town). Villagers buy and sell on their own:
- Investors buy homes to rent out.
- Newcomers buy plots and hire the carpenters.
- Owners losing a price war sell up.
- The wealthy tear down homes to build palaces.

Plot values: core 160¢, grove 120¢, Southshore 140¢, Eastmarch 130¢, Highcrest 110¢. Frontier regions are priced by soil, beauty and distance.

### What can be built

| Building | Kind | Cost | Days | Notes |
|---|---|---|---|---|
| House | Home | 170¢ | 4 | Up to 5 residents |
| Palace | Home | 950¢ | 8 | The wealthy |
| Apartment block | Home | 600¢ | 7 | 12 residents |
| Hotel | Business | 700¢ | 7 | 12 lodgers, hotelier staff |
| Bathhouse | Business | 500¢ | 6 | Bath keeper staff |
| Theater | Business | 650¢ | 6 | Showman staff |
| Tavern | Business | 320¢ | 5 | Hot meals, lodging |
| Bakery, workshop, forge, butchery, gazette office | Business | 260–300¢ | 4 | Rival shops of a trade |
| Sports arena | Business | 550¢ | 6 | Built once there are 4+ athletes |
| Town jail | Civic | 260¢ | 5 | Only when voted (§13) |
| Town court | Civic | 360¢ | 6 | Only when voted (§13) |

Carpenters work on building sites (up to two per site, with at least one staying at the workbench). A cleared or demolished plot sits as rubble for a day. Protected landmarks (the original tavern, town hall, mine, barn, fish hut and clinic) cannot be demolished.

### Social class

Recomputed daily from net worth (cash plus property):

| Class | Rule |
|---|---|
| Wealthy | Net worth ≥ max(1,500¢, 90th percentile) **and** at least 300¢ in cash |
| Upper | Net worth ≥ max(600¢, 65th percentile) |
| Poor | Net worth below max(100¢, 20th percentile), or under 60¢ |
| Middle | Everyone else |

The wealthy stop manual work once someone can take over their job (an heir, a hire, or a newcomer answering an advert). They become Proprietors or Investors, eat properly, and fund palaces, hotels, bathhouses and theaters. If their money runs out they go back to work.

---

## 10. Government, laws and elections

### Offices

The town elects one **Leader** and a **council of 5**.

- **Timing:** elections are every 28 days. The campaign opens on day 2 of the cycle and polls close on Hallday at 18:00.
- **Candidates:** the 3 adults (aged 21+) with the highest candidacy score run for leader, and 10 stand for council. Candidacy rises with ambition, charisma, civic engagement and wealth, and falls with a criminal record, shyness or a quiet agenda.
- **Voting:** each voter picks the leader candidate who scores best for them. They also back 3 council candidates, and the top 5 win.
- **What a voter weighs:** affinity for the candidate, how well the candidate's platform matches the voter's values, class and agenda, the voter's own opinions (§11), and any scandal the voter believes about the candidate.
- **Who can vote:** jailed villagers and explorers cannot vote.

### Platforms

| Platform | Laws it favours | Appeals to |
|---|---|---|
| Lower taxes, free markets | Timber price cap, farm subsidy | Prosperity, Freedom |
| Bread on every table | Bread subsidy, farm subsidy | Community, Family |
| Protect the land and the lake | Lumber tax, fishing limit, meat levy | Nature, Tradition |
| Order in the streets | Tavern curfew, magistrate, jail, prosecutor, court | Order, Tradition |
| Grow Pixel Town | Annexation, expeditions, market levy | Prosperity, Community |
| Fix the bridge, fill the treasury | Market levy, lumber tax | Community, Order |
| Leave folk alone | – | Freedom, Prosperity |

### Laws the council can propose

| Law | Effect | Lasts |
|---|---|---|
| Lumber Tax | 15% sales tax on timber | 28 days |
| Bread Subsidy | Bakers paid 8¢/day | 14 days |
| Tavern Curfew | Tavern closed 22:00–05:00 | 14 days |
| Timber Price Cap | Timber at 75% of market price | 14 days |
| Meat Levy | 10% tax on meat | 14 days |
| Craft Market Levy | 8% tax on tools and furniture | 21 days |
| Farm Subsidy | Farmers paid 6¢/day while grain is at rock bottom | – |
| Lake Fishing Limit | Fish price ×1.25 so the lake recovers | 14 days |
| Wealth Tax | 2%/day on savings above 500¢ | 21 days |
| Rent Cap | Rent at most 2¢/day | 21 days |
| Relief for the Poor | Unemployed paid 5¢/day | Set on enactment |
| Appoint a Magistrate / Prosecutor | Creates the office (§13) | Permanent |
| Build a Town Jail / Court | Builds it (§13) | Permanent |
| Annex a territory | Claims land (§15) | Permanent |
| Fund an Expedition | Sends explorers into the fog (§15) | One-off |

At most five laws can be in force at once; institutions, annexations and expeditions don't count toward that limit. A law passed while an identical one is in force extends it instead.

### How a proposal becomes law

1. **Drafting.** Between Moonday and Thornsday, if nothing is under debate, one proposal is drafted.
   - Pressing justice needs (a magistrate, jail, prosecutor or court) go first, 70% of the time.
   - Otherwise a councillor proposes a law from their platform.
   - Otherwise the law whose trigger (prices, hunger, treasury, bridge, resources) scores highest is proposed.
   - A rejected law waits at least 7 days before it can return.
   - The first proposal of a new town is always the Lumber Tax.
2. **Debate** until Hallday.
3. **Town hall** at 18:00. Adults at the town hall vote one by one: the proposer first, then officials, then everyone else.
4. **Each vote** combines four parts:
   - Money: 50% (the projected effect on the voter's wallet).
   - Relationships: 30% (how friends voted).
   - Values: 20% (value fit, class stance, opinions, grievances, scandal).
   - Officials: 15% (trusted officials pull votes their way; rivals push them away).
   The result is Yes above +0.1, No below −0.1, and abstain in between.
5. **Result.** The proposal needs a quorum (at least half of eligible voters casting Yes or No) and a majority of Yes over No. It takes effect at dawn.
6. **Enactment and expiry.** The law is enforced, then expires after its duration.

The council can also enact a law directly, without a vote, to settle a strike or calm a protest (see §12).

---

## 11. Minds: memory, beliefs, opinions and trust

Villagers only know what they saw, were told, or read. Nobody knows everything.

### Memories

- **Storage:** each villager keeps up to 24 memories.
- **Importance:** every experience has an importance from 1 to 10, and only those of 4 or more are stored.
- **Source:** first-hand (self or saw), told by a friend, rumour, newspaper, town hall, or court.
- **Weight of each source:** saw 1.0, self 1.0, court 0.9, town hall 0.8, paper 0.75, told 0.65, rumour 0.4. The weight is scaled by how much the villager trusts that source, and stubborn villagers are moved less.
- **Fading:** memories fade daily. Importance 8+ keeps 99.6% a day, 6–7 keeps 98.5%, and lower keeps 95.5%. The weakest memories are forgotten when space runs out.
- **Repetition:** the same event heard again strengthens the memory, and repeated first-hand experiences of the same kind reinforce each other.

### Opinions

Opinions run from −100 to +100 on topics such as:
- the council, the constables, the courts and the justice system, taxes, relief, the poor, the wealthy, landlords;
- expanding the town, nature, safety;
- each individual law, each newspaper, and each person (for people, the opinion is their relationship affinity).

Every experience shifts related opinions. Strong views grow more slowly, and stubborn villagers barely move. Opinions shape voting, protests, careers, crime, trust, migration and support for expansion.

### Beliefs

About once a week, strong opinions (|opinion| ≥ 45) backed by several memories harden into beliefs, such as "The constables protect us" or "The rich get richer at everyone else's expense". A villager holds up to 8. Beliefs anchor opinions, and they weaken and dissolve if experience contradicts them.

### Knowledge of crimes

Villagers keep up to 30 facts of the form "I think X did crime Y, with confidence Z". Contradictory information only changes their mind if it is stronger than what they already believe; otherwise it just lowers their confidence.

### How news spreads

- **Seeing it:** public events are witnessed only by awake villagers within a few tiles.
- **Gossip:** friends pass on memories.
  - Retold stories lose importance: minus 2 when told by someone who saw or lived it, minus 3 when passed on as rumour.
  - A dishonest teller sometimes garbles who was to blame, shifting it onto someone they dislike (5–15% of retellings).
  - Nobody hears about their own deeds second-hand.
- **Newspapers:** journalists print what happened, and journalists with little wit sometimes get facts wrong. Readers learn from the paper and come to trust or distrust it depending on whether later verdicts prove it right.
- **Town hall and courts:** events there are heard by those present.

### Reputation

A villager's reputation is how the town regards them, built from others' opinions and from how many villagers believe they broke the law.

---

## 12. Society: emotions, goals, teams, schemes, careers

### Emotions and goals

Seven emotions (joy, love, pride, anger, fear, sadness, shame) rise with events and fade over time. Grievances build from the villager's cares (hunger, rent, inequality, jobs, a hated law, a disliked leader). Together with their agenda, these set a current goal, such as finding love, belonging, building a fortune, or changing a law.

### Teams

| Team | What it does |
|---|---|
| Co-operative | Pools money to build and own a shop together; shares profits weekly |
| Band | Musicians busking together |
| Sports club | Athletes; the town has a league with matches, fans and gate money |
| Movement | People united by a cause |
| Aid circle | Neighbours sharing money and food |
| Gang | Criminal crews (smuggling) |

### Schemes: changing the town outside the rules

Clever, angry or determined villagers organise:

| Scheme | Outcome |
|---|---|
| Protest | March on the square. The council may give in, for example by granting relief or capping rents. |
| Strike | A trade stops working until settled with a wage top-up. |
| Boycott | Customers shun a business. |
| Recall petition | Enough signatures remove the leader. |
| Citizens' initiative | Forces a law onto the agenda. |
| New institution | Founds a soup kitchen, night school, credit union, lending library or mutual aid circle with their own money. |
| Bribery | Pays officials to vote a certain way (a hidden crime). |
| Black market | Untaxed trading (a hidden crime). |
| Squatting | Occupying an empty home. |
| Sabotage | Smashing up a rival's shop (vandalism). |

Supporters join based on shared grievances, opinions and friends. Risk-averse villagers avoid the crooked schemes.

### Careers

Each day the town works out what it lacks: music, sport, news, a teacher, a constable, a doctor, food producers, justice officials, or builders. Dissatisfied villagers may switch careers to fill a gap (at most two a day, and not within 21 days of their last change). Villagers remember jobs that failed them and avoid them. Essential trades keep at least two workers. The sole investigator or magistrate cannot quit.

### Sports, music and news

- **Sports:** clubs play league matches that draw fans.
- **Music:** musicians busk for tips.
- **Newspapers:** journalists run a paper, print headlines and scoops, and can expose secrets.

---

## 13. Crime and justice

Justice is case-based and emergent. There is no court, jail or detective at the start. Each appears only when the town's history calls for it.

### Crimes

| Crime | Severity | Typical source |
|---|---|---|
| Theft | 2 | Desperate or greedy villagers pickpocketing the rich |
| Burglary | 3 | Breaking into homes |
| Vandalism | 3 | Sabotage schemes |
| Assault | 3 | Quarrels that turn violent (about 3% of heated quarrels) |
| Black-market trading | 3 | Smuggling gangs (hidden) |
| Bribery | 4 | Bribery schemes, and defendants buying judges (hidden) |
| Taking a bribe | 4 | Corrupt officials (hidden) |

Minor quarrels are not cases: a constable present has a 50% chance of breaking them up with a 5¢ fine.

### Cases

Every crime creates a case holding the **hidden truth** (who really did it) and what the town can learn:

- **Witnesses:** awake villagers within 6 tiles may notice. Noticing is harder at night and when the offender is careful. Witnesses can misidentify the offender, especially at night or if they are dim-witted.
- **Physical evidence:** footprints, tools, ledgers, stolen goods, injuries. Evidence can point at the wrong person.
- **Stolen goods** are hidden at the thief's home for about 6 days.
- **Status flow:** reported, investigating, suspect identified, arrest made, charges filed, awaiting trial, in trial, then convicted, acquitted, dismissed or unsolved. A case can also be closed by a constable's fine. Hidden crimes stay unknown until noticed.

### Investigation

- **Who works cases:** constables handle cases alone. Investigators take serious cases, or any case older than 4 days. Each official carries at most 3 cases.
- **Skill:** investigator skill is 0.35 + 0.6 × wit; constable skill is 0.2 + 0.35 × wit.
- **Each day's work:** interviewing witnesses (the shy, and friends of the accused, hold back), finding clues, and, for investigators only, checking motives, opportunity and alibis, and searching for stolen goods.
- **Alibis:** a real alibi clears an innocent suspect; a guilty cunning suspect's fake alibi may fall apart.
- **Confessions:** honest culprits sometimes confess.
- **Suspect score:** witness statements (scaled by credibility), found evidence, motive, opportunity, alibis and confessions. A prior record adds a small bias.
- **Arrest:** when the top suspect reaches the threshold (0.85 for investigators; 0.8 for constables on serious cases and 0.6 on minor ones) and leads the next suspect by at least 0.25.
- **Unsolved:** a serious case goes cold after 21 days, a minor one after 10. It also goes unsolved after 10 days if no one is free to work it.

### Before and after a magistrate

- **No magistrate yet:** the constable decides guilt on the spot and fines the suspect (severity × 18¢, more for repeat offenders), plus restitution to the victim. Friends and doubters dispute the verdict.
- **Magistrate appointed:** arrests lead to charges and a trial two days later. Cases with too little evidence are dismissed.

### Trials

- **Judge:** the magistrate. If the magistrate recuses, the leader sits as acting judge after a wait.
- **Prosecutor:** a prosecutor, advocate or the investigating officer.
- **Defence:** an advocate, paid by the defendant or, if they can't pay, by the town.
- **Verdict:** the evidence score for the defendant is reduced by doubt pointing at others, boosted by a sharp prosecutor, and reduced by a good defence. It shifts slightly with the judge's feelings about the defendant, and a bribe cuts it heavily. Conviction probability is p = 1 − e^(−E).
- **Outcome:** guilty if p ≥ 0.62, or p ≥ 0.5 before a strict judge (one who values Order or is stubborn).
- **After the verdict:** the public's trust in the courts rises or falls depending on whether it matches what they believed. Newspapers that called it right gain trust. Wrongful convictions leave the real culprit free.

### Sentencing

| Sentence | Rule |
|---|---|
| Fine | Severity × 15¢ × (1 + 0.4 × record weight) |
| Restitution | The stolen amount returned to the victim |
| Jail | Only if a jail exists and the crime is serious (severity ≥ 3) or the record weight is ≥ 2: min(20, severity + 2 × record) days |
| Community service | 3 days sweeping the square for serious crimes when there is no jail |
| Removal from office | For bribery or corruption; a corrupt magistrate is stripped of the bench |

Record weight is the sum of severity × e^(−age in days / 180) over all past convictions, so serious and recent crimes weigh most.

Prisoners cannot work, earn wages or dividends, or vote. Property owners still collect rent. Punishment either reforms the offender (more likely if conscientious) or hardens them.

### Conflicts of interest and corruption

Officials check their ties to the parties: family, spouse, lover, close friend (affinity over 65), enemy (affinity under −55), landlord, employer, or political ally. Ethical officials recuse themselves; others proceed with a recorded conflict. If everyone is conflicted, the first takes the case openly. A rich, crooked defendant may bribe a greedy judge; this creates hidden bribery and corruption cases that may surface later.

### Emergent institutions

The council proposes these only when the need arises:

| Institution | Needed when |
|---|---|
| Investigators (a career) | At least 2 serious crimes unsolved, or 3 or more serious cases open (2 once the town has 70+ adults) |
| Magistrate | Constable fines have been disputed and there have been at least 3 on-the-spot fines, or there have been 6 such fines |
| Advocates (a career) | At least 2 trials have been held |
| Prosecutor | A magistrate exists and at least 4 trials have been held |
| Town jail | Someone has at least 2 serious convictions within 150 days |
| Town court | At least 6 trials in 60 days |

An approved jail or court is built as soon as the treasury can afford it and a plot is available. Until then the council sets aside 12% of the treasury each day.

---

## 14. Love, family, birth, death and migration

### Romance

- **Mutual attraction required:** crushes, flirting and courtship need both people to be attracted to each other's gender, at ages 18+ and within 15 years of each other.
- **Courting:** crushes form at high affinity, and mutual crushes lead to courting.
- **Marriage:** a wedding follows after at least **21 days** of courting with affinity of 85 or more. The spouse who owns a home keeps it and the other moves in.
- **Married names:** a woman who marries adds her spouse's birth surname to her own with a hyphen (Ada Reed marrying Tom Cobb becomes **Ada Reed-Cobb**); the chronicle announces it. Her birth surname is remembered, and a divorce restores it. A woman whose surname is already hyphenated, or who marries someone with the same surname, keeps her name. This applies in both modes (civilization marriages as well). Couples who arrive already married keep the names they came with.
- **Appearance palette:** 14 skin tones (light to dark, children can blend between their parents'), 14 natural hair colours plus grey and white, 12 eye colours. Civilization clothing: 6 hide tones, 8 undyed linens, 18 dyes, trousers, boots and undershirts in several shades, and 6 coat colours; classic children wear 12 shirt colours.
- **Unmarried lovers:** couples can become lovers.

### Fidelity and marriage stability (tuned targets: ~15% cheat, ~25% divorce)

- **Who strays:** only about one villager in six is *prone* to straying. Romantic and reckless villagers are likelier; the honest and those who value Family are less likely. Everyone else stays faithful however tempted.
- **Affairs:** a prone married villager who flirts may start a secret affair.
- **Repeat affairs:** after an affair, a villager waits at least 120 days before another, and each later affair is far less likely.
- **Discovery:** affairs heat up as gossip spreads, and sharp-witted spouses find out.
- **After discovery:** the betrayed spouse forgives, divorces, or the cheater leaves for the lover.
- **Poor matches:** about a third of marriages are a poor match. One to four months in they start to sour, the couple is seen quarrelling, and when affection collapses they divorce. Other couples recover from bad patches.
- **Measured rates:** over two simulated years, averaged across seeds, about 24% of marriages end in divorce and about 15% of married villagers stray. The Society tab shows the live figures.

### Births and adoption

- **Who can conceive:** only a woman aged 18–45 and a man aged 18–62 can conceive.
- **Married couples:** about a 2% chance per day, higher with a family agenda. It is lower when poor, when the town is crowded (over 75 or 90 people), in a food shortage, or when a quarter of the town are already children. The limits are 3 children and 6 residents per home.
- **Unmarried lovers** can also have children.
- **Adoption:** married couples who can't conceive, or older couples, adopt when they want children. They take an orphan from town first, otherwise a child from the orphanage in the capital (costs 40¢).

### Death

The daily chance of death is (age − 56) × 0.035% from age 58. It is +1% for someone seriously ill over 45, plus a small workplace risk for miners, woodcutters and fishers. Heirs inherit (§8).

### Migration

- **Leaving:** adults who stay miserable for about 10 days may emigrate (12% chance a day once past that point), taking dependent children. Villagers who believe the town is unsafe leave more readily.
- **Arriving:** newcomers arrive on the King's Road when homes or lodgings are free, sometimes as a couple (whose genders and orientations match) with a child. Each comes with an agenda.
- **Population cap:** about 110.

---

## 15. The frontier: exploration, annexation and resources

### Regions

The fog hides 40 regions in rings around the original town. Discovery reveals each region's attributes:

- **Name:** one of 9 biomes, with a name drawn from its direction.
- **Biomes:** pine forest, rocky highlands, windswept moor, lakeland, reedy marshes, green vale, open plains, old oak woods, rolling hills.
- **Attributes (0–1):** soil fertility, timber, ore, fish, beauty, danger (which rises with distance), and travel difficulty.
- **Map features:** terrain is painted from these attributes (woods, rock outcrops, lakes, pools, marsh channels, flowers). A road is carved back to town, and 3–6 building plots are laid out.

### Expeditions

- **Who sends them:**
  - The player, with the Explore North/South/East/West buttons.
  - The council, through a "Fund an Expedition" vote when land is short, resources are running out, the town is growing, or opinion favours expansion.
  - A wealthy villager keen on expansion, out of their own pocket.
- **Cost:** 50¢ + 40¢ per ring of distance + 15¢ per explorer. A crew of 3 carries 1 day of food each per day of travel (bought off the market) and 1 tool per 2 explorers.
- **Crew:** the fittest volunteers go. The reckless and ambitious are keenest; the cautious and lazy stay home. Officials, doctors, teachers and the gentry are excluded.
- **Duration:** 3 + 2 per ring days, plus up to 2 more.
- **Risks** scale with the region's danger and with any shortage of food or tools. Explorers can be hurt, and occasionally one is lost; the expedition can also fail and come back empty-handed.
- **Return:** explorers come back at 10:00. The discovery becomes news, and explorers and witnesses form opinions about expansion.

### Annexation

- **Discovery does not claim land.** A region becomes *annexable* only when it borders claimed land.
- **Vote:** annexation is a town hall vote.
  - Prosperity-minded villagers favour ore and timber, and farmers, fishers, woodcutters and miners favour land rich in what they produce.
  - Nature lovers resist beautiful wild land, and everyone weighs danger and the treasury.
  - Hunger and overcrowding raise support; the council puts forward the land the town most needs.
- **Cost:** based on distance, resources and beauty.
- **Once annexed:** the region's plots go on sale, its work site opens, and fertile land gets a field.
- **Development:** annexed, then developing (after 7 days or its first building), then **established** (2 buildings, or 45 days of steady work).
- **The frontier moves outward:** annexing a region makes the regions beyond it annexable.

### Resources

The home grounds and every annexed region hold stocks:

| Resource | Home stock | Regrowth |
|---|---|---|
| Timber | 1,500 | Logistic 6%/day + saplings |
| Ore | 4,000 | Almost none (new seams trickle in) |
| Fish | 2,000 | Logistic 11%/day |

- **Depletion:** each unit produced depletes the stock where it was worked.
- **Yield:** work speed falls as stock drops, to 12% of normal when nearly empty.
- **Warning:** a warning goes out when the home stock falls below 35%.
- **Moving outward:** woodcutters, miners and fishers are sent to richer annexed regions (farmers to fertile fields once there are 7 or more).

### Upkeep

Each annexed region costs the treasury 2¢ + 2¢ per ring of distance, plus more for dangerous and remote land, every day. If the treasury can't pay, the region's roads go to ruin (−20% yields), and opinion of expansion falls.

---

## 16. Food security: granary and caravans

- **Granary:** when wheat piles up at a normal price, the council buys the surplus into a town granary, holding up to 10 sacks per villager. During shortages it hands out rations (+40 hunger) at 07:30, 12:00 and 18:30 to anyone hungry, children first.
- **Food caravans:** in a famine (8%+ of the town hungry and little food on the market), a merchant brings bread in along the King's Road at 1.6× the base price. The treasury pays for what the merchant can't afford.
- **Winter stores:** wheat keeps 45 days, and farmers stockpile at the autumn harvest.

---

## 17. Weather, seasons, festivals and the bridge

| Season | Weather odds |
|---|---|
| Spring | Clear 45%, cloudy 20%, rain 30%, storm 5% |
| Summer | Clear 60%, cloudy 15%, rain 15%, storm 10% |
| Fall | Cloudy 30%, rain 30%, fog 20%, clear 15%, storm 5% |
| Winter | Snow 40%, cloudy 30%, clear 20%, fog 10% |

- **Storms** stop outdoor work.
- **Winter** raises illness from 1.5% to 3% a day.
- **Seasons** change the art: blossoms, autumn leaves, snow on roofs and fields.

**The bridge** loses 1.6% health a day (8% in storms). Below 25% it groans; at 0% it collapses and cuts off the grove and the mine. The treasury repairs it automatically below 60% once it holds 400¢, paying the carpenters and buying timber.

---

## 18. Rendering: 2D and 3D

### 2D (default)

- **Ground:** a hi-bit pixel-art ground layer, pre-rendered per season, with soft shorelines, curbs and path edges.
- **Sprites:** y-sorted sprites for villagers, buildings, trees, lamps, stalls and animals.
- **Effects:** day/night lighting with lamp and window glow; rain, snow, fog, lightning and puddles. Night is a dim, moonlit blue that never covers more than half the scene, so buildings and people stay visible (in 3D the moon lights the town and the night sky is lighter).
- **Map:** a minimap that keeps the world's aspect ratio. Fog covers unexplored land, labelled "Unexplored", or "Expedition out" while explorers are on their way.

### 3D (the 3D button)

- **Terrain:** the 2D ground is stretched over a height-mapped terrain with sunken water and raised rocks.
- **Scenery:** real 3D buildings with lit windows at night, and instanced trees and rocks.
- **Villagers:** detailed voxel figures (`civ/civ_3d.js`), in both modes, modelled on a hand-made voxel character sheet.
  - Realistic proportions: an adult is about 37 voxels (six and a half heads) tall, with broad shoulders, a chest (and a bust for women), hips, and legs about half the body's height.
  - Clothing is built in layers: an open short-sleeved shirt with lapels over a lighter undershirt whose hem shows below the belt, a belt with a brass buckle, trousers, and boots with turned-down cuffs, real feet and soles. Most people carry a satchel on a cross-body strap. Coats, aprons (with bibs and stains) and nine hats are variations.
  - A sculpted face: jaw width and nose size from genes, eyes with whites, a coloured iris and a pupil, brows, lashes for women, cheeks, mouth, ears, wrinkles with age and beards.
  - Hair is made of clumped voxels in light and dark strands: short, long, a big clumpy ponytail, bun, curly, spiky or bald.
  - Jointed limbs: shoulder, elbow, rolled sleeve cuff, bare forearm, hand and thumb; hip, knee and boot. Knees and elbows bend as people walk.
  - Variation comes from genes: height, build (weight), jaw width and nose size.
  - Age shows: children grow gradually (from about 45% of adult height), and from their mid-40s people get wrinkles, from 56 grey hair, from 58 a stoop that deepens, and after 62 a slower gait.
  - Tools appear in hand for the work being done: axe, pickaxe, hammer, fishing rod, spear, basket, bucket, hoe, staff, book, flask, medical bag, crate or cooking pot. Tool work swings the arm.
- **Animals:** voxel models with each species' anatomy (cow, pig, sheep, chicken, goat, horse, dog, cat, deer, boar, rabbit, wolf, bird, fish): a body with a lighter belly and back line, a head on a neck, muzzle and nose, eyes, the right ears (side, upright, pointed, floppy or long), horns, antlers, tusks, a goat's beard, a horse's mane, a hen's comb, cow patches and udders, woolly fleece, tabby stripes, a boar's ridge, and the right tail (tufted, long, curly, bushy, puffed and so on). Hooves, paws and feet are darker; chickens stand on two legs. They walk and run with swinging legs, lower their heads on their necks to graze, lie down to sleep at night, flee from people (wildlife), birds flap and fly, and fish jump in open water.
- **Props:** wells, market stalls, lamps, scarecrows, hay, barrels, crates, carts, boats, graves, stakes, signs, scaffolds, rubble, camp fires with flickering flames, sacks, woodpiles, stone piles, oil derricks, weeds and goal posts are 3D models. Crops stand on field tiles and grow with the field; fences have posts and rails.
- **Buildings show their history:** neglected buildings darken and gather weeds and broken fencing; prosperous ones gain an extension and flower boxes; old roofs turn mossy; profitable businesses get a signboard.
- **Interiors:** when the camera is zoomed in close, the building under it opens up (roof removed, walls seen from inside) and shows simple furniture for its kind: beds and a hearth in homes, desks and a board in schools, cots in clinics, benches and flasks in labs, cells in jails, machines in industry, counters and shelves in shops. Interiors are built only when needed.
- **Lighting:** a sun and sky that follow the clock, with soft shadow maps and point lights at street lamps.
- **Volumetric light:** a full-screen pass marches each view ray through the low air (below 7 tiles high) and samples the sun's shadow map. Sunlit haze shows real shafts of shadow from buildings and trees. It is stronger at dawn and dusk and in fog, rain and snow, and street lamps glow with halos at night. Phones use half as many samples.
- **Controls:** drag or WASD to pan, right-drag, two fingers or Q/E to turn, wheel or pinch to zoom, tap a villager to select them. Zooming in close aims the camera at faces.
- **Growing world:** the 3D world rebuilds itself when the frontier grows.

---

## 19. The interface

**The side menu** has six groups along the top, each with an icon: 📜 **Chronicle** (Log, Weekly), 👥 **People** (People, Society), 🌾 **Economy** (Market/Economy, Resources, Land & frontier), 🏛️ **Civic** (Government, Justice), 🔬 **Science** and 🎵 **Music**. Choosing a group shows only its tabs, as pills underneath, and a line under them explains what the tab is for. Each group remembers the tab last used in it, and the page reopens on the last tab. Keys **1–6** switch groups.

**Maximise:** the ⛶ button on the map (or **F**) hides the panels and stats, gives the whole window to the map and asks the browser for full screen. While maximised, ☰ (or **Tab**) slides the side panel in over the map and **Esc** closes it; ⛶/**F** again, or leaving full screen, restores the normal layout.

| Tab | Contents |
|---|---|
| Log | The town chronicle, filterable by importance |
| Weekly | Week-by-week reports, with Markdown export and songs |
| People | Every villager; the inspector shows needs, mood, family, class, work, relationships, memory stream, plan, character sheet, and the mind section (important memories, beliefs, opinions, trust, suspicions, reputation, legal history); add villagers from a template |
| Market | Prices, listings, price history |
| Land | Frontier (resource gauges, Explore buttons, expeditions, discovered regions), territories, the town builder, property list, recent sales. **Click any building or plot name (📍) to find it on the map**: the view centres on it (2D or 3D), a pulsing gold outline and arrow mark it in 2D, and a glowing outline and beam of light mark it in 3D, for about seven seconds |
| Resources | Classic: food in pantries (portions per villager, empty pantries), every good's stock, how many villagers hold it, how long it keeps and its price; the herd; trees standing. Civilization: see section 40 |
| Gov | Leader, council, campaign, laws, votes with each voter's statement |
| Society | Love & family figures (marriages, divorce %, infidelity %, adoptions, genders), newspapers, teams, schemes, institutions |
| Justice | Institutions and officials, jail and court, what the town says it needs, open and closed cases with evidence, statements, recusals and conflicts, and an optional **Reveal the truth** switch |
| Science | Techniques known, theories and how accepted they are, research projects, the settlement's best knowledge per domain (both modes) |
| Music | Soundtrack settings and Suno songs per phase |

In civilization mode the Market tab is called **Economy**, and People, Economy, Land, Gov, Society and Justice show the civilization panels (section 40).

The header shows the clock, date, week, weather and speed buttons. Stat tiles show population, leader, treasury, bridge, mood, herd, laws, next vote, trades, classes and construction.

---

## 20. Logs, weekly reports and music

**Chronicle:** every notable event, with an importance from 1 to 10 and an icon.

**Weekly report** (one per 7 days):
- a headline;
- trades and taxes, treasury, bridge and mood;
- herd and weather;
- the town hall vote with statements;
- laws in force, top earner and spender;
- who went hungry;
- relationships, births, deaths, arrivals and departures;
- property sales, building and demolition;
- society and class mix;
- **Public opinion**, **Justice** and **Territory** lines (shown only when something happened);
- prices and the week's highlights.

Reports can be exported as Markdown; saved log files are named with the year, season, week and day.

**Music:** built-in chiptune themes for dawn, day, dusk, night, the town hall and festivals. Users can add their own Suno songs per phase. The town theme (a Suno song) plays whenever a phase has no song of its own.

---

## 21. What the player can and cannot do

**Can:**
- Watch, follow and inspect any villager.
- Change the speed or pause.
- Pay for expeditions from the treasury.
- Petition the council to annex a specific territory.
- Commission town buildings on town-owned plots.
- List or unlist town property for sale, and demolish unprotected buildings.
- Add villagers from a template.
- Reveal the hidden truth of cases.
- Choose music and switch between 2D and 3D.
- Reset the town.

**Cannot:**
- Decide votes, elections or verdicts.
- Choose who explores.
- Pick careers, spouses or crimes.
- Directly change prices.

The town governs itself.

---

## 22. Save compatibility and automated tests

When an older save loads, the game:

- adds defaults for every new system;
- gives each villager a gender and an orientation that fits their existing marriage (someone with a spouse and a lover of different sexes becomes bisexual);
- seeds broad opinions from each villager's values;
- starts memories from that day, and invents no past memories;
- does **not** retroactively create courts, jails or cases;
- places the fog ring around the existing map without moving anything.

A one-time notice explains what's new.

**Tests** (`node tests/run_tests.js`, each in a fresh page; the classic suite loads `?mode=classic`, the civilization suite loads a seeded new game):

- **Justice (13):** constable fines for quarrels, cases from vandalism, unsolved crimes, suspect identification, disagreeing witnesses, innocent suspects cleared, conviction, acquittal, dismissal, repeat offenders, jail cutting work and income, recusal, corruption.
- **Cognition (12):** witnessing, remembering, learning from a friend and from a newspaper, false rumours, contradictory evidence, gradual belief change, memories changing votes, policies changing opinions, fading and persisting memories, no instant knowledge of distant events.
- **Frontier (16):** exploration cost, exploring in all four directions, fog hiding resources, exploration taking time, regions differing, discovery not being annexation, annexation succeeding and failing, new building space, new resources, rising upkeep, opinions on expansion, the frontier moving outward.
- **Family (2):** only a woman and a man conceive; same-sex couples adopt.
- **Construction and housing (11):** construction companies contracted and paid, evening self-building, building bees, material substitution, buying materials, stalled homes taken over (and stalled upgrades given up), ownerless and unwanted property returning to the settlement, rent-free shelter with children first, being taken in by family or friends, food coming first.
- **Saving (3):** the autosave in IndexedDB and saved cities that list, read back and resume; uncapped away time; daily plans spread over the first minutes after midnight.
- **Lighting and transport (9):** night never pitch black, torches beside paths, better lights needing both technique and town size, old lights replaced in place, lights kept in repair and helping witnesses, vehicles unlocked by techniques (and moving on land, not water), boathouses on the shore, faster journeys and fuller caravans, 3D models for every light and vehicle.
- **Civilization (88):** see section 40, including the civilization-mode justice (CJ1–13), cognition (CC1–12) and frontier (CE1–16) tests, an old-save upgrade test (CS1) and the side-menu and maximise test (UI1).

---

## 23. Known limitations

**Civilization mode:**

- **Fishing dominates early economies** on most seeds: the lake is rich and fishing needs no building. Farming grows through the first two years but rarely overtakes it; different origin peoples and valleys shift the balance but do not remove it.
- **Some seeds starve.** A poor valley or a hard first winter can halve the population; imports and relief help only if the settlement can pay or is liked.
- **Classic towns get only part of the new systems** (minds, knowledge, learning, research, prospecting, neighbours, 3D). Their economy, government and justice still run on the classic rules, because replacing them would change existing towns' history.
- **Neighbouring settlements are abstract:** no roads or caravans are drawn beyond the map edge.
- **Some finance and infrastructure is data only:** bonds, insurance claims, mortgages with foreclosure, pipelines, power stations, transit and fire services exist as definitions (buildings, business types, techniques) but have little or no behaviour yet.
- **Unions, guilds, trade associations and charities** can be represented by the organisation model but nothing forms them yet.
- **Interiors** are generic furniture sets per building kind.

**Classic mode:**

- **Winter food shortages:** these can still occur in later game years in some towns. The granary and caravans soften them, but the town can remain short of farmers.
- **Speech and pronouns:** villagers' speech and many log lines use neutral wording ("they") rather than gendered pronouns.
- **Volumetric light** is tuned for desktop GPUs; phones use fewer samples.
- **Save size:** the save grows with history and is kept within browser storage limits by capping memories, cases, logs and wires.


---

# Part II — Civilization mode

## 24. Design principle

A new game does not start as a working town. It starts as 100 people with crude shelter, personalities, knowledge, needs and free will. Occupations, farms, markets, money, businesses, roads, bridges, mines, schools, governments, courts, banks, companies, stock markets, leagues, hospitals and laboratories exist only if the people create them.

Nothing is triggered by a date or a population count. Each institution grows out of a counter of real events: failed swaps, disputes, thefts, crossings the river blocked, sick people, children without lessons, unpaid debts. The player watches and can inspect everything, but never chooses careers, marriages, crimes, elections or daily actions. Settlements can fail: different seeds grow very different places, and some starve.

## 25. The starting world

| Rule | Value |
|---|---|
| People | exactly 100: 80 adults (16+) and 20 children |
| Households | 13 families with children, 9 couples, and single adults sharing shelters in twos to fours (siblings, friends or strangers) |
| Shelter | one crude structure per household: lean-to, crude hut or shared longhouse; poor comfort (12–20), insulation (8–22), durability (20–35), storage (20–90) and privacy (6–20); starting condition 55–80% |
| Professions | none: every adult is a "Settler" with no job, workplace or career goal |
| Emergency food | a cache of 1,150 smoked/dried and 700 grain (about 6–7 days for everyone), plus 2–7 days of food per household |
| Possessions | vary by household: stone tools, rope, hides, cloth, pottery, shell beads (the richest have up to ~60), sometimes grain |
| Terrain | the river, lake, hills and forests of the classic map, with seeded variety: denser or thinner woods, outcrops, sometimes a pond, and a meadow where they camp |
| Crossing the river | one shallow ford (impassable in the first 12 days of spring and in storms); no bridge |
| Not present | town hall, market, farms, ranches, mine, clinic, tavern, bakery, forge, school, bank, jail, court, arena, government, laws, taxes, money, roads |
| Hidden | 30–50 mineral, oil and gas deposits (section 37) |
| Nearby | 3–4 neighbouring settlements (section 38) |

**Every seed is different.** Each settlement draws one or two **origin peoples** — a farming people, forest hunters, lake-shore fishers, travelling traders, craftspeople from a burned town, refugees from a city of learning, or upland herders — which make some backgrounds (60% of first backgrounds) and values (55% of people) more common. It also draws how rich the valley is: fish ×0.6–1.5, game ×0.5–1.6, forage ×0.7–1.3, soil ×0.7–1.4 and ore ×0.5–1.7. The settlement's **culture** (the share of adults valuing Freedom, Order, Community, Tradition and Prosperity) then shapes how readily it gathers, what form its government takes, whether offices are paid, and whether it taxes.

People differ in knowledge, intelligence, skills, body, personality, values, family and possessions. Each adult has one to three **backgrounds** (farming, herding, hunting, fishing, building, crafts, weaving, cooking, healing, trading, teaching, stonework, leadership, reckoning, bookkeeping, foraging) that set starting knowledge, skills and a few known techniques — never a job.

## 26. Time tiers and performance

The clock is the same as classic mode (2.5 s per game minute). Work is split by how often it needs to run:

| Tier | What runs |
|---|---|
| Every minute | movement, needs, the visible activity, eating; agents far outside the view and not walking update every 4 minutes (low fidelity) |
| Every hour | market prices (8:00 and 16:00), businesses sell the day's output (18:00), moods |
| Every day | weather, spoilage, building wear, health, births, deaths and marriage, learning and discovery, the economy, society, prospecting, trails, and a new plan for everyone |
| Every week | occupations, goals, company decisions, finance and the stock exchange, property, bridges, laws and elections, sport, research institutes, neighbours |
| Every 28 days | roads, stalled projects, migration, economic records |

Every daily, weekly and monthly subsystem runs inside a guard: an error is recorded in `S.civ.errors` and the day continues (the tests fail if any error is recorded).

## 27. People: bodies, minds, knowledge, skills

- **Cognition** replaces the single "wit": reasoning, memory, learning ability, planning, social intelligence, creativity, practical intelligence, attention, emotional intelligence and risk assessment, each 0.05–0.97. Profiles are drawn separately; anyone who would be good at everything loses 0.3–0.5 on four attributes. The old "wit" is now derived from the profile.
- **Knowledge** (0–100) in 25 domains, separate from intelligence: agriculture, animal husbandry, food & preservation, construction, crafts, wilderness lore, medicine, law, finance, trade, politics, teaching, reading & writing, history, geography, technology, and the sciences (mathematics, physics, chemistry, biology, geology, astronomy, engineering, agricultural science, environmental science).
- **Skills** (0–100), 33 of them (foraging, hunting, fishing, woodcutting, stonework, construction, carpentry, farming, herding, cooking, crafting, smithing, weaving, mining, prospecting, medicine, accounting, investing, management, negotiation, trading, law, investigation, teaching, engineering, mathematics, chemistry, biology, physics, research, journalism, athletics, leadership). Each feeds one or more knowledge domains.
- **Techniques** are known per person (section 37).
- **Body:** strength, endurance, dexterity, health (0–100).
- **Genes:** skin, hair and eye colour, height, build, jaw, nose and brow. Children take each colour from one parent and blend the measurements with a little mutation; cognition is also blended. Genes are saved and drive the 2D look and the 3D figure.
- **Clothing** evolves from hides to linen to dyed cloth to coats as weaving, cloth and wealth arrive.

## 28. The decision loop, goals and plans

Every morning each adult runs **Observe → Remember → Interpret → Predict → Plan → Act → Evaluate → Learn**:

1. **Observe:** days of food at home, season, weather, the state of the home, illness, hunger around them.
2. **Remember:** the outcomes of past choices (a running average per task) and what friends said paid off.
3. **Interpret:** how much each good is worth to this household now. Food is worth more when the larder is low; planners also count the coming winter; materials are worth more when their own (or, for civic-minded people, the community's) projects need them.
4. **Predict:** the expected yield of every available task from skill, tools, techniques, season and local abundance. The guess is noisy when the person knows little about that field, whatever their reasoning; memory of outcomes gets more weight with memory ability, and friends' advice with social intelligence.
5. **Plan:** scores add goal bonuses, habit (people known for a trade stick to it), risk aversion (low risk assessment discounts dangerous or uncertain work), laziness, and the household's division of labour (below). Attentive, careful planners pick the best option; others sometimes take the second best.
6. **Act:** the day's blocks (sleep, breakfast, two work blocks, a meal on the spot, water or chores, supper, the evening fire, sleep).
7. **Evaluate:** at the end of a block the actual yield is compared with the expectation, with a reason (picked-over area, scarce fish, no game left, bad season, the storm, injury, no tools, exhaustion, "I have got good at it", luck).
8. **Learn:** the outcome updates future expectations; surprising outcomes become memories.

Every important choice is stored as a **decision record** (situation, objective, action, expected value, actual value, reason) — the last 30 per person, shown in the People panel. Founding a business is recorded the same way.

**Households divide the work:** adults are ranked by food skills; the top half (80% when food is under 1.5 days) provide food; the others fetch whatever the household's projects lack or build once materials are there.

**Goals** come in four levels and are never careers handed out at birth:

| Level | Goals |
|---|---|
| Immediate | secure enough food |
| Short-term | build a home, repair the home, get proper tools, repay a debt, lay in winter stores |
| Medium-term | improve the home, learn a skill, start a field, raise animals, start a business, buy land, improve income |
| Long-term | become wealthy, build a family, become respected, discover something, improve the community, create an organisation |

Long-term goals come from values and personality. Goals are dropped when they become impossible (after 120 days for non-long goals). **Starting a business** is a ten-step plan — learn → gain experience → save → acquire tools → secure property → obtain financing → build or lease premises → acquire inputs → sell → hire — which changes when circumstances change (a founder who cannot raise money gives up; one who can't build leases).

## 29. Work, food and ecology

| Task | Where | Output per effective hour | Notes |
|---|---|---|---|
| Foraging | open ground | berries 2.2, roots 1.1 | season ×0.8/1.3/1.2/0.3; depletes the local 10×10 cell |
| Fishing | shore | fish 2.3 | ×1.6 with rope, ×1.5 with nets; season ×1/1.1/1/0.6; depletes the water cell |
| Hunting | woods | a kill is 26–32 meat plus hides | success from skill, game about, company and fire-hardened spears; 0.4% injury risk per hour |
| Cutting wood | next to a tree | wood 2.4 | fells the tree after 18–31 hits |
| Gathering stone | next to rock | stone 1.8 | wears rock down to sand |
| Gathering reeds | shore | fibre, thatch, clay | |
| Fetching water | shore | 24 per hour | households need one jar per person per day; working by the water counts |
| Preserving, crafting, building, farming, herding, healing, teaching, research, prospecting, mining, trading, working a job, keeping watch | | | sections 30–37 |

Effort per minute = (0.35 + skill × 1.15) × (0.55 + practical intelligence × 0.45) × tools × energy × health, reduced for children, storms (×0.25), snow and rain.

**Ecology:** forage regrows 4.5%/5%/3.5%/0.4% of the gap per day by season; fish 5% per day; game grows about 16% a week toward the cell's capacity and animals wander back into emptied woods. Overuse near the camp forces longer walks, and hunting collapses within weeks without restraint.

**Eating:** three meals from the household store (oldest-spoiling first); when empty, the shared cache (while it lasts), then kin and friends (who share if agreeable or family), then the market once there is money. Hunger under 15 costs 6 health a day; no water for two days costs 8; cold homes in winter cost up to 4. At 0 health a person dies of starvation, thirst, cold or illness.

**Spoilage:** each good loses 1/(perish-days × storage multiplier) of its stock a day (base shelf lives: milk 2 days, berries and fish 3, meat and bread 4, vegetables 9, eggs 12, roots 14, smoked food 90, grain 150); homes slow it slightly, granaries and warehouses a lot. Overfull homes lose food.

**Learning to keep food.** Better storage is knowledge, not a building. Each storage technique stretches how long certain foods keep:

| Technique | Needs | Discovered by | Keeps longer |
|---|---|---|---|
| Storage pits & sealed baskets | food-craft 10, crafts 8 | gathering, foraging | roots ×1.6, grain ×1.4, vegetables ×1.3, berries ×1.2 |
| Salting & curing | food-craft 16, smoking | cooking, fishing, hunting | fish ×1.8, game ×1.7, meat ×1.7 |
| Sealed storage jars | crafts 20, food-craft 16, pottery | cooking | berries ×1.6, grain ×1.5, milk ×1.4, roots, eggs and smoked food ×1.3 |
| Root cellars | construction 20, food-craft 12, well digging or carpentry | building | vegetables ×1.8, roots and milk ×1.6, eggs ×1.5, bread ×1.2 |
| Raised, ventilated granaries | construction 26, agriculture 20, carpentry and cultivation | farming | grain ×1.6; granaries lose 20% less |
| Keeping pests out of stores | biology 16, husbandry 10, domestication or pottery | herding | all food ×1.25 |
| Canning | (section 37) | research | vegetables, meat and fish ×2.5, game and berries ×2, milk ×1.5 |
| Refrigeration | (section 37) | research | all food ×2 |

A household's food keeps longer for every technique **one of its adults** knows (multipliers stack), plus up to 30% more from its best cook's food-craft knowledge. The common store and businesses use every technique **anyone** in the settlement knows. The techniques are found like any other (by practice, research, teaching, talk and parents); when food is rotting (recent spoilage above 25 units) people are twice as likely to stumble on a storage technique while working, and researchers turn to storage questions first once spoilage passes 40.

**Distributing food.** Every morning, after spoilage:
1. **Households short of food** (under 1.5 days) are topped up, the most desperate and those with the most children first, to about 2 days.
2. **Kin and friends share first:** households with at least 5 days of food, at least one generous adult (agreeableness over 0.3, the Generous trait or Community values), and a family tie or friendship (affinity over 30) with the needy household give from their most perishable food, keeping 4 days for themselves. The receivers owe a favour and like them a little more.
3. **The common store rations** what is still missing (up to 1.5 days, extra for children), within the daily ration allowance.
4. **Spare perishables are given away:** a generous household with over 8 days of food gives 60% of any perishable food (milk, berries, fish, game, meat, bread) it cannot eat before it spoils to a hungry household, or to the common store.
The Resources tab shows yesterday's figures and the running totals.

**Health:** illness chance rises with winter, crowding and poor sanitation (latrines, wells, sewage and germ theory lower it). Healers treat the sick and injured.

**Births** need a settled, fed couple (woman and man) with room; there is no population cap.

## 30. Emergent occupations and learning

A person is recognised in an occupation when, over the last 3–5 weeks, one task took at least 42% of their working hours and 24+ hours, and at least two other households relied on the work (bought, bartered, were treated or taught) — or they did it for most of their time for four weeks. The title then rises with skill, knowledge, technique and institutions:

| Occupation | Tiers |
|---|---|
| Forager | Forager → Herbalist (biology 25) |
| Hunter / Fisher | → Master (skill 60+) |
| Woodcutter | → Lumberjack (skill 58, metal saws) |
| Stone | Stone Gatherer → Quarryman (50) → Mason (62, construction 40) |
| Builder | Builder → Carpenter (52, construction 32) → Construction Contractor (runs a firm) |
| Farmer | Gardener → Farmer (42) → Estate Farmer (runs a farm company) |
| Herder | Herder → Rancher (owns a ranch) |
| Cook | Cook → Baker (baking known) |
| Toolmaker | Toolmaker → Smith (smelting) → Blacksmith (60, ironworking) |
| Healer | Healer → Medical Worker (medicine 38) → Doctor (medicine 65 and a clinic or hospital) |
| Teacher | Elder Teacher → Teacher (teaching 35) → Professor (55, a university) |
| Trader | Trader → Merchant (48) → Shopkeeper (owns a shop) |
| Prospector, Miner, Researcher, Watchman, Moneylender | … → Geologist, Mine Foreman, Natural Philosopher, Scientist, Banker |

Occupations lapse when the work stops. Employees take their job title.

**Learning:** skill grows with practice (×(0.4 + learning ability × 0.9), slower near 100), knowledge with it; working beside a mentor ×1.9, beside a parent ×1.5; skills fade slowly without use. Conversation passes knowledge and techniques from the better teacher to the other. Parents teach children a little every day; children of 10+ pick up their parents' techniques. **Mentorships** form between a keen learner (12–40, or with a learn-a-skill goal) and someone 20+ points better who likes them; the mentor's friends become the learner's acquaintances (professional connections). Coaches improve their players. Schools teach by level (section 36), and libraries let literate people read.

## 31. Building, land, farms, ranches, bridges and roads

Everything built is a **structure** from a data table of about 120 kinds: homes (lean-to, crude hut, longhouse, wattle hut, timber cabin, cottage, stone cottage, townhouse, row houses, duplex, boarding house, dormitory, apartment block, residential tower, mansion, estate), food and storage (garden, field, farm, orchard, pen, ranch, barn, drying racks, granary, warehouse, refrigerated store, well), commerce, workshops and industry, retail, hospitality, professional offices, banks and the exchange, education and science, health, government and justice, extraction, bridges, docks, roads, waterworks, sewage, power, transit, sport and leisure. Each lists materials, labour, required knowledge and techniques, and what it provides.

**Projects:** a household, the community, the government or an organisation starts a project on free ground (clearing trees adds labour). Materials come from the owner's stores and from civic volunteers; work progresses only as far as the materials allow; projects without materials for 90 days are abandoned. Finished projects become structures on a **land parcel** with an owner and a value.

**Homes improve only with knowledge, materials and means:** a household without a roof or too crowded builds the best home it can afford (else a crude hut or a longhouse); households that aspire to more upgrade in place or build anew, and the old home is passed to kin, rented, sold or left to decay.

**Fields:** someone who knows cultivation (or has learned it) and whose household worries about food starts a garden or field in spring (or early autumn), using seed grain. Farming is sow → tend → harvest; growth takes about 30–50 days, frost kills unharvested crops, soil tires without crop rotation, and the plough, irrigation and rotation raise yields. Households add fields as harvests pay off.

**Animals:** hunters with domestication sometimes bring back live goats or pigs. Two loose animals (or husbandry knowledge) lead to a pen. Animals have age, sex, health, owner, productivity and offspring; they breed in pens, give milk, eggs or wool, and are slaughtered when pens are full. Dogs and cats come to live with households.

**Bridges:** every trip blocked by the river is counted where it wanted to cross. When crossings pile up, a footbridge, timber or stone bridge (whatever the settlers know how to build) goes up at the narrowest point near the busiest crossing, built by the community, the government, or an investor who charges a toll (unless a law bans private tolls). Owners repair bridges; neglected bridges rot and collapse; a better bridge replaces a failing one and the old one is torn down. There can be several.

**Trails and roads:** each step wears the grass; 55 recent steps turn a tile into a trail, and unused trails grow back. Once road building is known and a government can pay, the busiest trails become roads (and later paved roads) that people walk faster on.

**Anything can change:** structures wear with age and storms, are repaired by their users, can be upgraded, converted (a field into an orchard or pen), subdivided among heirs, sold, rented, abandoned (empty and decaying) and demolished (with some materials salvaged). No structure is protected.

**Property values** follow location (distance to the market), water and road access, bridges nearby, jobs, schools, industry, trees, crime and demand (homeless households, migration pressure), plus the building's quality and condition and a business's profits; a mineral strike makes nearby land speculative for 120 days. Once there is money, homes are listed, sold (through a real-estate office if one exists), rented by landlords, and bought by developers.

## 32. Exchange: gifts, barter, money and markets

- **Gifts and favours:** kin and friends give food and materials; favours owed are remembered.
- **Barter:** at the evening fire two adults compare what their households lack and have spare; a swap happens only if both gain, with negotiation skill tipping the quantities. The spot where it happened is remembered.
- **Money:** when swaps keep failing because nothing matches (90 failed swaps, with 40 successful ones, and shell beads widely held or traders present), shell beads become money: household beads become savings and every good gets a price. Coins replace beads once coinage is known and there is a government or smelting.
- **Market stages:** barter → a meeting place (12 swaps a week, 8 at one spot) → a trading spot (cleared by the community after 25 swaps a week) → market stalls (40 trades or 150 in value a week) → shops (the first business with its own premises) → a commercial district (four shops near the market).
- **Prices** rise when people fail to buy and fall when goods sit unsold; the price level follows the money supply (e.g. after minting gold).

## 33. Organisations, businesses, jobs and contracts

**One organisation model** covers sole proprietorships, partnerships, family businesses, cooperatives, private companies, corporations, public corporations, holding companies, banks, credit unions, nonprofits, charities, guilds, trade associations, unions, sports clubs, leagues, schools, research institutes, the government and the exchange. Each tracks founders, owners and shares, board, manager, staff, cash, debt, stock, sites, revenue, expenses, profit, reputation, share price and an **organisational memory** (successful products, reliable suppliers, good employees, bad investments, profitable locations, failed expansions, lawsuits, lessons). Organisations survive their founders: shares pass to heirs and a new manager takes over.

**Business types** are data (about 50): industry, inputs and outputs per worker-hour, the service sold, required skills, knowledge and techniques, equipment, start-up cost, worker range and compatible buildings — from smokehouses, mills and bakeries to sawmills, smelters, steelworks, textile mills, refineries, chemical works, shops, pubs, inns, hotels, clinics, pharmacies, law offices, banks, newspapers and carting.

**Formation:** once there is money, ambitious or organisation-minded adults look for openings, weighing demand (unmet purchases, prices, service need), competition, their skills and knowledge, capital, property, available workers and inputs. The best opening becomes a ten-step plan (section 28). A founder short of money takes a partner who contributes capital; shares follow contributions.

**Running a business:** staff on shift turn inputs into outputs (bought from the market, or through supply contracts); services are sold to customers who choose by price, quality and reputation; output is listed each evening. Weekly, each business updates its profit and memory, pays dividends or profit shares, hires when demand exceeds capacity, lays off when losing money, cuts prices or improves quality against a more profitable rival, advertises, buys out a struggling competitor, buys a supplier after repeated shortages (vertical integration) or signs a supply contract, opens a second site when profitable, and incorporates when growing and its owners understand shares. A business that runs out of money goes bankrupt.

**Labour market:** employers post jobs with pay, schedule, required skill and location. Applicants compare pay with what they earn on their own, distance, the firm's reputation and conditions, and skill fit; employers pick by skill, credit record, trust and past work. Unfilled jobs raise their wage 8% a week. Employees do the company's work (its mine, field, building site or workshop).

**Contracts** are enforceable obligations: employment, rent and leases, property sales, construction, loans, partnerships, supply agreements, professional services, sponsorship and sports employment. Repeated breaches become lawsuits.

## 34. Credit, banks, shares and bankruptcy

- **Finance stages:** none → informal lending → moneylenders → credit organisations → banks → financial institutions.
- **Informal loans** come from trusting friends and family (family at 0%, others 4%, moneylenders 8%); repayments are weekly. Every borrower has a **credit history** (score, repaid, late, defaulted) that sets later terms.
- **Banks and credit unions** are founded by experienced lenders with finance knowledge, capital and bookkeeping or writing. They take deposits, pay interest, lend at rates set by credit score and their own bad-loan record, and **fail** when bad loans leave them unable to pay depositors (a run returns only part of everyone's savings).
- **Corporations** have 1,000 shares, a board and dividends (35% of profit); share prices follow book value and earnings, nudged by trading.
- **Stock exchange:** founded by someone with finance knowledge once there are three corporations. Investors act on their style: conservative (dividends), growth (rising profits), value (below book value), speculation (momentum) — and dishonest insiders trade on what they know; if insider trading is outlawed and investigators exist, they can be caught.
- **Bankruptcy:** an insolvent person or business goes to court if there is one (else creditors seize informally). A business still making money gets its debts **restructured** (longer terms, half the interest); otherwise it is **liquidated** and creditors are paid pro rata.

## 35. Government and justice from the ground up

Problems are counted as they happen (food, quarrels, theft, blocked crossings, sickness, shelter, spoiling food, injuries, money troubles, newcomers, schooling, water).

**Government:**

| Stage | How it arises |
|---|---|
| Gatherings | problems add up (9 × (1 + 0.8 × freedom − 0.6 × community − 0.4 × order)) and the most respected person calls a gathering at the fire; attendees agree on actions: rationing, food imports, a granary, a common field, drying racks, latrines, a well, a healer's hut or clinic, helping the homeless, a night watch, settling quarrels, a school |
| Council | four gatherings within 28 days, three weeks after the first; its form depends on the settlement's values (council of elders, merchant council, chieftaincy, assembly, …) |
| Leadership | the council cannot keep up with a crisis (food, crime, disputes, growth); the leader's title follows the form (chief, eldest speaker, first merchant, headman) |
| Offices | treasurer (a common purse), watch captain (a watch), magistrate (many disputes) |
| Elections | a legitimacy crisis (an unpopular or missing leader) in a settlement that values having a say and can count; chieftaincies, theocracies and oligarchies may never hold them; then every 8 weeks |
| Laws | answers to problems actually suffered: theft, binding agreements, a land register (needs writing), building standards, insider trading, private tolls, schooling, sanitation, a food reserve, bankruptcy |
| Taxation | offices (paid only where order and community outweigh freedom) or public projects cost money: a hearth, income or trade tax depending on the form, adopted sooner in orderly, communal cultures and later or never in freedom-loving ones |
| Departments | four or more kinds of public service (works, justice, education, health, treasury) and a treasury over 150 |

**Justice:** informal (family smooths things over, retaliation, compensation) → mediation (a respected, emotionally intelligent person settles disputes) → a community watch (agreed at a gathering; deters theft) → a constable (continued theft and a leader) → an investigator (unsolved thefts; can trace thieves, and sometimes follows a mistaken lead) → a magistrate (a heavy caseload) → a court (a courthouse is built when the magistrate falls behind) → jail (repeat offenders) → professional lawyers (skilled advocates who tip trials). Criminal cases (theft from need or greed, fights, insider trading) and **civil lawsuits** (unpaid debts, breach of contract, property and land disputes, partnership and shareholder disputes, fraud, negligence, personal injury, landlord disputes, inheritance, damaged property) record plaintiff, defendant, claim, evidence (written or spoken contracts, investigators' findings), witnesses, damages sought, settlement and judgment. Evidence strength, the judge's knowledge and the lawyers decide outcomes; innocent people can be convicted. How crimes, witnesses, investigations and trials work in detail is in section 41.

## 36. Education, health and sport

**Education:** informal (parents and elders) → a community school (a gathering founds one when there are six or more children and a teacher) → primary (reading and sums, once writing is known and a teacher is literate) → secondary (two teachers and a proper school) → trade school (many apprenticeships) → academy (scholars and money) → college (a library) → university (a laboratory) → research university (three active research projects). Schools are organisations with buildings: they can be expanded, and close (their building is sold) if they have no teachers. Curricula widen with the level. Writing lets the learned write books; ten books lead to a library.

**Health:** healers treat the sick and injured (care quality from skill, herbal remedies, surgery, and theories — the humours theory makes care worse). A settlement with a recognised healer builds a healer's hut, then a clinic once masonry and medical knowledge exist; hospitals need germ theory. Care businesses charge fees once there is money.

**Sport:** children play; young adults play on rest days; regulars form a team around an organiser (with a coach); four teams and an organiser make a league with a weekly schedule, a table, statistics (top scorers), a champion every season, ticket income (once there is money and a pitch), sponsorship contracts from businesses, player contracts and salaries, and transfers to richer clubs.

## 37. Science, technology and resources

**Techniques** (about 60) are known by people, not by the settlement: fire-hardening, smoking, nets, cultivation, domestication, pottery, weaving, carpentry, wells, counting, writing, bookkeeping, coinage, the plough, crop rotation, irrigation, milling, baking, brewing, cheesemaking, quarrying, masonry, the arch, smelting, bronze, ironworking, saws, sawn lumber, shaft mining, the wheel, roads, paving, bricks, glass, optics, goldsmithing, printing, probability, herbal remedies, surgery, pharmacology, germ theory, vaccination, sanitation, plumbing, cement, blasting powder, steam power, steelmaking, mechanical looms, multi-storey and steel-frame building, railways, drilling, refining, industrial chemistry, canning, refrigeration, electricity and the telegraph. Each needs knowledge levels, and many have several possible paths (any of several technique or theory combinations) rather than one fixed tree. A technique is found by practice (someone who keeps doing related work and knows enough may see a better way; creativity and openness help), by research, from neighbours via traders and migrants, or from books; it spreads by conversation, mentoring and parents.

**Science** follows **observation → question → hypothesis → experiment → recording → replication → communication → revision of beliefs**. Curious people with science knowledge and food to spare pick an untested theory or a technique within reach. Experiments support a true theory with probability 0.55 + rigour × 0.4 and a false one with 0.5 − rigour × 0.4, so sloppy work can make a **wrong idea popular** (the humours, bad air, phlogiston, moon planting, dowsing, a flat-stone earth). Rigour comes from reasoning, mathematics, writing and laboratories. Results move the community's acceptance (weighted by rigour, written records and replication) and individual beliefs (against stubbornness); later careful work can overturn an accepted idea. Accepted theories unlock techniques (combustion → ironworking and explosives, germs → germ theory and canning, heat → steam power, …) or change outcomes (miasma improves sanitation for the wrong reason). Researchers who keep working found institutes and laboratories.

**Resources:** copper, tin, iron, coal, lead, zinc, nickel, silver, gold, platinum, gemstones, salt, rare minerals, clay, oil and natural gas lie hidden, each deposit with a size, depth (1–6), purity and accessibility, placed by kind (outcrops, hills, streams, flats, seeps). Prospectors find them with geology knowledge and skill, visible clues (rock, streams, oil seeps), theories (ore veins help, dowsing hurts), depth reach from technique, time and luck. A find is only **claimed** (registered if a land register exists, else staked — and a rival may dispute an unregistered claim on something valuable). Then: a person with some mining knowledge digs a **private pit** in shallow ground; otherwise the finder has to found a mining company (capital, equipment, workers), which builds a quarry, open pit, shaft mine or deep mine depending on depth and technique. Mines yield ore by purity until worked out; accidents injure miners. Gold and silver become coin once there is a mint.

**Oil and gas:** a seep is at first just black ooze of no known use. With drilling (geology and engineering, steam power or ironworking with the oil-origin theory), oil companies drill exploratory wells near seeps (geologists and the theory aim better) or at random: dry wells lose money and are remembered; a strike makes the deposit known and claimable, then oil and gas wells, refineries (kerosene and fuel), and chemical works follow. A precious-metal or oil strike causes a boom: land speculation, migration, new companies.

## 38. Neighbours, imports and migration

**Neighbouring settlements** (3–4 of Westford, Saltmere, Ironhold, Dunmoor, Greyholm) are simulated simply: population, food stock and production, resources, industries, prices, wealth, government form, known techniques and relations with Pixel Town. Their food rises and falls with the seasons and occasional failed harvests; shortages raise their prices.

**Trade and knowledge:** traders take caravans every two weeks, selling surplus for the neighbour's goods and bringing back techniques.

**Emergency food imports:** when the settlement runs short, a gathering or the government asks for quotes. Price = 1.1 × (1 + scarcity) × (1 + urgency × 0.4) + 0.12 × distance per unit; neighbours sell only above 14 days of their own food. It is paid from the treasury, the community fund or pooled goods (beads, hides, cloth, tools, metals). Shipments take the travel time (plus 3 days in winter, 1 in a storm), can be lost on the road (4%), and go to the common store. In a famine, a friendly neighbour may send free relief.

**Strategic reserves:** with a granary or warehouse, surplus grain is bought from full households in autumn (more under a food-reserve law) and handed out as rations in shortages; rationing tightens when the cache runs low.

**Migration** is reviewed every 28 days. Households in real hardship (little food, no home, deep unhappiness, prolonged hunger) weigh staying (food, home, work, kin, mood, the settlement's pull) against the best neighbour minus a moving cost; at most two leave a month. Neighbours send newcomers in proportion to how the settlement looks from outside: food, homelessness, open jobs, wages, crime, schools, healers, taxes and opportunity (strikes, businesses). Newcomers bring their hometown's knowledge, skills and techniques. There is **no population cap**: growth stops only when food, housing, work, health or land run out.

## 39. Classic towns: what they gain

Old saves keep every building, profession, institution and history. From the first load:

- every villager gets a cognitive profile, genes, knowledge, skills and techniques inferred from their profession (farmers know cultivation and the plough, merchants writing and coinage, doctors herbal remedies and surgery, …), and "wit" becomes a view of the profile;
- a day's work at a trade is practice that raises the matching skill; techniques can be discovered by practice;
- each week the three most curious adults do research (theories, techniques), and miners and the curious prospect the hills for hidden deposits;
- neighbouring settlements appear and trade news; the **Science** tab shows what the town knows;
- the 3D view uses the new low-poly villagers, animals and props.

The classic economy, government and justice keep their own rules (sections 8–13).

## 40. Civilization mode: interface, saves and tests

**Header tiles:** settlement stage (Camp → Hamlet → Village → Town → City → Major city, from population, organisations, structures, market, government and techniques), population, food in store (days), the cache, market stage, money, government stage and leader, justice stage, education stage, techniques known, organisations, building sites.

**Panels:** People (occupation, work, skills; the inspector shows the mind profile, knowledge, skills, techniques, goals with their steps, decision records, beliefs, memories, genes, mentor and protégés, job, credit), Economy (market and finance stages with dates, money, prices, organisations with owners and memory, the exchange, jobs, loans, contracts), Land (projects with materials and work, structures by kind with condition, value and owner, resources found, animals, game, trails and roads; every building, site and find can be clicked to locate it on the map), Resources (food by type with person-days and where it is kept — homes, the common store, businesses — with a weekly trend; storage used and capacity; food spoiled yesterday and saved by storage know-how; each storage technique and how many know it; yesterday's food sharing, rations and donations; animals kept by kind; wild game, fish and wild plants against their capacity; trees standing and felled; building materials; ores and minerals with every known deposit, what is left and what has been dug; energy; made goods; water. A snapshot is kept every week for the trend lines), Gov (stage history, form, leader, council, offices, laws, taxes, elections, gatherings and decisions, current worries), Society (households by food, education, sport and the league table, neighbours, shipments and quotes, migration, relationships), Justice (stage history and every case), Science (techniques and who first knew them, theories and acceptance, research, knowledge).

**Map:** hover shows structures (owner, condition, value, crop or herd), projects, the fire and cache, the ford, known deposits and seeps. The 2D map shows the camp fire, cache sacks, ford stones, oil seeps, stumps, woodpiles and stone piles, weeds on neglected buildings, building sites, pens and wild animals that flee from people.

**Saves:** plans and walking paths are not saved (they are rebuilt on load). To keep saves well inside browser storage as the settlement grows, each week every person keeps their 30 strongest relationships, 18 most recent memory-stream entries, 10 decision records and 24 most recent customers per trade; each day their mind keeps at most 14 memories (the most important plus the last three days, with retelling details dropped after five days) and at most 12 beliefs about who did what; closed cases older than 60 days keep their outcome but lose the investigation details. Saves over 150,000 characters are **LZW-compressed** into UTF-16 text (about 5–6× smaller; a 3.5 MB town stores in about 0.6 MB). Older, uncompressed saves load as before. When a save takes more than 150 ms, autosave runs every 45 seconds instead of every 15. `S.mode = 'civ'` and everything new lives under `S.civ` (households, structures, projects, parcels, tile edits, ecology, deposits, techniques, theories, research, economy, organisations, jobs, contracts, government, justice, education, sport, neighbours, shipments, migration, animals, stats) and `citizen.civ` (cognition, knowledge, skills, techniques, genes, body, health, occupation, work log, customers, expectations, decision records, goals, beliefs, credit, investor style, mentor, job). The world is rebuilt from the seed plus the saved tile edits and structures. Old classic saves gain `S.civ` (overlay) and `citizen.civ` with defaults.

**Tests** (`tests/civ.tests.js`, seeded): the exact starting population; 80 adults and 20 children; no professions or career goals (with real variety in minds, knowledge and possessions); no businesses; no government, justice or school; no farms; no ranches; no mine and hidden resources, no bridge; only crude housing; occupation recognition (including healer → medical worker); occupations in a free-running settlement; business creation from opportunity; the market progression; money from failed barter; learning from practice, parents and mentors; school formation; knowledge separate from intelligence and the science disciplines; research through the scientific method with wrong theories and new techniques; food-shortage detection; buying food from neighbours (and no food from starving ones); shipments arriving; bridges built and demolished; farms and ranches built, converted and demolished; a private mine; prospecting; a precious-metal strike; oil found by drilling and dry wells; migration-driven growth; growth past 110; partnerships; corporations and dividends; stock ownership and the exchange; loans and credit history; a civil lawsuit judged; bankruptcy by liquidation and restructuring; government emerging from problems; justice from mediation; 3D animals with persistent attributes; inherited, saved appearance with visible growth and aging; hyphenated married names restored on divorce; storage techniques that measurably cut spoilage; food shared by kin and rationed by the common store; the resources tab; locating a building from the land tab; detailed voxel people and animals and the wider palette. Justice (CJ1–13): a brawl fined on the spot, vandalism cases, unsolved crimes, suspects found from witnesses, disagreeing witnesses, alibis clearing the innocent, conviction, acquittal, dismissal, harsher sentences for repeat offenders, jail stopping work and hiring, recusal, bribery and its discovery. Cognition (CC1–12): witnessing, lasting memories, news from friends and newspapers, false rumours, contradictory information, gradual beliefs, scandals changing votes, taxes changing opinions, fading and lasting memories, no instant knowledge of distant events. Frontier (CE1–16): expeditions needing supplies, exploring in each direction, fog hiding resources, exploration taking time, regions differing, discovery not being annexation, annexation passing and failing, building room, new resources, upkeep, opinions on expansion, the frontier moving outward. Plus old-save upgrading (CS1) and the side menu and maximise button (UI1).

---

## 41. Civilization mode: crime, investigation and the courts

The world always knows who really did something (`case.actual`). Nobody in the settlement does: witnesses, investigators, judges and the public only have what was seen, said and found. The **Reveal the truth** switch on the Justice tab shows it to the player.

**Crimes happen at a time and place.** Each day some people decide to steal (from hunger, or greed if Greedy or Cunning) or to damage the property of someone they hate (affinity −45 or worse, disagreeable). What they have learned changes the chance: getting away with it makes it likelier (up to 2.2×), and punishment they accept makes it less likely, as does a record. The deed happens later that day: thefts between 10:00 and 16:00, vandalism usually after dark. Deterrence comes from the watch, a constable and a theft law.

**Witnesses.** Everyone awake within 7 tiles of the scene, nearest 14 first, may see it. The chance depends on daylight, distance and attention. A witness may:

- put the right name to the face (more likely with attention and familiarity);
- name the wrong person (someone else nearby, or someone they already dislike), with a confidence that reflects this;
- only notice someone about.

Friends and family of the accused tend to keep quiet. Some witnesses come forward at once; the rest wait to be asked. Every witness gets a first-hand memory and a belief about who did it.

**Quarrels at the fire** are still settled on the spot. If a constable or watchman sees the fight and nobody is hurt, the one who started it is fined or made to apologise (a minor record entry). Only if someone is hurt does it become an assault case, and the victim's own account names who hit them.

**Investigation.** The investigator, or else the constable or watch captain (the victim, before there are any), works the case each day:

- **Interviews** turn waiting witnesses into statements; witnesses loyal to the accused may refuse to talk.
- **Alibis:** an innocent suspect usually has one or two people who saw them elsewhere. A guilty, Cunning suspect may get a friend to lie, and a careful investigator can break the lie, which counts against them.
- **Searches:** the thief's store may hold the stolen food. An innocent pantry sometimes holds the same kind of food, as weaker, misleading evidence.
- **Motive:** a hungry household, or bad blood with the victim.

Suspects are ranked only from this information (statement confidence × the witness's credibility, evidence, minus alibis). A suspect is **named** at 45% with a clear lead, **cleared** if their score falls below 20% (a record entry and a memory), and **arrested** at 55% once there is a constable. Cases nobody can crack go **unsolved** after 40 days, and the offender remembers getting away with it.

**Rough justice.** With constables but no magistrate, the constable decides guilt and punishes (a fine or days of work). If the accused denies it (always if innocent) and has friends or family behind them, the verdict is contested. Three contested verdicts make people say constables should not decide guilt themselves, and the settlement appoints its first **magistrate**.

**Charges and trials.** With a magistrate:

1. A case with evidence strength of 30% or more is **charged**; a weaker one is **dismissed** after four days.
2. The case waits two days (**awaiting trial**) while investigation continues.
3. It is heard by the magistrate, or tried at the courthouse once there is one.

With professional advocates:

- the defence lawyer weakens shaky witnesses (confidence under 55%) and motive-only evidence;
- a **town prosecutor** is appointed once there have been three criminal verdicts in eight weeks;
- a better-paid lawyer still tips the balance.

The judge sees only the evidence. Skill (law knowledge and reasoning) reduces the chance element, but wrongful convictions and guilty people walking free both happen. Contradictory witnesses weaken a case.

**Conflicts of interest.** A judge or investigator who is married to, family of, a close friend of (affinity over 60), at odds with (under −50), or in business with a party has a conflict. Honest or conscientious ones (and not Greedy or Ambitious) **step aside** and another respected person sits. Others judge anyway, with a thumb on the scale, and people may notice, which lowers trust in the courts.

**Bribery.** A Cunning or Greedy defendant with money may offer a bribe. A bent official (not Honest, and Greedy, Cunning or careless) may take it, tilting the case. An honest one reports it, and that becomes an attempted-bribery case. Hidden bribes come out later, faster with an investigator or a newspaper. The official is charged and removed from office, and people lose trust in the courts and leaders.

**Sentencing** weighs severity (theft 4, vandalism 3, assault 5, bribery 6) and the record (severity × recency, fading over about six months):

- **Warning:** a first minor offence.
- **Restitution:** stolen food is returned, twice over under a theft law.
- **Fines.**
- **Community service:** the morning's work goes to a public project or the common store.
- **Removal from office:** for bribery.
- **Jail:** if there is one, for serious or repeat offences, 3 × severity days scaled by the record, up to 40.

**Jail** takes the whole day: no work, no wages, no vote, no gatherings, no hiring. A record lowers hiring chances and, once people know about it, votes. The wrongly convicted and their families remember it and lose faith in the courts.

**Institutions grow from need:**

- **Investigator:** four unsolved cases, or three serious unsolved ones, with an able, clean-record person to take the job.
- **More constables:** crime outrunning them (one per 60 people).
- **District constable:** a district whose residents keep being victims.
- **Magistrate:** contested rough justice, or a heavy caseload.
- **Courthouse:** too many open cases.
- **Jail:** repeat offenders whom fines do not stop.
- **Advocates and a prosecutor.**

---

## 42. Civilization mode: memory, beliefs and opinions

Civilization settlers use the same mind as the classic town (section 11): memories with a source and confidence, beliefs formed from repeated memories and a strong opinion, opinions about topics and people, trust in sources, and beliefs about who did what. It is fed by what settlers actually live through:

- **Lived:** going hungry ("I went hungry during the winter food shortage"); rations from the common store; food shared by a neighbour's household; being robbed; being fined, sentenced, cleared or wrongly convicted; taxes paid; having no roof; land becoming too dear; the woods being cut down (for those who value nature); a quiet month making people feel safer.
- **Seen:** crimes, fights, arrests and verdicts, expeditions leaving and returning, protests.
- **Heard at gatherings:** what was discussed and agreed.
- **Word of mouth:** at the evening fire people pass on memorable news the listener hasn't heard. Gossips pass on more, and a dishonest teller sometimes garbles who did it toward someone they dislike.
- **Newspapers:** once a newspaper business exists, each week it prints the week's public events and major happenings to readers who can read (literacy 8+). A careless paper sometimes prints the wrong name. When a verdict comes out, people whose paper or gossip pointed at someone else trust that source less; those who got it right trust it more.

Only witnesses, the people affected and those who later hear or read about something ever learn it.

**What it changes:**

- **Votes:** each candidate stands for their two strongest issues (safety, the constables, the courts, relief, taxes, expansion, nature, the leaders), announced in the chronicle. Voters weigh how much they agree, what they believe the candidate has done (a known scandal costs heavily), and, for the sitting leader, the hunger, theft and wrongs they lived through, less the help they got. Family and close friends then talk each other round.
- **Protests:** once a week, for any issue where at least eight adults feel strongly (opinion ±40), those who have lived it or firmly believe it may march, and their close friends may join. It takes at least eight people (7% of adults). A protest is answered according to the grievance:
  - a constable with contested rough verdicts is replaced;
  - taxes are cut by a fifth;
  - an early election is called (against the leaders, if there are elections);
  - a magistrate most people believe corrupt steps down.

  Marchers remember it and grow closer.
- **Migration:** discontent (feeling unsafe, distrusting the leaders or courts, lived hunger, crime or wrongful conviction) makes a household readier to leave.
- **Hiring:** a record counts against a candidate.
- **Crime:** getting away with it, or being punished, changes the chance of trying again (section 41).
- **Expansion:** annexation votes (section 43).

**The profile** (People tab) opens on the settler's mind:

- **District** they live in.
- **Important memories:** each with its source (🧍 lived, 👁 saw, 🗣 told, 💭 rumour, 📰 paper, 🏛️ gathering, ⚖️ court), plus when and from whom.
- **Beliefs.**
- **Opinions** as plain sentences ("Strongly distrusts the constables").
- **What they would campaign on.**
- **Trust** in the leaders, constables, courts, gossip and papers.
- **Suspicions** about who did what.
- **Reputation.**
- **Legal history** and record weight.

A **show the numbers** switch reveals the raw values.

---

## 43. Civilization mode: the frontier

**The known world** is the valley the settlers camped in (the original 110 × 50 map). Around it, in every direction, is mist: an unknown region grid of 28 × 25 tiles per region, reaching six rings north and west and more to the south and east. Nothing about a region (terrain, soil, timber, fish, ore) is known until it is explored.

**Expeditions** target the nearest unmapped region in a direction.

**Cost:**

- three people, fit and free to go;
- 3 food units per person per day, taken from the common store, the sponsor's larder, or what well-stocked households can spare beyond five days (they remember giving);
- one tool per two people;
- coin from the treasury once there is money.

**Duration and risk:**

- **Duration:** 3 days + 2 per ring, +2 in winter, +1 in a storm.
- **Risk:** grows with the ring, winter, the region's danger and any shortfall in food and tools.

**While away** the crew camps at the edge of settled land, eats what it carried, and cannot work, vote or be witnessed. On return, some may come back hurt or not at all. The expedition can fail and map nothing. Otherwise the region is **discovered**:

- It gets a name ("Frosttor", "Silvervale", "Thistlepines"), a biome and attributes (fertility, timber, fish, ore, danger, beauty, travel), and a count of home sites.
- It is painted onto the map.
- It gets its own forage, game and fish cells and hidden mineral deposits.

Whoever is in camp hears about it and forms a view of that land.

**Who sends them:**

- **the player** (Land & frontier tab: each direction shows days, food and tools needed against what can be spared, coin, risk and crew, or what is missing);
- **a gathering**, when "running out of land" is among its top problems and there are at least five days of food;
- **a restless settler with money** paying for it;
- **a volunteer household** with at least eight days of food, when land pressure is real (at most one every four weeks).

**Land pressure** is counted each week:

- no building site could be found for a household;
- land near the camp costs over 14;
- forage below 40% of capacity;
- game below 30%;
- fewer than about 1,600 trees left in the valley;
- more than 140 people.

Explorers head toward what is short: south for fish, north or east for timber, west or south for farmland. They avoid directions where mapped land is still unclaimed or was voted down.

**Discovery is not annexation.** A region must border settled land to become **annexable**. It is then **proposed** by a gathering's convener, by the player (a petition) or automatically when land runs short. It is decided at the next opportunity:

- by those who come to gatherings, until there are elections;
- by every free adult once there are.

Each voter weighs:

- their own need: no home (+25), a crowded home (+12);
- their trade: farmer, woodcutter, fisher, miner or hunter matched to the land;
- their expansion opinion and view of that region;
- the land's quality;
- nature values against the land's beauty and timber;
- tradition;
- danger;
- the upkeep and taxes;
- how much they like the proposer.

It passes on a simple majority if the treasury can pay the one-off cost ((10 + 10 per ring) × money level). A failed region waits eight weeks before it is proposed again.

**Annexed land** opens up:

- **Building:** when the valley is full, new homes, farms and businesses are sited in districts, nearest first.
- **Work:** forage, hunting, timber, fishing and prospecting reach the districts when home grounds are worked out.
- **Access:** a worn track to the settlement.
- **Further expansion:** the next ring out becomes explorable, and mapped land that now borders it becomes annexable.

A district goes **annexed → developing** (first structure) → **established** (4 homes or 20 residents). People who move there remember that it gave them land of their own.

**Costs:** each district costs upkeep every day from the treasury: (1 + 1.2 per ring + 2 × danger + 1.5 × travel) × money level. If the treasury cannot pay, the track goes to ruin and it becomes a problem the settlement notices. Districts of 15 or more people that are far from a healer, or that keep having crimes, complain; the latter get their own constable.

**Resources run down and recover:** forage, game and fish regrow by season in every district; trees regrow from stumps near woods; ore deposits are finite.

**Saves and maps:** mapped regions are stored with their seed and rebuilt identically on load. Tile keys decode correctly for negative (north and west) coordinates. The 2D map, minimap and 3D view show the fog and each new region.

---

## 44. Civilization mode: construction and housing

**Why this exists.** Before this, only about two in five projects were finished. Houses with every material to hand sat half-built for months, and families slept outside. The reasons:

- people with jobs never built;
- construction companies never got a client;
- a plank nobody could make held a house up for a year;
- nothing gave priority to families with no roof;
- empty homes rotted, unaffordable, while those families stayed homeless.

**Who builds:**

- **The household itself.** The household's builder works on its project during the day. Everyone else in the household, employed or not, spends an hour after work on it (from 17:15). The rest day goes to it too, once most of the materials (60%) are there. A home with everything to hand gets a strong push to be finished. People with no roof put their own home first.
- **Building bees.** Neighbours help build a home for a family with no roof once it has 40% of its materials. Those most willing are family, friends, community-minded and agreeable people, and helping families with children counts extra. The family remembers who helped and likes them more.
- **Construction companies.** They take on work from paying owners:
  - public works;
  - homes for families with no roof;
  - any project that has stalled for five days with at least half its materials.

  The owner pays by the hour, or the treasury does for public works and homes for the needy. Idle staff build public works or cut timber, and the company supplies its sites from its own stock. A company only keeps two hands plus three per contract and lets idle people go.

**Materials:**

- **Buying:** after three days of waiting, a household with money buys what its project lacks at the market (at up to 1.6× the usual price).
- **The common store:** public projects and homes for the needy draw on it.
- **Donations:** community-minded people's surplus timber, stone and thatch goes to public projects and to homes for the needy.
- **Making do:** if a material cannot be had for two weeks (nobody gathers it, nobody makes it, there is none in stock), the builders use something else:

  | Missing | Used instead |
  |---|---|
  | Lumber | Wood × 1.5 |
  | Metal | Wood × 2 |
  | Steel | Wood × 2 and stone |
  | Brick | Stone × 1.2 |
  | Glass | Fibre |
  | Cement | Clay × 1.5 |
  | Rope | Fibre × 2 |

**Priorities:**

- A family with no roof can always start a home.
- In a housing crunch (four or more families without a roof) that home is the cheapest shelter first, a lean-to.
- While anyone is homeless, households only upgrade if they already have almost everything they need.
- When three or more families have no roof, a gathering raises a **shared longhouse** owned by the settlement.

**Stalled projects** (45 days without progress):

- a home for a family still without a roof is **taken over by the settlement**, so contractors and neighbours can finish it;
- stalled upgrades and non-home projects are **given up**, and their materials go back to the owner.

**Food comes first:**

- A household with under two days of food builds much less; under one day, hardly at all.
- Building bees only happen when the helpers have five days of food at home.
- In autumn and winter with under 10 days of food, or any time under 3:
  - bees and public contracts pause;
  - the treasury keeps enough to buy food before paying builders.
- **Hiring freeze:** businesses that do not produce food stop hiring when the settlement has under three days of food. Below a day and a half they let a worker go each week to help feed their family.
- **Food before work:** an employee whose household has under a day of food usually spends the day finding food instead of going to a non-food job.
- **Wary newcomers:** they stay away from a settlement that cannot get through the coming winter, has no land left to build on, or where many families have no roof.

**Abandoned property returns to the settlement.** A building passes to the settlement (the government once there are offices, otherwise the community) when:

- its owner is gone: the household has died out or left, the person is dead, or the business has closed; or
- it stands empty for three weeks and is unsold, abandoned or, before there is money, unwanted.

Any lease ends, and a building falling apart but still standing is put back in use. Businesses can no longer let good buildings rot while people need them.

**Sheltering the needy:**

- **Rent-free shelter.** Every day, town-owned homes go rent-free to families with no roof, those with the most children and those homeless longest first. A shelter can take several families up to its capacity (a longhouse holds 12). The common store's timber patches a run-down shelter. Sheltered homes are never sold or let while someone lives there.
- **Taken in.** A single person or a couple with no roof is taken in by relatives, or by friends or community-minded neighbours with room.

**On screen:**

- **Housing card** (Land & frontier tab): who has no roof and for how long, how many were taken in or sheltered, properties returned, and every town-owned home with its residents.
- **Project list:** each project shows who is building it and how long it has gone without progress.

---

## 45. Civilization mode: street lighting and transport

**Night.** Nights are dim and blue rather than black: the 2D darkness is capped at half the scene, even in a storm. In 3D the moon lights the town with a soft, cool light and the night sky is lighter.

**Street lights.** The settlement (the government once it has offices, otherwise the community) puts up lights beside paths and doors, starting with the darkest spots: the fire, then the doors of homes and public buildings. Lights stand at least three and a half tiles apart. There are about one per five people, plus three more for each step up in town size (up to 70). At most three are built at a time. None are built while three or more families have no roof, when food is short, or late in the year with little stored. Each new kind needs both a technique and a big enough town:

| Light | Technique | Town size | Reach | Materials |
|---|---|---|---|---|
| Torch post | none | camp | 2.5 tiles | wood |
| Oil lantern post | Pottery | hamlet | 3.25 tiles | wood, clay |
| Gas street lamp | Gas lighting | village | 4 tiles | metal, glass |
| Electric street light | Electricity, plus a power station | town | 5.25 tiles | steel, glass |

Once a better kind is available, old lights are replaced where they stand, starting in the middle of town. The town keeps its lights in repair; they never count as abandoned. Only the first light of each kind appears in the chronicle. **Effect:** at night, a crime on a lit street is seen as clearly as by day: witnesses notice more and are more certain of who they saw.

**Transport buildings.** One at a time, when the settlement is fed, housed and not in the depths of winter:

| Building | Technique | Town size |
|---|---|---|
| Stable | Horse riding | hamlet |
| Boathouse (on the shore) | Boatbuilding | hamlet |
| Shipyard & harbour (on the shore) | Sailing ships | village |
| Power station | Electricity | town |
| Railway station (with a track along its front) | Railways | town |
| Airfield | Powered flight | town |

**New techniques:** Gas lighting, Horse riding, Boatbuilding, Horse-drawn wagons, Sailing ships, Steamships, the Combustion engine, Motor cars and Powered flight. Like every technique, they are found through research or practice, or brought in by traders.

**Vehicles.** What the town knows decides what moves about it, in 2D and 3D:

| Vehicle | Needs | Where |
|---|---|---|
| Handcarts | The wheel | paths |
| Riders on horseback | Horse riding | paths and open ground |
| Horse-drawn wagons | Horse-drawn wagons | paths and open ground |
| Rowing boats | Boatbuilding | river and lake |
| Sailing ships | Sailing ships and a shipyard | open water |
| Steamships | Steamships and a shipyard | open water, with smoke |
| Steam trains | Railways and a station | the track, stopping at the station |
| Motor cars and lorries | Motor cars (lorries in a town) | roads only |
| Aeroplanes | Powered flight and an airfield | across the sky |

There are more vehicles as the town grows, and newer kinds replace some of the old (cars replace some riders). Riders, carts, wagons and boats stay in at night. Cars, lorries and trains show headlights; aeroplanes blink. Vehicles are only scenery: their movement uses its own randomness and never changes the simulation.

**Effects on the economy:**

- **Journeys:** expeditions are shorter by the travel speed: +5% with the wheel, +15% riding, +10% wagons, +30% each for a railway, motor cars and an airfield.
- **Caravans:** traders carry one more kind of goods, and sell a larger share, for each of carts, wagons, ships, lorries, and two for a railway.

**On screen:** a **Street lighting** card and a **Transport** card on the Land & frontier tab show the lights by kind, what the next kind needs, the transport buildings, and each vehicle with how many are about or what it still needs.
