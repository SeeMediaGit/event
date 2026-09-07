import Image from "next/image";

export function SeeMediaLogo({ size = 42 }: { size?: number }) {
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-xl bg-black shadow-glow ring-1 ring-brand/30"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <Image
        src="/app-icon.png"
        alt="See Media"
        width={size}
        height={size}
        priority
        className="h-full w-full object-cover"
      />
    </div>
  );
}
