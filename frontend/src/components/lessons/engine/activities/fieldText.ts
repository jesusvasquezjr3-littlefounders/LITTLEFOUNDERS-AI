/**
 * Accesores tolerantes a la DERIVA de nombres de campo del corpus.
 * El corpus usa distintas claves para el mismo texto visible (text/label/name/title/item...),
 * lo que dejaba elementos EN BLANCO cuando un componente leía solo una clave.
 * Usar estos helpers en la capa de RENDER (no afecta el grading, que vive en validateAnswer).
 */

/** Texto de display de una opción/ítem/categoría/columna. Primer campo no vacío. */
export function pickText(
  obj: any,
  keys: string[] = ["text", "label", "name", "title", "item", "word", "term", "value"],
): string {
  if (obj == null) return "";
  if (typeof obj === "string") return obj;
  for (const k of keys) {
    const v = obj[k];
    if (v != null && String(v).trim() !== "") return String(v);
  }
  return "";
}

/** Quién habla en un mensaje de chat (roleplay_chat): speaker | sender | role. */
export function speakerOf(m: any): string {
  return String(m?.speaker ?? m?.sender ?? m?.role ?? "");
}

/** Texto de un mensaje de chat: text | message | content. */
export function messageOf(m: any): string {
  return String(m?.text ?? m?.message ?? m?.content ?? "");
}

/** ¿El emisor del mensaje es el usuario/héroe (vs npc/sistema)? */
export function isUserSpeaker(m: any): boolean {
  const s = speakerOf(m).toLowerCase();
  return s === "user" || s === "hero" || s === "you" || s === "tú" || m?.isUser === true;
}
