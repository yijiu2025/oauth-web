/**
 * 登录响应解析契约测试（`parseLoginResponse`）
 *
 * 每条用例对应后端的**真实响应形状**（可直接对照
 * `src/app/oauth21/services/login.service.js` 的 reply.send）。写它的直接原因是一个
 * 线上 bug：后端 consent 响应的 `user` 不带 `id`，而 schema 把 `id` 设为必填 ——
 * `safeParse` 整条失败 → `kind='unknown'` → 前端只报「登录响应格式异常，请重试」，
 * 授权确认面板永远弹不出来。console 首次登录（`skip_consent:false`）100% 复现。
 *
 * 🔴 由此固化的规则：**驱动逻辑的字段严格，展示字段容错**。
 *    `action` / `consentKey` 不匹配就该失败（否则「批准」按不下去）；
 *    `user.*` 只用于展示（`ConsentPanel` 甚至不读），缺字段不该拖死整条链路。
 *
 * @author yijiu2025
 * @since 2026-11-09
 */
import { describe, expect, it } from 'vitest';
import { parseLoginResponse } from '../external';

/** 后端 consent 响应的真实形状：**user 里没有 id**（踩坑点就在这） */
const CONSENT_WITHOUT_ID = {
  action: 'consent',
  consentKey: '21e458f6-9a9b-4728-935a-4ed69e2e3354',
  client_id: 'console',
  client_name: '管理后台（Console）',
  scope: 'openid profile email',
  scopeDetails: [
    { id: 'openid', name: 'openid', desc: '基础登录凭证', fields: [], required: true, sensitive: false },
    { id: 'profile', name: 'profile', desc: '公开个人信息', fields: ['username'], required: true, sensitive: false }
  ],
  user: { username: '管理员', name: '管理员', email: '241849626@qq.com' }
};

describe('parseLoginResponse', () => {
  describe('consent（授权确认）', () => {
    it('user 不带 id 时仍识别为 action —— 这是踩过的真实回归', () => {
      const parsed = parseLoginResponse(CONSENT_WITHOUT_ID);
      expect(parsed.kind).toBe('action');
      if (parsed.kind !== 'action') return;
      expect(parsed.value.action).toBe('consent');
      if (parsed.value.action !== 'consent') return;
      expect(parsed.value.consentKey).toBe('21e458f6-9a9b-4728-935a-4ed69e2e3354');
      expect(parsed.value.client_name).toBe('管理后台（Console）');
    });

    it('带 id / avatar 的 consent 也接受，且字段透传', () => {
      const parsed = parseLoginResponse({
        ...CONSENT_WITHOUT_ID,
        user: { id: 42, username: '管理员', name: '管理员', email: 'a@b.c', avatar: null }
      });
      expect(parsed.kind).toBe('action');
      if (parsed.kind !== 'action' || parsed.value.action !== 'consent') return;
      expect(parsed.value.user.id).toBe(42);
    });

    it('user 整块缺失也不拖死登录（展示字段容错）', () => {
      const { user: _omit, ...withoutUser } = CONSENT_WITHOUT_ID;
      const parsed = parseLoginResponse(withoutUser);
      expect(parsed.kind).toBe('action');
    });

    it('缺少 consentKey 时必须判为 unknown（驱动字段严格，不能带病放行）', () => {
      const { consentKey: _omit, ...withoutKey } = CONSENT_WITHOUT_ID;
      expect(parseLoginResponse(withoutKey).kind).toBe('unknown');
    });
  });

  describe('其它 action 分支', () => {
    it('needs_email_verify', () => {
      const parsed = parseLoginResponse({
        action: 'needs_email_verify',
        verifyToken: 'vt-1',
        email: 'a***@qq.com',
        reason: 'new_device'
      });
      expect(parsed.kind).toBe('action');
      if (parsed.kind !== 'action') return;
      expect(parsed.value.action).toBe('needs_email_verify');
    });

    it('max_sessions（字段对齐 session-governance 的真实下发形状）', () => {
      const parsed = parseLoginResponse({
        action: 'max_sessions',
        sessions: [
          {
            sessionId: 'sid-1',
            ip: '127.0.0.1',
            userAgent: 'Chrome/156',
            lastActive: 1794213130000,
            deviceType: 'browser',
            appId: 'console'
          }
        ],
        maxSessions: 5
      });
      expect(parsed.kind).toBe('action');
      if (parsed.kind !== 'action') return;
      expect(parsed.value.action).toBe('max_sessions');
    });
  });

  describe('成功与未识别', () => {
    it('Session 模式：session_token 即成功', () => {
      const parsed = parseLoginResponse({
        session_token: 'st-1',
        expires_in: 600,
        user: { id: 1, username: '管理员', email: 'a@b.c' }
      });
      expect(parsed.kind).toBe('success');
    });

    it('JWT 模式：access_token（snake_case 兜底）也算成功', () => {
      expect(parseLoginResponse({ access_token: 'at-1' }).kind).toBe('success');
    });

    it('没有 token 字段的任意对象不得当成功（防后端改字段被静默放过）', () => {
      expect(parseLoginResponse({ foo: 'bar' }).kind).toBe('unknown');
      expect(parseLoginResponse({}).kind).toBe('unknown');
      expect(parseLoginResponse(null).kind).toBe('unknown');
      expect(parseLoginResponse([]).kind).toBe('unknown');
    });

    it('未解包的信封（{code,message,data}）不得当成功', () => {
      const envelope = { code: 200, message: '需要授权确认', data: CONSENT_WITHOUT_ID };
      expect(parseLoginResponse(envelope).kind).toBe('unknown');
    });
  });
});
