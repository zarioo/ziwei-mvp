import 'package:flutter/widgets.dart';

import 'app/tianji_zen_app.dart';
import 'shared/repositories/chat_repository.dart';
import 'shared/repositories/life_script_repository.dart';
import 'shared/repositories/natal_chart_repository.dart';
import 'shared/services/chat_stream_client.dart';
import 'shared/services/local_app_store.dart';
import 'shared/services/ziwei_api_client.dart';
import 'shared/state/tianji_zen_controller.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final apiClient = ZiweiApiClient();
  final chatClient = ChatStreamClient();
  final localStore = LocalAppStore();

  final controller = TianjiZenController(
    localStore: localStore,
    natalChartRepository: NatalChartRepository(apiClient: apiClient),
    chatRepository: ChatRepository(
      apiClient: apiClient,
      chatStreamClient: chatClient,
    ),
    lifeScriptRepository: LifeScriptRepository(apiClient: apiClient),
  );

  await controller.initialize();
  runApp(TianjiZenApp(controller: controller));
}
