import 'package:flutter/cupertino.dart';

import '../../../shared/models/app_models.dart';

class PalaceChart extends StatelessWidget {
  const PalaceChart({
    required this.astrolabe,
    required this.horoscope,
    required this.selectedScope,
    required this.currentDate,
    required this.currentHour,
    required this.loading,
    required this.onScopeChanged,
    required this.onStep,
    super.key,
  });

  final JsonMap astrolabe;
  final JsonMap horoscope;
  final HoroscopeScope selectedScope;
  final DateTime? currentDate;
  final int currentHour;
  final bool loading;
  final ValueChanged<HoroscopeScope> onScopeChanged;
  final ValueChanged<int> onStep;

  static const _gridOrder = <int?>[
    0,
    1,
    2,
    3,
    11,
    null,
    null,
    4,
    10,
    null,
    null,
    5,
    9,
    8,
    7,
    6,
  ];

  @override
  Widget build(BuildContext context) {
    final palaces = (astrolabe['palaces'] as List<dynamic>? ?? const [])
        .cast<Map<String, dynamic>>();
    final highlightedIndex = _highlightIndex();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          '十二宫盘面',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: Color(0xFF0F172A),
          ),
        ),
        const SizedBox(height: 12),
        AspectRatio(
          aspectRatio: 1,
          child: GridView.builder(
            physics: const NeverScrollableScrollPhysics(),
            itemCount: _gridOrder.length,
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 4,
              crossAxisSpacing: 8,
              mainAxisSpacing: 8,
            ),
            itemBuilder: (context, index) {
              final palaceIndex = _gridOrder[index];
              if (palaceIndex == null) {
                if (index == 5) {
                  return _CenterControl(
                    selectedScope: selectedScope,
                    currentDate: currentDate,
                    currentHour: currentHour,
                    loading: loading,
                    onScopeChanged: onScopeChanged,
                    onStep: onStep,
                  );
                }
                return const SizedBox.shrink();
              }
              final palace = palaces[palaceIndex];
              return _PalaceTile(
                palace: palace,
                highlighted: highlightedIndex == palaceIndex,
              );
            },
          ),
        ),
      ],
    );
  }

  int? _highlightIndex() {
    final key = switch (selectedScope) {
      HoroscopeScope.decadal => 'decadal',
      HoroscopeScope.yearly => 'yearly',
      HoroscopeScope.monthly => 'monthly',
      HoroscopeScope.daily => 'daily',
      HoroscopeScope.hourly => 'hourly',
    };
    return (horoscope[key] as JsonMap?)?['index'] as int?;
  }
}

class _PalaceTile extends StatelessWidget {
  const _PalaceTile({required this.palace, required this.highlighted});

  final JsonMap palace;
  final bool highlighted;

  @override
  Widget build(BuildContext context) {
    final majorStars = (palace['majorStars'] as List<dynamic>? ?? const [])
        .cast<JsonMap>()
        .map((item) => item['name'] as String? ?? '')
        .where((item) => item.isNotEmpty)
        .join('、');
    final minorStars = (palace['minorStars'] as List<dynamic>? ?? const [])
        .cast<JsonMap>()
        .map((item) => item['name'] as String? ?? '')
        .where((item) => item.isNotEmpty)
        .take(3)
        .join('、');

    return DecoratedBox(
      decoration: BoxDecoration(
        color: highlighted ? const Color(0xFFE0E7FF) : const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: highlighted
              ? const Color(0xFF4F46E5)
              : const Color(0x140F172A),
          width: highlighted ? 1.4 : 1,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '${palace['name'] ?? ''}',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: Color(0xFF0F172A),
              ),
            ),
            const SizedBox(height: 2),
            Text(
              '${palace['heavenlyStem'] ?? ''}${palace['earthlyBranch'] ?? ''}',
              style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
            ),
            const SizedBox(height: 6),
            Expanded(
              child: Text(
                [
                  if (majorStars.isNotEmpty) majorStars,
                  if (minorStars.isNotEmpty) minorStars,
                ].join('\n'),
                maxLines: 5,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 11,
                  height: 1.3,
                  color: Color(0xFF334155),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CenterControl extends StatelessWidget {
  const _CenterControl({
    required this.selectedScope,
    required this.currentDate,
    required this.currentHour,
    required this.loading,
    required this.onScopeChanged,
    required this.onStep,
  });

  final HoroscopeScope selectedScope;
  final DateTime? currentDate;
  final int currentHour;
  final bool loading;
  final ValueChanged<HoroscopeScope> onScopeChanged;
  final ValueChanged<int> onStep;

  @override
  Widget build(BuildContext context) {
    final labels = <HoroscopeScope, Widget>{
      HoroscopeScope.decadal: const Text('大限'),
      HoroscopeScope.yearly: const Text('流年'),
      HoroscopeScope.monthly: const Text('流月'),
      HoroscopeScope.daily: const Text('流日'),
      HoroscopeScope.hourly: const Text('流时'),
    };
    final dateText = currentDate == null
        ? '未同步'
        : '${currentDate!.year}-${currentDate!.month.toString().padLeft(2, '0')}-${currentDate!.day.toString().padLeft(2, '0')}';

    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF0F172A), Color(0xFF1E293B)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Padding(
        padding: const EdgeInsets.all(10),
        child: Column(
          children: [
            const Text(
              '运限切换',
              style: TextStyle(
                color: CupertinoColors.white,
                fontSize: 13,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 8),
            CupertinoSlidingSegmentedControl<HoroscopeScope>(
              groupValue: selectedScope,
              thumbColor: const Color(0xFF60A5FA),
              children: labels,
              onValueChanged: (value) {
                if (value != null) {
                  onScopeChanged(value);
                }
              },
            ),
            const Spacer(),
            Text(
              dateText,
              style: const TextStyle(
                color: CupertinoColors.white,
                fontSize: 12,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              '时辰索引 $currentHour',
              style: const TextStyle(color: Color(0xFFD6E4FF), fontSize: 11),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: CupertinoButton(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    color: const Color(0x2238BDF8),
                    onPressed: loading ? null : () => onStep(-1),
                    child: const Text('上一档'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: CupertinoButton(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    color: const Color(0xFF2563EB),
                    onPressed: loading ? null : () => onStep(1),
                    child: loading
                        ? const CupertinoActivityIndicator()
                        : const Text('下一档'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
