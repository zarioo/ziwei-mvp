import 'dart:async';

import 'package:flutter/foundation.dart';

import '../models/app_models.dart';
import '../repositories/chat_repository.dart';
import '../repositories/life_script_repository.dart';
import '../repositories/natal_chart_repository.dart';
import '../services/local_app_store.dart';
import '../services/ziwei_api_client.dart';
import '../utils/app_utils.dart';

class TianjiZenController extends ChangeNotifier {
  TianjiZenController({
    required LocalAppStore localStore,
    required NatalChartRepository natalChartRepository,
    required ChatRepository chatRepository,
    required LifeScriptRepository lifeScriptRepository,
  }) : _localStore = localStore,
       _natalChartRepository = natalChartRepository,
       _chatRepository = chatRepository,
       _lifeScriptRepository = lifeScriptRepository;

  final LocalAppStore _localStore;
  final NatalChartRepository _natalChartRepository;
  final ChatRepository _chatRepository;
  final LifeScriptRepository _lifeScriptRepository;

  String _apiBaseUrl = 'http://127.0.0.1:3000';
  bool _initialized = false;
  AppTab _activeTab = AppTab.home;
  HoroscopeScope _selectedHoroscopeScope = HoroscopeScope.yearly;
  FormStateModel _form = FormStateModel.defaults();
  PanelInput? _panelInput;
  NatalChartData? _chartData;
  String _chatInput = defaultChatPrompt;
  String _chatModelId = 'seed-1-8-thinking';
  Attachment? _generatedJson;
  String _lifeScriptText = '';
  ScriptMeta? _lifeScriptMeta;
  String? _errorMessage;
  String? _homeMessage;
  String? _chatError;
  String? _lifeScriptError;
  bool _loading = false;
  bool _horoscopeLoading = false;
  bool _chatLoading = false;
  bool _lifeScriptLoading = false;
  List<ConversationModel> _conversations = const [];
  String _activeConversationId = '';
  List<Attachment> _attachments = const [];
  Future<JsonMap?>? _horoscopeInFlight;
  ({DateTime date, int hour})? _pendingHoroscopeRequest;

  bool get initialized => _initialized;
  String get apiBaseUrl => _apiBaseUrl;
  AppTab get activeTab => _activeTab;
  HoroscopeScope get selectedHoroscopeScope => _selectedHoroscopeScope;
  FormStateModel get form => _form;
  PanelInput? get panelInput => _panelInput;
  NatalChartData? get chartData => _chartData;
  String get chatInput => _chatInput;
  String get chatModelId => _chatModelId;
  Attachment? get generatedJson => _generatedJson;
  String get lifeScriptText => _lifeScriptText;
  ScriptMeta? get lifeScriptMeta => _lifeScriptMeta;
  String? get errorMessage => _errorMessage;
  String? get homeMessage => _homeMessage;
  String? get chatError => _chatError;
  String? get lifeScriptError => _lifeScriptError;
  bool get loading => _loading;
  bool get horoscopeLoading => _horoscopeLoading;
  bool get chatLoading => _chatLoading;
  bool get lifeScriptLoading => _lifeScriptLoading;
  List<ConversationModel> get conversations => _conversations;
  String get activeConversationId => _activeConversationId;
  List<Attachment> get attachments => _attachments;

  ConversationModel? get activeConversation {
    for (final conversation in _conversations) {
      if (conversation.id == _activeConversationId) {
        return conversation;
      }
    }
    return null;
  }

  int get timeIndex => toTimeIndex(_form.birthTime);

  String get timeLabel {
    for (final option in timeIndexOptions) {
      if (option.key == timeIndex) {
        return option.value;
      }
    }
    return '';
  }

  int? get birthYear {
    final parts = _form.birthday.split('-');
    if (parts.isEmpty) {
      return null;
    }
    return int.tryParse(parts.first);
  }

  ModelOption get selectedModel {
    for (final option in modelOptions) {
      if (option.id == _chatModelId) {
        return option;
      }
    }
    return modelOptions.first;
  }

  Future<void> initialize() async {
    _apiBaseUrl = await _localStore.loadApiBaseUrl() ?? _apiBaseUrl;
    final snapshot = await _localStore.loadSnapshot();
    if (snapshot != null) {
      _activeTab = snapshot.activeTab;
      _selectedHoroscopeScope = snapshot.selectedHoroscopeScope;
      _form = snapshot.form;
      _panelInput = snapshot.panelInput;
      _chartData = snapshot.chartData;
      _chatInput = snapshot.chatInput;
      _conversations = snapshot.conversations;
      _activeConversationId = snapshot.activeConversationId;
      _chatModelId = snapshot.chatModelId;
      _generatedJson = snapshot.generatedJson;
      _lifeScriptText = snapshot.lifeScriptText;
      _lifeScriptMeta = snapshot.lifeScriptMeta;
      _attachments = snapshot.attachments;
    }
    if (_conversations.isEmpty) {
      final next = ConversationModel.create();
      _conversations = [next];
      _activeConversationId = next.id;
    }
    _initialized = true;
    notifyListeners();
  }

  void setApiBaseUrl(String value) {
    _apiBaseUrl = value.trim();
    _persist();
    notifyListeners();
    unawaited(_localStore.saveApiBaseUrl(_apiBaseUrl));
  }

  void setActiveTab(AppTab tab) {
    _activeTab = tab;
    _persist();
    notifyListeners();
  }

  void setSelectedHoroscopeScope(HoroscopeScope scope) {
    _selectedHoroscopeScope = scope;
    _persist();
    notifyListeners();
  }

  void updateForm(FormStateModel next) {
    _form = next;
    _persist();
    notifyListeners();
  }

  void setChatInput(String value) {
    _chatInput = value;
    _persist();
    notifyListeners();
  }

  void setChatModelId(String value) {
    _chatModelId = value;
    _persist();
    notifyListeners();
  }

  void clearHomeMessage() {
    _homeMessage = null;
    notifyListeners();
  }

  void removeAttachment(String name) {
    _attachments = _attachments.where((item) => item.name != name).toList();
    _persist();
    notifyListeners();
  }

  void addManualAttachment({required String name, required String content}) {
    if (name.trim().isEmpty || content.trim().isEmpty) {
      return;
    }
    _attachments = [
      ..._attachments,
      Attachment(name: name.trim(), content: content.trim()),
    ];
    _persist();
    notifyListeners();
  }

  void selectConversation(String conversationId) {
    _activeConversationId = conversationId;
    _chatError = null;
    _activeTab = AppTab.chat;
    _persist();
    notifyListeners();
  }

  void startNewConversation([String nextInput = defaultChatPrompt]) {
    final conversation = ConversationModel.create();
    _conversations = [conversation, ..._conversations];
    _activeConversationId = conversation.id;
    _chatInput = nextInput;
    _attachments = const [];
    _chatError = null;
    _activeTab = AppTab.chat;
    _persist();
    notifyListeners();
  }

  Future<void> submitNatalChart() async {
    _loading = true;
    _errorMessage = null;
    _homeMessage = null;
    notifyListeners();

    try {
      if (_form.birthday.isEmpty || _form.birthTime.isEmpty) {
        throw ApiException('请填写出生日期与出生时辰');
      }
      final input = PanelInput(
        calendar: 'solar',
        date: toApiDate(_form.birthday),
        timeIndex: timeIndex,
        gender: _form.genderLabel,
        fixLeap: true,
        isLeapMonth: false,
        language: 'zh-CN',
      );
      final chart = await _natalChartRepository.fetchNatalChart(
        baseUrl: _apiBaseUrl,
        input: input,
      );
      _panelInput = input;
      _chartData = chart;
      _homeMessage = '排盘完成，可继续 AI 问命或开启人生剧本';
      _persist();
    } catch (error) {
      _errorMessage = error is ApiException ? error.message : error.toString();
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<void> stepHoroscope(int step) async {
    if (_chartData == null || _chartData!.horoscopeDate == null) {
      return;
    }

    var nextDate = applyScopeStep(
      _chartData!.horoscopeDate!,
      _selectedHoroscopeScope,
      step,
    );
    var nextHour = _chartData!.horoscopeHour;
    if (_selectedHoroscopeScope == HoroscopeScope.hourly) {
      nextHour = (_chartData!.horoscopeHour + step).clamp(0, 12);
      nextDate = _chartData!.horoscopeDate!;
    }

    await fetchHoroscope(nextDate, nextHour);
  }

  Future<JsonMap?> fetchHoroscope(DateTime date, int hour) async {
    if (_panelInput == null) {
      return null;
    }

    if (_horoscopeInFlight != null) {
      _pendingHoroscopeRequest = (date: date, hour: hour);
      return _horoscopeInFlight!;
    }

    _horoscopeLoading = true;
    _errorMessage = null;
    notifyListeners();

    final task = _runFetchHoroscope(date, hour);
    _horoscopeInFlight = task;
    try {
      return await task;
    } finally {
      _horoscopeLoading = false;
      _horoscopeInFlight = null;
      final pending = _pendingHoroscopeRequest;
      _pendingHoroscopeRequest = null;
      notifyListeners();
      if (pending != null) {
        unawaited(fetchHoroscope(pending.date, pending.hour));
      }
    }
  }

  Future<JsonMap?> _runFetchHoroscope(DateTime date, int hour) async {
    if (_panelInput == null || _chartData == null) {
      return null;
    }
    final response = await _natalChartRepository.fetchHoroscope(
      baseUrl: _apiBaseUrl,
      input: _panelInput!,
      targetDate: date,
      targetHour: hour,
    );
    final nextRawHoroscope = Map<String, dynamic>.from(
      response['rawHoroscope'] as Map<dynamic, dynamic>? ?? const {},
    );
    _chartData = _chartData!.copyWith(
      rawHoroscope: nextRawHoroscope,
      horoscopeDate: date,
      horoscopeHour: hour,
    );
    _persist();
    return nextRawHoroscope;
  }

  Future<JsonMap?> fetchHoroscopeRaw(DateTime date) async {
    if (_panelInput == null || _chartData == null) {
      return null;
    }
    final response = await _lifeScriptRepository.fetchHoroscope(
      baseUrl: _apiBaseUrl,
      input: _panelInput!,
      targetDate: date,
      targetHour: _chartData!.horoscopeHour,
    );
    return Map<String, dynamic>.from(
      response['rawHoroscope'] as Map<dynamic, dynamic>? ?? const {},
    );
  }

  Future<void> openChatWorkspace() async {
    _errorMessage = null;
    _homeMessage = null;
    notifyListeners();
    try {
      if (_chartData == null) {
        throw ApiException('请先完成排盘');
      }
      final payload = _lifeScriptRepository.builder.generatePayload(
        astrolabe: _chartData!.rawAstrolabe,
        horoscope: _chartData!.rawHoroscope,
        form: _form,
        includeCurrentTimeSlice: true,
      );
      final fileBaseName =
          '${normalizeNameForFile(_form.name.isEmpty ? 'user' : _form.name)}${formatTodayMMDD()}-chat';
      final saved = await _chatRepository.savePayload(
        baseUrl: _apiBaseUrl,
        payload: payload,
        fileBaseName: fileBaseName,
      );
      _generatedJson = saved.attachment;
      startNewConversation(defaultChatPrompt);
      _homeMessage = '已生成问命 JSON：${saved.fileName}';
      _persist();
    } catch (error) {
      _errorMessage = error is ApiException ? error.message : error.toString();
      notifyListeners();
    }
  }

  Future<JsonMap> buildLifeScriptPayload() async {
    if (_chartData == null || birthYear == null) {
      throw ApiException('请先完成排盘');
    }
    final basePayload = _lifeScriptRepository.builder.generatePayload(
      astrolabe: _chartData!.rawAstrolabe,
      horoscope: _chartData!.rawHoroscope,
      form: _form,
      includeCurrentTimeSlice: false,
    );

    final palaces =
        (_chartData!.rawAstrolabe['palaces'] as List<dynamic>? ?? const [])
            .cast<Map<String, dynamic>>();
    final decades = <JsonMap>[];
    for (final palace in palaces) {
      final decadal = palace['decadal'] as Map<String, dynamic>?;
      final range = (decadal?['range'] as List<dynamic>? ?? const [])
          .cast<int>();
      if (range.length < 2) {
        continue;
      }
      final startAge = range.first;
      final endAge = range.last;
      final targetYear = birthYear! + startAge;
      final horoscope = await fetchHoroscopeRaw(
        buildDateForYear(_form.birthday, targetYear),
      );
      if (horoscope == null) {
        continue;
      }
      decades.add({
        'label':
            '$startAge~$endAge ${(decadal?['heavenlyStem'] as String? ?? '')}${(decadal?['earthlyBranch'] as String? ?? '')}'
                .trim(),
        'start_age': startAge,
        'end_age': endAge,
        'target_year': targetYear,
        'slice': _lifeScriptRepository.builder.buildHoroscopeSlice(
          astrolabe: _chartData!.rawAstrolabe,
          horoscope: horoscope,
          includeYear: false,
          includeMonth: false,
          includeDay: false,
        ),
      });
    }

    return {
      ...basePayload,
      'selected_time_slices': {
        'decades': decades,
        'years': const [],
        'months': const [],
        'days': const [],
      },
    };
  }

  Future<void> generateLifeScript() async {
    _lifeScriptLoading = true;
    _lifeScriptError = null;
    _homeMessage = null;
    notifyListeners();

    try {
      final payload = await buildLifeScriptPayload();
      final fileBaseName =
          '${normalizeNameForFile(_form.name.isEmpty ? 'user' : _form.name)}${formatTodayMMDD()}-script';
      final saved = await _lifeScriptRepository.savePayload(
        baseUrl: _apiBaseUrl,
        payload: payload,
        fileBaseName: fileBaseName,
      );
      final prompt = buildTextWithFiles(lifeScriptPrompt, [
        saved.attachment,
      ], selectedModel.supportsFileUpload);
      _generatedJson = saved.attachment;
      _lifeScriptText = '';
      _lifeScriptMeta = ScriptMeta(
        fileName: saved.fileName,
        modelId: selectedModel.id,
        prompt: lifeScriptPrompt,
        generatedAt: DateTime.now().millisecondsSinceEpoch,
      );
      _activeTab = AppTab.script;
      notifyListeners();

      await for (final event in _chatRepository.streamChat(
        baseUrl: _apiBaseUrl,
        modelId: selectedModel.id,
        messages: [
          {
            'role': 'system',
            'content': '你是严谨的紫微斗数分析助手。只能基于用户给出的命盘 JSON 做推理，不编造事实。',
          },
          {'role': 'user', 'content': prompt},
        ],
      )) {
        if (event.type == 'error') {
          throw ApiException(event.error ?? '人生剧本生成失败');
        }
        if (event.type == 'delta' && event.text != null) {
          _lifeScriptText = '$_lifeScriptText${event.text}';
          notifyListeners();
        }
      }
      _persist();
    } catch (error) {
      _lifeScriptError = error is ApiException
          ? error.message
          : error.toString();
    } finally {
      _lifeScriptLoading = false;
      notifyListeners();
    }
  }

  Future<void> sendChat() async {
    final conversation = activeConversation;
    if (_chatLoading || conversation == null) {
      return;
    }

    final trimmed = _chatInput.trim();
    if (trimmed.isEmpty) {
      return;
    }

    _chatError = null;
    final files = <Attachment>[
      ..._attachments,
      ...?(_generatedJson == null ? null : [_generatedJson!]),
    ];
    final mergedPrompt = buildTextWithFiles(
      trimmed,
      files,
      selectedModel.supportsFileUpload,
    );

    final now = DateTime.now().millisecondsSinceEpoch;
    final userMessage = ChatMessageModel(
      id: 'user-$now',
      role: MessageRole.user,
      content: mergedPrompt,
      displayContent: trimmed,
      attachments: files,
      reasoning: null,
      createdAt: now,
    );
    final assistantMessage = ChatMessageModel(
      id: 'assistant-${now + 1}',
      role: MessageRole.assistant,
      content: '',
      displayContent: '',
      attachments: const [],
      reasoning: '',
      createdAt: now + 1,
    );

    final previousMessages = conversation.messages;
    _updateActiveConversation((item) {
      return item.copyWith(
        title: buildConversationTitle(trimmed),
        updatedAt: now,
        messages: [...item.messages, userMessage, assistantMessage],
      );
    });
    _chatLoading = true;
    _chatInput = '';
    _attachments = const [];
    _generatedJson = null;
    notifyListeners();

    try {
      await for (final event in _chatRepository.streamChat(
        baseUrl: _apiBaseUrl,
        modelId: selectedModel.id,
        messages: [
          {
            'role': 'system',
            'content': '你是严谨的紫微斗数分析助手。需要基于用户提供的命盘 JSON 进行实证推理，不编造事实。',
          },
          ...previousMessages.map(
            (message) => {
              'role': message.roleLabel,
              'content': message.content,
            },
          ),
          {'role': 'user', 'content': mergedPrompt},
        ],
      )) {
        if (event.type == 'error') {
          throw ApiException(event.error ?? '发送失败');
        }
        if (event.type == 'delta' && event.text != null) {
          _updateAssistantMessage(assistantMessage.id, delta: event.text!);
          notifyListeners();
        }
        if (event.type == 'reasoning' && event.text != null) {
          _updateAssistantMessage(assistantMessage.id, reasoning: event.text!);
          notifyListeners();
        }
      }
      _persist();
    } catch (error) {
      _chatError = error is ApiException ? error.message : error.toString();
    } finally {
      _chatLoading = false;
      notifyListeners();
    }
  }

  void _updateAssistantMessage(
    String messageId, {
    String? delta,
    String? reasoning,
  }) {
    _updateActiveConversation((conversation) {
      final updatedMessages = conversation.messages.map((message) {
        if (message.id != messageId) {
          return message;
        }
        return message.copyWith(
          content: delta == null ? null : '${message.content}$delta',
          displayContent: delta == null
              ? null
              : '${message.displayContent}$delta',
          reasoning: reasoning == null
              ? message.reasoning
              : '${message.reasoning ?? ''}$reasoning',
        );
      }).toList();
      return conversation.copyWith(
        updatedAt: DateTime.now().millisecondsSinceEpoch,
        messages: updatedMessages,
      );
    });
  }

  void _updateActiveConversation(
    ConversationModel Function(ConversationModel conversation) updater,
  ) {
    _conversations = _conversations.map((conversation) {
      if (conversation.id != _activeConversationId) {
        return conversation;
      }
      return updater(conversation);
    }).toList();
    _persist();
  }

  void _persist() {
    if (!_initialized) {
      return;
    }
    final snapshot = AppSnapshot(
      activeTab: _activeTab,
      selectedHoroscopeScope: _selectedHoroscopeScope,
      form: _form,
      panelInput: _panelInput,
      chartData: _chartData,
      chatInput: _chatInput,
      conversations: _conversations,
      activeConversationId: _activeConversationId,
      chatModelId: _chatModelId,
      generatedJson: _generatedJson,
      lifeScriptText: _lifeScriptText,
      lifeScriptMeta: _lifeScriptMeta,
      attachments: _attachments,
    );
    unawaited(_localStore.saveSnapshot(snapshot));
  }
}
