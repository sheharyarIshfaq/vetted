type Props = { src: string; alt: string; className?: string };

// Listing, official and presigned upload URLs come from many hosts, so they are shown as they are.
export function RemoteImage({ src, alt, className }: Props) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" className={className} />;
}
