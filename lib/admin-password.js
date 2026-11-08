'use strict';
const {randomBytes, scrypt, timingSafeEqual} = require('node:crypto');
const {promisify} = require('node:util');
const derive = promisify(scrypt);
async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await derive(password, salt, 64);
  return `scrypt$${salt}$${key.toString('hex')}`;
}
async function verifyPassword(password, hash) {
  if (typeof password !== 'string' || Buffer.byteLength(password) < 1 || Buffer.byteLength(password) > 1024) return false;
  const match = /^scrypt\$([a-f0-9]{32})\$([a-f0-9]{128})$/.exec(hash);
  if (!match) return false;
  const actual = await derive(password, match[1], 64);
  return timingSafeEqual(actual, Buffer.from(match[2], 'hex'));
}
module.exports = {hashPassword, verifyPassword};
if (require.main === module) {
  // Read from stdin so the password does not need to appear in command arguments.
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => { input += chunk; });
  process.stdin.on('end', async () => {
    const password = input.replace(/\r?\n$/, '');
    if (!password || Buffer.byteLength(password) > 1024) { process.stderr.write('Informe uma senha de 1 a 1024 bytes pela entrada padrão.\n'); process.exitCode = 1; return; }
    process.stdout.write(await hashPassword(password) + '\n');
  });
}
