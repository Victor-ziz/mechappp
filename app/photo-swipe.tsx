"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

export default function PhotoSwipe({ images, label }: { images: string[]; label: string }) {
  const photos = images.slice(0, 3);
  const [index, setIndex] = useState(0);
  const [offset, setOffset] = useState(0);
  const [moving, setMoving] = useState(false);
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, locked: false, startX: 0, startY: 0, width: 1, offset: 0 });

  const endDrag = () => {
    if (!drag.current.active && !drag.current.locked) return;
    const threshold = Math.min(72, drag.current.width * 0.18);
    const shift = drag.current.locked ? drag.current.offset : 0;
    setIndex((current) => {
      if (shift <= -threshold && current < photos.length - 1) return current + 1;
      if (shift >= threshold && current > 0) return current - 1;
      return current;
    });
    drag.current.active = false;
    drag.current.locked = false;
    drag.current.offset = 0;
    setOffset(0);
    setMoving(false);
  };

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || photos.length < 2) return;
    if ((event.target as HTMLElement).closest("button")) return;
    drag.current = {
      active: true,
      locked: false,
      startX: event.clientX,
      startY: event.clientY,
      width: frame.current?.clientWidth || 1,
      offset: 0,
    };
  };

  const followDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current.active) return;
    const dx = event.clientX - drag.current.startX;
    const dy = event.clientY - drag.current.startY;
    if (!drag.current.locked) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      if (Math.abs(dy) >= Math.abs(dx)) {
        drag.current.active = false;
        return;
      }
      drag.current.locked = true;
      frame.current?.setPointerCapture(event.pointerId);
      setMoving(true);
    }
    drag.current.offset = dx;
    setOffset(dx);
  };

  return (
    <div
      className="photo-swipe"
      ref={frame}
      onPointerDown={startDrag}
      onPointerMove={followDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div
        className="photo-swipe-track"
        style={{
          transform: `translate3d(calc(${-index * 100}% + ${offset}px), 0, 0)`,
          transition: moving ? "none" : "transform 380ms cubic-bezier(.22, .8, .24, 1)",
        }}
      >
        {photos.map((src, photoIndex) => (
          <img key={`${src}-${photoIndex}`} src={src} alt={`${label}, photo ${photoIndex + 1} of ${photos.length}`} draggable={false} />
        ))}
      </div>
      {photos.length > 1 && (
        <div className="photo-dots" role="tablist" aria-label="Product photos">
          {photos.map((src, photoIndex) => (
            <button
              key={`${src}-dot-${photoIndex}`}
              type="button"
              role="tab"
              className={photoIndex === index ? "active" : ""}
              aria-label={`Show photo ${photoIndex + 1}`}
              aria-selected={photoIndex === index}
              onClick={() => setIndex(photoIndex)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
