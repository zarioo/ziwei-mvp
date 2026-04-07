import '../models/app_models.dart';
import '../services/llm_payload_builder.dart';
import '../services/ziwei_api_client.dart';

class LifeScriptRepository {
  LifeScriptRepository({required ZiweiApiClient apiClient})
    : _apiClient = apiClient;

  final ZiweiApiClient _apiClient;
  final LlmPayloadBuilder _builder = LlmPayloadBuilder();

  LlmPayloadBuilder get builder => _builder;

  Future<JsonMap> fetchHoroscope({
    required String baseUrl,
    required PanelInput input,
    required DateTime targetDate,
    required int targetHour,
  }) {
    return _apiClient.fetchHoroscope(
      baseUrl: baseUrl,
      input: input,
      targetDate: targetDate,
      targetHour: targetHour,
    );
  }

  Future<PersistedPayload> savePayload({
    required String baseUrl,
    required JsonMap payload,
    required String fileBaseName,
  }) {
    return _apiClient.saveLlmPayload(
      baseUrl: baseUrl,
      payload: payload,
      fileBaseName: fileBaseName,
    );
  }
}
