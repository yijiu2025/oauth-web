/**
 * 扫码登录域 —— 生成二维码 + 轮询扫码状态。
 *
 * 安全边界：
 *   · 生成时只传 `client_id`（二维码里带 client_id 供移动端识别给哪个应用登录），
 *     轮询时只传 `qrKey`（client_id 从后端存储取，防 PC 端调包）。
 *   · 确认成功时后端返回 token 响应，由调用方交给 `parseLoginResponse` 判别，本层不读字段。
 */
import request from '@/utils/request';

export const qrApi = {
  /**
   * 生成登录二维码
   * client_id/scope 存入二维码，移动端扫描时能识别给哪个应用登录
   * 后端返回 qrContent（二维码内容，含 client_id），前端用 QRCode 生成图片
   */
  async generateQR(params?: { client_id?: string }) {
    return request.get('/oauth2.1/qr/generate', { params });
  },

  /**
   * 查询二维码状态（PC 端轮询）
   * 只传 qrKey：client_id 从存储取（防 PC 端调包）
   * confirmed 时后端返回 token 响应（access_token/session_token 等）
   */
  async checkQRStatus(qrKey: string) {
    return request.get('/oauth2.1/qr/status', { params: { qrKey } });
  }
};
