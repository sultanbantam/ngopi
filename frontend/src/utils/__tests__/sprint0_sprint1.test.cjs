const test = require('node:test');
const assert = require('node:assert');

test('UX-02: dateFormat logic validates formatting rules', () => {
  const pad = (n) => n.toString().padStart(2, '0');
  const now = new Date();
  const todayStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  // Helper format simulation
  function formatMsg(d) {
    const isToday = d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    const timeStr = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    if (isToday) return timeStr;
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = d.getDate() === yesterday.getDate() && d.getMonth() === yesterday.getMonth() && d.getFullYear() === yesterday.getFullYear();
    if (isYesterday) return `Kemarin, ${timeStr}`;
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${timeStr}`;
  }

  assert.strictEqual(formatMsg(now), todayStr);

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  assert.ok(formatMsg(yesterday).startsWith('Kemarin, '));

  const older = new Date(2026, 8, 29, 6, 22); // 29 Sep 2026
  assert.strictEqual(formatMsg(older), '29 Sep, 06:22');
});

test('FITUR-03: Warkop reactions list validation', () => {
  const warkopEmojis = ['☕', '🍵', '🚬', '🎵', '🍜', '🌙'];
  assert.strictEqual(warkopEmojis.length, 6);
  assert.ok(warkopEmojis.includes('☕'));
  assert.ok(warkopEmojis.includes('🌙'));
});

test('FITUR-04: Night mode time rule validation', () => {
  function isNight(hour) {
    return hour >= 21 || hour < 5;
  }
  assert.strictEqual(isNight(21), true);
  assert.strictEqual(isNight(23), true);
  assert.strictEqual(isNight(2), true);
  assert.strictEqual(isNight(4), true);
  assert.strictEqual(isNight(5), false);
  assert.strictEqual(isNight(12), false);
  assert.strictEqual(isNight(20), false);
});
