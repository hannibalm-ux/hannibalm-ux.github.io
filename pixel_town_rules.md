# Pixel Town — Rules, Mechanics and Engine Reference

This document describes everything Pixel Town simulates and how. It covers the clock, the map, every villager system, the economy, government, justice, family life, the frontier, rendering, saving and testing. Numbers are the ones the code actually uses (`pixel_town.html`); where a rule is probabilistic, the odds are given.

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

---

## 1. What Pixel Town is

Pixel Town is a self-running life simulation of a small medieval-style town. It starts with 50 villagers who live, work, trade, gossip, fall in love, vote, commit crimes and grow old on a single shared clock. The player mostly watches; the town governs itself. The player can nudge it: pay for expeditions, petition for annexation, commission buildings, sell or demolish town property, add villagers from a template, and choose the music.

The design goal is emergent history. The town remembers what happened, villagers learn from it, institutions (courts, jails, investigators) appear only when the town's own history calls for them, and the map physically grows when land and resources run short.

---

## 2. Files and how to run it

| File | Purpose |
|---|---|
| `pixel_town.html` | The whole game: engine, art generator, UI, 2D and 3D renderers. Loads the 3D engine from `vendor/` only when 3D is switched on. |
| `pixel_town_standalone.html` | The same game with Three.js inlined, so it runs from a single file by double-clicking. |
| `vendor/three.module.min.js`, `vendor/three.LICENSE` | Three.js r169 (MIT) for the 3D view. |
| `pixel_town_citizen_template.md` | Format for adding villagers from text or JSON. |
| `tests/pixel_town.tests.js`, `tests/run_tests.js` | 43 automated scenario tests (Playwright). |

There is no server and no build step. Everything, including every sprite, building and tile, is drawn procedurally at startup from code. The town saves itself in the browser's `localStorage`.

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
- **Away time:** the town keeps running while the page is closed. On return, the missed time is simulated in fast-forward, capped at **7 game days**; anything beyond that is skipped. A summary of important events is shown.
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

Each villager builds a plan for the day at midnight: a list of timed blocks (sleep, eat, work, chores, trade, socialise, leisure, town hall).

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
- **Effects:** day/night lighting with lamp and window glow; rain, snow, fog, lightning and puddles.
- **Map:** a minimap that keeps the world's aspect ratio. Fog covers unexplored land, labelled "Unexplored", or "Expedition out" while explorers are on their way.

### 3D (the 3D button)

- **Terrain:** the 2D ground is stretched over a height-mapped terrain with sunken water and raised rocks.
- **Scenery:** real 3D buildings with lit windows at night, and instanced trees and rocks.
- **Villagers:** voxel figures built from each villager's look.
  - Faces have eyes, brows, a nose and a mouth.
  - Seven hairstyles (short, long, bun, ponytail, curly, spiky, bald) and nine hats.
  - Clothing includes open-front shirts over an undershirt, rolled cuffs, belts, tunics, aprons, coats and cuffed boots, plus beards and a satchel on a cross-body strap.
  - A subtle per-voxel texture gives the pixelated look. Limbs swing as villagers walk, they turn to face where they go, and they cast shadows. Children are smaller.
- **Lighting:** a sun and sky that follow the clock, with soft shadow maps and point lights at street lamps.
- **Volumetric light:** a full-screen pass marches each view ray through the low air (below 7 tiles high) and samples the sun's shadow map. Sunlit haze shows real shafts of shadow from buildings and trees. It is stronger at dawn and dusk and in fog, rain and snow, and street lamps glow with halos at night. Phones use half as many samples.
- **Controls:** drag or WASD to pan, right-drag, two fingers or Q/E to turn, wheel or pinch to zoom, tap a villager to select them. Zooming in close aims the camera at faces.
- **Growing world:** the 3D world rebuilds itself when the frontier grows.

---

## 19. The interface

| Tab | Contents |
|---|---|
| Log | The town chronicle, filterable by importance |
| Weekly | Week-by-week reports, with Markdown export and songs |
| People | Every villager; the inspector shows needs, mood, family, class, work, relationships, memory stream, plan, character sheet, and the mind section (important memories, beliefs, opinions, trust, suspicions, reputation, legal history); add villagers from a template |
| Market | Prices, listings, price history |
| Land | Frontier (resource gauges, Explore buttons, expeditions, discovered regions), territories, the town builder, property list, recent sales |
| Gov | Leader, council, campaign, laws, votes with each voter's statement |
| Society | Love & family figures (marriages, divorce %, infidelity %, adoptions, genders), newspapers, teams, schemes, institutions |
| Justice | Institutions and officials, jail and court, what the town says it needs, open and closed cases with evidence, statements, recusals and conflicts, and an optional **Reveal the truth** switch |
| Music | Soundtrack settings and Suno songs per phase |

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

**Tests** (`node tests/run_tests.js`, each in a fresh town):

- **Justice (13):** constable fines for quarrels, cases from vandalism, unsolved crimes, suspect identification, disagreeing witnesses, innocent suspects cleared, conviction, acquittal, dismissal, repeat offenders, jail cutting work and income, recusal, corruption.
- **Cognition (12):** witnessing, remembering, learning from a friend and from a newspaper, false rumours, contradictory evidence, gradual belief change, memories changing votes, policies changing opinions, fading and persisting memories, no instant knowledge of distant events.
- **Frontier (16):** exploration cost, exploring in all four directions, fog hiding resources, exploration taking time, regions differing, discovery not being annexation, annexation succeeding and failing, new building space, new resources, rising upkeep, opinions on expansion, the frontier moving outward.
- **Family (2):** only a woman and a man conceive; same-sex couples adopt.

---

## 23. Known limitations

- **Winter food shortages:** these can still occur in later game years in some towns. The granary and caravans soften them, but the town can remain short of farmers.
- **Speech and pronouns:** villagers' speech and many log lines use neutral wording ("they") rather than gendered pronouns.
- **Animals** are flat sprites in 3D.
- **Volumetric light** is tuned for desktop GPUs; phones use fewer samples.
- **Save size:** the save grows with history and is kept within browser storage limits by capping memories, cases, logs and wires.
