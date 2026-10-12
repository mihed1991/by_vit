(function(root, factory){
  const api = factory();
  if(typeof module === 'object' && module.exports) module.exports = api;
  else root.ByVitSearch = api;
})(typeof window !== 'undefined' ? window : globalThis, function(){
  'use strict';

  // The existing goal IDs and productIds remain the single source of selection.
  const PHRASES = {
    mass:['набрать массу','набрать вес','набор мышечной массы','нарастить мышцы','рост мышц','накачаться','для массы','набрать мышечную массу','масса','массы','накачать мышцы'],
    strength:['стать сильнее','увеличить силу','силовые показатели','сила','выносливость','для силы','для выносливости','улучшить выносливость'],
    recovery:['восстановление','восстанавливаться','восстановиться','после тренировки','после нагрузок','для восстановления','восстановить силы','восстановления'],
    joints:['суставы','суставов','связки','связок','для суставов','для связок','поддержка суставов','суставы и связки'],
    immunity:['иммунитет','иммунитета','для иммунитета','поддержка иммунитета','иммунная поддержка','поддержать иммунитет','иммунной системы','поддержка иммунной системы'],
    energy:['энергия','энергии','бодрость','фокус','концентрация','для тонуса','для энергии','больше энергии']
  };
  const TYPES = {
    protein:['протеин','протеина','протеином','протеины','protein','белок','сыворотка','сывороточный'],
    creatine:['креатин','креатина','creatine'],
    amino:['аминокислоты','аминокислот','bcaa','eaa'],
    joints:['коллаген','коллагена','collagen'],
    preworkout:['предтрен','предтрены','предтреник','предтренировочный','preworkout'],
    accessories:['шейкер','шейкера','shaker'],
    'healthy-food':['батончик','батончики','перекус']
  };
  const STOP = new Set('я мне меня хочу нужно нужен нужна нужны ищу ищем подобрать подбери товары товар добавки добавку для по на к и или а чтобы быстрее лучше что можно купить пожалуйста'.split(' '));
  const FORMS = {powder:'порошок',capsules:'капсулы',tablets:'таблетки',liquid:'жидкость',softgels:'софтгели',bar:'батончик',accessory:'аксессуар'};
  const BRAND_ALIASES = {'optimum nutrition':['оптимум нутришн','оптимум'],'now foods':['нау фудс'],'applied nutrition':['эплайд нутришн'],'kevin levrone':['кевин леврон'],'life extension':['лайф экстеншн']};
  function normalize(value){
    return String(value || '').toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
  }
  function words(value){ return normalize(value).split(' ').filter(Boolean); }
  function goalSettings(goal){
    goal = goal && typeof goal === 'object' ? goal : {};
    const phrases = Array.isArray(goal.searchPhrases) ? goal.searchPhrases : (PHRASES[goal.id] || []);
    const searchPhrases = [...new Set(phrases.map(value => String(value).trim().slice(0,160)).filter(Boolean))].slice(0,100);
    const productRules = {};
    for(const id of Array.isArray(goal.productIds) ? goal.productIds : []){
      const rule = goal.productRules?.[id];
      if(rule && typeof rule === 'object') productRules[id] = {
        priority:Math.min(100,Math.max(0,Number(rule.priority) || 0)),
        reason:String(rule.reason || '').trim().slice(0,400)
      };
    }
    return {searchPhrases,productRules};
  }
  // Bounded edit distance, including adjacent transpositions. Only used as fallback.
  function similar(a,b){
    if(a === b) return true;
    if(Math.min(a.length,b.length) < 4) return false;
    const limit = Math.min(a.length,b.length) >= 8 ? 2 : 1;
    if(Math.abs(a.length-b.length)>limit) return false;
    const rows = [Array.from({length:b.length+1},(_,i)=>i)];
    for(let i=1;i<=a.length;i++){
      const row=[i];
      for(let j=1;j<=b.length;j++){
        row[j]=Math.min(row[j-1]+1,rows[i-1][j]+1,rows[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
        if(i>1 && j>1 && a[i-1]===b[j-2] && a[i-2]===b[j-1]) row[j]=Math.min(row[j],rows[i-2][j-2]+1);
      }
      rows.push(row);
    }
    return rows[a.length][b.length]<=limit;
  }
  function phraseSpans(tokens,phrase,fuzzy=false){
    const needle=words(phrase), spans=[];
    if(!needle.length) return spans;
    for(let start=0;start<=tokens.length-needle.length;start++){
      if(needle.every((word,index)=>fuzzy ? (needle.length>1 || tokens[start+index].length>=5) && similar(tokens[start+index],word) : tokens[start+index]===word)){
        spans.push(Array.from({length:needle.length},(_,i)=>start+i));
      }
    }
    return spans;
  }
  function productText(product){
    const brand=normalize(product.brand);
    const primary=[product.name,product.brand,...(BRAND_ALIASES[brand] || [])].join(' ');
    const secondary=[product.category,FORMS[product.formType],product.shortDescription,product.description,product.ingredients,product.usage,
      ...(product.flavors || []),...(product.packageOptions || []).map(option=>option.label),
      ...(Array.isArray(product.tags)?product.tags:[]),...(Array.isArray(product.recommendationTags)?product.recommendationTags:[])].join(' ');
    return {primary:normalize(primary),all:normalize(`${primary} ${secondary}`)};
  }
  function search(query,products,goals,options={}){
    const q=normalize(String(query || '').slice(0,240)), tokens=words(q);
    const enabled=(goals || []).filter(goal=>goal.enabled!==false).map(goal=>({...goal,...goalSettings(goal)}));
    const result={query:q,status:'products',goal:null,choices:[],items:[],typo:false,message:''};
    if(String(query || '').length>240) return {...result,status:'restricted',message:'Сократите запрос до 240 символов.'};
    if(!q){ result.items=(products || []).map(product=>({product,reason:'',score:0})); return result; }
    if(tokens.some(word=>['без','не','нет','кроме','исключить','исключая'].includes(word))){
      return {...result,status:'restricted',message:'В запросе есть исключение. Поиск пока не проверяет такие ограничения: уточните состав в карточке товара или у магазина.'};
    }
    if(tokens.some(word=>/^(леч|болез|диабет|беремен|похуд|похудени|сброс)/u.test(word))){
      return {...result,status:'restricted',message:'Для этого запроса пока нет проверенной подборки. Можно искать по названию товара или выбрать существующую цель.'};
    }
    const texts=new Map((products || []).map(product=>[product,productText(product)]));
    const direct=(products || []).filter(product=>texts.get(product).primary.includes(q));
    // An exact name/brand is not reinterpreted as a fitness goal.
    const candidates=direct.length && !options.goalId ? [] : enabled.map(goal=>{
      const phrases=[goal.title,...goal.searchPhrases];
      const spans=phrases.flatMap(phrase=>phraseSpans(tokens,phrase));
      return {goal,spans};
    }).filter(match=>match.spans.length);
    if(!direct.length && !candidates.length){
      candidates.push(...enabled.map(goal=>({goal,spans:[goal.title,...goal.searchPhrases].flatMap(phrase=>phraseSpans(tokens,phrase,true))})).filter(match=>match.spans.length));
      if(candidates.length) result.typo=true;
    }
    result.choices=candidates.map(match=>match.goal);
    const chosen=enabled.find(goal=>String(goal.id)===String(options.goalId || ''));
    if(candidates.length>1 && !chosen){
      return {...result,status:'ambiguous',message:'Уточните, какая цель сейчас важнее.',items:[]};
    }
    result.goal=chosen || candidates[0]?.goal || null;
    const consumed=new Set(candidates.flatMap(match=>match.spans.flat()));
    let remaining=tokens.filter((word,index)=>!consumed.has(index) && !STOP.has(word));
    const categoryMatches=Object.entries(TYPES).filter(([,aliases])=>remaining.some(word=>aliases.includes(word)));
    if(!categoryMatches.length){
      categoryMatches.push(...Object.entries(TYPES).filter(([,aliases])=>remaining.some(word=>aliases.some(alias=>similar(word,alias)))));
      if(categoryMatches.length) result.typo=true;
    }
    const categories=categoryMatches.map(([category])=>category);
    remaining=remaining.filter(word=>!categoryMatches.some(([,aliases])=>aliases.some(alias=>similar(word,alias))));
    // Unknown meaningful words are kept: never silently turn “protein for X” into all protein.
    let pool=direct.length && !result.goal ? direct : (products || []);
    if(result.goal){
      result.status='goal';
      const ids=new Set((result.goal.productIds || []).map(String));
      pool=pool.filter(product=>ids.has(String(product.id)));
    }
    if(categories.length && !direct.length) pool=pool.filter(product=>categories.includes(product.category));
    const rank=(product,fuzzy=false)=>{
      const text=texts.get(product), all=words(text.all), primary=words(text.primary);
      if(!remaining.every(word=>all.includes(word) || (!fuzzy && text.all.includes(word)) || (fuzzy && all.some(value=>similar(word,value))))) return null;
      const lexical=direct.includes(product)?100:remaining.reduce((score,word)=>score+(primary.includes(word)?10:1),0);
      const rule=result.goal?.productRules?.[product.id];
      return {product,score:lexical,priority:Number(rule?.priority || 0),reason:result.goal ? rule?.reason || `Входит в подборку «${result.goal.title}», выбранную магазином.` : ''};
    };
    result.items=pool.map(product=>rank(product)).filter(Boolean);
    if(!result.items.length && remaining.length){
      result.items=pool.map(product=>rank(product,true)).filter(Boolean);
      if(result.items.length) result.typo=true;
    }
    result.items.sort((a,b)=>b.score-a.score || b.priority-a.priority || Number(Number(b.product.stock)>0)-Number(Number(a.product.stock)>0) ||
      (result.goal ? result.goal.productIds.map(String).indexOf(String(a.product.id))-result.goal.productIds.map(String).indexOf(String(b.product.id)) : 0));
    if(!result.items.length){ result.status='none'; result.message='Товары не найдены. Попробуйте другое название, бренд или выберите цель.'; }
    return result;
  }
  return {normalize,goalSettings,search};
});
