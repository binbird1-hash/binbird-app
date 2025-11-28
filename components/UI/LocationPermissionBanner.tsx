type LocationPermissionBannerProps = {
  title: string;
  description?: string;
};

export function LocationPermissionBanner({
  title,
  description,
}: LocationPermissionBannerProps) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white shadow-lg">
      <div className="mt-1 h-2.5 w-2.5 rounded-full bg-[#ff5757]" aria-hidden />
      <div className="flex-1 space-y-1">
        <p className="font-semibold leading-tight">{title}</p>
        {description && <p className="text-white/70 leading-relaxed">{description}</p>}
      </div>
    </div>
  );
}
