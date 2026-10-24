import { RemoteImage } from "./RemoteImage";

type Props = { listingPhoto: string | null; officialPhoto: string | null; noticeRef: string };

export function PhotoPair({ listingPhoto, officialPhoto, noticeRef }: Props) {
  const photos = [
    listingPhoto && { src: listingPhoto, alt: "Photo from the listing", caption: "In the listing" },
    officialPhoto && { src: officialPhoto, alt: `Photo from notice ${noticeRef}`, caption: "In the official recall" },
  ].filter((photo) => photo !== null && photo !== "");
  if (photos.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-3 px-5 pt-5 sm:gap-4 sm:px-6">
      {photos.map((photo) => (
        <figure key={photo.caption} className="m-0 flex flex-col gap-2">
          <RemoteImage src={photo.src} alt={photo.alt} className="h-[140px] w-full rounded-xl bg-placeholder object-cover sm:h-[180px]" />
          <figcaption className="text-[13px] text-muted">{photo.caption}</figcaption>
        </figure>
      ))}
    </div>
  );
}
