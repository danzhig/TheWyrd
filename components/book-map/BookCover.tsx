'use client';

import { useLayoutEffect, useRef } from 'react';
import { coverGeometry, flightHeight, SPREAD_QUERY, type CoverGeometry } from '@/lib/book-geometry';
import { camera, prefersReducedMotion } from '@/lib/camera';
import { EASE, handoff, transition } from '@/lib/transition';
import styles from './book-cover.module.css';

const HINGE_EASE = 'cubic-bezier(0.55, 0.05, 0.25, 1)';

/**
 * Every book opens like a novel (owner, 2026-11-17): the cover swings to a half-title page, which
 * then turns over carrying the left half of the map; closing turns that page back over the map
 * before the cover follows. The boards run the full length of the pages.
 */
export const TURN_MS = 1600;
const COVER_MS = 950; // the cover's swing within TURN_MS
const LEAF_MS = 1050; // the page's swing within TURN_MS
const LEAF_AT = TURN_MS - LEAF_MS; // opening: the page starts turning as the cover passes upright

/** The open book page's cover, so "All books" can close it before leaving. */
export const bookCover: { close: (() => Promise<DOMRect | null>) | null } = { close: null };

/** Wait for every animation, but never longer than `ms` plus a margin (PLAN: navigation never waits). */
function allSettled(anims: Animation[], ms: number): Promise<unknown> {
  return Promise.race([
    Promise.all(anims.map((a) => a.finished)).catch(() => {}),
    new Promise((r) => window.setTimeout(r, ms + 300)),
  ]);
}

/**
 * The book's cover and first page, hinged at the spine (PLAN §9). On arrival the cover swings over
 * to the left onto its marbled endpaper, then the half-title page turns after it, carrying the map's
 * left half. When the reader arrives from the Vault, a flying copy of this cover lands exactly here
 * first and hands over. Returning from a section, the book is already open. On leaving for the
 * Vault, the page and then the cover close again. Reduced motion: no movement, the pages simply
 * appear.
 */
export function BookCover({
  bookId,
  name,
  tagline,
}: {
  bookId: string;
  name: string;
  tagline: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const shell = ref.current;
    const frame = shell?.parentElement;
    const pages = frame?.querySelector<HTMLElement>('[data-pages]');
    const hinge = shell?.querySelector<HTMLElement>('.book-hinge');
    if (!shell || !frame || !pages || !hinge) return;
    camera.fromBook = bookId; // the Vault returns the book to this medallion
    frame.dataset.turn = '';

    let g: CoverGeometry;
    const place = () => {
      g = coverGeometry(
        frame.clientWidth,
        window.matchMedia(SPREAD_QUERY).matches,
        window.innerHeight,
      );
      Object.assign(shell.style, { left: `${g.offsetX}px`, width: `${g.w}px`, height: `${g.h}px` });
      lengthen();
    };
    /**
     * The board runs the full length of its pages (never shorter than the closed
     * book that flew in), with the title kept in the top `g.h`, where the flying book had it.
     */
    function lengthen() {
      const h = Math.max(pages!.offsetHeight, flightHeight(g, window.innerHeight));
      shell!.style.height = `${h}px`;
      shell!.style.setProperty('--book-h', `${g.h}px`);
      shell!.style.setProperty('--below', `${h - g.h}px`);
    }
    place();

    const cast = frame.querySelector<HTMLElement>('[data-cover-shadow]');
    const leaf = shell.querySelector<HTMLElement>('.book-leaf');
    const leafBack = shell.querySelector<HTMLElement>('.book-leaf-back');
    const shade = shell.querySelector<HTMLElement>('.book-cover-shade');
    const setOpen = () => {
      shell.getAnimations({ subtree: true }).forEach((a) => a.cancel());
      pages.getAnimations().forEach((a) => a.cancel());
      cast?.getAnimations().forEach((a) => a.cancel());
      pages.style.clipPath = '';
      leafBack?.querySelector('[data-leaf-print]')?.remove();
      shell.hidden = true;
      frame.dataset.state = 'open';
    };
    const setClosed = () => {
      shell.hidden = false;
      shell.style.transform = `translateX(${g.shift}px)`;
      frame.dataset.state = 'closed';
    };

    // -------------------------------------------------------------------------------------------
    // The cover, then a page carrying the map, each turning on the spine.
    // The right half of the map is the live page beneath (clipped to the right page on a spread);
    // the left half rides on the back of the turning page as a copy of the live page, so the map
    // itself is seen to fold away and open out. Only transform and opacity animate.
    // -------------------------------------------------------------------------------------------

    /** Put a copy of the live pages on the back of the turning page (spread only). */
    const printLeaf = () => {
      if (!leaf || !leafBack) return;
      lengthen(); // the map may have grown since the cover was placed
      leafBack.querySelector('[data-leaf-print]')?.remove();
      if (!g.spread) return;
      const copy = pages.cloneNode(true) as HTMLElement;
      for (const el of [copy, ...copy.querySelectorAll<HTMLElement>('*')]) {
        for (const a of ['id', 'data-pages', 'data-testid', 'data-station', 'data-map-pending']) {
          el.removeAttribute(a);
        }
      }
      copy.dataset.leafPrint = '';
      copy.inert = true;
      Object.assign(copy.style, {
        position: 'absolute',
        top: '0',
        left: '0',
        width: `${pages.offsetWidth}px`,
        // The live padding is a percentage of the frame; inside the half-width face it would come
        // out smaller and the copy would sit left of the live map, then snap when it takes over.
        padding: getComputedStyle(pages).padding,
        margin: '0',
        boxShadow: 'none',
      });
      leafBack.prepend(copy);
    };
    const leafFaces = leaf ? [...leaf.querySelectorAll<HTMLElement>('.book-leaf-face')] : [];
    const coverFaces = [
      ...hinge.querySelectorAll<HTMLElement>('.book-cover-face, .book-cover-back'),
    ];
    const leafShades = leaf ? [...leaf.querySelectorAll<HTMLElement>('.book-leaf-shade')] : [];
    const at = (ms: number) => ms / TURN_MS;
    const slide = (from: number, to: number) => [
      { transform: `translateX(${from}px)` },
      { transform: `translateX(${to}px)` },
    ];
    const whole = { duration: TURN_MS, easing: EASE, fill: 'both' as const };
    // Fades and shadows are timed by keyframe offsets in ms, so they run on a linear clock.
    const track = { duration: TURN_MS, easing: 'linear', fill: 'both' as const };
    const swing = (delay: number, duration: number) => ({
      delay,
      duration,
      easing: HINGE_EASE,
      fill: 'both' as const,
    });
    const flat = (z: number) => `rotateY(0deg) translateZ(${z}px)`;
    const over = (z: number) => `rotateY(-180deg) translateZ(${z}px)`;

    const turnOpen = async () => {
      // The map lays itself out a frame or two after arrival; print the page once it has.
      for (let i = 0; i < 12 && pages.querySelector('[data-map-pending]'); i++) {
        await new Promise((r) => requestAnimationFrame(r));
      }
      printLeaf();
      if (g.spread) pages.style.clipPath = 'inset(-100px -100px -100px 50%)';
      frame.dataset.state = 'opening';
      const leafEnd = TURN_MS;
      const anims: Animation[] = [
        shell.animate(slide(g.shift, 0), whole),
        pages.animate(slide(g.shift, 0), whole),
        // The pages are a little taller than the board: what shows below it fades up first.
        pages.animate([{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 1 }], track),
        hinge.animate([{ transform: flat(2) }, { transform: over(2) }], swing(0, COVER_MS)),
        leaf
          ? leaf.animate([{ transform: flat(1) }, { transform: over(1) }], swing(LEAF_AT, LEAF_MS))
          : null,
        shade?.animate([{ opacity: 0 }, { opacity: 0.55, offset: 0.5 }, { opacity: 0 }], {
          ...swing(0, COVER_MS),
          easing: 'linear',
        }) ?? null,
        // The turning page catches the light, and lifts its shadow off the page beneath.
        ...leafShades.map((s) =>
          s.animate([{ opacity: 0 }, { opacity: 0.8, offset: 0.5 }, { opacity: 0 }], {
            ...swing(LEAF_AT, LEAF_MS),
            easing: 'linear',
          }),
        ),
      ].filter((a): a is Animation => a !== null);
      if (cast) {
        anims.push(cast.animate(slide(g.shift, 0), whole));
        anims.push(
          cast.animate(
            [
              { opacity: 0 },
              { opacity: 0, offset: at(LEAF_AT) },
              { opacity: 0.6, offset: at(LEAF_AT + 200) },
              { opacity: 0 },
            ],
            track,
          ),
        );
      }
      const fadeIn = { opacity: 1, offset: 0.2 };
      if (g.spread) {
        anims.push(
          ...leafFaces.map((f) => f.animate([{ opacity: 0 }, fadeIn, { opacity: 1 }], track)),
        );
      } else {
        // On a phone the cover and the page swing off the single page, so each fades as it goes.
        const off = (start: number, dur: number) => at(start + dur * 0.4);
        anims.push(
          ...coverFaces.map((f) =>
            f.animate(
              [
                { opacity: 1 },
                { opacity: 1, offset: off(0, COVER_MS) },
                { opacity: 0, offset: at(COVER_MS) },
                { opacity: 0 },
              ],
              track,
            ),
          ),
          ...leafFaces.map((f) =>
            f.animate(
              [
                { opacity: 0 },
                fadeIn,
                { opacity: 1, offset: off(LEAF_AT, LEAF_MS) },
                { opacity: 0 },
              ],
              track,
            ),
          ),
        );
      }
      await allSettled(anims, leafEnd);
      setOpen();
    };

    const turnClose = async () => {
      place();
      window.scrollTo({ top: 0, behavior: 'instant' });
      printLeaf();
      const anims: Animation[] = [
        shell.animate(slide(0, g.shift), whole),
        pages.animate(slide(0, g.shift), whole),
        pages.animate([{ opacity: 1 }, { opacity: 1, offset: 0.85 }, { opacity: 0 }], track),
        leaf
          ? leaf.animate([{ transform: over(1) }, { transform: flat(1) }], swing(0, LEAF_MS))
          : null,
        hinge.animate([{ transform: over(2) }, { transform: flat(2) }], swing(LEAF_AT, COVER_MS)),
        shade?.animate([{ opacity: 0 }, { opacity: 0.55, offset: 0.5 }, { opacity: 0 }], {
          ...swing(LEAF_AT, COVER_MS),
          easing: 'linear',
        }) ?? null,
        ...leafShades.map((s) =>
          s.animate([{ opacity: 0 }, { opacity: 0.8, offset: 0.5 }, { opacity: 0 }], {
            ...swing(0, LEAF_MS),
            easing: 'linear',
          }),
        ),
      ].filter((a): a is Animation => a !== null);
      if (cast) {
        anims.push(cast.animate(slide(0, g.shift), whole));
        anims.push(
          cast.animate(
            [
              { opacity: 0 },
              { opacity: 0.6, offset: at(LEAF_MS - 200) },
              { opacity: 0, offset: at(LEAF_MS) },
              { opacity: 0 },
            ],
            track,
          ),
        );
      }
      const fadeOut = { opacity: 1, offset: 0.85 };
      if (g.spread) {
        anims.push(
          ...leafFaces.map((f) => f.animate([{ opacity: 1 }, fadeOut, { opacity: 0 }], track)),
        );
      } else {
        const on = (start: number, dur: number) => at(start + dur * 0.6);
        anims.push(
          ...leafFaces.map((f) =>
            f.animate(
              [{ opacity: 0 }, { opacity: 1, offset: on(0, LEAF_MS) }, fadeOut, { opacity: 0 }],
              track,
            ),
          ),
          ...coverFaces.map((f) =>
            f.animate(
              [
                { opacity: 0 },
                { opacity: 0, offset: at(LEAF_AT) },
                { opacity: 1, offset: on(LEAF_AT, COVER_MS) },
                { opacity: 1 },
              ],
              track,
            ),
          ),
        );
      }
      // Everything is in place for the first frame: now the page stands in for the live left half.
      if (g.spread) pages.style.clipPath = 'inset(-100px -100px -100px 50%)';
      shell.style.transform = '';
      shell.hidden = false;
      frame.dataset.state = 'closing';
      await allSettled(anims, TURN_MS);
      // The closed book flies home at its flight height, not the full length of the map.
      const r = shell.getBoundingClientRect();
      return new DOMRect(
        r.x,
        r.y,
        r.width,
        Math.min(r.height, flightHeight(g, window.innerHeight)),
      );
    };

    bookCover.close = async () => (prefersReducedMotion() ? null : turnClose());

    const arriving = transition.pending?.kind === 'book-in' && transition.pending.bookId === bookId;
    // The cover plays only when the book arrives from the Vault. A direct visit (a link, a reload)
    // shows the pages at once, as the server rendered them, so the map is the first thing painted.
    if (prefersReducedMotion() || !arriving) setOpen();
    else {
      setClosed();
      if (arriving) handoff(); // the flying book landed on exactly this spot
      requestAnimationFrame(() => void turnOpen());
    }

    const onResize = () => {
      place();
      if (frame.dataset.state === 'closed') shell.style.transform = `translateX(${g.shift}px)`;
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      bookCover.close = null;
    };
  }, [bookId]);

  return (
    <div
      ref={ref}
      className={`book-shell ${styles.shell}`}
      aria-hidden="true"
      data-testid="book-cover"
      data-turn=""
      hidden
    >
      <div className="book-edge" />
      {/* The first page: a half-title on its front, the map's left half on its back once turned. */}
      <div className="book-leaf" data-theme="vellum">
        <div className="book-leaf-face book-leaf-front">
          <div className="book-leaf-title">{name}</div>
          <div className="book-cover-rule" />
          <div className="book-leaf-tagline">{tagline}</div>
          <div className="book-leaf-shade" />
        </div>
        <div className="book-leaf-face book-leaf-back">
          <div className="book-leaf-shade" />
        </div>
      </div>
      <div className="book-hinge">
        <div className="book-cover-face">
          <div className="book-cover-title">{name}</div>
          <div className="book-cover-rule" />
          <div className="book-cover-tagline">{tagline}</div>
          <div className="book-cover-shade" />
        </div>
        <div className="book-cover-back" />
      </div>
    </div>
  );
}
