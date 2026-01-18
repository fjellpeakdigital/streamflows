'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  getStatusColor,
  getStatusLabel,
  formatFlow,
  formatTemperature,
  getTrendIcon,
} from '@/lib/river-utils';
import { Heart, ArrowLeft, MapPin, Calendar } from 'lucide-react';
import { format } from 'date-fns';

export function RiverDetail({ riverData }: { riverData: any }) {
  const {
    id,
    name,
    region,
    description,
    usgs_station_id,
    latitude,
    longitude,
    optimal_flow_min,
    optimal_flow_max,
    current_condition,
    conditions,
    species,
    is_favorite,
    user_note,
    trend,
    user,
  } = riverData;

  const [isFavorite, setIsFavorite] = useState(is_favorite);
  const [note, setNote] = useState(user_note?.note || '');
  const [isSavingNote, setIsSavingNote] = useState(false);

  const status = current_condition?.status || 'low';

  // Prepare chart data
  const chartData = conditions.map((c: any) => ({
    timestamp: format(new Date(c.timestamp), 'HH:mm'),
    flow: c.flow,
    temperature: c.temperature,
  }));

  const handleToggleFavorite = async () => {
    if (!user) {
      window.location.href = '/login';
      return;
    }

    try {
      const response = await fetch('/api/favorites', {
        method: isFavorite ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ river_id: id }),
      });

      if (response.ok) {
        setIsFavorite(!isFavorite);
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const handleSaveNote = async () => {
    if (!user) {
      window.location.href = '/login';
      return;
    }

    setIsSavingNote(true);
    try {
      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ river_id: id, note }),
      });

      if (response.ok) {
        alert('Note saved successfully!');
      }
    } catch (error) {
      console.error('Error saving note:', error);
    } finally {
      setIsSavingNote(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Link href="/rivers">
        <Button variant="ghost" className="mb-4 gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Rivers
        </Button>
      </Link>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Header */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-3xl mb-2">{name}</CardTitle>
                  <div className="flex items-center gap-4 text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {region}
                    </div>
                    <div>USGS: {usgs_station_id}</div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleToggleFavorite}
                >
                  <Heart
                    className={`h-6 w-6 ${
                      isFavorite
                        ? 'fill-primary text-primary'
                        : 'text-muted-foreground'
                    }`}
                  />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {description && (
                <p className="text-muted-foreground mb-4">{description}</p>
              )}

              <div className="flex items-center gap-4 flex-wrap">
                <Badge className={`${getStatusColor(status)} text-lg px-4 py-2`}>
                  {getStatusLabel(status)}
                </Badge>
                <div className="flex items-center gap-2 text-2xl">
                  <span>{getTrendIcon(trend)}</span>
                  <span className="text-sm text-muted-foreground">
                    {trend}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Current Conditions */}
          <Card>
            <CardHeader>
              <CardTitle>Current Conditions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Flow</div>
                  <div className="text-3xl font-bold">
                    {formatFlow(current_condition?.flow || null)}
                  </div>
                  {optimal_flow_min && optimal_flow_max && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Optimal: {optimal_flow_min}-{optimal_flow_max} CFS
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">
                    Temperature
                  </div>
                  <div className="text-3xl font-bold">
                    {formatTemperature(current_condition?.temperature || null)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">
                    Gage Height
                  </div>
                  <div className="text-3xl font-bold">
                    {current_condition?.gage_height
                      ? `${current_condition.gage_height.toFixed(2)} ft`
                      : 'N/A'}
                  </div>
                </div>
              </div>

              {current_condition && (
                <div className="mt-4 flex items-center gap-1 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  Last updated:{' '}
                  {format(
                    new Date(current_condition.timestamp),
                    'MMM d, yyyy h:mm a'
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Flow Chart */}
          <Card>
            <CardHeader>
              <CardTitle>24-Hour Flow Chart</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="timestamp"
                    tick={{ fontSize: 12 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="flow"
                    stroke="#FF6B6B"
                    strokeWidth={2}
                    name="Flow (CFS)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Guide Notes */}
          {user && (
            <Card>
              <CardHeader>
                <CardTitle>My Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Add your fishing notes, tips, or observations..."
                  className="min-h-[120px] mb-4"
                />
                <Button onClick={handleSaveNote} disabled={isSavingNote}>
                  {isSavingNote ? 'Saving...' : 'Save Note'}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Species */}
          {species.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Species</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {species.map((s: any) => (
                    <Badge key={s.id} variant="secondary">
                      {s.species.charAt(0).toUpperCase() + s.species.slice(1)}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Location */}
          {latitude && longitude && (
            <Card>
              <CardHeader>
                <CardTitle>Location</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Latitude:</span>{' '}
                    {latitude}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Longitude:</span>{' '}
                    {longitude}
                  </div>
                  <a
                    href={`https://www.google.com/maps?q=${latitude},${longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-2"
                  >
                    <Button variant="outline" size="sm" className="gap-2">
                      <MapPin className="h-4 w-4" />
                      View on Map
                    </Button>
                  </a>
                </div>
              </CardContent>
            </Card>
          )}

          {/* USGS Link */}
          <Card>
            <CardHeader>
              <CardTitle>Resources</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <a
                href={`https://waterdata.usgs.gov/monitoring-location/${usgs_station_id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" className="w-full">
                  View on USGS
                </Button>
              </a>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
