# Changelog

All notable changes to this project are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-11-12

### Added
- Duck-typed core that never imports pdfjs-dist: `buildPageIndex`, `locateInIndexes`, `createLocator`, `normalizeText`, `toViewportRects`.
- Three-stage search: exact, normalized (whitespace-insensitive), approximate alignment (Sellers edit distance with 3-gram window voting) with a score threshold and a closest-candidate report when nothing matches.
- Line rectangles from item transform matrices (rotated glyphs included) with an optional `Measurer`; `approx` flag when x positions are estimated.
- `pdf-cite-locate/react`: `<CitationHighlights>` overlay.
- `pdf-cite-locate/dom`: `createCanvasMeasurer`.
- Node example and a Vite + react-pdf web example (English / Korean).
- Fixtures generated offline with pdf-lib; tests run against pdfjs-dist 6.3.289 and 6.5.438.
