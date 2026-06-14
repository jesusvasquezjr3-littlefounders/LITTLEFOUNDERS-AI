import React, { useState } from "react";

interface StockImageProps {
  src: string;
  alt: string;
  className?: string;
  /** Gradient shown while loading or if the image fails (keeps layout intact). */
  fallbackClassName?: string;
  loading?: "lazy" | "eager";
}

/**
 * StockImage — renders a free-license (Unsplash) photo with a graceful
 * gradient fallback so the corporate layout never breaks on a dead link
 * or slow network. The gradient stays visible behind the image and is
 * revealed again if the image errors out.
 */
export const StockImage: React.FC<StockImageProps> = ({
  src,
  alt,
  className = "",
  fallbackClassName = "bg-gradient-to-br from-indigo-500/20 via-blue-500/15 to-sky-400/20",
  loading = "lazy",
}) => {
  const [errored, setErrored] = useState(false);
  const [loaded, setLoaded] = useState(false);

  return (
    <div className={`relative overflow-hidden ${fallbackClassName}`}>
      {!errored && (
        <img
          src={src}
          alt={alt}
          loading={loading}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          className={`${className} transition-opacity duration-700 ${loaded ? "opacity-100" : "opacity-0"}`}
        />
      )}
    </div>
  );
};

export default StockImage;
