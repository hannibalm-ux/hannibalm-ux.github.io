/* =====================================================================
   Pixel Town — civilization mode: data definitions
   Everything here is plain data. The systems in the other civ/*.js files read it,
   so a new occupation, building, business, technology or mineral is one entry here.
   ===================================================================== */

// ---------- knowledge (separate from intelligence) ----------
// cat: practical skills of daily life, social institutions, or a science discipline
const KNOWLEDGE = [
  {id:'agriculture',  label:'Agriculture',          cat:'practical'},
  {id:'husbandry',    label:'Animal husbandry',     cat:'practical'},
  {id:'foodcraft',    label:'Food & preservation',  cat:'practical'},
  {id:'construction', label:'Construction',         cat:'practical'},
  {id:'crafts',       label:'Crafts & tools',       cat:'practical'},
  {id:'wilderness',   label:'Wilderness lore',      cat:'practical'},
  {id:'medicine',     label:'Medicine',             cat:'science'},
  {id:'law',          label:'Law',                  cat:'social'},
  {id:'finance',      label:'Finance',              cat:'social'},
  {id:'trade',        label:'Trade',                cat:'social'},
  {id:'politics',     label:'Politics',             cat:'social'},
  {id:'teaching',     label:'Teaching',             cat:'social'},
  {id:'literacy',     label:'Reading & writing',    cat:'social'},
  {id:'history',      label:'History',              cat:'social'},
  {id:'geography',    label:'Geography',            cat:'social'},
  {id:'technology',   label:'Technology',           cat:'practical'},
  {id:'mathematics',  label:'Mathematics',          cat:'science'},
  {id:'physics',      label:'Physics',              cat:'science'},
  {id:'chemistry',    label:'Chemistry',            cat:'science'},
  {id:'biology',      label:'Biology',              cat:'science'},
  {id:'geology',      label:'Geology',              cat:'science'},
  {id:'astronomy',    label:'Astronomy',            cat:'science'},
  {id:'engineering',  label:'Engineering',          cat:'science'},
  {id:'agriscience',  label:'Agricultural science', cat:'science'},
  {id:'envscience',   label:'Environmental science',cat:'science'}
];
const KN = Object.fromEntries(KNOWLEDGE.map(k=>[k.id,k]));
const SCIENCES = KNOWLEDGE.filter(k=>k.cat==='science').map(k=>k.id);

// ---------- skills: learned by doing, teaching, reading and research; each feeds knowledge domains ----------
const SKILLS = [
  {id:'foraging',     label:'Foraging',      know:['wilderness','biology']},
  {id:'hunting',      label:'Hunting',       know:['wilderness']},
  {id:'fishing',      label:'Fishing',       know:['wilderness']},
  {id:'woodcutting',  label:'Woodcutting',   know:['wilderness','construction']},
  {id:'stonework',    label:'Stonework',     know:['construction','geology']},
  {id:'construction', label:'Construction',  know:['construction','engineering']},
  {id:'carpentry',    label:'Carpentry',     know:['construction','crafts']},
  {id:'farming',      label:'Farming',       know:['agriculture','agriscience']},
  {id:'herding',      label:'Herding',       know:['husbandry','biology']},
  {id:'cooking',      label:'Cooking',       know:['foodcraft']},
  {id:'crafting',     label:'Crafting',      know:['crafts','technology']},
  {id:'smithing',     label:'Smithing',      know:['crafts','chemistry']},
  {id:'weaving',      label:'Weaving',       know:['crafts']},
  {id:'mining',       label:'Mining',        know:['geology','engineering']},
  {id:'geology',      label:'Prospecting',   know:['geology']},
  {id:'medicine',     label:'Medicine',      know:['medicine','biology']},
  {id:'accounting',   label:'Accounting',    know:['finance','mathematics']},
  {id:'investing',    label:'Investing',     know:['finance']},
  {id:'management',   label:'Management',    know:['trade','finance']},
  {id:'negotiation',  label:'Negotiation',   know:['trade','law']},
  {id:'trading',      label:'Trading',       know:['trade','geography']},
  {id:'law',          label:'Law',           know:['law']},
  {id:'investigation',label:'Investigation', know:['law']},
  {id:'teaching',     label:'Teaching',      know:['teaching']},
  {id:'engineering',  label:'Engineering',   know:['engineering','physics','mathematics']},
  {id:'mathematics',  label:'Mathematics',   know:['mathematics']},
  {id:'chemistry',    label:'Chemistry',     know:['chemistry']},
  {id:'biology',      label:'Biology',       know:['biology','medicine']},
  {id:'physics',      label:'Physics',       know:['physics','astronomy']},
  {id:'research',     label:'Research',      know:['mathematics']},
  {id:'journalism',   label:'Journalism',    know:['literacy','history']},
  {id:'athletics',    label:'Athletics',     know:[]},
  {id:'leadership',   label:'Leadership',    know:['politics']}
];
const SK = Object.fromEntries(SKILLS.map(s=>[s.id,s]));

// ---------- cognition: modular, no one is good at everything ----------
const COG = ['reasoning','memory','learning','planning','social','creativity','practical','attention','emotional','risk'];
const COG_LABEL = {reasoning:'Reasoning', memory:'Memory', learning:'Learning ability', planning:'Planning', social:'Social intelligence', creativity:'Creativity',
  practical:'Practical intelligence', attention:'Attention', emotional:'Emotional intelligence', risk:'Risk assessment'};

// ---------- goods ----------
// food: hunger restored per unit; perish: days before a unit spoils (0 = keeps); v: rough use value in barter units
const CIV_GOODS = [
  {id:'berries',  name:'Berries & greens', cat:'food', food:22, perish:3,  v:1},
  {id:'roots',    name:'Roots & nuts',     cat:'food', food:26, perish:14, v:1.2},
  {id:'fish',     name:'Fish',             cat:'food', food:34, perish:3,  v:2},
  {id:'game',     name:'Game meat',        cat:'food', food:40, perish:4,  v:2.4},
  {id:'grain',    name:'Grain',            cat:'food', food:30, perish:150,v:1.6},
  {id:'veg',      name:'Vegetables',       cat:'food', food:28, perish:9,  v:1.4},
  {id:'eggs',     name:'Eggs',             cat:'food', food:22, perish:12, v:1.2},
  {id:'milk',     name:'Milk',             cat:'food', food:20, perish:2,  v:1},
  {id:'meat',     name:'Meat',             cat:'food', food:42, perish:4,  v:2.6},
  {id:'bread',    name:'Bread',            cat:'food', food:38, perish:4,  v:2.2},
  {id:'preserved',name:'Smoked & dried food',cat:'food',food:32,perish:90, v:2.4},
  {id:'water',    name:'Water',            cat:'water',perish:0,v:0.2},
  {id:'wood',     name:'Wood',             cat:'material', v:1.5},
  {id:'stone',    name:'Stone',            cat:'material', v:1.4},
  {id:'fiber',    name:'Fibre & reeds',    cat:'material', v:1},
  {id:'thatch',   name:'Thatch',           cat:'material', v:1},
  {id:'clay',     name:'Clay',             cat:'material', v:1},
  {id:'hide',     name:'Hides',            cat:'material', v:3},
  {id:'lumber',   name:'Lumber',           cat:'material', v:4},
  {id:'brick',    name:'Bricks',           cat:'material', v:3},
  {id:'glass',    name:'Glass',            cat:'material', v:8},
  {id:'cement',   name:'Cement',           cat:'material', v:6},
  {id:'steel',    name:'Steel',            cat:'material', v:18},
  {id:'rope',     name:'Rope',             cat:'crafted',  v:3},
  {id:'cloth',    name:'Cloth',            cat:'crafted',  v:6},
  {id:'clothes',  name:'Clothing',         cat:'crafted',  v:9},
  {id:'pottery',  name:'Pottery',          cat:'crafted',  v:4},
  {id:'tools',    name:'Stone tools',      cat:'crafted',  v:5},
  {id:'mtools',   name:'Metal tools',      cat:'crafted',  v:16},
  {id:'furniture',name:'Furniture',        cat:'crafted',  v:14},
  {id:'books',    name:'Books',            cat:'crafted',  v:20},
  {id:'medicine', name:'Medicine',         cat:'crafted',  v:12},
  {id:'ale',      name:'Ale',              cat:'crafted',  v:3, perish:20},
  {id:'beads',    name:'Shell beads',      cat:'token',    v:2},
  {id:'copper',   name:'Copper ore',       cat:'ore', v:6},  {id:'tin',     name:'Tin ore',     cat:'ore', v:7},
  {id:'iron',     name:'Iron ore',         cat:'ore', v:6},  {id:'coal',    name:'Coal',        cat:'ore', v:4},
  {id:'lead',     name:'Lead ore',         cat:'ore', v:5},  {id:'zinc',    name:'Zinc ore',    cat:'ore', v:6},
  {id:'nickel',   name:'Nickel ore',       cat:'ore', v:10}, {id:'silver',  name:'Silver',      cat:'ore', v:40},
  {id:'gold',     name:'Gold',             cat:'ore', v:90}, {id:'platinum',name:'Platinum',    cat:'ore', v:120},
  {id:'gems',     name:'Gemstones',        cat:'ore', v:70}, {id:'salt',    name:'Salt',        cat:'ore', v:5},
  {id:'rare',     name:'Rare earths',      cat:'ore', v:60},
  {id:'metal',    name:'Metal ingots',     cat:'material', v:14},
  {id:'oil',      name:'Crude oil',        cat:'energy', v:1},  {id:'gas', name:'Natural gas', cat:'energy', v:1},
  {id:'kerosene', name:'Kerosene',         cat:'energy', v:9},  {id:'fuel', name:'Fuel oil',   cat:'energy', v:12},
  {id:'chemicals',name:'Chemicals',        cat:'crafted', v:16}
];
const CG = Object.fromEntries(CIV_GOODS.map(g=>[g.id,g]));
const CIV_FOODS = CIV_GOODS.filter(g=>g.cat==='food').map(g=>g.id);

// ---------- activities: what a person can spend a block of time doing ----------
// place: where it happens; out: base units produced per hour of work at skill 50 with no tools
// season: yield multipliers by season [spring, summer, fall, winter]; tech: needed before anyone does it
const ACTIVITIES = {
  forage:  {label:'Foraging',        skill:'foraging',    place:'wild',   out:{berries:2.2, roots:1.1}, season:[0.8,1.3,1.2,0.3], xp:1, eco:'forage'},
  fish:    {label:'Fishing',         skill:'fishing',     place:'shore',  out:{fish:2.3}, season:[1,1.1,1,0.6], tool:['rope'], toolBoost:1.6, xp:1, eco:'fish'},
  hunt:    {label:'Hunting',         skill:'hunting',     place:'forest', out:{game:2.6, hide:0.25}, season:[0.9,1,1.2,0.7], tool:['tools','mtools'], toolBoost:1.4, risk:0.004, var:0.9, xp:1.2, eco:'game'},
  chop:    {label:'Cutting wood',    skill:'woodcutting', place:'tree',   out:{wood:2.4}, season:[1,1,1,0.8], tool:['tools','mtools'], toolBoost:1.8, risk:0.001, xp:1},
  quarry:  {label:'Gathering stone', skill:'stonework',   place:'rock',   out:{stone:1.8}, season:[1,1,1,0.7], tool:['tools','mtools'], toolBoost:1.7, xp:1},
  gather:  {label:'Gathering reeds', skill:'foraging',    place:'shore',  out:{fiber:2, thatch:1.2, clay:0.8}, season:[1,1.1,1,0.3], xp:0.6},
  water:   {label:'Fetching water',  skill:null,          place:'water',  out:{water:12}, xp:0},
  cook:    {label:'Preserving food', skill:'cooking',     place:'home',   out:{}, xp:1, tech:'smoking'},
  craft:   {label:'Making tools',    skill:'crafting',    place:'home',   out:{}, xp:1.1},
  build:   {label:'Building',        skill:'construction',place:'site',   out:{}, xp:1.2, risk:0.0015},
  farm:    {label:'Farming',         skill:'farming',     place:'field',  out:{}, xp:1, tech:'cultivation'},
  herd:    {label:'Herding',         skill:'herding',     place:'pen',    out:{}, xp:1, tech:'domestication'},
  heal:    {label:'Tending the sick',skill:'medicine',    place:'patient',out:{}, xp:1.3},
  teach:   {label:'Teaching',        skill:'teaching',    place:'school', out:{}, xp:1},
  learn:   {label:'Studying',        skill:null,          place:'school', out:{}, xp:0},
  research:{label:'Research',        skill:'research',    place:'lab',    out:{}, xp:1},
  prospect:{label:'Prospecting',     skill:'geology',     place:'hills',  out:{}, xp:1.2},
  mine:    {label:'Mining',          skill:'mining',      place:'mine',   out:{}, xp:1, risk:0.003},
  trade:   {label:'Trading',         skill:'trading',     place:'market', out:{}, xp:1},
  job:     {label:'Working',         skill:null,          place:'job',    out:{}, xp:1},
  patrol:  {label:'Keeping watch',   skill:'investigation',place:'patrol',out:{}, xp:0.8},
  play:    {label:'Playing',         skill:'athletics',   place:'commons',out:{}, xp:0.5},
  rest:    {label:'Resting',         skill:null,          place:'home',   out:{}, xp:0}
};

// ---------- occupations: recognised socially once someone keeps doing valuable work ----------
// Each tier is reached by skill, knowledge, technology or an institution; the first tier only needs the habit.
const OCCUPATIONS = [
  {id:'forager',   act:'forage',  tiers:[{t:'Forager'},{t:'Herbalist', know:{biology:25}}]},
  {id:'hunter',    act:'hunt',    tiers:[{t:'Hunter'},{t:'Master Hunter', skill:62}]},
  {id:'fisher',    act:'fish',    tiers:[{t:'Fisher'},{t:'Master Fisher', skill:60}]},
  {id:'woodcutter',act:'chop',    tiers:[{t:'Woodcutter'},{t:'Lumberjack', skill:58, tech:'saws'}]},
  {id:'stone',     act:'quarry',  tiers:[{t:'Stone Gatherer'},{t:'Quarryman', skill:50},{t:'Mason', skill:62, know:{construction:40}}]},
  {id:'builder',   act:'build',   tiers:[{t:'Builder'},{t:'Carpenter', skill:52, know:{construction:32}},{t:'Construction Contractor', skill:62, org:true}]},
  {id:'farmer',    act:'farm',    tiers:[{t:'Gardener'},{t:'Farmer', skill:42},{t:'Estate Farmer', org:true}]},
  {id:'herder',    act:'herd',    tiers:[{t:'Herder'},{t:'Rancher', skill:48, struct:'ranch'}]},
  {id:'cook',      act:'cook',    tiers:[{t:'Cook'},{t:'Baker', tech:'baking'}]},
  {id:'toolmaker', act:'craft',   tiers:[{t:'Toolmaker'},{t:'Smith', tech:'smelting'},{t:'Blacksmith', skill:60, tech:'ironworking'}]},
  {id:'healer',    act:'heal',    tiers:[{t:'Healer'},{t:'Medical Worker', know:{medicine:38}},{t:'Doctor', know:{medicine:65}, inst:'medical'}]},
  {id:'teacher',   act:'teach',   tiers:[{t:'Elder Teacher'},{t:'Teacher', know:{teaching:35}},{t:'Professor', know:{teaching:55}, inst:'university'}]},
  {id:'trader',    act:'trade',   tiers:[{t:'Trader'},{t:'Merchant', skill:48},{t:'Shopkeeper', struct:'shop'}]},
  {id:'prospector',act:'prospect',tiers:[{t:'Prospector'},{t:'Geologist', know:{geology:55}}]},
  {id:'miner',     act:'mine',    tiers:[{t:'Miner'},{t:'Mine Foreman', skill:60}]},
  {id:'researcher',act:'research',tiers:[{t:'Tinkerer'},{t:'Natural Philosopher', know:{mathematics:30}},{t:'Scientist', inst:'lab'}]},
  {id:'watch',     act:'patrol',  tiers:[{t:'Watchman'}]},
  {id:'lender',    act:'lend',    tiers:[{t:'Moneylender'},{t:'Banker', org:'bank'}]}
];
const OCC = Object.fromEntries(OCCUPATIONS.map(o=>[o.id,o]));

// ---------- structures: every building, field, pen, bridge and road is one of these ----------
// mat: materials to build; labor: person-hours; home: {cap, comfort, insul, dur, store, privacy} (0-100)
// style: the art style used to draw it; tile: tile-based structures paint the map instead of standing on it
// up: what it can be upgraded to; know/tech: what the builders must understand
const STRUCTURES = {
  // homes
  lean_to:      {label:'Lean-to',             cat:'home', w:2,h:2, style:'hut',  roof:'#8a7a4a', mat:{wood:8, thatch:4}, labor:10, home:{cap:3, comfort:12, insul:8, dur:20, store:20, privacy:10}, up:['crude_hut']},
  crude_hut:    {label:'Crude hut',           cat:'home', w:3,h:2, style:'hut',  roof:'#9a8448', mat:{wood:16, thatch:8}, labor:24, home:{cap:5, comfort:20, insul:18, dur:30, store:40, privacy:20}, up:['wattle_hut','timber_cabin']},
  longhouse:    {label:'Shared longhouse',    cat:'home', w:6,h:3, style:'hut',  roof:'#8a7440', mat:{wood:40, thatch:20}, labor:60, home:{cap:12, comfort:18, insul:22, dur:35, store:90, privacy:6}, up:['timber_cabin']},
  wattle_hut:   {label:'Wattle-and-daub hut', cat:'home', w:3,h:3, style:'hut',  roof:'#a88a50', mat:{wood:20, clay:14, thatch:10}, labor:36, know:{construction:12}, home:{cap:5, comfort:32, insul:40, dur:45, store:60, privacy:40}, up:['timber_cabin','cottage']},
  timber_cabin: {label:'Timber cabin',        cat:'home', w:3,h:3, style:'house',roof:'#7a5a3a', mat:{wood:48, stone:6}, labor:60, know:{construction:22}, tech:'carpentry', home:{cap:6, comfort:45, insul:50, dur:60, store:80, privacy:60}, up:['cottage','stone_cottage']},
  cottage:      {label:'Cottage',             cat:'home', w:4,h:3, style:'house',mat:{lumber:30, stone:18, thatch:10}, labor:90, know:{construction:32}, tech:'sawn_lumber', home:{cap:6, comfort:58, insul:60, dur:70, store:100, privacy:70}, up:['stone_cottage','townhouse']},
  stone_cottage:{label:'Stone cottage',       cat:'home', w:4,h:3, style:'stone',mat:{stone:60, lumber:20}, labor:120, know:{construction:40}, tech:'masonry', home:{cap:6, comfort:64, insul:75, dur:90, store:110, privacy:75}, up:['townhouse','mansion']},
  townhouse:    {label:'Townhouse',           cat:'home', w:3,h:4, style:'house',mat:{brick:60, lumber:30, glass:6}, labor:150, know:{construction:48}, tech:'bricks', home:{cap:6, comfort:72, insul:80, dur:90, store:110, privacy:82}, up:['row_houses','apartments']},
  row_houses:   {label:'Row houses',          cat:'home', w:6,h:3, style:'house',mat:{brick:110, lumber:50, glass:10}, labor:260, know:{construction:52}, tech:'bricks', home:{cap:16, comfort:62, insul:78, dur:85, store:160, privacy:60}, up:['apartments']},
  duplex:       {label:'Duplex',              cat:'home', w:4,h:4, style:'house',mat:{brick:80, lumber:40, glass:8}, labor:200, know:{construction:50}, tech:'bricks', home:{cap:10, comfort:66, insul:78, dur:88, store:140, privacy:70}},
  boarding:     {label:'Boarding house',      cat:'home', w:4,h:4, style:'tavern',roof:'#6a4a3a', mat:{lumber:60, stone:30}, labor:180, know:{construction:40}, tech:'sawn_lumber', home:{cap:14, comfort:40, insul:60, dur:70, store:60, privacy:30}},
  dormitory:    {label:'Dormitory',           cat:'home', w:5,h:4, style:'stone',mat:{brick:90, lumber:40}, labor:220, know:{construction:48}, tech:'bricks', home:{cap:20, comfort:45, insul:70, dur:85, store:60, privacy:25}},
  apartments:   {label:'Apartment block',     cat:'home', w:4,h:4, style:'tall', mat:{brick:160, steel:20, glass:30, cement:20}, labor:420, know:{construction:62, engineering:40}, tech:'multi_storey', home:{cap:28, comfort:66, insul:85, dur:95, store:200, privacy:65}, up:['tower']},
  tower:        {label:'Residential tower',   cat:'home', w:5,h:5, style:'tall', mat:{steel:80, glass:60, cement:120}, labor:900, know:{construction:75, engineering:60}, tech:'steel_frame', home:{cap:80, comfort:70, insul:90, dur:98, store:400, privacy:70}},
  mansion:      {label:'Mansion',             cat:'home', w:5,h:4, style:'palace',mat:{stone:120, lumber:60, glass:20}, labor:400, know:{construction:55}, tech:'masonry', home:{cap:8, comfort:92, insul:88, dur:95, store:250, privacy:95}, up:['estate']},
  estate:       {label:'Estate',              cat:'home', w:6,h:5, style:'palace',mat:{stone:200, lumber:90, glass:40}, labor:700, know:{construction:62}, tech:'masonry', home:{cap:12, comfort:98, insul:92, dur:98, store:400, privacy:99}},
  // food production and storage (tile structures paint the ground)
  garden:       {label:'Garden plot',         cat:'farm', w:4,h:3, tile:'FIELD', mat:{}, labor:14, tech:'cultivation', farm:{crop:['veg'], yield:1.2}},
  field:        {label:'Field',               cat:'farm', w:7,h:5, tile:'FIELD', mat:{wood:6}, labor:40, tech:'cultivation', farm:{crop:['grain','veg'], yield:1}, up:['farm']},
  farm:         {label:'Farm',                cat:'farm', w:9,h:6, tile:'FIELD', mat:{wood:20}, labor:90, tech:'plough', farm:{crop:['grain','veg'], yield:1.35}},
  orchard:      {label:'Orchard',             cat:'farm', w:6,h:6, tile:'FIELD', mat:{wood:8}, labor:50, tech:'cultivation', farm:{crop:['berries'], yield:0.9, perennial:true}},
  pen:          {label:'Animal pen',          cat:'ranch',w:5,h:5, tile:'PASTURE', mat:{wood:24}, labor:30, tech:'domestication', ranch:{cap:8}, up:['ranch']},
  ranch:        {label:'Ranch',               cat:'ranch',w:9,h:7, tile:'PASTURE', mat:{wood:60, lumber:10}, labor:90, tech:'domestication', know:{husbandry:25}, ranch:{cap:26}},
  barn:         {label:'Barn',                cat:'storage',w:4,h:3, style:'barn', roof:'#6a3a2a', mat:{lumber:40, wood:20}, labor:90, tech:'sawn_lumber', store:300},
  drying_rack:  {label:'Drying racks',        cat:'storage',w:2,h:2, style:'hut', roof:'#8a6a3a', mat:{wood:10, fiber:6}, labor:8, tech:'smoking', store:40, preserve:0.5},
  granary:      {label:'Granary',             cat:'storage',w:3,h:3, style:'barn', roof:'#8a5a2a', mat:{wood:40, stone:20, clay:10}, labor:70, know:{construction:18}, store:900, preserve:0.35, food:true},
  warehouse:    {label:'Warehouse',           cat:'storage',w:5,h:4, style:'barn', roof:'#5a4a3a', mat:{lumber:80, stone:40}, labor:160, tech:'sawn_lumber', store:2500, preserve:0.25},
  cold_store:   {label:'Refrigerated store',  cat:'storage',w:4,h:4, style:'stone',mat:{brick:60, steel:20, glass:6}, labor:200, tech:'refrigeration', store:3000, preserve:0.05, food:true},
  well:         {label:'Well',                cat:'infra',w:1,h:1, prop:'well', mat:{stone:20, wood:4}, labor:30, tech:'well_digging'},
  // exchange and commerce
  trading_spot: {label:'Trading spot',        cat:'commerce',w:4,h:3, tile:'PLAZA', mat:{}, labor:4},
  market:       {label:'Market stalls',       cat:'commerce',w:6,h:4, tile:'PLAZA', prop:'stalls', mat:{wood:40, cloth:6}, labor:50},
  shop:         {label:'Shop',                cat:'commerce',w:3,h:3, style:'house', mat:{lumber:30, stone:10}, labor:80, tech:'sawn_lumber', biz:true},
  // workshops and industry (the business decides what is made inside)
  workshop:     {label:'Workshop',            cat:'industry',w:3,h:3, style:'house', roof:'#7a5a32', mat:{wood:30, stone:10}, labor:50, biz:true},
  kiln:         {label:'Kiln',                cat:'industry',w:2,h:2, style:'stone', mat:{stone:24, clay:20}, labor:30, tech:'pottery', biz:true},
  forge:        {label:'Forge',               cat:'industry',w:3,h:3, style:'stone', roof:'#4a4e5c', mat:{stone:40, wood:20}, labor:70, tech:'smelting', biz:true},
  mill:         {label:'Mill',                cat:'industry',w:3,h:3, style:'barn',  roof:'#7a4a2a', mat:{lumber:40, stone:30}, labor:110, tech:'milling', biz:true},
  sawmill:      {label:'Sawmill',             cat:'industry',w:4,h:3, style:'barn',  roof:'#6a5a3a', mat:{lumber:40, metal:10}, labor:130, tech:'saws', biz:true},
  brickworks:   {label:'Brickworks',          cat:'industry',w:4,h:3, style:'stone', mat:{stone:40, clay:30}, labor:120, tech:'bricks', biz:true},
  textile_mill: {label:'Textile mill',        cat:'industry',w:5,h:4, style:'stone', mat:{brick:100, lumber:40, metal:20}, labor:260, tech:'mechanical_loom', biz:true},
  foundry:      {label:'Foundry',             cat:'industry',w:4,h:4, style:'stone', mat:{brick:80, metal:30}, labor:220, tech:'ironworking', biz:true},
  steelworks:   {label:'Steelworks',          cat:'industry',w:6,h:4, style:'stone', mat:{brick:160, metal:80}, labor:500, tech:'steelmaking', biz:true},
  factory:      {label:'Factory',             cat:'industry',w:6,h:5, style:'stone', mat:{brick:180, steel:40, glass:20}, labor:600, tech:'steam_power', biz:true},
  refinery:     {label:'Refinery',            cat:'industry',w:5,h:4, style:'stone', mat:{steel:80, brick:60}, labor:500, tech:'refining', biz:true},
  chem_plant:   {label:'Chemical plant',      cat:'industry',w:5,h:4, style:'stone', mat:{steel:90, glass:30, brick:60}, labor:520, tech:'industrial_chemistry', biz:true},
  // food and hospitality businesses
  bakery:       {label:'Bakery',              cat:'food',w:3,h:3, style:'house', roof:'#c07a34', sign:'bread', mat:{stone:30, wood:20}, labor:70, tech:'baking', biz:true},
  brewery:      {label:'Brewery',             cat:'food',w:4,h:3, style:'barn',  roof:'#7a3a2a', sign:'mug', mat:{lumber:40, stone:20}, labor:110, tech:'brewing', biz:true},
  dairy:        {label:'Dairy',               cat:'food',w:3,h:3, style:'barn',  roof:'#8a8a9a', mat:{lumber:30, stone:20}, labor:90, tech:'domestication', biz:true},
  food_plant:   {label:'Food-processing plant',cat:'food',w:5,h:4, style:'stone', mat:{brick:100, steel:20}, labor:300, tech:'canning', biz:true},
  pub:          {label:'Pub',                 cat:'hospitality',w:4,h:3, style:'tavern', roof:'#6a3020', sign:'mug', mat:{wood:40, stone:20}, labor:90, biz:true},
  cafe:         {label:'Café',                cat:'hospitality',w:3,h:3, style:'house', roof:'#8a4a5a', sign:'mug', mat:{lumber:30, glass:4}, labor:80, tech:'sawn_lumber', biz:true},
  restaurant:   {label:'Restaurant',          cat:'hospitality',w:4,h:3, style:'tavern', roof:'#5a2a3a', sign:'mug', mat:{lumber:50, stone:20, glass:6}, labor:120, tech:'sawn_lumber', biz:true},
  inn:          {label:'Inn',                 cat:'hospitality',w:4,h:4, style:'tavern', roof:'#6a4028', sign:'mug', mat:{lumber:60, stone:30}, labor:160, tech:'sawn_lumber', biz:true, lodging:8},
  hotel:        {label:'Hotel',               cat:'hospitality',w:5,h:4, style:'hotel', mat:{brick:120, glass:20, lumber:40}, labor:320, tech:'bricks', biz:true, lodging:20},
  // retail
  general_store:{label:'General store',       cat:'retail',w:4,h:3, style:'house', roof:'#5a6a3a', mat:{lumber:40, stone:10}, labor:90, tech:'sawn_lumber', biz:true},
  grocery:      {label:'Grocery',             cat:'retail',w:3,h:3, style:'house', roof:'#4a7a3a', mat:{lumber:30}, labor:70, tech:'sawn_lumber', biz:true},
  clothing_shop:{label:'Clothing shop',       cat:'retail',w:3,h:3, style:'house', roof:'#8a3a6a', mat:{lumber:30, glass:4}, labor:70, tech:'weaving', biz:true},
  furniture_store:{label:'Furniture store',   cat:'retail',w:3,h:3, style:'house', roof:'#7a5a32', sign:'saw', mat:{lumber:35}, labor:70, tech:'carpentry', biz:true},
  hardware:     {label:'Hardware store',      cat:'retail',w:3,h:3, style:'house', roof:'#4a4e5c', sign:'anvil', mat:{lumber:30, metal:6}, labor:70, tech:'ironworking', biz:true},
  jeweler:      {label:'Jewelry store',       cat:'retail',w:3,h:3, style:'stone', mat:{stone:30, glass:6}, labor:80, tech:'goldsmithing', biz:true},
  bookstore:    {label:'Bookstore',           cat:'retail',w:3,h:3, style:'house', roof:'#3a4a6a', sign:'news', mat:{lumber:30}, labor:70, tech:'printing', biz:true},
  pharmacy:     {label:'Pharmacy',            cat:'retail',w:3,h:3, style:'house', roof:'#3a8a6a', sign:'cross', mat:{lumber:30, glass:6}, labor:70, tech:'pharmacology', biz:true},
  department:   {label:'Department store',    cat:'retail',w:6,h:4, style:'hotel', mat:{brick:160, glass:40, steel:20}, labor:450, tech:'steel_frame', biz:true},
  // professional
  office:       {label:'Office',              cat:'professional',w:3,h:3, style:'stone', sign:'scales', mat:{brick:40, lumber:20, glass:6}, labor:110, tech:'bricks', biz:true},
  bank:         {label:'Bank',                cat:'professional',w:4,h:3, style:'hotel', mat:{stone:80, glass:10, metal:10}, labor:200, tech:'masonry', biz:true},
  exchange_hall:{label:'Stock exchange',      cat:'professional',w:5,h:4, style:'hall', roof:'#3a4a6a', mat:{stone:120, glass:20}, labor:300, tech:'masonry', biz:true},
  // education and science
  school_hut:   {label:'Schoolhouse',         cat:'education',w:3,h:3, style:'house', roof:'#b0783a', mat:{wood:30, thatch:10}, labor:50, edu:1},
  school:       {label:'School',              cat:'education',w:5,h:3, style:'hall', roof:'#8a4a3a', mat:{lumber:60, stone:40}, labor:160, tech:'carpentry', edu:2, up:['academy']},
  trade_school: {label:'Trade school',        cat:'education',w:5,h:4, style:'stone', mat:{brick:80, lumber:30}, labor:220, tech:'bricks', edu:2, trade:true},
  academy:      {label:'Academy',             cat:'education',w:5,h:4, style:'hall', roof:'#3d5588', mat:{stone:120, lumber:40, glass:10}, labor:300, tech:'masonry', edu:3, up:['college']},
  college:      {label:'College',             cat:'education',w:6,h:4, style:'hall', roof:'#5a3a6a', mat:{stone:160, glass:20, lumber:60}, labor:420, tech:'masonry', edu:4, up:['university']},
  university:   {label:'University',          cat:'education',w:7,h:5, style:'palace',roof:'#3a4a7a', mat:{stone:260, glass:40, lumber:80}, labor:700, tech:'masonry', edu:5},
  library:      {label:'Library',             cat:'education',w:4,h:3, style:'stone', roof:'#3a4a6a', sign:'news', mat:{stone:60, lumber:30}, labor:150, tech:'writing', library:true},
  laboratory:   {label:'Laboratory',          cat:'science', w:4,h:3, style:'stone', mat:{brick:60, glass:20}, labor:180, tech:'glassmaking', lab:1.5},
  institute:    {label:'Research institute',  cat:'science', w:5,h:4, style:'hall', roof:'#2a5a5a', mat:{brick:140, glass:40, steel:10}, labor:400, tech:'glassmaking', lab:2.2},
  observatory:  {label:'Observatory',         cat:'science', w:3,h:3, style:'stone', mat:{stone:60, glass:20, metal:10}, labor:200, tech:'optics', lab:1.3, disc:'astronomy'},
  // health
  healer_hut:   {label:"Healer's hut",        cat:'medical',w:3,h:2, style:'hut', roof:'#7a6a4a', sign:'cross', mat:{wood:16, thatch:8}, labor:24, care:1},
  clinic:       {label:'Clinic',              cat:'medical',w:4,h:3, style:'stone', roof:'#a8403c', sign:'cross', mat:{stone:50, lumber:30}, labor:140, know:{medicine:35}, care:2, up:['hospital']},
  hospital:     {label:'Hospital',            cat:'medical',w:6,h:4, style:'stone', roof:'#a8403c', sign:'cross', mat:{brick:180, glass:30, lumber:60}, labor:500, know:{medicine:60}, tech:'germ_theory', care:4},
  dentist:      {label:'Dentist',             cat:'medical',w:3,h:3, style:'house', sign:'cross', mat:{lumber:30, glass:4}, labor:70, know:{medicine:40}, care:1, biz:true},
  vet:          {label:'Veterinary clinic',   cat:'medical',w:3,h:3, style:'barn', sign:'cross', mat:{lumber:30}, labor:70, know:{husbandry:40}, biz:true},
  // government and justice
  meeting_circle:{label:'Meeting circle',     cat:'civic',w:3,h:3, tile:'PLAZA', prop:'firepit', mat:{stone:12}, labor:8},
  council_house:{label:'Council house',       cat:'civic',w:4,h:3, style:'hut', roof:'#6a5a3a', mat:{wood:40, thatch:16}, labor:60, gov:1, up:['town_hall']},
  town_hall:    {label:'Town hall',           cat:'civic',w:6,h:4, style:'hall', roof:'#3d5588', mat:{stone:120, lumber:60}, labor:320, tech:'masonry', gov:2},
  watch_post:   {label:'Watch post',          cat:'civic',w:2,h:2, style:'stone', mat:{wood:20, stone:10}, labor:24, police:1, up:['police_station']},
  police_station:{label:'Police station',     cat:'civic',w:4,h:3, style:'stone', sign:'bars', mat:{brick:70, metal:6}, labor:180, tech:'bricks', police:2},
  courthouse:   {label:'Courthouse',          cat:'civic',w:5,h:4, style:'hall', roof:'#5a3a3a', sign:'scales', mat:{stone:110, lumber:40}, labor:280, tech:'masonry', court:true},
  jail:         {label:'Jail',                cat:'civic',w:3,h:3, style:'stone', sign:'bars', mat:{stone:60, metal:6}, labor:120, jail:6, up:['prison']},
  prison:       {label:'Prison',              cat:'civic',w:6,h:5, style:'stone', sign:'bars', mat:{stone:220, steel:30}, labor:500, tech:'masonry', jail:30},
  fire_station: {label:'Fire station',        cat:'civic',w:4,h:3, style:'stone', roof:'#a8302a', mat:{brick:60, lumber:20}, labor:150, tech:'bricks'},
  tax_office:   {label:'Tax office',          cat:'civic',w:3,h:3, style:'stone', mat:{brick:40, lumber:20}, labor:100, tech:'bricks', gov:1},
  planning_office:{label:'Planning office',   cat:'civic',w:3,h:3, style:'stone', mat:{brick:40, lumber:20}, labor:100, tech:'bricks', gov:1},
  public_works: {label:'Public works depot',  cat:'civic',w:4,h:3, style:'barn', mat:{lumber:40, stone:30}, labor:120, tech:'sawn_lumber'},
  // extraction
  pit:          {label:'Hand-dug pit',        cat:'extraction',w:2,h:2, style:'mine', mat:{wood:6}, labor:20, mine:{depth:1, rate:1}},
  quarry:       {label:'Quarry',              cat:'extraction',w:4,h:4, style:'mine', mat:{wood:20}, labor:60, tech:'quarrying', mine:{depth:1, rate:2, stone:true}},
  mine:         {label:'Underground mine',    cat:'extraction',w:4,h:3, style:'mine', mat:{wood:60, stone:20, metal:6}, labor:200, tech:'mining', mine:{depth:3, rate:2.2}, up:['deep_mine']},
  open_pit:     {label:'Open-pit mine',       cat:'extraction',w:6,h:5, style:'mine', mat:{wood:40, metal:20}, labor:260, tech:'explosives', mine:{depth:2, rate:4}},
  deep_mine:    {label:'Deep mine',           cat:'extraction',w:5,h:4, style:'mine', mat:{steel:40, lumber:60}, labor:420, tech:'steam_power', mine:{depth:5, rate:3.5}},
  test_well:    {label:'Exploratory well',    cat:'extraction',w:1,h:1, prop:'derrick', mat:{lumber:20, metal:10}, labor:60, tech:'drilling', drill:true},
  oil_well:     {label:'Oil well',            cat:'extraction',w:2,h:2, prop:'derrick', mat:{steel:20, lumber:20}, labor:120, tech:'drilling', mine:{depth:6, rate:3, fluid:true}},
  gas_well:     {label:'Gas well',            cat:'extraction',w:2,h:2, prop:'derrick', mat:{steel:24}, labor:120, tech:'drilling', mine:{depth:6, rate:3, fluid:true}},
  pipeline:     {label:'Pipeline',            cat:'infra',w:1,h:1, prop:'pipe', mat:{steel:30}, labor:120, tech:'refining'},
  // infrastructure (tile structures)
  footbridge:   {label:'Log footbridge',      cat:'bridge',w:1,h:1, tile:'BRIDGE', mat:{wood:30, rope:4}, labor:50, know:{construction:15}, bridge:{dur:45, width:1}},
  timber_bridge:{label:'Timber bridge',       cat:'bridge',w:1,h:2, tile:'BRIDGE', mat:{lumber:40, wood:30}, labor:120, tech:'carpentry', bridge:{dur:70, width:2}},
  stone_bridge: {label:'Stone bridge',        cat:'bridge',w:1,h:2, tile:'BRIDGE', mat:{stone:160, lumber:20}, labor:320, tech:'arches', bridge:{dur:98, width:2}},
  dock:         {label:'Dock',                cat:'infra',w:1,h:3, tile:'DOCK', mat:{lumber:30, wood:10}, labor:60, tech:'carpentry', dock:true},
  road:         {label:'Road',                cat:'infra',w:1,h:1, tile:'PATH', mat:{stone:2}, labor:2, tech:'road_building', road:1},
  paved_road:   {label:'Paved road',          cat:'infra',w:1,h:1, tile:'PATH', mat:{stone:3, cement:1}, labor:3, tech:'paving', road:2},
  waterworks:   {label:'Waterworks',          cat:'infra',w:4,h:3, style:'stone', mat:{brick:80, metal:30}, labor:260, tech:'plumbing', water:true},
  sewage:       {label:'Sewage works',        cat:'infra',w:4,h:3, style:'stone', mat:{brick:80, metal:20}, labor:240, tech:'sanitation', sanit:true},
  power_plant:  {label:'Power station',       cat:'infra',w:5,h:4, style:'stone', mat:{brick:160, steel:60}, labor:520, tech:'electricity', power:true},
  station:      {label:'Railway station',     cat:'transport',w:5,h:3, style:'hall', roof:'#4a4a5a', mat:{brick:120, steel:40}, labor:420, tech:'railways'},
  // street lighting: each kind upgrades to the next as the town learns more and grows
  torch_post:   {label:'Torch post',          cat:'lighting',w:1,h:1, prop:'torch', mat:{wood:3}, labor:2, light:{kind:'torch', r:40, stage:0}, up:['oil_lantern']},
  oil_lantern:  {label:'Oil lantern post',    cat:'lighting',w:1,h:1, prop:'lantern', mat:{wood:3, clay:2}, labor:4, tech:'pottery', light:{kind:'lantern', r:52, stage:1}, up:['gas_lamp']},
  gas_lamp:     {label:'Gas street lamp',     cat:'lighting',w:1,h:1, prop:'gaslamp', mat:{metal:4, glass:1}, labor:8, tech:'gas_lighting', light:{kind:'gas', r:64, stage:2}, up:['electric_lamp']},
  electric_lamp:{label:'Electric street light',cat:'lighting',w:1,h:1, prop:'streetlight', mat:{steel:3, glass:1}, labor:10, tech:'electricity', light:{kind:'electric', r:84, stage:3, power:true}},
  // transport: the places vehicles are kept, built and boarded
  stable:       {label:'Stable',              cat:'transport',w:3,h:2, style:'barn', roof:'#8a5a2a', mat:{wood:28, thatch:6}, labor:32, tech:'riding', transport:'stable'},
  boathouse:    {label:'Boathouse',           cat:'transport',w:3,h:2, style:'barn', roof:'#5a6a7a', mat:{wood:30, thatch:6}, labor:36, tech:'boatbuilding', transport:'boats', up:['shipyard']},
  shipyard:     {label:'Shipyard & harbour',  cat:'transport',w:5,h:3, style:'barn', roof:'#4a5a6a', mat:{lumber:60, stone:30, rope:10}, labor:160, tech:'sailing', transport:'ships'},
  airfield:     {label:'Airfield',            cat:'transport',w:9,h:3, tile:'PLAZA', mat:{stone:60, cement:20}, labor:160, tech:'aviation', transport:'planes'},
  latrine:      {label:'Latrines',            cat:'infra',w:2,h:1, style:'hut', roof:'#6a5a3a', mat:{wood:10}, labor:10, sanit:0.4},
  // leisure and sport
  sports_field: {label:'Sports field',        cat:'leisure',w:6,h:4, tile:'GRASS', prop:'goals', mat:{wood:10}, labor:20},
  arena:        {label:'Sports arena',        cat:'leisure',w:6,h:5, style:'arena', mat:{lumber:100, stone:60}, labor:300, tech:'sawn_lumber'},
  theater:      {label:'Theater',             cat:'leisure',w:5,h:4, style:'theater', mat:{lumber:90, stone:40, cloth:10}, labor:260, tech:'sawn_lumber', biz:true}
};
for (const k in STRUCTURES) STRUCTURES[k].id = k;
const HOME_ORDER = ['lean_to','crude_hut','longhouse','wattle_hut','timber_cabin','cottage','stone_cottage','townhouse','duplex','row_houses','boarding','dormitory','apartments','tower','mansion','estate'];

// ---------- businesses: data-driven, so any industry is one entry ----------
// in/out: units per worker-hour; svc: a service sold to visitors; demand: what customers need it for
// skills/know: what a founder should have; equip: goods needed to start; start: startup cost in coins
const BUSINESS_TYPES = {
  bakery:      {label:'Bakery', industry:'food', in:{grain:0.8, wood:0.1}, out:{bread:1.4}, skills:{cooking:30}, tech:'baking', equip:['pottery'], start:60, workers:[1,4], bld:['bakery','workshop','shop']},
  mill:        {label:'Mill', industry:'food', in:{grain:1.6}, out:{grain:1.7}, skills:{crafting:30}, tech:'milling', start:120, workers:[1,3], bld:['mill']},
  smokehouse:  {label:'Smokehouse', industry:'food', in:{fish:0.7, game:0.3, wood:0.2}, out:{preserved:0.9}, skills:{cooking:25}, tech:'smoking', start:25, workers:[1,3], bld:['drying_rack','workshop']},
  brewery:     {label:'Brewery', industry:'food', in:{grain:0.6}, out:{ale:1.5}, skills:{cooking:30}, tech:'brewing', start:90, workers:[1,4], bld:['brewery']},
  dairy:       {label:'Dairy', industry:'food', in:{milk:1}, out:{preserved:0.5}, skills:{herding:30}, tech:'cheesemaking', start:80, workers:[1,4], bld:['dairy']},
  food_plant:  {label:'Food cannery', industry:'food', in:{veg:1.2, meat:0.4}, out:{preserved:2}, skills:{management:40}, tech:'canning', start:600, workers:[4,20], bld:['food_plant']},
  farm_co:     {label:'Farm', industry:'agriculture', in:{}, out:{}, skills:{farming:40}, tech:'cultivation', start:40, workers:[1,10], bld:['field','farm','orchard'], land:true},
  ranch_co:    {label:'Ranch', industry:'agriculture', in:{}, out:{}, skills:{herding:40}, tech:'domestication', start:60, workers:[1,8], bld:['pen','ranch'], land:true},
  lumber_camp: {label:'Lumber camp', industry:'forestry', in:{}, out:{wood:3}, skills:{woodcutting:45}, start:30, workers:[1,10], bld:['workshop'], wild:'tree'},
  sawmill:     {label:'Sawmill', industry:'forestry', in:{wood:2}, out:{lumber:1.2}, skills:{carpentry:40}, tech:'saws', start:200, workers:[2,10], bld:['sawmill']},
  carpentry:   {label:'Carpentry shop', industry:'crafts', in:{lumber:0.4}, out:{furniture:0.15}, skills:{carpentry:40}, tech:'carpentry', start:60, workers:[1,5], bld:['workshop','shop']},
  toolmaker:   {label:'Toolmaker', industry:'crafts', in:{stone:0.4, wood:0.3}, out:{tools:0.5}, skills:{crafting:35}, start:20, workers:[1,4], bld:['workshop']},
  smithy:      {label:'Smithy', industry:'metal', in:{metal:0.3, coal:0.2}, out:{mtools:0.3}, skills:{smithing:40}, tech:'ironworking', start:150, workers:[1,5], bld:['forge']},
  smelter:     {label:'Smelter', industry:'metal', in:{iron:1, coal:0.6}, out:{metal:0.6}, skills:{smithing:35}, tech:'smelting', start:180, workers:[2,8], bld:['forge','foundry']},
  steelworks:  {label:'Steelworks', industry:'metal', in:{metal:1, coal:1}, out:{steel:0.7}, skills:{engineering:45}, tech:'steelmaking', start:1500, workers:[8,40], bld:['steelworks']},
  pottery:     {label:'Pottery', industry:'crafts', in:{clay:0.8, wood:0.2}, out:{pottery:0.6}, skills:{crafting:30}, tech:'pottery', start:30, workers:[1,4], bld:['kiln','workshop']},
  brickworks:  {label:'Brickworks', industry:'construction', in:{clay:1.2, wood:0.4}, out:{brick:1.5}, skills:{stonework:35}, tech:'bricks', start:160, workers:[2,10], bld:['brickworks']},
  glassworks:  {label:'Glassworks', industry:'construction', in:{stone:0.6, wood:0.6}, out:{glass:0.4}, skills:{crafting:45}, tech:'glassmaking', start:220, workers:[2,8], bld:['workshop','foundry']},
  cementworks: {label:'Cement works', industry:'construction', in:{stone:1.2, coal:0.4}, out:{cement:0.9}, skills:{engineering:40}, tech:'cement', start:400, workers:[3,12], bld:['factory','brickworks']},
  weaver:      {label:'Weaver', industry:'textiles', in:{fiber:1}, out:{cloth:0.4, rope:0.3}, skills:{weaving:30}, tech:'weaving', start:25, workers:[1,4], bld:['workshop']},
  textile_mill:{label:'Textile mill', industry:'textiles', in:{fiber:2}, out:{cloth:1.6}, skills:{management:40}, tech:'mechanical_loom', start:900, workers:[6,30], bld:['textile_mill']},
  tailor:      {label:'Tailor', industry:'textiles', in:{cloth:0.4}, out:{clothes:0.3}, skills:{weaving:40}, tech:'weaving', start:40, workers:[1,3], bld:['clothing_shop','workshop']},
  builder_co:  {label:'Construction company', industry:'construction', in:{}, out:{}, skills:{construction:50}, start:80, workers:[2,20], bld:['workshop','office'], contractor:true},
  mining_co:   {label:'Mining company', industry:'mining', in:{}, out:{}, skills:{mining:40}, tech:'mining', start:300, workers:[2,30], bld:['pit','mine','open_pit','deep_mine','quarry'], mine:true},
  oil_co:      {label:'Oil company', industry:'energy', in:{}, out:{}, skills:{engineering:45}, tech:'drilling', start:1200, workers:[3,30], bld:['oil_well','gas_well','test_well'], mine:true},
  refinery:    {label:'Refinery', industry:'energy', in:{oil:1}, out:{kerosene:0.5, fuel:0.4}, skills:{chemistry:45}, tech:'refining', start:1500, workers:[4,20], bld:['refinery']},
  chem_co:     {label:'Chemical works', industry:'chemicals', in:{oil:0.4, salt:0.3}, out:{chemicals:0.5}, skills:{chemistry:55}, tech:'industrial_chemistry', start:1600, workers:[4,20], bld:['chem_plant']},
  general_store:{label:'General store', industry:'retail', retail:true, skills:{trading:35}, start:120, workers:[1,4], bld:['general_store','shop']},
  grocery:     {label:'Grocery', industry:'retail', retail:['food'], skills:{trading:30}, start:80, workers:[1,4], bld:['grocery','shop']},
  hardware:    {label:'Hardware store', industry:'retail', retail:['crafted','material'], skills:{trading:35}, start:120, workers:[1,4], bld:['hardware','shop']},
  jeweler:     {label:'Jeweller', industry:'retail', in:{gold:0.05, gems:0.03}, svc:'jewelry', skills:{crafting:50}, tech:'goldsmithing', start:300, workers:[1,3], bld:['jeweler','shop']},
  bookstore:   {label:'Bookseller', industry:'retail', retail:['crafted'], skills:{trading:30}, tech:'printing', start:120, workers:[1,3], bld:['bookstore','shop']},
  department:  {label:'Department store', industry:'retail', retail:true, skills:{management:50}, start:1500, workers:[6,30], bld:['department']},
  pub:         {label:'Pub', industry:'hospitality', in:{ale:0.3}, svc:'drink', skills:{cooking:20}, start:60, workers:[1,4], bld:['pub','inn']},
  cafe:        {label:'Café', industry:'hospitality', in:{bread:0.2}, svc:'meal', skills:{cooking:30}, start:80, workers:[1,4], bld:['cafe','shop']},
  restaurant:  {label:'Restaurant', industry:'hospitality', in:{meat:0.2, veg:0.3}, svc:'meal', skills:{cooking:45}, start:150, workers:[2,8], bld:['restaurant']},
  inn:         {label:'Inn', industry:'hospitality', svc:'lodging', skills:{management:25}, start:200, workers:[1,5], bld:['inn','boarding']},
  hotel:       {label:'Hotel', industry:'hospitality', svc:'lodging', skills:{management:45}, start:900, workers:[4,20], bld:['hotel']},
  theater_co:  {label:'Theater', industry:'leisure', svc:'show', skills:{management:30}, start:300, workers:[2,10], bld:['theater']},
  healer:      {label:'Healing practice', industry:'health', svc:'care', skills:{medicine:30}, start:10, workers:[1,3], bld:['healer_hut','clinic']},
  clinic:      {label:'Clinic', industry:'health', svc:'care', skills:{medicine:45}, start:200, workers:[2,8], bld:['clinic']},
  hospital:    {label:'Hospital', industry:'health', svc:'care', skills:{medicine:60}, tech:'germ_theory', start:1200, workers:[6,40], bld:['hospital']},
  pharmacy:    {label:'Pharmacy', industry:'health', in:{fiber:0.2}, out:{medicine:0.3}, skills:{chemistry:40}, tech:'pharmacology', start:180, workers:[1,4], bld:['pharmacy']},
  dentist:     {label:'Dentist', industry:'health', svc:'dental', skills:{medicine:40}, start:150, workers:[1,3], bld:['dentist']},
  vet:         {label:'Veterinary clinic', industry:'health', svc:'vet', skills:{herding:40}, start:120, workers:[1,3], bld:['vet']},
  law_office:  {label:'Law office', industry:'professional', svc:'legal', skills:{law:45}, know:{law:40}, tech:'writing', start:120, workers:[1,6], bld:['office','shop']},
  accounting:  {label:'Accounting firm', industry:'professional', svc:'accounts', skills:{accounting:45}, tech:'bookkeeping', start:100, workers:[1,6], bld:['office']},
  realty:      {label:'Real-estate office', industry:'professional', svc:'realty', skills:{negotiation:40}, start:100, workers:[1,4], bld:['office','shop']},
  insurance:   {label:'Insurance office', industry:'professional', svc:'insurance', skills:{accounting:45}, know:{mathematics:35}, tech:'probability', start:500, workers:[1,6], bld:['office']},
  investment:  {label:'Investment office', industry:'professional', svc:'invest', skills:{investing:50}, start:500, workers:[1,6], bld:['office','bank']},
  advertising: {label:'Advertising firm', industry:'professional', svc:'ads', skills:{negotiation:40}, tech:'printing', start:200, workers:[1,6], bld:['office']},
  consulting:  {label:'Consulting firm', industry:'professional', svc:'consulting', skills:{management:55}, start:250, workers:[1,6], bld:['office']},
  newspaper:   {label:'Newspaper', industry:'media', in:{fiber:0.2}, out:{books:0.05}, svc:'news', skills:{journalism:35}, tech:'printing', start:200, workers:[1,6], bld:['office','shop']},
  carting:     {label:'Carting company', industry:'transport', svc:'haulage', skills:{trading:30}, tech:'wheel', start:120, workers:[1,6], bld:['barn','workshop']}
};
for (const k in BUSINESS_TYPES) BUSINESS_TYPES[k].id = k;

// ---------- organizations: one architecture for every kind of group ----------
// own: how ownership is held; shares: can issue tradable shares; members: has members rather than owners
const ORG_TYPES = {
  sole:        {label:'Sole proprietorship', own:'single'},
  partnership: {label:'Partnership',         own:'multi'},
  family:      {label:'Family business',     own:'multi', family:true},
  coop:        {label:'Cooperative',         own:'members'},
  private_co:  {label:'Private company',     own:'shares'},
  corporation: {label:'Corporation',         own:'shares', shares:true},
  public_corp: {label:'Public corporation',  own:'shares', shares:true, listed:true},
  holding:     {label:'Holding company',     own:'shares', shares:true},
  bank:        {label:'Bank',                own:'shares', finance:true},
  credit_union:{label:'Credit union',        own:'members', finance:true},
  nonprofit:   {label:'Nonprofit',           own:'none'},
  charity:     {label:'Charity',             own:'none'},
  guild:       {label:'Guild',               own:'members'},
  trade_assoc: {label:'Trade association',   own:'members'},
  union:       {label:'Labour union',        own:'members'},
  team:        {label:'Sports club',         own:'multi'},
  league:      {label:'Sports league',       own:'members'},
  school:      {label:'School',              own:'none'},
  edu_school:  {label:'Specialised school',  own:'none'},
  institute:   {label:'Research institute',  own:'none'},
  government:  {label:'Government',          own:'none'},
  exchange:    {label:'Stock exchange',      own:'members'}
};

// ---------- technologies: prerequisites, but several roads lead to most of them ----------
// need: knowledge levels; any: at least one of these groups must be fully met (techs or theories); prac: practice that can
// stumble on it; disc: the research discipline that studies it
const TECHS = {
  fire_hardening:{label:'Fire-hardened spears', cat:'hunting', need:{wilderness:10}, prac:'hunt', disc:'physics'},
  smoking:       {label:'Smoking & drying food',cat:'food',     need:{foodcraft:12}, prac:'cook', disc:'chemistry'},
  // keeping food: each technique makes some foods last longer (store: multiplies the days before they spoil)
  storage_pits:  {label:'Storage pits & sealed baskets', cat:'food', need:{foodcraft:10, crafts:8}, prac:['gather','forage'], disc:'chemistry', store:{roots:1.6, grain:1.4, veg:1.3, berries:1.2}},
  salting:       {label:'Salting & curing',     cat:'food', need:{foodcraft:16}, any:[['smoking']], prac:['cook','fish','hunt'], disc:'chemistry', store:{fish:1.8, game:1.7, meat:1.7}},
  sealed_jars:   {label:'Sealed storage jars',  cat:'food', need:{crafts:20, foodcraft:16}, any:[['pottery']], prac:'cook', disc:'chemistry', store:{grain:1.5, preserved:1.3, roots:1.3, berries:1.6, milk:1.4, eggs:1.3}},
  root_cellar:   {label:'Root cellars',         cat:'food', need:{construction:20, foodcraft:12}, any:[['well_digging'],['carpentry']], prac:'build', disc:'engineering', store:{veg:1.8, roots:1.6, eggs:1.5, milk:1.6, bread:1.2}},
  raised_granary:{label:'Raised, ventilated granaries', cat:'food', need:{construction:26, agriculture:20}, any:[['carpentry','cultivation']], prac:'farm', disc:'engineering', store:{grain:1.6}, commons:0.8},
  pest_control:  {label:'Keeping pests out of stores', cat:'food', need:{biology:16, husbandry:10}, any:[['domestication'],['pottery']], prac:'herd', disc:'biology', store:{all:1.25}},
  nets:          {label:'Fishing nets',         cat:'food',     need:{crafts:10, wilderness:10}, prac:'fish', disc:'physics'},
  cultivation:   {label:'Cultivation',          cat:'agriculture', need:{agriculture:14}, prac:'forage', disc:'biology'},
  domestication: {label:'Animal domestication', cat:'agriculture', need:{husbandry:12, wilderness:18}, prac:'hunt', disc:'biology'},
  pottery:       {label:'Pottery',              cat:'crafts',   need:{crafts:14}, prac:'gather', disc:'chemistry'},
  weaving:       {label:'Weaving',              cat:'crafts',   need:{crafts:12}, prac:'gather', disc:'physics'},
  carpentry:     {label:'Joinery & carpentry',  cat:'construction', need:{construction:20, crafts:14}, prac:'build', disc:'engineering'},
  well_digging:  {label:'Well digging',         cat:'sanitation', need:{construction:16, geology:6}, prac:'build', disc:'geology'},
  counting:      {label:'Counting & tallies',   cat:'communication', need:{mathematics:10}, prac:'trade', disc:'mathematics'},
  writing:       {label:'Writing',              cat:'communication', need:{literacy:12}, any:[['counting']], prac:'trade', disc:'mathematics'},
  bookkeeping:   {label:'Bookkeeping',          cat:'finance', need:{finance:18, mathematics:20}, any:[['writing']], prac:'lend', disc:'mathematics'},
  currency:      {label:'Coinage',              cat:'finance', need:{trade:22}, any:[['smelting'],['counting']], disc:'mathematics'},
  plough:        {label:'The plough',           cat:'agriculture', need:{agriculture:30}, any:[['domestication','carpentry']], prac:'farm', disc:'agriscience'},
  crop_rotation: {label:'Crop rotation',        cat:'agriculture', need:{agriscience:30}, any:[['plough'],['th_soil_nutrients']], prac:'farm', disc:'agriscience'},
  irrigation:    {label:'Irrigation',           cat:'agriculture', need:{agriculture:28, engineering:14}, any:[['well_digging']], prac:'farm', disc:'engineering'},
  milling:       {label:'Milling',              cat:'food', need:{engineering:18}, any:[['cultivation','carpentry']], disc:'engineering'},
  baking:        {label:'Baking',               cat:'food', need:{foodcraft:22}, any:[['cultivation','pottery']], prac:'cook', disc:'chemistry'},
  brewing:       {label:'Brewing',              cat:'food', need:{foodcraft:24}, any:[['cultivation','pottery']], prac:'cook', disc:'chemistry'},
  cheesemaking:  {label:'Cheesemaking',         cat:'food', need:{foodcraft:24, husbandry:20}, any:[['domestication']], prac:'herd', disc:'biology'},
  quarrying:     {label:'Quarrying',            cat:'mining', need:{geology:14, construction:16}, prac:'quarry', disc:'geology'},
  masonry:       {label:'Masonry',              cat:'construction', need:{construction:32}, any:[['quarrying'],['carpentry']], prac:'build', disc:'engineering'},
  arches:        {label:'The arch',             cat:'construction', need:{construction:42, mathematics:24}, any:[['masonry']], disc:'engineering'},
  smelting:      {label:'Copper smelting',      cat:'metal', need:{chemistry:12, crafts:22}, any:[['pottery']], prac:'craft', disc:'chemistry'},
  bronze:        {label:'Bronze',               cat:'metal', need:{chemistry:22}, any:[['smelting']], disc:'chemistry'},
  ironworking:   {label:'Ironworking',          cat:'metal', need:{chemistry:30, crafts:34}, any:[['bronze'],['smelting','th_combustion']], prac:'craft', disc:'chemistry'},
  saws:          {label:'Metal saws',           cat:'construction', need:{crafts:30}, any:[['ironworking'],['bronze']], disc:'engineering'},
  sawn_lumber:   {label:'Sawn lumber',          cat:'construction', need:{construction:26}, any:[['saws'],['carpentry','bronze']], prac:'chop', disc:'engineering'},
  mining:        {label:'Shaft mining',         cat:'mining', need:{geology:26, engineering:18}, any:[['quarrying','carpentry']], prac:'mine', disc:'geology'},
  wheel:         {label:'The wheel & carts',    cat:'transport', need:{engineering:14, crafts:18}, any:[['carpentry']], disc:'engineering'},
  road_building: {label:'Road building',        cat:'transport', need:{engineering:20, construction:24}, any:[['wheel'],['quarrying']], disc:'engineering'},
  paving:        {label:'Paved roads',          cat:'transport', need:{engineering:38}, any:[['road_building','cement']], disc:'engineering'},
  bricks:        {label:'Fired bricks',         cat:'construction', need:{construction:34, chemistry:14}, any:[['pottery']], disc:'chemistry'},
  glassmaking:   {label:'Glassmaking',          cat:'manufacturing', need:{chemistry:30}, any:[['bricks'],['smelting']], disc:'chemistry'},
  optics:        {label:'Lenses & optics',      cat:'science', need:{physics:32}, any:[['glassmaking']], disc:'physics'},
  goldsmithing:  {label:'Goldsmithing',         cat:'crafts', need:{crafts:34}, any:[['smelting']], disc:'chemistry'},
  printing:      {label:'The printing press',   cat:'communication', need:{engineering:30, literacy:30}, any:[['writing','ironworking']], disc:'engineering'},
  probability:   {label:'Probability',          cat:'finance', need:{mathematics:42}, any:[['writing']], disc:'mathematics'},
  herbal_remedies:{label:'Herbal remedies',     cat:'medicine', need:{medicine:10, biology:8}, prac:'heal', disc:'medicine'},
  surgery:       {label:'Basic surgery',        cat:'medicine', need:{medicine:34, biology:24}, any:[['herbal_remedies','ironworking']], disc:'medicine'},
  pharmacology:  {label:'Pharmacology',         cat:'medicine', need:{medicine:40, chemistry:34}, any:[['herbal_remedies','glassmaking']], disc:'chemistry'},
  germ_theory:   {label:'Germ theory',          cat:'medicine', need:{medicine:48, biology:40}, any:[['th_germs','optics']], disc:'medicine'},
  vaccination:   {label:'Vaccination',          cat:'medicine', need:{medicine:56, biology:48}, any:[['germ_theory']], disc:'medicine'},
  sanitation:    {label:'Sanitation',           cat:'sanitation', need:{envscience:30, engineering:30}, any:[['germ_theory'],['th_miasma']], disc:'envscience'},
  plumbing:      {label:'Piped water',          cat:'sanitation', need:{engineering:40}, any:[['well_digging','ironworking']], disc:'engineering'},
  cement:        {label:'Cement',               cat:'construction', need:{chemistry:36, construction:40}, any:[['bricks','th_combustion']], disc:'chemistry'},
  explosives:    {label:'Blasting powder',      cat:'mining', need:{chemistry:44}, any:[['th_combustion']], disc:'chemistry'},
  steam_power:   {label:'Steam power',          cat:'energy', need:{physics:44, engineering:44}, any:[['ironworking','th_heat_work']], disc:'physics'},
  steelmaking:   {label:'Steelmaking',          cat:'metal', need:{chemistry:46, engineering:40}, any:[['ironworking','steam_power']], disc:'chemistry'},
  mechanical_loom:{label:'Mechanical loom',     cat:'manufacturing', need:{engineering:40}, any:[['weaving','steam_power']], disc:'engineering'},
  multi_storey:  {label:'Multi-storey building',cat:'construction', need:{construction:55, engineering:40}, any:[['bricks','cement']], disc:'engineering'},
  steel_frame:   {label:'Steel-frame building', cat:'construction', need:{construction:66, engineering:55}, any:[['steelmaking','multi_storey']], disc:'engineering'},
  railways:      {label:'Railways',             cat:'transport', need:{engineering:55}, any:[['steam_power','steelmaking']], disc:'engineering'},
  drilling:      {label:'Well drilling',        cat:'energy', need:{geology:40, engineering:40}, any:[['steam_power'],['ironworking','th_oil_origin']], disc:'geology'},
  refining:      {label:'Oil refining',         cat:'energy', need:{chemistry:50}, any:[['drilling','th_hydrocarbons']], disc:'chemistry'},
  industrial_chemistry:{label:'Industrial chemistry', cat:'manufacturing', need:{chemistry:60}, any:[['refining']], disc:'chemistry'},
  canning:       {label:'Canning',              cat:'food', need:{foodcraft:40, chemistry:30}, any:[['th_germs','ironworking']], disc:'chemistry', store:{veg:2.5, meat:2.5, fish:2.5, game:2, milk:1.5, berries:2}},
  refrigeration: {label:'Refrigeration',        cat:'food', need:{physics:56, chemistry:50}, any:[['steam_power','th_heat_work']], disc:'physics', store:{all:2}},
  electricity:   {label:'Electricity',          cat:'energy', need:{physics:62}, any:[['th_electromagnetism','steelmaking']], disc:'physics'},
  telegraph:     {label:'The telegraph',        cat:'communication', need:{physics:58}, any:[['electricity']], disc:'physics'},
  gas_lighting:  {label:'Gas lighting',         cat:'energy', need:{chemistry:38}, any:[['ironworking','th_combustion'],['refining']], disc:'chemistry'},
  // getting about: each one puts new vehicles on the roads, rivers and sky
  riding:        {label:'Horse riding',         cat:'transport', need:{husbandry:18}, any:[['domestication']], prac:'herd', disc:'biology'},
  boatbuilding:  {label:'Boatbuilding',         cat:'transport', need:{crafts:14, wilderness:12}, any:[['carpentry'],['weaving']], prac:'fish', disc:'engineering'},
  wagons:        {label:'Horse-drawn wagons',   cat:'transport', need:{engineering:22}, any:[['wheel','riding']], disc:'engineering'},
  sailing:       {label:'Sailing ships',        cat:'transport', need:{engineering:30}, any:[['boatbuilding','weaving']], disc:'engineering'},
  steamships:    {label:'Steamships',           cat:'transport', need:{engineering:50}, any:[['sailing','steam_power']], disc:'engineering'},
  combustion_engine:{label:'The combustion engine', cat:'energy', need:{engineering:56, chemistry:46}, any:[['refining','steelmaking']], disc:'engineering'},
  automobiles:   {label:'Motor cars',           cat:'transport', need:{engineering:58}, any:[['combustion_engine','road_building']], disc:'engineering'},
  aviation:      {label:'Powered flight',       cat:'transport', need:{physics:60, engineering:64}, any:[['combustion_engine']], disc:'physics'}
};
for (const k in TECHS) TECHS[k].id = k;

// ---------- theories: ideas about the world; some are true, some are wrong but can still catch on ----------
const THEORIES = {
  th_seasons:        {label:'The seasons follow the sun\'s path', disc:'astronomy', truth:true,  need:{astronomy:8}},
  th_soil_nutrients: {label:'Crops drain the soil of nourishment', disc:'agriscience', truth:true, need:{agriculture:22}},
  th_moon_planting:  {label:'Crops sown at full moon grow best',   disc:'agriscience', truth:false, need:{agriculture:10}, harm:{farm:0.95}},
  th_humors:         {label:'Illness is an imbalance of the humours', disc:'medicine', truth:false, need:{medicine:14}, harm:{care:0.85}},
  th_miasma:         {label:'Disease spreads through bad air',       disc:'medicine', truth:false, need:{medicine:22}, helps:{sanit:0.6}},
  th_germs:          {label:'Disease is spread by tiny living things', disc:'biology', truth:true, need:{biology:36, medicine:30}},
  th_combustion:     {label:'Burning combines with something in the air', disc:'chemistry', truth:true, need:{chemistry:24}},
  th_phlogiston:     {label:'Burning releases a fire-substance',   disc:'chemistry', truth:false, need:{chemistry:16}},
  th_heat_work:      {label:'Heat can be turned into work',        disc:'physics', truth:true, need:{physics:34}},
  th_electromagnetism:{label:'Electricity and magnetism are one force', disc:'physics', truth:true, need:{physics:50}},
  th_oil_origin:     {label:'Rock oil pools under domed strata',   disc:'geology', truth:true, need:{geology:34}},
  th_hydrocarbons:   {label:'Rock oil is a mixture that can be separated', disc:'chemistry', truth:true, need:{chemistry:40}},
  th_ore_veins:      {label:'Ore follows quartz veins',            disc:'geology', truth:true, need:{geology:16}},
  th_dowsing:        {label:'A forked stick can find water and ore', disc:'geology', truth:false, need:{geology:4}, harm:{prospect:0.8}},
  th_flat_rock:      {label:'The land sits on one great flat stone', disc:'geology', truth:false, need:{geology:6}},
  th_supply_demand:  {label:'Prices follow scarcity',              disc:'mathematics', truth:true, need:{trade:22, mathematics:14}}
};
for (const k in THEORIES) THEORIES[k].id = k;

// ---------- minerals and fuels hidden underground ----------
// depth 1-6 (1 = surface), clue: where signs show; freq: deposits per map
const MINERALS = [
  {id:'copper',  label:'Copper',   good:'copper',  depth:[1,3], freq:4, clue:'rock'},
  {id:'tin',     label:'Tin',      good:'tin',     depth:[1,3], freq:3, clue:'rock'},
  {id:'iron',    label:'Iron',     good:'iron',    depth:[1,4], freq:5, clue:'hill'},
  {id:'coal',    label:'Coal',     good:'coal',    depth:[1,4], freq:4, clue:'hill'},
  {id:'lead',    label:'Lead',     good:'lead',    depth:[2,4], freq:2, clue:'rock'},
  {id:'zinc',    label:'Zinc',     good:'zinc',    depth:[2,4], freq:2, clue:'rock'},
  {id:'nickel',  label:'Nickel',   good:'nickel',  depth:[3,5], freq:1, clue:'rock'},
  {id:'silver',  label:'Silver',   good:'silver',  depth:[2,5], freq:2, clue:'rock', precious:true},
  {id:'gold',    label:'Gold',     good:'gold',    depth:[1,5], freq:2, clue:'stream', precious:true},
  {id:'platinum',label:'Platinum', good:'platinum',depth:[4,6], freq:1, clue:'rock', precious:true},
  {id:'gems',    label:'Gemstones',good:'gems',    depth:[2,5], freq:2, clue:'rock', precious:true},
  {id:'salt',    label:'Salt',     good:'salt',    depth:[1,3], freq:2, clue:'flat'},
  {id:'rare',    label:'Rare minerals', good:'rare', depth:[4,6], freq:1, clue:'hill'},
  {id:'clay',    label:'Clay beds',good:'clay',    depth:[1,1], freq:3, clue:'stream'},
  {id:'oil',     label:'Petroleum',good:'oil',     depth:[5,6], freq:3, clue:'seep', fluid:true},
  {id:'gas',     label:'Natural gas', good:'gas',  depth:[5,6], freq:2, clue:'seep', fluid:true}
];
const MIN = Object.fromEntries(MINERALS.map(m=>[m.id,m]));

// ---------- neighbouring settlements ----------
const NEIGHBOR_DEFS = [
  {id:'nb_westford', name:'Westford',    dir:'W', dist:3, pop:[260,420], food:1.15, res:['grain','wood'],   ind:['farming','milling']},
  {id:'nb_saltmere', name:'Saltmere',    dir:'S', dist:5, pop:[180,300], food:1.05, res:['fish','salt'],    ind:['fishing','salt works']},
  {id:'nb_ironhold', name:'Ironhold',    dir:'N', dist:6, pop:[140,260], food:0.85, res:['iron','coal'],    ind:['mining','smithing']},
  {id:'nb_dunmoor',  name:'Dunmoor',     dir:'E', dist:8, pop:[400,700], food:1.0,  res:['cloth','tools'],  ind:['weaving','trade']},
  {id:'nb_greyholm', name:'Greyholm',    dir:'N', dist:9, pop:[90,160],  food:0.95, res:['hide','game'],    ind:['hunting','tanning']}
];
const GOV_FORMS = ['council of elders','chieftaincy','assembly','merchant council','theocratic circle','republic','oligarchy'];

// ---------- where the settlers came from: each seed draws one or two origin peoples ----------
// bg: indexes into BACKGROUNDS (civ_core.js) they tend to have; values they tend to hold
const ORIGINS = [
  {id:'farmers',  label:'a farming people',          bg:[0,0,1,7],   values:['Tradition','Family','Community']},
  {id:'hunters',  label:'forest hunters',            bg:[2,2,15,3],  values:['Freedom','Nature']},
  {id:'fishers',  label:'lake-shore fishers',        bg:[3,3,7,15],  values:['Community','Nature']},
  {id:'traders',  label:'travelling traders',        bg:[9,9,14,10], values:['Prosperity','Freedom']},
  {id:'artisans', label:'craftspeople from a burned town', bg:[4,5,6,11], values:['Craftsmanship','Prosperity']},
  {id:'scholars', label:'refugees from a city of learning', bg:[10,13,8,12], values:['Tradition','Order']},
  {id:'herders',  label:'upland herders',            bg:[1,1,2,7],   values:['Family','Tradition']}
];

// ---------- stages ----------
const SETTLEMENT_STAGES = [[0,'Camp'],[120,'Hamlet'],[220,'Village'],[500,'Town'],[1500,'City'],[5000,'Major city']];
const GOV_STAGES = ['none','gatherings','council','leadership','offices','elections','laws','taxation','departments'];
const JUSTICE_STAGES = ['informal','mediation','watch','constable','investigator','magistrate','court','jail','lawyers'];
const MARKET_STAGES = ['none','barter','meeting place','trading spot','market stalls','shops','commercial district'];
const EDU_STAGES = ['none','informal','community school','primary school','secondary school','trade school','academy','college','university','research university'];
const FIN_STAGES = ['none','informal lending','moneylenders','credit organisations','banks','financial institutions'];
