import { NextResponse, type NextRequest } from "next/server";

/** Cheap gate: no session cookie → login. Real validation happens server-side (getCtx). */
export function middleware(req: NextRequest) {
  if (!req.cookies.get("lf_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/painel/:path*"] };
