import '../models/app_models.dart';
import '../services/chat_stream_client.dart';
import '../services/ziwei_api_client.dart';

class ChatRepository {
  ChatRepository({
    required ZiweiApiClient apiClient,
    required ChatStreamClient chatStreamClient,
  }) : _apiClient = apiClient,
       _chatStreamClient = chatStreamClient;

  final ZiweiApiClient _apiClient;
  final ChatStreamClient _chatStreamClient;

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

  Stream<ChatStreamEvent> streamChat({
    required String baseUrl,
    required String modelId,
    required List<JsonMap> messages,
  }) {
    return _chatStreamClient.streamChat(
      baseUrl: baseUrl,
      modelId: modelId,
      messages: messages,
    );
  }
}
