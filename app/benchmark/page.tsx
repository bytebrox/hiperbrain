import type { Metadata } from "next";
import { BenchmarkView } from "@/components/benchmark/benchmark-view";

export const metadata: Metadata = {
  title: "Benchmark",
  description:
    "A live, public benchmark of the collective brain: accuracy, precision and the confident-wrong (hallucination) rate, measured against a fixed set of known-answer questions. The brain abstains instead of guessing, so confident-wrong stays near zero.",
  alternates: { canonical: "/benchmark" },
};

export default function BenchmarkPage() {
  return <BenchmarkView />;
}
