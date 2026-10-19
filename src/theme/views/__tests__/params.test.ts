/**
 * `readDeviceParam` 设备维度参数解析测试
 *
 * 真实加载 `skinsuite` 的 `views/params.ts` 实现（直接 `from 'skinsuite'`，
 * 不再有宿主壳），覆盖取值链：
 *   `th_<urlKey>` → `th` → undefined
 * 以及「空串/空数组 = 未指定」这条最容易踩坑的规则。
 */
import { describe, test, expect } from 'vitest';
import { readDeviceParam } from 'skinsuite';

describe('readDeviceParam —— 设备维度参数取值链（下划线 + 设备缩写名）', () => {
  test('设备专属键优先于通用键', () => {
    const query = { th_std: 'compact', th: 'default' };
    expect(readDeviceParam(query, 'th', 'std')).toBe('compact');
    expect(readDeviceParam(query, 'th', 'mobile')).toBe('default');
  });

  test('设备专属键缺席时退通用键', () => {
    const query = { th: 'compact' };
    expect(readDeviceParam(query, 'th', 'std')).toBe('compact');
    expect(readDeviceParam(query, 'th', 'mobile')).toBe('compact');
  });

  test('两者都缺席返回 undefined（表示该设备未被显式指定）', () => {
    expect(readDeviceParam({}, 'th', 'std')).toBeUndefined();
    expect(readDeviceParam(undefined, 'th', 'mobile')).toBeUndefined();
  });

  test('空串设备专属键不顶掉通用键（空串 = 未指定）', () => {
    // 部署方常把参数留空当作「这台设备不特殊指定」——`?th_std=&th=compact`
    // 不能因为 std 那条是空串就把 `th=compact` 顶掉。
    const query = { th_std: '', th: 'compact' };
    expect(readDeviceParam(query, 'th', 'std')).toBe('compact');
  });

  test('纯空白串同样视为未指定', () => {
    const query = { th_std: '   ', th: 'compact' };
    expect(readDeviceParam(query, 'th', 'std')).toBe('compact');
  });

  test('空数组视为未指定，非空数组视为指定', () => {
    // `?th=a&th=b` 会得到数组，下游按「非字符串即非法」处理，这里只保证取值键正确。
    expect(readDeviceParam({ th_std: [], th: 'compact' }, 'th', 'std')).toBe('compact');
    expect(readDeviceParam({ th_std: ['x'], th: 'compact' }, 'th', 'std')).toEqual(['x']);
  });

  test('th_color 参数名同样适用（与配色侧同形）', () => {
    const query = { th_color_mobile: 'blue', th_color: 'black' };
    expect(readDeviceParam(query, 'th_color', 'mobile')).toBe('blue');
    expect(readDeviceParam(query, 'th_color', 'std')).toBe('black');
  });
});
