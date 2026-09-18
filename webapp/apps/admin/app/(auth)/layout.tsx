// This layout is for auth routes (login) - no auth check needed
// The root layout will still wrap this, but we'll handle auth there
export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}

