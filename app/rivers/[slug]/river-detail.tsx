'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import CheckinForm from '@/components/checkin-form';
import CheckinFeed from '@/components/checkin-feed';
import WeatherStrip from '@/components/weather-strip';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  getStatusColor,
  getStatusLabel,
  formatFlow,
  formatTemperature,
} from '@/lib/river-utils';
import {
  Heart,
  ArrowLeft,
  MapPin,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Fish,
  Waves,
  Thermometer,
  Gauge,
} from 'lucide-react';
import { format } from 'date-fns';

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'rising')
    return <TrendingUp  className="h-5 w-5 text-amber-600" aria-label="Rising" />;
  if (trend === 'falling')
    return <TrendingDown className="h-5 w-5 text-blue-600"  aria-label="Falling" />;
  return <Minus className="h-5 w-5 text-muted-foreground"   aria-label="Stable" />;
}

interface Toast {
  type: 'success' | 'error';
  message: string;
}

export function RiverDetail({ riverData }: { riverData: any }) {
  const {
    id, name, region, description, usgs_station_id,
    latitude, longitude, optimal_flow_min, optimal_flow_max,
    current_condition, conditions, species, is_favorite, user_note, trend, user,
    checkins: initialCheckins = [],
    eta, weather,
  } = riverData;

  const [isFavorite, setIsFavorite]       = useState(is_favorite);
  const [note, setNote]                   = useState(user_note?.note || '');
  const [isSavingNote, setIsSavingNote]   = useState(false);
  const [toast, setToast]                 = useState<Toast | null>(null);
  const [showCheckinForm, setShowCheckinForm] = useState(false);
  const [checkins, setCheckins]           = useState<any[]>(initialCheckins);

  const status = current_condition?.status || 'low';

  const chartData = conditions.map((c: any) => ({
    time: format(new Date(c.timestamp), 'HH:mm'),
    flow: c.flow,
    temp: c.temperature,
  }));

  const showToast = (t: Toast) => {
    setToast(t);
    setTimeout(() => setToast(null), 3500);
  };

  const handleToggleFavorite = async () => {
    if (!user) { window.location.href = '/login'; return; }
    try {
      const res = await fetch('/api/favorites', {
        method: isFavorite ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ river_id: id }),
      });
      if (res.ok) setIsFavorite((f: boolean) => !f);
    } catch { /* silent */ }
  };

  const handleSaveNote = async () => {
    if (!user) { window.location.href = '/login'; return; }
    setIsSavingNote(true);
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ river_id: id, note }),
      });
      if (res.ok) {
        showToast({ type: 'success', message: 'Note saved successfully.' });
      } else {
        showToast({ type: 'error', message: 'Failed to save note. Try again.' });
      }
    } catch {
      showToast({ type: 'error', message: 'An error occurred.' });
    } finally {
      setIsSavingNote(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl">

      {/* Toast notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`
            fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3
            rounded-xl shadow-lg text-sm font-medium border
            ${toast.type === 'success'
              ? 'bg-emerald-600 border-emerald-500 text-white'
              : 'bg-red-600 border-red-500 text-white'}
          `}
        >
          {toast.type === 'success'
            ? <CheckCircle2 className="h-4 w-4 shrink-0" />
            : <AlertCircle   className="h-4 w-4 shrink-0" />}
          {toast.message}
        </div>
      )}

      {/* Back link */}
      <Link href="/rivers">
        <Button variant="ghost" size="sm" className="mb-5 gap-2 text-muted-foreground hover:text-foreground -ml-2">
          <ArrowLeft className="h-4 w-4" />
          All Rivers
        </Button>
      </Link>

      <div className="grid lg:grid-cols-3 gap-5">

        {/* ── Left column ── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Header card */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h1 className="text-2xl font-bold leading-tight mb-1">{name}</h1>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />{region}
                    </span>
                    <span className="text-muted-foreground/60">&middot;</span>
                    <span>USGS {usgs_station_id}</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleToggleFavorite}
                  aria-label={isFavorite ? 'Remove from favorites' : 'Save to favorites'}
                  className="shrink-0"
                >
                  <Heart className={`h-5 w-5 transition-colors ${
                    isFavorite ? 'fill-primary text-primary' : 'text-muted-foreground hover:text-primary'
                  }`} />
                </Button>
              </div>

              {description && (
                <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{description}</p>
              )}

              <div className="flex items-center gap-3 mt-4 flex-wrap">
                <Badge className={`${getStatusColor(status)} px-3 py-1 text-sm font-semibold`}>
                  {getStatusLabel(status)}
                </Badge>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <TrendIcon trend={trend} />
                  <span className="capitalize">{trend}</span>
                </div>
                {eta?.label && (
                  <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border ${
                    ['rising_to_optimal','falling_to_optimal','optimal'].includes(eta.type)
                      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                      : 'text-amber-700 bg-amber-50 border-amber-200'
                  }`}>
                    <Clock className="h-3 w-3" />
                    {eta.label}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Current conditions */}
          <Card>
            <CardHeader className="pb-2 px-5 pt-5">
              <CardTitle className="text-base font-semibold">Current Conditions</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="grid grid-cols-3 gap-3">
                {[
                  {
                    icon: Waves,
                    label: 'Flow',
                    value: formatFlow(current_condition?.flow ?? null),
                    sub: optimal_flow_min && optimal_flow_max
                      ? `Optimal ${optimal_flow_min}–${optimal_flow_max} CFS`
                      : null,
                  },
                  {
                    icon: Thermometer,
                    label: 'Temperature',
                    value: formatTemperature(current_condition?.temperature ?? null),
                    sub: null,
                  },
                  {
                    icon: Gauge,
                    label: 'Gage Height',
                    value: current_condition?.gage_height
                      ? `${current_condition.gage_height.toFixed(2)} ft`
                      : 'N/A',
                    sub: null,
                  },
                ].map(({ icon: Icon, label, value, sub }) => (
                  <div key={label} className="bg-secondary rounded-xl px-3 py-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </div>
                    <div className="text-xl font-bold">{value}</div>
                    {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
                  </div>
                ))}
              </div>

              {current_condition && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-3">
                  <Clock className="h-3.5 w-3.5" />
                  Updated {format(new Date(current_condition.timestamp), 'MMM d, yyyy h:mm a')}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 24-hour chart */}
          <Card>
            <CardHeader className="pb-2 px-5 pt-5">
              <CardTitle className="text-base font-semibold">24-Hour Flow Chart</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,15%,90%)" />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 11, fill: 'hsl(220,12%,50%)' }}
                    interval="preserveStartEnd"
                    axisLine={{ stroke: 'hsl(220,15%,88%)' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'hsl(220,12%,50%)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid hsl(220,15%,88%)',
                      borderRadius: '8px',
                      color: 'hsl(220,30%,18%)',
                      fontSize: 12,
                      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                    }}
                    itemStyle={{ color: 'hsl(220,30%,18%)' }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 12, color: 'hsl(220,12%,50%)', paddingTop: 8 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="flow"
                    name="Flow (CFS)"
                    stroke="hsl(200,65%,38%)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: 'hsl(200,65%,38%)' }}
                  />
                  {chartData.some((d: any) => d.temp !== null) && (
                    <Line
                      type="monotone"
                      dataKey="temp"
                      name="Temp (°F)"
                      stroke="hsl(155,30%,42%)"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: 'hsl(155,30%,42%)' }}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Guide notes */}
          {user && (
            <Card>
              <CardHeader className="pb-2 px-5 pt-5">
                <CardTitle className="text-base font-semibold">My Notes</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Add fishing notes, tips, or observations for this river…"
                  className="min-h-[110px] mb-3 resize-none"
                />
                <Button onClick={handleSaveNote} disabled={isSavingNote} size="sm">
                  {isSavingNote ? 'Saving…' : 'Save Note'}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Trip Reports */}
          <Card>
            <CardHeader className="pb-2 px-5 pt-5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Trip Reports</CardTitle>
                {!showCheckinForm && (
                  <Button
                    size="sm"
                    variant={user ? 'default' : 'outline'}
                    onClick={() => {
                      if (!user) { window.location.href = '/login'; return; }
                      setShowCheckinForm(true);
                    }}
                    className="gap-1.5"
                  >
                    <Fish className="h-3.5 w-3.5" />
                    Log a Trip
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-4">
              {showCheckinForm && (
                <CheckinForm
                  riverId={id}
                  onCancel={() => setShowCheckinForm(false)}
                  onSuccess={(newCheckin) => {
                    setCheckins((prev) => [newCheckin, ...prev]);
                    setShowCheckinForm(false);
                    showToast({ type: 'success', message: 'Trip logged! Thanks for the report.' });
                  }}
                />
              )}
              <CheckinFeed initialCheckins={checkins} riverId={id} />
            </CardContent>
          </Card>

        </div>

        {/* ── Sidebar ── */}
        <div className="space-y-5">

          {/* Species */}
          {species.length > 0 && (
            <Card>
              <CardHeader className="pb-2 px-5 pt-5">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Fish className="h-4 w-4 text-primary" />
                  Species
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <div className="flex flex-wrap gap-2">
                  {species.map((s: any) => (
                    <Badge key={s.id} variant="secondary" className="capitalize">
                      {s.species}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Location */}
          {latitude && longitude && (
            <Card>
              <CardHeader className="pb-2 px-5 pt-5">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  Location
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 space-y-2 text-sm">
                <div className="text-muted-foreground">
                  {latitude}, {longitude}
                </div>
                <a
                  href={`https://www.google.com/maps?q=${latitude},${longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="outline" size="sm" className="gap-2 w-full mt-1">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open in Maps
                  </Button>
                </a>
              </CardContent>
            </Card>
          )}

          {/* Weather forecast */}
          {weather && (
            <Card>
              <CardHeader className="pb-2 px-5 pt-5">
                <CardTitle className="text-base font-semibold">5-Day Rain Forecast</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <WeatherStrip forecast={weather} variant="full" />
              </CardContent>
            </Card>
          )}

          {/* Resources */}
          <Card>
            <CardHeader className="pb-2 px-5 pt-5">
              <CardTitle className="text-base font-semibold">Resources</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-2">
              <a
                href={`https://waterdata.usgs.gov/monitoring-location/${usgs_station_id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="sm" className="w-full gap-2">
                  <ExternalLink className="h-3.5 w-3.5" />
                  USGS Station Data
                </Button>
              </a>
              <a href={`/share/${riverData?.slug}`} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="w-full gap-2">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Share Conditions
                </Button>
              </a>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
