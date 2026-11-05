# Tools for medicine

Static source for https://machaalanimd.github.io/. The collection introduces Sage and Folio, without accounts, analytics, a backend or persistent user-state storage.

- Sage: the separate repository/site at `/sage/`.
- Folio: `/folio/`, a searchable reader for the supplied 2025–26 manual.

## Folio

Folio presents the retained source content as selectable, reflowing HTML paragraphs, headings, lists and tables. Table cells retain their source row/column relationships and merged spans. Tables scroll within their own containers on mobile. ECGs, imaging examples, anatomy and clinical illustrations remain individual source figures. Imported PDF clipping boundaries are respected so invisible template text is excluded. Illustrations in data tables remain inside the corresponding source cells. Diagrams assembled from embedded image fragments are consolidated into optional original-diagram views, alongside the reflowing text. Full-page screenshot assets are not shipped.

The original source is the MGH Department of Medicine Housestaff Manual, July 2025–June 2026, edited by Christopher Radcliffe, MD and Natalia Sutherland, MD, with its original contributors. Marc Machaalani created the reader interface, not the clinical material. The reader retains the 210 topics, 18 specialties and 266 included source pages. Its source manifest records the edition, editors, source SHA-256 and conversion scope. The underlying PDF is not bundled as an unfiltered file.

Identified institutional routing, phone/pager numbers, order sets, formulary notes and local protocol units are omitted, along with the hospital directory. The title page, preface and static contents are replaced by reader metadata/navigation. Regional legal and administrative material retains its source scope/date. This is a bounded source adaptation, not medical validation or a guarantee that every local practice has been identified.

Clinical wording is not modernized or replaced with new recommendations. Source errors or ambiguities are not silently corrected. Some original illustrations remain visual content. Transcribed raster tables were compared with their source figures; the original table is optionally available beside them. This is the dated source edition, not a live guideline service.

Folio uses a modern blue interface with a compact 18-system directory, larger section headings and rounded reading surfaces. Each system opens a topic list, and search always spans the whole manual. Static system/topic hashes support direct links. Tables use content-sized columns, contained horizontal scrolling and an expanded reading view. Multi-page illustrated tables repeat their original column headings. Source-verified table repairs separate fused grids and keep internal drug-class bands inside their original tables. Standalone minus signs are retained as cell values. The antibiotic-spectrum chart preserves disjoint colored segments, including the source's unfilled anaerobes segment for cefepime.

Paper citations are moved below section titles into a References disclosure with their original links. Twenty source-reviewed subtype groups reflow as sibling bullets, with shared qualifiers kept outside the group; nine negative cases guard against splitting conditional treatment instructions. Eighty-five headings have PDF tracking artifacts removed using the original glyph positions, allowing only whitespace changes with the same ordered characters.

Attribution is available through the single **Source** button in About. It includes the edition and original institutional app link, editors, all chapter/topic credits (including omitted material), previous editors and preface acknowledgements, and all 185 exact printed name forms. The institutional app link is not represented as a public download of this PDF edition. The reading interface has no repeated provenance counters or contributor footers.

The reader supports a mobile section selector, section focus, adjustable text in a focus dialog and a session reading list. Search and reading state remain in memory and clear on reload. URL hashes identify static topics only.

## Run and verify

```sh
node scripts/verify.mjs
python3 -m http.server 5173
```

The verifier checks page/topic coverage; native HTML block types; all table-grid positions and merged spans; clinically meaningful medication/dose pairings; multi-page headers; selected local omissions; source identity; PDF-native text conversion digests; safe HTML rendering; abbreviation search; and browser-only state. It also checks reviewed table shapes, punctuation cells, subtype partitions and conditional guards, contributor-name coverage, and citation placement. `folio/conversion-audit.json` explains the character digest's limits: it does not establish reading order, completeness of illustration transcription, or clinical validity. The conversion was also inspected against rendered source pages and in mobile/desktop browser views.

## Publication

GitHub Pages uses `.github/workflows/pages.yml`. Every push to `main` runs the verifier, stages only the public site files and deploys the resulting static artifact. No secrets are stored in this source.

Source-formatting boundaries are derived from source line positions, hanging indents, list markers and title typography, rather than a blanket continuation tolerance. `scripts/folio_text_structure.py` records the authoring rule; it requires pdfplumber in the optional PDF-authoring environment. `tests/folio-structure-cases.json` records source-reviewed boundary and wrap regression examples checked against the shipped data by CI.
