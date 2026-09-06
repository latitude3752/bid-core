export function accessDecision(pathname: string): "public" | "founder" | "subscriber" {
  if (pathname === "/login" || pathname === "/admin/login") return "public";
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return "founder";
  if (pathname === "/app" || pathname.startsWith("/app/")) return "subscriber";
  return "public";
}
