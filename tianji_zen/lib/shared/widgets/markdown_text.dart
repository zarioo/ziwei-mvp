import 'package:flutter/cupertino.dart';

class MarkdownText extends StatelessWidget {
  const MarkdownText({required this.content, super.key});

  final String content;

  @override
  Widget build(BuildContext context) {
    final lines = content.split(RegExp(r'\r?\n'));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final line in lines) ...[
          if (line.trim().startsWith('# '))
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Text(
                line.trim().substring(2),
                style: const TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF0F172A),
                ),
              ),
            )
          else if (line.trim().startsWith('## '))
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Text(
                line.trim().substring(3),
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF0F172A),
                ),
              ),
            )
          else if (line.trim().startsWith('- '))
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Text(
                '• ${line.trim().substring(2)}',
                style: const TextStyle(
                  fontSize: 15,
                  height: 1.5,
                  color: Color(0xFF334155),
                ),
              ),
            )
          else
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Text(
                line.isEmpty ? ' ' : line,
                style: const TextStyle(
                  fontSize: 15,
                  height: 1.6,
                  color: Color(0xFF334155),
                ),
              ),
            ),
        ],
      ],
    );
  }
}
