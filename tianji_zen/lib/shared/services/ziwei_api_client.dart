import 'dart:convert';
import 'dart:io';

import '../models/app_models.dart';

class ApiException implements Exception {
  ApiException(this.message);

  final String message;

  @override
  String toString() => message;
}

class PersistedPayload {
  const PersistedPayload({required this.fileName, required this.attachment});

  final String fileName;
  final Attachment attachment;
}

class ZiweiApiClient {
  Future<JsonMap> postJson({
    required String baseUrl,
    required String path,
    JsonMap? body,
  }) async {
    final client = HttpClient();
    try {
      final request = await client.postUrl(Uri.parse('${baseUrl.trim()}$path'));
      request.headers.contentType = ContentType.json;
      request.write(jsonEncode(body ?? const {}));
      final response = await request.close();
      final text = await utf8.decodeStream(response);
      final data = text.isEmpty
          ? <String, dynamic>{}
          : Map<String, dynamic>.from(jsonDecode(text) as Map);
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw ApiException(data['error'] as String? ?? '请求失败');
      }
      return data;
    } on SocketException catch (error) {
      throw ApiException('网络连接失败：${error.message}');
    } finally {
      client.close(force: true);
    }
  }

  Future<JsonMap> getJson({
    required String baseUrl,
    required String path,
  }) async {
    final client = HttpClient();
    try {
      final request = await client.getUrl(Uri.parse('${baseUrl.trim()}$path'));
      request.headers.contentType = ContentType.json;
      final response = await request.close();
      final text = await utf8.decodeStream(response);
      final data = text.isEmpty
          ? <String, dynamic>{}
          : Map<String, dynamic>.from(jsonDecode(text) as Map);
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw ApiException(data['error'] as String? ?? '请求失败');
      }
      return data;
    } on SocketException catch (error) {
      throw ApiException('网络连接失败：${error.message}');
    } finally {
      client.close(force: true);
    }
  }

  Future<NatalChartData> fetchNatalChart({
    required String baseUrl,
    required PanelInput input,
  }) async {
    final data = await postJson(
      baseUrl: baseUrl,
      path: '/api/ziwei/natal',
      body: input.toJson(),
    );
    return NatalChartData.fromJson(data);
  }

  Future<JsonMap> fetchHoroscope({
    required String baseUrl,
    required PanelInput input,
    required DateTime targetDate,
    required int targetHour,
  }) {
    return postJson(
      baseUrl: baseUrl,
      path: '/api/ziwei/horoscope',
      body: {
        ...input.toJson(),
        'targetDate': targetDate.toIso8601String(),
        'targetHour': targetHour,
      },
    );
  }

  Future<PersistedPayload> saveLlmPayload({
    required String baseUrl,
    required JsonMap payload,
    required String fileBaseName,
  }) async {
    final response = await postJson(
      baseUrl: baseUrl,
      path: '/api/llm-json',
      body: {...payload, 'fileBaseName': fileBaseName},
    );
    final fileName = response['fileName'] as String? ?? 'llm-json.json';
    return PersistedPayload(
      fileName: fileName,
      attachment: Attachment(
        name: fileName,
        content: const JsonEncoder.withIndent('  ').convert(payload),
      ),
    );
  }

  Future<JsonMap> loadLlmPayload({
    required String baseUrl,
    required String fileName,
  }) {
    return getJson(
      baseUrl: baseUrl,
      path: '/api/llm-json?fileName=${Uri.encodeComponent(fileName)}',
    );
  }
}
