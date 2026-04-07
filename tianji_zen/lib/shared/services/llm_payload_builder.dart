import '../models/app_models.dart';

class LlmPayloadBuilder {
  static const _palaceNameMap = <String, String>{
    '命宫': '命宫',
    '兄弟宫': '兄弟',
    '兄弟': '兄弟',
    '夫妻宫': '夫妻',
    '夫妻': '夫妻',
    '子女宫': '子女',
    '子女': '子女',
    '财帛宫': '财帛',
    '财帛': '财帛',
    '疾厄宫': '疾厄',
    '疾厄': '疾厄',
    '迁移宫': '迁移',
    '迁移': '迁移',
    '交友宫': '交友',
    '交友': '交友',
    '官禄宫': '官禄',
    '官禄': '官禄',
    '田宅宫': '田宅',
    '田宅': '田宅',
    '福德宫': '福德',
    '福德': '福德',
    '父母宫': '父母',
    '父母': '父母',
  };

  static const _scopePalaceKeys = <String>[
    'life_palace',
    'sibling_palace',
    'spouse_palace',
    'children_palace',
    'wealth_palace',
    'health_palace',
    'travel_palace',
    'friend_palace',
    'career_palace',
    'property_palace',
    'fortune_palace',
    'parent_palace',
  ];

  static const _scopePalaceLabels = <String, String>{
    'life_palace': '命宫',
    'sibling_palace': '兄弟宫',
    'spouse_palace': '夫妻宫',
    'children_palace': '子女宫',
    'wealth_palace': '财帛宫',
    'health_palace': '疾厄宫',
    'travel_palace': '迁移宫',
    'friend_palace': '交友宫',
    'career_palace': '官禄宫',
    'property_palace': '田宅宫',
    'fortune_palace': '福德宫',
    'parent_palace': '父母宫',
  };

  static const _sihuaMap = <String, List<Map<String, String>>>{
    '甲': [
      {'star': '廉贞', 'type': '禄'},
      {'star': '破军', 'type': '权'},
      {'star': '武曲', 'type': '科'},
      {'star': '太阳', 'type': '忌'},
    ],
    '乙': [
      {'star': '天机', 'type': '禄'},
      {'star': '天梁', 'type': '权'},
      {'star': '紫微', 'type': '科'},
      {'star': '太阴', 'type': '忌'},
    ],
    '丙': [
      {'star': '天同', 'type': '禄'},
      {'star': '天机', 'type': '权'},
      {'star': '文昌', 'type': '科'},
      {'star': '廉贞', 'type': '忌'},
    ],
    '丁': [
      {'star': '太阴', 'type': '禄'},
      {'star': '天同', 'type': '权'},
      {'star': '天机', 'type': '科'},
      {'star': '巨门', 'type': '忌'},
    ],
    '戊': [
      {'star': '贪狼', 'type': '禄'},
      {'star': '太阴', 'type': '权'},
      {'star': '右弼', 'type': '科'},
      {'star': '天机', 'type': '忌'},
    ],
    '己': [
      {'star': '武曲', 'type': '禄'},
      {'star': '贪狼', 'type': '权'},
      {'star': '天梁', 'type': '科'},
      {'star': '文曲', 'type': '忌'},
    ],
    '庚': [
      {'star': '太阳', 'type': '禄'},
      {'star': '武曲', 'type': '权'},
      {'star': '太阴', 'type': '科'},
      {'star': '天同', 'type': '忌'},
    ],
    '辛': [
      {'star': '巨门', 'type': '禄'},
      {'star': '太阳', 'type': '权'},
      {'star': '文曲', 'type': '科'},
      {'star': '文昌', 'type': '忌'},
    ],
    '壬': [
      {'star': '天梁', 'type': '禄'},
      {'star': '紫微', 'type': '权'},
      {'star': '左辅', 'type': '科'},
      {'star': '武曲', 'type': '忌'},
    ],
    '癸': [
      {'star': '破军', 'type': '禄'},
      {'star': '巨门', 'type': '权'},
      {'star': '太阴', 'type': '科'},
      {'star': '贪狼', 'type': '忌'},
    ],
  };

  JsonMap generatePayload({
    required JsonMap astrolabe,
    required JsonMap horoscope,
    required FormStateModel form,
    bool includeCurrentTimeSlice = true,
  }) {
    final rawDates = astrolabe['rawDates'] as JsonMap?;
    final chineseDate = rawDates?['chineseDate'] as JsonMap?;
    final yearly = chineseDate?['yearly'] as List<dynamic>?;
    final birthYearStem = yearly != null && yearly.isNotEmpty
        ? yearly.first as String? ?? ''
        : '';

    return {
      'metadata': {
        'gender': _formatGenderWithYinYang(form.genderLabel, birthYearStem),
        'lunar_birth_date': astrolabe['lunarDate'] as String? ?? '',
        'birth_year_stem': birthYearStem,
        'five_elements_bureau': astrolabe['fiveElementsClass'] as String? ?? '',
        'life_master': astrolabe['soul'] as String? ?? '',
        'body_master': astrolabe['body'] as String? ?? '',
      },
      'static_palaces': _generateStaticPalaces(astrolabe),
      if (includeCurrentTimeSlice)
        'current_time_slice': buildHoroscopeSlice(
          astrolabe: astrolabe,
          horoscope: horoscope,
        ),
    };
  }

  JsonMap buildHoroscopeSlice({
    required JsonMap astrolabe,
    required JsonMap horoscope,
    bool includeDecade = true,
    bool includeYear = true,
    bool includeMonth = true,
    bool includeDay = true,
  }) {
    final decadal = includeDecade || includeYear || includeMonth || includeDay
        ? _buildScopeMapping(
            scopeLabel: '大限',
            dateField: 'name',
            horoscopeNode: horoscope['decadal'] as JsonMap?,
            astrolabe: astrolabe,
          )
        : null;
    final yearly = includeYear || includeMonth || includeDay
        ? _buildScopeMapping(
            scopeLabel: '流年',
            dateField: 'year_date',
            horoscopeNode: horoscope['yearly'] as JsonMap?,
            astrolabe: astrolabe,
            ancestors: [decadal],
            dateValue: (() {
              final solarDate = horoscope['solarDate'] as String? ?? '';
              final parts = solarDate.split('-');
              return parts.isEmpty ? '' : parts.first;
            })(),
          )
        : null;
    final monthly = includeMonth || includeDay
        ? _buildScopeMapping(
            scopeLabel: '流月',
            dateField: 'month_date',
            horoscopeNode: horoscope['monthly'] as JsonMap?,
            astrolabe: astrolabe,
            ancestors: [decadal, yearly],
            dateValue: (() {
              final solarDate = horoscope['solarDate'] as String? ?? '';
              final parts = solarDate.split('-');
              if (parts.length < 2) {
                return '';
              }
              return '${parts[0]}-${parts[1]}';
            })(),
          )
        : null;
    final daily = includeDay
        ? _buildScopeMapping(
            scopeLabel: '流日',
            dateField: 'day_date',
            horoscopeNode: horoscope['daily'] as JsonMap?,
            astrolabe: astrolabe,
            ancestors: [decadal, yearly, monthly],
            dateValue: horoscope['solarDate'] as String? ?? '',
          )
        : null;

    return {
      if (includeDecade) 'decade': decadal,
      if (includeYear) 'year': yearly,
      if (includeMonth) 'month': monthly,
      if (includeDay) 'day': daily,
    };
  }

  List<JsonMap> _generateStaticPalaces(JsonMap astrolabe) {
    final palaces = (astrolabe['palaces'] as List<dynamic>? ?? const [])
        .cast<JsonMap>();

    return palaces.map((palace) {
      final majorStars = _mapStarText(palace['majorStars'] as List<dynamic>?);
      final minorStars = _mapStarText(palace['minorStars'] as List<dynamic>?);
      final miniStars = _mapStarText(
        palace['adjectiveStars'] as List<dynamic>?,
      );
      final index = palace['index'] as int? ?? 0;
      return {
        'index': index,
        'name': _normalizePalaceName(palace['name'] as String? ?? ''),
        'is_body_palace': palace['isBodyPalace'] as bool? ?? false,
        'earthly_branch': palace['earthlyBranch'] as String? ?? '',
        'heavenly_stem': palace['heavenlyStem'] as String? ?? '',
        'major_stars': majorStars.isEmpty ? const ['无(空宫）'] : majorStars,
        'minor_stars': minorStars,
        'mini_stars': miniStars,
        'changsheng_phase': [
          if ((palace['changsheng12'] as String? ?? '').isNotEmpty)
            palace['changsheng12'],
        ],
        'misc_gods': {
          'doctor_12': palace['boshi12'] as String? ?? '',
          'year_12': palace['suiqian12'] as String? ?? '',
          'general_12': palace['jiangqian12'] as String? ?? '',
        },
        'relationships': _buildRelationships(index),
      };
    }).toList();
  }

  JsonMap _buildScopeMapping({
    required String scopeLabel,
    required String dateField,
    required JsonMap? horoscopeNode,
    required JsonMap astrolabe,
    List<JsonMap?> ancestors = const [],
    String? dateValue,
  }) {
    if (horoscopeNode == null) {
      return {};
    }

    final palaces = (astrolabe['palaces'] as List<dynamic>? ?? const [])
        .cast<JsonMap>();
    final baseIndex = horoscopeNode['index'] as int? ?? -1;
    if (baseIndex < 0 || baseIndex >= 12) {
      return {};
    }

    final mapping = <String, JsonMap>{};
    for (var i = 0; i < _scopePalaceKeys.length; i++) {
      final staticIndex = (baseIndex - i + 12) % 12;
      final staticName = _normalizePalaceName(
        palaces[staticIndex]['name'] as String? ?? '',
      );
      final parts = ['本命$staticName'];
      for (final ancestor in ancestors.whereType<JsonMap>()) {
        final ancestorMapping = ancestor['mapping'] as JsonMap?;
        if (ancestorMapping == null) {
          continue;
        }
        for (final entry in ancestorMapping.entries) {
          final targetIndex =
              (entry.value as JsonMap)['target_static_index'] as int?;
          if (targetIndex == staticIndex) {
            final label =
                _scopePalaceLabels[entry.key]?.replaceAll('宫', '') ?? entry.key;
            final prefix = ancestor['name'] as String? ?? '';
            if (prefix.isNotEmpty) {
              parts.add('叠 $prefix$label');
            }
            break;
          }
        }
      }
      mapping[_scopePalaceKeys[i]] = {
        'target_static_index': staticIndex,
        'overlapping_text': parts.join(' '),
      };
    }

    final stem = horoscopeNode['heavenlyStem'] as String? ?? '';
    final transformations =
        ((horoscopeNode['mutagen'] as List<dynamic>? ?? const [])
                .cast<String>())
            .map((star) => _formatTransformation(stem, star))
            .toList();

    return {
      'name': scopeLabel == '大限'
          ? horoscopeNode['name'] as String? ?? '大限'
          : scopeLabel,
      if (dateField.isNotEmpty) dateField: dateValue ?? '',
      'stem': stem,
      'branch': horoscopeNode['earthlyBranch'] as String? ?? '',
      'mapping': mapping,
      'transformations': transformations,
      'risk_alert': _buildRiskAlert(
        palaces: palaces,
        stem: stem,
        periodLabel: scopeLabel,
      ),
    };
  }

  List<String> _mapStarText(List<dynamic>? raw) {
    return (raw ?? const [])
        .cast<JsonMap>()
        .map(
          (star) => _formatStarName(
            star['name'] as String? ?? '',
            star['brightness'] as String? ?? '',
            star['mutagen'] as String? ?? '',
          ),
        )
        .where((item) => item.isNotEmpty)
        .toList();
  }

  JsonMap _buildRelationships(int index) {
    final oppositeIndex = (index + 6) % 12;
    return {
      'oppositeIndex': oppositeIndex,
      'wealthTrineIndex': (oppositeIndex + 2) % 12,
      'careerTrineIndex': (oppositeIndex - 2 + 12) % 12,
    };
  }

  String _normalizePalaceName(String palaceName) {
    return _palaceNameMap[palaceName] ?? palaceName.replaceAll('宫', '');
  }

  String _formatGenderWithYinYang(String gender, String birthYearStem) {
    const yangStems = {'甲', '丙', '戊', '庚', '壬'};
    const yinStems = {'乙', '丁', '己', '辛', '癸'};
    final normalizedStem = birthYearStem.trim().isEmpty
        ? ''
        : birthYearStem.trim().substring(0, 1);
    if (yangStems.contains(normalizedStem)) {
      return '阳$gender';
    }
    if (yinStems.contains(normalizedStem)) {
      return '阴$gender';
    }
    return gender;
  }

  String _formatStarName(String name, String brightness, String mutagen) {
    if (name.isEmpty) {
      return '';
    }
    var result = name;
    if (brightness.isNotEmpty) {
      result = '$result($brightness)';
    }
    if (mutagen.isNotEmpty) {
      const sihuaText = {'禄': '生年禄', '权': '生年权', '科': '生年科', '忌': '生年忌'};
      result = '$result-[${sihuaText[mutagen] ?? '生年$mutagen'}]';
    }
    return result;
  }

  String _formatTransformation(String stem, String star) {
    final matches = _sihuaMap[stem] ?? const [];
    final match = matches.firstWhere(
      (item) => item['star'] == star,
      orElse: () => const {},
    );
    final type = match['type'];
    const text = {'禄': '化禄', '权': '化权', '科': '化科', '忌': '化忌'};
    return type == null ? star : '$star${text[type] ?? '化$type'}';
  }

  String? _buildRiskAlert({
    required List<JsonMap> palaces,
    required String stem,
    required String periodLabel,
  }) {
    final sihuaList = _sihuaMap[stem] ?? const [];
    final jiStar = sihuaList.firstWhere(
      (item) => item['type'] == '忌',
      orElse: () => const {},
    )['star'];
    if (jiStar == null) {
      return null;
    }

    for (var i = 0; i < palaces.length; i++) {
      final palace = palaces[i];
      final allStars = [
        ...(palace['majorStars'] as List<dynamic>? ?? const []),
        ...(palace['minorStars'] as List<dynamic>? ?? const []),
      ].cast<JsonMap>();
      final hasStar = allStars.any((star) => star['name'] == jiStar);
      if (!hasStar) {
        continue;
      }
      final entryName = _normalizePalaceName(palace['name'] as String? ?? '');
      final oppositePalace = palaces[(i + 6) % 12];
      final oppositeName = _normalizePalaceName(
        oppositePalace['name'] as String? ?? '',
      );
      return '$jiStar-$periodLabel化忌 入 本命$entryName 冲 本命$oppositeName';
    }
    return null;
  }
}
