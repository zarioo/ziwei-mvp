import 'package:flutter/cupertino.dart';

import '../../shared/models/app_models.dart';
import '../../shared/state/tianji_zen_controller.dart';
import '../../shared/widgets/app_card.dart';
import '../../shared/widgets/markdown_text.dart';
import '../../shared/widgets/status_banner.dart';
import 'widgets/fortune_chart.dart';

class ScriptTab extends StatefulWidget {
  const ScriptTab({required this.controller, super.key});

  final TianjiZenController controller;

  @override
  State<ScriptTab> createState() => _ScriptTabState();
}

class _ScriptTabState extends State<ScriptTab> {
  var selectedMetricId = 'overall';

  static const metrics = <FortuneMetric>[
    FortuneMetric(
      id: 'overall',
      label: '总运',
      color: Color(0xFF4961FF),
      fillColor: Color(0x665978FF),
      points: [
        FortunePoint(age: 4, value: 26),
        FortunePoint(age: 14, value: 34),
        FortunePoint(age: 24, value: 48),
        FortunePoint(age: 34, value: 95),
        FortunePoint(age: 44, value: 72),
        FortunePoint(age: 54, value: 84),
        FortunePoint(age: 64, value: 58),
        FortunePoint(age: 74, value: 66),
        FortunePoint(age: 84, value: 78),
        FortunePoint(age: 94, value: 70),
      ],
    ),
    FortuneMetric(
      id: 'career',
      label: '事业',
      color: Color(0xFFF28A2E),
      fillColor: Color(0x66FBBF24),
      points: [
        FortunePoint(age: 4, value: 22),
        FortunePoint(age: 14, value: 30),
        FortunePoint(age: 24, value: 54),
        FortunePoint(age: 34, value: 62),
        FortunePoint(age: 44, value: 56),
        FortunePoint(age: 54, value: 82),
        FortunePoint(age: 64, value: 76),
        FortunePoint(age: 74, value: 88),
        FortunePoint(age: 84, value: 80),
        FortunePoint(age: 94, value: 68),
      ],
    ),
    FortuneMetric(
      id: 'wealth',
      label: '财运',
      color: Color(0xFF2F8DFF),
      fillColor: Color(0x664EA8FF),
      points: [
        FortunePoint(age: 4, value: 18),
        FortunePoint(age: 14, value: 26),
        FortunePoint(age: 24, value: 36),
        FortunePoint(age: 34, value: 52),
        FortunePoint(age: 44, value: 80),
        FortunePoint(age: 54, value: 74),
        FortunePoint(age: 64, value: 88),
        FortunePoint(age: 74, value: 76),
        FortunePoint(age: 84, value: 90),
        FortunePoint(age: 94, value: 82),
      ],
    ),
    FortuneMetric(
      id: 'love',
      label: '感情',
      color: Color(0xFFFF6F97),
      fillColor: Color(0x66FDA4AF),
      points: [
        FortunePoint(age: 4, value: 28),
        FortunePoint(age: 14, value: 40),
        FortunePoint(age: 24, value: 64),
        FortunePoint(age: 34, value: 30),
        FortunePoint(age: 44, value: 70),
        FortunePoint(age: 54, value: 78),
        FortunePoint(age: 64, value: 50),
        FortunePoint(age: 74, value: 62),
        FortunePoint(age: 84, value: 72),
        FortunePoint(age: 94, value: 60),
      ],
    ),
    FortuneMetric(
      id: 'health',
      label: '健康',
      color: Color(0xFF25B27F),
      fillColor: Color(0x6657D9A3),
      points: [
        FortunePoint(age: 4, value: 58),
        FortunePoint(age: 14, value: 66),
        FortunePoint(age: 24, value: 72),
        FortunePoint(age: 34, value: 64),
        FortunePoint(age: 44, value: 78),
        FortunePoint(age: 54, value: 68),
        FortunePoint(age: 64, value: 60),
        FortunePoint(age: 74, value: 64),
        FortunePoint(age: 84, value: 56),
        FortunePoint(age: 94, value: 48),
      ],
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final controller = widget.controller;
    final metric = metrics.firstWhere(
      (item) => item.id == selectedMetricId,
      orElse: () => metrics.first,
    );

    return CupertinoPageScaffold(
      navigationBar: const CupertinoNavigationBar(middle: Text('人生剧本')),
      child: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 40),
          children: [
            if (controller.chartData == null)
              const AppCard(
                child: Text(
                  '先回到 Home 完成排盘，再来生成完整的人生剧本。',
                  style: TextStyle(fontSize: 15, color: Color(0xFF475569)),
                ),
              )
            else ...[
              AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Expanded(
                          child: Text(
                            '人生剧本',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF0F172A),
                            ),
                          ),
                        ),
                        CupertinoButton(
                          padding: EdgeInsets.zero,
                          onPressed: controller.lifeScriptLoading
                              ? null
                              : controller.generateLifeScript,
                          child: controller.lifeScriptLoading
                              ? const CupertinoActivityIndicator()
                              : const Text('重新生成'),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 8,
                      children: [
                        for (final item in metrics)
                          CupertinoButton(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 8,
                            ),
                            color: item.id == selectedMetricId
                                ? item.color
                                : const Color(0xFFF1F5F9),
                            onPressed: () {
                              setState(() {
                                selectedMetricId = item.id;
                              });
                            },
                            child: Text(
                              item.label,
                              style: TextStyle(
                                color: item.id == selectedMetricId
                                    ? CupertinoColors.white
                                    : const Color(0xFF334155),
                              ),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    FortuneChart(metric: metric),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              if (controller.lifeScriptError != null) ...[
                StatusBanner(
                  message: controller.lifeScriptError!,
                  backgroundColor: const Color(0xFFFEE2E2),
                  textColor: const Color(0xFF991B1B),
                ),
                const SizedBox(height: 12),
              ],
              AppCard(
                child: controller.lifeScriptText.trim().isEmpty
                    ? const Text(
                        '点击“重新生成”后，这里会出现基于命盘和大限切片生成的整体人生剧本。',
                        style: TextStyle(
                          fontSize: 15,
                          color: Color(0xFF475569),
                        ),
                      )
                    : MarkdownText(content: controller.lifeScriptText),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
