"use client";

import Lightbox, { type SlideImage } from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";

/**
 * Полноэкранный просмотр `yet-another-react-lightbox` (Esc, клик вне фото, фокус-ловушка —
 * встроены). Отдельный чанк вместе со своим CSS: грузится при первом открытии фото из
 * `LightboxGallery`, а не блокирует отрисовку главной. Default export — для `React.lazy`.
 */
type LightboxViewerProps = {
  open: boolean;
  index: number;
  slides: SlideImage[];
  onClose: () => void;
};

export default function LightboxViewer({ open, index, slides, onClose }: LightboxViewerProps) {
  return (
    <Lightbox
      open={open}
      index={index}
      close={onClose}
      slides={slides}
      controller={{ closeOnBackdropClick: true }}
    />
  );
}
