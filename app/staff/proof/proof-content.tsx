"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Job = {
  id: string;
  address: string;
  job_type: "put_out" | "bring_in";
  bins?: string | null;
  notes?: string | null;
  lat: number;
  lng: number;
};

export default function ProofPageContent() {
  const params = useSearchParams();
  const router = useRouter();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [idx, setIdx] = useState<number>(0);
  const [total, setTotal] = useState<number>(0);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [note, setNote] = useState("");

  // Parse jobs, idx, total
  useEffect(() => {
    try {
      const rawJobs = params.get("jobs");
      const rawIdx = params.get("idx");
      const rawTotal = params.get("total");

      if (rawJobs) setJobs(JSON.parse(rawJobs));
      if (rawIdx) setIdx(parseInt(rawIdx, 10));
      if (rawTotal) setTotal(parseInt(rawTotal, 10));
    } catch (err) {
      console.error("Parse failed:", err);
    }
  }, [params]);

  const job = jobs[idx]; // current job

  if (!job) return <div className="p-6 text-white">No job found.</div>;

  function renderBins(bins: string | null | undefined) {
    if (!bins) return <span className="text-gray-400">—</span>;
    return bins.split(",").map((b) => {
      const bin = b.trim().toLowerCase();
      let color = "bg-gray-600";
      if (bin.includes("red")) color = "bg-red-600";
      else if (bin.includes("yellow")) color = "bg-yellow-500 text-black";
      else if (bin.includes("green")) color = "bg-green-600";
      return (
        <span
          key={bin}
          className={`${color} px-3 py-1 rounded-full text-xs font-semibold`}
        >
          {bin.charAt(0).toUpperCase() + bin.slice(1)}
        </span>
      );
    });
  }

  function handleMarkDone() {
    const nextIdx = idx + 1;

    if (total > 0 && nextIdx >= total) {
      alert("🎉 All jobs completed!");
      router.push("/staff/run");
    } else {
      router.push(
        `/staff/route?jobs=${encodeURIComponent(
          JSON.stringify(jobs)
        )}&nextIdx=${nextIdx}`
      );
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-black text-white relative">
      <div className="flex-1 p-6 pb-32 space-y-4">
        <h1
          className={`text-2xl font-bold ${
            job.job_type === "bring_in" ? "text-red-500" : "text-white"
          }`}
        >
          {job.job_type === "put_out" ? "Put Bins Out" : "Bring Bins In"}
        </h1>

        <p className="text-lg font-semibold">{job.address}</p>

        {/* Example photo */}
        <div>
          <p className="text-sm text-gray-400 mb-2">Example photo:</p>
          <img
            src="/example-bin.jpg"
            alt="Example bin placement"
            className="w-full rounded-lg"
          />
        </div>

                {job.notes && (
          <div>
            <p className="text-sm text-gray-400 mb-1">Property Notes:</p>
            <p className="text-white font-medium">{job.notes}</p>
          </div>
        )}

        {/* Bins */}
        <div>
          <p className="text-sm text-gray-400 mb-1">Bins:</p>
          <div className="flex flex-wrap gap-2">{renderBins(job.bins)}</div>
        </div>

        {/* Take photo */}
        <div className="flex flex-col gap-2">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            id="photo-upload"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                setFile(f);
                setPreview(URL.createObjectURL(f));
              }
            }}
          />
          <label
            htmlFor="photo-upload"
            className="w-full cursor-pointer bg-white text-black px-4 py-2 rounded-lg text-center font-semibold"
          >
            {preview ? "Retake Photo ✓" : "Take Photo"}
          </label>
          {preview && (
            <div className="flex justify-center mt-2">
              <img
                src={preview}
                alt="preview"
                className="w-40 h-40 object-cover rounded-lg border border-gray-600"
              />
            </div>
          )}
        </div>

        {/* Leave note */}
        <div>
          <p className="text-sm text-gray-400 mb-1">Leave a note:</p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add any details..."
            className="w-full p-3 rounded-lg bg-white text-black min-h-[100px]"
          />
        </div>
      </div>

      {/* Mark Done pinned bottom */}
      <div className="absolute bottom-0 inset-x-0 p-4">
        <button
          onClick={handleMarkDone}
          disabled={!file}
          className="w-full bg-[#ff5757] text-black px-4 py-3 rounded-lg font-bold disabled:opacity-50"
        >
          Mark Done
        </button>
      </div>
    </div>
  );
}
