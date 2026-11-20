import { NextResponse, type NextRequest } from "next/server";

/** Keep independently launched interfaces on their own navigation surface. */
export function middleware(request: NextRequest) {
  const mode = process.env.BLUFF_INTERFACE;
  const path = request.nextUrl.pathname;
  if (mode === "customer" && (path.startsWith("/console") || path.startsWith("/seatwise"))) {
    return NextResponse.redirect(new URL("/tickets", request.url));
  }
  if (mode === "business" && (path.startsWith("/tickets") || path.startsWith("/demo") || path.startsWith("/seatwise"))) {
    return NextResponse.redirect(new URL("/console", request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/console/:path*", "/tickets/:path*", "/demo/:path*", "/seatwise/:path*"] };
