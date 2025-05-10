"use client"; // Required for React Flow components

import FamilyTreeWrapper from "./components/FamilyTree"; // Import the FamilyTreeWrapper

export default function Home() {
  return (
    <div className="grid grid-rows-[auto_1fr_auto] items-stretch justify-items-center min-h-screen font-[family-name:var(--font-geist-sans)] bg-gray-900 text-gray-100">
      {/* Optional: Add a header or navigation here if needed later */}
      {/* <header className="p-4 w-full text-center">
        <h1 className="text-2xl font-bold">Kutumba Family Tree</h1>
      </header> */}

      <main className="flex flex-col w-full h-full items-center justify-center row-start-2">
        {/* Replace existing main content with FamilyTreeWrapper */}
        {/* The FamilyTreeWrapper will manage its own height and width requirements for the flow chart */}
        <FamilyTreeWrapper initialPersonId="736a1e18-4fcc-42c5-ae3a-32fd0c9bf26d" />
      </main>
    </div>
  );
}
