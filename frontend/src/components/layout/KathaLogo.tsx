import Image from 'next/image';

// Kích thước thật của public/katha-logo.png
const LOGO_W = 760;
const LOGO_H = 633;

interface KathaLogoProps {
  /** Chiều rộng hiển thị (px). Bỏ qua nếu có `height`. Mặc định 240. */
  width?: number;
  /** Chiều cao hiển thị (px) — dùng ở header, nơi bị giới hạn chiều cao. */
  height?: number;
  className?: string;
  priority?: boolean;
}

/** Logo Katha đầy đủ. Luôn hiển thị trọn logo, chỉ thay đổi cỡ theo chỗ đặt. */
export function KathaLogo({ width, height, className = '', priority = false }: KathaLogoProps) {
  const w = height ? Math.round((height * LOGO_W) / LOGO_H) : (width ?? 260);
  const h = height ?? Math.round(((width ?? 260) * LOGO_H) / LOGO_W);

  return (
    <Image
      src="/katha-logo.png"
      alt="Katha"
      width={w}
      height={h}
      priority={priority}
      className={`shrink-0 select-none ${className}`}
    />
  );
}
