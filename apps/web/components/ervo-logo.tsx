import Image from "next/image";

const SIZES = {
  sm: 16,
  md: 28,
  lg: 48,
  xl: 64,
} as const;

export function ErvoLogo({
  size = "md",
  className,
  priority,
}: {
  size?: keyof typeof SIZES;
  className?: string;
  priority?: boolean;
}) {
  const px = SIZES[size];
  return (
    <Image
      src="/logo.png?v=4"
      alt="Ervo"
      width={px}
      height={px}
      className={className ?? "object-contain"}
      priority={priority}
      unoptimized
    />
  );
}
