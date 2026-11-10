// 把明文 HTML 片段加密後，寫進頁面的 <script type="application/json" id="enc-payload">。
// 用法：node tools/encrypt-page.mjs <明文片段.html> <目標頁面.html> [沿用 salt 的頁面.html]
// 密碼從環境變數 PAGE_PASSWORD 讀取；沒有設定時會在終端機詢問（不會寫進任何檔案）。
// 加密方式：PBKDF2-SHA256（600,000 次）衍生金鑰 + AES-256-GCM，每次加密都產生新的 salt 與 iv。
import { readFileSync, writeFileSync } from 'node:fs';
import { webcrypto as crypto } from 'node:crypto';
import { createInterface } from 'node:readline';

const [, , srcPath, pagePath] = process.argv;
if (!srcPath || !pagePath) {
  console.error('用法：node tools/encrypt-page.mjs <明文片段.html> <目標頁面.html>');
  process.exit(1);
}

async function askPassword() {
  if (process.env.PAGE_PASSWORD) return process.env.PAGE_PASSWORD;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const pw = await new Promise((r) => rl.question('密碼：', r));
  rl.close();
  return pw;
}

const ITER = 600000;
const b64 = (buf) => Buffer.from(buf).toString('base64');

const password = await askPassword();
if (!password) { console.error('沒有密碼'); process.exit(1); }

// 第三個參數（選填）：沿用另一個加密頁面的 salt。同一密碼＋同一 salt 會衍生出同一把金鑰，
// 訪客在同一分頁解鎖其中一頁後，其他共用 salt 的頁面也會自動解鎖。
const saltFrom = process.argv[4];
const plain = readFileSync(srcPath, 'utf8');
let salt = crypto.getRandomValues(new Uint8Array(16));
if (saltFrom) {
  const m = readFileSync(saltFrom, 'utf8').match(/<script type="application\/json" id="enc-payload">([\s\S]*?)<\/script>/);
  if (!m) { console.error(`${saltFrom} 找不到 enc-payload`); process.exit(1); }
  salt = Buffer.from(JSON.parse(m[1]).salt, 'base64');
}
const iv = crypto.getRandomValues(new Uint8Array(12));
const baseKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' }, baseKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plain));

const payload = JSON.stringify({ v: 1, iter: ITER, salt: b64(salt), iv: b64(iv), ct: b64(ct) });
const page = readFileSync(pagePath, 'utf8');
const re = /(<script type="application\/json" id="enc-payload">)[\s\S]*?(<\/script>)/;
if (!re.test(page)) { console.error('目標頁面找不到 <script type="application/json" id="enc-payload">'); process.exit(1); }
writeFileSync(pagePath, page.replace(re, `$1${payload}$2`));
console.log(`已加密 ${plain.length} 字元，寫入 ${pagePath}`);
