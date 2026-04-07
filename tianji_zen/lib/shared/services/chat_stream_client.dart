import 'dart:convert';
import 'dart:io';

import '../models/app_models.dart';
import 'ziwei_api_client.dart';

class ChatStreamEvent {
  const ChatStreamEvent({required this.type, this.text, this.error});

  final String type;
  final String? text;
  final String? error;
}

class ChatStreamClient {
  Stream<ChatStreamEvent> streamChat({
    required String baseUrl,
    required String modelId,
    required List<JsonMap> messages,
  }) async* {
    final client = HttpClient();
    try {
      final request = await client.postUrl(
        Uri.parse('${baseUrl.trim()}/api/ai/chat/stream'),
      );
      request.headers.contentType = ContentType.json;
      request.write(jsonEncode({'modelId': modelId, 'messages': messages}));
      final response = await request.close();
      if (response.statusCode < 200 || response.statusCode >= 300) {
        final responseText = await utf8.decoder.bind(response).join();
        if (responseText.isEmpty) {
          throw ApiException('发送失败');
        }
        final parsed = jsonDecode(responseText) as Map<String, dynamic>;
        throw ApiException(parsed['error'] as String? ?? '发送失败');
      }

      var buffer = '';
      await for (final chunk in response.transform(utf8.decoder)) {
        buffer += chunk;
        final blocks = buffer.split('\n\n');
        buffer = blocks.removeLast();
        for (final block in blocks) {
          if (block.trim().isEmpty) {
            continue;
          }
          for (final line in block.split('\n')) {
            if (!line.startsWith('data:')) {
              continue;
            }
            final payload = line.substring(5).trim();
            if (payload.isEmpty) {
              continue;
            }
            final event = jsonDecode(payload) as Map<String, dynamic>;
            yield ChatStreamEvent(
              type: event['type'] as String? ?? 'delta',
              text: event['text'] as String?,
              error: event['error'] as String?,
            );
          }
        }
      }
      if (buffer.trim().isNotEmpty) {
        for (final line in buffer.split('\n')) {
          if (!line.startsWith('data:')) {
            continue;
          }
          final payload = line.substring(5).trim();
          if (payload.isEmpty) {
            continue;
          }
          final event = jsonDecode(payload) as Map<String, dynamic>;
          yield ChatStreamEvent(
            type: event['type'] as String? ?? 'delta',
            text: event['text'] as String?,
            error: event['error'] as String?,
          );
        }
      }
    } on SocketException catch (error) {
      throw ApiException('网络连接失败：${error.message}');
    } finally {
      client.close(force: true);
    }
  }
}
