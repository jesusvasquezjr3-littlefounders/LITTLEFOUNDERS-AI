type ClassValue = string | number | null | undefined | false | ClassValue[];

/** Minimal clsx-style class combiner (characters and components depend on it). */
export function cn(...inputs: ClassValue[]): string {
  return inputs
    .flat(Infinity as 0)
    .filter((v): v is string | number => Boolean(v))
    .map(String)
    .join(' ');
}
