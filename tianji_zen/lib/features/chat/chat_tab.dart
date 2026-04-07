import 'package:flutter/cupertino.dart';

import '../../shared/models/app_models.dart';
import '../../shared/state/tianji_zen_controller.dart';
import '../../shared/widgets/app_card.dart';
import '../../shared/widgets/markdown_text.dart';
import '../../shared/widgets/status_banner.dart';

class ChatTab extends StatefulWidget {
  const ChatTab({required this.controller, super.key});

  final TianjiZenController controller;

  @override
  State<ChatTab> createState() => _ChatTabState();
}

class _ChatTabState extends State<ChatTab> {
  late final TextEditingController _chatInputController;

  TianjiZenController get controller => widget.controller;

  @override
  void initState() {
    super.initState();
    _chatInputController = TextEditingController(text: controller.chatInput);
  }

  @override
  void didUpdateWidget(covariant ChatTab oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (_chatInputController.text != controller.chatInput) {
      _chatInputController.text = controller.chatInput;
    }
  }

  @override
  void dispose() {
    _chatInputController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final conversation = controller.activeConversation;
    return CupertinoPageScaffold(
      navigationBar: CupertinoNavigationBar(
        middle: const Text('AI 问命'),
        leading: CupertinoButton(
          padding: EdgeInsets.zero,
          onPressed: () => _showHistorySheet(context),
          child: const Icon(CupertinoIcons.list_bullet),
        ),
        trailing: CupertinoButton(
          padding: EdgeInsets.zero,
          onPressed: () => _showModelSheet(context),
          child: const Icon(CupertinoIcons.slider_horizontal_3),
        ),
      ),
      child: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                children: [
                  AppCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '当前模型：${controller.selectedModel.label}',
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF0F172A),
                          ),
                        ),
                        const SizedBox(height: 6),
                        const Text(
                          '支持生成命盘 JSON 后自动附带问答，也支持手动补充文本附件。',
                          style: TextStyle(
                            fontSize: 13,
                            color: Color(0xFF64748B),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  if (controller.generatedJson != null) ...[
                    AppCard(
                      child: Text(
                        '已挂载命盘 JSON：${controller.generatedJson!.name}',
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF1D4ED8),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                  ],
                  if (controller.chatError != null) ...[
                    StatusBanner(
                      message: controller.chatError!,
                      backgroundColor: const Color(0xFFFEE2E2),
                      textColor: const Color(0xFF991B1B),
                    ),
                    const SizedBox(height: 12),
                  ],
                  if (conversation == null)
                    const AppCard(
                      child: Text(
                        '先新建一段对话吧。',
                        style: TextStyle(
                          fontSize: 15,
                          color: Color(0xFF475569),
                        ),
                      ),
                    )
                  else ...[
                    for (final message in conversation.messages) ...[
                      _ChatBubble(message: message),
                      const SizedBox(height: 10),
                    ],
                    if (conversation.messages.isEmpty)
                      const AppCard(
                        child: Text(
                          '这里会显示你的问命对话记录。你也可以先在 Home 中生成问命 JSON，再来到这里继续聊。',
                          style: TextStyle(
                            fontSize: 15,
                            color: Color(0xFF475569),
                          ),
                        ),
                      ),
                  ],
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 20),
              decoration: const BoxDecoration(
                color: CupertinoColors.white,
                border: Border(top: BorderSide(color: Color(0x140F172A))),
              ),
              child: Column(
                children: [
                  if (controller.attachments.isNotEmpty)
                    SizedBox(
                      height: 40,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        itemBuilder: (context, index) {
                          final attachment = controller.attachments[index];
                          return DecoratedBox(
                            decoration: BoxDecoration(
                              color: const Color(0xFFE0F2FE),
                              borderRadius: BorderRadius.circular(999),
                            ),
                            child: Padding(
                              padding: const EdgeInsets.only(
                                left: 12,
                                right: 4,
                              ),
                              child: Row(
                                children: [
                                  Text(
                                    attachment.name,
                                    style: const TextStyle(
                                      fontSize: 12,
                                      color: Color(0xFF0369A1),
                                    ),
                                  ),
                                  CupertinoButton(
                                    padding: EdgeInsets.zero,
                                    onPressed: () => controller
                                        .removeAttachment(attachment.name),
                                    child: const Icon(
                                      CupertinoIcons.clear_circled_solid,
                                      size: 18,
                                      color: Color(0xFF0369A1),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                        separatorBuilder: (_, index) =>
                            const SizedBox(width: 8),
                        itemCount: controller.attachments.length,
                      ),
                    ),
                  if (controller.attachments.isNotEmpty)
                    const SizedBox(height: 10),
                  Row(
                    children: [
                      CupertinoButton(
                        padding: EdgeInsets.zero,
                        onPressed: () => _showAttachmentDialog(context),
                        child: const Icon(CupertinoIcons.paperclip),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: CupertinoTextField(
                          controller: _chatInputController,
                          placeholder: '问点什么，比如感情、事业、财富……',
                          maxLines: 3,
                          minLines: 1,
                          onChanged: controller.setChatInput,
                        ),
                      ),
                      const SizedBox(width: 8),
                      CupertinoButton.filled(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 12,
                        ),
                        onPressed: controller.chatLoading
                            ? null
                            : controller.sendChat,
                        child: controller.chatLoading
                            ? const CupertinoActivityIndicator(
                                color: CupertinoColors.white,
                              )
                            : const Text('发送'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _showHistorySheet(BuildContext context) async {
    await showCupertinoModalPopup<void>(
      context: context,
      builder: (context) {
        return CupertinoActionSheet(
          title: const Text('历史对话'),
          actions: [
            CupertinoActionSheetAction(
              onPressed: () {
                Navigator.of(context).pop();
                controller.startNewConversation();
              },
              child: const Text('+ 新对话'),
            ),
            for (final conversation in controller.conversations)
              CupertinoActionSheetAction(
                onPressed: () {
                  Navigator.of(context).pop();
                  controller.selectConversation(conversation.id);
                },
                child: Text(conversation.title),
              ),
          ],
          cancelButton: CupertinoActionSheetAction(
            isDefaultAction: true,
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('关闭'),
          ),
        );
      },
    );
  }

  Future<void> _showModelSheet(BuildContext context) async {
    await showCupertinoModalPopup<void>(
      context: context,
      builder: (context) {
        return CupertinoActionSheet(
          title: const Text('选择模型'),
          actions: [
            for (final model in modelOptions)
              CupertinoActionSheetAction(
                onPressed: () {
                  controller.setChatModelId(model.id);
                  Navigator.of(context).pop();
                },
                child: Text(model.label),
              ),
          ],
          cancelButton: CupertinoActionSheetAction(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('取消'),
          ),
        );
      },
    );
  }

  Future<void> _showAttachmentDialog(BuildContext context) async {
    final nameController = TextEditingController();
    final contentController = TextEditingController();
    await showCupertinoDialog<void>(
      context: context,
      builder: (context) {
        return CupertinoAlertDialog(
          title: const Text('新增文本附件'),
          content: Column(
            children: [
              const SizedBox(height: 12),
              CupertinoTextField(
                controller: nameController,
                placeholder: '附件名，例如 note.txt',
              ),
              const SizedBox(height: 8),
              CupertinoTextField(
                controller: contentController,
                placeholder: '粘贴要附加的文本内容',
                maxLines: 6,
              ),
            ],
          ),
          actions: [
            CupertinoDialogAction(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('取消'),
            ),
            CupertinoDialogAction(
              isDefaultAction: true,
              onPressed: () {
                controller.addManualAttachment(
                  name: nameController.text,
                  content: contentController.text,
                );
                Navigator.of(context).pop();
              },
              child: const Text('添加'),
            ),
          ],
        );
      },
    );
  }
}

class _ChatBubble extends StatelessWidget {
  const _ChatBubble({required this.message});

  final ChatMessageModel message;

  @override
  Widget build(BuildContext context) {
    final isUser = message.role == MessageRole.user;
    return Align(
      alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 320),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: isUser ? const Color(0xFFDBEAFE) : CupertinoColors.white,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: const Color(0x140F172A)),
          ),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  isUser ? message.displayContent : message.displayContent,
                  style: const TextStyle(
                    fontSize: 15,
                    height: 1.5,
                    color: Color(0xFF0F172A),
                  ),
                ),
                if (!isUser && (message.reasoning ?? '').trim().isNotEmpty) ...[
                  const SizedBox(height: 10),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      message.reasoning!,
                      style: const TextStyle(
                        fontSize: 12,
                        color: Color(0xFF64748B),
                        height: 1.45,
                      ),
                    ),
                  ),
                ],
                if (!isUser && message.displayContent.trim().isNotEmpty) ...[
                  const SizedBox(height: 10),
                  MarkdownText(content: message.displayContent),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
