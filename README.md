# Medical tools by Marc Machaalani

Prepared for https://machaalanimd.github.io/. This static site introduces Sage and Folio. It uses no backend, account system, analytics or persistent user-state storage.

- Sage: https://machaalanimd.github.io/sage/ (separate existing repository).
- Folio: `/folio/`, a specialty/topic reader for supplied 2025–26 manual content.

## Folio

The reader contains 210 topic entries, 18 specialties, 266 original source pages and 830 focused source sections. Clinical material is preserved as lossless visual source sections, keeping tables, figures, citations and dose alignment intact. It is searchable through a text index built from retained characters, with abbreviation-aware title ranking. Topic sections can be selected individually, filtered by source heading, enlarged and zoomed. A reading list is kept in memory for the current session.

The original source is the MGH Department of Medicine Housestaff Manual, July 2025–June 2026, edited by Christopher Radcliffe, MD and Natalia Sutherland, MD, with its original contributors. Marc Machaalani created this interface, not the source clinical material. `folio/source-manifest.json` records edition, editors, source SHA-256 and omission scope. The underlying PDF is not bundled or republished as an unfiltered file.

295 identified institution-specific fragments or protocol units were omitted, including local routing, phone/pager numbers, order sets, formulary notes and explicitly local algorithms. The full hospital directory is omitted. The title, institutional preface and static contents page are replaced by reader metadata and navigation. Source authorship and citations are retained. Each topic reports its local-omission count. Regional legal/administrative passages retain their original geographic scope and date; the reader does not assert their universal applicability. This is a bounded source-content adaptation, not clinical validation or a guarantee that every institutional practice has been identified.

No clinical wording is rewritten, modernized, or replaced with new recommendations. The source edition is dated and is not a live guideline service. Any clinical use requires checking current primary sources and applicable local policy.

## Preview and verify

```sh
node scripts/verify.mjs
python3 -m http.server 8000 --bind 127.0.0.1
```

Open the printed URL. The verifier checks topic/page coverage, source identity, section continuity, image presence, abbreviation ranking, known local-index exclusions, project links and browser-only state. Representative source images were separately compared pixel-for-pixel against the supplied PDF render; pixels outside local omission rectangles were unchanged.

The GitHub Actions workflow publishes the static site after verification. The intended repository is `MachaalaniMD/machaalanimd.github.io`; publication is complete only after the Pages deployment succeeds.
