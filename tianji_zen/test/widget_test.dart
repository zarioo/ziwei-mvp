import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:tianji_zen/app/tianji_zen_app.dart';
import 'package:tianji_zen/shared/repositories/chat_repository.dart';
import 'package:tianji_zen/shared/repositories/life_script_repository.dart';
import 'package:tianji_zen/shared/repositories/natal_chart_repository.dart';
import 'package:tianji_zen/shared/services/chat_stream_client.dart';
import 'package:tianji_zen/shared/services/local_app_store.dart';
import 'package:tianji_zen/shared/services/ziwei_api_client.dart';
import 'package:tianji_zen/shared/state/tianji_zen_controller.dart';

void main() {
  testWidgets('app boots with three main tabs', (tester) async {
    SharedPreferences.setMockInitialValues({});

    final controller = TianjiZenController(
      localStore: LocalAppStore(),
      natalChartRepository: NatalChartRepository(apiClient: ZiweiApiClient()),
      chatRepository: ChatRepository(
        apiClient: ZiweiApiClient(),
        chatStreamClient: ChatStreamClient(),
      ),
      lifeScriptRepository: LifeScriptRepository(apiClient: ZiweiApiClient()),
    );
    await controller.initialize();

    await tester.pumpWidget(TianjiZenApp(controller: controller));
    await tester.pumpAndSettle();

    expect(find.text('Home'), findsOneWidget);
    expect(find.text('Script'), findsOneWidget);
    expect(find.text('Chat'), findsOneWidget);
    expect(find.text('开始排盘'), findsOneWidget);
  });
}
