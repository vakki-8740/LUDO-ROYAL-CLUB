export function generateUserId() {
  return Math.floor(10000 + Math.random() * 90000).toString();
}

export function todayStr() {
  const d = new Date();
  return (
    String(d.getDate()).padStart(2, '0') +
    '/' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '/' +
    d.getFullYear()
  );
}

export const RANDOM_LOGOS = [
  'USERS-LOGO/photo_2026-09-02_16-25-41.jpg',
  'USERS-LOGO/photo_2026-09-02_16-26-05.jpg',
  'USERS-LOGO/photo_2026-09-02_16-26-06.jpg',
  'USERS-LOGO/photo_2026-09-02_16-26-07.jpg',
  'USERS-LOGO/photo_2026-09-02_16-26-23.jpg',
  'USERS-LOGO/photo_2026-09-02_16-26-24.jpg',
  'USERS-LOGO/photo_2026-09-02_16-26-26.jpg',
  'USERS-LOGO/photo_2026-09-02_16-26-27.jpg',
  'USERS-LOGO/photo_2026-09-02_16-26-29.jpg'
];

export function randomLogo() {
  return RANDOM_LOGOS[Math.floor(Math.random() * RANDOM_LOGOS.length)];
}

// NOTE: ye images purane HTML app ke hain. Jab React deploy hoga to
// public/ me copy karna (abhi logo.png hai). Tab tak random Google photo use hoti hai.
