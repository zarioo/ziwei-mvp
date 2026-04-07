import 'dart:convert';

import 'package:flutter/cupertino.dart';

enum AppTab { home, script, chat }

enum Gender { male, female }

enum HoroscopeScope { decadal, yearly, monthly, daily, hourly }

enum MessageRole { user, assistant }

typedef JsonMap = Map<String, dynamic>;

class FormStateModel {
  const FormStateModel({
    required this.name,
    required this.gender,
    required this.birthday,
    required this.birthTime,
    required this.birthplace,
  });

  factory FormStateModel.defaults() {
    return const FormStateModel(
      name: '',
      gender: Gender.female,
      birthday: '1991-08-26',
      birthTime: '20:00',
      birthplace: '',
    );
  }

  factory FormStateModel.fromJson(JsonMap json) {
    return FormStateModel(
      name: json['name'] as String? ?? '',
      gender: (json['gender'] as String? ?? '女') == '男'
          ? Gender.male
          : Gender.female,
      birthday: json['birthday'] as String? ?? '',
      birthTime: json['birthTime'] as String? ?? '',
      birthplace: json['birthplace'] as String? ?? '',
    );
  }

  final String name;
  final Gender gender;
  final String birthday;
  final String birthTime;
  final String birthplace;

  String get genderLabel => gender == Gender.male ? '男' : '女';

  FormStateModel copyWith({
    String? name,
    Gender? gender,
    String? birthday,
    String? birthTime,
    String? birthplace,
  }) {
    return FormStateModel(
      name: name ?? this.name,
      gender: gender ?? this.gender,
      birthday: birthday ?? this.birthday,
      birthTime: birthTime ?? this.birthTime,
      birthplace: birthplace ?? this.birthplace,
    );
  }

  JsonMap toJson() {
    return {
      'name': name,
      'gender': genderLabel,
      'birthday': birthday,
      'birthTime': birthTime,
      'birthplace': birthplace,
    };
  }
}

class PanelInput {
  const PanelInput({
    required this.calendar,
    required this.date,
    required this.timeIndex,
    required this.gender,
    required this.fixLeap,
    required this.isLeapMonth,
    required this.language,
  });

  factory PanelInput.fromJson(JsonMap json) {
    return PanelInput(
      calendar: json['calendar'] as String? ?? 'solar',
      date: json['date'] as String? ?? '',
      timeIndex: json['timeIndex'] as int? ?? 0,
      gender: json['gender'] as String? ?? '女',
      fixLeap: json['fixLeap'] as bool? ?? true,
      isLeapMonth: json['isLeapMonth'] as bool? ?? false,
      language: json['language'] as String? ?? 'zh-CN',
    );
  }

  final String calendar;
  final String date;
  final int timeIndex;
  final String gender;
  final bool fixLeap;
  final bool isLeapMonth;
  final String language;

  JsonMap toJson() {
    return {
      'calendar': calendar,
      'date': date,
      'timeIndex': timeIndex,
      'gender': gender,
      'fixLeap': fixLeap,
      'isLeapMonth': isLeapMonth,
      'language': language,
    };
  }
}

class PalaceSummary {
  const PalaceSummary({
    required this.displayName,
    required this.dizhi,
    required this.tianGan,
    required this.majorStars,
    required this.minorStars,
  });

  factory PalaceSummary.fromJson(JsonMap json) {
    return PalaceSummary(
      displayName: json['displayName'] as String? ?? '',
      dizhi: json['dizhi'] as String? ?? '',
      tianGan: json['tianGan'] as String? ?? '',
      majorStars:
          ((json['majorStars'] as List<dynamic>? ?? const [])
                  .map((item) => item as JsonMap)
                  .map((item) => item['name'] as String? ?? '')
                  .where((item) => item.isNotEmpty))
              .toList(),
      minorStars:
          ((json['minorStars'] as List<dynamic>? ?? const [])
                  .map((item) => item as JsonMap)
                  .map((item) => item['name'] as String? ?? '')
                  .where((item) => item.isNotEmpty))
              .toList(),
    );
  }

  final String displayName;
  final String dizhi;
  final String tianGan;
  final List<String> majorStars;
  final List<String> minorStars;

  JsonMap toJson() {
    return {
      'displayName': displayName,
      'dizhi': dizhi,
      'tianGan': tianGan,
      'majorStars': majorStars.map((name) => {'name': name}).toList(),
      'minorStars': minorStars.map((name) => {'name': name}).toList(),
    };
  }
}

class NatalChartData {
  const NatalChartData({
    required this.solarBirthDate,
    required this.lunarBirthDate,
    required this.wuxingju,
    required this.mingzhu,
    required this.shenzhu,
    required this.palaces,
    required this.rawAstrolabe,
    required this.rawHoroscope,
    required this.horoscopeDate,
    required this.horoscopeHour,
  });

  factory NatalChartData.fromJson(JsonMap json) {
    return NatalChartData(
      solarBirthDate: json['solarBirthDate'] as String?,
      lunarBirthDate: json['lunarBirthDate'] as String?,
      wuxingju: json['wuxingju'] as String?,
      mingzhu: json['mingzhu'] as String?,
      shenzhu: json['shenzhu'] as String?,
      palaces: ((json['palaces'] as List<dynamic>? ?? const []).map(
        (item) => PalaceSummary.fromJson(item as JsonMap),
      )).toList(),
      rawAstrolabe: Map<String, dynamic>.from(
        json['rawAstrolabe'] as Map<dynamic, dynamic>? ?? const {},
      ),
      rawHoroscope: Map<String, dynamic>.from(
        json['rawHoroscope'] as Map<dynamic, dynamic>? ?? const {},
      ),
      horoscopeDate: DateTime.tryParse(json['horoscopeDate'] as String? ?? ''),
      horoscopeHour: json['horoscopeHour'] as int? ?? 0,
    );
  }

  final String? solarBirthDate;
  final String? lunarBirthDate;
  final String? wuxingju;
  final String? mingzhu;
  final String? shenzhu;
  final List<PalaceSummary> palaces;
  final JsonMap rawAstrolabe;
  final JsonMap rawHoroscope;
  final DateTime? horoscopeDate;
  final int horoscopeHour;

  NatalChartData copyWith({
    JsonMap? rawHoroscope,
    DateTime? horoscopeDate,
    int? horoscopeHour,
  }) {
    return NatalChartData(
      solarBirthDate: solarBirthDate,
      lunarBirthDate: lunarBirthDate,
      wuxingju: wuxingju,
      mingzhu: mingzhu,
      shenzhu: shenzhu,
      palaces: palaces,
      rawAstrolabe: rawAstrolabe,
      rawHoroscope: rawHoroscope ?? this.rawHoroscope,
      horoscopeDate: horoscopeDate ?? this.horoscopeDate,
      horoscopeHour: horoscopeHour ?? this.horoscopeHour,
    );
  }

  JsonMap toJson() {
    return {
      'solarBirthDate': solarBirthDate,
      'lunarBirthDate': lunarBirthDate,
      'wuxingju': wuxingju,
      'mingzhu': mingzhu,
      'shenzhu': shenzhu,
      'palaces': palaces.map((item) => item.toJson()).toList(),
      'rawAstrolabe': rawAstrolabe,
      'rawHoroscope': rawHoroscope,
      'horoscopeDate': horoscopeDate?.toIso8601String(),
      'horoscopeHour': horoscopeHour,
    };
  }
}

class Attachment {
  const Attachment({required this.name, required this.content});

  factory Attachment.fromJson(JsonMap json) {
    return Attachment(
      name: json['name'] as String? ?? '',
      content: json['content'] as String? ?? '',
    );
  }

  final String name;
  final String content;

  JsonMap toJson() => {'name': name, 'content': content};
}

class ChatMessageModel {
  const ChatMessageModel({
    required this.id,
    required this.role,
    required this.content,
    required this.displayContent,
    required this.attachments,
    required this.reasoning,
    required this.createdAt,
  });

  factory ChatMessageModel.fromJson(JsonMap json) {
    final roleText = json['role'] as String? ?? 'assistant';
    return ChatMessageModel(
      id: json['id'] as String? ?? '',
      role: roleText == 'user' ? MessageRole.user : MessageRole.assistant,
      content: json['content'] as String? ?? '',
      displayContent: json['displayContent'] as String? ?? '',
      attachments: ((json['attachments'] as List<dynamic>? ?? const []).map(
        (item) => Attachment.fromJson(item as JsonMap),
      )).toList(),
      reasoning: json['reasoning'] as String?,
      createdAt: json['createdAt'] as int? ?? 0,
    );
  }

  final String id;
  final MessageRole role;
  final String content;
  final String displayContent;
  final List<Attachment> attachments;
  final String? reasoning;
  final int createdAt;

  String get roleLabel => role == MessageRole.user ? 'user' : 'assistant';

  ChatMessageModel copyWith({
    String? content,
    String? displayContent,
    String? reasoning,
  }) {
    return ChatMessageModel(
      id: id,
      role: role,
      content: content ?? this.content,
      displayContent: displayContent ?? this.displayContent,
      attachments: attachments,
      reasoning: reasoning ?? this.reasoning,
      createdAt: createdAt,
    );
  }

  JsonMap toJson() {
    return {
      'id': id,
      'role': roleLabel,
      'content': content,
      'displayContent': displayContent,
      'attachments': attachments.map((item) => item.toJson()).toList(),
      'reasoning': reasoning,
      'createdAt': createdAt,
    };
  }
}

class ConversationModel {
  const ConversationModel({
    required this.id,
    required this.title,
    required this.createdAt,
    required this.updatedAt,
    required this.messages,
  });

  factory ConversationModel.create() {
    final now = DateTime.now().millisecondsSinceEpoch;
    return ConversationModel(
      id: 'conv-$now',
      title: '新对话',
      createdAt: now,
      updatedAt: now,
      messages: const [],
    );
  }

  factory ConversationModel.fromJson(JsonMap json) {
    return ConversationModel(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '新对话',
      createdAt: json['createdAt'] as int? ?? 0,
      updatedAt: json['updatedAt'] as int? ?? 0,
      messages: ((json['messages'] as List<dynamic>? ?? const []).map(
        (item) => ChatMessageModel.fromJson(item as JsonMap),
      )).toList(),
    );
  }

  final String id;
  final String title;
  final int createdAt;
  final int updatedAt;
  final List<ChatMessageModel> messages;

  ConversationModel copyWith({
    String? title,
    int? updatedAt,
    List<ChatMessageModel>? messages,
  }) {
    return ConversationModel(
      id: id,
      title: title ?? this.title,
      createdAt: createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      messages: messages ?? this.messages,
    );
  }

  JsonMap toJson() {
    return {
      'id': id,
      'title': title,
      'createdAt': createdAt,
      'updatedAt': updatedAt,
      'messages': messages.map((item) => item.toJson()).toList(),
    };
  }
}

class ScriptMeta {
  const ScriptMeta({
    required this.fileName,
    required this.modelId,
    required this.prompt,
    required this.generatedAt,
  });

  factory ScriptMeta.fromJson(JsonMap json) {
    return ScriptMeta(
      fileName: json['fileName'] as String? ?? '',
      modelId: json['modelId'] as String? ?? 'seed-1-8-thinking',
      prompt: json['prompt'] as String? ?? '',
      generatedAt: json['generatedAt'] as int? ?? 0,
    );
  }

  final String fileName;
  final String modelId;
  final String prompt;
  final int generatedAt;

  JsonMap toJson() {
    return {
      'fileName': fileName,
      'modelId': modelId,
      'prompt': prompt,
      'generatedAt': generatedAt,
    };
  }
}

class ModelOption {
  const ModelOption({
    required this.id,
    required this.label,
    required this.supportsFileUpload,
  });

  final String id;
  final String label;
  final bool supportsFileUpload;
}

const defaultChatPrompt =
    '你是紫微斗数大师倪海厦，请你用毕生所学，为这位用户解析她的整体命运（json是她紫微斗数命盘及各个大限的数据），要求必须严谨，不要出现错误、实事求是、不要说客套话。';

const lifeScriptPrompt = defaultChatPrompt;

const modelOptions = <ModelOption>[
  ModelOption(
    id: 'seed-1-8-thinking',
    label: 'ByteDance Seed 1.8',
    supportsFileUpload: true,
  ),
  ModelOption(
    id: 'gemini3pro',
    label: 'Gemini 3 Pro',
    supportsFileUpload: true,
  ),
  ModelOption(id: 'gpt53', label: 'GPT 5.3', supportsFileUpload: false),
  ModelOption(
    id: 'kimi-thinking',
    label: 'Kimi Thinking',
    supportsFileUpload: true,
  ),
];

class FortunePoint {
  const FortunePoint({required this.age, required this.value});

  final int age;
  final int value;
}

class FortuneMetric {
  const FortuneMetric({
    required this.id,
    required this.label,
    required this.color,
    required this.fillColor,
    required this.points,
  });

  final String id;
  final String label;
  final Color color;
  final Color fillColor;
  final List<FortunePoint> points;
}

class AppSnapshot {
  const AppSnapshot({
    required this.activeTab,
    required this.selectedHoroscopeScope,
    required this.form,
    required this.panelInput,
    required this.chartData,
    required this.chatInput,
    required this.conversations,
    required this.activeConversationId,
    required this.chatModelId,
    required this.generatedJson,
    required this.lifeScriptText,
    required this.lifeScriptMeta,
    required this.attachments,
  });

  factory AppSnapshot.fromJsonString(String value) {
    return AppSnapshot.fromJson(jsonDecode(value) as Map<String, dynamic>);
  }

  factory AppSnapshot.fromJson(JsonMap json) {
    return AppSnapshot(
      activeTab: AppTab.values.firstWhere(
        (item) => item.name == (json['activeTab'] as String? ?? 'home'),
        orElse: () => AppTab.home,
      ),
      selectedHoroscopeScope: HoroscopeScope.values.firstWhere(
        (item) =>
            item.name ==
            (json['selectedHoroscopeScope'] as String? ?? 'yearly'),
        orElse: () => HoroscopeScope.yearly,
      ),
      form: FormStateModel.fromJson(
        Map<String, dynamic>.from(json['form'] as Map<dynamic, dynamic>? ?? {}),
      ),
      panelInput: json['panelInput'] == null
          ? null
          : PanelInput.fromJson(
              Map<String, dynamic>.from(
                json['panelInput'] as Map<dynamic, dynamic>,
              ),
            ),
      chartData: json['chartData'] == null
          ? null
          : NatalChartData.fromJson(
              Map<String, dynamic>.from(
                json['chartData'] as Map<dynamic, dynamic>,
              ),
            ),
      chatInput: json['chatInput'] as String? ?? defaultChatPrompt,
      conversations: ((json['conversations'] as List<dynamic>? ?? const []).map(
        (item) => ConversationModel.fromJson(item as JsonMap),
      )).toList(),
      activeConversationId: json['activeConversationId'] as String? ?? '',
      chatModelId: json['chatModelId'] as String? ?? 'seed-1-8-thinking',
      generatedJson: json['generatedJson'] == null
          ? null
          : Attachment.fromJson(
              Map<String, dynamic>.from(
                json['generatedJson'] as Map<dynamic, dynamic>,
              ),
            ),
      lifeScriptText: json['lifeScriptText'] as String? ?? '',
      lifeScriptMeta: json['lifeScriptMeta'] == null
          ? null
          : ScriptMeta.fromJson(
              Map<String, dynamic>.from(
                json['lifeScriptMeta'] as Map<dynamic, dynamic>,
              ),
            ),
      attachments: ((json['attachments'] as List<dynamic>? ?? const []).map(
        (item) => Attachment.fromJson(item as JsonMap),
      )).toList(),
    );
  }

  final AppTab activeTab;
  final HoroscopeScope selectedHoroscopeScope;
  final FormStateModel form;
  final PanelInput? panelInput;
  final NatalChartData? chartData;
  final String chatInput;
  final List<ConversationModel> conversations;
  final String activeConversationId;
  final String chatModelId;
  final Attachment? generatedJson;
  final String lifeScriptText;
  final ScriptMeta? lifeScriptMeta;
  final List<Attachment> attachments;

  JsonMap toJson() {
    return {
      'activeTab': activeTab.name,
      'selectedHoroscopeScope': selectedHoroscopeScope.name,
      'form': form.toJson(),
      'panelInput': panelInput?.toJson(),
      'chartData': chartData?.toJson(),
      'chatInput': chatInput,
      'conversations': conversations.map((item) => item.toJson()).toList(),
      'activeConversationId': activeConversationId,
      'chatModelId': chatModelId,
      'generatedJson': generatedJson?.toJson(),
      'lifeScriptText': lifeScriptText,
      'lifeScriptMeta': lifeScriptMeta?.toJson(),
      'attachments': attachments.map((item) => item.toJson()).toList(),
    };
  }

  String toJsonString() => jsonEncode(toJson());
}
