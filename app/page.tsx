"use client"; // Required for React Flow components

import FamilyTreeWrapper from "./components/FamilyTree"; // Import the FamilyTreeWrapper

export default function Home() {
  return (
    <div className="grid grid-rows-[auto_1fr_auto] items-stretch justify-items-center min-h-screen font-[family-name:var(--font-geist-sans)] bg-stone-900 text-stone-100">


        <FamilyTreeWrapper />
    </div>
  );
}
