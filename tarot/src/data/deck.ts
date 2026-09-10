export type Arcana = "major" | "minor";
export type Suit = "wands" | "cups" | "swords" | "pentacles";

export type DeckCard = {
  id: string;
  nameZh: string;
  nameEn: string;
  arcana: Arcana;
  suit?: Suit;
  number?: number;
  keywords: string[];
  upright: string;
  reversed: string;
};

export const TAROT_DECK: DeckCard[] = [
  {
    "id": "major_00",
    "nameZh": "愚者",
    "nameEn": "The Fool",
    "arcana": "major",
    "number": 0,
    "keywords": [
      "开始",
      "跃入"
    ],
    "upright": "新旅程与开放心态",
    "reversed": "莽撞或犹豫不决"
  },
  {
    "id": "major_01",
    "nameZh": "魔术师",
    "nameEn": "The Magician",
    "arcana": "major",
    "number": 1,
    "keywords": [
      "意志",
      "显化"
    ],
    "upright": "资源在手，可以行动",
    "reversed": "分散或操控"
  },
  {
    "id": "major_02",
    "nameZh": "女祭司",
    "nameEn": "The High Priestess",
    "arcana": "major",
    "number": 2,
    "keywords": [
      "直觉",
      "静默"
    ],
    "upright": "向内倾听未知",
    "reversed": "秘密或封闭"
  },
  {
    "id": "major_03",
    "nameZh": "女皇",
    "nameEn": "The Empress",
    "arcana": "major",
    "number": 3,
    "keywords": [
      "丰盛",
      "滋养"
    ],
    "upright": "创造与关怀生长",
    "reversed": "依赖或停滞"
  },
  {
    "id": "major_04",
    "nameZh": "皇帝",
    "nameEn": "The Emperor",
    "arcana": "major",
    "number": 4,
    "keywords": [
      "秩序",
      "边界"
    ],
    "upright": "结构与稳定的力量",
    "reversed": "僵化或控制欲"
  },
  {
    "id": "major_05",
    "nameZh": "教皇",
    "nameEn": "The Hierophant",
    "arcana": "major",
    "number": 5,
    "keywords": [
      "传统",
      "指引"
    ],
    "upright": "学习既有智慧",
    "reversed": "盲从或教条"
  },
  {
    "id": "major_06",
    "nameZh": "恋人",
    "nameEn": "The Lovers",
    "arcana": "major",
    "number": 6,
    "keywords": [
      "选择",
      "联结"
    ],
    "upright": "价值观对齐的选择",
    "reversed": "摇摆或错配"
  },
  {
    "id": "major_07",
    "nameZh": "战车",
    "nameEn": "The Chariot",
    "arcana": "major",
    "number": 7,
    "keywords": [
      "推进",
      "意志"
    ],
    "upright": "聚焦前进",
    "reversed": "失控或对立内耗"
  },
  {
    "id": "major_08",
    "nameZh": "力量",
    "nameEn": "Strength",
    "arcana": "major",
    "number": 8,
    "keywords": [
      "柔软",
      "勇气"
    ],
    "upright": "以柔克刚的勇气",
    "reversed": "自我怀疑"
  },
  {
    "id": "major_09",
    "nameZh": "隐者",
    "nameEn": "The Hermit",
    "arcana": "major",
    "number": 9,
    "keywords": [
      "独处",
      "求索"
    ],
    "upright": "需要静思与明灯",
    "reversed": "孤立或逃避"
  },
  {
    "id": "major_10",
    "nameZh": "命运之轮",
    "nameEn": "Wheel of Fortune",
    "arcana": "major",
    "number": 10,
    "keywords": [
      "转折",
      "周期"
    ],
    "upright": "转机正在发生",
    "reversed": "抗拒变化"
  },
  {
    "id": "major_11",
    "nameZh": "正义",
    "nameEn": "Justice",
    "arcana": "major",
    "number": 11,
    "keywords": [
      "公平",
      "因果"
    ],
    "upright": "诚实面对因果",
    "reversed": "偏颇或推责"
  },
  {
    "id": "major_12",
    "nameZh": "倒吊人",
    "nameEn": "The Hanged Man",
    "arcana": "major",
    "number": 12,
    "keywords": [
      "暂停",
      "换视角"
    ],
    "upright": "停下以看见新角度",
    "reversed": "无谓牺牲"
  },
  {
    "id": "major_13",
    "nameZh": "死神",
    "nameEn": "Death",
    "arcana": "major",
    "number": 13,
    "keywords": [
      "结束",
      "更生"
    ],
    "upright": "旧阶段落幕，腾出空间",
    "reversed": "抗拒结束"
  },
  {
    "id": "major_14",
    "nameZh": "节制",
    "nameEn": "Temperance",
    "arcana": "major",
    "number": 14,
    "keywords": [
      "调和",
      "节奏"
    ],
    "upright": "平衡与耐心融合",
    "reversed": "失衡或极端"
  },
  {
    "id": "major_15",
    "nameZh": "恶魔",
    "nameEn": "The Devil",
    "arcana": "major",
    "number": 15,
    "keywords": [
      "束缚",
      "欲望"
    ],
    "upright": "看见成瘾与依附",
    "reversed": "沉溺其中"
  },
  {
    "id": "major_16",
    "nameZh": "塔",
    "nameEn": "The Tower",
    "arcana": "major",
    "number": 16,
    "keywords": [
      "崩解",
      "启示"
    ],
    "upright": "幻象被打破",
    "reversed": "余震与混乱"
  },
  {
    "id": "major_17",
    "nameZh": "星星",
    "nameEn": "The Star",
    "arcana": "major",
    "number": 17,
    "keywords": [
      "希望",
      "疗愈"
    ],
    "upright": "信任与平静的指引",
    "reversed": "失望或缥缈"
  },
  {
    "id": "major_18",
    "nameZh": "月亮",
    "nameEn": "The Moon",
    "arcana": "major",
    "number": 18,
    "keywords": [
      "迷雾",
      "潜意识"
    ],
    "upright": "情绪与梦境需辨认",
    "reversed": "恐惧放大"
  },
  {
    "id": "major_19",
    "nameZh": "太阳",
    "nameEn": "The Sun",
    "arcana": "major",
    "number": 19,
    "keywords": [
      "清明",
      "活力"
    ],
    "upright": "清晰与温暖到来",
    "reversed": "短暂眩光"
  },
  {
    "id": "major_20",
    "nameZh": "审判",
    "nameEn": "Judgement",
    "arcana": "major",
    "number": 20,
    "keywords": [
      "唤醒",
      "召唤"
    ],
    "upright": "回应内在召唤",
    "reversed": "自我苛责"
  },
  {
    "id": "major_21",
    "nameZh": "世界",
    "nameEn": "The World",
    "arcana": "major",
    "number": 21,
    "keywords": [
      "完成",
      "整合"
    ],
    "upright": "圆满与整合",
    "reversed": "尚未合拢的缺口"
  },
  {
    "id": "wands_ace",
    "nameZh": "权杖一",
    "nameEn": "Ace of Wands",
    "arcana": "minor",
    "suit": "wands",
    "number": 1,
    "keywords": [
      "权杖",
      "Ace"
    ],
    "upright": "权杖一正位：关注当下行动与处境的平衡",
    "reversed": "权杖一逆位：需要调整节奏或视角"
  },
  {
    "id": "wands_two",
    "nameZh": "权杖二",
    "nameEn": "Two of Wands",
    "arcana": "minor",
    "suit": "wands",
    "number": 2,
    "keywords": [
      "权杖",
      "Two"
    ],
    "upright": "权杖二正位：关注当下行动与处境的平衡",
    "reversed": "权杖二逆位：需要调整节奏或视角"
  },
  {
    "id": "wands_three",
    "nameZh": "权杖三",
    "nameEn": "Three of Wands",
    "arcana": "minor",
    "suit": "wands",
    "number": 3,
    "keywords": [
      "权杖",
      "Three"
    ],
    "upright": "权杖三正位：关注当下行动与处境的平衡",
    "reversed": "权杖三逆位：需要调整节奏或视角"
  },
  {
    "id": "wands_four",
    "nameZh": "权杖四",
    "nameEn": "Four of Wands",
    "arcana": "minor",
    "suit": "wands",
    "number": 4,
    "keywords": [
      "权杖",
      "Four"
    ],
    "upright": "权杖四正位：关注当下行动与处境的平衡",
    "reversed": "权杖四逆位：需要调整节奏或视角"
  },
  {
    "id": "wands_five",
    "nameZh": "权杖五",
    "nameEn": "Five of Wands",
    "arcana": "minor",
    "suit": "wands",
    "number": 5,
    "keywords": [
      "权杖",
      "Five"
    ],
    "upright": "权杖五正位：关注当下行动与处境的平衡",
    "reversed": "权杖五逆位：需要调整节奏或视角"
  },
  {
    "id": "wands_six",
    "nameZh": "权杖六",
    "nameEn": "Six of Wands",
    "arcana": "minor",
    "suit": "wands",
    "number": 6,
    "keywords": [
      "权杖",
      "Six"
    ],
    "upright": "权杖六正位：关注当下行动与处境的平衡",
    "reversed": "权杖六逆位：需要调整节奏或视角"
  },
  {
    "id": "wands_seven",
    "nameZh": "权杖七",
    "nameEn": "Seven of Wands",
    "arcana": "minor",
    "suit": "wands",
    "number": 7,
    "keywords": [
      "权杖",
      "Seven"
    ],
    "upright": "权杖七正位：关注当下行动与处境的平衡",
    "reversed": "权杖七逆位：需要调整节奏或视角"
  },
  {
    "id": "wands_eight",
    "nameZh": "权杖八",
    "nameEn": "Eight of Wands",
    "arcana": "minor",
    "suit": "wands",
    "number": 8,
    "keywords": [
      "权杖",
      "Eight"
    ],
    "upright": "权杖八正位：关注当下行动与处境的平衡",
    "reversed": "权杖八逆位：需要调整节奏或视角"
  },
  {
    "id": "wands_nine",
    "nameZh": "权杖九",
    "nameEn": "Nine of Wands",
    "arcana": "minor",
    "suit": "wands",
    "number": 9,
    "keywords": [
      "权杖",
      "Nine"
    ],
    "upright": "权杖九正位：关注当下行动与处境的平衡",
    "reversed": "权杖九逆位：需要调整节奏或视角"
  },
  {
    "id": "wands_ten",
    "nameZh": "权杖十",
    "nameEn": "Ten of Wands",
    "arcana": "minor",
    "suit": "wands",
    "number": 10,
    "keywords": [
      "权杖",
      "Ten"
    ],
    "upright": "权杖十正位：关注当下行动与处境的平衡",
    "reversed": "权杖十逆位：需要调整节奏或视角"
  },
  {
    "id": "wands_page",
    "nameZh": "权杖侍从",
    "nameEn": "Page of Wands",
    "arcana": "minor",
    "suit": "wands",
    "number": 11,
    "keywords": [
      "权杖",
      "Page"
    ],
    "upright": "权杖侍从正位：关注当下行动与处境的平衡",
    "reversed": "权杖侍从逆位：需要调整节奏或视角"
  },
  {
    "id": "wands_knight",
    "nameZh": "权杖骑士",
    "nameEn": "Knight of Wands",
    "arcana": "minor",
    "suit": "wands",
    "number": 12,
    "keywords": [
      "权杖",
      "Knight"
    ],
    "upright": "权杖骑士正位：关注当下行动与处境的平衡",
    "reversed": "权杖骑士逆位：需要调整节奏或视角"
  },
  {
    "id": "wands_queen",
    "nameZh": "权杖王后",
    "nameEn": "Queen of Wands",
    "arcana": "minor",
    "suit": "wands",
    "number": 13,
    "keywords": [
      "权杖",
      "Queen"
    ],
    "upright": "权杖王后正位：关注当下行动与处境的平衡",
    "reversed": "权杖王后逆位：需要调整节奏或视角"
  },
  {
    "id": "wands_king",
    "nameZh": "权杖国王",
    "nameEn": "King of Wands",
    "arcana": "minor",
    "suit": "wands",
    "number": 14,
    "keywords": [
      "权杖",
      "King"
    ],
    "upright": "权杖国王正位：关注当下行动与处境的平衡",
    "reversed": "权杖国王逆位：需要调整节奏或视角"
  },
  {
    "id": "cups_ace",
    "nameZh": "圣杯一",
    "nameEn": "Ace of Cups",
    "arcana": "minor",
    "suit": "cups",
    "number": 1,
    "keywords": [
      "圣杯",
      "Ace"
    ],
    "upright": "圣杯一正位：关注当下行动与处境的平衡",
    "reversed": "圣杯一逆位：需要调整节奏或视角"
  },
  {
    "id": "cups_two",
    "nameZh": "圣杯二",
    "nameEn": "Two of Cups",
    "arcana": "minor",
    "suit": "cups",
    "number": 2,
    "keywords": [
      "圣杯",
      "Two"
    ],
    "upright": "圣杯二正位：关注当下行动与处境的平衡",
    "reversed": "圣杯二逆位：需要调整节奏或视角"
  },
  {
    "id": "cups_three",
    "nameZh": "圣杯三",
    "nameEn": "Three of Cups",
    "arcana": "minor",
    "suit": "cups",
    "number": 3,
    "keywords": [
      "圣杯",
      "Three"
    ],
    "upright": "圣杯三正位：关注当下行动与处境的平衡",
    "reversed": "圣杯三逆位：需要调整节奏或视角"
  },
  {
    "id": "cups_four",
    "nameZh": "圣杯四",
    "nameEn": "Four of Cups",
    "arcana": "minor",
    "suit": "cups",
    "number": 4,
    "keywords": [
      "圣杯",
      "Four"
    ],
    "upright": "圣杯四正位：关注当下行动与处境的平衡",
    "reversed": "圣杯四逆位：需要调整节奏或视角"
  },
  {
    "id": "cups_five",
    "nameZh": "圣杯五",
    "nameEn": "Five of Cups",
    "arcana": "minor",
    "suit": "cups",
    "number": 5,
    "keywords": [
      "圣杯",
      "Five"
    ],
    "upright": "圣杯五正位：关注当下行动与处境的平衡",
    "reversed": "圣杯五逆位：需要调整节奏或视角"
  },
  {
    "id": "cups_six",
    "nameZh": "圣杯六",
    "nameEn": "Six of Cups",
    "arcana": "minor",
    "suit": "cups",
    "number": 6,
    "keywords": [
      "圣杯",
      "Six"
    ],
    "upright": "圣杯六正位：关注当下行动与处境的平衡",
    "reversed": "圣杯六逆位：需要调整节奏或视角"
  },
  {
    "id": "cups_seven",
    "nameZh": "圣杯七",
    "nameEn": "Seven of Cups",
    "arcana": "minor",
    "suit": "cups",
    "number": 7,
    "keywords": [
      "圣杯",
      "Seven"
    ],
    "upright": "圣杯七正位：关注当下行动与处境的平衡",
    "reversed": "圣杯七逆位：需要调整节奏或视角"
  },
  {
    "id": "cups_eight",
    "nameZh": "圣杯八",
    "nameEn": "Eight of Cups",
    "arcana": "minor",
    "suit": "cups",
    "number": 8,
    "keywords": [
      "圣杯",
      "Eight"
    ],
    "upright": "圣杯八正位：关注当下行动与处境的平衡",
    "reversed": "圣杯八逆位：需要调整节奏或视角"
  },
  {
    "id": "cups_nine",
    "nameZh": "圣杯九",
    "nameEn": "Nine of Cups",
    "arcana": "minor",
    "suit": "cups",
    "number": 9,
    "keywords": [
      "圣杯",
      "Nine"
    ],
    "upright": "圣杯九正位：关注当下行动与处境的平衡",
    "reversed": "圣杯九逆位：需要调整节奏或视角"
  },
  {
    "id": "cups_ten",
    "nameZh": "圣杯十",
    "nameEn": "Ten of Cups",
    "arcana": "minor",
    "suit": "cups",
    "number": 10,
    "keywords": [
      "圣杯",
      "Ten"
    ],
    "upright": "圣杯十正位：关注当下行动与处境的平衡",
    "reversed": "圣杯十逆位：需要调整节奏或视角"
  },
  {
    "id": "cups_page",
    "nameZh": "圣杯侍从",
    "nameEn": "Page of Cups",
    "arcana": "minor",
    "suit": "cups",
    "number": 11,
    "keywords": [
      "圣杯",
      "Page"
    ],
    "upright": "圣杯侍从正位：关注当下行动与处境的平衡",
    "reversed": "圣杯侍从逆位：需要调整节奏或视角"
  },
  {
    "id": "cups_knight",
    "nameZh": "圣杯骑士",
    "nameEn": "Knight of Cups",
    "arcana": "minor",
    "suit": "cups",
    "number": 12,
    "keywords": [
      "圣杯",
      "Knight"
    ],
    "upright": "圣杯骑士正位：关注当下行动与处境的平衡",
    "reversed": "圣杯骑士逆位：需要调整节奏或视角"
  },
  {
    "id": "cups_queen",
    "nameZh": "圣杯王后",
    "nameEn": "Queen of Cups",
    "arcana": "minor",
    "suit": "cups",
    "number": 13,
    "keywords": [
      "圣杯",
      "Queen"
    ],
    "upright": "圣杯王后正位：关注当下行动与处境的平衡",
    "reversed": "圣杯王后逆位：需要调整节奏或视角"
  },
  {
    "id": "cups_king",
    "nameZh": "圣杯国王",
    "nameEn": "King of Cups",
    "arcana": "minor",
    "suit": "cups",
    "number": 14,
    "keywords": [
      "圣杯",
      "King"
    ],
    "upright": "圣杯国王正位：关注当下行动与处境的平衡",
    "reversed": "圣杯国王逆位：需要调整节奏或视角"
  },
  {
    "id": "swords_ace",
    "nameZh": "宝剑一",
    "nameEn": "Ace of Swords",
    "arcana": "minor",
    "suit": "swords",
    "number": 1,
    "keywords": [
      "宝剑",
      "Ace"
    ],
    "upright": "宝剑一正位：关注当下行动与处境的平衡",
    "reversed": "宝剑一逆位：需要调整节奏或视角"
  },
  {
    "id": "swords_two",
    "nameZh": "宝剑二",
    "nameEn": "Two of Swords",
    "arcana": "minor",
    "suit": "swords",
    "number": 2,
    "keywords": [
      "宝剑",
      "Two"
    ],
    "upright": "宝剑二正位：关注当下行动与处境的平衡",
    "reversed": "宝剑二逆位：需要调整节奏或视角"
  },
  {
    "id": "swords_three",
    "nameZh": "宝剑三",
    "nameEn": "Three of Swords",
    "arcana": "minor",
    "suit": "swords",
    "number": 3,
    "keywords": [
      "宝剑",
      "Three"
    ],
    "upright": "宝剑三正位：关注当下行动与处境的平衡",
    "reversed": "宝剑三逆位：需要调整节奏或视角"
  },
  {
    "id": "swords_four",
    "nameZh": "宝剑四",
    "nameEn": "Four of Swords",
    "arcana": "minor",
    "suit": "swords",
    "number": 4,
    "keywords": [
      "宝剑",
      "Four"
    ],
    "upright": "宝剑四正位：关注当下行动与处境的平衡",
    "reversed": "宝剑四逆位：需要调整节奏或视角"
  },
  {
    "id": "swords_five",
    "nameZh": "宝剑五",
    "nameEn": "Five of Swords",
    "arcana": "minor",
    "suit": "swords",
    "number": 5,
    "keywords": [
      "宝剑",
      "Five"
    ],
    "upright": "宝剑五正位：关注当下行动与处境的平衡",
    "reversed": "宝剑五逆位：需要调整节奏或视角"
  },
  {
    "id": "swords_six",
    "nameZh": "宝剑六",
    "nameEn": "Six of Swords",
    "arcana": "minor",
    "suit": "swords",
    "number": 6,
    "keywords": [
      "宝剑",
      "Six"
    ],
    "upright": "宝剑六正位：关注当下行动与处境的平衡",
    "reversed": "宝剑六逆位：需要调整节奏或视角"
  },
  {
    "id": "swords_seven",
    "nameZh": "宝剑七",
    "nameEn": "Seven of Swords",
    "arcana": "minor",
    "suit": "swords",
    "number": 7,
    "keywords": [
      "宝剑",
      "Seven"
    ],
    "upright": "宝剑七正位：关注当下行动与处境的平衡",
    "reversed": "宝剑七逆位：需要调整节奏或视角"
  },
  {
    "id": "swords_eight",
    "nameZh": "宝剑八",
    "nameEn": "Eight of Swords",
    "arcana": "minor",
    "suit": "swords",
    "number": 8,
    "keywords": [
      "宝剑",
      "Eight"
    ],
    "upright": "宝剑八正位：关注当下行动与处境的平衡",
    "reversed": "宝剑八逆位：需要调整节奏或视角"
  },
  {
    "id": "swords_nine",
    "nameZh": "宝剑九",
    "nameEn": "Nine of Swords",
    "arcana": "minor",
    "suit": "swords",
    "number": 9,
    "keywords": [
      "宝剑",
      "Nine"
    ],
    "upright": "宝剑九正位：关注当下行动与处境的平衡",
    "reversed": "宝剑九逆位：需要调整节奏或视角"
  },
  {
    "id": "swords_ten",
    "nameZh": "宝剑十",
    "nameEn": "Ten of Swords",
    "arcana": "minor",
    "suit": "swords",
    "number": 10,
    "keywords": [
      "宝剑",
      "Ten"
    ],
    "upright": "宝剑十正位：关注当下行动与处境的平衡",
    "reversed": "宝剑十逆位：需要调整节奏或视角"
  },
  {
    "id": "swords_page",
    "nameZh": "宝剑侍从",
    "nameEn": "Page of Swords",
    "arcana": "minor",
    "suit": "swords",
    "number": 11,
    "keywords": [
      "宝剑",
      "Page"
    ],
    "upright": "宝剑侍从正位：关注当下行动与处境的平衡",
    "reversed": "宝剑侍从逆位：需要调整节奏或视角"
  },
  {
    "id": "swords_knight",
    "nameZh": "宝剑骑士",
    "nameEn": "Knight of Swords",
    "arcana": "minor",
    "suit": "swords",
    "number": 12,
    "keywords": [
      "宝剑",
      "Knight"
    ],
    "upright": "宝剑骑士正位：关注当下行动与处境的平衡",
    "reversed": "宝剑骑士逆位：需要调整节奏或视角"
  },
  {
    "id": "swords_queen",
    "nameZh": "宝剑王后",
    "nameEn": "Queen of Swords",
    "arcana": "minor",
    "suit": "swords",
    "number": 13,
    "keywords": [
      "宝剑",
      "Queen"
    ],
    "upright": "宝剑王后正位：关注当下行动与处境的平衡",
    "reversed": "宝剑王后逆位：需要调整节奏或视角"
  },
  {
    "id": "swords_king",
    "nameZh": "宝剑国王",
    "nameEn": "King of Swords",
    "arcana": "minor",
    "suit": "swords",
    "number": 14,
    "keywords": [
      "宝剑",
      "King"
    ],
    "upright": "宝剑国王正位：关注当下行动与处境的平衡",
    "reversed": "宝剑国王逆位：需要调整节奏或视角"
  },
  {
    "id": "pentacles_ace",
    "nameZh": "星币一",
    "nameEn": "Ace of Pentacles",
    "arcana": "minor",
    "suit": "pentacles",
    "number": 1,
    "keywords": [
      "星币",
      "Ace"
    ],
    "upright": "星币一正位：关注当下行动与处境的平衡",
    "reversed": "星币一逆位：需要调整节奏或视角"
  },
  {
    "id": "pentacles_two",
    "nameZh": "星币二",
    "nameEn": "Two of Pentacles",
    "arcana": "minor",
    "suit": "pentacles",
    "number": 2,
    "keywords": [
      "星币",
      "Two"
    ],
    "upright": "星币二正位：关注当下行动与处境的平衡",
    "reversed": "星币二逆位：需要调整节奏或视角"
  },
  {
    "id": "pentacles_three",
    "nameZh": "星币三",
    "nameEn": "Three of Pentacles",
    "arcana": "minor",
    "suit": "pentacles",
    "number": 3,
    "keywords": [
      "星币",
      "Three"
    ],
    "upright": "星币三正位：关注当下行动与处境的平衡",
    "reversed": "星币三逆位：需要调整节奏或视角"
  },
  {
    "id": "pentacles_four",
    "nameZh": "星币四",
    "nameEn": "Four of Pentacles",
    "arcana": "minor",
    "suit": "pentacles",
    "number": 4,
    "keywords": [
      "星币",
      "Four"
    ],
    "upright": "星币四正位：关注当下行动与处境的平衡",
    "reversed": "星币四逆位：需要调整节奏或视角"
  },
  {
    "id": "pentacles_five",
    "nameZh": "星币五",
    "nameEn": "Five of Pentacles",
    "arcana": "minor",
    "suit": "pentacles",
    "number": 5,
    "keywords": [
      "星币",
      "Five"
    ],
    "upright": "星币五正位：关注当下行动与处境的平衡",
    "reversed": "星币五逆位：需要调整节奏或视角"
  },
  {
    "id": "pentacles_six",
    "nameZh": "星币六",
    "nameEn": "Six of Pentacles",
    "arcana": "minor",
    "suit": "pentacles",
    "number": 6,
    "keywords": [
      "星币",
      "Six"
    ],
    "upright": "星币六正位：关注当下行动与处境的平衡",
    "reversed": "星币六逆位：需要调整节奏或视角"
  },
  {
    "id": "pentacles_seven",
    "nameZh": "星币七",
    "nameEn": "Seven of Pentacles",
    "arcana": "minor",
    "suit": "pentacles",
    "number": 7,
    "keywords": [
      "星币",
      "Seven"
    ],
    "upright": "星币七正位：关注当下行动与处境的平衡",
    "reversed": "星币七逆位：需要调整节奏或视角"
  },
  {
    "id": "pentacles_eight",
    "nameZh": "星币八",
    "nameEn": "Eight of Pentacles",
    "arcana": "minor",
    "suit": "pentacles",
    "number": 8,
    "keywords": [
      "星币",
      "Eight"
    ],
    "upright": "星币八正位：关注当下行动与处境的平衡",
    "reversed": "星币八逆位：需要调整节奏或视角"
  },
  {
    "id": "pentacles_nine",
    "nameZh": "星币九",
    "nameEn": "Nine of Pentacles",
    "arcana": "minor",
    "suit": "pentacles",
    "number": 9,
    "keywords": [
      "星币",
      "Nine"
    ],
    "upright": "星币九正位：关注当下行动与处境的平衡",
    "reversed": "星币九逆位：需要调整节奏或视角"
  },
  {
    "id": "pentacles_ten",
    "nameZh": "星币十",
    "nameEn": "Ten of Pentacles",
    "arcana": "minor",
    "suit": "pentacles",
    "number": 10,
    "keywords": [
      "星币",
      "Ten"
    ],
    "upright": "星币十正位：关注当下行动与处境的平衡",
    "reversed": "星币十逆位：需要调整节奏或视角"
  },
  {
    "id": "pentacles_page",
    "nameZh": "星币侍从",
    "nameEn": "Page of Pentacles",
    "arcana": "minor",
    "suit": "pentacles",
    "number": 11,
    "keywords": [
      "星币",
      "Page"
    ],
    "upright": "星币侍从正位：关注当下行动与处境的平衡",
    "reversed": "星币侍从逆位：需要调整节奏或视角"
  },
  {
    "id": "pentacles_knight",
    "nameZh": "星币骑士",
    "nameEn": "Knight of Pentacles",
    "arcana": "minor",
    "suit": "pentacles",
    "number": 12,
    "keywords": [
      "星币",
      "Knight"
    ],
    "upright": "星币骑士正位：关注当下行动与处境的平衡",
    "reversed": "星币骑士逆位：需要调整节奏或视角"
  },
  {
    "id": "pentacles_queen",
    "nameZh": "星币王后",
    "nameEn": "Queen of Pentacles",
    "arcana": "minor",
    "suit": "pentacles",
    "number": 13,
    "keywords": [
      "星币",
      "Queen"
    ],
    "upright": "星币王后正位：关注当下行动与处境的平衡",
    "reversed": "星币王后逆位：需要调整节奏或视角"
  },
  {
    "id": "pentacles_king",
    "nameZh": "星币国王",
    "nameEn": "King of Pentacles",
    "arcana": "minor",
    "suit": "pentacles",
    "number": 14,
    "keywords": [
      "星币",
      "King"
    ],
    "upright": "星币国王正位：关注当下行动与处境的平衡",
    "reversed": "星币国王逆位：需要调整节奏或视角"
  }
] as const;

export function getCard(id: string) {
  return TAROT_DECK.find((c) => c.id === id);
}
