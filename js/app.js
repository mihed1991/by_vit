(function(){
  'use strict';

  const KEYS = {
    products:'byvit_v60_products',
    site:'byvit_v60_site',
    cart:'byvit_v60_cart',
    wishlist:'byvit_v60_wishlist',
    compare:'byvit_v60_compare',
    orders:'byvit_v60_orders',
    reviews:'byvit_v60_reviews',
    admin:'byvit_v60_admin_session'
  };
  const REMOVED_PAGE_HREFS = new Set(['healthy-sleep.html', 'profile.html']);
  const ADMIN_PASSWORD_HASH = '8e9b669109df89620b94f2387dc53206a82ddc71d658f8f7a2b3a9b417370d3e';
  const ADMIN_PASSWORD_CODES = [49,57,57,49];
  const DEFAULT_BADGE_COLOR = '#2d5a27';
  const FORM_TYPES = {
    powder:'Порошок',
    liquid:'Жидкость',
    capsules:'Капсулы',
    tablets:'Таблетки',
    softgels:'Софтгели',
    bar:'Батончик',
    accessory:'Аксессуар'
  };
  const DEFAULT_HOME_BLOCK_ORDER = ['sale', 'categories', 'goals', 'featured', 'service', 'brands'];
  const DEFAULT_HOME_BLOCKS = {
    categories:{visible:true,order:2,eyebrow:'Категории',title:'Быстрый вход в нужный раздел',text:'Разделы каталога помогают быстро перейти к нужному типу спортивного питания.',titleSize:36,textSize:15,buttonText:'Весь каталог',buttonUrl:'catalog.html'},
    goals:{visible:true,order:3,eyebrow:'Цели',title:'Выбери свою цель',text:'Если не знаешь название добавки, начни с задачи: масса, восстановление, сон, суставы или иммунитет.',titleSize:36,textSize:15,buttonText:'Открыть каталог',buttonUrl:'catalog.html'},
    featured:{visible:true,order:4,eyebrow:'Популярное',title:'Товары, которые покупают чаще',text:'Чистые карточки, нормальная типографика и понятные действия.',titleSize:36,textSize:15,buttonText:'Открыть каталог',buttonUrl:'catalog.html?sort=popular'},
    service:{visible:true,order:5,eyebrow:'Сервис',title:'Магазин без лишнего шума',text:'Заказ, доставка и контроль товара собраны в понятный сценарий.',titleSize:36,textSize:15,featureOneTitle:'Быстрый заказ',featureOneText:'Корзина, промокод, доставка и Telegram-уведомление через бота.',featureTwoTitle:'Контроль товара',featureTwoText:'Остатки, скидки, фасовки, вкусы, страна производства и админка.'},
    brands:{visible:true,order:6,eyebrow:'Бренды',title:'Оригинальные производители',text:'Быстрый выбор по брендам, которым доверяют покупатели.',titleSize:36,textSize:15,buttonText:'Все бренды',buttonUrl:'brands.html'},
    sale:{visible:true,order:1,eyebrow:'Акции',title:'Скидки и спецпредложения',text:'Товары со старой ценой и актуальными промо-предложениями.',titleSize:36,textSize:15,buttonText:'Все акции',buttonUrl:'sale.html'}
  };
  const DEFAULT_GOALS = [
    {id:'mass',title:'Набор массы',text:'Протеин, гейнеры, креатин и калорийные перекусы.',href:'catalog.html?category=protein',enabled:true},
    {id:'strength',title:'Сила и выносливость',text:'Креатин, аминокислоты и предтренировочные комплексы.',href:'catalog.html?category=creatine',enabled:true},
    {id:'recovery',title:'Восстановление',text:'BCAA, EAA, омега-3, магний и поддержка сна.',href:'catalog.html?category=amino',enabled:true},
    {id:'joints',title:'Суставы и связки',text:'Коллаген и комплексы для опорно-двигательной системы.',href:'catalog.html?category=joints',enabled:true},
    {id:'immunity',title:'Иммунитет',text:'D3, K2, омега-3 и ежедневные витаминные комплексы.',href:'catalog.html?category=vitamins',enabled:true},
    {id:'energy',title:'Энергия и фокус',text:'Предтрены, адаптогены и добавки для тонуса.',href:'catalog.html?category=preworkout',enabled:true}
  ];
  const DEFAULT_PAGE_HEADERS = {
    catalog:{title:'Каталог',text:'Поиск, категории, бренды, сортировка и наличие.'},
    brands:{title:'Бренды',text:'Список производителей для быстрого выбора.'},
    sale:{title:'Акции',text:'Товары со старой ценой и актуальными скидками.'},
    wishlist:{title:'Избранное',text:'Сохранённые товары.'},
    compare:{title:'Сравнение',text:'До четырёх товаров в одной таблице.'},
    cart:{title:'Корзина',text:'Проверьте товары и оформите заказ.'},
    delivery:{title:'Доставка и оплата',text:'Способы получения редактируются в админке.'},
    stores:{title:'Магазины',text:'Адрес самовывоза и контакты магазина.'},
    faq:{title:'FAQ',text:'Ответы на частые вопросы о заказе, доставке и товарах.'},
    about:{title:'О нас',text:'Команда ByVit и принципы, по которым собирается магазин.'},
    product:{title:'Товар',text:'Карточка товара с фасовками, вкусами, описанием и отзывами.'}
  };
  const DEFAULT_CHECKOUT = {
    summaryTitle:'Итого',
    itemsLabel:'Товары',
    deliveryLabel:'Доставка',
    totalLabel:'Итого',
    promoPlaceholder:'Промокод',
    promoButton:'Применить',
    checkoutTitle:'Оформление',
    namePlaceholder:'Имя',
    phonePlaceholder:'Телефон',
    addressPlaceholder:'Адрес / отделение',
    commentPlaceholder:'Комментарий к заказу',
    submitText:'Оформить заказ',
    successTitle:'Спасибо за заказ',
    successText:'Спасибо за заказ. Мы получили заявку и скоро свяжемся с вами.',
    paymentOptions:['Оплата при получении','Перевод на карту','Оплата онлайн после подтверждения'],
    blocks:{summary:true,promo:true,checkout:true,delivery:true,address:true,payment:true,comment:true}
  };
  const DEFAULT_HERO_METRICS = [
    {id:'categories',value:'12+',label:'категорий',enabled:true},
    {id:'delivery',value:'4',label:'способа доставки',enabled:true},
    {id:'discount',value:'10%',label:'WELCOME скидка',enabled:true}
  ];
  const DEFAULT_HERO_COLORS = {
    eyebrow:'#2d5a27',
    title:'#191a17',
    text:'#3f423d'
  };
  const DEFAULT_BRAND_IMAGE = {
    src:'',
    fit:'contain',
    positionX:50,
    positionY:50,
    scale:1
  };
  const DEFAULT_STORE_BLOCKS = [
    {id:'showroom',title:'Шоурум ByVit',text:'Минский район, Боровлянский сельсовет, 743этаж 1\nТелефон: +375 29 000-00-00\nГрафик: 10:00–20:00',enabled:true},
    {id:'pickup',title:'Самовывоз',text:'Выберите самовывоз в корзине и дождитесь подтверждения заказа.',enabled:true},
    {id:'delivery',title:'Доставка',text:'Курьер, Европочта или почта. Без лишних шагов.',enabled:true}
  ];
  const DEFAULT_PICKUP_STORES = [
    {id:'main',title:'Шоурум ByVit',address:'Минск, ул. Примерная 12, шоурум ByVit',note:'10:00-20:00',enabled:true}
  ];
  const DEFAULT_YANDEX_MAP_SRC = 'https://yandex.by/map-widget/v1/?ll=27.624022%2C53.964443&z=16&mode=search&ol=biz&oid=245505157299';
  const DEFAULT_MAP = {
    enabled:true,
    provider:'yandex',
    embedUrl:DEFAULT_YANDEX_MAP_SRC,
    placeholder:'Map placeholder / подключите карту в админке'
  };
  const DEFAULT_FAQ_ITEMS = [
    {id:'order',question:'Как оформить заказ?',answer:'Добавьте товары в корзину, выберите способ получения и оставьте контактные данные. После отправки заказа магазин свяжется для подтверждения.',enabled:true},
    {id:'delivery',question:'Какие способы доставки доступны?',answer:'Доступные способы редактируются в админке. По умолчанию можно включать самовывоз, курьера, Европочту и почту.',enabled:true},
    {id:'original',question:'Товары оригинальные?',answer:'В карточках можно указывать бренд, страну, состав, фасовку и наличие. Это помогает покупателю быстро проверить товар перед заказом.',enabled:true}
  ];
  const DEFAULT_ABOUT_PAGE = {
    eyebrow:'ByVit',
    title:'Магазин добавок без лишнего шума',
    text:'ByVit собирает спортивное питание, витамины и БАДы в спокойный каталог: понятные карточки, честное наличие, быстрый заказ и редактируемая админка для команды.',
    missionTitle:'Наша задача',
    missionText:'Помогать покупателю быстро понять, что перед ним: бренд, форма выпуска, состав, фасовка, наличие и сценарий применения. Дизайн не спорит с товаром, а помогает выбрать.',
    cards:[
      {title:'Оригинальные бренды',text:'В карточках есть место для страны, производителя, состава и подробного описания.',enabled:true},
      {title:'Понятный заказ',text:'Корзина, способы получения, промокоды и Telegram-уведомления собраны в один сценарий.',enabled:true},
      {title:'Живая витрина',text:'Товары, страницы, FAQ, карта, доставка и футер редактируются через админку.',enabled:true}
    ],
    legalTitle:'Реквизиты и контакты',
    legalText:'Здесь можно указать юридическое лицо, УНП, адрес регистрации, email, телефоны и условия работы магазина.'
  };

  const $ = (selector, root=document) => root.querySelector(selector);
  const $$ = (selector, root=document) => Array.from(root.querySelectorAll(selector));

  function clone(value){ return JSON.parse(JSON.stringify(value)); }
  function read(key, fallback){
    const stateKey = SERVER_KEY_MAP[key];
    if(serverState && stateKey) return clone(serverState[stateKey] ?? fallback);
    try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : clone(fallback); }
    catch(e){ return clone(fallback); }
  }
  function write(key, value){
    const stateKey = SERVER_KEY_MAP[key];
    if(serverState && stateKey){
      serverState[stateKey] = clone(value);
      schedulePersist();
    }
    localStorage.setItem(key, JSON.stringify(value));
  }
  function esc(value){
    return String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[char]));
  }
  function money(value){
    const num = Number(value || 0);
    const formatted = Number.isInteger(num) ? String(num) : num.toFixed(2).replace('.', ',');
    return `${formatted} BYN`;
  }
  function slugText(value){ return String(value || '').toLowerCase().trim(); }
  function toast(message){
    let node = $('#toast');
    if(!node){ node = document.createElement('div'); node.id = 'toast'; node.className = 'toast'; document.body.appendChild(node); }
    node.textContent = message;
    node.classList.add('show');
    clearTimeout(node._timer);
    node._timer = setTimeout(() => node.classList.remove('show'), 2600);
  }
  function getDefaults(){ return window.ByVitDefaults || {products:[],categories:[],site:{}}; }
  const SERVER_KEY_MAP = {
    [KEYS.products]:'products',
    [KEYS.site]:'site',
    [KEYS.orders]:'orders',
    [KEYS.reviews]:'reviews'
  };
  let serverState = null;
  let serverAvailable = false;
  let persistTimer = null;
  function canUseServer(){
    return location.protocol === 'http:' || location.protocol === 'https:';
  }
  async function fetchJson(url, options={}){
    const response = await fetch(url, {
      credentials:'include',
      headers:{'Content-Type':'application/json', ...(options.headers || {})},
      ...options
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if(!response.ok){
      const error = new Error(data.error || response.statusText || 'Ошибка API');
      error.status = response.status;
      throw error;
    }
    return data;
  }
  function applyServerState(data){
    serverState = {
      products:Array.isArray(data.products) ? data.products : getDefaults().products,
      site:data.site || getDefaults().site,
      orders:Array.isArray(data.orders) ? data.orders : [],
      reviews:Array.isArray(data.reviews) ? data.reviews : (getDefaults().reviews || [])
    };
  }
  async function loadServerState(){
    if(!canUseServer()) return false;
    try{
      applyServerState(await fetchJson('/api/state'));
      serverAvailable = true;
      return true;
    }catch(error){
      console.warn('API unavailable, fallback to localStorage', error);
      serverAvailable = false;
      return false;
    }
  }
  async function loadAdminState(){
    if(!serverAvailable) return false;
    try{
      applyServerState(await fetchJson('/api/admin/state'));
      return true;
    }catch(error){
      if(error.status === 401) sessionStorage.removeItem(KEYS.admin);
      console.warn('Admin state unavailable', error);
      return false;
    }
  }
  function isAdminSession(){
    return sessionStorage.getItem(KEYS.admin) === '1';
  }
  function schedulePersist(){
    if(!serverAvailable || !isAdminSession() || !serverState) return;
    clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      fetchJson('/api/admin/state', {method:'PUT', body:JSON.stringify(serverState)})
        .catch(error => console.warn('Не удалось сохранить на сервер', error));
    }, 250);
  }
  function normalizeHomeBlocks(site){
    const defaultSite = getDefaults().site || {};
    const source = site.homeBlocks || {};
    const defaultSource = defaultSite.homeBlocks || {};
    return Object.fromEntries(Object.entries(DEFAULT_HOME_BLOCKS).map(([key, value], index) => {
      const block = {...value, ...(defaultSource[key] || {}), ...(source[key] || {})};
      const fallbackOrder = DEFAULT_HOME_BLOCK_ORDER.indexOf(key) + 1 || index + 1;
      const order = Number(block.order);
      block.order = Number.isFinite(order) && order > 0 ? order : fallbackOrder;
      return [key, block];
    }));
  }
  function normalizeLinks(links){
    return (Array.isArray(links) ? links : []).map(link => ({
      text:String(link.text || '').trim(),
      href:String(link.href || '#').trim(),
      enabled:link.enabled !== false
    })).filter(link => link.text && !REMOVED_PAGE_HREFS.has(link.href));
  }
  function normalizeSiteHeader(site, defaults){
    const storedHeader = site?.header || {};
    const header = {...(defaults.header || {}), ...storedHeader};
    header.storeName = header.storeName || 'ByVit';
    header.logoText = header.logoText || 'BV';
    header.logoImage = (Object.prototype.hasOwnProperty.call(storedHeader, 'logoImage') ? String(storedHeader.logoImage || '').trim() : String(defaults.header?.logoImage || 'assets/favicon.svg').trim()) || 'assets/favicon.svg';
    header.brandImage = Object.prototype.hasOwnProperty.call(storedHeader, 'brandImage') ? String(storedHeader.brandImage || '').trim() : String(defaults.header?.brandImage || '').trim();
    header.topRight = header.topRight || 'BYVIT / STORE / 2026';
    header.searchPlaceholder = header.searchPlaceholder || 'Поиск товара';
    header.adminLabel = header.adminLabel || 'Админ';
    const nav = normalizeLinks(header.nav?.length ? header.nav : defaults.header?.nav);
    const defaultNav = normalizeLinks(defaults.header?.nav || []);
    ['about.html','faq.html'].forEach(href => {
      const defaultLink = defaultNav.find(link => link.href === href);
      if(defaultLink && !nav.some(link => link.href === href)) nav.push(defaultLink);
    });
    header.nav = nav;
    return header;
  }
  function normalizeFooter(site, defaults){
    const footer = {...(defaults.footer || {}), ...(site?.footer || {})};
    footer.contacts = {...(defaults.footer?.contacts || {}), ...(site?.footer?.contacts || {})};
    footer.contacts.phones = Array.isArray(footer.contacts.phones) ? footer.contacts.phones : parseList(footer.contacts.phones || '');
    footer.contacts.extra = normalizeFooterContacts(footer.contacts.extra, defaults.footer?.contacts?.extra);
    footer.badges = normalizeFooterBadges(footer.badges, defaults.footer?.badges);
    footer.columns = Array.isArray(footer.columns) && footer.columns.length ? footer.columns : (defaults.footer?.columns || []);
    footer.columns = footer.columns.map(col => ({title:col.title || 'Раздел',links:normalizeLinks(col.links)}));
    const defaultFooterLinks = (defaults.footer?.columns || []).flatMap(col => normalizeLinks(col.links));
    ['about.html','faq.html'].forEach(href => {
      const defaultLink = defaultFooterLinks.find(link => link.href === href);
      const exists = footer.columns.some(col => (col.links || []).some(link => link.href === href));
      if(defaultLink && !exists){
        const target = footer.columns.find(col => /клиент|магазин/i.test(col.title)) || footer.columns[1] || footer.columns[0];
        if(target) target.links.push(defaultLink);
      }
    });
    return footer;
  }
  function normalizeFooterContacts(items, fallback){
    const source = Array.isArray(items) ? items : (Array.isArray(fallback) ? fallback : []);
    return source.map((item, index) => ({
      id:String(item.id || `contact-${index + 1}`),
      label:String(item.label || '').trim(),
      type:String(item.type || 'link').trim(),
      value:String(item.value || '').trim(),
      href:String(item.href || '').trim(),
      enabled:item.enabled !== false
    })).filter(item => item.label || item.value || item.href);
  }
  function normalizeFooterBadges(items, fallback){
    const source = Array.isArray(items) ? items : (Array.isArray(fallback) ? fallback : []);
    return source.map((item, index) => ({
      id:String(item.id || `badge-${index + 1}`),
      text:String(item.text || '').trim(),
      href:String(item.href || '').trim(),
      image:String(item.image || '').trim(),
      enabled:item.enabled !== false
    })).filter(item => item.text || item.href || item.image);
  }
  function normalizePageHeaders(site, defaults){
    const source = site?.pageHeaders || {};
    const defaultSource = defaults.pageHeaders || {};
    return Object.fromEntries(Object.entries(DEFAULT_PAGE_HEADERS).map(([key, value]) => [key, {...value, ...(defaultSource[key] || {}), ...(source[key] || {})}]));
  }
  function normalizePromos(site, defaults){
    const source = Array.isArray(site?.promos) ? site.promos : defaults.promos;
    return (source || []).map(promo => ({
      code:String(promo.code || '').trim().toUpperCase(),
      type:promo.type === 'fixed' ? 'fixed' : 'percent',
      value:Number(promo.value || 0),
      enabled:promo.enabled !== false
    })).filter(promo => promo.code && promo.value > 0);
  }
  function normalizeDeliveryMethods(site, defaults){
    const hasStoredMethods = site && typeof site.deliveryMethods === 'object' && !Array.isArray(site.deliveryMethods);
    const source = hasStoredMethods ? site.deliveryMethods : (defaults.deliveryMethods || {});
    const methods = {};
    Object.entries(source || {}).forEach(([key, method]) => {
      const id = categoryIdFromName(key, Object.keys(methods).length);
      methods[id] = {
        enabled:method?.enabled !== false,
        title:String(method?.title || '').trim() || 'Способ доставки',
        subtitle:String(method?.subtitle || '').trim()
      };
    });
    return methods;
  }
  function normalizeCheckout(site, defaults){
    const checkout = {...DEFAULT_CHECKOUT, ...(defaults.checkout || {}), ...(site?.checkout || {})};
    checkout.blocks = {...DEFAULT_CHECKOUT.blocks, ...(defaults.checkout?.blocks || {}), ...(site?.checkout?.blocks || {})};
    checkout.paymentOptions = Array.isArray(checkout.paymentOptions) ? checkout.paymentOptions : parseList(checkout.paymentOptions || '');
    if(!checkout.paymentOptions.length) checkout.paymentOptions = DEFAULT_CHECKOUT.paymentOptions;
    return checkout;
  }
  function normalizeHeroMetrics(site, defaults){
    const source = Array.isArray(site?.heroMetrics) ? site.heroMetrics : (Array.isArray(defaults.heroMetrics) ? defaults.heroMetrics : DEFAULT_HERO_METRICS);
    return source.map((item, index) => ({
      id:String(item.id || `metric-${index + 1}`),
      value:String(item.value || '').trim(),
      label:String(item.label || '').trim(),
      enabled:item.enabled !== false
    })).filter(item => item.value || item.label);
  }
  function normalizeSubcategories(items){
    return (Array.isArray(items) ? items : []).map((item, index) => {
      if(typeof item === 'string'){
        return {title:item.trim(),href:'',query:item.trim(),enabled:true};
      }
      return {
        title:String(item.title || item.name || '').trim(),
        href:String(item.href || '').trim(),
        query:String(item.query || item.title || item.name || '').trim(),
        enabled:item.enabled !== false
      };
    }).filter(item => item.title);
  }
  function normalizeCategories(site, defaults){
    const source = Array.isArray(site?.categories) ? site.categories : (Array.isArray(defaults.categories) ? defaults.categories : getDefaults().categories);
    const defaultCategories = Array.isArray(defaults.categories) ? defaults.categories : getDefaults().categories;
    const seen = new Set();
    return (source || []).map((item, index) => {
      const id = categoryIdFromName(item.id || item.name, index);
      const fallback = (defaultCategories || []).find(category => categoryIdFromName(category.id || category.name, index) === id) || {};
      return {
        id,
        name:String(item.name || fallback.name || '').trim(),
        description:String(item.description || fallback.description || '').trim(),
        subcategories:normalizeSubcategories(item.subcategories || fallback.subcategories)
      };
    }).filter(item => {
      if(!item.name || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }
  function normalizeGoals(site, defaults){
    const source = Array.isArray(site?.goals) ? site.goals : (Array.isArray(defaults.goals) ? defaults.goals : DEFAULT_GOALS);
    return (source || []).map((item, index) => ({
      id:String(item.id || `goal-${index + 1}`),
      title:String(item.title || '').trim(),
      text:String(item.text || '').trim(),
      href:String(item.href || 'catalog.html').trim(),
      enabled:item.enabled !== false
    })).filter(item => item.title || item.text);
  }
  function clampNumber(value, min, max, fallback){
    const number = Number(value);
    if(!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, number));
  }
  function normalizeBrandImageValue(value){
    const source = value && typeof value === 'object' && !Array.isArray(value)
      ? value
      : {src:value};
    const fit = ['contain','cover'].includes(source.fit) ? source.fit : DEFAULT_BRAND_IMAGE.fit;
    return {
      src:String(source.src || source.image || '').trim(),
      fit,
      positionX:clampNumber(source.positionX, 0, 100, DEFAULT_BRAND_IMAGE.positionX),
      positionY:clampNumber(source.positionY, 0, 100, DEFAULT_BRAND_IMAGE.positionY),
      scale:clampNumber(source.scale, .5, 2, DEFAULT_BRAND_IMAGE.scale)
    };
  }
  function brandImageStyle(value){
    const image = normalizeBrandImageValue(value);
    return `--brand-img-fit:${image.fit};--brand-img-x:${image.positionX}%;--brand-img-y:${image.positionY}%;--brand-img-scale:${image.scale}`;
  }
  function normalizeBrandImages(site, defaults){
    const source = {...(defaults.brandImages || {}), ...(site?.brandImages || {})};
    return Object.fromEntries(Object.entries(source).map(([brand, value]) => [
      String(brand || '').trim(),
      normalizeBrandImageValue(value)
    ]).filter(([brand, image]) => brand && image.src));
  }
  function normalizeFaqItems(site, defaults){
    const source = Array.isArray(site?.faqItems) ? site.faqItems : (Array.isArray(defaults.faqItems) ? defaults.faqItems : DEFAULT_FAQ_ITEMS);
    return (source || []).map((item, index) => ({
      id:String(item.id || `faq-${index + 1}`),
      question:String(item.question || '').trim(),
      answer:String(item.answer || '').trim(),
      enabled:item.enabled !== false
    })).filter(item => item.question || item.answer);
  }
  function normalizeContentItems(items, fallback){
    const source = Array.isArray(items) ? items : fallback;
    return (source || []).map((item, index) => ({
      id:String(item.id || `item-${index + 1}`),
      title:String(item.title || '').trim(),
      text:String(item.text || '').trim(),
      enabled:item.enabled !== false
    })).filter(item => item.title || item.text);
  }
  function normalizeAboutPage(site, defaults){
    const source = {...DEFAULT_ABOUT_PAGE, ...(defaults.aboutPage || {}), ...(site?.aboutPage || {})};
    source.cards = normalizeContentItems(source.cards, DEFAULT_ABOUT_PAGE.cards);
    return source;
  }
  function normalizeStoreBlocks(site, defaults){
    const hasStoredBlocks = Array.isArray(site?.storeBlocks);
    const source = hasStoredBlocks ? site.storeBlocks : (Array.isArray(defaults.storeBlocks) ? defaults.storeBlocks : DEFAULT_STORE_BLOCKS);
    const blocks = source.map((item, index) => ({
      id:String(item.id || `store-${index + 1}`),
      title:String(item.title || '').trim(),
      text:String(item.text || '').trim(),
      enabled:item.enabled !== false
    })).filter(item => item.title || item.text);
    if(!hasStoredBlocks && blocks[0] && (site?.pickupAddress || site?.phone)){
      blocks[0].text = [site.pickupAddress || '', site.phone ? `Телефон: ${site.phone}` : '', 'График: 10:00–20:00'].filter(Boolean).join('\n');
    }
    return blocks.length ? blocks : clone(DEFAULT_STORE_BLOCKS);
  }
  function normalizePickupStores(site, defaults){
    const hasStoredStores = Array.isArray(site?.pickupStores);
    const defaultStores = Array.isArray(defaults.pickupStores) ? defaults.pickupStores : DEFAULT_PICKUP_STORES;
    const source = hasStoredStores ? site.pickupStores : defaultStores;
    const stores = (source || []).map((item, index) => ({
      id:String(item.id || `pickup-${index + 1}`),
      title:String(item.title || '').trim(),
      address:String(item.address || '').trim(),
      note:String(item.note || '').trim(),
      enabled:item.enabled !== false
    })).filter(item => item.title || item.address || item.note);
    if(!hasStoredStores && !stores.length && site?.pickupAddress){
      stores.push({id:'main',title:'Шоурум ByVit',address:String(site.pickupAddress).trim(),note:'',enabled:true});
    }
    if(!hasStoredStores && stores[0] && site?.pickupAddress){
      stores[0].address = String(site.pickupAddress).trim();
      stores[0].title = stores[0].title || 'Шоурум ByVit';
    }
    return hasStoredStores ? stores : (stores.length ? stores : clone(DEFAULT_PICKUP_STORES));
  }
  function normalizeMap(site, defaults){
    const map = {...DEFAULT_MAP, ...(defaults.map || {}), ...(site?.map || {})};
    const version = Number(site?.map?.version || 0);
    map.enabled = map.enabled === true;
    map.provider = ['yandex','google','custom'].includes(map.provider) ? map.provider : 'yandex';
    map.embedUrl = String(map.embedUrl || '').trim();
    map.embedUrl = mapSrcFromValue(map.embedUrl) || map.embedUrl || DEFAULT_YANDEX_MAP_SRC;
    if(version < 2 && map.embedUrl === DEFAULT_YANDEX_MAP_SRC) map.enabled = true;
    map.version = 2;
    map.placeholder = String(map.placeholder || DEFAULT_MAP.placeholder).trim();
    return map;
  }
  function normalizeSite(site){
    const defaults = getDefaults().site || {};
    const storedTypographyVersion = Number(site?.typographyVersion || 1);
    const merged = {...defaults, ...(site || {})};
    delete merged.sleepPage;
    merged.header = normalizeSiteHeader(site, defaults);
    merged.telegram = {...(defaults.telegram || {}), ...(site?.telegram || {})};
    merged.deliveryMethods = normalizeDeliveryMethods(site, defaults);
    merged.footer = normalizeFooter(site, defaults);
    merged.pageHeaders = normalizePageHeaders(site, defaults);
    merged.categories = normalizeCategories(site, defaults);
    merged.faqItems = normalizeFaqItems(site, defaults);
    merged.promos = normalizePromos(site, defaults);
    merged.checkout = normalizeCheckout(site, defaults);
    merged.aboutPage = normalizeAboutPage(site, defaults);
    merged.homeBlocks = normalizeHomeBlocks(merged);
    merged.goals = normalizeGoals(site, defaults);
    merged.brandImages = normalizeBrandImages(site, defaults);
    merged.heroMetrics = normalizeHeroMetrics(site, defaults);
    merged.storeBlocks = normalizeStoreBlocks(site, defaults);
    merged.pickupStores = normalizePickupStores(site, defaults);
    merged.map = normalizeMap(site, defaults);
    merged.adminPasswordHash = site?.adminPasswordHash || defaults.adminPasswordHash || ADMIN_PASSWORD_HASH;
    if(storedTypographyVersion < 2){
      Object.values(merged.homeBlocks).forEach(block => {
        block.titleSize = Math.min(36, Number(block.titleSize || 36));
      });
      merged.typographyVersion = 2;
    }
    merged.heroEyebrow = merged.heroEyebrow || 'Premium supplements';
    merged.heroTitleSize = Number(merged.heroTitleSize || 44);
    merged.heroTextSize = Number(merged.heroTextSize || 16);
    merged.heroAlign = merged.heroAlign || 'right';
    merged.heroMediaMode = merged.heroMediaMode || 'video';
    merged.heroMediaSrc = merged.heroMediaSrc || 'assets/hero-video.mp4';
    merged.heroAnimation = merged.heroAnimation || 'waves';
    merged.heroEyebrowColor = colorValue(merged.heroEyebrowColor, DEFAULT_HERO_COLORS.eyebrow);
    merged.heroTitleColor = colorValue(merged.heroTitleColor, DEFAULT_HERO_COLORS.title);
    merged.heroTextColor = colorValue(merged.heroTextColor, DEFAULT_HERO_COLORS.text);
    merged.heroMediaOpacity = Math.min(1, Math.max(.15, Number(merged.heroMediaOpacity ?? .78)));
    merged.heroVeilOpacity = Math.min(1, Math.max(0, Number(merged.heroVeilOpacity ?? 1)));
    merged.heroOverlayOpacity = Math.min(.7, Math.max(0, Number(merged.heroOverlayOpacity ?? .18)));
    return merged;
  }
  function getProducts(){ return read(KEYS.products, getDefaults().products); }
  function saveProducts(products){ write(KEYS.products, products); }
  function getSite(){ return normalizeSite(read(KEYS.site, getDefaults().site)); }
  function saveSite(site){ write(KEYS.site, normalizeSite(site)); }
  function getCategories(){ return getSite().categories || getDefaults().categories; }
  function getGoals(){ return getSite().goals || DEFAULT_GOALS; }
  function getCart(){ return read(KEYS.cart, []); }
  function saveCart(cart){ write(KEYS.cart, cart); updateCounts(); }
  function getWishlist(){ return read(KEYS.wishlist, []); }
  function saveWishlist(list){ write(KEYS.wishlist, list); updateCounts(); }
  function getCompare(){ return read(KEYS.compare, []); }
  function saveCompare(list){ write(KEYS.compare, list); updateCounts(); }
  function getOrders(){ return read(KEYS.orders, []); }
  function saveOrders(orders){ write(KEYS.orders, orders); }
  function getReviews(){ return read(KEYS.reviews, getDefaults().reviews || []); }
  function saveReviews(reviews){ write(KEYS.reviews, reviews); }
  function productById(id){ return getProducts().find(p => String(p.id) === String(id)); }
  function categoryName(id){ return (getCategories().find(c => c.id === id) || {}).name || id || 'Категория'; }
  function brands(){ return [...new Set(getProducts().map(p => p.brand).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ru')); }
  function brandCardHtml(brand, index, products=getProducts(), site=getSite()){
    const image = normalizeBrandImageValue(site.brandImages?.[brand] || '');
    const count = products.filter(product => product.brand === brand).length;
    return `<a href="catalog.html?brand=${encodeURIComponent(brand)}" class="brand-card ${image.src ? 'has-image' : ''}">
      <span class="index">Brand ${String(index + 1).padStart(2,'0')}</span>
      <div class="brand-media" style="${esc(brandImageStyle(image))}">${image.src ? `<img src="${esc(image.src)}" alt="${esc(brand)}" loading="lazy">` : `<div class="brand-letter">${esc(brand[0] || 'B')}</div>`}</div>
      <h3 title="${esc(brand)}">${esc(brand)}</h3>
      <p>${count} товар(ов)</p>
    </a>`;
  }
  function firstImage(product){ return product?.images?.[0] || 'assets/product-whey.jpg'; }
  function defaultPackage(product){ return product?.packageOptions?.[0] || {id:'base',label:'1 шт.',price:Number(product?.price || 0)}; }
  function optionById(product, optionId){ return product?.packageOptions?.find(o => o.id === optionId) || defaultPackage(product); }
  function cartKey(productId, optionId, flavor){ return [productId, optionId || 'base', flavor || ''].join('::'); }
  function formTypeLabel(type){ return FORM_TYPES[type] || type || '—'; }
  function badgeColor(product){
    const color = String(product?.badgeColor || DEFAULT_BADGE_COLOR).trim();
    return /^#[0-9a-f]{6}$/i.test(color) ? color : DEFAULT_BADGE_COLOR;
  }
  function colorValue(value, fallback){
    const color = String(value || '').trim();
    return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
  }
  function adminSectionStyle(block){
    const titleSize = Math.min(72, Math.max(24, Number(block?.titleSize || 36)));
    const textSize = Math.min(22, Math.max(12, Number(block?.textSize || 15)));
    return `style="--section-title-size:${titleSize}px;--section-text-size:${textSize}px"`;
  }
  function classToken(value, fallback){
    const token = String(value || '').trim();
    return /^[a-z0-9_-]+$/i.test(token) ? token : fallback;
  }
  function textToParagraphs(value){
    const lines = String(value || '').split(/\n+/).map(line => line.trim()).filter(Boolean);
    return lines.length ? lines.map(line => `<p>${esc(line)}</p>`).join('') : '<p></p>';
  }
  function mapSrcFromValue(value){
    const raw = String(value || '').trim();
    const iframeMatch = raw.match(/<iframe[^>]+src=["']([^"']+)["']/i);
    let src = (iframeMatch ? iframeMatch[1] : raw).trim();
    if(/^\/\//.test(src)) src = `https:${src}`;
    const yandexSrc = yandexMapWidgetSrc(src);
    if(yandexSrc) return yandexSrc;
    return /^https?:\/\//i.test(src) ? src : '';
  }
  function yandexMapWidgetSrc(src){
    if(!/^https?:\/\/[^/]*yandex\./i.test(src)) return '';
    if(/\/map-widget\/v1\//i.test(src)) return src;
    if(/\/maps\/-\/CTQbr6LE/i.test(src)) return DEFAULT_YANDEX_MAP_SRC;
    try{
      const url = new URL(src);
      const ll = url.searchParams.get('ll');
      const z = url.searchParams.get('z') || '16';
      const orgMatch = url.pathname.match(/\/maps\/org\/[^/]+\/(\d+)/i);
      if(!ll) return '';
      const widget = new URL(`https://${url.hostname}/map-widget/v1/`);
      widget.searchParams.set('ll', ll);
      widget.searchParams.set('z', z);
      if(orgMatch){
        widget.searchParams.set('mode', 'search');
        widget.searchParams.set('ol', 'biz');
        widget.searchParams.set('oid', orgMatch[1]);
      }
      return widget.toString();
    }catch(e){
      return '';
    }
  }
  function ratingStars(value){
    const rating = Math.max(1, Math.min(5, Math.round(Number(value || 5))));
    return `<div class="stars" title="Оценка ${rating} из 5">${'★'.repeat(rating).slice(0,5)}</div>`;
  }
  function setActiveNav(){
    const current = currentPageHref();
    $$('[data-nav]').forEach(a => a.classList.toggle('active', a.getAttribute('href') === current));
  }
  function updateCounts(){
    const cartQty = getCart().reduce((sum,item)=>sum + Number(item.qty || 0),0);
    const counts = {cart:cartQty,wishlist:getWishlist().length,compare:getCompare().length};
    $$('[data-count]').forEach(el => { el.textContent = counts[el.dataset.count] || 0; });
  }
  function currentPageHref(){
    return location.pathname.split('/').pop() || 'index.html';
  }
  function contactItems(site){
    const contacts = site.footer?.contacts || {};
    const items = [];
    const primaryPhone = (contacts.phones || []).find(Boolean);
    if(primaryPhone) items.push({label:'Позвонить',type:'phone',value:primaryPhone});
    if(contacts.telegram) items.push({label:'Telegram',type:'telegram',value:contacts.telegram});
    (contacts.extra || []).filter(item => item.enabled !== false).forEach(item => {
      items.push({label:item.label || item.value || 'Контакт',type:item.type || 'link',value:item.value || item.href || '',href:item.href || ''});
    });
    if(contacts.email) items.push({label:'Почта',type:'email',value:contacts.email});
    return items.filter(item => item.value || item.href);
  }
  function renderMobileSearch(header){
    const headerEl = $('.site-header');
    if(!headerEl) return;
    const actions = $('.header-actions', headerEl);
    if(actions && !$('[data-mobile-search]', actions)){
      const burger = $('[data-burger]', actions);
      const button = document.createElement('button');
      button.className = 'icon-link mobile-search-trigger';
      button.type = 'button';
      button.setAttribute('aria-label', 'Поиск');
      button.setAttribute('data-mobile-search', '');
      button.textContent = '⌕';
      if(burger) actions.insertBefore(button, burger);
      else actions.appendChild(button);
    }
    let panel = $('[data-mobile-search-panel]', headerEl);
    if(!panel){
      panel = document.createElement('div');
      panel.className = 'mobile-search-panel';
      panel.setAttribute('data-mobile-search-panel', '');
      headerEl.appendChild(panel);
    }
    panel.innerHTML = `<div class="container"><form class="header-search" data-header-search-form action="catalog.html" method="get"><input data-header-search name="q" placeholder="${esc(header.searchPlaceholder || 'Поиск товара')}"><button type="submit" aria-label="Искать">⌕</button></form></div>`;
  }
  function renderBottomNav(){
    let nav = $('[data-mobile-bottom-nav]');
    if(!nav){
      nav = document.createElement('nav');
      nav.className = 'mobile-bottom-nav';
      nav.setAttribute('data-mobile-bottom-nav', '');
      nav.setAttribute('aria-label', 'Быстрая навигация');
      document.body.appendChild(nav);
    }
    const current = currentPageHref();
    const activeHref = current === 'product.html' ? 'catalog.html' : current;
    const items = [
      {label:'Главная',href:'index.html',icon:'⌂'},
      {label:'Каталог',href:'catalog.html',icon:'▦'},
      {label:'Корзина',href:'cart.html',icon:'🛒',count:'cart'},
      {label:'Магазины',href:'stores.html',icon:'⌖'}
    ];
    nav.innerHTML = items.map(item => `
      <a class="${item.href === activeHref ? 'active' : ''}" href="${esc(item.href)}">
        <span class="bottom-nav-icon">${item.icon}</span>
        <span>${esc(item.label)}</span>
        ${item.count ? `<span class="bottom-nav-count" data-count="${esc(item.count)}">0</span>` : ''}
      </a>`).join('');
  }
  function renderQuickContact(site){
    const items = contactItems(site);
    let root = $('[data-quick-contact]');
    if(!items.length){
      if(root) root.remove();
      return;
    }
    if(!root){
      root = document.createElement('div');
      root.className = 'quick-contact';
      root.setAttribute('data-quick-contact', '');
      document.body.appendChild(root);
    }
    const links = items.slice(0,5).map(item => {
      const href = item.href || contactHref(item.type, item.value);
      return `<a href="${esc(href)}" ${/^https?:\/\//i.test(href) ? 'target="_blank" rel="noopener"' : ''}>${esc(item.label)}</a>`;
    }).join('');
    root.innerHTML = `<button class="quick-contact-button" type="button" data-contact-toggle aria-expanded="false">Связаться</button><div class="quick-contact-panel">${links}</div>`;
  }
  function brandMarkContent(header){
    const src = String(header.logoImage || '').trim();
    return src ? `<img class="brand-mark-img" src="${esc(src)}" alt="">` : esc(header.logoText || 'BV');
  }
  function brandNameContent(header){
    const src = String(header.brandImage || '').trim();
    const name = header.storeName || 'ByVit';
    return src ? `<img class="brand-name-img" src="${esc(src)}" alt="${esc(name)}">` : esc(name);
  }
  function renderBrandInLink(link, header){
    const mark = $('.brand-mark', link);
    const name = $('span:last-child', link);
    if(mark){
      mark.innerHTML = brandMarkContent(header);
      mark.classList.toggle('has-image', Boolean(String(header.logoImage || '').trim()));
    }
    if(name){
      name.innerHTML = brandNameContent(header);
      name.classList.add('brand-name');
      name.classList.toggle('has-image', Boolean(String(header.brandImage || '').trim()));
    }
  }
  function brandLinkHtml(header, extra=''){
    return `<a class="brand" href="index.html" ${extra}><span class="brand-mark ${String(header.logoImage || '').trim() ? 'has-image' : ''}">${brandMarkContent(header)}</span><span class="brand-name ${String(header.brandImage || '').trim() ? 'has-image' : ''}">${brandNameContent(header)}</span></a>`;
  }
  function applyHeader(){
    const site = getSite();
    const header = site.header || {};
    $$('[data-site-announcement]').forEach(el => { el.textContent = site.announcement || 'Оригинальные бренды · доставка · самовывоз'; });
    $$('.header-top .mono').forEach(el => { el.textContent = header.topRight || ''; });
    $$('.site-header .brand').forEach(brand => renderBrandInLink(brand, header));
    $$('.header-search input').forEach(input => { input.placeholder = header.searchPlaceholder || 'Поиск товара'; input.name = 'q'; });
    $$('.admin-pill').forEach(link => { link.textContent = header.adminLabel || 'Админ'; });
    const navHtml = (header.nav || []).filter(link => link.enabled !== false).map(link => `<a data-nav href="${esc(link.href)}">${esc(link.text)}</a>`).join('');
    $$('.main-nav').forEach(nav => { nav.innerHTML = navHtml; });
	    $$('.mobile-panel .container').forEach(panel => {
	      const searchForm = $('.header-search', panel)?.outerHTML || '';
	      const utility = [
	        {text:'Избранное',href:'wishlist.html'},
	        {text:'Сравнение',href:'compare.html'},
	        {text:'Корзина',href:'cart.html'}
	      ].map(link => `<a href="${link.href}">${link.text}</a>`).join('');
	      panel.innerHTML = `${navHtml.replaceAll(' data-nav','')} ${utility}${searchForm}`;
	    });
	    renderMobileSearch(header);
	    renderBottomNav();
	    renderQuickContact(site);
	    setActiveNav();
    const burger = $('[data-burger]');
    const mobile = $('[data-mobile-panel]');
    if(burger && mobile){
      burger.addEventListener('click', () => { document.body.classList.toggle('menu-open'); mobile.classList.toggle('open'); });
    }
    $$('[data-header-search-form]').forEach(form => {
      form.addEventListener('submit', event => {
        event.preventDefault();
        const input = $('[data-header-search]', event.currentTarget);
        const q = String(input?.value || '').trim();
        location.href = q ? `catalog.html?q=${encodeURIComponent(q)}` : 'catalog.html';
      });
    });
  }
  function contactHref(type, value){
    const clean = String(value || '').trim();
    if(!clean) return '#';
    if(/^https?:\/\//i.test(clean) || /^mailto:/i.test(clean) || /^tel:/i.test(clean)) return clean;
    if(type === 'instagram') return `https://instagram.com/${clean.replace(/^@/,'')}`;
    if(type === 'telegram') return `https://t.me/${clean.replace(/^@/,'')}`;
    if(type === 'email') return `mailto:${clean}`;
    if(type === 'phone') return `tel:${clean.replace(/[^\d+]/g,'')}`;
    if(type === 'viber') return `viber://chat?number=${clean.replace(/[^\d+]/g,'')}`;
    if(type === 'whatsapp') return `https://wa.me/${clean.replace(/[^\d]/g,'')}`;
    return clean;
  }
  function footerContactLink(item){
    const label = item.label || item.value || 'Контакт';
    const href = item.href || contactHref(item.type, item.value);
    if(!href) return `<span>${esc(label)}</span>`;
    return `<a href="${esc(href)}" ${/^https?:\/\//i.test(href) ? 'target="_blank" rel="noopener"' : ''}>${esc(label)}</a>`;
  }
  function renderFooter(){
    const footer = $('.footer');
    if(!footer) return;
    const site = getSite();
    const header = site.header || {};
    const config = site.footer || {};
    const contacts = config.contacts || {};
    const contactLinks = [
      contacts.instagram ? `<a href="${esc(contactHref('instagram', contacts.instagram))}" target="_blank" rel="noopener">Instagram</a>` : '',
      contacts.telegram ? `<a href="${esc(contactHref('telegram', contacts.telegram))}" target="_blank" rel="noopener">Telegram</a>` : '',
      contacts.email ? `<a href="${esc(contactHref('email', contacts.email))}">${esc(contacts.email)}</a>` : '',
      ...(contacts.phones || []).map(phone => `<a href="${esc(contactHref('phone', phone))}">${esc(phone)}</a>`),
      ...(contacts.extra || []).filter(item => item.enabled !== false).map(footerContactLink)
    ].filter(Boolean).join('');
    const footerColumn = (title, body) => `<div class="footer-column" data-footer-accordion><button class="footer-toggle" type="button" data-footer-toggle aria-expanded="false"><span>${esc(title)}</span></button><div class="footer-links">${body}</div></div>`;
    const columns = (config.columns || []).map(col => footerColumn(col.title, (col.links || []).filter(l=>l.enabled!==false).map(l=>`<a href="${esc(l.href)}">${esc(l.text)}</a>`).join(''))).join('');
    const badges = (config.badges || []).filter(badge => badge.enabled !== false && (badge.text || badge.image)).map(badge => {
      const body = badge.image
        ? `<span class="footer-badge footer-badge-media">${badge.text ? `<span class="sr-only">${esc(badge.text)}</span>` : ''}<img class="footer-badge-img" src="${esc(badge.image)}" alt="${esc(badge.text || 'Платёжный значок')}"></span>`
        : `<span class="footer-badge">${esc(badge.text)}</span>`;
      return badge.href ? `<a class="footer-badge-link" href="${esc(badge.href)}" target="_blank" rel="noopener">${body}</a>` : body;
    }).join('');
    footer.innerHTML = `<div class="container">
      <div class="footer-grid">
        <div class="footer-brand-block">${brandLinkHtml(header, 'style="color:#fff"')}<a class="footer-admin-link" href="admin.html" aria-label="Админка">admin</a><p style="margin-top:18px;max-width:380px">${esc(config.description || '')}</p></div>
        ${columns}
        ${footerColumn('Контакты', contactLinks || '<span>Контакты не указаны</span>')}
	      </div>
	      ${badges ? `<div class="footer-badges">${badges}</div>` : ''}
	      <div class="footer-bottom"><span>${esc(config.copyright || '')}</span><span class="mono">${esc(config.techText || '')}</span></div>
	    </div>`;
	  }
  function applyPageHeader(){
    const page = document.body.dataset.page;
    const root = $('.page-hero');
    if(!root || !page) return;
    const data = getSite().pageHeaders?.[page];
    if(!data) return;
    let h1 = $('h1', root);
    const p = $('p', root);
    if(!h1 && data.title){
      h1 = document.createElement('h1');
      if(p) p.before(h1);
      else ($('.container', root) || root).appendChild(h1);
    }
    if(h1 && data.title) h1.textContent = data.title;
    if(p) p.textContent = data.text || '';
  }

  function productCard(product){
    const wishActive = getWishlist().includes(product.id);
    const compareActive = getCompare().includes(product.id);
    const out = Number(product.stock || 0) <= 0;
    const option = defaultPackage(product);
    return `
      <article class="product-card" data-product-id="${esc(product.id)}">
        <div class="product-media">
          <a href="product.html?id=${esc(product.id)}"><img src="${esc(firstImage(product))}" alt="${esc(product.name)}" loading="lazy"></a>
          <div class="product-badges">
            <div class="product-badges-main">
              ${product.badge ? `<span class="badge" style="--badge-bg:${badgeColor(product)}">${esc(product.badge)}</span>` : ''}
            </div>
            <span class="stock-badge ${out ? 'out' : ''}">${out ? 'Нет' : `В наличии ${esc(product.stock)}`}</span>
          </div>
          <div class="product-card-actions">
            <button class="btn" data-action="quick" data-id="${esc(product.id)}">Быстрый просмотр</button>
          </div>
        </div>
        <div class="product-body">
          <div class="product-brand">${esc(product.brand || 'ByVit')}</div>
          <h3 class="product-title"><a href="product.html?id=${esc(product.id)}">${esc(product.name)}</a></h3>
          <p class="product-desc">${esc(product.shortDescription || '')}</p>
          <div class="product-card-tags">
            <span>${esc(formTypeLabel(product.formType))}</span>
            ${option?.label ? `<span>${esc(option.label)}</span>` : ''}
            <span>${out ? 'Нет в наличии' : `${esc(product.stock)} шт.`}</span>
          </div>
          <div class="product-meta">
            <div><span class="price">${money(product.price)}</span>${product.oldPrice ? `<span class="old-price">${money(product.oldPrice)}</span>` : ''}</div>
            <div class="stars" title="Рейтинг">${'★'.repeat(Math.round(product.rating || 5)).slice(0,5)}</div>
          </div>
          <div class="card-buttons">
            <button class="btn btn-primary small" data-action="cart" data-id="${esc(product.id)}" ${out ? 'disabled' : ''}>В корзину</button>
            <button class="circle-action ${wishActive ? 'active' : ''}" data-action="wishlist" data-id="${esc(product.id)}" title="Избранное">♡</button>
            <button class="circle-action ${compareActive ? 'active' : ''}" data-action="compare" data-id="${esc(product.id)}" title="Сравнить">⇄</button>
          </div>
        </div>
      </article>`;
  }

  function renderGrid(container, products){
    if(!container) return;
    container.innerHTML = products.length ? products.map(productCard).join('') : `<div class="empty-state"><h3>Товаров не найдено</h3><p>Фильтр слишком строгий. Даже у магазина иногда заканчивается терпение.</p></div>`;
  }

  function addToCart(productId, optionId, flavor, qty=1){
    const product = productById(productId);
    if(!product){ toast('Товар не найден'); return; }
    if(Number(product.stock || 0) <= 0){ toast('Товара нет в наличии'); return; }
    const option = optionById(product, optionId);
    const selectedFlavor = flavor || product.flavors?.[0] || '';
    const key = cartKey(product.id, option.id, selectedFlavor);
    const cart = getCart();
    const existing = cart.find(item => item.key === key);
    if(existing) existing.qty += Number(qty || 1);
    else cart.push({key,productId:product.id,optionId:option.id,optionLabel:option.label,flavor:selectedFlavor,price:Number(option.price || product.price || 0),qty:Number(qty || 1)});
    saveCart(cart);
    toast('Товар добавлен в корзину');
  }

  function toggleWishlist(id){
    const numeric = Number(id);
    const list = getWishlist();
    const next = list.includes(numeric) ? list.filter(x => x !== numeric) : [...list, numeric];
    saveWishlist(next);
    refreshCurrentPage();
    toast(next.includes(numeric) ? 'Добавлено в избранное' : 'Убрано из избранного');
  }
  function toggleCompare(id){
    const numeric = Number(id);
    const list = getCompare();
    let next;
    if(list.includes(numeric)) next = list.filter(x => x !== numeric);
    else {
      if(list.length >= 4){ toast('Для сравнения максимум 4 товара'); return; }
      next = [...list, numeric];
    }
    saveCompare(next);
    refreshCurrentPage();
    toast(next.includes(numeric) ? 'Добавлено к сравнению' : 'Убрано из сравнения');
  }

  function openModal(title, body){
    let modal = $('#modal');
    if(!modal){
      modal = document.createElement('div');
      modal.id = 'modal';
      modal.className = 'modal';
      modal.innerHTML = `<div class="modal-card"><div class="modal-head"><h3 data-modal-title></h3><button class="modal-close" data-modal-close>×</button></div><div class="modal-body" data-modal-body></div></div>`;
      document.body.appendChild(modal);
    }
    $('[data-modal-title]', modal).textContent = title;
    $('[data-modal-body]', modal).innerHTML = body;
    modal.classList.add('open');
  }
  function closeModal(){ const modal = $('#modal'); if(modal) modal.classList.remove('open'); }
  function quickView(id){
    const p = productById(id);
    if(!p) return;
    const option = defaultPackage(p);
    openModal(p.name, `
      <div class="quick-view-grid">
        <img src="${esc(firstImage(p))}" alt="${esc(p.name)}">
        <div>
          <div class="product-brand">${esc(p.brand)}</div>
          <h2 style="font-size:42px;margin-bottom:14px">${esc(p.name)}</h2>
          <p>${esc(p.description || p.shortDescription || '')}</p>
          <div class="product-facts">
            <div class="fact"><span>Страна</span><strong>${esc(p.country || '—')}</strong></div>
            <div class="fact"><span>Наличие</span><strong>${esc(p.stock || 0)} шт.</strong></div>
            <div class="fact"><span>Форма</span><strong>${esc(formTypeLabel(p.formType))}</strong></div>
          </div>
          <p><span class="price">${money(option.price)}</span>${p.oldPrice ? `<span class="old-price">${money(p.oldPrice)}</span>` : ''}</p>
          <div class="hero-actions" style="margin:24px 0 0">
            <button class="btn btn-primary" data-action="cart" data-id="${esc(p.id)}">В корзину</button>
            <a class="btn btn-outline" href="product.html?id=${esc(p.id)}">Открыть карточку</a>
          </div>
        </div>
      </div>`);
  }

  function renderHeroMedia(site){
    const hero = $('.hero');
    const root = $('#heroMedia');
    if(hero){
      hero.dataset.align = site.heroAlign || 'right';
      hero.style.setProperty('--hero-media-opacity', String(site.heroMediaOpacity));
      hero.style.setProperty('--hero-veil-opacity', String(site.heroVeilOpacity));
      hero.style.setProperty('--hero-overlay-opacity', String(site.heroOverlayOpacity));
      hero.style.setProperty('--hero-eyebrow-color', colorValue(site.heroEyebrowColor, DEFAULT_HERO_COLORS.eyebrow));
      hero.style.setProperty('--hero-title-color', colorValue(site.heroTitleColor, DEFAULT_HERO_COLORS.title));
      hero.style.setProperty('--hero-text-color', colorValue(site.heroTextColor, DEFAULT_HERO_COLORS.text));
    }
    if(!root) return;
    const mode = site.heroMediaMode || 'video';
    const src = site.heroMediaSrc || '';
    const imageFallback = 'assets/article-featured.jpg';
    if(mode === 'animation'){
      root.innerHTML = `<div class="hero-animation ${classToken(site.heroAnimation, 'waves')}"><span></span><span></span><span></span></div>`;
      return;
    }
    if(mode === 'image' || (mode === 'file' && !/(\.mp4|\.webm|^data:video)/i.test(src))){
      root.innerHTML = `<img src="${esc(src || imageFallback)}" alt="">`;
      return;
    }
    root.innerHTML = `<video autoplay muted loop playsinline><source src="${esc(src || 'assets/hero-video.mp4')}" type="video/mp4"></video>`;
  }
	  function applyHomeBlock(key, block){
	    const section = $(`[data-home-block="${key}"]`);
	    if(!section) return;
    section.hidden = block.visible === false;
    section.setAttribute('style', `--section-title-size:${Math.min(72, Math.max(24, Number(block.titleSize || 36)))}px;--section-text-size:${Math.min(22, Math.max(12, Number(block.textSize || 15)))}px`);
    const eyebrow = $('[data-block-eyebrow]', section);
    const title = $('[data-block-title]', section);
    const text = $('[data-block-text]', section);
    const button = $('[data-block-button]', section);
    if(eyebrow) eyebrow.textContent = block.eyebrow || '';
    if(title) title.textContent = block.title || '';
    if(text){
      text.textContent = block.text || '';
      text.hidden = !block.text;
    }
    if(button){
      button.textContent = block.buttonText || button.textContent;
      button.href = block.buttonUrl || button.getAttribute('href') || '#';
	      button.hidden = !block.buttonText;
	    }
	  }
  function homeBlockOrder(key, block, index=0){
    const order = Number(block?.order);
    if(Number.isFinite(order) && order > 0) return order;
    const fallback = DEFAULT_HOME_BLOCK_ORDER.indexOf(key);
    return fallback >= 0 ? fallback + 1 : index + 1;
  }
  function orderHomeSections(blocks){
    const main = $('main');
    if(!main) return;
    const sections = $$('[data-home-block]', main).map((section, index) => {
      const key = section.dataset.homeBlock;
      return {section, key, index, order:homeBlockOrder(key, blocks[key], index)};
    }).sort((a, b) => a.order - b.order || a.index - b.index);
    sections.forEach(item => main.appendChild(item.section));
    sections.filter(item => !item.section.hidden).forEach((item, visibleIndex) => {
      if(item.section.classList.contains('dark')) return;
      const paper = visibleIndex % 2 === 1;
      item.section.classList.toggle('paper', paper);
      item.section.dataset.tone = paper ? 'paper' : 'white';
    });
  }
	  function goalCard(goal, index){
	    return `<a class="goal-card" href="${esc(goal.href || 'catalog.html')}">
	      <span class="goal-index">${String(index + 1).padStart(2,'0')}</span>
	      <h3>${esc(goal.title)}</h3>
	      <p>${esc(goal.text)}</p>
	    </a>`;
	  }
	  function renderGoals(){
	    const root = $('#homeGoals');
	    if(!root) return;
	    const goals = getGoals().filter(item => item.enabled !== false).slice(0,8);
	    root.innerHTML = goals.length ? goals.map(goalCard).join('') : '';
	  }
	  function categorySubLink(category, sub){
	    const href = sub.href || `catalog.html?category=${encodeURIComponent(category.id)}${sub.query ? `&q=${encodeURIComponent(sub.query)}` : ''}`;
	    return `<a href="${esc(href)}">${esc(sub.title)}</a>`;
	  }
	  function renderCatalogSmart(){
	    const toolbar = $('.catalog-layout .toolbar');
	    if(!toolbar) return;
	    let root = $('#catalogSmart');
	    if(!root){
	      root = document.createElement('div');
	      root.id = 'catalogSmart';
	      root.className = 'catalog-smart';
	      toolbar.before(root);
	    }
	    const cats = getCategories().filter(Boolean).slice(0,8);
	    root.innerHTML = `<div class="catalog-smart-head"><div><span class="eyebrow">Разделы</span><h2>Быстрый каталог</h2></div><a href="catalog.html">Все товары</a></div>
	      <div class="catalog-smart-grid">
	        ${cats.map((category, index) => {
	          const subs = (category.subcategories || []).filter(item => item.enabled !== false).slice(0,4).map(sub => categorySubLink(category, sub)).join('');
	          return `<article class="catalog-smart-card">
	            <a class="catalog-smart-mark" href="catalog.html?category=${esc(category.id)}">${String(index + 1).padStart(2,'0')}</a>
	            <div>
	              <a class="catalog-smart-title" href="catalog.html?category=${esc(category.id)}">${esc(category.name)}</a>
	              <p>${esc(category.description)}</p>
	              ${subs ? `<div class="catalog-smart-links">${subs}</div>` : ''}
	            </div>
	          </article>`;
	        }).join('')}
	      </div>`;
	  }
	  function renderHome(){
    const site = getSite();
    const products = getProducts();
    const blocks = site.homeBlocks || DEFAULT_HOME_BLOCKS;
    const heroEyebrow = $('#heroEyebrow');
    const heroTitle = $('#heroTitle');
    const heroText = $('#heroText');
    if(heroEyebrow) heroEyebrow.textContent = site.heroEyebrow || 'Premium supplements';
    if(heroTitle){
      heroTitle.textContent = site.heroTitle || getDefaults().site.heroTitle;
      heroTitle.style.fontSize = `${Math.min(86, Math.max(28, Number(site.heroTitleSize || 44)))}px`;
    }
    if(heroText){
      heroText.textContent = site.heroText || getDefaults().site.heroText;
      heroText.style.fontSize = `${Math.min(24, Math.max(12, Number(site.heroTextSize || 16)))}px`;
    }
    renderHeroMedia(site);
    const metricRoot = $('.hero-metrics');
    if(metricRoot){
      const metrics = (site.heroMetrics || DEFAULT_HERO_METRICS).filter(item => item.enabled !== false);
      metricRoot.hidden = !metrics.length;
      metricRoot.innerHTML = metrics.map(item => `<div class="metric"><strong>${esc(item.value)}</strong><span>${esc(item.label)}</span></div>`).join('');
    }
	    Object.entries(blocks).forEach(([key, block]) => applyHomeBlock(key, block));
	    orderHomeSections(blocks);
    const service = blocks.service || {};
    const serviceOneTitle = $('#serviceFeatureOneTitle');
    const serviceOneText = $('#serviceFeatureOneText');
    const serviceTwoTitle = $('#serviceFeatureTwoTitle');
    const serviceTwoText = $('#serviceFeatureTwoText');
    if(serviceOneTitle) serviceOneTitle.textContent = service.featureOneTitle || 'Быстрый заказ';
    if(serviceOneText) serviceOneText.textContent = service.featureOneText || '';
    if(serviceTwoTitle) serviceTwoTitle.textContent = service.featureTwoTitle || 'Контроль товара';
    if(serviceTwoText) serviceTwoText.textContent = service.featureTwoText || '';
    const catGrid = $('#homeCategories');
	    if(catGrid){
	      catGrid.innerHTML = getCategories().slice(0,8).map((c,i)=>`
	        <a class="category-card" href="catalog.html?category=${esc(c.id)}">
          <span class="index">${String(i+1).padStart(2,'0')}</span>
          <h3>${esc(c.name)}</h3>
          <p>${esc(c.description)}</p>
          <div class="card-arrow">Перейти →</div>
	        </a>`).join('');
	    }
	    renderGoals();
	    renderGrid($('#featuredProducts'), products.filter(p => p.popular).slice(0,4));
    renderGrid($('#saleProducts'), products.filter(p => p.oldPrice).slice(0,4));
	    const brandRail = $('#homeBrands');
	    if(brandRail){
	      brandRail.innerHTML = brands().slice(0,10).map((brand,i)=>brandCardHtml(brand, i, products, site)).join('');
	    }
    document.body.classList.add('home-ready');
  }

  function filterProducts(){
    let list = getProducts();
    const params = new URLSearchParams(location.search);
    const searchInput = $('#catalogSearch');
    const sortInput = $('#catalogSort');
    const q = slugText(searchInput?.value || params.get('q') || '');
    const categoryValues = $$('input[name="category"]:checked').map(i=>i.value);
    const brandValues = $$('input[name="brand"]:checked').map(i=>i.value);
    const stockOnly = $('#stockOnly')?.checked;
    if(q) list = list.filter(p => slugText([p.name,p.brand,p.shortDescription,p.description,p.ingredients,p.usage,p.category,formTypeLabel(p.formType)].join(' ')).includes(q));
    if(categoryValues.length) list = list.filter(p => categoryValues.includes(p.category));
    if(brandValues.length) list = list.filter(p => brandValues.includes(p.brand));
    if(stockOnly) list = list.filter(p => Number(p.stock || 0) > 0);
    const sort = sortInput?.value || 'default';
    if(sort === 'price-asc') list.sort((a,b)=>Number(a.price)-Number(b.price));
    if(sort === 'price-desc') list.sort((a,b)=>Number(b.price)-Number(a.price));
    if(sort === 'popular') list.sort((a,b)=>Number(b.popular)-Number(a.popular));
    if(sort === 'name') list.sort((a,b)=>a.name.localeCompare(b.name,'ru'));
    if(sort === 'stock') list.sort((a,b)=>Number(b.stock)-Number(a.stock));
    return list;
  }

  function syncCatalogUrl(){
    if(document.body.dataset.page !== 'catalog') return;
    const params = new URLSearchParams();
    const q = $('#catalogSearch')?.value.trim();
    const sort = $('#catalogSort')?.value || 'default';
    if(q) params.set('q', q);
    if(sort && sort !== 'default') params.set('sort', sort);
    $$('input[name="category"]:checked').forEach(input => params.append('category', input.value));
    $$('input[name="brand"]:checked').forEach(input => params.append('brand', input.value));
    if($('#stockOnly')?.checked) params.set('stock', '1');
    const query = params.toString();
    history.replaceState(null, '', `${location.pathname}${query ? `?${query}` : ''}`);
  }
	  function renderCatalog(){
	    renderCatalogSmart();
	    const filters = $('#catalogFilters');
    const params = new URLSearchParams(location.search);
    if(filters){
      const activeCategories = params.getAll('category');
      const activeBrands = params.getAll('brand');
      filters.innerHTML = `
        <div class="filter-group"><h4>Категории</h4><div class="check-list">
          ${getCategories().map(c=>`<label><input type="checkbox" name="category" value="${esc(c.id)}" ${activeCategories.includes(c.id) ? 'checked' : ''}> ${esc(c.name)}</label>`).join('')}
        </div></div>
        <div class="filter-group"><h4>Бренды</h4><div class="check-list">
          ${brands().map(b=>`<label><input type="checkbox" name="brand" value="${esc(b)}" ${activeBrands.includes(b) ? 'checked' : ''}> ${esc(b)}</label>`).join('')}
        </div></div>
        <div class="filter-group"><h4>Наличие</h4><div class="check-list"><label><input type="checkbox" id="stockOnly" ${params.get('stock') === '1' ? 'checked' : ''}> Только в наличии</label></div></div>
        <button class="btn btn-light full" type="button" data-clear-filters>Сбросить фильтры</button>`;
    }
    const q = params.get('q');
    if(q && $('#catalogSearch')) $('#catalogSearch').value = q;
    const sortParam = params.get('sort');
    if(sortParam && $('#catalogSort')) $('#catalogSort').value = sortParam;
    const apply = () => { syncCatalogUrl(); renderCatalogProducts(); };
    ['catalogSearch','catalogSort'].forEach(id => {
      const el = $('#'+id);
      if(el) el.addEventListener(id === 'catalogSearch' ? 'input' : 'change', apply);
    });
    if(filters){
      filters.addEventListener('input', apply);
      filters.addEventListener('change', apply);
      filters.addEventListener('click', event => {
        if(!event.target.closest('[data-clear-filters]')) return;
        $$('input[type="checkbox"]', filters).forEach(input => { input.checked = false; });
        const search = $('#catalogSearch'); if(search) search.value = '';
        const sort = $('#catalogSort'); if(sort) sort.value = 'default';
        apply();
      });
    }
    renderCatalogProducts();
  }
  function renderCatalogProducts(){
    const list = filterProducts();
    const note = $('#catalogResultNote');
    if(note) note.textContent = `${list.length} товар(ов)`;
    renderGrid($('#catalogProducts'), list);
  }

  function renderSale(){ renderGrid($('#saleList'), getProducts().filter(p => p.oldPrice)); }
  function renderWishlist(){
    const ids = getWishlist();
    const products = getProducts().filter(p => ids.includes(p.id));
    renderGrid($('#wishlistList'), products);
  }
  function renderBrands(){
    const wrap = $('#brandsList');
    if(!wrap) return;
    const products = getProducts();
    const site = getSite();
    wrap.innerHTML = brands().map((brand,i)=>brandCardHtml(brand, i, products, site)).join('');
  }
  function renderCompare(){
    const wrap = $('#compareTable');
    if(!wrap) return;
    const products = getProducts().filter(p => getCompare().includes(p.id));
    if(!products.length){ wrap.innerHTML = `<div class="empty-state"><h3>Сравнение пустое</h3><p>Добавь товары в сравнение, чтобы таблица перестала быть пустой, как обещания “потом поправлю CSS”.</p><a class="btn btn-primary" href="catalog.html">В каталог</a></div>`; return; }
    wrap.innerHTML = `<div class="table-wrap"><table class="admin-table"><thead><tr><th>Характеристика</th>${products.map(p=>`<th>${esc(p.name)}</th>`).join('')}</tr></thead><tbody>
      <tr><td>Фото</td>${products.map(p=>`<td><img class="admin-thumb" src="${esc(firstImage(p))}" alt=""></td>`).join('')}</tr>
      <tr><td>Цена</td>${products.map(p=>`<td><strong>${money(p.price)}</strong></td>`).join('')}</tr>
      <tr><td>Бренд</td>${products.map(p=>`<td>${esc(p.brand)}</td>`).join('')}</tr>
      <tr><td>Категория</td>${products.map(p=>`<td>${esc(categoryName(p.category))}</td>`).join('')}</tr>
      <tr><td>Страна</td>${products.map(p=>`<td>${esc(p.country)}</td>`).join('')}</tr>
      <tr><td>Наличие</td>${products.map(p=>`<td>${esc(p.stock)} шт.</td>`).join('')}</tr>
      <tr><td>Рейтинг</td>${products.map(p=>`<td>${esc(p.rating || 5)}</td>`).join('')}</tr>
      <tr><td>Действия</td>${products.map(p=>`<td><button class="btn btn-primary small" data-action="cart" data-id="${esc(p.id)}">В корзину</button><br><br><button class="btn btn-light small" data-action="compare" data-id="${esc(p.id)}">Убрать</button></td>`).join('')}</tr>
    </tbody></table></div>`;
  }
  function approvedReviews(productId){
    return getReviews().filter(review => String(review.productId) === String(productId) && review.status === 'approved');
  }
  function renderProductReviews(product){
    const reviews = approvedReviews(product.id);
    const avg = reviews.length ? reviews.reduce((sum, item) => sum + Number(item.rating || 5), 0) / reviews.length : Number(product.rating || 5);
    return `
      <div class="review-summary">${ratingStars(avg)}<p>Средняя оценка ${avg.toFixed(1).replace('.', ',')} / 5</p></div>
      <div class="reviews-list">${reviews.length ? reviews.map(review => `<div class="review"><strong>${esc(review.name || 'Покупатель')}</strong>${ratingStars(review.rating)}<small>${esc(review.date || '')}</small><p>${esc(review.text || '')}</p></div>`).join('') : '<p>Отзывов пока нет.</p>'}</div>
      <form class="review-form" id="reviewForm" data-product-id="${esc(product.id)}">
        <h3>Оставить отзыв</h3>
        <div class="field-row">
          <label class="review-field"><span>Имя</span><input id="reviewName" required placeholder="Ваше имя"></label>
          <label class="review-field"><span>Оценка</span><select id="reviewRating"><option value="5">5 / 5</option><option value="4">4 / 5</option><option value="3">3 / 5</option><option value="2">2 / 5</option><option value="1">1 / 5</option></select></label>
        </div>
        <label class="review-field"><span>Отзыв</span><textarea id="reviewText" required placeholder="Ваш отзыв"></textarea></label>
        <button class="btn btn-primary full" type="submit">Отправить на модерацию</button>
      </form>`;
  }
  async function submitReview(event){
    event.preventDefault();
    const form = event.target;
    const productId = Number(form.dataset.productId);
    const name = $('#reviewName', form)?.value.trim();
    const text = $('#reviewText', form)?.value.trim();
    const rating = Number($('#reviewRating', form)?.value || 5);
    if(!name || !text){ toast('Заполните имя и отзыв'); return; }
    const review = {id:Date.now(),productId,name,text,rating,status:'pending',date:new Date().toLocaleDateString('ru-RU')};
    if(serverAvailable){
      try{
        await fetchJson('/api/reviews', {method:'POST', body:JSON.stringify(review)});
      }catch(error){
        console.warn(error);
        const reviews = getReviews();
        reviews.unshift(review);
        saveReviews(reviews);
      }
    }else{
      const reviews = getReviews();
      reviews.unshift(review);
      saveReviews(reviews);
    }
    form.reset();
    toast('Отзыв отправлен на подтверждение');
  }

  function renderProduct(){
    const id = new URLSearchParams(location.search).get('id') || 1;
    const product = productById(id);
    const root = $('#productRoot');
    if(!root) return;
    if(!product){ root.innerHTML = `<div class="empty-state"><h3>Товар не найден</h3><p>Похоже, ссылка убежала. Нормальное поведение для хаоса.</p><a class="btn btn-primary" href="catalog.html">В каталог</a></div>`; return; }
    const images = product.images?.length ? product.images : [firstImage(product)];
    const firstOption = defaultPackage(product);
    const firstFlavor = product.flavors?.[0] || '';
    document.title = `${product.name} | ByVit`;
    root.innerHTML = `
      <div class="product-detail">
        <div class="product-gallery">
          <div class="gallery-main"><img id="mainProductImage" src="${esc(images[0])}" alt="${esc(product.name)}"></div>
          <div class="gallery-thumbs">${images.map((img,i)=>`<button class="${i===0?'active':''}" data-gallery="${esc(img)}"><img src="${esc(img)}" alt=""></button>`).join('')}</div>
        </div>
        <aside class="product-panel">
          <div class="product-brand">${esc(product.brand)}</div>
          <h1 class="product-detail-title">${esc(product.name)}</h1>
          <p>${esc(product.shortDescription || '')}</p>
          <div class="product-facts">
            <div class="fact"><span>Страна</span><strong>${esc(product.country || '—')}</strong></div>
            <div class="fact"><span>Наличие</span><strong>${esc(product.stock || 0)} шт.</strong></div>
            <div class="fact"><span>Категория</span><strong>${esc(categoryName(product.category))}</strong></div>
            <div class="fact"><span>Форма</span><strong>${esc(formTypeLabel(product.formType))}</strong></div>
          </div>
          <div class="price" id="productPrice">${money(firstOption.price)}</div>
          ${product.oldPrice ? `<div class="old-price" style="font-size:16px;margin:4px 0 18px;display:inline-block">${money(product.oldPrice)}</div>` : ''}
          <div class="option-block"><strong>Фасовка</strong><div class="option-list" id="packageOptions">${(product.packageOptions || [firstOption]).map((o,i)=>`<button class="chip ${i===0?'active':''}" data-package-id="${esc(o.id)}" data-price="${esc(o.price)}">${esc(o.label)}</button>`).join('')}</div></div>
          ${product.flavors?.length ? `<div class="option-block"><strong>Вкус</strong><div class="option-list" id="flavorOptions">${product.flavors.map((f,i)=>`<button class="chip ${i===0?'active':''}" data-flavor="${esc(f)}">${esc(f)}</button>`).join('')}</div></div>` : ''}
          <div class="qty-row"><div class="qty-stepper"><button data-qty-minus>-</button><input id="productQty" value="1" inputmode="numeric"><button data-qty-plus>+</button></div><button class="btn btn-primary" data-product-add="${esc(product.id)}">Добавить в корзину</button></div>
          <div class="hero-actions" style="margin:0"><button class="btn btn-light" data-action="wishlist" data-id="${esc(product.id)}">♡ Избранное</button><button class="btn btn-light" data-action="compare" data-id="${esc(product.id)}">⇄ Сравнить</button></div>
        </aside>
      </div>
      <div class="tabs">
        <div class="tab-buttons"><button class="active" data-tab="desc">Описание</button><button data-tab="ingredients">Состав</button><button data-tab="usage">Способ применения</button><button data-tab="reviews">Отзывы</button><button data-tab="delivery">Доставка</button></div>
        <div class="tab-content" id="tabContent"></div>
      </div>
      <section class="section" style="padding-bottom:0"><div class="section-head"><div><span class="eyebrow">Похожие товары</span><h2>Можно добавить к заказу</h2></div></div><div class="product-grid" id="similarProducts"></div></section>`;
    const tabData = {
      desc:`<p>${esc(product.description || product.shortDescription || '')}</p>`,
      usage:`<p>${esc(product.usage || 'Способ применения уточняйте у производителя.')}</p>`,
      ingredients:`<p>${esc(product.ingredients || 'Состав не указан.')}</p>`,
      reviews:renderProductReviews(product),
      delivery:`<p>Самовывоз, курьер, Европочта или почта. Точный способ выбирается при оформлении заказа.</p>`
    };
    function setTab(name){
      $$('.tab-buttons button').forEach(b=>b.classList.toggle('active', b.dataset.tab===name));
      $('#tabContent').innerHTML = tabData[name] || tabData.desc;
    }
    setTab('desc');
    $('.tab-buttons')?.addEventListener('click', e=>{ const b=e.target.closest('button[data-tab]'); if(b) setTab(b.dataset.tab); });
    $$('.gallery-thumbs button').forEach(btn=>btn.addEventListener('click',()=>{ $$('.gallery-thumbs button').forEach(x=>x.classList.remove('active')); btn.classList.add('active'); $('#mainProductImage').src = btn.dataset.gallery; }));
    $('#packageOptions')?.addEventListener('click', e=>{ const b=e.target.closest('[data-package-id]'); if(!b)return; $$('#packageOptions .chip').forEach(x=>x.classList.remove('active')); b.classList.add('active'); $('#productPrice').textContent=money(b.dataset.price); });
    $('#flavorOptions')?.addEventListener('click', e=>{ const b=e.target.closest('[data-flavor]'); if(!b)return; $$('#flavorOptions .chip').forEach(x=>x.classList.remove('active')); b.classList.add('active'); });
    $('[data-qty-minus]')?.addEventListener('click',()=>{ const i=$('#productQty'); i.value=Math.max(1,Number(i.value||1)-1); });
    $('[data-qty-plus]')?.addEventListener('click',()=>{ const i=$('#productQty'); i.value=Number(i.value||1)+1; });
    $('[data-product-add]')?.addEventListener('click',()=>{
      const pack = $('#packageOptions .chip.active')?.dataset.packageId || firstOption.id;
      const flavor = $('#flavorOptions .chip.active')?.dataset.flavor || firstFlavor;
      addToCart(product.id, pack, flavor, Math.max(1,Number($('#productQty')?.value || 1)));
    });
    renderGrid($('#similarProducts'), getProducts().filter(p => p.category === product.category && p.id !== product.id).slice(0,4));
  }

  function cartTotals(){
    const items = getCart();
    const subtotal = items.reduce((sum,item)=>sum + Number(item.price || 0) * Number(item.qty || 0),0);
    const promo = String(sessionStorage.getItem('byvit_v60_promo') || '').toUpperCase();
    const activePromo = (getSite().promos || []).find(item => item.enabled !== false && item.code === promo);
    const discount = activePromo ? (activePromo.type === 'fixed' ? Number(activePromo.value || 0) : subtotal * Number(activePromo.value || 0) / 100) : 0;
    return {subtotal,discount,total:Math.max(0,subtotal-discount),promo};
  }
  function selectedDelivery(){
    const key = $('input[name="delivery"]:checked')?.value || 'pickup';
    const site = getSite();
    return {key,method:(site.deliveryMethods || {})[key] || {title:key}};
  }
  function pickupStores(){
    return (getSite().pickupStores || []).filter(store => store.enabled !== false && (store.title || store.address || store.note));
  }
  function selectedPickupStore(){
    const stores = pickupStores();
    const selected = $('input[name="pickupStore"]:checked')?.value;
    return stores.find(store => store.id === selected) || stores[0] || null;
  }
  function checkoutBlocks(){
    return (getSite().checkout || DEFAULT_CHECKOUT).blocks || DEFAULT_CHECKOUT.blocks;
  }
  function applyCheckoutSettings(){
    const checkout = getSite().checkout || DEFAULT_CHECKOUT;
    const summaryTitle = $('#cartSummary')?.closest('.summary-card')?.querySelector('h3');
    if(summaryTitle) summaryTitle.textContent = checkout.summaryTitle || 'Итого';
    const checkoutTitle = $('#checkoutForm')?.closest('.summary-card')?.querySelector('h3');
    if(checkoutTitle) checkoutTitle.textContent = checkout.checkoutTitle || 'Оформление';
    const promoInput = $('#promoCode'); if(promoInput) promoInput.placeholder = checkout.promoPlaceholder || 'Промокод';
    const promoButton = $('#promoApply'); if(promoButton) promoButton.textContent = checkout.promoButton || 'Применить';
    const fields = {orderName:'namePlaceholder',orderPhone:'phonePlaceholder',orderAddress:'addressPlaceholder',orderComment:'commentPlaceholder'};
    Object.entries(fields).forEach(([id,key]) => { const el = $('#'+id); if(el) el.placeholder = checkout[key] || el.placeholder; });
    const submit = $('#checkoutForm button[type="submit"]'); if(submit) submit.textContent = checkout.submitText || 'Оформить заказ';
    const payment = $('#paymentMethod');
    if(payment) payment.innerHTML = (checkout.paymentOptions || DEFAULT_CHECKOUT.paymentOptions).map(option => `<option>${esc(option)}</option>`).join('');
    applyCartBlockVisibility();
    syncAddressForDelivery();
  }
  function setHidden(node, hidden){
    if(node) node.hidden = hidden;
  }
  function applyCartBlockVisibility(){
    const blocks = checkoutBlocks();
    setHidden($('#cartSummary')?.closest('.summary-card'), blocks.summary === false);
    setHidden($('.promo-row'), blocks.promo === false);
    setHidden($('#checkoutForm')?.closest('.summary-card'), blocks.checkout === false);
    setHidden($('#deliveryOptions'), blocks.delivery === false);
    setHidden($('#pickupStoreOptions'), blocks.delivery === false || selectedDelivery().key !== 'pickup');
    setHidden($('#paymentMethod'), blocks.payment === false);
    setHidden($('#orderComment'), blocks.comment === false);
    setHidden($('#orderAddress'), blocks.address === false);
  }
  function syncAddressForDelivery(){
    const address = $('#orderAddress');
    if(!address) return;
    const blocks = checkoutBlocks();
    if(blocks.address === false){ address.hidden = true; return; }
    const site = getSite();
    const checkout = site.checkout || DEFAULT_CHECKOUT;
    const {key} = selectedDelivery();
    address.placeholder = checkout.addressPlaceholder || 'Адрес / отделение';
    if(key === 'pickup'){
      address.hidden = true;
      address.readOnly = false;
      address.classList.add('readonly');
    } else {
      const pickupAddresses = pickupStores().map(store => store.address).filter(Boolean);
      if(address.value === site.pickupAddress || pickupAddresses.includes(address.value)) address.value = '';
      address.hidden = false;
      address.readOnly = false;
      address.classList.remove('readonly');
    }
  }
  function renderPickupStoreOptions(){
    const root = $('#pickupStoreOptions');
    if(!root) return;
    const {key} = selectedDelivery();
    const blocks = checkoutBlocks();
    if(blocks.delivery === false || key !== 'pickup'){
      root.hidden = true;
      root.innerHTML = '';
      return;
    }
    const stores = pickupStores();
    const previous = $('input[name="pickupStore"]:checked')?.value;
    root.hidden = false;
    if(!stores.length){
      root.innerHTML = `<div class="pickup-hint">Пункт самовывоза пока не указан в админке.</div>`;
      return;
    }
    const label = stores.length > 1 ? 'Выберите пункт самовывоза' : 'Рекомендованный пункт самовывоза';
    root.innerHTML = `<div class="pickup-store-label">${esc(label)}</div><div class="pickup-store-list">${stores.map((store, index) => {
      const checked = previous ? store.id === previous : index === 0;
      return `<label class="pickup-store"><input type="radio" name="pickupStore" value="${esc(store.id)}" ${checked ? 'checked' : ''}><span class="delivery-radio" aria-hidden="true"></span><span class="pickup-store-text"><span class="pickup-store-title">${esc(store.title || 'Пункт самовывоза')}</span>${store.address ? `<span class="pickup-store-address">${esc(store.address)}</span>` : ''}${store.note ? `<span class="pickup-store-note">${esc(store.note)}</span>` : ''}</span></label>`;
    }).join('')}</div>`;
  }
  function renderCart(){
    renderDeliveryOptions();
    applyCheckoutSettings();
    const list = $('#cartList');
    const cart = getCart();
    if(list){
      if(!cart.length){ list.innerHTML = `<div class="empty-state"><h3>Корзина пустая</h3><p>Товары пока не добавлены.</p><a class="btn btn-primary" href="catalog.html">В каталог</a></div>`; }
      else list.innerHTML = cart.map(item=>{
        const p = productById(item.productId) || {};
        return `<div class="cart-item" data-key="${esc(item.key)}"><img src="${esc(firstImage(p))}" alt="${esc(p.name || '')}"><div><h3>${esc(p.name || 'Товар')}</h3><small>${esc(item.optionLabel || '')}${item.flavor ? ` · ${esc(item.flavor)}` : ''}</small><div class="qty-row" style="margin:12px 0 0"><div class="qty-stepper"><button data-cart-minus="${esc(item.key)}">-</button><input value="${esc(item.qty)}" readonly><button data-cart-plus="${esc(item.key)}">+</button></div></div></div><div style="text-align:right"><strong class="price">${money(Number(item.price)*Number(item.qty))}</strong><br><button class="btn btn-light small" data-cart-remove="${esc(item.key)}" style="margin-top:10px">Удалить</button></div></div>`;
      }).join('');
    }
    renderSummary();
  }
  function renderSummary(){
    const {subtotal,discount,total,promo} = cartTotals();
    const checkout = getSite().checkout || DEFAULT_CHECKOUT;
    const delivery = selectedDelivery();
    const root = $('#cartSummary');
    if(root){
      root.innerHTML = `<div class="summary-row"><span>${esc(checkout.itemsLabel || 'Товары')}</span><strong>${money(subtotal)}</strong></div>${discount ? `<div class="summary-row"><span>Промокод ${esc(promo)}</span><strong>−${money(discount)}</strong></div>` : ''}<div class="summary-row"><span>${esc(checkout.deliveryLabel || 'Доставка')}</span><strong>${esc(delivery.method.title || 'по тарифу')}</strong></div><div class="summary-row"><span>${esc(checkout.totalLabel || 'Итого')}</span><span class="summary-total">${money(total)}</span></div>`;
    }
  }
  function renderDeliveryOptions(){
    const site = getSite();
    const root = $('#deliveryOptions');
    if(!root) return;
    const methods = site.deliveryMethods || getDefaults().site.deliveryMethods;
    const enabled = Object.entries(methods).filter(([,m])=>m.enabled !== false);
    const previous = $('input[name="delivery"]:checked')?.value;
    const hasPrevious = previous && enabled.some(([key]) => key === previous);
    root.innerHTML = enabled.map(([key,m],i)=>`<label class="delivery-option"><input type="radio" name="delivery" value="${esc(key)}" ${(hasPrevious ? key === previous : i === 0) ? 'checked' : ''}><span class="delivery-radio" aria-hidden="true"></span><span class="delivery-option-text"><strong>${esc(m.title)}</strong><small>${esc(m.subtitle || '')}</small></span></label>`).join('');
    renderPickupStoreOptions();
    applyCartBlockVisibility();
    syncAddressForDelivery();
  }
  function handleDeliveryChange(){
    renderPickupStoreOptions();
    syncAddressForDelivery();
    renderSummary();
  }
  function changeCart(key, delta){
    const cart = getCart();
    const item = cart.find(x => x.key === key);
    if(item){ item.qty = Math.max(1, Number(item.qty || 1) + delta); saveCart(cart); renderCart(); }
  }
  function removeCart(key){ saveCart(getCart().filter(item => item.key !== key)); renderCart(); toast('Товар удалён'); }
  function applyPromo(){
    const code = String($('#promoCode')?.value || '').trim().toUpperCase();
    const promo = (getSite().promos || []).find(item => item.enabled !== false && item.code === code);
    if(promo){ sessionStorage.setItem('byvit_v60_promo', code); toast('Промокод применён'); }
    else { sessionStorage.removeItem('byvit_v60_promo'); toast('Промокод не найден'); }
    renderSummary();
  }
  function updatePromoFromInput(){
    const code = String($('#promoCode')?.value || '').trim().toUpperCase();
    const promo = (getSite().promos || []).find(item => item.enabled !== false && item.code === code);
    if(promo) sessionStorage.setItem('byvit_v60_promo', code);
    else sessionStorage.removeItem('byvit_v60_promo');
    renderSummary();
  }
  function buildOrderText(order){
    const lines = [];
    lines.push('🟢 Новый заказ ');
    lines.push(`ByVit #${order.id}`);
    lines.push('');
    lines.push(`Имя: ${order.customer.name}`);
    lines.push(`Телефон: ${order.customer.phone}`);
    lines.push(`Получение: ${order.deliveryTitle}`);
    lines.push(`Адрес/отделение: ${order.pickupStore ? ([order.pickupStore.title, order.pickupStore.address].filter(Boolean).join(' - ') || '—') : (order.customer.address || '—')}`);
    lines.push(`Оплата: ${order.payment}`);
    lines.push(`Промокод: ${order.promo || ''}`);
    if(order.comment) lines.push(`Комментарий: ${order.comment}`);
    lines.push('');
    lines.push('Товары:');
    order.items.forEach((item, index) => {
      const details = [item.optionLabel, item.flavor].filter(Boolean).join(', ');
      lines.push(`   ${index + 1}. ${item.name} `);
      lines.push(`       — ${details || '1 шт.'} × ${item.qty} = ${money(item.lineTotal)}`);
    });
    lines.push('');
    lines.push(`Скидка: −${money(order.discount || 0)}`);
    lines.push(`Итого: ${money(order.total)}`);
    lines.push('');
    return lines.join('\n');
  }
  async function sendTelegram(text){
    const settings = getSite().telegram || {};
    const recipients = telegramRecipients(settings);
    if(!settings.botToken || !recipients.length) return {skipped:true};
    const url = `https://api.telegram.org/bot${settings.botToken}/sendMessage`;
    await Promise.allSettled(recipients.map(chatId => {
      const body = new URLSearchParams();
      body.set('chat_id', chatId);
      body.set('text', text);
      return fetch(url,{method:'POST',mode:'no-cors',body});
    }));
    return {ok:true,count:recipients.length};
  }
  function telegramRecipients(settings){
    return String(settings?.chatId || '')
      .split(/[\n,;]+/)
      .map(item => item.trim())
      .filter(Boolean)
      .filter((item, index, list) => list.indexOf(item) === index);
  }
  async function submitOrder(event){
    event.preventDefault();
    const cart = getCart();
    if(!cart.length){ toast('Корзина пустая'); return; }
    const name = $('#orderName')?.value.trim();
    const phone = $('#orderPhone')?.value.trim();
    const addressEl = $('#orderAddress');
    if(!name || !phone){ toast('Заполни имя и телефон'); return; }
    const deliveryKey = $('input[name="delivery"]:checked')?.value || 'pickup';
    const site = getSite();
    const delivery = (site.deliveryMethods || {})[deliveryKey] || {title:deliveryKey};
    const pickupStore = deliveryKey === 'pickup' ? selectedPickupStore() : null;
    const address = pickupStore ? [pickupStore.title, pickupStore.address].filter(Boolean).join(': ') : (addressEl && !addressEl.hidden ? addressEl.value.trim() : '');
    const totals = cartTotals();
    const items = cart.map(item => { const p = productById(item.productId) || {}; return {...item,name:p.name || 'Товар',lineTotal:Number(item.price)*Number(item.qty)}; });
    const order = {id:Date.now(),date:new Date().toLocaleString('ru-RU'),status:'new',items,subtotal:totals.subtotal,discount:totals.discount,total:totals.total,promo:totals.promo,deliveryKey,deliveryTitle:delivery.title,pickupStore:pickupStore ? {...pickupStore} : null,payment:$('#paymentMethod')?.value || 'при получении',comment:$('#orderComment')?.value.trim() || '',customer:{name,phone,address}};
    if(serverAvailable){
      try{
        const result = await fetchJson('/api/orders', {method:'POST', body:JSON.stringify({order})});
        if(serverState && Array.isArray(serverState.orders)) serverState.orders.unshift(result.order || order);
      }catch(error){
        console.warn(error);
        const orders = getOrders(); orders.unshift(order); saveOrders(orders);
        try{ await sendTelegram(buildOrderText(order)); }
        catch(e){ console.warn(e); }
      }
    }else{
      const orders = getOrders(); orders.unshift(order); saveOrders(orders);
      try{ await sendTelegram(buildOrderText(order)); }
      catch(e){ console.warn(e); }
    }
    saveCart([]); sessionStorage.removeItem('byvit_v60_promo');
    renderCart();
    const checkout = getSite().checkout || DEFAULT_CHECKOUT;
    openModal(checkout.successTitle || 'Спасибо за заказ', `<p>${esc(checkout.successText || 'Спасибо за заказ. Мы скоро свяжемся с вами.')}</p><div class="notice" style="margin-top:16px">Итого: ${money(order.total)}</div><div class="hero-actions" style="margin:22px 0 0"><a class="btn btn-primary" href="catalog.html">Вернуться в каталог</a></div>`);
  }

  function renderDeliveryPage(){
    const site = getSite();
    const root = $('#deliveryCards');
    if(root){
      root.innerHTML = Object.values(site.deliveryMethods || {}).filter(m=>m.enabled!==false).map(m=>`<article class="delivery-card"><h3>${esc(m.title)}</h3><p>${esc(m.subtitle || '')}</p></article>`).join('');
    }
  }
  function renderStores(){
    const site = getSite();
    const root = $('#storesList');
    if(root){
      const blocks = (site.storeBlocks || DEFAULT_STORE_BLOCKS).filter(block => block.enabled !== false);
      root.innerHTML = blocks.length ? blocks.map(block => `<article class="store-card"><h3>${esc(block.title || 'Блок')}</h3>${textToParagraphs(block.text)}</article>`).join('') : `<div class="empty-state"><h3>Блоки скрыты</h3><p>Добавьте или включите блоки в админке.</p></div>`;
    }
    const mapRoot = $('#storeMap');
    if(mapRoot){
      const map = site.map || DEFAULT_MAP;
      const src = mapSrcFromValue(map.embedUrl);
      mapRoot.classList.toggle('has-map', Boolean(map.enabled && src));
      mapRoot.innerHTML = map.enabled && src ? `<iframe title="${esc(map.provider === 'google' ? 'Google карта' : map.provider === 'yandex' ? 'Яндекс карта' : 'Карта')}" src="${esc(src)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>` : esc(map.placeholder || DEFAULT_MAP.placeholder);
    }
  }
  function renderFaq(){
    const root = $('#faqList');
    if(!root) return;
    const items = (getSite().faqItems || DEFAULT_FAQ_ITEMS).filter(item => item.enabled !== false);
    root.innerHTML = items.length ? items.map(item => `
      <article class="faq-item" data-faq-item>
        <button class="faq-question" type="button" data-faq-toggle aria-expanded="false"><span>${esc(item.question || 'Вопрос')}</span></button>
        <div class="faq-answer">${textToParagraphs(item.answer)}</div>
      </article>`).join('') : `<div class="empty-state"><h3>FAQ скрыт</h3><p>Добавьте вопросы или включите их в админке.</p></div>`;
  }
  function renderAboutPage(){
    const page = getSite().aboutPage || DEFAULT_ABOUT_PAGE;
    const eyebrow = $('#aboutEyebrow'); if(eyebrow) eyebrow.textContent = page.eyebrow || 'ByVit';
    const title = $('#aboutTitle'); if(title) title.textContent = page.title || '';
    const text = $('#aboutText'); if(text) text.textContent = page.text || '';
    const missionTitle = $('#aboutMissionTitle'); if(missionTitle) missionTitle.textContent = page.missionTitle || '';
    const missionText = $('#aboutMissionText'); if(missionText) missionText.textContent = page.missionText || '';
    const cards = $('#aboutCards');
    if(cards){
      const items = (page.cards || []).filter(item => item.enabled !== false);
      cards.innerHTML = items.length ? items.map(item => `<article class="feature-card"><h3>${esc(item.title || 'Принцип')}</h3>${textToParagraphs(item.text)}</article>`).join('') : `<div class="empty-state"><h3>Блоки скрыты</h3><p>Добавьте карточки в админке.</p></div>`;
    }
    const legalTitle = $('#aboutLegalTitle'); if(legalTitle) legalTitle.textContent = page.legalTitle || '';
    const legalText = $('#aboutLegalText'); if(legalText) legalText.innerHTML = textToParagraphs(page.legalText || '');
  }
  function optionIdFromLabel(label, index){
    const slug = String(label || '').toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-zа-яё0-9-]/gi, '');
    return slug || `option-${index + 1}`;
  }
  function categoryIdFromName(value, index){
    const slug = String(value || '').toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-zа-яё0-9-]/gi, '');
    return slug || `category-${index + 1}`;
  }
  function packageOptionsToLines(options, price){
    const list = options?.length ? options : [{label:'1 шт.',price}];
    return list.map(o => `${o.label || '1 шт.'} | ${Number(o.price || price || 0)}`).join('\n');
  }
  function parsePackageOptions(value, price){
    const lines = String(value || '').split(/\n+/).map(line => line.trim()).filter(Boolean);
    const options = lines.map((line, index) => {
      const parts = line.split(/[|=;]/).map(part => part.trim()).filter(Boolean);
      const label = parts[0] || `Фасовка ${index + 1}`;
      const optionPrice = Number(String(parts[1] || price || 0).replace(',', '.')) || Number(price || 0);
      return {id:optionIdFromLabel(label, index),label,price:optionPrice};
    });
    return options.length ? options : [{id:'base',label:'1 шт.',price:Number(price || 0)}];
  }
  function parseList(value){
    return String(value || '').split(/[,;\n]+/).map(item => item.trim()).filter(Boolean);
  }
  function linesToLinks(value){
    return String(value || '').split(/\n+/).map(line => line.trim()).filter(Boolean).map(line => {
      const [text='',href='#',enabled='1'] = line.split('|').map(part => part.trim());
      return {text,href:href || '#',enabled:enabled !== '0'};
    }).filter(link => link.text);
  }
  function linksToLines(links){
    return (links || []).map(link => `${link.text || ''} | ${link.href || '#'} | ${link.enabled === false ? '0' : '1'}`).join('\n');
  }
  function footerColumnsToLines(columns){
    return (columns || []).map(col => `${col.title || 'Раздел'}:\n${linksToLines(col.links)}`).join('\n\n');
  }
  function linesToFooterColumns(value){
    return String(value || '').split(/\n\s*\n/).map(block => block.trim()).filter(Boolean).map(block => {
      const lines = block.split(/\n+/);
      const title = lines.shift().replace(/:$/,'').trim() || 'Раздел';
      return {title,links:linesToLinks(lines.join('\n'))};
    });
  }
  function footerContactsToLines(items){
    return (items || []).map(item => `${item.label || ''} | ${item.type || 'link'} | ${item.href || item.value || ''} | ${item.enabled === false ? '0' : '1'}`).join('\n');
  }
  function linesToFooterContacts(value){
    return String(value || '').split(/\n+/).map(line => line.trim()).filter(Boolean).map((line, index) => {
      const [label='', type='link', value='', enabled='1'] = line.split('|').map(part => part.trim());
      const isUrl = /^(https?:|mailto:|tel:|viber:|whatsapp:)/i.test(value);
      return {
        id:categoryIdFromName(label || type || `contact-${index + 1}`, index),
        label,
        type:type || 'link',
        value:isUrl ? '' : value,
        href:isUrl || type === 'link' ? value : '',
        enabled:enabled !== '0'
      };
    }).filter(item => item.label || item.value || item.href);
  }
  function footerBadgesToLines(items){
    return (items || []).map(item => `${item.text || ''} | ${item.href || ''} | ${item.enabled === false ? '0' : '1'} | ${item.image || ''}`).join('\n');
  }
  function linesToFooterBadges(value){
    return String(value || '').split(/\n+/).map(line => line.trim()).filter(Boolean).map((line, index) => {
      const [text='', href='', enabled='1', image=''] = line.split('|').map(part => part.trim());
      return {id:categoryIdFromName(text || `badge-${index + 1}`, index),text,href,image,enabled:enabled !== '0'};
    }).filter(item => item.text || item.href || item.image);
  }
  function footerBadgeEditor(badge={}, index=0){
    const id = String(badge.id || `footer-badge-${Date.now()}-${index}`);
    const image = badge.image || '';
    return `<article class="admin-block-editor" data-footer-badge-key="${esc(id)}">
      <div class="admin-block-head">
        <h4>Значок ${index + 1}</h4>
        <label class="mini-toggle"><input type="checkbox" data-footer-badge-enabled ${badge.enabled !== false ? 'checked' : ''}> Включён</label>
      </div>
      <div class="field-row">
        <input data-footer-badge-text value="${esc(badge.text || '')}" placeholder="Название, например VISA">
        <input data-footer-badge-href value="${esc(badge.href || '')}" placeholder="Ссылка при клике, можно пусто">
      </div>
      <input data-footer-badge-image value="${esc(image)}" placeholder="Ссылка на картинку или загруженный файл">
      <div class="footer-badge-admin-preview" data-footer-badge-preview>
        ${image ? `<img src="${esc(image)}" alt="${esc(badge.text || 'Значок')}">` : `<span>${esc(badge.text || 'Текстовый значок')}</span>`}
      </div>
      <label class="admin-input-field">
        <span><strong>Файл значка</strong><br><small>PNG/JPG/SVG сохранится в браузере для этого футера.</small></span>
        <input type="file" accept="image/*" data-footer-badge-upload>
      </label>
      <button class="btn btn-danger small" data-footer-badge-delete type="button">Удалить значок</button>
    </article>`;
  }
  function collectFooterBadges(){
    return $$('[data-footer-badge-key]', $('#footerBadgesList') || document).map((block, index) => {
      const text = $('[data-footer-badge-text]', block)?.value.trim() || '';
      const href = $('[data-footer-badge-href]', block)?.value.trim() || '';
      const image = $('[data-footer-badge-image]', block)?.value.trim() || '';
      return {
        id:categoryIdFromName(text || `footer-badge-${index + 1}`, index),
        text,
        href,
        image,
        enabled:$('[data-footer-badge-enabled]', block)?.checked !== false
      };
    }).filter(item => item.text || item.href || item.image);
  }
  function updateFooterBadgePreview(block){
    const preview = $('[data-footer-badge-preview]', block);
    if(!preview) return;
    const image = $('[data-footer-badge-image]', block)?.value.trim() || '';
    const text = $('[data-footer-badge-text]', block)?.value.trim() || 'Текстовый значок';
    preview.innerHTML = image ? `<img src="${esc(image)}" alt="${esc(text)}">` : `<span>${esc(text)}</span>`;
  }
  function readFooterBadgeFile(input){
    const file = input.files?.[0];
    const block = input.closest('[data-footer-badge-key]');
    if(!file || !block) return;
    const reader = new FileReader();
    reader.onload = () => {
      const target = $('[data-footer-badge-image]', block);
      if(target) target.value = reader.result;
      updateFooterBadgePreview(block);
      input.value = '';
      toast('Значок загружен');
    };
    reader.readAsDataURL(file);
  }
  function collectBrandImageEditorValue(block){
    if(!block) return {...DEFAULT_BRAND_IMAGE};
    return normalizeBrandImageValue({
      src:$('[data-brand-image-src]', block)?.value.trim() || '',
      fit:$('[data-brand-image-fit]', block)?.value || DEFAULT_BRAND_IMAGE.fit,
      positionX:$('[data-brand-image-x]', block)?.value,
      positionY:$('[data-brand-image-y]', block)?.value,
      scale:$('[data-brand-image-scale]', block)?.value
    });
  }
  function resetBrandImageControls(block){
    if(!block) return;
    const fit = $('[data-brand-image-fit]', block);
    const x = $('[data-brand-image-x]', block);
    const y = $('[data-brand-image-y]', block);
    const scale = $('[data-brand-image-scale]', block);
    if(fit) fit.value = DEFAULT_BRAND_IMAGE.fit;
    if(x) x.value = DEFAULT_BRAND_IMAGE.positionX;
    if(y) y.value = DEFAULT_BRAND_IMAGE.positionY;
    if(scale) scale.value = DEFAULT_BRAND_IMAGE.scale;
    updateBrandImagePreview(block);
  }
  function updateBrandImagePreview(block){
    if(!block) return;
    const preview = $('[data-brand-image-preview]', block);
    if(!preview) return;
    const image = collectBrandImageEditorValue(block);
    const brand = block?.dataset.brandImageKey || 'Brand';
    preview.setAttribute('style', brandImageStyle(image));
    preview.innerHTML = image.src ? `<img src="${esc(image.src)}" alt="${esc(brand)}">` : `<span>${esc(brand[0] || 'B')}</span>`;
    const xValue = $('[data-brand-image-x-value]', block);
    const yValue = $('[data-brand-image-y-value]', block);
    const scaleValue = $('[data-brand-image-scale-value]', block);
    if(xValue) xValue.textContent = `${Math.round(image.positionX)}%`;
    if(yValue) yValue.textContent = `${Math.round(image.positionY)}%`;
    if(scaleValue) scaleValue.textContent = `${Math.round(image.scale * 100)}%`;
  }
  function readBrandImageFile(input){
    const file = input.files?.[0];
    const block = input.closest('[data-brand-image-key]');
    if(!file || !block) return;
    const reader = new FileReader();
    reader.onload = () => {
      const target = $('[data-brand-image-src]', block);
      if(target) target.value = reader.result;
      updateBrandImagePreview(block);
      input.value = '';
      toast('Изображение бренда загружено');
    };
    reader.readAsDataURL(file);
  }
  async function sha256(value){
    if(!window.crypto?.subtle) return '';
    const bytes = new TextEncoder().encode(value);
    const hash = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(hash)).map(byte => byte.toString(16).padStart(2, '0')).join('');
  }
  function passwordCodeMatch(value){
    const chars = Array.from(String(value || ''));
    return chars.length === ADMIN_PASSWORD_CODES.length && chars.every((char, index) => char.charCodeAt(0) === ADMIN_PASSWORD_CODES[index]);
  }
  function heroMetricEditor(metric={}, index=0){
    const id = String(metric.id || `metric-${Date.now()}-${index}`);
    return `<article class="admin-block-editor" data-hero-metric-key="${esc(id)}">
      <div class="admin-block-head">
        <h4>Метрика ${index + 1}</h4>
        <label class="mini-toggle"><input type="checkbox" data-hero-metric-enabled ${metric.enabled !== false ? 'checked' : ''}> Включена</label>
      </div>
      <div class="field-row">
        <input data-hero-metric-value value="${esc(metric.value || '')}" placeholder="12+">
        <input data-hero-metric-label value="${esc(metric.label || '')}" placeholder="категорий">
      </div>
      <button class="btn btn-danger small" data-hero-metric-delete type="button">Удалить метрику</button>
    </article>`;
  }
  function goalEditor(goal={}, index=0){
    const id = String(goal.id || `goal-${Date.now()}-${index}`);
    return `<article class="admin-block-editor" data-goal-key="${esc(id)}">
      <div class="admin-block-head">
        <h4>Цель ${index + 1}</h4>
        <label class="mini-toggle"><input type="checkbox" data-goal-enabled ${goal.enabled !== false ? 'checked' : ''}> Включена</label>
      </div>
      <div class="field-row">
        <input data-goal-title value="${esc(goal.title || '')}" placeholder="Название цели">
        <input data-goal-href value="${esc(goal.href || 'catalog.html')}" placeholder="Ссылка">
      </div>
      <textarea data-goal-text placeholder="Описание">${esc(goal.text || '')}</textarea>
      <button class="btn btn-danger small" data-goal-delete type="button">Удалить цель</button>
    </article>`;
  }
  function brandImageEditor(brand, image='', index=0){
    const settings = normalizeBrandImageValue(image);
    return `<article class="admin-block-editor brand-image-editor" data-brand-image-key="${esc(brand)}">
      <div class="admin-block-head">
        <h4>${esc(brand)}</h4>
        <span class="mono">${String(index + 1).padStart(2,'0')}</span>
      </div>
      <div class="brand-image-admin-preview" data-brand-image-preview style="${esc(brandImageStyle(settings))}">
        ${settings.src ? `<img src="${esc(settings.src)}" alt="${esc(brand)}">` : `<span>${esc(brand[0] || 'B')}</span>`}
      </div>
      <label class="admin-input-field">
        <span>Изображение бренда</span>
        <input data-brand-image-src value="${esc(settings.src)}" placeholder="Ссылка или загруженный файл">
      </label>
      <label class="admin-input-field">
        <span>Подгонка изображения</span>
        <select data-brand-image-fit>
          <option value="contain" ${settings.fit === 'contain' ? 'selected' : ''}>Авто: вписать целиком</option>
          <option value="cover" ${settings.fit === 'cover' ? 'selected' : ''}>Заполнить область</option>
        </select>
        <small>Авто не обрезает логотип. «Заполнить» подходит для фото и широких баннеров.</small>
      </label>
      <label class="range-field">
        <span>Сдвиг по X <strong data-brand-image-x-value>${Math.round(settings.positionX)}%</strong></span>
        <input data-brand-image-x type="range" min="0" max="100" step="1" value="${esc(settings.positionX)}">
      </label>
      <label class="range-field">
        <span>Сдвиг по Y <strong data-brand-image-y-value>${Math.round(settings.positionY)}%</strong></span>
        <input data-brand-image-y type="range" min="0" max="100" step="1" value="${esc(settings.positionY)}">
      </label>
      <label class="range-field">
        <span>Масштаб <strong data-brand-image-scale-value>${Math.round(settings.scale * 100)}%</strong></span>
        <input data-brand-image-scale type="range" min="0.5" max="2" step="0.05" value="${esc(settings.scale)}">
      </label>
      <div class="field-row">
        <input data-brand-image-upload type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml">
        <button class="btn btn-light small" data-brand-image-reset type="button">Авто-подгонка</button>
      </div>
      <div class="field-row">
        <button class="btn btn-light small" data-brand-image-clear type="button">Убрать картинку</button>
      </div>
    </article>`;
  }
  function storeBlockEditor(block={}, index=0){
    const id = String(block.id || `store-${Date.now()}-${index}`);
    return `<article class="admin-block-editor" data-store-block-key="${esc(id)}">
      <div class="admin-block-head">
        <h4>Блок ${index + 1}</h4>
        <label class="mini-toggle"><input type="checkbox" data-store-block-enabled ${block.enabled !== false ? 'checked' : ''}> Включен</label>
      </div>
      <input data-store-block-title value="${esc(block.title || '')}" placeholder="Название блока">
      <textarea data-store-block-text placeholder="Текст блока">${esc(block.text || '')}</textarea>
      <button class="btn btn-danger small" data-store-block-delete type="button">Удалить блок</button>
    </article>`;
  }
  function pickupStoreEditor(store={}, index=0){
    const id = String(store.id || `pickup-${Date.now()}-${index}`);
    return `<article class="admin-block-editor" data-pickup-store-key="${esc(id)}">
      <div class="admin-block-head">
        <h4>Пункт ${index + 1}</h4>
        <label class="mini-toggle"><input type="checkbox" data-pickup-store-enabled ${store.enabled !== false ? 'checked' : ''}> Включен</label>
      </div>
      <div class="field-row">
        <input data-pickup-store-title value="${esc(store.title || '')}" placeholder="Название">
        <input data-pickup-store-note value="${esc(store.note || '')}" placeholder="График / примечание">
      </div>
      <textarea data-pickup-store-address placeholder="Адрес">${esc(store.address || '')}</textarea>
      <button class="btn btn-danger small" data-pickup-store-delete type="button">Удалить пункт</button>
    </article>`;
  }
  function deliveryMethodEditor(key='delivery', method={}, index=0){
    const id = String(key || method.id || `method-${Date.now()}-${index}`);
    return `<article class="admin-block-editor" data-delivery-method-key="${esc(id)}">
      <div class="admin-block-head">
        <h4>Способ ${index + 1}</h4>
        <label class="mini-toggle"><input type="checkbox" data-delivery-method-enabled ${method.enabled !== false ? 'checked' : ''}> Включен</label>
      </div>
      <div class="field-row">
        <input data-delivery-method-id value="${esc(id)}" placeholder="ID, например courier">
        <input data-delivery-method-title value="${esc(method.title || '')}" placeholder="Название">
      </div>
      <input data-delivery-method-subtitle value="${esc(method.subtitle || '')}" placeholder="Подпись">
      <button class="btn btn-danger small" data-delivery-method-delete type="button">Удалить способ</button>
    </article>`;
  }
  function categoryEditor(category={}, index=0){
    return `<article class="admin-block-editor" data-category-key="${esc(category.id || `category-${index + 1}`)}">
      <div class="admin-block-head">
        <h4>Категория ${index + 1}</h4>
      </div>
      <div class="field-row">
        <input data-category-name value="${esc(category.name || '')}" placeholder="Название категории">
        <input data-category-id value="${esc(category.id || '')}" placeholder="ID для ссылки">
      </div>
      <textarea data-category-description placeholder="Описание категории">${esc(category.description || '')}</textarea>
      <button class="btn btn-danger small" data-category-delete type="button">Удалить категорию</button>
    </article>`;
  }
  function faqItemEditor(item={}, index=0){
    return `<article class="admin-block-editor" data-faq-key="${esc(item.id || `faq-${index + 1}`)}">
      <div class="admin-block-head">
        <h4>Вопрос ${index + 1}</h4>
        <label class="mini-toggle"><input type="checkbox" data-faq-enabled ${item.enabled !== false ? 'checked' : ''}> Включен</label>
      </div>
      <input data-faq-question value="${esc(item.question || '')}" placeholder="Вопрос">
      <textarea data-faq-answer placeholder="Ответ">${esc(item.answer || '')}</textarea>
      <button class="btn btn-danger small" data-faq-delete type="button">Удалить вопрос</button>
    </article>`;
  }
  function contentItemEditor(type, item={}, index=0){
    const id = String(item.id || `${type}-${Date.now()}-${index}`);
    const title = `Карточка ${index + 1}`;
    return `<article class="admin-block-editor" data-content-item="${esc(type)}" data-content-key="${esc(id)}">
      <div class="admin-block-head">
        <h4>${esc(title)}</h4>
        <label class="mini-toggle"><input type="checkbox" data-content-enabled ${item.enabled !== false ? 'checked' : ''}> Включена</label>
      </div>
      <input data-content-title value="${esc(item.title || '')}" placeholder="Заголовок">
      <textarea data-content-text placeholder="Текст">${esc(item.text || '')}</textarea>
      <button class="btn btn-danger small" data-content-delete type="button">Удалить</button>
    </article>`;
  }
  function collectHeroMetrics(){
    return $$('[data-hero-metric-key]').map((card, index) => ({
      id:card.dataset.heroMetricKey || `metric-${index + 1}`,
      value:$('[data-hero-metric-value]', card)?.value.trim() || '',
      label:$('[data-hero-metric-label]', card)?.value.trim() || '',
      enabled:$('[data-hero-metric-enabled]', card)?.checked !== false
    })).filter(item => item.value || item.label);
  }
  function collectGoals(){
    return $$('[data-goal-key]').map((card, index) => ({
      id:card.dataset.goalKey || `goal-${index + 1}`,
      title:$('[data-goal-title]', card)?.value.trim() || '',
      text:$('[data-goal-text]', card)?.value.trim() || '',
      href:$('[data-goal-href]', card)?.value.trim() || 'catalog.html',
      enabled:$('[data-goal-enabled]', card)?.checked !== false
    })).filter(item => item.title || item.text);
  }
  function collectBrandImages(existing={}){
    const images = {...existing};
    $$('[data-brand-image-key]').forEach(card => {
      const brand = card.dataset.brandImageKey;
      const image = collectBrandImageEditorValue(card);
      if(!brand) return;
      if(image.src) images[brand] = image;
      else delete images[brand];
    });
    return images;
  }
  function collectStoreBlocks(){
    return $$('[data-store-block-key]').map((card, index) => ({
      id:card.dataset.storeBlockKey || `store-${index + 1}`,
      title:$('[data-store-block-title]', card)?.value.trim() || '',
      text:$('[data-store-block-text]', card)?.value.trim() || '',
      enabled:$('[data-store-block-enabled]', card)?.checked !== false
    })).filter(item => item.title || item.text);
  }
  function collectPickupStores(){
    return $$('[data-pickup-store-key]').map((card, index) => ({
      id:card.dataset.pickupStoreKey || `pickup-${index + 1}`,
      title:$('[data-pickup-store-title]', card)?.value.trim() || '',
      address:$('[data-pickup-store-address]', card)?.value.trim() || '',
      note:$('[data-pickup-store-note]', card)?.value.trim() || '',
      enabled:$('[data-pickup-store-enabled]', card)?.checked !== false
    })).filter(item => item.title || item.address || item.note);
  }
  function collectDeliveryMethods(){
    const methods = {};
    $$('[data-delivery-method-key]').forEach((card, index) => {
      const title = $('[data-delivery-method-title]', card)?.value.trim() || '';
      const subtitle = $('[data-delivery-method-subtitle]', card)?.value.trim() || '';
      const rawId = $('[data-delivery-method-id]', card)?.value.trim() || title || `delivery-${index + 1}`;
      const id = categoryIdFromName(rawId, index);
      if(!title && !subtitle) return;
      if(methods[id]) return;
      methods[id] = {
        enabled:$('[data-delivery-method-enabled]', card)?.checked !== false,
        title:title || 'Способ доставки',
        subtitle
      };
    });
    return methods;
  }
  function collectCategories(){
    const seen = new Set();
    return $$('[data-category-key]').map((card, index) => {
      const name = $('[data-category-name]', card)?.value.trim() || '';
      const id = categoryIdFromName($('[data-category-id]', card)?.value.trim() || name, index);
      return {
        id,
        name,
        description:$('[data-category-description]', card)?.value.trim() || ''
      };
    }).filter(item => {
      if(!item.name || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }
  function collectContentItems(type){
    return $$(`[data-content-item="${type}"]`).map((card, index) => ({
      id:card.dataset.contentKey || `${type}-${index + 1}`,
      title:$('[data-content-title]', card)?.value.trim() || '',
      text:$('[data-content-text]', card)?.value.trim() || '',
      enabled:$('[data-content-enabled]', card)?.checked !== false
    })).filter(item => item.title || item.text);
  }
  function collectFaqItems(){
    return $$('[data-faq-key]').map((card, index) => ({
      id:String(card.dataset.faqKey || `faq-${index + 1}`),
      question:$('[data-faq-question]', card)?.value.trim() || '',
      answer:$('[data-faq-answer]', card)?.value.trim() || '',
      enabled:$('[data-faq-enabled]', card)?.checked !== false
    })).filter(item => item.question || item.answer);
  }

  function renderAdmin(){
    const isLogged = sessionStorage.getItem(KEYS.admin) === '1';
    const login = $('#adminLogin');
    const panel = $('#adminPanel');
    if(!login || !panel) return;
    login.style.display = isLogged ? 'none' : 'grid';
    panel.style.display = isLogged ? 'block' : 'none';
    if(!isLogged) return;
    renderAdminProducts(); renderAdminCategories(); renderAdminSite(); renderAdminTelegram(); renderAdminStores(); renderAdminContent(); renderAdminOrders(); renderAdminHeader(); renderAdminFooter(); renderAdminPages(); renderAdminFaq(); renderAdminCart(); renderAdminReviews();
  }
  async function adminLogin(event){
    event.preventDefault();
    const password = $('#adminPassword')?.value || '';
    if(serverAvailable){
      try{
        await fetchJson('/api/admin/login', {method:'POST', body:JSON.stringify({password})});
        sessionStorage.setItem(KEYS.admin,'1');
        await loadAdminState();
        renderAdmin();
        toast('Админка открыта');
      }catch(error){
        console.warn(error);
        toast('Пароль неверный');
      }
      return;
    }
    const hash = await sha256(password);
    const passwordHash = getSite().adminPasswordHash || ADMIN_PASSWORD_HASH;
    if(hash === passwordHash || (!hash && passwordHash === ADMIN_PASSWORD_HASH && passwordCodeMatch(password))){ sessionStorage.setItem(KEYS.admin,'1'); renderAdmin(); toast('Админка открыта'); }
    else toast('Пароль неверный');
  }
  async function adminLogout(){
    if(serverAvailable){
      try{ await fetchJson('/api/admin/logout', {method:'POST'}); }
      catch(error){ console.warn(error); }
    }
    sessionStorage.removeItem(KEYS.admin);
    location.reload();
  }
  function adminSwitch(tab){
    $$('.admin-nav button').forEach(b=>b.classList.toggle('active', b.dataset.adminTab === tab));
    $$('.admin-section').forEach(s=>s.classList.toggle('active', s.id === `admin-${tab}`));
  }
  function renderAdminProducts(){
    const products = getProducts();
    const table = $('#adminProductsTable');
    if(table){
      table.innerHTML = `<div class="admin-table-actions"><button class="btn btn-danger small" data-admin-bulk-delete type="button">Удалить выбранные</button></div><table class="admin-table"><thead><tr><th><input type="checkbox" data-admin-select-all></th><th>Фото</th><th>Товар</th><th>Категория</th><th>Форма</th><th>Бейдж</th><th>Цена</th><th>Остаток</th><th></th></tr></thead><tbody>${products.map(p=>`<tr><td><input type="checkbox" data-admin-product-select value="${esc(p.id)}"></td><td><img class="admin-thumb" src="${esc(firstImage(p))}" alt=""></td><td><strong>${esc(p.name)}</strong><br><small>${esc(p.brand)}</small></td><td>${esc(categoryName(p.category))}</td><td>${esc(formTypeLabel(p.formType))}</td><td>${p.badge ? `<span class="badge admin-badge-preview" style="--badge-bg:${badgeColor(p)}">${esc(p.badge)}</span>` : '—'}</td><td>${money(p.price)}</td><td>${esc(p.stock)}</td><td><button class="btn btn-light small" data-admin-edit="${esc(p.id)}">Ред.</button> <button class="btn btn-danger small" data-admin-delete="${esc(p.id)}">Удалить</button></td></tr>`).join('')}</tbody></table>`;
    }
    fillCategorySelect($('#adminCategory'));
    fillFormTypeSelect($('#adminFormType'));
  }
  function renderAdminCategories(){
    const root = $('#adminCategoriesList');
    if(root) root.innerHTML = getCategories().map(categoryEditor).join('');
  }
  function saveAdminCategories(event){
    event.preventDefault();
    const categories = collectCategories();
    if(!categories.length){ toast('Добавьте хотя бы одну категорию'); return; }
    const site = getSite();
    site.categories = categories;
    saveSite(site);
    renderAdminCategories();
    renderAdminProducts();
    toast('Категории сохранены');
  }
  function fillCategorySelect(select){
    if(!select) return;
    select.innerHTML = getCategories().map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
  }
  function fillFormTypeSelect(select){
    if(!select) return;
    select.innerHTML = `${Object.entries(FORM_TYPES).map(([value,label])=>`<option value="${esc(value)}">${esc(label)}</option>`).join('')}<option value="custom">Своя форма</option>`;
  }
  function resetProductForm(){
    $('#adminProductId').value = '';
    $('#adminProductName').value = '';
    $('#adminBrand').value = '';
    $('#adminPrice').value = '';
    $('#adminOldPrice').value = '';
    $('#adminStock').value = '';
    $('#adminBadge').value = '';
    $('#adminBadgeColor').value = DEFAULT_BADGE_COLOR;
    $('#adminCountry').value = '';
    $('#adminShortDescription').value = '';
    $('#adminFullDescription').value = '';
    $('#adminIngredients').value = '';
    $('#adminUsage').value = '';
    $('#adminPackageOptions').value = '';
    $('#adminFlavors').value = '';
    $('#adminFormType').value = 'powder';
    $('#adminCustomFormType').value = '';
    $('#adminImageData').value = '';
    $('#adminPopular').checked = false;
  }
  function editProduct(id){
    const product = productById(id);
    if(!product){ toast('Товар не найден'); return; }
    fillCategorySelect($('#adminCategory'));
    fillFormTypeSelect($('#adminFormType'));
    $('#adminProductId').value = product.id;
    $('#adminProductName').value = product.name || '';
    $('#adminBrand').value = product.brand || '';
    $('#adminPrice').value = product.price || '';
    $('#adminOldPrice').value = product.oldPrice || '';
    $('#adminStock').value = product.stock || '';
    $('#adminBadge').value = product.badge || '';
    $('#adminBadgeColor').value = badgeColor(product);
    $('#adminCountry').value = product.country || '';
    $('#adminCategory').value = product.category || getCategories()[0]?.id || '';
    const knownFormType = Object.prototype.hasOwnProperty.call(FORM_TYPES, product.formType);
    $('#adminFormType').value = knownFormType ? product.formType : 'custom';
    $('#adminCustomFormType').value = knownFormType ? '' : (product.formType || '');
    $('#adminShortDescription').value = product.shortDescription || '';
    $('#adminFullDescription').value = product.description || '';
    $('#adminIngredients').value = product.ingredients || '';
    $('#adminUsage').value = product.usage || '';
    $('#adminPackageOptions').value = packageOptionsToLines(product.packageOptions, product.price);
    $('#adminFlavors').value = (product.flavors || []).join(', ');
    $('#adminImageData').value = '';
    $('#adminPopular').checked = product.popular === true;
    $('#adminProductForm')?.scrollIntoView({behavior:'smooth',block:'start'});
    toast('Товар открыт для редактирования');
  }
  function saveProduct(event){
    event.preventDefault();
    const products = getProducts();
    const idValue = $('#adminProductId').value;
    const id = idValue ? Number(idValue) : Date.now();
    const existing = products.find(p=>p.id===id) || {};
    const same = products.find(p => String(p.id) !== String(id) && p.name?.trim().toLowerCase() === $('#adminProductName').value.trim().toLowerCase() && p.brand?.trim().toLowerCase() === $('#adminBrand').value.trim().toLowerCase());
    if(same){ toast('Такой товар уже есть в списке'); return; }
    const rawPrice = Number(String($('#adminPrice').value || 0).replace(',', '.')) || 0;
    const packageOptions = parsePackageOptions($('#adminPackageOptions').value, rawPrice);
    const price = Number(packageOptions[0]?.price || rawPrice || 0);
    const formTypeValue = $('#adminFormType').value;
    const formType = formTypeValue === 'custom' ? ($('#adminCustomFormType').value.trim() || 'Своя форма') : formTypeValue;
    const item = {
      ...existing,
      id,
      name:$('#adminProductName').value.trim() || 'Новый товар',
      brand:$('#adminBrand').value.trim() || 'ByVit',
      category:$('#adminCategory').value,
      price,
      oldPrice:Number($('#adminOldPrice').value || 0) || undefined,
      stock:Number($('#adminStock').value || 0),
      badge:$('#adminBadge').value.trim(),
      badgeColor:badgeColor({badgeColor:$('#adminBadgeColor').value}),
      country:$('#adminCountry').value.trim() || '—',
      formType,
      popular:$('#adminPopular').checked,
      rating:existing.rating || 4.7,
      images:[$('#adminImageData').value || firstImage(existing) || 'assets/product-whey.jpg'],
      flavors:parseList($('#adminFlavors').value),
      packageOptions,
      shortDescription:$('#adminShortDescription').value.trim(),
      description:$('#adminFullDescription').value.trim() || $('#adminShortDescription').value.trim(),
      usage:$('#adminUsage').value.trim() || 'Смотрите рекомендации производителя.',
      ingredients:$('#adminIngredients').value.trim() || 'Состав уточняется.'
    };
    const index = products.findIndex(p => String(p.id) === String(id));
    if(index >= 0) products[index] = item;
    else products.unshift(item);
    saveProducts(products); resetProductForm(); renderAdminProducts(); toast('Товар сохранён');
  }
  function deleteProduct(id){
    if(!confirm('Удалить товар?')) return;
    saveProducts(getProducts().filter(p=>String(p.id)!==String(id)));
    renderAdminProducts(); toast('Товар удалён');
  }
  function bulkDeleteProducts(){
    const selected = $$('[data-admin-product-select]:checked').map(input => String(input.value));
    if(!selected.length){ toast('Выберите товары'); return; }
    if(!confirm(`Удалить выбранные товары: ${selected.length}?`)) return;
    saveProducts(getProducts().filter(p => !selected.includes(String(p.id))));
    renderAdminProducts(); toast('Выбранные товары удалены');
  }
  function readFileToHidden(input, hiddenSelector){
    const file = input.files?.[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = () => { const hidden = $(hiddenSelector); if(hidden) hidden.value = reader.result; toast('Файл загружен'); };
    reader.readAsDataURL(file);
  }
  function updateHeroAdminControls(){
    const mode = $('#siteHeroMediaMode')?.value || 'video';
    const srcWrap = $('[data-hero-control="src"]');
    const animationWrap = $('[data-hero-control="animation"]');
    const brightnessWrap = $('[data-hero-control="brightness"]');
    const mediaInput = $('#siteHeroMediaSrc');
    const uploadInput = $('#siteHeroMediaUpload');
    const uploadHint = $('[data-hero-upload-hint]');
    const srcHint = $('[data-hero-src-hint]');
    if(srcWrap){
      srcWrap.hidden = mode === 'animation';
      srcWrap.style.gridColumn = '1 / -1';
    }
    if(animationWrap) animationWrap.hidden = mode !== 'animation';
    if(brightnessWrap) brightnessWrap.style.gridColumn = mode === 'animation' ? '' : '1 / -1';
    if(mediaInput){
      const placeholders = {
        video:'assets/hero-video.mp4 или ссылка на .mp4/.webm',
        image:'assets/photo.jpg или ссылка на .jpg/.png/.webp/.svg',
        file:'Загруженный файл или ссылка на медиа',
        animation:'Для анимации файл не нужен'
      };
      mediaInput.placeholder = placeholders[mode] || placeholders.image;
    }
    if(srcHint){
      const hints = {
        video:'Видео: MP4 или WebM. Постер не используется, сразу показывается видео.',
        image:'Изображение: JPG, PNG, WebP или SVG.',
        file:'Файл баннера: видео MP4/WebM или изображение JPG/PNG/WebP/SVG.',
        animation:'В режиме «Анимация» медиафайл не используется.'
      };
      srcHint.textContent = hints[mode] || hints.file;
    }
    if(uploadHint){
      const hints = {
        video:'Загрузить видео: .mp4 или .webm',
        image:'Загрузить изображение: .jpg, .png, .webp или .svg',
        file:'Загрузить файл: видео .mp4/.webm или изображение .jpg/.png/.webp/.svg',
        animation:'В режиме анимации файл не используется'
      };
      uploadHint.textContent = hints[mode] || hints.file;
    }
    if(uploadInput){
      const accepts = {
        video:'video/mp4,video/webm',
        image:'image/jpeg,image/png,image/webp,image/svg+xml',
        file:'image/jpeg,image/png,image/webp,image/svg+xml,video/mp4,video/webm',
        animation:''
      };
      uploadInput.accept = accepts[mode] ?? accepts.file;
      uploadInput.disabled = mode === 'animation';
    }
  }
  function renderAdminSite(){
    const site = getSite();
    const map = {
      siteHeroEyebrow:'heroEyebrow',
      siteHeroTitle:'heroTitle',
      siteHeroText:'heroText',
      siteHeroTitleSize:'heroTitleSize',
      siteHeroTextSize:'heroTextSize',
      siteHeroEyebrowColor:'heroEyebrowColor',
      siteHeroTitleColor:'heroTitleColor',
      siteHeroTextColor:'heroTextColor',
      siteHeroAlign:'heroAlign',
      siteHeroMediaMode:'heroMediaMode',
      siteHeroMediaSrc:'heroMediaSrc',
      siteHeroAnimation:'heroAnimation',
      siteHeroOpacity:'heroMediaOpacity',
      siteHeroVeil:'heroVeilOpacity',
      siteHeroOverlay:'heroOverlayOpacity',
      siteAnnouncement:'announcement',
      sitePickup:'pickupAddress',
      sitePhone:'phone'
    };
    Object.entries(map).forEach(([id,path])=>{ const el=$('#'+id); if(!el)return; const value = path.split('.').reduce((acc,key)=>acc?.[key], site); el.value = value ?? ''; });
    const opacityValue = $('#heroOpacityValue');
    if(opacityValue) opacityValue.textContent = `${Math.round(Number(site.heroMediaOpacity ?? .78) * 100)}%`;
    const veilValue = $('#heroVeilValue');
    if(veilValue) veilValue.textContent = `${Math.round(Number(site.heroVeilOpacity ?? 1) * 100)}%`;
    const overlayValue = $('#heroOverlayValue');
    if(overlayValue) overlayValue.textContent = `${Math.round(Number(site.heroOverlayOpacity ?? .18) * 100)}%`;
    updateHeroAdminControls();
    const metricRoot = $('#adminHeroMetrics');
    if(metricRoot){
      metricRoot.innerHTML = (site.heroMetrics || DEFAULT_HERO_METRICS).map(heroMetricEditor).join('');
    }
	    const homeRoot = $('#adminHomeBlocks');
	    if(homeRoot){
		      const titles = {categories:'Категории',goals:'Цели',featured:'Популярное',brands:'Бренды',service:'Сервис',sale:'Акции'};
	      homeRoot.innerHTML = Object.entries(site.homeBlocks || DEFAULT_HOME_BLOCKS).sort(([keyA, blockA], [keyB, blockB]) => homeBlockOrder(keyA, blockA) - homeBlockOrder(keyB, blockB)).map(([key, block])=>`
	        <article class="admin-block-editor" data-home-block-key="${esc(key)}">
	          <div class="admin-block-head">
	            <h4>${esc(titles[key] || key)}</h4>
	            <label class="mini-toggle"><input type="checkbox" data-block-field="visible" ${block.visible !== false ? 'checked' : ''}> Включен</label>
	          </div>
	          <label class="admin-input-field">
	            <span>Позиция блока на главной</span>
	            <input data-block-field="order" type="number" min="1" max="20" value="${esc(block.order || homeBlockOrder(key, block))}" placeholder="1">
	          </label>
	          <div class="field-row">
	            <input data-block-field="eyebrow" value="${esc(block.eyebrow || '')}" placeholder="Надпись над заголовком">
	            <input data-block-field="title" value="${esc(block.title || '')}" placeholder="Заголовок">
          </div>
          <textarea data-block-field="text" placeholder="Текст блока">${esc(block.text || '')}</textarea>
          <div class="field-row">
            <input data-block-field="titleSize" type="number" min="24" max="72" value="${esc(block.titleSize || 36)}" placeholder="Размер заголовка">
            <input data-block-field="textSize" type="number" min="12" max="22" value="${esc(block.textSize || 15)}" placeholder="Размер текста">
          </div>
          ${key !== 'service' ? `<div class="field-row"><input data-block-field="buttonText" value="${esc(block.buttonText || '')}" placeholder="Текст кнопки"><input data-block-field="buttonUrl" value="${esc(block.buttonUrl || '')}" placeholder="Ссылка кнопки"></div>` : `
            <div class="field-row"><input data-block-field="featureOneTitle" value="${esc(block.featureOneTitle || '')}" placeholder="Заголовок карточки 1"><input data-block-field="featureTwoTitle" value="${esc(block.featureTwoTitle || '')}" placeholder="Заголовок карточки 2"></div>
            <div class="field-row"><textarea data-block-field="featureOneText" placeholder="Текст карточки 1">${esc(block.featureOneText || '')}</textarea><textarea data-block-field="featureTwoText" placeholder="Текст карточки 2">${esc(block.featureTwoText || '')}</textarea></div>
	          `}
	        </article>`).join('');
	    }
	    const goalsRoot = $('#adminGoalsList');
	    if(goalsRoot){
	      goalsRoot.innerHTML = (site.goals || DEFAULT_GOALS).map(goalEditor).join('');
	    }
	    const brandImagesRoot = $('#adminBrandImages');
	    if(brandImagesRoot){
	      const brandList = brands();
	      brandImagesRoot.innerHTML = brandList.length
	        ? brandList.map((brand, index) => brandImageEditor(brand, site.brandImages?.[brand] || '', index)).join('')
	        : '<p class="admin-hint">Добавьте товары с брендами, и здесь появятся поля для изображений.</p>';
	    }
    const deliveryRoot = $('#adminDeliveryList');
    if(deliveryRoot){
      const methods = site.deliveryMethods || getDefaults().site.deliveryMethods;
      deliveryRoot.innerHTML = Object.entries(methods).map(([key,m], index)=>deliveryMethodEditor(key, m, index)).join('');
    }
    const pickupRoot = $('#adminPickupStores');
    if(pickupRoot){
      pickupRoot.innerHTML = (site.pickupStores || DEFAULT_PICKUP_STORES).map(pickupStoreEditor).join('');
    }
  }
  function saveAdminSite(event){
    event.preventDefault();
    const site = getSite();
    if($('#siteHeroEyebrow')) site.heroEyebrow = $('#siteHeroEyebrow').value;
    if($('#siteHeroTitle')) site.heroTitle = $('#siteHeroTitle').value;
    if($('#siteHeroText')) site.heroText = $('#siteHeroText').value;
    if($('#siteHeroTitleSize')) site.heroTitleSize = Number($('#siteHeroTitleSize').value || 44);
    if($('#siteHeroTextSize')) site.heroTextSize = Number($('#siteHeroTextSize').value || 16);
    if($('#siteHeroEyebrowColor')) site.heroEyebrowColor = colorValue($('#siteHeroEyebrowColor').value, DEFAULT_HERO_COLORS.eyebrow);
    if($('#siteHeroTitleColor')) site.heroTitleColor = colorValue($('#siteHeroTitleColor').value, DEFAULT_HERO_COLORS.title);
    if($('#siteHeroTextColor')) site.heroTextColor = colorValue($('#siteHeroTextColor').value, DEFAULT_HERO_COLORS.text);
    if($('#siteHeroAlign')) site.heroAlign = $('#siteHeroAlign').value;
    if($('#siteHeroMediaMode')) site.heroMediaMode = $('#siteHeroMediaMode').value;
    if($('#siteHeroMediaSrc')) site.heroMediaSrc = $('#siteHeroMediaSrc').value || site.heroMediaSrc;
    if($('#siteHeroAnimation')) site.heroAnimation = $('#siteHeroAnimation').value;
    if($('#siteHeroOpacity')) site.heroMediaOpacity = Number($('#siteHeroOpacity').value || .78);
    if($('#siteHeroVeil')) site.heroVeilOpacity = Number($('#siteHeroVeil').value || 0);
    if($('#siteHeroOverlay')) site.heroOverlayOpacity = Number($('#siteHeroOverlay').value || 0);
    if($('#siteAnnouncement')) site.announcement = $('#siteAnnouncement').value;
	    site.heroMetrics = collectHeroMetrics();
	    site.homeBlocks = site.homeBlocks || {};
	    $$('[data-home-block-key]').forEach(card => {
	      const key = card.dataset.homeBlockKey;
	      const block = site.homeBlocks[key] || {};
	      $$('[data-block-field]', card).forEach(input => {
	        const field = input.dataset.blockField;
	        if(field === 'visible') block.visible = input.checked;
	        else if(field === 'titleSize' || field === 'textSize' || field === 'order') block[field] = Number(input.value || DEFAULT_HOME_BLOCKS[key]?.[field] || 16);
	        else block[field] = input.value;
	      });
	      site.homeBlocks[key] = block;
	    });
	    if($('#adminGoalsList')) site.goals = collectGoals();
    if($('#sitePickup')) site.pickupAddress = $('#sitePickup').value;
    if($('#sitePhone')) site.phone = $('#sitePhone').value;
    site.pickupStores = collectPickupStores();
    site.deliveryMethods = collectDeliveryMethods();
    saveSite(site); applyHeader(); renderAdminSite(); toast('Настройки сохранены');
  }
  function saveAdminBrands(event){
    event.preventDefault();
    const site = getSite();
    site.brandImages = collectBrandImages(site.brandImages || {});
    saveSite(site);
    renderAdminSite();
    toast('Бренды сохранены');
  }
  function renderAdminTelegram(){
    const telegram = getSite().telegram || {};
    const map = {tgContact:'contact',tgBot:'botToken',tgChat:'chatId'};
    Object.entries(map).forEach(([id,key]) => {
      const el = $('#'+id);
      if(el) el.value = telegram[key] || '';
    });
  }
  function saveAdminTelegram(event){
    event.preventDefault();
    const site = getSite();
    site.telegram = site.telegram || {};
    site.telegram.contact = $('#tgContact')?.value.trim() || '';
    site.telegram.botToken = $('#tgBot')?.value.trim() || '';
    site.telegram.chatId = $('#tgChat')?.value.trim() || '';
    saveSite(site); renderAdminTelegram(); toast('Telegram сохранён');
  }
  function resetHeroColors(){
    const fields = {
      siteHeroEyebrowColor:DEFAULT_HERO_COLORS.eyebrow,
      siteHeroTitleColor:DEFAULT_HERO_COLORS.title,
      siteHeroTextColor:DEFAULT_HERO_COLORS.text
    };
    Object.entries(fields).forEach(([id, value]) => {
      const input = $('#'+id);
      if(input) input.value = value;
    });
    toast('Цвета hero возвращены по умолчанию');
  }
  function resetHeroDefaultVideo(){
    const defaults = getDefaults().site || {};
    const values = {
      siteHeroMediaMode:defaults.heroMediaMode || 'video',
      siteHeroMediaSrc:defaults.heroMediaSrc || 'assets/hero-video.mp4',
      siteHeroAnimation:defaults.heroAnimation || 'waves'
    };
    Object.entries(values).forEach(([id, value]) => {
      const field = $('#'+id);
      if(field) field.value = value;
    });
    const upload = $('#siteHeroMediaUpload');
    if(upload) upload.value = '';
    updateHeroAdminControls();
    toast('Выбрано видео по умолчанию. Сохраните настройки');
  }
  function renderAdminStores(){
    const site = getSite();
    const root = $('#adminStoreBlocks');
    if(root) root.innerHTML = (site.storeBlocks || DEFAULT_STORE_BLOCKS).map(storeBlockEditor).join('');
    const map = site.map || DEFAULT_MAP;
    const enabled = $('#storeMapEnabled'); if(enabled) enabled.checked = map.enabled === true;
    const provider = $('#storeMapProvider'); if(provider) provider.value = map.provider || 'yandex';
    const placeholder = $('#storeMapPlaceholder'); if(placeholder) placeholder.value = map.placeholder || DEFAULT_MAP.placeholder;
    const embed = $('#storeMapEmbed'); if(embed) embed.value = map.embedUrl || '';
  }
  function saveAdminStores(event){
    event.preventDefault();
    const site = getSite();
    site.storeBlocks = collectStoreBlocks();
    site.map = {
      enabled:$('#storeMapEnabled')?.checked === true,
      provider:$('#storeMapProvider')?.value || 'yandex',
      embedUrl:$('#storeMapEmbed')?.value.trim() || '',
      placeholder:$('#storeMapPlaceholder')?.value.trim() || DEFAULT_MAP.placeholder
    };
    saveSite(site); renderAdminStores(); toast('Магазины сохранены');
  }
  async function saveAdminPassword(event){
    event.preventDefault();
    const password = $('#adminNewPassword')?.value || '';
    const repeat = $('#adminNewPasswordRepeat')?.value || '';
    if(password.length < 4){ toast('Пароль должен быть не короче 4 символов'); return; }
    if(password !== repeat){ toast('Пароли не совпадают'); return; }
    const hash = await sha256(password);
    if(!hash){ toast('Браузер не смог сохранить новый пароль'); return; }
    const site = getSite();
    site.adminPasswordHash = hash;
    saveSite(site);
    $('#adminNewPassword').value = '';
    $('#adminNewPasswordRepeat').value = '';
    toast('Пароль админки изменён');
  }
  function renderAdminHeader(){
    const header = getSite().header || {};
    const map = {headerStoreName:'storeName',headerLogoText:'logoText',headerLogoImage:'logoImage',headerBrandImage:'brandImage',headerTopRight:'topRight',headerSearchPlaceholder:'searchPlaceholder',headerAdminLabel:'adminLabel'};
    Object.entries(map).forEach(([id,key]) => { const el = $('#'+id); if(el) el.value = header[key] || ''; });
    const nav = $('#headerNavLines'); if(nav) nav.value = linksToLines(header.nav || []);
  }
  function saveAdminHeader(event){
    event.preventDefault();
    const site = getSite();
    site.header = site.header || {};
    site.header.storeName = $('#headerStoreName')?.value.trim() || 'ByVit';
    site.header.logoText = $('#headerLogoText')?.value.trim() || 'BV';
    site.header.logoImage = $('#headerLogoImage')?.value.trim() || '';
    site.header.brandImage = $('#headerBrandImage')?.value.trim() || '';
    site.header.topRight = $('#headerTopRight')?.value.trim();
    site.header.searchPlaceholder = $('#headerSearchPlaceholder')?.value.trim() || 'Поиск товара';
    site.header.adminLabel = $('#headerAdminLabel')?.value.trim() || 'Админ';
    site.header.nav = linesToLinks($('#headerNavLines')?.value || '');
    saveSite(site); applyHeader(); renderFooter(); renderAdminHeader(); toast('Хэдер сохранён');
  }
  function renderAdminFooter(){
    const footer = getSite().footer || {};
    const contacts = footer.contacts || {};
    const map = {footerDescription:'description',footerCopyright:'copyright',footerTechText:'techText'};
    Object.entries(map).forEach(([id,key]) => { const el = $('#'+id); if(el) el.value = footer[key] || ''; });
    const contactMap = {footerInstagram:'instagram',footerTelegram:'telegram',footerEmail:'email'};
    Object.entries(contactMap).forEach(([id,key]) => { const el = $('#'+id); if(el) el.value = contacts[key] || ''; });
    const phones = $('#footerPhones'); if(phones) phones.value = (contacts.phones || []).join('\n');
    const extra = $('#footerExtraContacts'); if(extra) extra.value = footerContactsToLines(contacts.extra || []);
    const badgesList = $('#footerBadgesList'); if(badgesList) badgesList.innerHTML = (footer.badges || []).map(footerBadgeEditor).join('');
    const badges = $('#footerBadges'); if(badges) badges.value = footerBadgesToLines(footer.badges || []);
    const columns = $('#footerColumns'); if(columns) columns.value = footerColumnsToLines(footer.columns || []);
  }
  function saveAdminFooter(event){
    event.preventDefault();
    const site = getSite();
    site.footer = site.footer || {};
    site.footer.description = $('#footerDescription')?.value || '';
    site.footer.copyright = $('#footerCopyright')?.value || '';
    site.footer.techText = $('#footerTechText')?.value || '';
    site.footer.contacts = {
      instagram:$('#footerInstagram')?.value.trim() || '',
      telegram:$('#footerTelegram')?.value.trim() || '',
      email:$('#footerEmail')?.value.trim() || '',
      phones:parseList($('#footerPhones')?.value || ''),
      extra:linesToFooterContacts($('#footerExtraContacts')?.value || '')
    };
    site.footer.badges = $('#footerBadgesList') ? collectFooterBadges() : linesToFooterBadges($('#footerBadges')?.value || '');
    site.footer.columns = linesToFooterColumns($('#footerColumns')?.value || '');
    saveSite(site); renderFooter(); renderAdminFooter(); toast('Футер сохранён');
  }
  function renderAdminPages(){
    const site = getSite();
    const root = $('#adminPageHeaders');
    if(root){
      const headers = site.pageHeaders || DEFAULT_PAGE_HEADERS;
      root.innerHTML = Object.entries(headers).map(([key,item]) => `<article class="admin-block-editor" data-page-header-key="${esc(key)}"><div class="admin-block-head"><h4>${esc(key)}</h4></div><input data-page-title value="${esc(item.title || '')}" placeholder="Заголовок"><textarea data-page-text placeholder="Текст">${esc(item.text || '')}</textarea></article>`).join('');
    }
  }
  function saveAdminPages(event){
    event.preventDefault();
    const site = getSite();
    site.pageHeaders = site.pageHeaders || {};
    $$('[data-page-header-key]').forEach(card => {
      const key = card.dataset.pageHeaderKey;
      site.pageHeaders[key] = {title:$('[data-page-title]', card)?.value || '',text:$('[data-page-text]', card)?.value || ''};
    });
    saveSite(site); applyPageHeader(); renderAdminPages(); toast('Страницы сохранены');
  }
  function renderAdminContent(){
    const site = getSite();
    const about = site.aboutPage || DEFAULT_ABOUT_PAGE;
    const aboutMap = {
      aboutAdminEyebrow:'eyebrow',
      aboutAdminTitle:'title',
      aboutAdminText:'text',
      aboutAdminMissionTitle:'missionTitle',
      aboutAdminMissionText:'missionText',
      aboutAdminLegalTitle:'legalTitle',
      aboutAdminLegalText:'legalText'
    };
    Object.entries(aboutMap).forEach(([id,key]) => { const el = $('#'+id); if(el) el.value = about[key] || ''; });
    const aboutCards = $('#adminAboutCards'); if(aboutCards) aboutCards.innerHTML = (about.cards || DEFAULT_ABOUT_PAGE.cards).map((item, index) => contentItemEditor('about', item, index)).join('');
  }
  function saveAdminContent(event){
    event.preventDefault();
    const site = getSite();
    site.aboutPage = {
      eyebrow:$('#aboutAdminEyebrow')?.value.trim() || '',
      title:$('#aboutAdminTitle')?.value.trim() || '',
      text:$('#aboutAdminText')?.value.trim() || '',
      missionTitle:$('#aboutAdminMissionTitle')?.value.trim() || '',
      missionText:$('#aboutAdminMissionText')?.value.trim() || '',
      cards:collectContentItems('about'),
      legalTitle:$('#aboutAdminLegalTitle')?.value.trim() || '',
      legalText:$('#aboutAdminLegalText')?.value.trim() || ''
    };
    saveSite(site); renderAdminContent(); renderAboutPage(); toast('Контент сохранён');
  }
  function renderAdminFaq(){
    const root = $('#adminFaqItems');
    if(root) root.innerHTML = (getSite().faqItems || DEFAULT_FAQ_ITEMS).map(faqItemEditor).join('');
  }
  function saveAdminFaq(event){
    event.preventDefault();
    const site = getSite();
    site.faqItems = collectFaqItems();
    saveSite(site); renderFaq(); renderAdminFaq(); toast('FAQ сохранён');
  }
  function renderAdminCart(){
    const site = getSite();
    const checkout = site.checkout || DEFAULT_CHECKOUT;
    const blocks = checkout.blocks || DEFAULT_CHECKOUT.blocks;
    const blockMap = {cartBlockSummary:'summary',cartBlockPromo:'promo',cartBlockCheckout:'checkout',cartBlockDelivery:'delivery',cartBlockAddress:'address',cartBlockPayment:'payment',cartBlockComment:'comment'};
    Object.entries(blockMap).forEach(([id,key]) => { const input = $('#'+id); if(input) input.checked = blocks[key] !== false; });
    const map = {cartSummaryTitle:'summaryTitle',cartItemsLabel:'itemsLabel',cartDeliveryLabel:'deliveryLabel',cartTotalLabel:'totalLabel',cartPromoPlaceholder:'promoPlaceholder',cartPromoButton:'promoButton',cartCheckoutTitle:'checkoutTitle',cartNamePlaceholder:'namePlaceholder',cartPhonePlaceholder:'phonePlaceholder',cartAddressPlaceholder:'addressPlaceholder',cartCommentPlaceholder:'commentPlaceholder',cartSubmitText:'submitText',cartSuccessTitle:'successTitle'};
    Object.entries(map).forEach(([id,key]) => { const el = $('#'+id); if(el) el.value = checkout[key] || ''; });
    const successText = $('#cartSuccessText'); if(successText) successText.value = checkout.successText || '';
    const payment = $('#cartPaymentOptions'); if(payment) payment.value = (checkout.paymentOptions || []).join('\n');
    const promos = $('#cartPromoLines'); if(promos) promos.value = (site.promos || []).map(p => `${p.code} | ${p.value} | ${p.type} | ${p.enabled === false ? '0' : '1'}`).join('\n');
  }
  function saveAdminCart(event){
    event.preventDefault();
    const site = getSite();
    site.checkout = site.checkout || {};
    site.checkout.blocks = {
      summary:$('#cartBlockSummary')?.checked !== false,
      promo:$('#cartBlockPromo')?.checked !== false,
      checkout:$('#cartBlockCheckout')?.checked !== false,
      delivery:$('#cartBlockDelivery')?.checked !== false,
      address:$('#cartBlockAddress')?.checked !== false,
      payment:$('#cartBlockPayment')?.checked !== false,
      comment:$('#cartBlockComment')?.checked !== false
    };
    const map = {cartSummaryTitle:'summaryTitle',cartItemsLabel:'itemsLabel',cartDeliveryLabel:'deliveryLabel',cartTotalLabel:'totalLabel',cartPromoPlaceholder:'promoPlaceholder',cartPromoButton:'promoButton',cartCheckoutTitle:'checkoutTitle',cartNamePlaceholder:'namePlaceholder',cartPhonePlaceholder:'phonePlaceholder',cartAddressPlaceholder:'addressPlaceholder',cartCommentPlaceholder:'commentPlaceholder',cartSubmitText:'submitText',cartSuccessTitle:'successTitle'};
    Object.entries(map).forEach(([id,key]) => { const el = $('#'+id); if(el) site.checkout[key] = el.value; });
    site.checkout.successText = $('#cartSuccessText')?.value || '';
    site.checkout.paymentOptions = parseList($('#cartPaymentOptions')?.value || '');
    site.promos = String($('#cartPromoLines')?.value || '').split(/\n+/).map(line => line.trim()).filter(Boolean).map(line => {
      const [code='',value='0',type='percent',enabled='1'] = line.split('|').map(part => part.trim());
      return {code:code.toUpperCase(),value:Number(value || 0),type:type === 'fixed' ? 'fixed' : 'percent',enabled:enabled !== '0'};
    });
    saveSite(site); renderAdminCart(); toast('Корзина сохранена');
  }
  function renderAdminReviews(){
    const root = $('#adminReviewsTable'); if(!root) return;
    const reviews = getReviews();
    const productOptions = getProducts().map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
    const productSelect = $('#adminReviewProduct'); if(productSelect) productSelect.innerHTML = productOptions;
    root.innerHTML = reviews.length ? `<table class="admin-table"><thead><tr><th>Товар</th><th>Автор</th><th>Оценка</th><th>Статус</th><th>Текст</th><th></th></tr></thead><tbody>${reviews.map(review => { const p = productById(review.productId) || {}; const status = review.status === 'approved' ? 'Одобрен' : 'Ожидает'; return `<tr><td>${esc(p.name || review.productId)}</td><td>${esc(review.name)}</td><td>${ratingStars(review.rating)}</td><td>${esc(status)}</td><td>${esc(review.text)}</td><td><button class="btn btn-light small" data-review-edit="${esc(review.id)}">Ред.</button> <button class="btn btn-primary small" data-review-approve="${esc(review.id)}">Одобрить</button> <button class="btn btn-danger small" data-review-delete="${esc(review.id)}">Удалить</button></td></tr>`; }).join('')}</tbody></table>` : `<div class="empty-state"><h3>Отзывов пока нет</h3><p>Новые отзывы из карточек товара появятся здесь.</p></div>`;
  }
  function resetReviewForm(){
    $('#adminReviewId').value = '';
    $('#adminReviewName').value = '';
    $('#adminReviewRating').value = '5';
    $('#adminReviewText').value = '';
    $('#adminReviewStatus').value = 'approved';
  }
  function editReview(id){
    const review = getReviews().find(item => String(item.id) === String(id)); if(!review) return;
    $('#adminReviewId').value = review.id;
    $('#adminReviewProduct').value = review.productId;
    $('#adminReviewName').value = review.name || '';
    $('#adminReviewRating').value = review.rating || 5;
    $('#adminReviewText').value = review.text || '';
    $('#adminReviewStatus').value = review.status || 'pending';
  }
  function saveAdminReview(event){
    event.preventDefault();
    const reviews = getReviews();
    const idValue = $('#adminReviewId').value;
    const item = {id:idValue ? Number(idValue) : Date.now(),productId:Number($('#adminReviewProduct').value),name:$('#adminReviewName').value.trim() || 'Покупатель',rating:Number($('#adminReviewRating').value || 5),text:$('#adminReviewText').value.trim(),status:$('#adminReviewStatus').value,date:new Date().toLocaleDateString('ru-RU')};
    if(!item.text){ toast('Введите текст отзыва'); return; }
    const index = reviews.findIndex(review => String(review.id) === String(item.id));
    if(index >= 0) reviews[index] = {...reviews[index],...item}; else reviews.unshift(item);
    saveReviews(reviews); resetReviewForm(); renderAdminReviews(); toast('Отзыв сохранён');
  }
  function approveReview(id){
    const reviews = getReviews();
    const review = reviews.find(item => String(item.id) === String(id));
    if(review){ review.status = 'approved'; saveReviews(reviews); renderAdminReviews(); toast('Отзыв одобрен'); }
  }
  function deleteReview(id){
    saveReviews(getReviews().filter(item => String(item.id) !== String(id)));
    renderAdminReviews(); toast('Отзыв удалён');
  }
  function renderAdminOrders(){
    const root = $('#adminOrdersTable'); if(!root) return;
    const orders = getOrders();
    root.innerHTML = orders.length ? `<table class="admin-table"><thead><tr><th>ID</th><th>Клиент</th><th>Получение</th><th>Сумма</th><th>Статус</th><th></th></tr></thead><tbody>${orders.map(o=>`<tr><td>#${esc(o.id)}<br><small>${esc(o.date)}</small></td><td>${esc(o.customer?.name || '')}<br><small>${esc(o.customer?.phone || '')}</small></td><td>${esc(o.deliveryTitle || '')}</td><td>${money(o.total)}</td><td>${esc(o.status)}</td><td><button class="btn btn-light small" data-order-done="${esc(o.id)}">Выполнен</button> <button class="btn btn-danger small" data-order-delete="${esc(o.id)}">Удалить</button></td></tr>`).join('')}</tbody></table>` : `<div class="empty-state"><h3>Заказов пока нет</h3><p>Когда клиент оформит заказ, он появится здесь.</p></div>`;
  }
  function updateOrder(id,status){ const orders=getOrders(); const o=orders.find(x=>String(x.id)===String(id)); if(o){o.status=status;saveOrders(orders);renderAdminOrders();} }
  function deleteOrder(id){ saveOrders(getOrders().filter(o=>String(o.id)!==String(id))); renderAdminOrders(); }
  function exportData(){
    const data = {products:getProducts(),site:getSite(),orders:getOrders(),reviews:getReviews()};
    const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'byvit-export.json'; a.click(); URL.revokeObjectURL(a.href);
  }
  async function resetAll(){
    if(!confirm('Сбросить товары и настройки к демо-версии?')) return;
    localStorage.removeItem(KEYS.products); localStorage.removeItem(KEYS.site); localStorage.removeItem(KEYS.cart); localStorage.removeItem(KEYS.wishlist); localStorage.removeItem(KEYS.compare); localStorage.removeItem(KEYS.reviews);
    if(serverAvailable && isAdminSession()){
      const defaults = getDefaults();
      serverState = {
        products:clone(defaults.products || []),
        site:normalizeSite(clone(defaults.site || {})),
        reviews:clone(defaults.reviews || []),
        orders:[]
      };
      try{
        await fetchJson('/api/admin/state', {method:'PUT', body:JSON.stringify(serverState)});
      }catch(error){
        console.warn(error);
        toast('Не удалось сбросить данные на сервере');
      }
    }
    location.reload();
  }

  function refreshCurrentPage(){
    const page = document.body.dataset.page;
    if(page === 'home') renderHome();
    if(page === 'catalog') renderCatalogProducts();
    if(page === 'sale') renderSale();
    if(page === 'wishlist') renderWishlist();
    if(page === 'compare') renderCompare();
    if(page === 'product') renderProduct();
    if(page === 'about') renderAboutPage();
  }

	  function bindGlobal(){
	    document.addEventListener('click', event => {
	      const close = event.target.closest('[data-modal-close]'); if(close || event.target.id === 'modal'){ closeModal(); return; }
	      const mobileSearch = event.target.closest('[data-mobile-search]');
	      if(mobileSearch){
	        const panel = $('[data-mobile-search-panel]');
	        const open = panel?.classList.toggle('open');
	        document.body.classList.toggle('search-open', Boolean(open));
	        mobileSearch.setAttribute('aria-expanded', open ? 'true' : 'false');
	        if(open) $('[data-header-search]', panel)?.focus();
	        return;
	      }
	      const contactToggle = event.target.closest('[data-contact-toggle]');
	      if(contactToggle){
	        const root = contactToggle.closest('[data-quick-contact]');
	        const open = root?.classList.toggle('open');
	        contactToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
	        return;
	      }
	      if(!event.target.closest('[data-quick-contact]')){
	        const root = $('[data-quick-contact].open');
	        if(root){
	          root.classList.remove('open');
	          $('[data-contact-toggle]', root)?.setAttribute('aria-expanded', 'false');
	        }
	      }
	      const filterToggle = event.target.closest('[data-filter-toggle]');
	      if(filterToggle){
        const shell = filterToggle.closest('.catalog-filter-shell');
        const open = shell?.classList.toggle('open');
        filterToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        return;
      }
      const footerToggle = event.target.closest('[data-footer-toggle]');
      if(footerToggle){
        const item = footerToggle.closest('[data-footer-accordion]');
        const open = item?.classList.toggle('open');
        footerToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        return;
      }
      const faqToggle = event.target.closest('[data-faq-toggle]');
      if(faqToggle){
        const item = faqToggle.closest('[data-faq-item]');
        const open = item?.classList.toggle('open');
        faqToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        return;
      }
      const action = event.target.closest('[data-action]');
      if(action){
        const id = action.dataset.id;
        if(action.dataset.action === 'cart') addToCart(id);
        if(action.dataset.action === 'wishlist') toggleWishlist(id);
        if(action.dataset.action === 'compare') toggleCompare(id);
        if(action.dataset.action === 'quick') quickView(id);
        return;
      }
      const plus = event.target.closest('[data-cart-plus]'); if(plus){ changeCart(plus.dataset.cartPlus,1); return; }
      const minus = event.target.closest('[data-cart-minus]'); if(minus){ changeCart(minus.dataset.cartMinus,-1); return; }
      const remove = event.target.closest('[data-cart-remove]'); if(remove){ removeCart(remove.dataset.cartRemove); return; }
      const adminEdit = event.target.closest('[data-admin-edit]'); if(adminEdit){ editProduct(adminEdit.dataset.adminEdit); return; }
      const adminDelete = event.target.closest('[data-admin-delete]'); if(adminDelete){ deleteProduct(adminDelete.dataset.adminDelete); return; }
      const selectAll = event.target.closest('[data-admin-select-all]'); if(selectAll){ $$('[data-admin-product-select]').forEach(input => { input.checked = selectAll.checked; }); return; }
      const bulkDelete = event.target.closest('[data-admin-bulk-delete]'); if(bulkDelete){ bulkDeleteProducts(); return; }
	      const metricAdd = event.target.closest('[data-hero-metric-add]'); if(metricAdd){ const root = $('#adminHeroMetrics'); if(root) root.insertAdjacentHTML('beforeend', heroMetricEditor({id:`metric-${Date.now()}`,value:'',label:'',enabled:true}, $$('[data-hero-metric-key]', root).length)); return; }
	      const metricDelete = event.target.closest('[data-hero-metric-delete]'); if(metricDelete){ metricDelete.closest('[data-hero-metric-key]')?.remove(); return; }
	      const goalAdd = event.target.closest('[data-goal-add]'); if(goalAdd){ const root = $('#adminGoalsList'); if(root) root.insertAdjacentHTML('beforeend', goalEditor({id:`goal-${Date.now()}`,title:'',text:'',href:'catalog.html',enabled:true}, $$('[data-goal-key]', root).length)); return; }
	      const goalDelete = event.target.closest('[data-goal-delete]'); if(goalDelete){ goalDelete.closest('[data-goal-key]')?.remove(); return; }
	      const brandImageClear = event.target.closest('[data-brand-image-clear]'); if(brandImageClear){ const block = brandImageClear.closest('[data-brand-image-key]'); const input = $('[data-brand-image-src]', block); if(input) input.value = ''; updateBrandImagePreview(block); return; }
	      const brandImageReset = event.target.closest('[data-brand-image-reset]'); if(brandImageReset){ resetBrandImageControls(brandImageReset.closest('[data-brand-image-key]')); return; }
	      const storeAdd = event.target.closest('[data-store-block-add]'); if(storeAdd){ const root = $('#adminStoreBlocks'); if(root) root.insertAdjacentHTML('beforeend', storeBlockEditor({id:`store-${Date.now()}`,title:'',text:'',enabled:true}, $$('[data-store-block-key]', root).length)); return; }
      const storeDelete = event.target.closest('[data-store-block-delete]'); if(storeDelete){ storeDelete.closest('[data-store-block-key]')?.remove(); return; }
      const pickupStoreAdd = event.target.closest('[data-pickup-store-add]'); if(pickupStoreAdd){ const root = $('#adminPickupStores'); if(root) root.insertAdjacentHTML('beforeend', pickupStoreEditor({id:`pickup-${Date.now()}`,title:'',address:'',note:'',enabled:true}, $$('[data-pickup-store-key]', root).length)); return; }
      const pickupStoreDelete = event.target.closest('[data-pickup-store-delete]'); if(pickupStoreDelete){ pickupStoreDelete.closest('[data-pickup-store-key]')?.remove(); return; }
      const deliveryMethodAdd = event.target.closest('[data-delivery-method-add]'); if(deliveryMethodAdd){ const root = $('#adminDeliveryList'); if(root) root.insertAdjacentHTML('beforeend', deliveryMethodEditor(`delivery-${Date.now()}`, {title:'',subtitle:'',enabled:true}, $$('[data-delivery-method-key]', root).length)); return; }
      const deliveryMethodDelete = event.target.closest('[data-delivery-method-delete]'); if(deliveryMethodDelete){ deliveryMethodDelete.closest('[data-delivery-method-key]')?.remove(); return; }
      const categoryAdd = event.target.closest('[data-category-add]'); if(categoryAdd){ const root = $('#adminCategoriesList'); if(root) root.insertAdjacentHTML('beforeend', categoryEditor({id:'',name:'',description:''}, $$('[data-category-key]', root).length)); return; }
      const categoryDelete = event.target.closest('[data-category-delete]'); if(categoryDelete){ categoryDelete.closest('[data-category-key]')?.remove(); return; }
      const faqAdd = event.target.closest('[data-faq-add]'); if(faqAdd){ const root = $('#adminFaqItems'); if(root) root.insertAdjacentHTML('beforeend', faqItemEditor({id:`faq-${Date.now()}`,question:'',answer:'',enabled:true}, $$('[data-faq-key]', root).length)); return; }
      const faqDelete = event.target.closest('[data-faq-delete]'); if(faqDelete){ faqDelete.closest('[data-faq-key]')?.remove(); return; }
      const aboutAdd = event.target.closest('[data-about-card-add]'); if(aboutAdd){ const root = $('#adminAboutCards'); if(root) root.insertAdjacentHTML('beforeend', contentItemEditor('about', {title:'',text:'',enabled:true}, $$('[data-content-item="about"]', root).length)); return; }
      const contentDelete = event.target.closest('[data-content-delete]'); if(contentDelete){ contentDelete.closest('[data-content-item]')?.remove(); return; }
      const footerBadgeAdd = event.target.closest('[data-footer-badge-add]'); if(footerBadgeAdd){ const root = $('#footerBadgesList'); if(root) root.insertAdjacentHTML('beforeend', footerBadgeEditor({enabled:true}, $$('[data-footer-badge-key]', root).length)); return; }
      const footerBadgeDelete = event.target.closest('[data-footer-badge-delete]'); if(footerBadgeDelete){ footerBadgeDelete.closest('[data-footer-badge-key]')?.remove(); return; }
      const orderDone = event.target.closest('[data-order-done]'); if(orderDone){ updateOrder(orderDone.dataset.orderDone,'completed'); return; }
      const orderDelete = event.target.closest('[data-order-delete]'); if(orderDelete){ deleteOrder(orderDelete.dataset.orderDelete); return; }
      const reviewEdit = event.target.closest('[data-review-edit]'); if(reviewEdit){ editReview(reviewEdit.dataset.reviewEdit); return; }
      const reviewApprove = event.target.closest('[data-review-approve]'); if(reviewApprove){ approveReview(reviewApprove.dataset.reviewApprove); return; }
      const reviewDelete = event.target.closest('[data-review-delete]'); if(reviewDelete){ deleteReview(reviewDelete.dataset.reviewDelete); return; }
      const tab = event.target.closest('[data-admin-tab]'); if(tab){ adminSwitch(tab.dataset.adminTab); return; }
      const reset = event.target.closest('[data-reset-all]'); if(reset){ resetAll(); return; }
      const exp = event.target.closest('[data-export]'); if(exp){ exportData(); return; }
      const logout = event.target.closest('[data-admin-logout]'); if(logout){ adminLogout(); return; }
    });
    document.addEventListener('submit', event => {
      if(event.target.matches('#reviewForm')){ submitReview(event); return; }
    });
	    document.addEventListener('change', event => {
	      if(event.target.matches('[data-footer-badge-upload]')){ readFooterBadgeFile(event.target); return; }
	      if(event.target.matches('[data-footer-badge-image]')) updateFooterBadgePreview(event.target.closest('[data-footer-badge-key]'));
	      if(event.target.matches('[data-brand-image-upload]')){ readBrandImageFile(event.target); return; }
	      if(event.target.matches('[data-brand-image-src],[data-brand-image-fit],[data-brand-image-x],[data-brand-image-y],[data-brand-image-scale]')) updateBrandImagePreview(event.target.closest('[data-brand-image-key]'));
	    });
    document.addEventListener('input', event => {
      if(event.target.matches('[data-brand-image-src],[data-brand-image-x],[data-brand-image-y],[data-brand-image-scale]')) updateBrandImagePreview(event.target.closest('[data-brand-image-key]'));
    });
    $('#deliveryOptions')?.addEventListener('change', handleDeliveryChange);
    $('#promoApply')?.addEventListener('click', applyPromo);
    $('#promoCode')?.addEventListener('input', updatePromoFromInput);
    $('#checkoutForm')?.addEventListener('submit', submitOrder);
    $('#adminLoginForm')?.addEventListener('submit', adminLogin);
    $('#adminProductForm')?.addEventListener('submit', saveProduct);
    $('#adminCategoriesForm')?.addEventListener('submit', saveAdminCategories);
    $('#adminProductReset')?.addEventListener('click', resetProductForm);
    $('#adminImageUpload')?.addEventListener('change', e=>readFileToHidden(e.target,'#adminImageData'));
    $('#siteHeroMediaUpload')?.addEventListener('change', e=>readFileToHidden(e.target,'#siteHeroMediaSrc'));
    $('#headerLogoImageUpload')?.addEventListener('change', e=>readFileToHidden(e.target,'#headerLogoImage'));
    $('#headerBrandImageUpload')?.addEventListener('change', e=>readFileToHidden(e.target,'#headerBrandImage'));
    $('#siteHeroMediaMode')?.addEventListener('change', updateHeroAdminControls);
    $('[data-hero-colors-reset]')?.addEventListener('click', resetHeroColors);
    $('[data-hero-video-default]')?.addEventListener('click', resetHeroDefaultVideo);
    $('#siteHeroOpacity')?.addEventListener('input', e=>{ const node = $('#heroOpacityValue'); if(node) node.textContent = `${Math.round(Number(e.target.value || 0) * 100)}%`; });
    $('#siteHeroVeil')?.addEventListener('input', e=>{ const node = $('#heroVeilValue'); if(node) node.textContent = `${Math.round(Number(e.target.value || 0) * 100)}%`; });
    $('#siteHeroOverlay')?.addEventListener('input', e=>{ const node = $('#heroOverlayValue'); if(node) node.textContent = `${Math.round(Number(e.target.value || 0) * 100)}%`; });
    $('#adminSiteForm')?.addEventListener('submit', saveAdminSite);
    $('#adminBrandsForm')?.addEventListener('submit', saveAdminBrands);
    $('#adminDeliveryForm')?.addEventListener('submit', saveAdminSite);
    $('#adminTelegramForm')?.addEventListener('submit', saveAdminTelegram);
    $('#adminStoresForm')?.addEventListener('submit', saveAdminStores);
    $('#adminHeaderForm')?.addEventListener('submit', saveAdminHeader);
    $('#adminFooterForm')?.addEventListener('submit', saveAdminFooter);
    $('#adminPagesForm')?.addEventListener('submit', saveAdminPages);
    $('#adminContentForm')?.addEventListener('submit', saveAdminContent);
    $('#adminFaqForm')?.addEventListener('submit', saveAdminFaq);
    $('#adminCartForm')?.addEventListener('submit', saveAdminCart);
    $('#adminReviewForm')?.addEventListener('submit', saveAdminReview);
    $('#adminReviewReset')?.addEventListener('click', resetReviewForm);
    $('#adminPasswordForm')?.addEventListener('submit', saveAdminPassword);
  }

  async function init(){
    await loadServerState();
    const page = document.body.dataset.page;
    if(page === 'admin' && isAdminSession()) await loadAdminState();
    setActiveNav(); applyHeader(); renderFooter(); applyPageHeader(); updateCounts(); bindGlobal();
    if(page === 'home') renderHome();
    if(page === 'catalog') renderCatalog();
    if(page === 'product') renderProduct();
    if(page === 'cart') renderCart();
    if(page === 'sale') renderSale();
    if(page === 'wishlist') renderWishlist();
    if(page === 'brands') renderBrands();
    if(page === 'compare') renderCompare();
    if(page === 'delivery') renderDeliveryPage();
    if(page === 'stores') renderStores();
    if(page === 'faq') renderFaq();
    if(page === 'about') renderAboutPage();
    if(page === 'admin') renderAdmin();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
