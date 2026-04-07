import 'package:shared_preferences/shared_preferences.dart';

import '../models/app_models.dart';

class LocalAppStore {
  static const _snapshotKey = 'tianji_zen_snapshot_v1';
  static const _apiBaseUrlKey = 'tianji_zen_api_base_url_v1';

  Future<AppSnapshot?> loadSnapshot() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_snapshotKey);
    if (raw == null || raw.isEmpty) {
      return null;
    }
    return AppSnapshot.fromJsonString(raw);
  }

  Future<void> saveSnapshot(AppSnapshot snapshot) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_snapshotKey, snapshot.toJsonString());
  }

  Future<String?> loadApiBaseUrl() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_apiBaseUrlKey);
  }

  Future<void> saveApiBaseUrl(String value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_apiBaseUrlKey, value);
  }
}
