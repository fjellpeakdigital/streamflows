'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { X, Droplets, Fish, Users, Wind } from 'lucide-react';
import type { FishingRating, FlowAccuracy } from '@/lib/types/database';

interface CheckinFormProps {
  riverId: string;
  onSuccess: (checkin: Record<string, unknown>) => void;
  onCancel: () => void;
}

const RATING_OPTIONS: { value: FishingRating; label: string; color: string }[] = [
  { value: 'poor',      label: 'Poor',      color: 'border-red-300    bg-red-50    text-red-700    data-[selected=true]:bg-red-100    data-[selected=true]:border-red-500' },
  { value: 'fair',      label: 'Fair',      color: 'border-amber-300  bg-amber-50  text-amber-700  data-[selected=true]:bg-amber-100  data-[selected=true]:border-amber-500' },
  { value: 'good',      label: 'Good',      color: 'border-emerald-300 bg-emerald-50 text-emerald-700 data-[selected=true]:bg-emerald-100 data-[selected=true]:border-emerald-500' },
  { value: 'excellent', label: 'Excellent', color: 'border-primary/40 bg-primary/5  text-primary    data-[selected=true]:bg-primary/10  data-[selected=true]:border-primary' },
];

const FLOW_OPTIONS: { value: FlowAccuracy; label: string; sub: string }[] = [
  { value: 'accurate',   label: 'Looks accurate', sub: 'Gauge matched what I saw' },
  { value: 'inaccurate', label: 'Off',             sub: 'Felt higher or lower than reported' },
  { value: 'unsure',     label: 'Not sure',        sub: 'Didn\'t check the gauge closely' },
];

const COMMON_SPECIES = ['Brown Trout', 'Rainbow Trout', 'Brook Trout', 'Atlantic Salmon', 'Smallmouth Bass', 'Largemouth Bass', 'Pike'];

export default function CheckinForm({ riverId, onSuccess, onCancel }: CheckinFormProps) {
  const today = new Date().toISOString().split('T')[0];

  const [rating, setRating]             = useState<FishingRating | null>(null);
  const [flowAccuracy, setFlowAccuracy] = useState<FlowAccuracy>('unsure');
  const [speciesCaught, setSpeciesCaught] = useState<string[]>([]);
  const [customSpecies, setCustomSpecies] = useState('');
  const [fliesWorking, setFliesWorking] = useState('');
  const [notes, setNotes]               = useState('');
  const [fishedAt, setFishedAt]         = useState(today);
  const [isPublic, setIsPublic]         = useState(false);
  const [clientName, setClientName]     = useState('');
  const [partySize, setPartySize]       = useState('');
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState<string | null>(null);

  const toggleSpecies = (s: string) =>
    setSpeciesCaught((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);

  const addCustomSpecies = () => {
    const trimmed = customSpecies.trim();
    if (trimmed && !speciesCaught.includes(trimmed)) {
      setSpeciesCaught((prev) => [...prev, trimmed]);
    }
    setCustomSpecies('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rating) { setError('Please rate the fishing conditions'); return; }
    setError(null);
    setSaving(true);

    try {
      const res = await fetch('/api/checkins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          river_id: riverId,
          flow_confirmed: flowAccuracy,
          conditions_rating: rating,
          species_caught: speciesCaught.length > 0 ? speciesCaught : null,
          flies_working: fliesWorking || null,
          notes: notes || null,
          is_public: isPublic,
          fished_at: new Date(fishedAt + 'T12:00:00').toISOString(),
          client_name: clientName.trim() || null,
          party_size: partySize.trim() === '' ? null : Number(partySize),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.error ?? 'Failed to save check-in');
        return;
      }

      const data = await res.json();
      onSuccess(data);
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-border rounded-2xl p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-semibold text-foreground">Log a Trip</h3>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}

        {/* Date */}
        <div>
          <label className="block text-sm font-medium mb-1.5">Date fished</label>
          <Input
            type="date"
            value={fishedAt}
            max={today}
            onChange={(e) => setFishedAt(e.target.value)}
            className="h-10 w-48"
          />
        </div>

        {/* Fishing rating */}
        <div>
          <label className="block text-sm font-medium mb-2">
            <Fish className="inline h-3.5 w-3.5 mr-1 opacity-70" />
            How was the fishing?
          </label>
          <div className="grid grid-cols-4 gap-2">
            {RATING_OPTIONS.map(({ value, label, color }) => (
              <button
                key={value}
                type="button"
                data-selected={rating === value}
                onClick={() => setRating(value)}
                className={`text-sm font-medium py-2 rounded-lg border-2 transition-colors ${color}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Flow accuracy */}
        <div>
          <label className="block text-sm font-medium mb-2">
            <Droplets className="inline h-3.5 w-3.5 mr-1 opacity-70" />
            Did the gauge reading match what you saw?
          </label>
          <div className="space-y-1.5">
            {FLOW_OPTIONS.map(({ value, label, sub }) => (
              <label key={value} className="flex items-start gap-2.5 cursor-pointer group">
                <input
                  type="radio"
                  name="flow_accuracy"
                  value={value}
                  checked={flowAccuracy === value}
                  onChange={() => setFlowAccuracy(value)}
                  className="mt-0.5 accent-primary"
                />
                <span>
                  <span className="text-sm font-medium block">{label}</span>
                  <span className="text-xs text-muted-foreground">{sub}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Client (for guide journal) */}
        <div className="grid gap-2 sm:grid-cols-[1fr_7rem]">
          <div>
            <label className="block text-sm font-medium mb-1.5">
              <Users className="inline h-3.5 w-3.5 mr-1 opacity-70" />
              Client / party <span className="font-normal text-muted-foreground">(optional, private)</span>
            </label>
            <Input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="e.g. Moser party, Walk-in"
              className="h-10 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Party size</label>
            <Input
              type="number"
              min={0}
              value={partySize}
              onChange={(e) => setPartySize(e.target.value)}
              placeholder="–"
              className="h-10 text-sm"
            />
          </div>
        </div>

        {/* Species caught */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Species caught <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {COMMON_SPECIES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggleSpecies(s)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  speciesCaught.includes(s)
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-muted-foreground border-border hover:border-primary/50'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Other species…"
              value={customSpecies}
              onChange={(e) => setCustomSpecies(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomSpecies(); } }}
              className="h-9 text-sm"
            />
            <Button type="button" variant="outline" size="sm" onClick={addCustomSpecies} className="h-9">Add</Button>
          </div>
          {speciesCaught.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {speciesCaught.map((s) => (
                <span key={s} className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  {s}
                  <button type="button" onClick={() => toggleSpecies(s)} className="hover:text-primary/70">×</button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Flies working */}
        <div>
          <label className="block text-sm font-medium mb-1.5">
            <Wind className="inline h-3.5 w-3.5 mr-1 opacity-70" />
            Flies / patterns / techniques working <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <Input
            placeholder="e.g. CDC Caddis #16, Copper John dropper, dead drift…"
            value={fliesWorking}
            onChange={(e) => setFliesWorking(e.target.value)}
            className="h-10 text-sm"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium mb-1.5">
            Notes <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <Textarea
            placeholder="Water clarity, hatches, access conditions, anything else worth noting…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="text-sm resize-none"
          />
        </div>

        {/* Visibility */}
        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="accent-primary h-4 w-4"
          />
          <span className="text-sm">
            Share publicly{' '}
            <span className="text-muted-foreground font-normal">— help other anglers on this river</span>
          </span>
        </label>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Button type="submit" disabled={saving} className="flex-1">
            {saving ? 'Saving…' : 'Save Trip'}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
