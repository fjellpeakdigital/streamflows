'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';

interface BatchResult {
  year: number;
  offset: number;
  rivers_in_batch: number;
  stations_with_data: number;
  total_rows: number;
  inserted: number;
  duplicates_skipped: number;
  duration_ms: number;
  done: boolean;
  errors: string[];
}

export default function SeedPage() {
  const [secret, setSecret] = useState('');
  const [startYear, setStartYear] = useState(2021);
  const [endYear, setEndYear] = useState(2025);
  const [batchSize, setBatchSize] = useState(50);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [stats, setStats] = useState({ totalInserted: 0, totalDuplicates: 0, totalErrors: 0, batchesCompleted: 0 });
  const abortRef = useRef(false);

  const addLog = (msg: string) => {
    setLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const runSeed = async () => {
    if (!secret) {
      alert('Enter your CRON_SECRET');
      return;
    }

    setRunning(true);
    abortRef.current = false;
    setLog([]);
    setStats({ totalInserted: 0, totalDuplicates: 0, totalErrors: 0, batchesCompleted: 0 });

    let totalInserted = 0;
    let totalDuplicates = 0;
    let totalErrors = 0;
    let batchesCompleted = 0;

    for (let year = startYear; year <= endYear; year++) {
      if (abortRef.current) break;
      addLog(`--- Starting year ${year} ---`);

      let offset = 0;
      let done = false;

      while (!done && !abortRef.current) {
        addLog(`Year ${year}, offset ${offset}: fetching...`);

        try {
          const res = await fetch(`/api/seed?year=${year}&offset=${offset}&batch=${batchSize}&secret=${secret}`);
          const data = await res.json();

          if (!data.success) {
            addLog(`ERROR: ${data.error}`);
            totalErrors++;
            break;
          }

          if (data.message) {
            addLog(data.message);
            done = true;
            break;
          }

          const result = data as BatchResult;
          totalInserted += result.inserted;
          totalDuplicates += result.duplicates_skipped;
          totalErrors += result.errors.length;
          batchesCompleted++;

          addLog(
            `Year ${year}, offset ${offset}: ${result.inserted} inserted, ${result.duplicates_skipped} dupes, ${result.stations_with_data}/${result.rivers_in_batch} stations had data (${result.duration_ms}ms)`
          );

          if (result.errors.length > 0) {
            result.errors.forEach((e) => addLog(`  Error: ${e}`));
          }

          setStats({ totalInserted, totalDuplicates, totalErrors, batchesCompleted });

          done = result.done;
          offset += batchSize;

          // Small delay between batches to be nice to USGS
          await new Promise((r) => setTimeout(r, 500));
        } catch (err: any) {
          addLog(`FETCH ERROR: ${err.message}`);
          totalErrors++;
          // Retry after a longer delay
          addLog('Retrying in 5 seconds...');
          await new Promise((r) => setTimeout(r, 5000));
        }
      }
    }

    addLog('=== Seeding complete ===');
    addLog(`Total: ${totalInserted} inserted, ${totalDuplicates} duplicates skipped, ${totalErrors} errors, ${batchesCompleted} batches`);
    setRunning(false);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="text-2xl font-bold mb-2">Database Seed Tool</h1>
      <p className="text-muted-foreground mb-6">
        Backfill historical USGS daily values into the conditions table. Runs in batches to avoid timeouts.
      </p>

      <div className="bg-white border border-border rounded-xl p-6 space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium mb-1">CRON_SECRET</label>
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm"
            placeholder="Your CRON_SECRET value"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Start Year</label>
            <input
              type="number"
              value={startYear}
              onChange={(e) => setStartYear(parseInt(e.target.value))}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm"
              min={2000}
              max={2026}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">End Year</label>
            <input
              type="number"
              value={endYear}
              onChange={(e) => setEndYear(parseInt(e.target.value))}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm"
              min={2000}
              max={2026}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Batch Size</label>
            <input
              type="number"
              value={batchSize}
              onChange={(e) => setBatchSize(parseInt(e.target.value))}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm"
              min={10}
              max={100}
            />
          </div>
        </div>

        <div className="flex gap-3">
          <Button onClick={runSeed} disabled={running}>
            {running ? 'Running...' : 'Start Seeding'}
          </Button>
          {running && (
            <Button variant="outline" onClick={() => { abortRef.current = true; }}>
              Stop After Current Batch
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      {stats.batchesCompleted > 0 && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="bg-white border border-border rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-foreground">{stats.totalInserted.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Inserted</div>
          </div>
          <div className="bg-white border border-border rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-foreground">{stats.totalDuplicates.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Duplicates</div>
          </div>
          <div className="bg-white border border-border rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-foreground">{stats.totalErrors}</div>
            <div className="text-xs text-muted-foreground">Errors</div>
          </div>
          <div className="bg-white border border-border rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-foreground">{stats.batchesCompleted}</div>
            <div className="text-xs text-muted-foreground">Batches</div>
          </div>
        </div>
      )}

      {/* Log */}
      <div className="bg-slate-950 rounded-xl p-4 font-mono text-xs text-green-400 h-96 overflow-y-auto">
        {log.length === 0 ? (
          <span className="text-slate-500">Waiting to start...</span>
        ) : (
          log.map((line, i) => (
            <div key={i} className={line.includes('ERROR') ? 'text-red-400' : line.includes('===') ? 'text-yellow-300 font-bold' : ''}>
              {line}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
