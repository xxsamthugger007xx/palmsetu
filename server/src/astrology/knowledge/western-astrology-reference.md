# Western Astrology Reference (Documentation Only)

This file is a human-readable reference companion to the typed, structured
knowledge base the application actually queries at runtime:
`server/src/astrology/knowledgeBase/westernSigns.ts`, `westernHouses.ts`,
`westernPlanets.ts`, `westernAspects.ts`, and `westernConcepts.ts`, all read
through `knowledgeBaseService.ts`'s `getAstrologyKnowledge()`.

This `.md` file is NOT parsed by the running server. It exists as source
documentation someone can read directly, and as a record of the research
scope for this pass. If this content and the TS files ever disagree, the TS
files are authoritative, since those are what the AI assistant is actually
grounded against.

This file deepens/extends the existing lighter trait fragments in
`astrology/signContent.ts`'s `SIGN_THEMES` (used for daily horoscope
phrasing) rather than duplicating them; `SIGN_THEMES` stays the source for
daily-horoscope generation, these entries are the fuller reference content
for direct knowledge questions.

All content below is traditional, symbolic, interpretive material
synthesized from standard, widely published Western astrology reference
sources (public-domain concepts), in original wording. It is never a
scientific claim, a medical diagnosis, or a guaranteed prediction of a
future event.

## The 12 tropical zodiac signs

Aries, Taurus, Gemini, Cancer, Leo, Virgo, Libra, Scorpio, Sagittarius,
Capricorn, Aquarius, Pisces. Each has a ruling planet (including the
traditional/modern co-ruler split for Scorpio/Pluto, Aquarius/Uranus, and
Pisces/Neptune), an element, a modality (cardinal/fixed/mutable), and a
traditional personality theme. See `westernSigns.ts`.

## The 12 houses

1st House (self/identity, anchored by the Ascendant) through 12th House
(subconscious/transcendence). Framed by angular/succedent/cadent house
type. See `westernHouses.ts`.

## The planets

Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn (traditional seven), plus
the three modern outer planets commonly included in standard Western
practice: Uranus, Neptune, Pluto. See `westernPlanets.ts`.

## Major aspects

Conjunction (0 degrees), sextile (60 degrees), square (90 degrees), trine
(120 degrees), opposition (180 degrees). See `westernAspects.ts`.

## Core concepts

The Sun/Moon/Rising "Big Three" framing, the four elements, and the three
modalities are covered in `westernConcepts.ts`.

## Research approach

Synthesized from multiple established, non-fringe Western astrology
reference sites and educational material, cross-checked across sources,
and rewritten in original wording rather than copied from any single
source. This is standard public-domain traditional content, not anyone's
proprietary IP.
