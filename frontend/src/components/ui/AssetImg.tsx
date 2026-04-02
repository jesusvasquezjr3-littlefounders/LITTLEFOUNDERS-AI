import { useAsset } from '@/hooks/useAsset';

interface AssetImgProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  /** Path relative to the game-assets Supabase bucket root */
  assetPath: string | null | undefined;
  /** Rendered while the blob URL is loading or if auth fails */
  fallback?: React.ReactNode;
}

/**
 * Renders an image from a private Supabase bucket using a signed + blob URL.
 * The real asset URL is never exposed in the DOM or DevTools element inspector.
 */
export function AssetImg({ assetPath, fallback = null, ...props }: AssetImgProps) {
  const src = useAsset(assetPath);
  if (!src) return <>{fallback}</>;
  return <img src={src} {...props} />;
}
