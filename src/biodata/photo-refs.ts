import type { BiodataProfile, PhotoRef } from "./types";

// Where a profile points at pictures (VISION D12, D40, D41): the main photo, the second photo, the extra photo
// pages and the horoscope chart. The images themselves live in the photos table under these ids. Pure helpers for
// the code that copies or imports a draft (profile-repo's duplicate and import, backup.ts), so none of them
// has to know the list of places.

/** Every picture id the profile points at, in a stable order (main, second, extra pages, horoscope chart). */
export function photoIdsOf(profile: BiodataProfile): string[] {
  return [
    profile.photo?.id,
    profile.secondPhoto?.id,
    ...(profile.photoPages?.photos.map((photo) => photo.id) ?? []),
    profile.horoscopeChart?.id,
  ].filter((id): id is string => id !== undefined);
}

/**
 * The profile with every picture reference given the id `change` returns for it (`undefined` removes the
 * reference). A removed extra photo leaves the others in order, and an emptied photo-pages group goes with them.
 * Never changes its input.
 */
export function mapPhotoRefs(profile: BiodataProfile, change: (id: string) => string | undefined): BiodataProfile {
  const next = { ...profile };
  const swap = <T extends PhotoRef>(ref: T | undefined): T | undefined => {
    if (!ref) return undefined;
    const id = change(ref.id);
    return id === undefined ? undefined : { ...ref, id };
  };
  const photo = swap(profile.photo);
  const secondPhoto = swap(profile.secondPhoto);
  const horoscopeChart = swap(profile.horoscopeChart);
  const extra = profile.photoPages?.photos.map(swap).filter((ref): ref is PhotoRef => ref !== undefined);

  // `delete` rather than `= undefined`, so a removed picture leaves no key behind (the schema and tests treat the
  // two differently).
  if (photo) next.photo = photo;
  else delete next.photo;
  if (secondPhoto) next.secondPhoto = secondPhoto;
  else delete next.secondPhoto;
  if (horoscopeChart) next.horoscopeChart = horoscopeChart;
  else delete next.horoscopeChart;
  // Only a group that lost all of its pictures goes; one that was already empty stays as stored.
  if (profile.photoPages && extra && (extra.length > 0 || profile.photoPages.photos.length === 0)) {
    next.photoPages = { ...profile.photoPages, photos: extra };
  } else delete next.photoPages;
  return next;
}

/** The profile with each picture id swapped through `ids`; an id not in the map is kept as it is. */
export function swapPhotoIds(profile: BiodataProfile, ids: ReadonlyMap<string, string>): BiodataProfile {
  return mapPhotoRefs(profile, (id) => ids.get(id) ?? id);
}

/** The profile without the references to pictures that aren't in `keep`. */
export function keepPhotoRefs(profile: BiodataProfile, keep: ReadonlySet<string>): BiodataProfile {
  return mapPhotoRefs(profile, (id) => (keep.has(id) ? id : undefined));
}
