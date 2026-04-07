import 'package:flutter/cupertino.dart';

import '../shared/state/tianji_zen_controller.dart';
import 'theme.dart';
import 'views/root_shell.dart';

class TianjiZenApp extends StatelessWidget {
  const TianjiZenApp({required this.controller, super.key});

  final TianjiZenController controller;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: controller,
      builder: (context, _) {
        return CupertinoApp(
          debugShowCheckedModeBanner: false,
          title: 'Tianji Zen',
          theme: buildAppTheme(),
          home: RootShell(controller: controller),
        );
      },
    );
  }
}
