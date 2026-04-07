import 'package:flutter/cupertino.dart';

CupertinoThemeData buildAppTheme() {
  const primary = Color(0xFF1D4ED8);
  return const CupertinoThemeData(
    primaryColor: primary,
    scaffoldBackgroundColor: Color(0xFFF4F7FB),
    barBackgroundColor: Color(0xF2FFFFFF),
    textTheme: CupertinoTextThemeData(primaryColor: primary),
  );
}
