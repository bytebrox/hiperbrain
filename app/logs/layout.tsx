import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Activity log",
  description:
    "A live feed of everything the shared brain has been taught, newest first.",
  alternates: { canonical: "/logs" },
};

export default function LogsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
