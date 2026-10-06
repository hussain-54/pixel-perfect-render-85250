import {
  Facebook,
  Ghost,
  Instagram,
  Linkedin,
  MessageCircle,
  Music2,
  Twitter,
  Youtube,
  type LucideIcon,
} from "lucide-react";
import { socialLinks, type SocialChannelId } from "@/data/contact";
import { cn } from "@/lib/utils";

const socialIcons: Record<SocialChannelId, LucideIcon> = {
  facebook: Facebook,
  instagram: Instagram,
  youtube: Youtube,
  linkedin: Linkedin,
  x: Twitter,
  snapchat: Ghost,
  tiktok: Music2,
  whatsapp: MessageCircle,
};

/** Platform brand fills — restrained enough for the navy utility bar. */
const brandClassName: Record<SocialChannelId, string> = {
  facebook: "bg-[#1877F2] text-white hover:bg-[#166FE5]",
  instagram:
    "bg-[linear-gradient(135deg,#FCAF45_0%,#E4405F_45%,#C13584_70%,#833AB4_100%)] text-white hover:opacity-90",
  youtube: "bg-[#FF0000] text-white hover:bg-[#E60000]",
  linkedin: "bg-[#0A66C2] text-white hover:bg-[#0958A8]",
  x: "bg-[#111111] text-white hover:bg-black",
  snapchat: "bg-[#FFFC00] text-[#111111] hover:bg-[#F5F200]",
  tiktok: "bg-[#010101] text-white hover:bg-black",
  whatsapp: "bg-[#25D366] text-white hover:bg-[#1EBE57]",
};

type SocialLinksProps = {
  className?: string | undefined;
  /** Visual density for utility bar vs drawer/footer. */
  size?: "utility" | "default" | undefined;
  /** Focus-ring offset surface. */
  surface?: "navy" | "light" | undefined;
};

function iconShellClass(
  id: SocialChannelId,
  size: "utility" | "default",
  surface: "navy" | "light",
  interactive: boolean,
) {
  const hit = size === "utility" ? "h-8 w-8" : "h-9 w-9";
  return cn(
    "inline-flex shrink-0 items-center justify-center rounded-full shadow-[0_1px_0_rgb(0_0_0_/0.12)] transition-[transform,opacity,background-color] duration-200 ease-out",
    interactive && "hover:scale-[1.06] hover:opacity-95 active:scale-[0.98]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bright/60 focus-visible:ring-offset-1",
    surface === "navy" ? "focus-visible:ring-offset-navy" : "focus-visible:ring-offset-white",
    hit,
    brandClassName[id],
  );
}

export function SocialLinks({ className, size = "default", surface = "light" }: SocialLinksProps) {
  const glyph = size === "utility" ? "h-[17px] w-[17px]" : "h-[18px] w-[18px]";

  return (
    <nav aria-label="Social media" className={cn("flex items-center gap-1.5", className)}>
      {socialLinks.map((item) => {
        const Icon = socialIcons[item.id];
        const href = item.href.trim();
        const interactive = Boolean(href);

        if (!interactive) {
          return (
            <span
              key={item.id}
              aria-label={item.label}
              title={`${item.label} — link coming soon`}
              className={iconShellClass(item.id, size, surface, false)}
            >
              <Icon className={glyph} aria-hidden strokeWidth={2.1} />
            </span>
          );
        }

        return (
          <a
            key={item.id}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={item.label}
            className={iconShellClass(item.id, size, surface, true)}
          >
            <Icon className={glyph} aria-hidden strokeWidth={2.1} />
          </a>
        );
      })}
    </nav>
  );
}

/** Alias kept for existing imports. */
export function ContactSocialLinks({
  className,
}: {
  className?: string | undefined;
  iconClassName?: string | undefined;
}) {
  return <SocialLinks className={className} size="default" />;
}
