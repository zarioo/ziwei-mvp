import 'package:flutter/cupertino.dart';

import '../../features/chat/chat_tab.dart';
import '../../features/home/home_tab.dart';
import '../../features/script/script_tab.dart';
import '../../shared/models/app_models.dart';
import '../../shared/state/tianji_zen_controller.dart';

class RootShell extends StatelessWidget {
  const RootShell({required this.controller, super.key});

  final TianjiZenController controller;

  @override
  Widget build(BuildContext context) {
    if (!controller.initialized) {
      return const CupertinoPageScaffold(
        child: Center(child: CupertinoActivityIndicator()),
      );
    }

    final items = <BottomNavigationBarItem>[
      const BottomNavigationBarItem(
        icon: Icon(CupertinoIcons.house),
        label: 'Home',
      ),
      const BottomNavigationBarItem(
        icon: Icon(CupertinoIcons.waveform_path_ecg),
        label: 'Script',
      ),
      const BottomNavigationBarItem(
        icon: Icon(CupertinoIcons.chat_bubble_2),
        label: 'Chat',
      ),
    ];

    final pages = <Widget>[
      HomeTab(controller: controller),
      ScriptTab(controller: controller),
      ChatTab(controller: controller),
    ];

    return CupertinoTabScaffold(
      tabBar: CupertinoTabBar(
        currentIndex: controller.activeTab.index,
        items: items,
        onTap: (index) => controller.setActiveTab(AppTab.values[index]),
      ),
      tabBuilder: (context, index) =>
          CupertinoTabView(builder: (context) => pages[index]),
    );
  }
}
