import { initials } from "@dlp/shared";
import { cn } from "@/lib/utils";

type AvatarProps = {
  name: string;
  src?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizes = {
  sm: "h-8 w-8 text-[0.68rem]",
  md: "h-10 w-10 text-xs",
  lg: "h-14 w-14 text-sm",
};

const tones = [
  "bg-[#E4F1E8] text-[#1E5C40]",
  "bg-[#F6EAD8] text-[#7A4A14]",
  "bg-[#E7E9F6] text-[#3B4688]",
  "bg-[#F3E5E5] text-[#8A3535]",
];

export function Avatar({ name, src, size = "md", className }: AvatarProps) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={cn("shrink-0 rounded-full object-cover", sizes[size], className)}
      />
    );
  }

  const tone = tones[name.charCodeAt(0) % tones.length] ?? tones[0]!;

  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-semibold tracking-wide",
        sizes[size],
        tone,
        className,
      )}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}
