(function (global) {
  'use strict';

  var Startuem = global.Startuem = global.Startuem || {};

  var VOICE_SLOTS = [
    {
      id: 'startuem',
      file: 'startuem.mp3',
      keywords: ['start', 'старт', 'стартуем'],
      text: 'Я сказала — стартуем!'
    },
    {
      id: 'jeep_moscow',
      file: 'jeep_moscow.mp3',
      keywords: ['jeep', 'джип', 'москв'],
      text: 'У меня джип в Москве!'
    },
    {
      id: 'rubl',
      file: 'rubl.mp3',
      keywords: ['rubl', 'рубл', 'дорог'],
      text: 'Простите, а у вас не будет одного рубля на дорогу?'
    },
    {
      id: 'zarul',
      file: 'zarul.mp3',
      keywords: ['zarul', 'руль', 'вылет'],
      text: 'Я сейчас сяду за руль, а ты вылетишь отсюда!'
    },
    {
      id: 'posidi',
      file: 'posidi.mp3',
      keywords: ['posidi', 'посид', 'друж'],
      text: 'Да ладно, посиди, дружок. До поры до времени.'
    },
    {
      id: 'vdoh_vydoh',
      file: 'vdoh_vydoh.mp3',
      keywords: ['vdoh', 'вдох', 'выдох', 'отжал'],
      text: 'Вдох-выдох, упал-отжался!'
    },
    {
      id: 'kulturny_gorod',
      file: 'kulturny_gorod.mp3',
      keywords: ['kultur', 'культур', 'город'],
      text: 'Так он в Москве, а я в другом культурном городе!'
    },
    {
      id: 'morskaya_pehota',
      file: 'morskaya_pehota.mp3',
      keywords: ['pehota', 'морск', 'пехот', 'натал'],
      text: 'Наталья — морская пехота!'
    },
    {
      id: 'sdelayu',
      file: 'sdelayu.mp3',
      keywords: ['sdelayu', 'сдела'],
      text: 'Ну я тебя сейчас сделаю здесь!'
    },
    {
      id: 'strelyat',
      file: 'strelyat.mp3',
      keywords: ['strel', 'стрел', 'пояс'],
      text: 'Если я начну стрелять — отстрелю то, что ниже пояса!'
    },
    {
      id: 'pass_jeep',
      file: 'pass_jeep.mp3',
      keywords: ['pass_jeep', 'у вас же'],
      text: 'Пассажир: «У вас же джип в Москве!»'
    }
  ];

  var P1_ACTIONS = {
    cultural: {
      id: 'cultural',
      key: '1',
      label: 'В ДРУГОМ КУЛЬТУРНОМ ГОРОДЕ!',
      quote: '«Так он в Москве, а я в другом культурном городе!»',
      gesture: 'point',
      slotId: 'kulturny_gorod',
      color: '#00e5ff'
    },
    ruble: {
      id: 'ruble',
      key: '2',
      label: 'ПО РУБЛЮ НА ДОРОГУ!',
      quote: '«Простите, а у вас не будет одного рубля на дорогу?»',
      gesture: 'palm',
      slotId: 'rubl',
      color: '#39ff14'
    },
    wheel: {
      id: 'wheel',
      key: '3',
      label: 'СЯДУ ЗА РУЛЬ — ВЫЛЕТИШЬ!',
      quote: '«Я сейчас сяду за руль, а ты вылетишь отсюда!»',
      gesture: 'slam',
      slotId: 'zarul',
      color: '#ff2a3c'
    },
    breathe: {
      id: 'breathe',
      key: '4',
      label: 'ПОСИДИ, ДРУЖОК! / ВДОХ-ВЫДОХ!',
      quote: '«Вдох-выдох, упал-отжался! Посиди, дружок!»',
      gesture: 'salute',
      slotId: 'vdoh_vydoh',
      color: '#f5b800'
    }
  };

  var P1_ENCOUNTERS = [
    {
      zone: 0,
      speaker: 'Парень с телефоном',
      prompt: '«У вас же джип в Москве!»',
      expectedAction: 'cultural',
      introSlotId: 'pass_jeep'
    },
    {
      zone: 0,
      speaker: 'Пассажир у окна',
      prompt: '«Мелочи нет, проезд не оплачу!»',
      expectedAction: 'ruble'
    },
    {
      zone: 1,
      speaker: 'Кондукторша',
      prompt: '«Женщина, за проезд передаём, не шумите!»',
      expectedAction: 'ruble'
    },
    {
      zone: 1,
      speaker: 'Кондукторша',
      prompt: '«Прекратите командовать, полицию вызову!»',
      expectedAction: 'breathe'
    },
    {
      zone: 2,
      speaker: 'Водитель',
      prompt: '«Автобус дальше не идёт! Выходите из салона!»',
      expectedAction: 'wheel'
    },
    {
      zone: 2,
      speaker: 'Водитель',
      prompt: '«Чё стоим-то, график горит?!»',
      expectedAction: 'breathe'
    }
  ];

  var P2_QUOTES = {
    shockwave: [
      { text: '«Я СКАЗАЛА — СТАРТУЕМ!»', slotId: 'startuem' },
      { text: '«НАТАЛЬЯ — МОРСКАЯ ПЕХОТА!»', slotId: 'morskaya_pehota' },
      { text: '«НУ Я ТЕБЯ ЩАС СДЕЛАЮ ЗДЕСЬ!»', slotId: 'sdelayu' }
    ],
    ram_cop: [
      { text: '«ДА ЛАДНО, ПОСИДИ, ДРУЖОК!»', slotId: 'posidi' },
      { text: '«ВДОХ-ВЫДОХ, УПАЛ-ОТЖАЛСЯ!»', slotId: 'vdoh_vydoh' },
      { text: '«ЕСЛИ Я НАЧНУ СТРЕЛЯТЬ…»', slotId: 'strelyat' },
      { text: '«НУ Я ТЕБЯ ЩАС СДЕЛАЮ ЗДЕСЬ!»', slotId: 'sdelayu' }
    ],
    jeep_pickup: [
      { text: '«У МЕНЯ ДЖИП В МОСКВЕ!»', slotId: 'jeep_moscow' }
    ],
    trip_start: [
      { text: '«А Я В ДРУГОМ КУЛЬТУРНОМ ГОРОДЕ!»', slotId: 'kulturny_gorod' },
      { text: '«ЕСЛИ Я НАЧНУ СТРЕЛЯТЬ…»', slotId: 'strelyat' }
    ],
    low_hp: [
      { text: '«Я ЩАС СЯДУ ЗА РУЛЬ, А ТЫ ВЫЛЕТИШЬ!»', slotId: 'zarul' },
      { text: '«ЕСЛИ Я НАЧНУ СТРЕЛЯТЬ…»', slotId: 'strelyat' }
    ],
    busted: [
      { text: '«ПОСИДИ, ДРУЖОК. ДО ПОРЫ ДО ВРЕМЕНИ…»', slotId: 'posidi' }
    ],
    ruble_pickup: [
      { text: '«А У ВАС НЕ БУДЕТ ОДНОГО РУБЛЯ НА ДОРОГУ?»', slotId: 'rubl' }
    ]
  };

  var RANKS = [
    { minScore: 0, title: 'Пассажир без рубля' },
    { minScore: 1500, title: 'Гроза 24-го маршрута' },
    { minScore: 4500, title: 'Командир Джипа в Москве' },
    { minScore: 9000, title: 'ЛЕГЕНДА МОРСКОЙ ПЕХОТЫ (2013)' }
  ];

  function getRank(score) {
    var chosen = RANKS[0].title;
    for (var i = 0; i < RANKS.length; i++) {
      if (score >= RANKS[i].minScore) {
        chosen = RANKS[i].title;
      }
    }
    return chosen;
  }

  function pickQuote(category) {
    var list = P2_QUOTES[category];
    if (!list || !list.length) return null;
    return list[Math.floor(Math.random() * list.length)];
  }

  Startuem.QUOTES = {
    VOICE_SLOTS: VOICE_SLOTS,
    P1_ACTIONS: P1_ACTIONS,
    P1_ENCOUNTERS: P1_ENCOUNTERS,
    P2_QUOTES: P2_QUOTES,
    RANKS: RANKS,
    getRank: getRank,
    pickQuote: pickQuote
  };
})(window);
