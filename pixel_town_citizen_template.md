# Pixel Town villager template

Use this format to add new villagers to Pixel Town. Open the town page, go to **People → Add villagers from a template**, then paste the text or load a `.txt`, `.md` or `.json` file, and press **Move them in**. New villagers walk into town on the King's Road from the west edge of the map.

- One villager per block. Separate villagers with a line containing only `---`.
- Only `name` is required. Anything you leave out gets a sensible default.
- Lines starting with `#` are comments.
- `friends`, `rivals` and `partner` must name villagers who already live in town. A partner must be unmarried; the two become spouses and share a home (if you give no orientation, it is set to fit the marriage).
- Every villager's page in the People tab has a **Character sheet** in this same format, so you can copy an existing villager as a starting point.

## Fields

| Field | Values |
|---|---|
| `name` | First and last name (must be unique in town) |
| `age` | 16 to 95 (default 30) |
| `gender` | female or male (default: follows the first name) |
| `orientation` | straight, gay or bi: who they can fall for (default: most villagers are straight, some gay, a few bi). Only a woman and a man can have a baby together; any couple can adopt. |
| `profession` | Farmer, Rancher, Butcher, Fisher, Baker, Woodcutter, Miner, Blacksmith, Carpenter, TavernKeeper, Doctor, Merchant, Musician, Athlete, Journalist, Teacher, Constable, Unemployed |
| `traits` | 2 to 4 of: Frugal, Generous, Greedy, Ambitious, Lazy, Hardworking, Gossip, Shy, Charismatic, Stubborn, Honest, Cunning, Romantic, Cautious, Reckless |
| `values` | 1 to 3 of: Prosperity, Community, Tradition, Freedom, Order, Nature, Craftsmanship, Family |
| `agenda` | Make a fortune, Win public office, Open a business, Find love, Raise a family, Protect the land, Stir up trouble, Bring order, Start over quietly |
| `wallet` | Starting coins (copper) |
| `intelligence` | 0 to 1, or a word: simple, average, clever, brilliant. Clever villagers notice what the town needs, plan better schemes, dig up secrets, and are harder to catch. Default: worked out from their personality. |
| `personality` | `openness`, `conscientiousness`, `extraversion`, `agreeableness`, `neuroticism`, each 0 to 1 |
| `politics` | `economic` −1 (communal) to +1 (free market), `order` −1 (liberty) to +1 (order), `civic` 0 to 1 (how often they vote and run for office) |
| `skin` | fair, light, tan, olive, brown, deep, or a hex colour |
| `hair` | black, dark brown, brown, auburn, red, blonde, grey, white, or a hex colour |
| `hairstyle` | short, long, bun, pony, curly, spiky, bald |
| `beard` | yes / no |
| `friends`, `rivals` | Comma-separated names of current villagers |
| `partner` | Name of an unmarried villager to marry |
| `bio` | A short backstory (shown on their profile) |

## What agendas do

| Agenda | Effect in town |
|---|---|
| Make a fortune | Buys property to rent out and sells when prices are high; favours "Lower taxes" candidates |
| Win public office | Much more likely to run for leader or council |
| Open a business | Buys a business, or a plot to build a shop of their trade (bakery, workshop, forge, butchery) |
| Find love | Falls for people more easily |
| Raise a family | Much more likely to have children; wants a home of their own |
| Protect the land | Backs nature laws; votes against annexing new territory |
| Stir up trouble | Starts more arguments; distrusts whoever is in charge |
| Bring order | Backs curfews and "Order in the streets" candidates |
| Start over quietly | Rarely votes or runs for office |

## JSON

A JSON object, or an array of objects, with the same field names also works, for example:

```json
[{"name": "Wren Sallow", "age": 27, "profession": "Miner", "traits": ["Reckless", "Honest"], "agenda": "Stir up trouble"}]
```

## Example

```
# Pixel Town villager template
# One villager per block. Separate villagers with a line of three dashes (---).
# Only "name" is required; everything else has a sensible default. Lines starting with # are ignored.

name: Rosalind Hale
age: 34
profession: Baker
# Farmer, Rancher, Butcher, Fisher, Baker, Woodcutter, Miner, Blacksmith, Carpenter, TavernKeeper, Doctor, Merchant, Unemployed
traits: Generous, Ambitious
# 2-4 of: Frugal, Generous, Greedy, Ambitious, Lazy, Hardworking, Gossip, Shy, Charismatic, Stubborn, Honest, Cunning, Romantic, Cautious, Reckless
values: Community, Craftsmanship
# 1-3 of: Prosperity, Community, Tradition, Freedom, Order, Nature, Craftsmanship, Family
gender: female
orientation: straight
agenda: Open a business
# Make a fortune, Win public office, Open a business, Find love, Raise a family, Protect the land, Stir up trouble, Bring order, Start over quietly
wallet: 250
intelligence: clever
personality: openness 0.6, conscientiousness 0.7, extraversion 0.5, agreeableness 0.8, neuroticism 0.3
politics: economic 0.2, order -0.1, civic 0.7
# economic: -1 communal .. +1 free market; order: -1 liberty .. +1 order; civic: 0..1 (how often they vote and run for office)
skin: tan
# fair, light, tan, olive, brown, deep, or a hex colour like #d8a070
hair: auburn
# black, dark brown, brown, auburn, red, blonde, grey, white, or a hex colour
hairstyle: long
# short, long, bun, pony, curly, spiky, bald
beard: no
friends: Pell Marsh, Ada Finch
rivals: Hugo Brandt
partner:
bio: Ran a bakery in the river cities until the flood took it. Wants her own ovens again, and a seat at the town hall one day.
---
name: Tomas Crowe
age: 52
profession: Fisher
traits: Stubborn, Honest
values: Tradition, Nature
agenda: Protect the land
wallet: 120
bio: An old lake fisher who has seen too many waters emptied. Will vote against anything that threatens the fish.
```
