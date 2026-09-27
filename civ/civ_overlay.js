/* =====================================================================
   Pixel Town — new systems for classic towns
   Old saves keep their buildings, professions and institutions. From the day they load, their villagers
   also get the modular mind (cognition, knowledge, skills, techniques), learn from their work,
   research, prospect for hidden minerals, and hear from neighbouring settlements.
   ===================================================================== */
const PROF_BACKGROUND = {
  Farmer:{k:{agriculture:45, agriscience:12}, s:{farming:55}, t:['cultivation','plough']}, Rancher:{k:{husbandry:45}, s:{herding:55}, t:['domestication']},
  Fisher:{k:{wilderness:40}, s:{fishing:55}, t:['nets','smoking']}, Woodcutter:{k:{wilderness:30, construction:15}, s:{woodcutting:55}, t:['saws']},
  Miner:{k:{geology:35, engineering:15}, s:{mining:50, stonework:30, geology:25}, t:['quarrying','mining']}, Baker:{k:{foodcraft:45}, s:{cooking:55}, t:['baking','milling']},
  Blacksmith:{k:{crafts:45, chemistry:20}, s:{smithing:55}, t:['smelting','ironworking']}, Carpenter:{k:{construction:45, crafts:25}, s:{carpentry:55, construction:45}, t:['carpentry','sawn_lumber']},
  Butcher:{k:{foodcraft:35, husbandry:15}, s:{cooking:40}, t:['smoking']}, TavernKeeper:{k:{foodcraft:30, trade:20}, s:{cooking:35, trading:30}, t:['brewing']},
  Doctor:{k:{medicine:60, biology:35, chemistry:15}, s:{medicine:60}, t:['herbal_remedies','surgery']}, Merchant:{k:{trade:50, finance:25, mathematics:20, geography:25}, s:{trading:55, negotiation:40, accounting:30}, t:['counting','writing','bookkeeping','currency']},
  Teacher:{k:{teaching:50, literacy:50, history:35, mathematics:30}, s:{teaching:55}, t:['writing','counting']}, Journalist:{k:{literacy:50, history:30}, s:{journalism:50}, t:['writing','printing']},
  Constable:{k:{law:30}, s:{investigation:40}, t:[]}, Investigator:{k:{law:40}, s:{investigation:55}, t:['writing']}, Magistrate:{k:{law:60, history:25}, s:{law:55}, t:['writing']}, Advocate:{k:{law:55}, s:{law:50, negotiation:40}, t:['writing']},
  Musician:{k:{history:15}, s:{}, t:[]}, Athlete:{k:{}, s:{athletics:55}, t:[]}, Child:{k:{}, s:{}, t:[]}
};
function civOverlayInit(){
  if (!S.civ) S.civ = civBlankState(hash(String(S.founded||1)) % 1e9);
  S.civ.overlay = true;
  if (!S.civ.deposits.length){ civDepositsInit(); }
  if (!S.civ.neighbors.length) civNeighborsInit();
  S.citizens.forEach(civOverlayPerson);
  civTechRecount();
}
function civOverlayPerson(c){
  if (c.civ && c.civ.cog) return;
  const r = mapRand(hash(c.id+'ovl'));
  civPersonExt(c, r, civGenes(r));
  const X = c.civ; X.genes.skin = c.look ? c.look.skin : X.genes.skin; X.genes.hair = c.look ? c.look.hair : X.genes.hair;
  X.cog = civCogProfile(r); X.know = {}; X.skill = {}; X.techs = [];
  const B = PROF_BACKGROUND[c.profession] || {k:{trade:15}, s:{}, t:[]};
  for (const k in B.k) X.know[k] = Math.round(B.k[k]*(0.7+r()*0.6)); for (const k in B.s) X.skill[k] = Math.round(B.s[k]*(0.7+r()*0.6)); X.techs = B.t.slice();
  ['literacy','mathematics','construction'].forEach(k=>{ X.know[k] = Math.max(X.know[k]||0, Math.floor(r()*25)); });
  // the town's buildings imply what its people already know how to do
  ['carpentry','masonry','well_digging','pottery','weaving','counting','currency','writing','cultivation','domestication','smoking','sawn_lumber','quarrying','mining','smelting'].forEach(t=>{ if (!X.techs.includes(t) && isAdult(c) && r()<0.25) X.techs.push(t); });
  if (c.mind) c.mind.wit = civWit(c);
}
// shown once to a classic town the first time it loads with these systems
function civOverlayNews(next){
  overlay(`<h3>Pixel Town has new ways to think</h3><p>Your town and its history are exactly as you left them. From today:</p>
    <ul style="padding-left:18px;font-size:14px"><li><b>Minds and knowledge</b>: every villager now has strengths and blind spots of their own (reasoning, memory, planning, creativity and more), knowledge in 25 fields, skills and techniques, inferred from their trade. They improve with practice.</li>
    <li><b>Science</b>: curious villagers test ideas (some of them wrong) and work out new techniques. See the new <b>Science</b> tab.</li>
    <li><b>Hidden resources</b>: minerals, oil and gas lie under the hills; miners and the curious go prospecting.</li>
    <li><b>3D</b>: villagers are now jointed low-poly figures who age, and animals and props are real 3D models.</li>
    <li>New games start as a primitive settlement that must build everything itself. Press <b>Reset town</b> to try one.</li></ul>
    <div class="row" style="margin-top:10px"><button class="btn primary" id="ovGo">Back to town</button></div>`);
  $('ovGo').onclick = ()=>{ overlay(''); if (next) next(); };
}
const PROF_TASK = {Farmer:'farm', Rancher:'herd', Fisher:'fish', Woodcutter:'chop', Miner:'mine', Baker:'cook', Blacksmith:'craft', Carpenter:'build', Butcher:'cook', Doctor:'heal', Merchant:'trade', Teacher:'teach', Journalist:'research'};
function civOverlayDaily(d){
  if (!S.civ || !S.civ.overlay) return;
  S.citizens.forEach(c=>{ civOverlayPerson(c);
    const t = PROF_TASK[c.profession]; if (!t || !isAdult(c)) return;
    // a day's work at their trade is practice
    civLearnFromWork(c, {task:t}, 6, null);
  });
  civMindsDaily();
  if (d%7===0){
    civNeighborsWeekly(); civScienceWeekly();
    // the curious do research in the evenings; miners and the curious prospect the hills
    S.citizens.filter(c=>isAdult(c) && civTaskAvailable(c,'research')).slice(0,3).forEach(c=>CIV_WORK.research(c, {task:'research'}, 8));
    S.citizens.filter(c=>isAdult(c) && (c.profession==='Miner' || c.personality.openness>0.75)).slice(0,3).forEach(c=>{ const x = 60+Math.floor(rnd()*40), y = 2+Math.floor(rnd()*30); CIV_WORK.prospect(c, {task:'prospect', xy:[x,y]}, 6); });
  }
}
