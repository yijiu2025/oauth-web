/**
 * `humanizeApiMessage` 单测
 *
 * 真实加载 `@/utils/api-error`：这条规则直接决定界面上显示什么，
 * 剥多了会把正常文案吃掉（例如 `https://` 被截成 `//…`），剥少了内部码照样外泄。
 */
import { describe, expect, test } from 'vitest';
import { humanizeApiMessage } from '@/utils/api-error';

describe('humanizeApiMessage —— 剥掉领域错误码，保留说明', () => {
  test('真实报文：发码过频', () => {
    expect(humanizeApiMessage('SEND_CODE_FAILED:发送过于频繁，请在 35 秒后再试')).toBe(
      '发送过于频繁，请在 35 秒后再试'
    );
  });

  test('多个领域码前缀只剥一层（说明里再出现冒号也保留）', () => {
    expect(humanizeApiMessage('INVALID_PARAM:范围应为 1~10：当前 0')).toBe('范围应为 1~10：当前 0');
  });

  test('普通文案不动：URL 的小写协议头、时间、全角冒号', () => {
    expect(humanizeApiMessage('https://example.com 不可达')).toBe('https://example.com 不可达');
    expect(humanizeApiMessage('服务将在 12:30 重启')).toBe('服务将在 12:30 重启');
    expect(humanizeApiMessage('失败原因：网络中断')).toBe('失败原因：网络中断');
  });

  test('只有码没有说明时回落到兜底文案（不能给用户留一个空提示）', () => {
    expect(humanizeApiMessage('SEND_CODE_FAILED:', '操作失败')).toBe('操作失败');
  });

  test('非字符串 / 空值走兜底', () => {
    expect(humanizeApiMessage(undefined)).toBe('请求失败');
    expect(humanizeApiMessage('   ', '验证失败')).toBe('验证失败');
    expect(humanizeApiMessage(new Error('SEND_CODE_FAILED:发送过于频繁'))).toBe('请求失败');
  });
});
