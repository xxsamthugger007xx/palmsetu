# Vedic Astrology Reference (Documentation Only)

This file is a human-readable reference companion to the typed, structured
knowledge base the application actually queries at runtime:
`server/src/astrology/knowledgeBase/vedicRashis.ts`, `vedicNakshatras.ts`,
`vedicGrahas.ts`, `vedicBhavas.ts`, `vedicDashas.ts`, and `vedicConcepts.ts`,
all read through `knowledgeBaseService.ts`'s `getAstrologyKnowledge()`.

This `.md` file is NOT parsed by the running server. It exists as source
documentation someone can read directly, and as a record of the research
scope for this pass. If this content and the TS files ever disagree, the TS
files are authoritative, since those are what the AI assistant is actually
grounded against.

All content below is traditional, symbolic, interpretive material
synthesized from standard, widely published Vedic/Jyotish reference sources
(public-domain concepts accumulated over centuries), in original wording.
It is never a scientific claim, a medical diagnosis, or a guaranteed
prediction of a future event.

## The 12 Rashis (sidereal zodiac signs)

Mesha (Aries), Vrishabha (Taurus), Mithuna (Gemini), Karka (Cancer), Simha
(Leo), Kanya (Virgo), Tula (Libra), Vrishchika (Scorpio), Dhanu
(Sagittarius), Makara (Capricorn), Kumbha (Aquarius), Meena (Pisces). Each
Rashi has a ruling planet, an element (fire/earth/air/water), a quality
(movable/fixed/dual), and a traditional personality theme. See
`vedicRashis.ts` for the full entry for each.

## The 27 Nakshatras (lunar mansions)

Ashwini, Bharani, Krittika, Rohini, Mrigashira, Ardra, Punarvasu, Pushya,
Ashlesha, Magha, Purva Phalguni, Uttara Phalguni, Hasta, Chitra, Swati,
Vishakha, Anuradha, Jyeshtha, Mula, Purva Ashadha, Uttara Ashadha, Shravana,
Dhanishta, Shatabhisha, Purva Bhadrapada, Uttara Bhadrapada, Revati. Each has
a ruling deity/symbol, a ruling planet (which also sequences the Vimshottari
dasha), and a traditional meaning. Pada-level detail is summarized at a high
level per nakshatra rather than as 108 separate sub-entries. See
`vedicNakshatras.ts`.

## The 9 Grahas (planets, including the lunar nodes)

Surya (Sun), Chandra (Moon), Mangal (Mars), Budh (Mercury), Guru/Brihaspati
(Jupiter), Shukra (Venus), Shani (Saturn), Rahu (North Node), Ketu (South
Node). See `vedicGrahas.ts`.

## The 12 Bhavas (houses)

Tanu Bhava (self/body) through Vyaya Bhava (loss/liberation) - each house's
traditional area-of-life meaning is in `vedicBhavas.ts`.

## The Vimshottari Dasha system

The 9 dasha lords, in traditional sequence: Ketu (7y), Venus (20y), Sun (6y),
Moon (10y), Mars (7y), Rahu (18y), Jupiter (16y), Saturn (19y), Mercury
(17y). The engine (`astrology/engine.ts`) computes which dasha a real user
is currently in; `vedicDashas.ts` adds the traditional interpretive meaning
of each lord's period.

## Core concepts

Lagna (Ascendant), Rashi vs Nakshatra, and a high-level framing of Guna
Milan (traditional 36-point Ashtakoota compatibility matching) are covered
in `vedicConcepts.ts`.

## Research approach

Synthesized from multiple established, non-fringe Vedic/Jyotish reference
sites and educational material, cross-checked across sources, and rewritten
in original wording rather than copied from any single source. This is
standard public-domain traditional content, not anyone's proprietary IP.
