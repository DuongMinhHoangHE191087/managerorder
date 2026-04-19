// No-op template — bypass root framer-motion animation for public pages
export default function ShortLinkTemplate({ children }: { readonly children: React.ReactNode }) {
  return <>{children}</>;
}
