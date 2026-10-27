import { defineStore } from 'pinia';
import { ref } from 'vue';
import { loginApi } from '@/api';

/**
 * 认证状态管理
 *
 * ⚠️ 本 store 只维护「登录提交中」这一个 UI 态（`loading`）。
 * 登录成功后的会话由后端写 cookie（`sid`）承载，前端**不持久化 token / user**——
 * 鉴权统一走后端 Session 校验（见 `router/auth-checker.ts` 的定位说明）。
 * 因此这里不再保留 `token` / `user` / `logout`（它们历史上是 JWT 方案的半成品，
 * 从未被消费，留着会误导后人以为登录走本地 token）。
 */
export const useAuthStore = defineStore('auth', () => {
  const loading = ref(false);

  /**
   * 登录动作
   *
   * payload 由调用方（useLoginFlow）组装，形状随版式表单变化，故按
   * `Record<string, unknown>` 接收（与 loginApi.login 同口径）。
   * 返回原始响应（`unknown`）：识别为哪种分支交给 `parseLoginResponse`，
   * store 只负责「提交中」这个 UI 态。
   */
  async function login(payload: Record<string, unknown>): Promise<unknown> {
    loading.value = true;
    try {
      return await loginApi.login(payload);
    } finally {
      loading.value = false;
    }
  }

  return {
    loading,
    login
  };
});
