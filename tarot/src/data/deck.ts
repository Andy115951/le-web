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
      "跃入",
      "信任"
    ],
    "upright": "带着轻盈迈出一步，未知本身也是礼物",
    "reversed": "脚步太急或迟疑不前，需要先看清落点"
  },
  {
    "id": "major_01",
    "nameZh": "魔术师",
    "nameEn": "The Magician",
    "arcana": "major",
    "number": 1,
    "keywords": [
      "意志",
      "显化",
      "专注"
    ],
    "upright": "资源已在手边，把意图落成行动",
    "reversed": "能量分散或用力过猛，先收回心神"
  },
  {
    "id": "major_02",
    "nameZh": "女祭司",
    "nameEn": "The High Priestess",
    "arcana": "major",
    "number": 2,
    "keywords": [
      "直觉",
      "静默",
      "内在"
    ],
    "upright": "向内倾听，答案在尚未说出口之处",
    "reversed": "过度封闭或忽视直觉，信息被挡在门外"
  },
  {
    "id": "major_03",
    "nameZh": "女皇",
    "nameEn": "The Empress",
    "arcana": "major",
    "number": 3,
    "keywords": [
      "丰盛",
      "滋养",
      "创造"
    ],
    "upright": "创造与关怀正在生长，允许柔软发生",
    "reversed": "透支滋养或停滞不前，先照顾自己"
  },
  {
    "id": "major_04",
    "nameZh": "皇帝",
    "nameEn": "The Emperor",
    "arcana": "major",
    "number": 4,
    "keywords": [
      "秩序",
      "边界",
      "稳定"
    ],
    "upright": "用结构稳住局面，边界即保护",
    "reversed": "僵化或控制欲上升，可松一点握拳"
  },
  {
    "id": "major_05",
    "nameZh": "教皇",
    "nameEn": "The Hierophant",
    "arcana": "major",
    "number": 5,
    "keywords": [
      "传统",
      "指引",
      "信念"
    ],
    "upright": "向既有智慧学习，找到可依靠的框架",
    "reversed": "盲从教条，或拒绝一切外来指引"
  },
  {
    "id": "major_06",
    "nameZh": "恋人",
    "nameEn": "The Lovers",
    "arcana": "major",
    "number": 6,
    "keywords": [
      "选择",
      "联结",
      "价值"
    ],
    "upright": "选择对齐内心价值，关系需要诚实",
    "reversed": "摇摆不定或价值错配，先问自己要什么"
  },
  {
    "id": "major_07",
    "nameZh": "战车",
    "nameEn": "The Chariot",
    "arcana": "major",
    "number": 7,
    "keywords": [
      "推进",
      "意志",
      "方向"
    ],
    "upright": "收束对立力量，朝一个方向推进",
    "reversed": "失控内耗或方向分裂，先统一缰绳"
  },
  {
    "id": "major_08",
    "nameZh": "力量",
    "nameEn": "Strength",
    "arcana": "major",
    "number": 8,
    "keywords": [
      "柔软",
      "勇气",
      "驯服"
    ],
    "upright": "以柔克刚，内在勇气比硬碰更有力",
    "reversed": "自我怀疑或压抑本能，温柔也需要边界"
  },
  {
    "id": "major_09",
    "nameZh": "隐者",
    "nameEn": "The Hermit",
    "arcana": "major",
    "number": 9,
    "keywords": [
      "独处",
      "寻光",
      "内省"
    ],
    "upright": "提灯向内走一段路，独处里有澄明",
    "reversed": "过度孤立或逃避，灯也需要照向外"
  },
  {
    "id": "major_10",
    "nameZh": "命运之轮",
    "nameEn": "Wheel of Fortune",
    "arcana": "major",
    "number": 10,
    "keywords": [
      "流转",
      "时机",
      "变化"
    ],
    "upright": "周期在转动，顺势调整比硬扛更智慧",
    "reversed": "抗拒变化或把偶然当成定数"
  },
  {
    "id": "major_11",
    "nameZh": "正义",
    "nameEn": "Justice",
    "arcana": "major",
    "number": 11,
    "keywords": [
      "公平",
      "因果",
      "清明"
    ],
    "upright": "看清因果，做可坦然承担的决定",
    "reversed": "偏颇自欺，或纠结于绝对对错"
  },
  {
    "id": "major_12",
    "nameZh": "倒吊人",
    "nameEn": "The Hanged Man",
    "arcana": "major",
    "number": 12,
    "keywords": [
      "暂停",
      "换视角",
      "放下"
    ],
    "upright": "悬停片刻换个角度看，放下才有新解",
    "reversed": "无谓牺牲或停滞过久，该动时要动"
  },
  {
    "id": "major_13",
    "nameZh": "死神",
    "nameEn": "Death",
    "arcana": "major",
    "number": 13,
    "keywords": [
      "结束",
      "转化",
      "更新"
    ],
    "upright": "旧章节收束，腾出空间给新生",
    "reversed": "死死抓住过期之物，转化被推迟"
  },
  {
    "id": "major_14",
    "nameZh": "节制",
    "nameEn": "Temperance",
    "arcana": "major",
    "number": 14,
    "keywords": [
      "调和",
      "耐心",
      "中道"
    ],
    "upright": "两端之间找到节奏，慢慢调和",
    "reversed": "失衡极端，或急于一次调到完美"
  },
  {
    "id": "major_15",
    "nameZh": "恶魔",
    "nameEn": "The Devil",
    "arcana": "major",
    "number": 15,
    "keywords": [
      "束缚",
      "欲望",
      "觉察"
    ],
    "upright": "看清是什么在绑住你，欲望也可被命名",
    "reversed": "沉溺借口，把锁链当成舒适区"
  },
  {
    "id": "major_16",
    "nameZh": "塔",
    "nameEn": "The Tower",
    "arcana": "major",
    "number": 16,
    "keywords": [
      "震动",
      "真相",
      "重建"
    ],
    "upright": "旧结构震动露出真相，碎后可重建",
    "reversed": "否认震动，或在废墟上硬撑原样"
  },
  {
    "id": "major_17",
    "nameZh": "星星",
    "nameEn": "The Star",
    "arcana": "major",
    "number": 17,
    "keywords": [
      "希望",
      "疗愈",
      "清澈"
    ],
    "upright": "风雨后留一束光，允许自己被希望托住",
    "reversed": "失望抽空信心，记得星光仍在"
  },
  {
    "id": "major_18",
    "nameZh": "月亮",
    "nameEn": "The Moon",
    "arcana": "major",
    "number": 18,
    "keywords": [
      "迷雾",
      "潜意识",
      "幻象"
    ],
    "upright": "情绪与梦境在说话，慢步穿过迷雾",
    "reversed": "被恐惧放大幻象，先分辨影与形"
  },
  {
    "id": "major_19",
    "nameZh": "太阳",
    "nameEn": "The Sun",
    "arcana": "major",
    "number": 19,
    "keywords": [
      "明亮",
      "活力",
      "坦诚"
    ],
    "upright": "坦诚与温暖照亮路，分享喜悦",
    "reversed": "虚假乐观或灼伤自己，光也需节律"
  },
  {
    "id": "major_20",
    "nameZh": "审判",
    "nameEn": "Judgement",
    "arcana": "major",
    "number": 20,
    "keywords": [
      "觉醒",
      "召唤",
      "回顾"
    ],
    "upright": "听见内在召唤，整合过去再出发",
    "reversed": "苛责自己或对召唤充耳不闻"
  },
  {
    "id": "major_21",
    "nameZh": "世界",
    "nameEn": "The World",
    "arcana": "major",
    "number": 21,
    "keywords": [
      "完成",
      "整合",
      "圆融"
    ],
    "upright": "一段旅程圆满，整合所得再开新局",
    "reversed": "差临门一脚，或拒绝为完成画句号"
  },
  {
    "id": "wands_ace",
    "nameZh": "权杖一",
    "nameEn": "Ace of Wands",
    "arcana": "minor",
    "suit": "wands",
    "number": 1,
    "keywords": [
      "火种",
      "灵感",
      "启动"
    ],
    "upright": "灵感与热情被点燃，可以开始一小步",
    "reversed": "空有火花却未落地，或热情被浇灭"
  },
  {
    "id": "wands_two",
    "nameZh": "权杖二",
    "nameEn": "Two of Wands",
    "arcana": "minor",
    "suit": "wands",
    "number": 2,
    "keywords": [
      "规划",
      "远望",
      "抉择"
    ],
    "upright": "看见可能的道路，先在心里铺地图",
    "reversed": "犹豫不决或计划空转，需要选定方向"
  },
  {
    "id": "wands_three",
    "nameZh": "权杖三",
    "nameEn": "Three of Wands",
    "arcana": "minor",
    "suit": "wands",
    "number": 3,
    "keywords": [
      "协作",
      "远景",
      "展开"
    ],
    "upright": "众人拾柴，事业与创意往外展开",
    "reversed": "各自为政或视野短浅，协作被卡住"
  },
  {
    "id": "wands_four",
    "nameZh": "权杖四",
    "nameEn": "Four of Wands",
    "arcana": "minor",
    "suit": "wands",
    "number": 4,
    "keywords": [
      "安定",
      "庆典",
      "根基"
    ],
    "upright": "阶段性安顿与庆祝，让成果落地",
    "reversed": "家或团队不稳，或庆典掩盖未竟之事"
  },
  {
    "id": "wands_five",
    "nameZh": "权杖五",
    "nameEn": "Five of Wands",
    "arcana": "minor",
    "suit": "wands",
    "number": 5,
    "keywords": [
      "摩擦",
      "竞争",
      "试炼"
    ],
    "upright": "意见碰撞在所难免，试炼里长本事",
    "reversed": "无谓内耗升级，争的不是真正重要的"
  },
  {
    "id": "wands_six",
    "nameZh": "权杖六",
    "nameEn": "Six of Wands",
    "arcana": "minor",
    "suit": "wands",
    "number": 6,
    "keywords": [
      "认可",
      "前进",
      "凯旋"
    ],
    "upright": "努力被看见，带着认可继续前行",
    "reversed": "虚荣分心，或迟迟等不到外面的掌声"
  },
  {
    "id": "wands_seven",
    "nameZh": "权杖七",
    "nameEn": "Seven of Wands",
    "arcana": "minor",
    "suit": "wands",
    "number": 7,
    "keywords": [
      "守住",
      "勇气",
      "立场"
    ],
    "upright": "在压力中守住自己的位置与信念",
    "reversed": "寡不敌众感过强，或防守变成固执"
  },
  {
    "id": "wands_eight",
    "nameZh": "权杖八",
    "nameEn": "Eight of Wands",
    "arcana": "minor",
    "suit": "wands",
    "number": 8,
    "keywords": [
      "迅疾",
      "消息",
      "流动"
    ],
    "upright": "事情加速推进，讯息与行动一起来",
    "reversed": "仓促散乱，或卡在等待里动弹不得"
  },
  {
    "id": "wands_nine",
    "nameZh": "权杖九",
    "nameEn": "Nine of Wands",
    "arcana": "minor",
    "suit": "wands",
    "number": 9,
    "keywords": [
      "坚韧",
      "戒备",
      "末段"
    ],
    "upright": "接近终点仍需警醒，留一点力气",
    "reversed": "精疲力竭还硬撑，或过度戒备拒人"
  },
  {
    "id": "wands_ten",
    "nameZh": "权杖十",
    "nameEn": "Ten of Wands",
    "arcana": "minor",
    "suit": "wands",
    "number": 10,
    "keywords": [
      "重负",
      "责任",
      "卸下"
    ],
    "upright": "担子很沉，看清哪些该扛哪些可放",
    "reversed": "被责任压垮，或把所有重担揽到自己"
  },
  {
    "id": "wands_page",
    "nameZh": "权杖侍从",
    "nameEn": "Page of Wands",
    "arcana": "minor",
    "suit": "wands",
    "number": 11,
    "keywords": [
      "学徒",
      "消息",
      "好奇"
    ],
    "upright": "权杖侍从带来新鲜热情与试探性行动",
    "reversed": "三分钟热度，消息真假未辨"
  },
  {
    "id": "wands_knight",
    "nameZh": "权杖骑士",
    "nameEn": "Knight of Wands",
    "arcana": "minor",
    "suit": "wands",
    "number": 12,
    "keywords": [
      "冲锋",
      "冒险",
      "行动"
    ],
    "upright": "权杖骑士催你大胆前进，行动优先",
    "reversed": "鲁莽冒进，方向未定就全力冲刺"
  },
  {
    "id": "wands_queen",
    "nameZh": "权杖王后",
    "nameEn": "Queen of Wands",
    "arcana": "minor",
    "suit": "wands",
    "number": 13,
    "keywords": [
      "魅力",
      "自信",
      "感染"
    ],
    "upright": "权杖王后以自信点燃周围，魅力在场",
    "reversed": "自我中心或虚荣，热情变成操控"
  },
  {
    "id": "wands_king",
    "nameZh": "权杖国王",
    "nameEn": "King of Wands",
    "arcana": "minor",
    "suit": "wands",
    "number": 14,
    "keywords": [
      "远见",
      "领导",
      "成熟火"
    ],
    "upright": "权杖国王稳住大局，远见与责任并存",
    "reversed": "专断独行，或空有愿景缺少落地"
  },
  {
    "id": "cups_ace",
    "nameZh": "圣杯一",
    "nameEn": "Ace of Cups",
    "arcana": "minor",
    "suit": "cups",
    "number": 1,
    "keywords": [
      "情感",
      "新芽",
      "敞开"
    ],
    "upright": "心口有柔软的新意，允许感受到来",
    "reversed": "情感堵塞或虚假热情，心门半掩"
  },
  {
    "id": "cups_two",
    "nameZh": "圣杯二",
    "nameEn": "Two of Cups",
    "arcana": "minor",
    "suit": "cups",
    "number": 2,
    "keywords": [
      "互惠",
      "伙伴",
      "联结"
    ],
    "upright": "对等的心意交换，关系里有共鸣",
    "reversed": "不平衡付出，或错把投射当连接"
  },
  {
    "id": "cups_three",
    "nameZh": "圣杯三",
    "nameEn": "Three of Cups",
    "arcana": "minor",
    "suit": "cups",
    "number": 3,
    "keywords": [
      "欢聚",
      "分享",
      "友谊"
    ],
    "upright": "与人同庆、共享喜悦，圈子在发光",
    "reversed": "交际空转或圈子不合，欢聚变应酬"
  },
  {
    "id": "cups_four",
    "nameZh": "圣杯四",
    "nameEn": "Four of Cups",
    "arcana": "minor",
    "suit": "cups",
    "number": 4,
    "keywords": [
      "倦怠",
      "错过",
      "内观"
    ],
    "upright": "对外刺激提不起劲，也许该向内看",
    "reversed": "沉溺冷漠，对送到眼前的机会视而不见"
  },
  {
    "id": "cups_five",
    "nameZh": "圣杯五",
    "nameEn": "Five of Cups",
    "arcana": "minor",
    "suit": "cups",
    "number": 5,
    "keywords": [
      "失落",
      "哀悼",
      "残余"
    ],
    "upright": "承认失去，也看见尚未洒尽的那一点",
    "reversed": "沉溺悲伤无法起身，或否认真正的痛"
  },
  {
    "id": "cups_six",
    "nameZh": "圣杯六",
    "nameEn": "Six of Cups",
    "arcana": "minor",
    "suit": "cups",
    "number": 6,
    "keywords": [
      "怀旧",
      "纯真",
      "回望"
    ],
    "upright": "旧日温情带来安慰，也可滋养现在",
    "reversed": "困在过去，或美化回忆逃避当下"
  },
  {
    "id": "cups_seven",
    "nameZh": "圣杯七",
    "nameEn": "Seven of Cups",
    "arcana": "minor",
    "suit": "cups",
    "number": 7,
    "keywords": [
      "幻想",
      "选择",
      "泡影"
    ],
    "upright": "愿望很多，先分清愿景与幻觉",
    "reversed": "沉迷白日梦，现实选择被一拖再拖"
  },
  {
    "id": "cups_eight",
    "nameZh": "圣杯八",
    "nameEn": "Eight of Cups",
    "arcana": "minor",
    "suit": "cups",
    "number": 8,
    "keywords": [
      "抽离",
      "寻深",
      "放下"
    ],
    "upright": "离开不再滋养的局面，去寻更真的意义",
    "reversed": "逃避承诺，或走了却心还留在原地"
  },
  {
    "id": "cups_nine",
    "nameZh": "圣杯九",
    "nameEn": "Nine of Cups",
    "arcana": "minor",
    "suit": "cups",
    "number": 9,
    "keywords": [
      "满足",
      "愿望",
      "自赏"
    ],
    "upright": "内心感到富足，允许自己享受成果",
    "reversed": "自满封闭，或物质满足难填内在空"
  },
  {
    "id": "cups_ten",
    "nameZh": "圣杯十",
    "nameEn": "Ten of Cups",
    "arcana": "minor",
    "suit": "cups",
    "number": 10,
    "keywords": [
      "圆满",
      "家和",
      "共融"
    ],
    "upright": "情感圆融，家与关系里有安定感",
    "reversed": "表面和谐下暗流，或完美家庭幻象破"
  },
  {
    "id": "cups_page",
    "nameZh": "圣杯侍从",
    "nameEn": "Page of Cups",
    "arcana": "minor",
    "suit": "cups",
    "number": 11,
    "keywords": [
      "敏感",
      "新情",
      "学习"
    ],
    "upright": "圣杯侍从打开感受，学习如何爱人",
    "reversed": "情绪幼稚，或把幻想当感情事实"
  },
  {
    "id": "cups_knight",
    "nameZh": "圣杯骑士",
    "nameEn": "Knight of Cups",
    "arcana": "minor",
    "suit": "cups",
    "number": 12,
    "keywords": [
      "浪漫",
      "追求",
      "理想"
    ],
    "upright": "圣杯骑士带着理想靠近，情意真挚",
    "reversed": "不切实际的浪漫，承诺大于行动"
  },
  {
    "id": "cups_queen",
    "nameZh": "圣杯王后",
    "nameEn": "Queen of Cups",
    "arcana": "minor",
    "suit": "cups",
    "number": 13,
    "keywords": [
      "共情",
      "涵容",
      "直觉情"
    ],
    "upright": "圣杯王后深深接住情绪，直觉温柔",
    "reversed": "情绪淹没边界，过度付出耗尽自己"
  },
  {
    "id": "cups_king",
    "nameZh": "圣杯国王",
    "nameEn": "King of Cups",
    "arcana": "minor",
    "suit": "cups",
    "number": 14,
    "keywords": [
      "成熟情",
      "稳定",
      "智慧心"
    ],
    "upright": "圣杯国王情绪稳定，以智慧照顾关系",
    "reversed": "情感压抑或冷感，用理性躲开真心"
  },
  {
    "id": "swords_ace",
    "nameZh": "宝剑一",
    "nameEn": "Ace of Swords",
    "arcana": "minor",
    "suit": "swords",
    "number": 1,
    "keywords": [
      "清明",
      "决断",
      "真理"
    ],
    "upright": "心智锋利，适合澄清事实与做决定",
    "reversed": "言辞伤人，或真相被用来攻击"
  },
  {
    "id": "swords_two",
    "nameZh": "宝剑二",
    "nameEn": "Two of Swords",
    "arcana": "minor",
    "suit": "swords",
    "number": 2,
    "keywords": [
      "僵持",
      "权衡",
      "盲区"
    ],
    "upright": "两难之间需要停一停，信息还不全",
    "reversed": "逃避选择，或假装平衡实则停滞"
  },
  {
    "id": "swords_three",
    "nameZh": "宝剑三",
    "nameEn": "Three of Swords",
    "arcana": "minor",
    "suit": "swords",
    "number": 3,
    "keywords": [
      "刺痛",
      "哀伤",
      "疗伤"
    ],
    "upright": "心被刺痛需要被看见，哀伤也是过程",
    "reversed": "反复揭伤疤，或否认痛让伤口化脓"
  },
  {
    "id": "swords_four",
    "nameZh": "宝剑四",
    "nameEn": "Four of Swords",
    "arcana": "minor",
    "suit": "swords",
    "number": 4,
    "keywords": [
      "休整",
      "静默",
      "蓄力"
    ],
    "upright": "强制休息，让心智躺平片刻再战",
    "reversed": "闲不下来，或休息变成长期逃避"
  },
  {
    "id": "swords_five",
    "nameZh": "宝剑五",
    "nameEn": "Five of Swords",
    "arcana": "minor",
    "suit": "swords",
    "number": 5,
    "keywords": [
      "胜负",
      "屈辱",
      "计较"
    ],
    "upright": "冲突里有人受伤，赢面也带着代价",
    "reversed": "咄咄逼人，或沉溺失败者叙事"
  },
  {
    "id": "swords_six",
    "nameZh": "宝剑六",
    "nameEn": "Six of Swords",
    "arcana": "minor",
    "suit": "swords",
    "number": 6,
    "keywords": [
      "过渡",
      "离开",
      "平复"
    ],
    "upright": "乘流向更平静处，伤痛在路上慢慢淡",
    "reversed": "拒绝离开困境，或旅程被焦虑拖住"
  },
  {
    "id": "swords_seven",
    "nameZh": "宝剑七",
    "nameEn": "Seven of Swords",
    "arcana": "minor",
    "suit": "swords",
    "number": 7,
    "keywords": [
      "策略",
      "隐蔽",
      "机变"
    ],
    "upright": "需要策略与低调，不是所有牌都摊开",
    "reversed": "自欺欺人，或用不诚实手段求捷径"
  },
  {
    "id": "swords_eight",
    "nameZh": "宝剑八",
    "nameEn": "Eight of Swords",
    "arcana": "minor",
    "suit": "swords",
    "number": 8,
    "keywords": [
      "困住",
      "念头",
      "束缚"
    ],
    "upright": "感到被困，多半是念头织成的网",
    "reversed": "受害者循环，或把限制当成无法打破"
  },
  {
    "id": "swords_nine",
    "nameZh": "宝剑九",
    "nameEn": "Nine of Swords",
    "arcana": "minor",
    "suit": "swords",
    "number": 9,
    "keywords": [
      "焦虑",
      "夜念",
      "压力"
    ],
    "upright": "夜里念头嘈杂，压力需要被说出",
    "reversed": "被恐惧淹没，灾难化想象接管现实"
  },
  {
    "id": "swords_ten",
    "nameZh": "宝剑十",
    "nameEn": "Ten of Swords",
    "arcana": "minor",
    "suit": "swords",
    "number": 10,
    "keywords": [
      "触底",
      "结束",
      "黎明"
    ],
    "upright": "最痛的一章接近尾声，触底后可翻篇",
    "reversed": "反复躺在谷底，拒绝任何重新开始"
  },
  {
    "id": "swords_page",
    "nameZh": "宝剑侍从",
    "nameEn": "Page of Swords",
    "arcana": "minor",
    "suit": "swords",
    "number": 11,
    "keywords": [
      "好奇",
      "观察",
      "新知"
    ],
    "upright": "宝剑侍从带着问题来，适合学习澄清",
    "reversed": "言语尖刺或八卦，心智尚未成熟"
  },
  {
    "id": "swords_knight",
    "nameZh": "宝剑骑士",
    "nameEn": "Knight of Swords",
    "arcana": "minor",
    "suit": "swords",
    "number": 12,
    "keywords": [
      "直进",
      "辩论",
      "行动思"
    ],
    "upright": "宝剑骑士以锋芒推进，逻辑先行",
    "reversed": "好斗伤人，真理变成武器"
  },
  {
    "id": "swords_queen",
    "nameZh": "宝剑王后",
    "nameEn": "Queen of Swords",
    "arcana": "minor",
    "suit": "swords",
    "number": 13,
    "keywords": [
      "清明心",
      "独立",
      "洞见"
    ],
    "upright": "宝剑王后洞察人情，独立而清晰",
    "reversed": "刻薄冷酷，用理智切断一切柔软"
  },
  {
    "id": "swords_king",
    "nameZh": "宝剑国王",
    "nameEn": "King of Swords",
    "arcana": "minor",
    "suit": "swords",
    "number": 14,
    "keywords": [
      "权威思",
      "公正",
      "决断"
    ],
    "upright": "宝剑国王以公正裁决，权威来自清明",
    "reversed": "僵硬独裁，或冷酷到失去人性温度"
  },
  {
    "id": "pentacles_ace",
    "nameZh": "星币一",
    "nameEn": "Ace of Pentacles",
    "arcana": "minor",
    "suit": "pentacles",
    "number": 1,
    "keywords": [
      "机会",
      "种子",
      "务实"
    ],
    "upright": "务实的新机会发芽，值得用心浇灌",
    "reversed": "机会空转，或不切实际的金钱幻想"
  },
  {
    "id": "pentacles_two",
    "nameZh": "星币二",
    "nameEn": "Two of Pentacles",
    "arcana": "minor",
    "suit": "pentacles",
    "number": 2,
    "keywords": [
      "平衡",
      "周转",
      "灵活"
    ],
    "upright": "多方资源在跳接，灵活调整节奏",
    "reversed": "手忙脚乱，或假装平衡实则失衡"
  },
  {
    "id": "pentacles_three",
    "nameZh": "星币三",
    "nameEn": "Three of Pentacles",
    "arcana": "minor",
    "suit": "pentacles",
    "number": 3,
    "keywords": [
      "手艺",
      "协作",
      "质量"
    ],
    "upright": "以匠心做事，团队与技艺互相成就",
    "reversed": "敷衍了事，或合作里标准不一致"
  },
  {
    "id": "pentacles_four",
    "nameZh": "星币四",
    "nameEn": "Four of Pentacles",
    "arcana": "minor",
    "suit": "pentacles",
    "number": 4,
    "keywords": [
      "持有",
      "安全感",
      "守成"
    ],
    "upright": "守住已有资源，安全感需要边界",
    "reversed": "过度囤积吝啬，或安全感变成牢笼"
  },
  {
    "id": "pentacles_five",
    "nameZh": "星币五",
    "nameEn": "Five of Pentacles",
    "arcana": "minor",
    "suit": "pentacles",
    "number": 5,
    "keywords": [
      "匮乏",
      "孤立",
      "求援"
    ],
    "upright": "感到短缺与寒冷，记得求助是勇气",
    "reversed": "困在匮乏叙事，拒绝伸出的援手"
  },
  {
    "id": "pentacles_six",
    "nameZh": "星币六",
    "nameEn": "Six of Pentacles",
    "arcana": "minor",
    "suit": "pentacles",
    "number": 6,
    "keywords": [
      "给予",
      "流动",
      "公平"
    ],
    "upright": "资源在流动，给予与接受都可发生",
    "reversed": "施舍带控制，或付出失衡心生怨"
  },
  {
    "id": "pentacles_seven",
    "nameZh": "星币七",
    "nameEn": "Seven of Pentacles",
    "arcana": "minor",
    "suit": "pentacles",
    "number": 7,
    "keywords": [
      "耕耘",
      "等待",
      "耐心"
    ],
    "upright": "成果尚在生长，耐心继续照料",
    "reversed": "急于收割未成熟之物，或放弃耕耘"
  },
  {
    "id": "pentacles_eight",
    "nameZh": "星币八",
    "nameEn": "Eight of Pentacles",
    "arcana": "minor",
    "suit": "pentacles",
    "number": 8,
    "keywords": [
      "专注",
      "技艺",
      "打磨"
    ],
    "upright": "沉浸打磨手艺，勤奋带来扎实感",
    "reversed": "完美主义拖延，或机械劳作失去意义"
  },
  {
    "id": "pentacles_nine",
    "nameZh": "星币九",
    "nameEn": "Nine of Pentacles",
    "arcana": "minor",
    "suit": "pentacles",
    "number": 9,
    "keywords": [
      "自立",
      "享受",
      "成果"
    ],
    "upright": "靠自己站稳，也配得上享受成果",
    "reversed": "孤立式自满，或物质精致难掩空虚"
  },
  {
    "id": "pentacles_ten",
    "nameZh": "星币十",
    "nameEn": "Ten of Pentacles",
    "arcana": "minor",
    "suit": "pentacles",
    "number": 10,
    "keywords": [
      "传承",
      "家业",
      "长久"
    ],
    "upright": "稳定与传承感浮现，财富连着关系",
    "reversed": "家族或金钱纠葛，或表面富足根基松"
  },
  {
    "id": "pentacles_page",
    "nameZh": "星币侍从",
    "nameEn": "Page of Pentacles",
    "arcana": "minor",
    "suit": "pentacles",
    "number": 11,
    "keywords": [
      "学习",
      "务实苗",
      "机会"
    ],
    "upright": "星币侍从认真学手艺，务实机会初现",
    "reversed": "懒散拖延，或机会来了却不当真"
  },
  {
    "id": "pentacles_knight",
    "nameZh": "星币骑士",
    "nameEn": "Knight of Pentacles",
    "arcana": "minor",
    "suit": "pentacles",
    "number": 12,
    "keywords": [
      "稳健",
      "尽责",
      "推进"
    ],
    "upright": "星币骑士按部就班推进，可靠可托",
    "reversed": "过分迟缓，责任变成沉闷负担"
  },
  {
    "id": "pentacles_queen",
    "nameZh": "星币王后",
    "nameEn": "Queen of Pentacles",
    "arcana": "minor",
    "suit": "pentacles",
    "number": 13,
    "keywords": [
      "滋养土",
      "丰盛感",
      "照料"
    ],
    "upright": "星币王后把生活照料妥帖，丰盛落地",
    "reversed": "物质焦虑，或把价值全绑在拥有上"
  },
  {
    "id": "pentacles_king",
    "nameZh": "星币国王",
    "nameEn": "King of Pentacles",
    "arcana": "minor",
    "suit": "pentacles",
    "number": 14,
    "keywords": [
      "成就",
      "稳健富",
      "担当"
    ],
    "upright": "星币国王事业与资源稳健，担当在肩",
    "reversed": "吝啬管控，或成功背后失去生活温度"
  }
] as const;

export function getCard(id: string) {
  return TAROT_DECK.find((c) => c.id === id);
}
