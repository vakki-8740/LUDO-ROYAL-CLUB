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

// ==================== KYC IMAGE UPLOAD (ImgBB, free — Firebase Storage paid hai isliye) ===
// TODO: https://api.imgbb.com/ se free API key lekar yahan dalo
export const IMGBB_API_KEY = 'TUMHARI_IMGBB_KEY';

// Photo chhoti karo (bina compress ke upload slow + fail hoga)
export function compressImage(file, maxSize = 1024) {
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
      resolve(c.toDataURL('image/jpeg', 0.75).split(',')[1]);
    };
    img.onerror = () => reject(new Error('Photo padhi nahi gayi'));
    img.src = URL.createObjectURL(file);
  });
}

export async function uploadToImgbb(base64) {
  if (!IMGBB_API_KEY || IMGBB_API_KEY === 'TUMHARI_IMGBB_KEY') {
    throw new Error('ImgBB key nahi lagi. lib.js me IMGBB_API_KEY dalo.');
  }
  const form = new FormData();
  form.append('image', base64);
  const res = await fetch('https://api.imgbb.com/1/upload?key=' + IMGBB_API_KEY, {
    method: 'POST',
    body: form
  });
  const j = await res.json();
  if (!j.success) throw new Error('Photo upload fail');
  return j.data.url;
}
