import { useTranslation } from "react-i18next";
import "./Families.css";

/*
 * The four mentors, together, in miniature — reused at the top and bottom of
 * /families to answer the actual question the AI-visibility block exists to
 * raise: "who is my child talking to?" Same four keys HowItWorks' mentor grid
 * reads (`tutor.character.<who>.name`), same reason: their names live where
 * the product already keeps them, so a personality retune can never leave
 * this page contradicting the Tutor itself.
 */
const MENTORS = [
  { key: "zara", art: "/marketing/mentor-zara-bust.webp" },
  { key: "rho", art: "/marketing/mentor-rho-bust.webp" },
  { key: "liruf", art: "/marketing/mentor-liruf-bust.webp" },
  { key: "dina", art: "/marketing/mentor-dina-bust.webp" },
] as const;

export function MentorStrip({ className }: { className?: string }) {
  const { t } = useTranslation();

  return (
    <ul className={`lf-fam-cast ${className ?? ""}`}>
      {MENTORS.map((mentor, index) => (
        <li key={mentor.key} className="lf-fam-cast__member" style={{ animationDelay: `${index * -1.3}s` }}>
          <img
            src={mentor.art}
            alt=""
            aria-hidden="true"
            width={200}
            height={200}
            loading="lazy"
            decoding="async"
            className="lf-fam-cast__art"
          />
          <span className="lf-caption font-semibold text-content-muted">
            {t(`tutor.character.${mentor.key}.name`)}
          </span>
        </li>
      ))}
    </ul>
  );
}
