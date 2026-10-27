/**
 * 用户信息域 —— 当前登录用户的资料查询。
 *
 * 安全边界：
 *   · 鉴权走后端 Session（Cookie sid），本层不手动注入 token。
 *   · 返回的用户资料可能含敏感字段，由调用方决定展示范围，本层原样透传。
 */
import request from '@/utils/request';

export const userApi = {
  /**
   * 【预留】获取用户信息（当前前端零调用，先保留待接入）
   */
  async getUserInfo() {
    return request.get('/user/v1/userinfo');
  }
};
