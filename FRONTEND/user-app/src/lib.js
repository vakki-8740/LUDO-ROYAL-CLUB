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
  'PROFILES-LOGO/photo_2026-09-02_16-25-41.jpg',
  'PROFILES-LOGO/photo_2026-09-02_16-26-05.jpg',
  'PROFILES-LOGO/photo_2026-09-02_16-26-06.jpg',
  'PROFILES-LOGO/photo_2026-09-02_16-26-07.jpg',
  'PROFILES-LOGO/photo_2026-09-02_16-26-23.jpg',
  'PROFILES-LOGO/photo_2026-09-02_16-26-24.jpg',
  'PROFILES-LOGO/photo_2026-09-02_16-26-26.jpg',
  'PROFILES-LOGO/photo_2026-09-02_16-26-27.jpg',
  'PROFILES-LOGO/photo_2026-09-02_16-26-29.jpg'
];

export function randomLogo() {
  return RANDOM_LOGOS[Math.floor(Math.random() * RANDOM_LOGOS.length)];
}

// Platform fee: jeet me se 5% platform rakhta hai.
// 100+100=200 pot -> winner ko 190. (Payout/cut admin khud dekhta hai,
// ye sirf display + admin settle ke hisaab ke liye.)
export const PLATFORM_FEE_PCT = 5;

export function prizeFor(betAmount) {
  return Math.floor((betAmount || 0) * 2 * (1 - PLATFORM_FEE_PCT / 100));
}

// Photo halki karo (Telegram fast jayegi) -> JPEG Blob
export function compressPhoto(file, maxSize = 1280) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      const scale = Math.min(1, maxSize / Math.max(width, height));
      width = Math.round(width * scale);
      height = Math.round(height * scale);
      const c = document.createElement('canvas');
      c.width = width;
      c.height = height;
      c.getContext('2d').drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(img.src);
      c.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Photo compress fail'))), 'image/jpeg', 0.8);
    };
    img.onerror = () => reject(new Error('Photo padhi nahi gayi'));
    img.src = URL.createObjectURL(file);
  });
}
