import type {
  Reference,
  ReferenceCache
} from 'obsidian';

/**
 * Gets the name a note is shown under: its path without the folder and without the `.md` extension.
 *
 * @param path - The note's path.
 * @returns The name.
 */
export function getNoteName(path: string): string {
  const name = path.slice(path.lastIndexOf('/') + 1);
  return name.endsWith('.md') ? name.slice(0, -'.md'.length) : name;
}

/**
 * Checks whether a reference is one in the note's body, which has a position, rather than one in its properties.
 *
 * @param reference - The reference.
 * @returns Whether it has a position.
 */
export function isReferenceCache(reference: Reference): reference is ReferenceCache {
  return 'position' in reference;
}
