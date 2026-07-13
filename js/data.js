(function(){
  const placeholder = `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="900" viewBox="0 0 900 900"><rect width="900" height="900" rx="64" fill="#f6f6f1"/><circle cx="450" cy="382" r="168" fill="#e8f0e5"/><rect x="340" y="248" width="220" height="288" rx="34" fill="#2d5a27"/><path d="M382 319h136M382 384h136M382 449h92" stroke="#fff" stroke-width="24" stroke-linecap="round"/><text x="450" y="690" text-anchor="middle" font-family="Inter,Arial" font-size="78" font-weight="800" fill="#191a17">ByVit</text></svg>`)}`;

  window.ByVitDefaults = {
    categories: [
      {id:'protein', name:'Протеины', description:'Белок для набора, восстановления и ежедневного рациона.', subcategories:[{title:'Сывороточный',query:'сывороточный'},{title:'Изолят',query:'whey'},{title:'Растительный',query:'растительный'}]},
      {id:'creatine', name:'Креатин', description:'Сила, мощность и стабильный прогресс в базовых упражнениях.', subcategories:[{title:'Моногидрат',query:'моногидрат'},{title:'Сила',query:'сила'},{title:'Без вкуса',query:'без вкуса'}]},
      {id:'amino', name:'Аминокислоты', description:'BCAA, EAA и комплексы для восстановления.', subcategories:[{title:'BCAA',query:'BCAA'},{title:'EAA',query:'EAA'},{title:'Восстановление',query:'восстановление'}]},
      {id:'vitamins', name:'Витамины', description:'D3, K2, Omega-3 и ежедневная поддержка организма.', subcategories:[{title:'D3/K2',query:'D3'},{title:'Omega-3',query:'Omega'},{title:'Иммунитет',query:'иммунитет'}]},
      {id:'minerals', name:'Минералы', description:'Магний, цинк и поддержка нервной системы.', subcategories:[{title:'Магний',query:'магний'},{title:'Цинк',query:'цинк'},{title:'Нервная система',query:'нервной'}]},
      {id:'preworkout', name:'Предтрены', description:'Энергия, фокус и памп перед тренировкой.', subcategories:[{title:'Энергия',query:'энергия'},{title:'Фокус',query:'фокус'},{title:'Памп',query:'памп'}]},
      {id:'healthy-food', name:'Здоровые перекусы', description:'Батончики, снеки и продукты без лишней драмы.', subcategories:[{title:'Батончики',query:'батончик'},{title:'Без сахара',query:'сахара'},{title:'Перекус',query:'перекус'}]},
      {id:'joints', name:'Суставы и связки', description:'Коллаген и комплексы для опорно-двигательной системы.', subcategories:[{title:'Коллаген',query:'коллаген'},{title:'Связки',query:'связок'},{title:'Суставы',query:'суставов'}]},
      {id:'adaptogens', name:'Адаптогены', description:'Тонус, стрессоустойчивость и восстановление.', subcategories:[{title:'Ашваганда',query:'Ashwagandha'},{title:'Стресс',query:'стресс'},{title:'Тонус',query:'тонус'}]},
      {id:'accessories', name:'Аксессуары', description:'Шейкеры, бутылки и полезные мелочи.', subcategories:[{title:'Шейкеры',query:'шейкер'},{title:'Бутылки',query:'бутылка'}]}
    ],
    products: [
      {id:1,name:'100% Whey Protein',brand:'Optimum Nutrition',category:'protein',price:129,oldPrice:149,stock:15,badge:'Хит',country:'США',formType:'powder',popular:true,rating:4.9,images:['assets/product-whey.jpg'],flavors:['Шоколад','Ваниль','Клубника'],packageOptions:[{id:'900g',label:'900 г',price:129},{id:'2270g',label:'2.27 кг',price:249}],shortDescription:'Сывороточный протеин для роста мышц и быстрого восстановления.',description:'Премиальный сывороточный протеин для ежедневного добора белка, восстановления после тренировок и поддержки мышечной массы.',usage:'1 порция на 250–300 мл воды или молока после тренировки либо между приемами пищи.',ingredients:'Whey Protein Isolate, Whey Protein Concentrate, какао, ароматизатор, подсластитель.'},
      {id:2,name:'Creatine Monohydrate',brand:'Kevin Levrone',category:'creatine',price:69,stock:28,badge:'Топ',country:'Польша',formType:'powder',popular:true,rating:4.8,images:['assets/product-creatine.jpg'],flavors:['Без вкуса'],packageOptions:[{id:'300g',label:'300 г',price:69},{id:'500g',label:'500 г',price:99}],shortDescription:'Креатин для силы, мощности и прогресса в тренировках.',description:'Чистый креатин моногидрат для роста силовых показателей, взрывной мощности и качества тренировочного объема.',usage:'5 г ежедневно. В тренировочные дни можно принимать после тренировки.',ingredients:'100% Creatine Monohydrate.'},
      {id:3,name:'BCAA 2:1:1',brand:'Mutant',category:'amino',price:75,oldPrice:89,stock:11,badge:'-15%',country:'Канада',formType:'powder',popular:false,rating:4.6,images:['assets/product-bcaa.jpg'],flavors:['Апельсин','Лимон','Ягоды'],packageOptions:[{id:'250g',label:'250 г',price:75},{id:'500g',label:'500 г',price:119}],shortDescription:'Аминокислоты для восстановления после нагрузок.',description:'Комплекс незаменимых аминокислот BCAA в классическом соотношении 2:1:1 для поддержки восстановления.',usage:'10 г до, во время или после тренировки.',ingredients:'L-Leucine, L-Isoleucine, L-Valine, ароматизатор, подсластитель.'},
      {id:4,name:'Ultra Omega-3 EPA/DHA',brand:'NOW Foods',category:'vitamins',price:79,stock:18,badge:'Бестселлер',country:'США',formType:'capsules',popular:true,rating:4.9,images:['assets/product-omega.jpg'],flavors:[],packageOptions:[{id:'90caps',label:'90 капсул',price:79},{id:'180caps',label:'180 капсул',price:139}],shortDescription:'Концентрированный источник EPA и DHA для сердца, мозга и восстановления.',description:'Омега‑3 жирные кислоты в удобных капсулах для поддержки сердечно‑сосудистой системы, когнитивных функций и общего самочувствия.',usage:'1–2 капсулы в день во время еды.',ingredients:'Fish Oil Concentrate, EPA, DHA, gelatin capsule.'},
      {id:5,name:'Magnesium Taurate',brand:'Natural Supp',category:'minerals',price:46.9,stock:7,badge:'Новый',country:'Польша',formType:'capsules',popular:false,rating:4.7,images:['assets/product-magnesium.jpg'],flavors:[],packageOptions:[{id:'60caps',label:'60 капсул',price:46.9}],shortDescription:'Магний в форме таурата для нервной системы и восстановления.',description:'Минеральная добавка для поддержки расслабления, сна, работы нервной системы и восстановления после нагрузок.',usage:'1–2 капсулы в день во время еды.',ingredients:'Magnesium Taurate, capsule shell.'},
      {id:6,name:'Vitamin D3 + K2',brand:'Life Extension',category:'vitamins',price:55,stock:22,badge:'Сезонный',country:'США',formType:'capsules',popular:true,rating:4.8,images:['assets/product-vitamind.jpg'],flavors:[],packageOptions:[{id:'60caps',label:'60 капсул',price:55},{id:'120caps',label:'120 капсул',price:89}],shortDescription:'Поддержка иммунитета, костей и нормального уровня витамина D.',description:'Комбинация витаминов D3 и K2 для поддержки иммунной системы, костей и минерального обмена.',usage:'1 капсула в день во время еды.',ingredients:'Vitamin D3, Vitamin K2, MCT oil, capsule shell.'},
      {id:7,name:'Collagen Joint Complex',brand:'Nutrend',category:'joints',price:92,oldPrice:108,stock:5,badge:'-15%',country:'Чехия',formType:'powder',popular:true,rating:4.6,images:['assets/product-collagen.jpg'],flavors:['Апельсин','Лесные ягоды'],packageOptions:[{id:'400g',label:'400 г',price:92}],shortDescription:'Коллагеновый комплекс для суставов, связок и восстановления.',description:'Комплекс коллагена, витамина C и минералов для поддержки суставов, связок, кожи и восстановления после нагрузок.',usage:'1 порция в день, растворить в воде.',ingredients:'Collagen peptides, Vitamin C, Magnesium, Zinc, flavor.'},
      {id:8,name:'PreWorkout Focus',brand:'ReckFul',category:'preworkout',price:86,stock:9,badge:'Energy',country:'Беларусь',formType:'powder',popular:false,rating:4.5,images:['assets/product-preworkout.jpg'],flavors:['Манго','Кола','Арбуз'],packageOptions:[{id:'300g',label:'300 г',price:86},{id:'sample',label:'Пробник 10 г',price:6}],shortDescription:'Предтренировочный комплекс для энергии, фокуса и пампа.',description:'Формула с кофеином, цитруллином и бета‑аланином для интенсивных тренировок и концентрации.',usage:'1 порция за 20–30 минут до тренировки. Не принимать поздно вечером.',ingredients:'Citrulline Malate, Beta-Alanine, Caffeine, Taurine, flavor.'},
      {id:9,name:'Protein Bar Dubai',brand:'Bombbar',category:'healthy-food',price:5,stock:40,badge:'Snack',country:'Россия',formType:'bar',popular:true,rating:4.4,images:['assets/product-plant.jpg'],flavors:['Малина-фисташка','Ореховый раф','Шоколад'],packageOptions:[{id:'45g',label:'45 г',price:5},{id:'box12',label:'Коробка 12 шт.',price:54}],shortDescription:'Белковый батончик для перекуса без лишнего сахара.',description:'Удобный протеиновый батончик для перекуса, дороги, офиса и быстрого добора белка.',usage:'1 батончик как перекус между приемами пищи.',ingredients:'Milk protein, fiber, cocoa, nuts, sweetener, flavor.'},
      {id:10,name:'Vegan Plant Protein',brand:'Applied Nutrition',category:'protein',price:102,oldPrice:120,stock:13,badge:'Vegan',country:'Великобритания',formType:'powder',popular:false,rating:4.5,images:['assets/product-plant.jpg'],flavors:['Ваниль','Какао'],packageOptions:[{id:'900g',label:'900 г',price:102}],shortDescription:'Растительный белок без молочных компонентов.',description:'Гороховый и рисовый протеин для людей, которым не подходит сыворотка.',usage:'1 порция после тренировки или между приемами пищи.',ingredients:'Pea Protein, Rice Protein, flavor, sweetener.'},
      {id:11,name:'Steel Shaker 700 ml',brand:'ByVit Gear',category:'accessories',price:23,stock:16,badge:'Gear',country:'Китай',formType:'accessory',popular:false,rating:4.3,images:[placeholder],flavors:[],packageOptions:[{id:'700ml',label:'700 мл',price:23}],shortDescription:'Шейкер с сеткой для протеина, аминокислот и предтренов.',description:'Практичный шейкер для смешивания спортивного питания без комков.',usage:'Добавьте жидкость, затем порошок, закройте крышку и встряхните.',ingredients:'Пищевой пластик, сетка, герметичная крышка.'},
      {id:12,name:'Ashwagandha 450 mg',brand:'Swanson',category:'adaptogens',price:60,stock:12,badge:'Balance',country:'США',formType:'capsules',popular:true,rating:4.7,images:[placeholder],flavors:[],packageOptions:[{id:'100caps',label:'100 капсул',price:60}],shortDescription:'Адаптоген для устойчивости к стрессу и общего тонуса.',description:'Растительная добавка для поддержки спокойствия, восстановления и адаптации к нагрузкам.',usage:'1 капсула 1–2 раза в день во время еды.',ingredients:'Ashwagandha root powder, capsule shell.'}
    ],
    reviews: [
      {id:1,productId:1,name:'Алексей',rating:5,text:'Быстрая доставка, нормальная упаковка, товар соответствует описанию.',status:'approved',date:'08.07.2026'}
    ],
    site: {
      header:{
        storeName:'ByVit',
        logoText:'BV',
        logoImage:'assets/favicon.svg',
        brandImage:'',
        topRight:'BYVIT / STORE / 2026',
        searchPlaceholder:'Поиск товара',
        adminLabel:'Админ',
        nav:[
          {text:'Главная',href:'index.html',enabled:true},
          {text:'Каталог',href:'catalog.html',enabled:true},
          {text:'Бренды',href:'brands.html',enabled:true},
          {text:'Акции',href:'sale.html',enabled:true},
          {text:'Доставка',href:'delivery.html',enabled:true},
          {text:'Магазины',href:'stores.html',enabled:true},
          {text:'О нас',href:'about.html',enabled:true},
          {text:'FAQ',href:'faq.html',enabled:true}
        ]
      },
      heroEyebrow:'Premium supplements',
      heroTitle:'Премиальное питание для тела, которое работает',
      heroText:'ByVit собирает спортпит, витамины и добавки без визуального шума: только оригинальные бренды, понятная карточка товара и быстрый заказ.',
      heroTitleSize:44,
      heroTextSize:16,
      heroAlign:'right',
      heroMediaMode:'video',
      heroMediaSrc:'assets/hero-video.mp4',
      heroAnimation:'waves',
      heroEyebrowColor:'#2d5a27',
      heroTitleColor:'#191a17',
      heroTextColor:'#3f423d',
      heroMediaOpacity:0.78,
      heroVeilOpacity:1,
      heroOverlayOpacity:0.18,
      heroMetrics:[
        {id:'categories',value:'12+',label:'категорий',enabled:true},
        {id:'delivery',value:'4',label:'способа доставки',enabled:true},
        {id:'discount',value:'10%',label:'WELCOME скидка',enabled:true}
      ],
      typographyVersion:2,
      announcement:'Оригинальные бренды · самовывоз · доставка · Европочта',
      pickupAddress:'Минск, ул. Примерная 12, шоурум ByVit',
      phone:'+375 29 000-00-00',
      pickupStores:[
        {id:'main',title:'Шоурум ByVit',address:'Минск, ул. Примерная 12, шоурум ByVit',note:'10:00-20:00',enabled:true}
      ],
      storeBlocks:[
        {id:'showroom',title:'Шоурум ByVit',text:'Минск, ул. Примерная 12, шоурум ByVit\nТелефон: +375 29 000-00-00\nГрафик: 10:00–20:00',enabled:true},
        {id:'pickup',title:'Самовывоз',text:'Выберите самовывоз в корзине и дождитесь подтверждения заказа.',enabled:true},
        {id:'delivery',title:'Доставка',text:'Курьер, Европочта или почта. Без лишних шагов.',enabled:true}
      ],
      map:{enabled:true,provider:'yandex',embedUrl:'https://yandex.by/map-widget/v1/?ll=27.624022%2C53.964443&z=16&mode=search&ol=biz&oid=245505157299',placeholder:'Map placeholder / подключите карту в админке'},
      faqItems:[
        {id:'order',question:'Как оформить заказ?',answer:'Добавьте товары в корзину, выберите способ получения и оставьте контактные данные. После отправки заказа магазин свяжется для подтверждения.',enabled:true},
        {id:'delivery',question:'Какие способы доставки доступны?',answer:'Доступные способы редактируются в админке. По умолчанию можно включать самовывоз, курьера, Европочту и почту.',enabled:true},
        {id:'original',question:'Товары оригинальные?',answer:'В карточках можно указывать бренд, страну, состав, фасовку и наличие. Это помогает покупателю быстро проверить товар перед заказом.',enabled:true}
      ],
      aboutPage:{
        eyebrow:'ByVit',
        title:'Магазин добавок без лишнего шума',
        text:'ByVit собирает спортивное питание, витамины и БАДы в спокойный каталог: понятные карточки, честное наличие, быстрый заказ и редактируемая админка для команды.',
        missionTitle:'Наша задача',
        missionText:'Помогать покупателю быстро понять, что перед ним: бренд, форма выпуска, состав, фасовка, наличие и сценарий применения. Дизайн не спорит с товаром, а помогает выбрать.',
        cards:[
          {id:'brands',title:'Оригинальные бренды',text:'В карточках есть место для страны, производителя, состава и подробного описания.',enabled:true},
          {id:'order',title:'Понятный заказ',text:'Корзина, способы получения, промокоды и Telegram-уведомления собраны в один сценарий.',enabled:true},
          {id:'admin',title:'Живая витрина',text:'Товары, страницы, FAQ, карта, доставка и футер редактируются через админку.',enabled:true}
        ],
        legalTitle:'Реквизиты и контакты',
        legalText:'Здесь можно указать юридическое лицо, УНП, адрес регистрации, email, телефоны и условия работы магазина.'
      },
      telegram:{mode:'bot',contact:'',botToken:'',chatId:''},
	      footer:{
        description:'Спортивное питание и БАДы в строгом минималистичном интерфейсе.',
        copyright:'© 2026 ByVit. Demo static e-commerce.',
        techText:'HTML / CSS / JS',
        contacts:{
          instagram:'',
          telegram:'',
          email:'info@byvit.by',
          phones:['+375 29 000-00-00'],
          extra:[
            {id:'viber',label:'Viber',type:'viber',value:'+375 29 000-00-00',href:'',enabled:true},
            {id:'whatsapp',label:'WhatsApp',type:'whatsapp',value:'+375 29 000-00-00',href:'',enabled:true}
          ]
        },
        badges:[
          {id:'webpay',text:'✦ webpay',href:'',enabled:true},
          {id:'visa',text:'VISA',href:'',enabled:true},
          {id:'visa-secure',text:'VISA Secure',href:'',enabled:true},
          {id:'mastercard',text:'●● Mastercard',href:'',enabled:true},
          {id:'secure-code',text:'Mastercard SecureCode',href:'',enabled:true},
          {id:'belkart',text:'⬢ белкарт',href:'',enabled:true},
          {id:'erip',text:'≫ ерип',href:'',enabled:true}
        ],
        columns:[
          {title:'Магазин',links:[{text:'Каталог',href:'catalog.html'},{text:'Бренды',href:'brands.html'},{text:'Акции',href:'sale.html'},{text:'О нас',href:'about.html'}]},
          {title:'Клиенту',links:[{text:'Доставка',href:'delivery.html'},{text:'Магазины',href:'stores.html'},{text:'FAQ',href:'faq.html'}]},
          {title:'Сервис',links:[{text:'Избранное',href:'wishlist.html'},{text:'Сравнение',href:'compare.html'},{text:'Корзина',href:'cart.html'}]}
        ]
	      },
	      goals:[
	        {id:'mass',title:'Набор массы',text:'Протеин, гейнеры, креатин и калорийные перекусы.',href:'catalog.html?category=protein',enabled:true},
	        {id:'strength',title:'Сила и выносливость',text:'Креатин, аминокислоты и предтренировочные комплексы.',href:'catalog.html?category=creatine',enabled:true},
	        {id:'recovery',title:'Восстановление',text:'BCAA, EAA, омега-3, магний и поддержка сна.',href:'catalog.html?category=amino',enabled:true},
	        {id:'joints',title:'Суставы и связки',text:'Коллаген и комплексы для опорно-двигательной системы.',href:'catalog.html?category=joints',enabled:true},
	        {id:'immunity',title:'Иммунитет',text:'D3, K2, омега-3 и ежедневные витаминные комплексы.',href:'catalog.html?category=vitamins',enabled:true},
	        {id:'energy',title:'Энергия и фокус',text:'Предтрены, адаптогены и добавки для тонуса.',href:'catalog.html?category=preworkout',enabled:true}
	      ],
	      pageHeaders:{
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
      },
      promos:[
        {code:'WELCOME',type:'percent',value:10,enabled:true},
        {code:'BYVIT10',type:'percent',value:10,enabled:true}
      ],
      checkout:{
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
      },
		      homeBlocks:{
		        categories:{visible:true,order:2,eyebrow:'Категории',title:'Быстрый вход в нужный раздел',text:'Разделы каталога помогают быстро перейти к нужному типу спортивного питания.',titleSize:36,textSize:15,buttonText:'Весь каталог',buttonUrl:'catalog.html'},
		        goals:{visible:true,order:3,eyebrow:'Цели',title:'Выбери свою цель',text:'Если не знаешь название добавки, начни с задачи: масса, восстановление, сон, суставы или иммунитет.',titleSize:36,textSize:15,buttonText:'Открыть каталог',buttonUrl:'catalog.html'},
		        featured:{visible:true,order:4,eyebrow:'Популярное',title:'Товары, которые покупают чаще',text:'Чистые карточки, нормальная типографика и понятные действия.',titleSize:36,textSize:15,buttonText:'Открыть каталог',buttonUrl:'catalog.html?sort=popular'},
	        service:{visible:true,order:5,eyebrow:'Сервис',title:'Магазин без лишнего шума',text:'Заказ, доставка и контроль товара собраны в понятный сценарий.',titleSize:36,textSize:15,featureOneTitle:'Быстрый заказ',featureOneText:'Корзина, промокод, доставка и Telegram-уведомление через бота.',featureTwoTitle:'Контроль товара',featureTwoText:'Остатки, скидки, фасовки, вкусы, страна производства и админка.'},
	        brands:{visible:true,order:6,eyebrow:'Бренды',title:'Оригинальные производители',text:'Быстрый выбор по брендам, которым доверяют покупатели.',titleSize:36,textSize:15,buttonText:'Все бренды',buttonUrl:'brands.html'},
	        sale:{visible:true,order:1,eyebrow:'Акции',title:'Скидки и спецпредложения',text:'Товары со старой ценой и актуальными промо-предложениями.',titleSize:36,textSize:15,buttonText:'Все акции',buttonUrl:'sale.html'}
	      },
	      brandImages:{},
	      deliveryMethods:{
        pickup:{enabled:true,title:'Самовывоз',subtitle:'из магазина ByVit'},
        delivery:{enabled:true,title:'Курьер',subtitle:'по городу'},
        europost:{enabled:true,title:'Европочта',subtitle:'по Беларуси'},
        post:{enabled:true,title:'Почта',subtitle:'по тарифу оператора'}
      }
    }
  };
})();
