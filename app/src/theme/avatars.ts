/**
 * Static illustrated avatar sets, by gender. Metro requires `require()`
 * calls to be literal (it cannot dynamically list a folder at build time),
 * so each image must be added here by hand as it's dropped into
 * assets/avatars/<gender>/.
 *
 * Drop files in as: assets/avatars/male/avatar1.png, avatar2.png, ... and
 * assets/avatars/female/avatar1.png, avatar2.png, ... (any image format
 * Metro supports - png/jpg/webp - works; just match the extension below).
 * Then uncomment/add one require() line per file here. Any number of
 * images works - the arrays can be any length, they don't need to match
 * each other.
 *
 * A user's avatar is picked by `avatarIndex % thisArray.length` (see
 * AIAvatar.tsx) - avatarIndex itself comes from the backend (UserIdentity,
 * assigned once per user, see routes/astrology.ts's PUT /identity), so
 * adding more images later never breaks an existing user's assignment, it
 * only adds more images into the rotation for everyone.
 */
export const MALE_AVATARS: number[] = [
  require('../../assets/avatars/male/male1.png'),
  require('../../assets/avatars/male/male2.png'),
  require('../../assets/avatars/male/male3.png'),
  require('../../assets/avatars/male/male4.png'),
  require('../../assets/avatars/male/male5.png'),
];

export const FEMALE_AVATARS: number[] = [
  require('../../assets/avatars/female/female1.png'),
  require('../../assets/avatars/female/female2.png'),
  require('../../assets/avatars/female/female3.png'),
  require('../../assets/avatars/female/female4.png'),
  require('../../assets/avatars/female/female5.png'),
];

/** Every avatar, each under a stable key that never shifts even if images
 * are reordered/added later - used by the "change avatar" picker in
 * Profile, where the user can pick ANY of the 10 regardless of their own
 * gender (unlike the automatic default assignment, which only picks from
 * the user's own MALE_AVATARS/FEMALE_AVATARS set). */
export const AVATAR_CHOICES: { key: string; source: number }[] = [
  ...MALE_AVATARS.map((source, i) => ({ key: `male${i + 1}`, source })),
  ...FEMALE_AVATARS.map((source, i) => ({ key: `female${i + 1}`, source })),
];

export function avatarSourceForKey(key: string | null | undefined): number | null {
  if (!key) return null;
  return AVATAR_CHOICES.find((a) => a.key === key)?.source ?? null;
}
