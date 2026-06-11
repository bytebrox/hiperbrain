import type { Metadata } from "next";
import { DocsView } from "@/components/docs/docs-view";

export const metadata: Metadata = {
  title: "Docs",
  description:
    "Documentation for hiperbrain: Hyperdimensional Computing explained in depth - concepts as 10,000-dimensional vectors, one-shot learning, algebraic reasoning, fault-tolerant holographic memory, architecture, the command language, FAQ and glossary.",
  alternates: { canonical: "/docs" },
};

export default function DocsPage() {
  return <DocsView />;
}
