import '../models/app_models.dart';
import '../services/ziwei_api_client.dart';

class NatalChartRepository {
  NatalChartRepository({required ZiweiApiClient apiClient})
    : _apiClient = apiClient;

  final ZiweiApiClient _apiClient;

  Future<NatalChartData> fetchNatalChart({
    required String baseUrl,
    required PanelInput input,
  }) {
    return _apiClient.fetchNatalChart(baseUrl: baseUrl, input: input);
  }

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
}
