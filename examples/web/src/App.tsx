import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { createLocator, type DocumentLike, type LocateResult, type Locator, type ViewportLike } from "pdf-cite-locate";
import { CitationHighlights } from "pdf-cite-locate/react";
import { createCanvasMeasurer } from "pdf-cite-locate/dom";
import answers from "../answers.json";
import pdfUrl from "../../../fixtures/citations.pdf?url";
import { resolveLang, STORAGE_KEY, translate, type Lang, type MessageKey } from "./i18n";
import { fitScale, SCALE } from "./fit";

// The worker must come from the same pdfjs-dist that react-pdf uses (API/worker versions must match).
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

/** The part of a loaded pdf.js page the example needs: a viewport at any scale. */
interface LoadedPage {
  page: number;
  getViewport: (options: { scale: number }) => ViewportLike;
}

/** Content width of an element in CSS px, kept up to date with a ResizeObserver (0 until measured). */
function useContentWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.floor(entry.contentRect.width));
    });
    observer.observe(el);
    return () => observer.disconnect(); // stop watching when the app unmounts
  }, [ref]);
  return width;
}

export function App() {
  // Language: ?lang= > saved menu choice > browser language (see i18n.ts).
  const [lang, setLang] = useState<Lang>(() =>
    resolveLang({ search: window.location.search, stored: localStorage.getItem(STORAGE_KEY), navigatorLanguage: navigator.language }),
  );
  const t = (key: MessageKey, vars?: Record<string, string | number>) => translate(lang, key, vars);
  const chooseLang = (next: Lang) => {
    localStorage.setItem(STORAGE_KEY, next); // remember the choice
    setLang(next);
  };
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = translate(lang, "appTitle");
  }, [lang]);

  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  // The loaded page is stored with its number so a stale one is never drawn on another page.
  const [loaded, setLoaded] = useState<LoadedPage | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [result, setResult] = useState<LocateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const locator = useRef<Locator | null>(null);
  const requestId = useRef(0); // only the latest select() may update the screen

  // Fit the page to the viewer panel: a rotated page (wider than tall) is shrunk so the
  // highlight on its far side stays on screen; an upright page keeps SCALE (see fit.ts).
  const viewerRef = useRef<HTMLElement | null>(null);
  const pageBoxRef = useRef<HTMLDivElement | null>(null);
  const panelWidth = useContentWidth(viewerRef);
  const current = loaded && loaded.page === page ? loaded : null;
  const scale = current ? fitScale(SCALE, current.getViewport({ scale: 1 }).width, panelWidth) : SCALE;
  // The same scale goes to <Page scale> and to the viewport the highlights use.
  const viewport = useMemo(() => (current ? current.getViewport({ scale }) : null), [current, scale]);

  // Safety net for narrow windows: bring the first highlight into view (no-op when already visible).
  useEffect(() => {
    if (!viewport || !result?.found) return;
    const first = pageBoxRef.current?.querySelector('[role="mark"]');
    if (first && typeof first.scrollIntoView === "function") first.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [viewport, result]);

  // Canvas widths make x positions precise; pdf.js passes each item's style to the measurer.
  const measure = useMemo(() => createCanvasMeasurer(undefined), []);

  const onDocumentLoad = (pdf: unknown) => {
    const doc = pdf as DocumentLike;
    locator.current = createLocator(doc, { measure });
    setNumPages(doc.numPages);
  };

  const select = async (index: number) => {
    const entry = answers[index];
    if (!entry || !locator.current) return;
    const mine = ++requestId.current;
    setSelected(index);
    setBusy(true);
    setError(null);
    try {
      const found = await locator.current.locate(entry.quote, { pageHint: entry.page });
      if (mine !== requestId.current) return; // a newer chip was clicked meanwhile
      setResult(found);
      if (found.found) setPage(found.page); // jump to the page that holds the quote
    } catch (e) {
      if (mine !== requestId.current) return;
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (mine === requestId.current) setBusy(false);
    }
  };

  const status = (): { text: string; ok: boolean } | null => {
    if (error) return { text: t("searchError", { message: error }), ok: false };
    if (busy) return { text: t("searching"), ok: true };
    if (!result) return null;
    if (result.found) {
      const key: MessageKey = result.method === "exact" ? "foundExact" : result.method === "normalized" ? "foundNormalized" : "foundFuzzy";
      return { text: t(key, { page: result.page, score: result.score.toFixed(2) }), ok: true };
    }
    if (result.reason === "no-text-layer") return { text: t("noTextLayer"), ok: false };
    if (result.best) return { text: t("notFoundBest", { page: result.best.page, score: result.best.score.toFixed(2) }), ok: false };
    return { text: t("notFound"), ok: false };
  };
  const shown = status();

  return (
    <>
      <header>
        <div>
          <h1>{t("appTitle")}</h1>
          <p>{t("subtitle")}</p>
        </div>
        <label className="lang">
          {t("language")}
          <select value={lang} onChange={(e) => chooseLang(e.target.value as Lang)} aria-label={t("language")}>
            <option value="en">English</option>
            <option value="ko">한국어</option>
          </select>
        </label>
      </header>
      <main>
        <section className="answer">
          <h2>{t("answerHeading")}</h2>
          <p className="note">{t("sampleNote")}</p>
          <ol className="answers">
            {answers.map((a, i) => (
              <li key={a.id}>
                {a.text[lang]}
                <button className="chip" aria-pressed={selected === i} onClick={() => void select(i)}>
                  {t("sourceChip", { n: a.id })}
                </button>
              </li>
            ))}
          </ol>
          {selected === null ? (
            <p>{t("idle")}</p>
          ) : (
            <>
              {shown && <div className={`status ${shown.ok ? "ok" : "miss"}`}>{shown.text}</div>}
              {result?.found && result.approx && <p className="note">{t("approxNote")}</p>}
              <blockquote>
                <strong>{t("quoteHeading")}</strong>
                <br />
                {answers[selected]?.quote}
              </blockquote>
            </>
          )}
        </section>
        <section className="viewer" ref={viewerRef}>
          <div className="pager">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
              {t("prevPage")}
            </button>
            <span>{t("pageOf", { page, total: numPages || "?" })}</span>
            <button disabled={page >= numPages} onClick={() => setPage(page + 1)}>
              {t("nextPage")}
            </button>
          </div>
          <Document
            file={pdfUrl}
            onLoadSuccess={onDocumentLoad}
            loading={t("loadingPdf")}
            error={t("pdfError", { message: loadError ?? "" })}
            onLoadError={(e) => setLoadError(e.message)}
          >
            <div className="page-box" ref={pageBoxRef}>
              <Page
                pageNumber={page}
                scale={scale}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                onLoadSuccess={(p) => setLoaded({ page: p.pageNumber, getViewport: (o) => p.getViewport(o) })}
              >
                {viewport && result?.found ? <CitationHighlights rects={result.rects} viewport={viewport} page={page} label="citation" /> : null}
              </Page>
            </div>
          </Document>
        </section>
      </main>
    </>
  );
}
