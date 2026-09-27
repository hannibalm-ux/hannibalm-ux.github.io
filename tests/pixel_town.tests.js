// Pixel Town — automated tests for the justice, cognition and frontier systems.
// Each test builds its own small scenario inside a fresh town and checks the
// behaviour the design asks for. Run them all with:  node tests/run_tests.js
// (each test gets a fresh page). In a browser console you can also run
// PTTests.run('J7') on a freshly started town.
(function(){
  const TESTS = [];
  const test = (id, name, fn) => TESTS.push({id, name, fn});
  const ok = (cond, msg) => { if (!cond) throw new Error(msg || 'assertion failed'); };
  const day = () => dayOf(S.minute);
  const tick = n => { for (let i=0;i<n;i++) simTick(); };
  const days = n => tick(Math.round(n*DAY));
  const adults = f => S.citizens.filter(c=>isAdult(c) && !c.jail && !c.away && c.age>=20 && (!f || f(c)));
  const distinct = (n, f) => { const a = adults(f); ok(a.length>=n, `need ${n} adults`); return a.slice(0,n); };
  const hire = (c, prof) => { c.profession = prof; c.work = WORKPLACE[prof] || null; mindOf(c).careerDay = day(); };
  const strangers = list => list.forEach(a=>list.forEach(b=>{ if (a!==b){ delete a.rel[b.id]; } }));
  const honest = c => { c.traits = ['Honest','Hardworking']; c.personality.conscientiousness = 0.9; return c; };
  const crook = c => { c.traits = ['Greedy','Cunning']; c.personality.conscientiousness = 0.2; return c; };
  const quietCase = (kind, off, extra) => { const cs = commitCrime(kind, off, Object.assign({loc:'loc_town_square', text:'a test crime'}, extra||{})); cs.present=[]; cs.witnesses=[]; cs.statements=[]; cs.evidence=[]; cs.motive={}; cs.opportunity={}; cs.alibis={}; return cs; };
  const say = (cs, by, claim, conf) => cs.statements.push({by:by.id, claim:claim.id, conf, day:day()});
  const clue = (cs, to, strength) => cs.evidence.push({id:cs.id+'x'+cs.evidence.length, kind:'test', text:`A clue pointing at ${to.name}`, pointsTo:to.id, strength, rel:0.9, found:true, day:day()});
  const noJustice = () => S.citizens.forEach(c=>{ if (JUSTICE_PROFS.includes(c.profession) || c.profession==='Constable') hire(c, 'Farmer'); });
  const vote = (c, p) => { castVote(c, p); return p.votes[p.votes.length-1].score; };
  const law = (key, proposer) => { const C = CANDIDATES[key]; return {key, title:C.title, category:C.category, effects:JSON.parse(JSON.stringify(C.effects)), votes:[], proposerId:proposer.id, proposalId:'test_'+key+'_'+Math.floor(Math.random()*1e6), durationDays:C.durationDays}; };
  const annexVote = (t, proposer) => Object.assign(annexProposalDef(t), {key:'annex', votes:[], proposerId:proposer.id, proposalId:'test_annex_'+t.id, effects:[{effectType:'Annexation', targetZoneId:t.id, magnitude:t.cost}]});
  const tallyVotes = p => { S.citizens.filter(isAdult).forEach(c=>castVote(c, p)); const y = p.votes.filter(v=>v.choice==='Yes').length, n = p.votes.filter(v=>v.choice==='No').length; return {y, n}; };
  const explore = (dir) => { S.treasury = Math.max(S.treasury, 3000); for (let k=0;k<4;k++){ const r = launchExpedition(dir, 'player'); ok(r.e, r.err); const e = r.e; days(e.back - day() + 1); if (e.status==='returned') return {e, cell:cellOf(e.found)}; } throw new Error(`four expeditions ${dir} all failed`); };
  const reveal = (cx, cy) => discoverRegion(cx, cy, distinct(2), 'test');

  // ============================ JUSTICE ============================
  test('J1', 'Minor fight is still handled simply by a constable', ()=>{
    const cases0 = S.justice.cases.length; if (!S.citizens.some(c=>c.profession==='Constable')) hire(adults()[0], 'Constable');
    let fines = 0, quarrels = 0;
    for (let k=0;k<3;k++){ const end = (Math.floor(S.minute/(7*DAY))+1)*7*DAY - 1; tick(end - S.minute); fines += (S.week.justice||{}).brawlFines||0; quarrels += S.week.quarrels; tick(1); }
    ok(quarrels > 0, 'no quarrels happened');
    ok(fines > 0, 'no constable broke up a quarrel with a fine');
    ok(S.justice.cases.every(cs=>CRIME[cs.kind]), 'a quarrel became a case');
    ok(S.justice.cases.length - cases0 < fines, 'quarrels are being turned into cases');
  });
  test('J2', 'Serious vandalism creates a case', ()=>{
    const [off, vic] = distinct(2); const n0 = S.justice.cases.length;
    const cs = commitCrime('vandalism', off, {victims:[vic], loc:'loc_tavern', text:'smashing up the tavern'});
    ok(S.justice.cases.length === n0+1, 'no case was created'); ok(cs.sev >= 3, 'vandalism is not serious');
    ok(cs.status === 'REPORTED', `case status ${cs.status}`); ok(cs.truth.offender === off.id, 'hidden truth not recorded');
    ok(cs.victims.includes(vic.id), 'victim missing');
  });
  test('J3', 'Crime can remain unsolved', ()=>{
    const [off] = distinct(1, c=>c.profession!=='Constable');
    const cs = quietCase('burglary', off, {victims:[]});
    days(25);
    ok(cs.status === 'UNSOLVED', `a crime with no witnesses or clues ended as ${cs.status}`);
    ok(!cs.defendant, 'someone was arrested without evidence');
  });
  test('J4', 'Investigator can identify suspects', ()=>{
    const [off, inv, w1, w2, w3, vic] = distinct(6); hire(inv, 'Investigator'); mindOf(inv).wit = 0.9;
    const cs = quietCase('assault', off, {victims:[vic]});
    [w1,w2,w3].forEach(w=>{ honest(w); cs.witnesses.push({id:w.id, claim:off.id, conf:0.8}); }); strangers([off,inv,w1,w2,w3,vic]);
    for (let i=0;i<8;i++) workCase(cs, inv, 0.95);
    const top = scoreSuspects(cs)[0];
    ok(top && top[0] === off.id, `top suspect is ${top ? cById(top[0]).name : 'nobody'}`);
    ok(cs.statements.length >= 2, 'witnesses were not interviewed');
  });
  test('J5', 'Witnesses can disagree', ()=>{
    const [off, other, inv, w1, w2] = distinct(5); hire(inv, 'Investigator'); strangers([off,other,inv,w1,w2]);
    const cs = quietCase('assault', off);
    honest(w1); honest(w2); cs.witnesses.push({id:w1.id, claim:off.id, conf:0.7}, {id:w2.id, claim:other.id, conf:0.6});
    for (let i=0;i<10 && cs.statements.length<2;i++) workCase(cs, inv, 1);
    ok(cs.statements.length === 2, 'both witnesses should give statements');
    ok(new Set(cs.statements.map(s=>s.claim)).size === 2, 'statements agree');
    ok(cs.flagConflict, 'the disagreement was not noticed');
  });
  test('J6', 'Innocent suspect can be cleared', ()=>{
    const [off, inno, inv, w1] = distinct(4); hire(inv, 'Investigator'); strangers([off,inno,inv,w1]);
    const cs = quietCase('theft', off); cs.present = [off.id];
    honest(w1); say(cs, w1, inno, 0.8);
    for (let i=0;i<30 && cs.alibis[inno.id]!=='confirmed';i++) workCase(cs, inv, 0.95);
    ok(cs.alibis[inno.id] === 'confirmed', 'the innocent suspect\'s alibi was never checked');
    const s = (cs.suspects[inno.id]||{score:0}).score; ok(s < 0.3, `innocent still scores ${s.toFixed(2)}`);
  });
  const trialSetup = (strong) => {
    const [off, mag, vic, w1, w2, w3] = distinct(6); hire(mag, 'Magistrate'); honest(mag); honest(off); mag.values = ['Tradition','Family','Nature'];
    strangers([off,mag,vic,w1,w2,w3]);
    const cs = quietCase('assault', off, {victims:[vic]});
    if (strong){ [w1,w2,w3].forEach(w=>{ honest(w); say(cs, w, off, 0.9); }); clue(cs, off, 0.9); }
    cs.defendant = off.id; cs.status = 'CHARGES FILED'; cs.charges = crimeName(cs);
    return {cs, off, mag, vic, w1, w2, w3};
  };
  const runTrial = cs => { scheduleTrial(cs); if (cs.status!=='AWAITING TRIAL') return; cs.trialDay = day(); startTrials(); verdicts(); };
  test('J7', 'Court can convict', ()=>{
    const {cs} = trialSetup(true); runTrial(cs);
    ok(cs.status === 'CONVICTED', `verdict was ${cs.status}`); ok(cs.sentence, 'no sentence');
  });
  test('J8', 'Court can acquit', ()=>{
    const {cs, off, w1, w2} = trialSetup(false);
    const [other, adv] = distinct(2, c=>![cs.defendant, ...cs.victims, w1.id, w2.id].includes(c.id) && c.profession!=='Magistrate'); strangers([off, other, adv]);
    hire(adv, 'Advocate'); mindOf(adv).wit = 0.95; honest(w1); honest(w2);
    say(cs, w1, off, 0.75); clue(cs, other, 0.7); say(cs, w2, other, 0.6);
    runTrial(cs);
    ok(cs.status === 'ACQUITTED', `verdict was ${cs.status}`);
    ok(cogOf(off).legal.some(x=>!x.guilty), 'acquittal not on the record');
  });
  test('J9', 'Case can be dismissed', ()=>{
    const {cs} = trialSetup(false); scheduleTrial(cs);
    ok(cs.status === 'DISMISSED', `a case with no evidence went to ${cs.status}`);
  });
  test('J10', 'Repeat offender receives different treatment', ()=>{
    const [a, b, v] = distinct(3); a.wallet = b.wallet = 1000;
    const d = day(); for (let i=0;i<3;i++) cogOf(b).legal.push({day:d-5-i, charge:'theft', sev:3, guilty:true, verdict:'CONVICTED', sentence:'fine'});
    const c1 = quietCase('assault', a, {victims:[v]}), c2 = quietCase('assault', b, {victims:[v]});
    const w0a = a.wallet, w0b = b.wallet; sentence(c1, a); sentence(c2, b);
    ok(w0b - b.wallet > w0a - a.wallet, `repeat offender paid ${w0b-b.wallet}¢, first offender ${w0a-a.wallet}¢`);
    ok(legalScore(b) > legalScore(a), 'record weight is not higher');
  });
  test('J11', 'Jail affects work and income', ()=>{
    const plot = freePlotsList()[0] || Object.values(S.props).find(p=>p.kind==='plot'); ok(plot, 'no plot for a jail');
    const rec = {bid:'loc_b_testjail', plot:plot.plot||plot.id, type:'jail', name:'Test Jail', roof:'#555', kind:'civic'}; S.built.push(rec); applyBuilt(rec); bumpWorld();
    ok(jailBuilding(), 'jail was not built');
    const [a, b] = distinct(2, c=>!propsOf(c).length && !c.partner); hire(a, 'Teacher'); hire(b, 'Teacher'); // owners still collect rent in jail
    a.jail = {until:day()+4, caseId:null}; S.listings = S.listings.filter(l=>l.seller!==a.id); // goods already at market could still sell
    days(1); const d = day(); a.plan = buildPlan(a, d); b.plan = buildPlan(b, d);
    ok(a.plan.blocks.every(x=>x.loc===jailBuilding().id), 'the prisoner\'s day is not spent in jail');
    const ia = weekSum(a,'inc'), ib = weekSum(b,'inc'); days(2);
    ok(weekSum(a,'inc') - ia === 0, 'the prisoner still earned money'); ok(weekSum(b,'inc') - ib > 0, 'the free worker earned nothing');
    ok(!S.citizens.filter(c=>isAdult(c) && !c.jail && !c.away).includes(a), 'prisoner would still vote');
  });
  test('J12', 'Conflict of interest can cause recusal', ()=>{
    const [off, vic, i1, i2] = distinct(4); hire(i1, 'Investigator'); hire(i2, 'Investigator'); honest(i1); strangers([off,vic,i1,i2]);
    getRel(i1, vic.id).affinity = 90; getRel(vic, i1.id).affinity = 90; mindOf(i1).wit = 0.99; mindOf(i2).wit = 0.5;
    const cs = quietCase('assault', off, {victims:[vic]});
    const who = assignOfficial([i1, i2], cs, 'Investigator');
    ok(who === i2, `the case went to ${who ? who.name : 'nobody'}`); ok((cs.recused||[]).includes(i1.id), 'the conflicted investigator did not recuse');
  });
  test('J13', 'Corruption can affect justice', ()=>{
    let found = null, clean = null;
    for (let k=0;k<60 && !(found && clean);k++){
      const {cs, off, mag, w1} = trialSetup(false); crook(off); off.cls = 'Wealthy'; off.wallet = 2000; mag.traits = ['Greedy']; mag.wallet = 20; honest(w1);
      say(cs, w1, off, 0.9); clue(cs, off, 0.6);
      scheduleTrial(cs); cs.trialDay = day(); startTrials();
      if (cs.trial && cs.trial.bribed){ verdicts(); found = found || cs; } else { verdicts(); clean = clean || cs; }
      S.citizens.forEach(c=>{ if (c.profession==='Magistrate') hire(c, 'Farmer'); });
    }
    ok(found, 'no judge ever took a bribe'); ok(clean && clean.status === 'CONVICTED', `the same evidence without a bribe ended ${clean && clean.status}`);
    ok(found.status === 'ACQUITTED', `a bribed judge still ruled ${found.status}`);
    ok(S.justice.cases.some(c=>c.kind==='corruption' && c.status==='HIDDEN'), 'the bribe left no hidden corruption case');
  });

  // ============================ COGNITION ============================
  const place = (c, x, y) => { c.rt.x = x; c.rt.y = y; c.rt.state = 'Awake'; c.rt.path = null; c.rt.loc = 'loc_town_square'; };
  test('C1', 'Citizen witnesses event', ()=>{
    const [a] = distinct(1); place(a, 26, 20);
    const e = publicEvent({type:'test', text:'A cart overturned on the square.', at:[26,20], r:3, imp:6, topics:{safety:-0.4}});
    const m = cogOf(a).mems.find(x=>x.ev===e.ev); ok(m, 'no memory of the event'); ok(m.src === 'saw', `source ${m.src}`);
  });
  test('C2', 'Citizen remembers important event', ()=>{
    const [a] = distinct(1);
    experience(a, {type:'test', text:'The mill burned down.', imp:9, src:'self', topics:{safety:-0.5}});
    experience(a, {type:'test2', text:'I saw a cloud.', imp:2, src:'self'});
    ok(cogOf(a).mems.some(x=>x.text==='The mill burned down.'), 'the important event was not remembered');
    ok(!cogOf(a).mems.some(x=>x.text==='I saw a cloud.'), 'a trivial moment was stored as a memory');
  });
  test('C3', 'Citizen learns information from friend', ()=>{
    const [a, b, x] = distinct(3); honest(a); strangers([a,b,x]); getRel(b, a.id).affinity = 80; getRel(b, a.id).trust = 0.9;
    experience(a, {ev:'evC3', type:'crime', text:'I saw X steal.', pub:`${x.name} stole from the market.`, imp:7, src:'saw', fact:{id:'fC3', who:x.id, conf:0.9, kind:'theft', sev:2}});
    ok(shareNews(a, b), 'nothing was shared');
    const k = cogOf(b).kn.fC3; ok(k && k.who === x.id, 'the friend did not learn who did it'); ok(k.src === 'told' && k.from === a.id, `learned via ${k && k.src}`);
  });
  test('C4', 'Citizen learns information from newspaper', ()=>{
    const [j, r, x] = distinct(3); hire(j, 'Journalist'); S.papers[j.id] = 'The Test Gazette';
    j.inventory.good_newspaper = 5; list(j, 'good_newspaper', 5);
    S.news.unshift({day:day(), editor:j.id, paper:'The Test Gazette', heads:['Mill fire!'], items:[{ev:'evC4', kind:'crime', text:`${x.name} is said to have set the mill fire.`, topics:{safety:-0.4}, imp:6, fact:{id:'fC4', who:x.id, conf:0.7, kind:'vandalism', sev:3}}]});
    r.wallet = 200; r.personality.openness = 1; r.politics.civicEngagement = 1; mindOf(r).read = -1;
    tryReadPaper(r);
    const k = cogOf(r).kn.fC4; ok(k, 'the reader learned nothing'); ok(k.src === 'paper', `learned via ${k.src}`);
  });
  test('C5', 'Citizen hears false rumor', ()=>{
    const [a, x, enemy] = distinct(3); crook(a); a.traits = ['Gossip','Greedy']; strangers([a, x, enemy]);
    getRel(a, enemy.id).affinity = -90;
    experience(a, {ev:'evC5', type:'crime', text:'x', pub:`${x.name} broke into the smithy.`, imp:8, src:'rumor', from:x.id, conf:0.9, fact:{id:'fC5', who:x.id, conf:0.9, kind:'burglary', sev:3}});
    let wrong = null;
    for (const b of adults(c=>![a.id,x.id,enemy.id].includes(c.id))){ delete cogOf(b).kn.fC5; cogOf(b).mems = cogOf(b).mems.filter(m=>m.ev!=='evC5'); shareNews(a, b); const k = cogOf(b).kn.fC5; if (k && k.who===enemy.id){ wrong = b; break; } }
    ok(wrong, 'no one ever heard the garbled version');
    ok(cogOf(wrong).kn.fC5.who !== x.id, 'rumour matched the truth');
  });
  test('C6', 'Citizen receives contradictory evidence', ()=>{
    const [c, x, y] = distinct(3); c.traits = ['Hardworking']; c.personality.openness = 0.8; mindOf(c).wit = 0.8;
    learnFact(c, 'fC6', x.id, 0.45, 'told', null, {kind:'theft', sev:2});
    learnFact(c, 'fC6', y.id, 0.95, 'saw', null, {kind:'theft', sev:2});
    ok(cogOf(c).kn.fC6.who === y.id, 'strong first-hand evidence did not change their mind');
    const conf = cogOf(c).kn.fC6.conf; learnFact(c, 'fC6', x.id, 0.2, 'rumor', null, {kind:'theft', sev:2});
    ok(cogOf(c).kn.fC6.who === y.id, 'a weak rumour overturned first-hand evidence'); ok(cogOf(c).kn.fC6.conf < conf, 'contradiction did not reduce confidence');
  });
  test('C7', 'Belief updates gradually', ()=>{
    const [c] = distinct(1); c.traits = ['Hardworking']; c.personality.openness = 0.7; mindOf(c).wit = 0.7; cogOf(c).op.safety = 0; cogOf(c).bel = cogOf(c).bel.filter(b=>b.topic!=='safety');
    const steps = []; for (let i=0;i<6;i++){ experience(c, {type:'fear'+i, text:`Something frightening happened (${i}).`, imp:7, src:'self', topics:{safety:-1}}); steps.push(opinionOf(c,'safety')); }
    ok(steps[0] > -60, `one event swung the opinion to ${steps[0]}`);
    ok(steps.every((v,i)=>i===0 || v<=steps[i-1]), 'opinion did not move steadily');
    ok(steps[5] < steps[0] - 20, 'repeated experience barely moved the opinion');
    ok(Math.abs(steps[5]-steps[4]) <= Math.abs(steps[1]-steps[0]) + 1, 'strong views should change more slowly');
    consolidate(c); ok(cogOf(c).bel.some(b=>b.topic==='safety' && b.pos<0), 'no belief formed from repeated experience');
  });
  test('C8', 'Important memory changes future vote', ()=>{
    const [c, p0] = distinct(2); strangers([c, p0]);
    const before = vote(c, law('bread_subsidy', p0));
    for (let i=0;i<4;i++) experience(c, {type:'hunger'+i, text:'My children went to bed hungry.', imp:9, src:'self', topics:{'law:bread_subsidy':1, relief:1, poor:1}});
    const after = vote(c, law('bread_subsidy', p0));
    ok(after > before, `vote score ${before.toFixed(2)} → ${after.toFixed(2)}`);
  });
  test('C9', 'Policy personally affecting citizen changes opinion', ()=>{
    const [c] = distinct(1); const before = opinionOf(c, 'relief');
    cogOf(c).week = {relief:20}; weeklyExperience(c);
    ok(opinionOf(c, 'relief') > before, 'relief payments did not warm them to relief');
    const [t, L] = distinct(2, x=>x!==c); strangers([t, L]); const a0 = peekRel(t, L.id).affinity, o0 = opinionOf(t, 'landlords');
    t.cls = 'Poor'; cogOf(t).week = {rent:30, landlord:L.id}; weeklyExperience(t);
    ok(opinionOf(t, 'landlords') < o0, 'paying heavy rent did not sour them on landlords');
  });
  test('C10', 'Minor memories decay', ()=>{
    const [c] = distinct(1); const m = experience(c, {type:'minor', text:'Saw a new cart.', imp:4, src:'self'}); ok(m, 'not stored');
    for (let i=0;i<60;i++){ S.minute += DAY; cognitionDaily(); }
    const still = cogOf(c).mems.find(x=>x===m); ok(!still || still.str < 0.2, `minor memory strength ${still && still.str.toFixed(2)}`);
  });
  test('C11', 'Major memories persist', ()=>{
    const [c] = distinct(1); const m = experience(c, {type:'major', text:'My brother died in the flood.', imp:10, src:'self'});
    for (let i=0;i<60;i++){ S.minute += DAY; cognitionDaily(); }
    ok(cogOf(c).mems.includes(m), 'a major memory was forgotten'); ok(m.str > 0.6, `major memory strength ${m.str.toFixed(2)}`);
  });
  test('C12', 'Citizens do not automatically know distant events', ()=>{
    const [near, far] = distinct(2); place(near, 26, 20); place(far, 4, 44);
    const e = publicEvent({type:'test', text:'A fight broke out by the fountain.', at:[26,20], r:3, imp:6, topics:{safety:-0.3}, fact:{id:'fC12', who:near.id, conf:0.8, kind:'assault', sev:3}});
    ok(cogOf(near).mems.some(x=>x.ev===e.ev), 'the bystander did not see it');
    ok(!cogOf(far).mems.some(x=>x.ev===e.ev), 'someone across town knew instantly'); ok(!cogOf(far).kn.fC12, 'someone across town knew who did it');
  });

  // ============================ FRONTIER ============================
  test('E1', 'Exploration requires sufficient resources', ()=>{
    S.treasury = 10; const n0 = S.world.exp.length;
    const r = launchExpedition('N', 'player'); ok(r.err, 'an expedition left with an empty treasury'); ok(S.world.exp.length === n0, 'expedition recorded anyway');
    S.treasury = 3000; S.citizens.forEach(c=>{ if (isAdult(c)) c.sick = 2; });
    const r2 = launchExpedition('N', 'player'); ok(r2.err, 'an expedition left with nobody fit to go');
  });
  for (const dir of ['N','S','E','W']) test('E'+({N:2,S:3,E:4,W:5}[dir]), `Player can explore ${DIRS[dir].label.toLowerCase()}`, ()=>{
    const {cell} = explore(dir); ok(cell, 'nothing discovered'); ok(cellDirs(cell.cx, cell.cy).includes(dir), `found land ${cellDirs(cell.cx,cell.cy)} instead of ${dir}`);
    ok(TERRITORIES.some(t=>t.id===cell.id), 'no territory for the new region');
    const [x0,y0,x1,y1] = cellRect(cell.cx, cell.cy); ok(tileAt(Math.round((x0+x1)/2), Math.round((y0+y1)/2)) !== T.FOG, 'the region is still fog');
  });
  test('E6', 'Unknown territory hides resources', ()=>{
    const f = frontierCells('W')[0]; ok(f, 'no frontier to the west'); const [x0,y0,x1,y1] = cellRect(f.cx, f.cy);
    ok(!cellOf(cellKey(f.cx,f.cy)), 'unknown land already has a record');
    let fog = 0, n = 0, bad = null; for (let y=y0;y<=y1;y+=3) for (let x=x0;x<=x1;x+=3){ n++; if (tileAt(x,y)===T.FOG) fog++; else bad = bad || [x,y,tileAt(x,y)]; } ok(fog === n, `unknown land is visible on the map at ${bad}`);
    ok(!Object.values(LOC).some(L=>L.region===cellKey(f.cx,f.cy)), 'workers can reach unknown land');
    ok(!TERRITORIES.some(t=>t.key===cellKey(f.cx,f.cy)), 'unknown land can be annexed');
  });
  test('E7', 'Exploration takes time', ()=>{
    S.treasury = 3000; const r = launchExpedition('S', 'player'); ok(r.e, r.err); const e = r.e;
    ok(e.back - e.start >= 3, 'expedition too quick');
    days(1); ok(!e.found && e.status==='out', 'discovered land after a single day'); ok(e.members.every(id=>!alive(id) || alive(id).away), 'explorers are not away');
    ok(!e.members.some(id=>voterPool().includes(alive(id))), 'explorers could still vote at home');
    days(e.back - day() + 1); ok(e.status !== 'out', 'expedition never came back'); ok(e.members.every(id=>!alive(id) || !alive(id).away), 'explorers did not come home');
  });
  test('E8', 'Regions differ in resources', ()=>{
    const cells = [[-1,0],[1,-1],[1,2],[4,1],[2,-1],[-1,1]].map(([x,y])=>reveal(x,y));
    const span = k => Math.max(...cells.map(c=>c.attrs[k])) - Math.min(...cells.map(c=>c.attrs[k]));
    ok(['fert','timber','ore','fish'].some(k=>span(k) > 0.35), 'regions are all alike');
    ok(new Set(cells.map(c=>c.biome)).size >= 2, 'only one kind of country');
    ok(new Set(cells.map(c=>c.name)).size === cells.length, 'duplicate region names');
  });
  test('E9', 'Discovery does not automatically annex land', ()=>{
    const c = reveal(-1, 0); ok(!claimed(c.id), 'discovery annexed the land'); ok(c.state === 'annexable', `state ${c.state}`);
    const far = reveal(-2, 0); ok(far.state === 'discovered', 'distant land became annexable without a border');
    ok(!Object.values(S.props).some(p=>p.terr===c.id && p.forSale), 'plots are for sale before annexation');
  });
  test('E10', 'Annexation can succeed', ()=>{
    const c = reveal(-1, 0), t = TERRITORIES.find(x=>x.id===c.id); S.treasury = t.cost + 500;
    S.citizens.forEach(x=>{ if (isAdult(x)){ cogOf(x).op.expansion = 80; cogOf(x).op.nature = -20; } });
    const p = annexVote(t, adults()[0]); const {y, n} = tallyVotes(p); ok(y > n, `vote failed ${y}–${n}`);
    p.status = 'Passed'; completeAnnexation(p); ok(claimed(c.id), 'not annexed'); ok(['annexed','developing'].includes(c.state), `state ${c.state}`);
  });
  test('E11', 'Annexation can fail', ()=>{
    const c = reveal(1, -1), t = TERRITORIES.find(x=>x.id===c.id);
    S.citizens.forEach(x=>{ if (isAdult(x)){ cogOf(x).op.expansion = -80; cogOf(x).op.nature = 90; } });
    const p = annexVote(t, adults()[0]); const {y, n} = tallyVotes(p); ok(n > y, `vote passed ${y}–${n}`);
    S.treasury = 5; const p2 = annexVote(t, adults()[0]); p2.status = 'Passed'; completeAnnexation(p2);
    ok(p2.status === 'Failed' && !claimed(c.id), 'an unaffordable annexation went through');
  });
  const annex = (cx, cy) => { const c = reveal(cx, cy), t = TERRITORIES.find(x=>x.id===c.id); S.treasury += t.cost + 200; const p = annexVote(t, adults()[0]); p.status = 'Passed'; completeAnnexation(p); ok(claimed(c.id), 'annex failed'); return c; };
  test('E12', 'Annexed land creates building space', ()=>{
    const before = freePlotsList().length; const c = annex(-1, 0);
    const plots = Object.values(S.props).filter(p=>p.terr===c.id && p.kind==='plot');
    ok(plots.length >= 2, 'the region has no plots'); ok(plots.every(p=>p.forSale), 'region plots are not on the market');
    ok(freePlotsList().length > before, 'no new building space');
  });
  test('E13', 'New resources enter the economy', ()=>{
    let c = null; for (const [x,y] of [[-1,0],[-1,1],[1,-1],[2,-1],[1,2],[4,1]]){ const r = reveal(x,y); if (r.state==='annexable' && r.res.timber.cap>1500){ c = r; break; } }
    ok(c, 'no timber-rich region nearby'); const t = TERRITORIES.find(x=>x.id===c.id); S.treasury += t.cost+200; const p = annexVote(t, adults()[0]); p.status='Passed'; completeAnnexation(p);
    S.res.home.timber.s = Math.round(S.res.home.timber.cap*0.05);
    adults().slice(0,4).forEach(w=>hire(w, 'Woodcutter'));
    const s0 = c.res.timber.s, listed0 = listed('good_timber'); days(4);
    ok(c.res.timber.s < s0, 'nobody cut timber in the new region'); ok((c.worked||0) > 0, 'the region was never worked');
  });
  test('E14', 'Infrastructure costs increase', ()=>{
    S.treasury = 5000; const t0 = S.treasury; upkeepDaily(); const base = t0 - S.treasury;
    annex(-1, 0); S.treasury = 5000; upkeepDaily(); const one = 5000 - S.treasury;
    annex(1, -1); S.treasury = 5000; upkeepDaily(); const two = 5000 - S.treasury;
    ok(one > base && two > one, `upkeep ${base} → ${one} → ${two}`);
  });
  test('E15', 'Citizens form opinions about expansion', ()=>{
    const ops0 = {}; S.citizens.forEach(c=>{ if (isAdult(c)) ops0[c.id] = opinionOf(c,'expansion'); });
    const {e} = explore('W');
    const changed = e.members.map(alive).filter(Boolean).filter(c=>opinionOf(c,'expansion') !== ops0[c.id]);
    ok(changed.length > 0, 'explorers came back with no view on expansion');
    ok(e.members.map(alive).filter(Boolean).every(c=>cogOf(c).mems.some(m=>m.type==='discovery'||m.type==='expedition')), 'explorers do not remember the expedition');
    ok(S.world.log.length > 0, 'the discovery was not recorded');
    ok(S.citizens.some(c=>!e.members.includes(c.id) && cogOf(c).mems.some(m=>m.type==='discovery')), 'nobody outside the expedition heard about the discovery');
  });
  test('E16', 'Frontier moves outward after annexation', ()=>{
    const x0 = X0; const near = reveal(-1, 0), far = reveal(-2, 0);
    ok(X0 < x0, 'the map did not grow west'); ok(far.state === 'discovered', 'the far region should wait for the land between');
    const t = TERRITORIES.find(x=>x.id===near.id); S.treasury += t.cost+200; const p = annexVote(t, adults()[0]); p.status='Passed'; completeAnnexation(p);
    ok(far.state === 'annexable', 'annexing the near region did not open the next one');
    ok(!frontierCells('W').some(f=>f.cx===-1 && f.cy===0), 'annexed land is still frontier');
  });

  // ============================ FAMILY ============================
  const couple = (g1, g2) => { const [a, b] = distinct(2, c=>!c.partner && c.age>=24 && c.age<=40); a.gender = g1; b.gender = g2; a.orient = b.orient = g1===g2 ? 'gay' : 'straight';
    a.partner = b.id; b.partner = a.id; a.home = b.home; [[a,b],[b,a]].forEach(([x,y])=>{ const r = getRel(x,y.id); r.affinity = 85; r.tags = ['Spouse','Family']; }); indexCitizens(); return [a, b]; };
  test('G1', 'Only a woman and a man can have a baby', ()=>{
    const [a, b] = couple('F','F'), [c, d] = couple('M','F');
    ok(!canConceive(a, b), 'two women conceived'); ok(canConceive(c, d), 'a woman and a man cannot conceive');
    const n0 = S.citizens.length; for (let i=0;i<400;i++) births(); const newborn = S.citizens.slice(n0);
    ok(newborn.every(k=>!(k.parents.includes(a.id) && k.parents.includes(b.id))), 'a same-sex couple had a baby');
    const [x, y] = distinct(2, q=>!q.partner && ![a,b,c,d].includes(q)); x.gender='F'; y.gender='F'; x.orient='straight'; y.orient='straight'; ok(!mutual(x, y) && !canRomance(x, y), 'straight women fell for each other');
  });
  test('G2', 'Same-sex couples can adopt', ()=>{
    const [a, b] = couple('M','M'); const k0 = S.citizens.length;
    adopt(a, b, null); const kid = S.citizens[S.citizens.length-1];
    ok(S.citizens.length === k0+1 && kid.profession==='Child', 'no child was adopted'); ok(kid.parents.includes(a.id) && kid.parents.includes(b.id), 'the child has the wrong parents');
    ok(kid.home === a.home && a.kids.includes(kid.id), 'the child did not move in'); ok(S.relStats.adoptions >= 1, 'adoption not counted');
  });

  function voterPool(){ return S.citizens.filter(c=>isAdult(c) && !c.jail && !c.away); }
  function run(which){
    const out = [];
    for (const t of TESTS){ if (which && !(Array.isArray(which) ? which.includes(t.id) : t.id===which)) continue;
      const t0 = performance.now();
      try { t.fn(); out.push({id:t.id, name:t.name, pass:true, ms:Math.round(performance.now()-t0)}); }
      catch(e){ out.push({id:t.id, name:t.name, pass:false, error:e.message, stack:(e.stack||'').split('\n').slice(0,3).join(' | ')}); } }
    return out;
  }
  window.PTTests = {list:()=>TESTS.map(t=>({id:t.id, name:t.name})), run};
})();
