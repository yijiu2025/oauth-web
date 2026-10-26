/**
 * 「上线前合规阻断」守卫：协议占位符 / 个人邮箱清零
 *
 * === 背景（代码审查 P0）===
 * `agreementConfig.ts` 与两个协议模板（ServiceAgreement / PrivacyPolicy）里有大量
 * 上线前必填占位符，以及误用的个人 QQ 邮箱（`241849626@qq.com`）——注释自己要求
 * DPO/客服邮箱必须是企业域名邮箱。这些一旦带占位符上线，网信办/工信部核查会认定
 * 「未公开收集使用规则」，有下架/罚款风险。
 *
 * === 判据（由「占位符形态」派生，不是手抄清单）===
 *   1. `agreementConfig.ts` 的**运行时字段值**里不得出现全角方括号 `【】`（运营主体 /
 *      地址 / 信用代码 / DPO 邮箱 / 电话 / 删除期限是法律必填项），也不得出现个人邮箱域名
 *   2. 协议模板里不得出现**明确的待填占位符**：`【请填写…】` / `【如：…】` /
 *      `【第三方主体全称】` / `【链接】`
 *
 * === 刻意**不拦**的（避免误伤，会让 CI 一直假红）===
 *   - 注释里的 `「30日」` 这类引号示例说明（不是占位符）
 *   - 功能引导文案 `【账号设置—注销账号】` / `【投诉/举报渠道】` / `【客服渠道】` ——
 *     这是「进入某入口」的 UI 路径说明，方括号是排版，不是待填占位符
 *
 * 退出码：0 通过 / 1 断言失败
 *
 * 注意：真实主体信息（OPERATOR / 地址 / 信用代码 / 电话 / 删除期限）是业务事实，
 * 本脚本只拦「占位符没填」，不校验「填的是不是对的」——那需要人工核对。
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..'); // oauth21/
const AGREEMENTS = join(ROOT, 'src', 'components', 'common', 'agreements');

let pass = 0;
const failures = [];

function check(label, ok, detail = '') {
  if (ok) {
    pass += 1;
    console.log(`  \u2713 ${label}`);
  } else {
    failures.push(label);
    console.log(`  \u2717 ${label}${detail ? `  \u2192 ${detail}` : ''}`);
  }
}

// 占位符形态（字段值里出现全角方括号 = 待填占位符；示例域名/示例邮箱 = 占位）
const CONFIG_PLACEHOLDER_RE = /【[^】]*】|yourdomain\.com|dpo@|@example\.com/g;
// 个人邮箱域名（qq/163/126/gmail/outlook/hotmail/yahoo/sina/foxmail/sohu）
const PERSONAL_EMAIL_RE = /@(qq|163|126|gmail|outlook|hotmail|yahoo|sina|foxmail|sohu)\.com/gi;
// 协议模板里的「明确待填占位符」：请填写… / 如：…（示例占位）/ 空泛名词「第三方主体全称」/「链接」
const TEMPLATE_PLACEHOLDER_RE = /【请填写[^】]*】|【如[：: ][^】]*】|【第三方主体全称】|【链接】/g;

const configFile = join(AGREEMENTS, 'agreementConfig.ts');
const configText = existsSync(configFile) ? readFileSync(configFile, 'utf8') : '';

console.log('== 1) agreementConfig.ts 运行时字段无占位符 / 个人邮箱 ==');
check('agreementConfig.ts 存在', existsSync(configFile), configFile);
if (existsSync(configFile)) {
  // 只统计「字段值」部分（`export const agreementConfig = {` 之后），排除文件头注释里的说明文字
  const body = configText.slice(configText.indexOf('export const agreementConfig'));
  const ph = body.match(CONFIG_PLACEHOLDER_RE);
  check(
    '字段值无占位符（【】/ yourdomain / dpo@ / example.com）',
    !ph,
    ph ? `仍残留：${[...new Set(ph)].join('、')}` : ''
  );
  const personal = body.match(PERSONAL_EMAIL_RE);
  check('字段值无个人邮箱域名（qq/163/gmail 等）', !personal, personal ? `仍残留：${[...new Set(personal)].join('、')}` : '');
}

console.log('\n== 2) 协议模板无待填占位符 ==');
const templates = ['ServiceAgreement.vue', 'PrivacyPolicy.vue'];
for (const name of templates) {
  const p = join(AGREEMENTS, name);
  if (!existsSync(p)) {
    check(`${name} 存在`, false, '文件缺失');
    continue;
  }
  const text = readFileSync(p, 'utf8');
  // 只看模板内容（排除 <script> 里的 import/解构标识符）
  const template = text.slice(text.indexOf('<template>'));
  const hits = template.match(TEMPLATE_PLACEHOLDER_RE);
  if (hits) {
    check(`${name} 模板无待填占位符`, false, `${hits.length} 处：${[...new Set(hits)].slice(0, 5).join('、')}`);
  } else {
    check(`${name} 模板无待填占位符`, true);
  }
}

// ---------------------------------------------------------------- 汇总
const total = pass + failures.length;
console.log(`\n===== ${failures.length === 0 ? '全绿' : '有失败'}：${pass}/${total} 通过 =====`);
if (failures.length) {
  console.log('失败项：');
  for (const f of failures) console.log(`  - ${f}`);
  console.log('\n提示：上线前把 agreementConfig.ts 里的占位符换成真实主体信息，');
  console.log('      DPO/客服邮箱必须是企业域名邮箱；协议模板里的 SDK 清单等也须填实。');
  process.exit(1);
}
process.exit(0);
