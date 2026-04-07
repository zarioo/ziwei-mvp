import '../models/app_models.dart';

const timeIndexOptions = <MapEntry<int, String>>[
  MapEntry(0, '早子时'),
  MapEntry(1, '丑时'),
  MapEntry(2, '寅时'),
  MapEntry(3, '卯时'),
  MapEntry(4, '辰时'),
  MapEntry(5, '巳时'),
  MapEntry(6, '午时'),
  MapEntry(7, '未时'),
  MapEntry(8, '申时'),
  MapEntry(9, '酉时'),
  MapEntry(10, '戌时'),
  MapEntry(11, '亥时'),
  MapEntry(12, '晚子时'),
];

int toTimeIndex(String time) {
  final parts = time.split(':');
  if (parts.length != 2) {
    return 0;
  }

  final hour = int.tryParse(parts[0]);
  final minute = int.tryParse(parts[1]);
  if (hour == null || minute == null) {
    return 0;
  }

  final total = hour * 60 + minute;
  if (total >= 23 * 60) {
    return 12;
  }
  if (total < 60) {
    return 0;
  }
  return ((total - 60) ~/ 120) + 1;
}

String toApiDate(String value) {
  final parts = value.split('-');
  if (parts.length != 3) {
    return value;
  }

  final year = int.tryParse(parts[0]);
  final month = int.tryParse(parts[1]);
  final day = int.tryParse(parts[2]);
  if (year == null || month == null || day == null) {
    return value;
  }

  return '$year-$month-$day';
}

String normalizeNameForFile(String name) {
  final normalized = name
      .trim()
      .replaceAll(RegExp(r'[^\p{L}\p{N}_-]+', unicode: true), '')
      .substring(
        0,
        name
            .trim()
            .replaceAll(RegExp(r'[^\p{L}\p{N}_-]+', unicode: true), '')
            .length
            .clamp(0, 40),
      );
  return normalized.isEmpty ? 'user' : normalized;
}

String formatTodayMMDD() {
  final now = DateTime.now();
  final month = now.month.toString().padLeft(2, '0');
  final day = now.day.toString().padLeft(2, '0');
  return '$month$day';
}

DateTime buildDateForYear(String birthday, int year) {
  final parts = birthday.split('-');
  if (parts.length != 3) {
    return DateTime(year, 1, 1);
  }

  final month = int.tryParse(parts[1]) ?? 1;
  final day = int.tryParse(parts[2]) ?? 1;
  final candidate = DateTime(year, month, day);
  if (candidate.month != month) {
    return DateTime(year, month + 1, 0);
  }
  return candidate;
}

String buildTextWithFiles(
  String prompt,
  List<Attachment> files,
  bool supportsFileUpload,
) {
  if (files.isEmpty) {
    return prompt;
  }

  final fileText = files
      .map((file) => '【文件：${file.name}】\n```\n${file.content}\n```')
      .join('\n\n');

  if (supportsFileUpload) {
    return '$prompt\n\n以下是用户上传的文件内容：\n$fileText';
  }
  return '$prompt\n\n当前模型不支持文件直传，已自动附加 JSON/文本内容：\n$fileText';
}

String buildConversationTitle(String text) {
  final trimmed = text.trim();
  if (trimmed.isEmpty) {
    return '新对话';
  }
  return trimmed.length <= 18 ? trimmed : trimmed.substring(0, 18);
}

DateTime applyScopeStep(DateTime current, HoroscopeScope scope, int step) {
  switch (scope) {
    case HoroscopeScope.decadal:
      return DateTime(current.year + (step * 10), current.month, current.day);
    case HoroscopeScope.yearly:
      return DateTime(current.year + step, current.month, current.day);
    case HoroscopeScope.monthly:
      return DateTime(current.year, current.month + step, current.day);
    case HoroscopeScope.daily:
      return current.add(Duration(days: step));
    case HoroscopeScope.hourly:
      return current;
  }
}
