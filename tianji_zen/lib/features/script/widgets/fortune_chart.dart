import 'package:flutter/cupertino.dart';

import '../../../shared/models/app_models.dart';

class FortuneChart extends StatelessWidget {
  const FortuneChart({required this.metric, super.key});

  final FortuneMetric metric;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 220,
      width: double.infinity,
      child: CustomPaint(painter: _FortuneChartPainter(metric)),
    );
  }
}

class _FortuneChartPainter extends CustomPainter {
  _FortuneChartPainter(this.metric);

  final FortuneMetric metric;

  @override
  void paint(Canvas canvas, Size size) {
    final points = metric.points;
    if (points.isEmpty) {
      return;
    }

    const paddingLeft = 20.0;
    const paddingRight = 14.0;
    const paddingTop = 16.0;
    const paddingBottom = 28.0;
    final chartWidth = size.width - paddingLeft - paddingRight;
    final chartHeight = size.height - paddingTop - paddingBottom;
    final minAge = points.first.age.toDouble();
    final maxAge = points.last.age.toDouble();

    final mapped = <Offset>[];
    for (final point in points) {
      final x =
          paddingLeft +
          ((point.age - minAge) /
                  (maxAge - minAge == 0 ? 1 : maxAge - minAge)) *
              chartWidth;
      final y = paddingTop + ((100 - point.value) / 100) * chartHeight;
      mapped.add(Offset(x, y));
    }

    final gridPaint = Paint()
      ..color = const Color(0x1F64748B)
      ..strokeWidth = 1;
    for (var i = 0; i < 4; i++) {
      final y = paddingTop + (chartHeight / 3) * i;
      canvas.drawLine(
        Offset(paddingLeft, y),
        Offset(size.width - paddingRight, y),
        gridPaint,
      );
    }

    final areaPath = Path()
      ..moveTo(mapped.first.dx, size.height - paddingBottom);
    for (final point in mapped) {
      areaPath.lineTo(point.dx, point.dy);
    }
    areaPath
      ..lineTo(mapped.last.dx, size.height - paddingBottom)
      ..close();

    final areaPaint = Paint()
      ..shader = LinearGradient(
        colors: [metric.fillColor, metric.fillColor.withValues(alpha: 0.05)],
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
      ).createShader(Offset.zero & size);
    canvas.drawPath(areaPath, areaPaint);

    final linePath = Path()..moveTo(mapped.first.dx, mapped.first.dy);
    for (var i = 1; i < mapped.length; i++) {
      final previous = mapped[i - 1];
      final current = mapped[i];
      final midX = (previous.dx + current.dx) / 2;
      linePath.cubicTo(
        midX,
        previous.dy,
        midX,
        current.dy,
        current.dx,
        current.dy,
      );
    }

    final linePaint = Paint()
      ..color = metric.color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3
      ..strokeCap = StrokeCap.round;
    canvas.drawPath(linePath, linePaint);

    final pointPaint = Paint()..color = CupertinoColors.white;
    final ringPaint = Paint()..color = metric.color;
    for (final point in mapped) {
      canvas.drawCircle(point, 5, ringPaint);
      canvas.drawCircle(point, 2.6, pointPaint);
    }

    for (var i = 0; i < mapped.length; i++) {
      final painter = TextPainter(
        text: TextSpan(
          text: '${points[i].age}',
          style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
        ),
        textDirection: TextDirection.ltr,
      )..layout();
      painter.paint(
        canvas,
        Offset(
          mapped[i].dx - painter.width / 2,
          size.height - paddingBottom + 8,
        ),
      );
    }
  }

  @override
  bool shouldRepaint(covariant _FortuneChartPainter oldDelegate) {
    return oldDelegate.metric != metric;
  }
}
