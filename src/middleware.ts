import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    // Protect everything except the login/fill pages, public/auth APIs, Next internals,
    // and any static asset file (extension match — covers /logo.jpg, /icon.png, /icons/*,
    // favicon.ico, manifest.json, etc.) so unauthenticated pages like /login can load images.
    "/((?!login|fill|api/auth|api/public|_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json|txt|xml|html|webmanifest)).*)",
  ],
};
