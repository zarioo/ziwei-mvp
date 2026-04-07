/**
 * 将 iztro 原始排盘数据转换为 LLM 可用的 JSON 格式
 * 
 * 核心功能：
 * 1. 星曜格式化：包含亮度（庙旺利陷）和生年四化
 * 2. 全量数据：输出全部 12 个宫位
 * 3. 动态叠宫：大限和流年通过 mapping 指向本命盘
 * 4. 四化追踪：自化、对宫化入
 */

// 宫位名称映射表（用于查找三方四正）
const PALACE_NAMES = [
  "命宫", "兄弟宫", "夫妻宫", "子女宫", "财帛宫", "疾厄宫",
  "迁移宫", "交友宫", "官禄宫", "田宅宫", "福德宫", "父母宫"
];

// 宫位名称简化映射（去掉"宫"字）
const PALACE_NAME_MAP: Record<string, string> = {
  "命宫": "命宫",
  "兄弟宫": "兄弟",
  "夫妻宫": "夫妻",
  "子女宫": "子女",
  "财帛宫": "财帛",
  "疾厄宫": "疾厄",
  "迁移宫": "迁移",
  "交友宫": "交友",
  "官禄宫": "官禄",
  "田宅宫": "田宅",
  "福德宫": "福德",
  "父母宫": "父母",
};

// 四化映射表（天干 -> 四化）
const SIHUA_MAP: Record<string, { star: string; type: string }[]> = {
  "甲": [{ star: "廉贞", type: "禄" }, { star: "破军", type: "权" }, { star: "武曲", type: "科" }, { star: "太阳", type: "忌" }],
  "乙": [{ star: "天机", type: "禄" }, { star: "天梁", type: "权" }, { star: "紫微", type: "科" }, { star: "太阴", type: "忌" }],
  "丙": [{ star: "天同", type: "禄" }, { star: "天机", type: "权" }, { star: "文昌", type: "科" }, { star: "廉贞", type: "忌" }],
  "丁": [{ star: "太阴", type: "禄" }, { star: "天同", type: "权" }, { star: "天机", type: "科" }, { star: "巨门", type: "忌" }],
  "戊": [{ star: "贪狼", type: "禄" }, { star: "太阴", type: "权" }, { star: "右弼", type: "科" }, { star: "天机", type: "忌" }],
  "己": [{ star: "武曲", type: "禄" }, { star: "贪狼", type: "权" }, { star: "天梁", type: "科" }, { star: "文曲", type: "忌" }],
  "庚": [{ star: "太阳", type: "禄" }, { star: "武曲", type: "权" }, { star: "太阴", type: "科" }, { star: "天同", type: "忌" }],
  "辛": [{ star: "巨门", type: "禄" }, { star: "太阳", type: "权" }, { star: "文曲", type: "科" }, { star: "文昌", type: "忌" }],
  "壬": [{ star: "天梁", type: "禄" }, { star: "紫微", type: "权" }, { star: "左辅", type: "科" }, { star: "武曲", type: "忌" }],
  "癸": [{ star: "破军", type: "禄" }, { star: "巨门", type: "权" }, { star: "太阴", type: "科" }, { star: "贪狼", type: "忌" }],
};

/**
 * 根据生年天干 + 生理性别，生成“阴男/阳男/阴女/阳女”
 * 说明：天干分阴阳，甲丙戊庚壬为阳，乙丁己辛癸为阴。
 * 若天干缺失，则回退为原始性别，避免写出错误信息。
 */
function formatGenderWithYinYang(
  gender: "男" | "女",
  birthYearStem: string
): string {
  const normalizedStem = (birthYearStem || "").trim().charAt(0);
  const yangStems = new Set(["甲", "丙", "戊", "庚", "壬"]);
  const yinStems = new Set(["乙", "丁", "己", "辛", "癸"]);

  if (yangStems.has(normalizedStem)) {
    return `阳${gender}`;
  }
  if (yinStems.has(normalizedStem)) {
    return `阴${gender}`;
  }
  return gender;
}

/**
 * 格式化星曜名称，包含亮度和四化
 * @param starName 星曜名称
 * @param brightness 亮度（庙、旺、得、利、平、不、陷）
 * @param mutagen 生年四化（禄、权、科、忌）
 * @returns 格式化后的星曜字符串，例如："紫微(庙)" 或 "廉贞(平)-[生年禄]"
 */
function formatStarName(starName: string, brightness: string, mutagen: string): string {
  let result = starName;
  
  // 添加亮度（如果有）
  if (brightness) {
    result += `(${brightness})`;
  }
  
  // 添加生年四化（如果有）
  if (mutagen) {
    const sihuaMap: Record<string, string> = {
      "禄": "生年禄",
      "权": "生年权",
      "科": "生年科",
      "忌": "生年忌"
    };
    const sihuaText = sihuaMap[mutagen] || `生年${mutagen}`;
    // 生年四化统一放到方括号里，便于和自化/对宫化入保持同一视觉风格
    result += `-[${sihuaText}]`;
  }
  
  return result;
}

/**
 * 计算对宫索引（当前宫位 + 6，取模 12）
 */
function getOppositeIndex(index: number): number {
  return (index + 6) % 12;
}

/**
 * 计算三方四正索引
 * 三方：本宫、财帛位、官禄位
 * 四正：三方 + 对宫
 */
function getTrineIndices(palaceName: string, currentIndex: number): {
  oppositeIndex: number;
  wealthTrineIndex: number;
  careerTrineIndex: number;
} {
  // 对宫索引
  const oppositeIndex = getOppositeIndex(currentIndex);

  // 三方的计算规则：以对宫为基准，财帛位=对宫+2，官禄位=对宫-2
  // 这里使用 +12 再取模，确保不会出现负数
  const wealthTrineIndex = (oppositeIndex + 2) % 12;
  const careerTrineIndex = (oppositeIndex - 2 + 12) % 12;

  return {
    oppositeIndex,
    wealthTrineIndex,
    careerTrineIndex,
  };
}

/**
 * 检查宫干是否引发星曜四化
 * @param heavenlyStem 宫干（天干）
 * @param starName 星曜名称
 * @returns 四化类型（禄、权、科、忌）或 null
 */
function checkSihua(heavenlyStem: string, starName: string): string | null {
  const sihuaList = SIHUA_MAP[heavenlyStem];
  if (!sihuaList) return null;
  
  const match = sihuaList.find(item => item.star === starName);
  return match ? match.type : null;
}

/**
 * 给指定星曜追加标签（优先追加到主星，其次辅星）
 * 例：太阴(陷) + 自化禄 => 太阴(陷)[自化禄]
 */
function appendTagToStarText(
  majorStarsRaw: any[],
  minorStarsRaw: any[],
  majorStarsText: string[],
  minorStarsText: string[],
  starName: string,
  tagText: string
): boolean {
  if (!starName || !tagText) return false;

  const majorIndex = majorStarsRaw.findIndex((star: any) => star?.name === starName);
  if (majorIndex >= 0 && majorStarsText[majorIndex]) {
    majorStarsText[majorIndex] = `${majorStarsText[majorIndex]}[${tagText}]`;
    return true;
  }

  const minorIndex = minorStarsRaw.findIndex((star: any) => star?.name === starName);
  if (minorIndex >= 0 && minorStarsText[minorIndex]) {
    minorStarsText[minorIndex] = `${minorStarsText[minorIndex]}[${tagText}]`;
    return true;
  }

  return false;
}

/**
 * 统一生成 risk_alert 文案
 * 规则：先“入”星曜所在宫，再“冲”该宫的对宫
 * 例：太阳-流日化忌 入 本命交友 冲 本命兄弟
 */
function buildRiskAlert(
  palaces: any[],
  jiStar: string | undefined,
  periodLabel: "大限" | "流年" | "流月" | "流日"
): string | null {
  if (!jiStar || !Array.isArray(palaces) || palaces.length === 0) {
    return null;
  }

  for (let i = 0; i < palaces.length; i++) {
    const palace = palaces[i];
    const allStars = [...(palace?.majorStars || []), ...(palace?.minorStars || [])];
    const hasStar = allStars.some((star: any) => star.name === jiStar);
    if (!hasStar) continue;

    const entryName = PALACE_NAME_MAP[palace?.name] || palace?.name?.replace(/宫$/, "") || "";
    // 对宫索引 = 当前宫位 + 6（取模 12）
    const oppositePalace = palaces[getOppositeIndex(i)];
    const oppositeName =
      PALACE_NAME_MAP[oppositePalace?.name] ||
      oppositePalace?.name?.replace(/宫$/, "") ||
      "";

    return `${jiStar}-${periodLabel}化忌 入 本命${entryName} 冲 本命${oppositeName}`;
  }

  return null;
}

/**
 * 生成本命盘静态数据
 */
function generateStaticPalaces(astrolabe: any): any[] {
  const palaces = astrolabe.palaces || [];
  
  return palaces.map((palace: any, index: number) => {
    const majorStarsRaw = palace.majorStars || [];
    const minorStarsRaw = palace.minorStars || [];

    // 格式化主星
    const majorStars = majorStarsRaw.map((star: any) => {
      return formatStarName(
        star.name || "",
        star.brightness || "",
        star.mutagen || ""
      );
    });
    
    // 格式化辅星
    const minorStars = minorStarsRaw.map((star: any) => {
      return formatStarName(
        star.name || "",
        star.brightness || "",
        star.mutagen || ""
      );
    });

    // 格式化杂耀（iztro 里通常是 adjectiveStars）
    const miniStars = (palace.adjectiveStars || []).map((star: any) => {
      return formatStarName(
        star.name || "",
        star.brightness || "",
        star.mutagen || ""
      );
    });

    // 如果主星为空，标注为空宫，方便不懂代码的人理解
    const finalMajorStars = majorStars.length > 0 ? majorStars : ["无(空宫）"];
    
    // 标准化宫位名称
    const palaceName = PALACE_NAME_MAP[palace.name] || palace.name || "";
    
    // 计算三方四正索引
    const relationships = getTrineIndices(palace.name || "", index);

    // 长生十二神（iztro 通常是 changsheng12），用数组方便后续扩展
    const changshengPhase = palace.changsheng12 ? [palace.changsheng12] : [];
    
    // 检查自化：本宫干 -> 本宫星
    let selfSihuaStarName: string | null = null;
    let selfSihuaTag: string | null = null;
    const palaceStem = palace.heavenlyStem || "";
    if (palaceStem) {
      // 检查主星和辅星是否有自化
      const allStars = [...majorStarsRaw, ...minorStarsRaw];
      for (const star of allStars) {
        const sihuaType = checkSihua(palaceStem, star.name);
        if (sihuaType) {
          const sihuaMap: Record<string, string> = {
            "禄": "自化禄",
            "权": "自化权",
            "科": "自化科",
            "忌": "自化忌"
          };
          selfSihuaStarName = star.name || "";
          selfSihuaTag = sihuaMap[sihuaType] || `自化${sihuaType}`;
          break; // 只记录第一个自化
        }
      }
    }
    
    // 检查对宫化入：对宫干 -> 本宫星
    let oppositeImpactStarName: string | null = null;
    let oppositeImpactTag: string | null = null;
    const oppositeIndex = relationships.oppositeIndex;
    const oppositePalace = palaces[oppositeIndex];
    if (oppositePalace) {
      const oppositeStem = oppositePalace.heavenlyStem || "";
      if (oppositeStem) {
        const allStars = [...majorStarsRaw, ...minorStarsRaw];
        for (const star of allStars) {
          const sihuaType = checkSihua(oppositeStem, star.name);
          if (sihuaType) {
            if (sihuaType === "忌") {
              oppositeImpactStarName = star.name || "";
              // 新规则：忌也和禄/权/科一致，统一写成“对宫化入忌”
              oppositeImpactTag = "对宫化入忌";
            } else {
              const sihuaMap: Record<string, string> = {
                "禄": "化入禄",
                "权": "化入权",
                "科": "化入科"
              };
              const impactText = sihuaMap[sihuaType] || `化入${sihuaType}`;
              oppositeImpactStarName = star.name || "";
              oppositeImpactTag = `对宫${impactText}`;
            }
            break; // 只记录第一个对宫化入
          }
        }
      }
    }

    // 把“自化 / 对宫化入”直接并入主星或辅星，便于阅读 JSON 时一眼看懂
    if (selfSihuaStarName && selfSihuaTag) {
      appendTagToStarText(
        majorStarsRaw,
        minorStarsRaw,
        majorStars,
        minorStars,
        selfSihuaStarName,
        selfSihuaTag
      );
    }
    if (oppositeImpactStarName && oppositeImpactTag) {
      appendTagToStarText(
        majorStarsRaw,
        minorStarsRaw,
        majorStars,
        minorStars,
        oppositeImpactStarName,
        oppositeImpactTag
      );
    }
    
    return {
      index,
      name: palaceName,
      is_body_palace: Boolean(palace.isBodyPalace),
      earthly_branch: palace.earthlyBranch || "",
      heavenly_stem: palace.heavenlyStem || "",
      major_stars: finalMajorStars,
      minor_stars: minorStars,
      // 杂耀，单独列出，避免和辅星混在一起难以理解
      mini_stars: miniStars,
      // 长生十二神
      changsheng_phase: changshengPhase,
      // 博士12神、岁建12神、将前12神
      misc_gods: {
        doctor_12: palace.boshi12 || "",
        year_12: palace.suiqian12 || "",
        general_12: palace.jiangqian12 || "",
      },
      relationships,
    };
  });
}

/**
 * 生成大限映射数据
 * 包含全部12个宫位的映射关系
 * 
 * 核心逻辑：大限的宫位顺序是从大限所在宫位开始，按照固定顺序（命宫、兄弟、夫妻...）排列
 * 例如：如果大限在田宅宫（index 11），那么大限的命宫（索引0）对应本命的田宅宫（index 11）
 * 大限的兄弟宫（索引1）对应本命的福德宫（index 10），以此类推
 */
function generateDecadalMapping(
  astrolabe: any,
  horoscope: any
): any {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/affd2388-a2f8-4ad0-b318-741134ec2d78',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'generateLLMPayload.ts:generateDecadalMapping:entry',message:'函数入口',data:{hasDecadal:!!horoscope?.decadal,hasPalaces:!!astrolabe?.palaces},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion agent log
  
  const decadal = horoscope?.decadal;
  if (!decadal) return null;
  
  const palaces = astrolabe.palaces || [];
  
  // 获取大限所在的本命宫位索引（这是大限的起始宫位）
  // decadal.index 是大限所在的本命宫位索引（0-11）
  const decadalBaseIndex = decadal.index ?? -1;
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/affd2388-a2f8-4ad0-b318-741134ec2d78',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'generateLLMPayload.ts:generateDecadalMapping:data',message:'原始数据检查',data:{decadalBaseIndex,palacesLength:palaces.length,allPalaceNames:palaces.map((p:any,i:number)=>({index:i,name:p.name}))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion agent log
  
  // 如果大限索引无效，返回null
  if (decadalBaseIndex < 0 || decadalBaseIndex >= 12) {
    return null;
  }
  
  // 宫位名称数组（按顺序：命宫、兄弟、夫妻、子女、财帛、疾厄、迁移、交友、官禄、田宅、福德、父母）
  const palaceKeyNames = [
    "life_palace",      // 命宫 (索引 0)
    "sibling_palace",   // 兄弟 (索引 1)
    "spouse_palace",    // 夫妻 (索引 2)
    "children_palace",  // 子女 (索引 3)
    "wealth_palace",    // 财帛 (索引 4)
    "health_palace",    // 疾厄 (索引 5)
    "travel_palace",    // 迁移 (索引 6)
    "friend_palace",    // 交友 (索引 7)
    "career_palace",    // 官禄 (索引 8)
    "property_palace",  // 田宅 (索引 9)
    "fortune_palace",   // 福德 (索引 10)
    "parent_palace",    // 父母 (索引 11)
  ];
  
  // 生成全部12个宫位的映射
  // 大限的宫位索引i对应本命的宫位索引 (decadalBaseIndex - i) % 12
  // 说明：大限从起始宫位开始，后续宫位按逆序走（例如 6,5,4...）
  const mapping: Record<string, any> = {};
  for (let i = 0; i < palaceKeyNames.length; i++) {
    // 计算本命宫位索引：大限宫位索引i对应本命宫位索引 (decadalBaseIndex - i) % 12
    const staticIndex = (decadalBaseIndex - i + 12) % 12;
    const keyName = palaceKeyNames[i];
    const staticPalace = palaces[staticIndex];
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/affd2388-a2f8-4ad0-b318-741134ec2d78',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'generateLLMPayload.ts:generateDecadalMapping:mapping',message:'生成映射',data:{i,keyName,staticIndex,staticPalaceName:staticPalace?.name},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion agent log
    
    if (staticPalace) {
      const staticPalaceName = PALACE_NAME_MAP[staticPalace.name] || 
                              staticPalace.name?.replace(/宫$/, "") || "";
      mapping[keyName] = {
        target_static_index: staticIndex,
        overlapping_text: `本命${staticPalaceName}`,
      };
    } else {
      mapping[keyName] = {
        target_static_index: null,
        overlapping_text: "",
      };
    }
  }
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/affd2388-a2f8-4ad0-b318-741134ec2d78',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'generateLLMPayload.ts:generateDecadalMapping:result',message:'映射结果',data:{mappingKeys:Object.keys(mapping),sampleMapping:Object.entries(mapping).slice(0,3)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  // #endregion agent log
  
  // 格式化大限四化
  const transformations = (decadal.mutagen || []).map((star: string) => {
    // 需要根据大限宫干确定四化类型
    const stem = decadal.heavenlyStem || "";
    const sihuaList = SIHUA_MAP[stem] || [];
    const match = sihuaList.find(item => item.star === star);
    if (match) {
      const sihuaMap: Record<string, string> = {
        "禄": "化禄",
        "权": "化权",
        "科": "化科",
        "忌": "化忌"
      };
      return `${star}${sihuaMap[match.type] || `化${match.type}`}`;
    }
    return star;
  });
  
  // 检查大限化忌的 risk_alert：先入所在宫，再冲对宫
  const sihuaList = SIHUA_MAP[decadal.heavenlyStem || ""] || [];
  const jiStar = sihuaList.find(item => item.type === "忌")?.star;
  const riskAlert = buildRiskAlert(palaces, jiStar, "大限");
  
  // 大限年龄范围：从本命盘对应宫位的 decadal.range 获取
  const decadalIndex = decadal.index ?? -1;
  const decadalPalace = decadalIndex >= 0 ? palaces[decadalIndex] : null;
  const range = decadalPalace?.decadal?.range || [];
  const ageRange = range.length >= 2 ? `${range[0]}-${range[1]}岁` : "";
  
  return {
    name: `${ageRange} 大限`,
    stem: decadal.heavenlyStem || "",
    branch: decadal.earthlyBranch || "",
    mapping,
    transformations,
    risk_alert: riskAlert,
  };
}

/**
 * 生成流年映射数据
 * 包含全部12个宫位的映射关系
 * 
 * 核心逻辑：流年的宫位顺序是从流年所在宫位开始，按照固定顺序（命宫、兄弟、夫妻...）排列
 * 例如：如果流年在疾厄宫（index 5），那么流年的命宫（索引0）对应本命的疾厄宫（index 5）
 * 流年的兄弟宫（索引1）对应本命的迁移宫（index 6），以此类推
 */
function generateYearlyMapping(
  astrolabe: any,
  horoscope: any,
  decadalMapping: any
): any {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/affd2388-a2f8-4ad0-b318-741134ec2d78',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'generateLLMPayload.ts:generateYearlyMapping:entry',message:'流年映射函数入口',data:{hasYearly:!!horoscope?.yearly},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
  // #endregion agent log
  
  const yearly = horoscope?.yearly;
  if (!yearly) return null;
  
  const palaces = astrolabe.palaces || [];
  
  // 获取流年所在的本命宫位索引（这是流年的起始宫位）
  // yearly.index 是流年所在的本命宫位索引（0-11）
  const yearlyBaseIndex = yearly.index ?? -1;
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/affd2388-a2f8-4ad0-b318-741134ec2d78',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'generateLLMPayload.ts:generateYearlyMapping:data',message:'流年原始数据',data:{yearlyBaseIndex,palacesLength:palaces.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
  // #endregion agent log
  
  // 如果流年索引无效，返回null
  if (yearlyBaseIndex < 0 || yearlyBaseIndex >= 12) {
    return null;
  }
  
  // 宫位名称数组（按顺序：命宫、兄弟、夫妻、子女、财帛、疾厄、迁移、交友、官禄、田宅、福德、父母）
  const palaceKeyNames = [
    "life_palace",      // 命宫 (索引 0)
    "sibling_palace",   // 兄弟 (索引 1)
    "spouse_palace",    // 夫妻 (索引 2)
    "children_palace",  // 子女 (索引 3)
    "wealth_palace",    // 财帛 (索引 4)
    "health_palace",    // 疾厄 (索引 5)
    "travel_palace",    // 迁移 (索引 6)
    "friend_palace",    // 交友 (索引 7)
    "career_palace",    // 官禄 (索引 8)
    "property_palace",  // 田宅 (索引 9)
    "fortune_palace",   // 福德 (索引 10)
    "parent_palace",    // 父母 (索引 11)
  ];
  
  // 生成叠宫描述（包含本命和大限）
  // yearlyIndex 是流年宫位的索引（0=命宫, 1=兄弟...），对应的大限宫位也是同样的索引
  const getOverlappingText = (staticIndex: number, yearlyIndex: number): string => {
    if (staticIndex < 0) return "";
    const staticPalaceName = PALACE_NAME_MAP[palaces[staticIndex]?.name] || 
                              palaces[staticIndex]?.name?.replace(/宫$/, "") || "";
    const parts = [`本命${staticPalaceName}`];
    
    // 如果大限映射存在，也加入描述
    // 关键修正：用“本命索引”去反查大限的宫位角色
    // 这样可以确保“叠 大限XX宫”的XX来自大限宫位本身，而不是本命宫位名称
    if (decadalMapping?.mapping) {
      // 大限宫位 key -> 中文名，便于不懂代码的人看得懂
      const decadalPalaceNameMap: Record<string, string> = {
        life_palace: "命宫",
        sibling_palace: "兄弟宫",
        spouse_palace: "夫妻宫",
        children_palace: "子女宫",
        wealth_palace: "财帛宫",
        health_palace: "疾厄宫",
        travel_palace: "迁移宫",
        friend_palace: "交友宫",
        career_palace: "官禄宫",
        property_palace: "田宅宫",
        fortune_palace: "福德宫",
        parent_palace: "父母宫",
      };

      // 找到“大限宫位 -> 本命宫位”的映射里，和本命索引一致的那一项
      const matchedDecadalEntry = Object.entries(decadalMapping.mapping).find(
        // 这里用 any 是为了兼容外部数据结构，避免类型误判
        ([, value]) => (value as any)?.target_static_index === staticIndex
      );

      if (matchedDecadalEntry) {
        const [decadalKey] = matchedDecadalEntry;
        const decadalPalaceName = decadalPalaceNameMap[decadalKey] || decadalKey;
        parts.push(`叠 大限${decadalPalaceName.replace(/宫$/, "")}`);
      }
    }
    
    return parts.join(" ");
  };
  
  // 生成全部12个宫位的映射
  // 修正：流年排宫方向应与大限一致，使用 (yearlyBaseIndex - i) % 12
  // 这样 sibling/spouse 等宫位不会出现顺序反向
  const mapping: Record<string, any> = {};
  for (let i = 0; i < palaceKeyNames.length; i++) {
    // 计算本命宫位索引：流年宫位索引i对应本命宫位索引 (yearlyBaseIndex - i) % 12
    // 加 12 是为了避免负数，保证索引在 0..11
    const staticIndex = (yearlyBaseIndex - i + 12) % 12;
    const keyName = palaceKeyNames[i];
    const staticPalace = palaces[staticIndex];
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/affd2388-a2f8-4ad0-b318-741134ec2d78',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'generateLLMPayload.ts:generateYearlyMapping:mapping',message:'流年生成映射',data:{i,keyName,staticIndex,staticPalaceName:staticPalace?.name},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion agent log
    
    mapping[keyName] = {
      target_static_index: staticIndex,
      overlapping_text: getOverlappingText(staticIndex, i),
    };
  }
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/affd2388-a2f8-4ad0-b318-741134ec2d78',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'generateLLMPayload.ts:generateYearlyMapping:result',message:'流年映射结果',data:{mappingKeys:Object.keys(mapping),sampleMapping:Object.entries(mapping).slice(0,3)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
  // #endregion agent log
  
  // 格式化流年四化
  const transformations = (yearly.mutagen || []).map((star: string) => {
    const stem = yearly.heavenlyStem || "";
    const sihuaList = SIHUA_MAP[stem] || [];
    const match = sihuaList.find(item => item.star === star);
    if (match) {
      const sihuaMap: Record<string, string> = {
        "禄": "化禄",
        "权": "化权",
        "科": "化科",
        "忌": "化忌"
      };
      return `${star}${sihuaMap[match.type] || `化${match.type}`}`;
    }
    return star;
  });
  
  // 检查流年化忌的 risk_alert：先入所在宫，再冲对宫
  const yearlySihuaList = SIHUA_MAP[yearly.heavenlyStem || ""] || [];
  const yearlyJiStar = yearlySihuaList.find(item => item.type === "忌")?.star;
  const yearRiskAlert = buildRiskAlert(palaces, yearlyJiStar, "流年");
  
  // 获取流年年份
  const yearDate = horoscope.solarDate ? new Date(horoscope.solarDate).getFullYear().toString() : "";
  
  return {
    year_date: yearDate,
    stem: yearly.heavenlyStem || "",
    branch: yearly.earthlyBranch || "",
    mapping,
    transformations,
    risk_alert: yearRiskAlert,
  };
}

/**
 * 生成流月映射数据（结构与流年一致，方便前端和 LLM 统一解析）
 */
function generateMonthlyMapping(
  astrolabe: any,
  horoscope: any,
  decadalMapping: any,
  yearlyMapping: any
): any {
  const monthly = horoscope?.monthly;
  if (!monthly) return null;

  const palaces = astrolabe.palaces || [];
  const monthlyBaseIndex = monthly.index ?? -1;
  if (monthlyBaseIndex < 0 || monthlyBaseIndex >= 12) {
    return null;
  }

  const palaceKeyNames = [
    "life_palace",
    "sibling_palace",
    "spouse_palace",
    "children_palace",
    "wealth_palace",
    "health_palace",
    "travel_palace",
    "friend_palace",
    "career_palace",
    "property_palace",
    "fortune_palace",
    "parent_palace",
  ];

  // 流月叠宫描述：本命 + 大限 + 流年
  const getOverlappingText = (staticIndex: number): string => {
    if (staticIndex < 0) return "";
    const staticPalaceName =
      PALACE_NAME_MAP[palaces[staticIndex]?.name] ||
      palaces[staticIndex]?.name?.replace(/宫$/, "") ||
      "";
    const parts = [`本命${staticPalaceName}`];

    if (decadalMapping?.mapping) {
      const decadalPalaceNameMap: Record<string, string> = {
        life_palace: "命宫",
        sibling_palace: "兄弟宫",
        spouse_palace: "夫妻宫",
        children_palace: "子女宫",
        wealth_palace: "财帛宫",
        health_palace: "疾厄宫",
        travel_palace: "迁移宫",
        friend_palace: "交友宫",
        career_palace: "官禄宫",
        property_palace: "田宅宫",
        fortune_palace: "福德宫",
        parent_palace: "父母宫",
      };
      const matchedDecadalEntry = Object.entries(decadalMapping.mapping).find(
        ([, value]) => (value as any)?.target_static_index === staticIndex
      );
      if (matchedDecadalEntry) {
        const [decadalKey] = matchedDecadalEntry;
        const decadalPalaceName = decadalPalaceNameMap[decadalKey] || decadalKey;
        parts.push(`叠 大限${decadalPalaceName.replace(/宫$/, "")}`);
      }
    }

    if (yearlyMapping?.mapping) {
      const yearlyPalaceNameMap: Record<string, string> = {
        life_palace: "命宫",
        sibling_palace: "兄弟宫",
        spouse_palace: "夫妻宫",
        children_palace: "子女宫",
        wealth_palace: "财帛宫",
        health_palace: "疾厄宫",
        travel_palace: "迁移宫",
        friend_palace: "交友宫",
        career_palace: "官禄宫",
        property_palace: "田宅宫",
        fortune_palace: "福德宫",
        parent_palace: "父母宫",
      };
      const matchedYearlyEntry = Object.entries(yearlyMapping.mapping).find(
        ([, value]) => (value as any)?.target_static_index === staticIndex
      );
      if (matchedYearlyEntry) {
        const [yearlyKey] = matchedYearlyEntry;
        const yearlyPalaceName = yearlyPalaceNameMap[yearlyKey] || yearlyKey;
        parts.push(`叠 流年${yearlyPalaceName.replace(/宫$/, "")}`);
      }
    }

    return parts.join(" ");
  };

  const mapping: Record<string, any> = {};
  for (let i = 0; i < palaceKeyNames.length; i++) {
    // 修正：流月排宫方向应与流年/大限一致，使用 (monthlyBaseIndex - i) % 12
    // 加 12 是为了避免负数，保证索引在 0..11
    const staticIndex = (monthlyBaseIndex - i + 12) % 12;
    const keyName = palaceKeyNames[i];
    mapping[keyName] = {
      target_static_index: staticIndex,
      overlapping_text: getOverlappingText(staticIndex),
    };
  }

  const transformations = (monthly.mutagen || []).map((star: string) => {
    const stem = monthly.heavenlyStem || "";
    const sihuaList = SIHUA_MAP[stem] || [];
    const match = sihuaList.find((item) => item.star === star);
    if (match) {
      const sihuaMap: Record<string, string> = {
        禄: "化禄",
        权: "化权",
        科: "化科",
        忌: "化忌",
      };
      return `${star}${sihuaMap[match.type] || `化${match.type}`}`;
    }
    return star;
  });

  // 检查流月化忌的 risk_alert：先入所在宫，再冲对宫
  const monthlySihuaList = SIHUA_MAP[monthly.heavenlyStem || ""] || [];
  const monthlyJiStar = monthlySihuaList.find((item) => item.type === "忌")?.star;
  const monthRiskAlert = buildRiskAlert(palaces, monthlyJiStar, "流月");

  const solarDate = horoscope?.solarDate ?? "";
  const [yearText, monthText] = typeof solarDate === "string" ? solarDate.split("-") : [];
  const monthDate = yearText && monthText ? `${yearText}-${monthText}` : "";

  return {
    month_date: monthDate,
    stem: monthly.heavenlyStem || "",
    branch: monthly.earthlyBranch || "",
    mapping,
    transformations,
    risk_alert: monthRiskAlert,
  };
}

/**
 * 生成流日映射数据（结构与流月一致，便于前端统一解析）
 */
function generateDailyMapping(
  astrolabe: any,
  horoscope: any,
  decadalMapping: any,
  yearlyMapping: any,
  monthlyMapping: any
): any {
  const daily = horoscope?.daily;
  if (!daily) return null;

  const palaces = astrolabe.palaces || [];
  const dailyBaseIndex = daily.index ?? -1;
  if (dailyBaseIndex < 0 || dailyBaseIndex >= 12) {
    return null;
  }

  const palaceKeyNames = [
    "life_palace",
    "sibling_palace",
    "spouse_palace",
    "children_palace",
    "wealth_palace",
    "health_palace",
    "travel_palace",
    "friend_palace",
    "career_palace",
    "property_palace",
    "fortune_palace",
    "parent_palace",
  ];

  // 流日叠宫描述：本命 + 大限 + 流年 + 流月
  const getOverlappingText = (staticIndex: number): string => {
    if (staticIndex < 0) return "";
    const staticPalaceName =
      PALACE_NAME_MAP[palaces[staticIndex]?.name] ||
      palaces[staticIndex]?.name?.replace(/宫$/, "") ||
      "";
    const parts = [`本命${staticPalaceName}`];

    const palaceNameMap: Record<string, string> = {
      life_palace: "命宫",
      sibling_palace: "兄弟宫",
      spouse_palace: "夫妻宫",
      children_palace: "子女宫",
      wealth_palace: "财帛宫",
      health_palace: "疾厄宫",
      travel_palace: "迁移宫",
      friend_palace: "交友宫",
      career_palace: "官禄宫",
      property_palace: "田宅宫",
      fortune_palace: "福德宫",
      parent_palace: "父母宫",
    };

    if (decadalMapping?.mapping) {
      const matchedDecadalEntry = Object.entries(decadalMapping.mapping).find(
        ([, value]) => (value as any)?.target_static_index === staticIndex
      );
      if (matchedDecadalEntry) {
        const [decadalKey] = matchedDecadalEntry;
        parts.push(`叠 大限${(palaceNameMap[decadalKey] || decadalKey).replace(/宫$/, "")}`);
      }
    }

    if (yearlyMapping?.mapping) {
      const matchedYearlyEntry = Object.entries(yearlyMapping.mapping).find(
        ([, value]) => (value as any)?.target_static_index === staticIndex
      );
      if (matchedYearlyEntry) {
        const [yearlyKey] = matchedYearlyEntry;
        parts.push(`叠 流年${(palaceNameMap[yearlyKey] || yearlyKey).replace(/宫$/, "")}`);
      }
    }

    if (monthlyMapping?.mapping) {
      const matchedMonthlyEntry = Object.entries(monthlyMapping.mapping).find(
        ([, value]) => (value as any)?.target_static_index === staticIndex
      );
      if (matchedMonthlyEntry) {
        const [monthlyKey] = matchedMonthlyEntry;
        parts.push(`叠 流月${(palaceNameMap[monthlyKey] || monthlyKey).replace(/宫$/, "")}`);
      }
    }

    return parts.join(" ");
  };

  const mapping: Record<string, any> = {};
  for (let i = 0; i < palaceKeyNames.length; i++) {
    // 流日排宫方向与大限/流年/流月保持一致
    const staticIndex = (dailyBaseIndex - i + 12) % 12;
    const keyName = palaceKeyNames[i];
    mapping[keyName] = {
      target_static_index: staticIndex,
      overlapping_text: getOverlappingText(staticIndex),
    };
  }

  const transformations = (daily.mutagen || []).map((star: string) => {
    const stem = daily.heavenlyStem || "";
    const sihuaList = SIHUA_MAP[stem] || [];
    const match = sihuaList.find((item) => item.star === star);
    if (match) {
      const sihuaMap: Record<string, string> = {
        禄: "化禄",
        权: "化权",
        科: "化科",
        忌: "化忌",
      };
      return `${star}${sihuaMap[match.type] || `化${match.type}`}`;
    }
    return star;
  });

  // 检查流日化忌的 risk_alert：先入所在宫，再冲对宫
  const dailySihuaList = SIHUA_MAP[daily.heavenlyStem || ""] || [];
  const dailyJiStar = dailySihuaList.find((item) => item.type === "忌")?.star;
  const dayRiskAlert = buildRiskAlert(palaces, dailyJiStar, "流日");

  const solarDate = horoscope?.solarDate ?? "";
  const dayDate = typeof solarDate === "string" ? solarDate : "";

  return {
    day_date: dayDate,
    stem: daily.heavenlyStem || "",
    branch: daily.earthlyBranch || "",
    mapping,
    transformations,
    risk_alert: dayRiskAlert,
  };
}

/**
 * 统一生成某个时间点的运限结构，给“多选运势 JSON”复用
 */
export function buildHoroscopeSlice(
  astrolabe: any,
  horoscope: any,
  options?: {
    includeDecade?: boolean;
    includeYear?: boolean;
    includeMonth?: boolean;
    includeDay?: boolean;
  }
) {
  const includeDecade = options?.includeDecade ?? true;
  const includeYear = options?.includeYear ?? true;
  const includeMonth = options?.includeMonth ?? true;
  const includeDay = options?.includeDay ?? true;

  // 为了保证“叠宫”描述正确，内部仍按大限→流年→流月→流日顺序生成
  const needDecadal = includeDecade || includeYear || includeMonth || includeDay;
  const needYearly = includeYear || includeMonth || includeDay;
  const needMonthly = includeMonth || includeDay;
  const decadalMapping = needDecadal ? generateDecadalMapping(astrolabe, horoscope) : null;
  const yearlyMapping = needYearly
    ? generateYearlyMapping(astrolabe, horoscope, decadalMapping)
    : null;
  const monthlyMapping = needMonthly
    ? generateMonthlyMapping(astrolabe, horoscope, decadalMapping, yearlyMapping)
    : null;
  const dailyMapping = includeDay
    ? generateDailyMapping(
        astrolabe,
        horoscope,
        decadalMapping,
        yearlyMapping,
        monthlyMapping
      )
    : null;

  const slice: Record<string, any> = {};
  if (includeDecade) slice.decade = decadalMapping;
  if (includeYear) slice.year = yearlyMapping;
  if (includeMonth) slice.month = monthlyMapping;
  if (includeDay) slice.day = dailyMapping;
  return slice;
}

/**
 * 主函数：生成 LLM 可用的 JSON 数据
 * @param astrolabe iztro 原始星盘数据
 * @param horoscope iztro 原始运限数据
 * @param form 表单数据（包含性别、出生日期等）
 * @returns 格式化后的 JSON 对象
 */
export function generateLLMPayload(
  astrolabe: any,
  _horoscope: any,
  form: { gender: "男" | "女"; birthday: string; birthTime: string },
  options?: {
    includeCurrentTimeSlice?: boolean;
  }
): any {
  if (!astrolabe) {
    throw new Error("缺少星盘数据");
  }
  
  // 生成本命盘静态数据
  const staticPalaces = generateStaticPalaces(astrolabe);
  
  // 是否保留当前运限切片（用于“生成星盘 JSON”）
  const includeCurrentTimeSlice = options?.includeCurrentTimeSlice ?? true;
  const currentSlice = includeCurrentTimeSlice
    ? buildHoroscopeSlice(astrolabe, _horoscope)
    : null;

  // 获取阴历日期（从 astrolabe 中提取）
  const lunarDate = astrolabe.lunarDate || "";
  // 生年天干：优先用 rawDates.chineseDate.yearly[0]，否则从中文干支字符串取首字
  const birthYearStem =
    astrolabe?.rawDates?.chineseDate?.yearly?.[0] ||
    (typeof astrolabe?.chineseDate === "string"
      ? astrolabe.chineseDate.split(" ")?.[0]?.charAt(0) || ""
      : "");
  // 把性别统一补充阴阳属性，方便后续 prompt/分析直接使用。
  const genderWithYinYang = formatGenderWithYinYang(form.gender, birthYearStem);
  
  // 构建最终 JSON（只包含本命盘，运势切片在另外的流程里按需附加）
  const payload: Record<string, any> = {
    metadata: {
      gender: genderWithYinYang,
      lunar_birth_date: lunarDate,
      birth_year_stem: birthYearStem,
      five_elements_bureau: astrolabe.fiveElementsClass || "",
      life_master: astrolabe.soul || "",
      body_master: astrolabe.body || "",
    },
    static_palaces: staticPalaces,
  };
  if (includeCurrentTimeSlice) {
    payload.current_time_slice = currentSlice;
  }
  return payload;
}

