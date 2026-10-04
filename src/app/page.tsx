"use client";

import dynamic from "next/dynamic";

// The worksheet keeps its draft in localStorage, so skip server rendering.
const Worksheet = dynamic(() => import("@/components/Worksheet"), { ssr: false });

export default function Home() {
  return <Worksheet />;
}
