import 'package:flutter/cupertino.dart';

import '../../shared/models/app_models.dart';
import '../../shared/state/tianji_zen_controller.dart';
import '../../shared/widgets/app_card.dart';
import '../../shared/widgets/status_banner.dart';
import 'widgets/palace_chart.dart';

class HomeTab extends StatefulWidget {
  const HomeTab({required this.controller, super.key});

  final TianjiZenController controller;

  @override
  State<HomeTab> createState() => _HomeTabState();
}

class _HomeTabState extends State<HomeTab> {
  late final TextEditingController _nameController;
  late final TextEditingController _birthdayController;
  late final TextEditingController _birthTimeController;
  late final TextEditingController _birthplaceController;

  TianjiZenController get controller => widget.controller;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(text: controller.form.name);
    _birthdayController = TextEditingController(text: controller.form.birthday);
    _birthTimeController = TextEditingController(
      text: controller.form.birthTime,
    );
    _birthplaceController = TextEditingController(
      text: controller.form.birthplace,
    );
  }

  @override
  void didUpdateWidget(covariant HomeTab oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (_nameController.text != controller.form.name) {
      _nameController.text = controller.form.name;
    }
    if (_birthdayController.text != controller.form.birthday) {
      _birthdayController.text = controller.form.birthday;
    }
    if (_birthTimeController.text != controller.form.birthTime) {
      _birthTimeController.text = controller.form.birthTime;
    }
    if (_birthplaceController.text != controller.form.birthplace) {
      _birthplaceController.text = controller.form.birthplace;
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _birthdayController.dispose();
    _birthTimeController.dispose();
    _birthplaceController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final chart = controller.chartData;
    return CupertinoPageScaffold(
      navigationBar: CupertinoNavigationBar(
        middle: const Text('天机 ZEN'),
        trailing: CupertinoButton(
          padding: EdgeInsets.zero,
          onPressed: () => _showBaseUrlDialog(context),
          child: const Icon(CupertinoIcons.settings),
        ),
      ),
      child: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 40),
          children: [
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    '当前服务',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF64748B),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    controller.apiBaseUrl,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF0F172A),
                    ),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    '真机安装时请改成你电脑的局域网地址，例如 http://192.168.x.x:3000。',
                    style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            if (controller.errorMessage != null) ...[
              StatusBanner(
                message: controller.errorMessage!,
                backgroundColor: const Color(0xFFFEE2E2),
                textColor: const Color(0xFF991B1B),
              ),
              const SizedBox(height: 12),
            ],
            if (controller.homeMessage != null) ...[
              StatusBanner(
                message: controller.homeMessage!,
                backgroundColor: const Color(0xFFDCFCE7),
                textColor: const Color(0xFF166534),
              ),
              const SizedBox(height: 12),
            ],
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    '出生信息',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF0F172A),
                    ),
                  ),
                  const SizedBox(height: 12),
                  _LabeledField(
                    label: '姓名',
                    child: CupertinoTextField(
                      controller: _nameController,
                      placeholder: '请输入姓名',
                      onChanged: (value) => controller.updateForm(
                        controller.form.copyWith(name: value),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  _LabeledField(
                    label: '性别',
                    child: CupertinoSlidingSegmentedControl<bool>(
                      groupValue: controller.form.genderLabel == '男',
                      children: const {
                        true: Padding(
                          padding: EdgeInsets.symmetric(horizontal: 12),
                          child: Text('男'),
                        ),
                        false: Padding(
                          padding: EdgeInsets.symmetric(horizontal: 12),
                          child: Text('女'),
                        ),
                      },
                      onValueChanged: (value) {
                        if (value == null) {
                          return;
                        }
                        controller.updateForm(
                          controller.form.copyWith(
                            gender: value ? Gender.male : Gender.female,
                          ),
                        );
                      },
                    ),
                  ),
                  const SizedBox(height: 12),
                  _LabeledField(
                    label: '出生日期',
                    child: CupertinoTextField(
                      controller: _birthdayController,
                      placeholder: 'YYYY-MM-DD',
                      onChanged: (value) => controller.updateForm(
                        controller.form.copyWith(birthday: value),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  _LabeledField(
                    label: '出生时间',
                    child: CupertinoTextField(
                      controller: _birthTimeController,
                      placeholder: 'HH:mm',
                      onChanged: (value) => controller.updateForm(
                        controller.form.copyWith(birthTime: value),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  _LabeledField(
                    label: '出生地点',
                    child: CupertinoTextField(
                      controller: _birthplaceController,
                      placeholder: '城市 / 地区',
                      onChanged: (value) => controller.updateForm(
                        controller.form.copyWith(birthplace: value),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  CupertinoButton.filled(
                    onPressed: controller.loading
                        ? null
                        : controller.submitNatalChart,
                    child: controller.loading
                        ? const CupertinoActivityIndicator(
                            color: CupertinoColors.white,
                          )
                        : const Text('开始排盘'),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: CupertinoButton(
                          color: const Color(0xFF1D4ED8),
                          onPressed: chart == null
                              ? null
                              : controller.openChatWorkspace,
                          child: const Text('AI 问命'),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: CupertinoButton(
                          color: const Color(0xFF0F766E),
                          onPressed: chart == null
                              ? null
                              : controller.generateLifeScript,
                          child: const Text('人生剧本'),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            if (chart != null) ...[
              const SizedBox(height: 12),
              AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      '命盘摘要',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 10,
                      runSpacing: 10,
                      children: [
                        _InfoPill(
                          label: '阳历',
                          value: chart.solarBirthDate ?? '—',
                        ),
                        _InfoPill(
                          label: '阴历',
                          value: chart.lunarBirthDate ?? '—',
                        ),
                        _InfoPill(label: '五行局', value: chart.wuxingju ?? '—'),
                        _InfoPill(label: '命主', value: chart.mingzhu ?? '—'),
                        _InfoPill(label: '身主', value: chart.shenzhu ?? '—'),
                        _InfoPill(label: '时辰', value: controller.timeLabel),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              AppCard(
                child: PalaceChart(
                  astrolabe: chart.rawAstrolabe,
                  horoscope: chart.rawHoroscope,
                  selectedScope: controller.selectedHoroscopeScope,
                  currentDate: chart.horoscopeDate,
                  currentHour: chart.horoscopeHour,
                  loading: controller.horoscopeLoading,
                  onScopeChanged: controller.setSelectedHoroscopeScope,
                  onStep: controller.stepHoroscope,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Future<void> _showBaseUrlDialog(BuildContext context) async {
    final textController = TextEditingController(text: controller.apiBaseUrl);
    await showCupertinoDialog<void>(
      context: context,
      builder: (context) {
        return CupertinoAlertDialog(
          title: const Text('设置 API 地址'),
          content: Padding(
            padding: const EdgeInsets.only(top: 16),
            child: CupertinoTextField(
              controller: textController,
              placeholder: 'http://192.168.1.100:3000',
            ),
          ),
          actions: [
            CupertinoDialogAction(
              child: const Text('取消'),
              onPressed: () => Navigator.of(context).pop(),
            ),
            CupertinoDialogAction(
              isDefaultAction: true,
              child: const Text('保存'),
              onPressed: () {
                controller.setApiBaseUrl(textController.text);
                Navigator.of(context).pop();
              },
            ),
          ],
        );
      },
    );
  }
}

class _LabeledField extends StatelessWidget {
  const _LabeledField({required this.label, required this.child});

  final String label;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: Color(0xFF475569),
          ),
        ),
        const SizedBox(height: 6),
        child,
      ],
    );
  }
}

class _InfoPill extends StatelessWidget {
  const _InfoPill({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
            ),
            const SizedBox(height: 3),
            Text(
              value,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: Color(0xFF0F172A),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
