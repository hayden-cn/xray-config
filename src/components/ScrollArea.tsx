import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

interface ScrollAreaProps {
  children: ReactNode;
  maxHeight?: number | string;
  className?: string;
  style?: CSSProperties;
}

const THUMB_MIN = 20;
const THUMB_NARROW = 1;
const THUMB_WIDE = 10;

export default function ScrollArea({ children, maxHeight, className, style }: ScrollAreaProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const vTrackRef = useRef<HTMLDivElement>(null);
  const hTrackRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState(false);
  const [vThumb, setVThumb] = useState({ height: 0, top: 0, visible: false });
  const [hThumb, setHThumb] = useState({ width: 0, left: 0, visible: false });

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const update = () => {
      const { clientHeight, scrollHeight, scrollTop, clientWidth, scrollWidth, scrollLeft } = el;
      const vVisible = scrollHeight > clientHeight + 1;
      const hVisible = scrollWidth > clientWidth + 1;
      let vHeight = 0;
      let vTop = 0;
      if (vVisible) {
        vHeight = Math.max(THUMB_MIN, (clientHeight / scrollHeight) * clientHeight);
        const range = Math.max(1, clientHeight - vHeight);
        vTop = (scrollTop / Math.max(1, scrollHeight - clientHeight)) * range;
      }
      let hWidth = 0;
      let hLeft = 0;
      if (hVisible) {
        hWidth = Math.max(THUMB_MIN, (clientWidth / scrollWidth) * clientWidth);
        const range = Math.max(1, clientWidth - hWidth);
        hLeft = (scrollLeft / Math.max(1, scrollWidth - clientWidth)) * range;
      }
      setVThumb({ height: vHeight, top: vTop, visible: vVisible });
      setHThumb({ width: hWidth, left: hLeft, visible: hVisible });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    el.addEventListener("scroll", update, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", update);
    };
  }, []);

  const dragVertical = (e: React.PointerEvent) => {
    const el = viewportRef.current;
    const track = vTrackRef.current;
    if (!el || !track) return;
    e.preventDefault();
    setHover(true);
    const startY = e.clientY;
    const startScroll = el.scrollTop;
    const trackH = track.clientHeight;
    const thumbH = vThumb.height;
    const ratio = (el.scrollHeight - el.clientHeight) / Math.max(1, trackH - thumbH);
    const move = (ev: PointerEvent) => {
      el.scrollTop = startScroll + (ev.clientY - startY) * ratio;
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const dragHorizontal = (e: React.PointerEvent) => {
    const el = viewportRef.current;
    const track = hTrackRef.current;
    if (!el || !track) return;
    e.preventDefault();
    setHover(true);
    const startX = e.clientX;
    const startScroll = el.scrollLeft;
    const trackW = track.clientWidth;
    const thumbW = hThumb.width;
    const ratio = (el.scrollWidth - el.clientWidth) / Math.max(1, trackW - thumbW);
    const move = (ev: PointerEvent) => {
      el.scrollLeft = startScroll + (ev.clientX - startX) * ratio;
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const thumbW = hover ? THUMB_WIDE : THUMB_NARROW;

  return (
    <div
      className={`scroll-area${className ? ` ${className}` : ""}`}
      style={maxHeight !== undefined ? { ...style, maxHeight } : style}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div ref={viewportRef} className="scroll-area-viewport">
        {children}
      </div>
      {vThumb.visible && (
        <div
          ref={vTrackRef}
          className="scroll-area-track-v"
          style={{ width: thumbW }}
        >
          <div
            className="scroll-area-thumb"
            style={{ height: vThumb.height, top: vThumb.top }}
            onPointerDown={dragVertical}
          />
        </div>
      )}
      {hThumb.visible && (
        <div
          ref={hTrackRef}
          className="scroll-area-track-h"
          style={{ height: thumbW }}
        >
          <div
            className="scroll-area-thumb"
            style={{ width: hThumb.width, left: hThumb.left }}
            onPointerDown={dragHorizontal}
          />
        </div>
      )}
    </div>
  );
}
