'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Bell, BellOff, Trash2, Plus, Info, History } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';

interface Alert {
  id: string;
  river_id: string;
  alert_type: string;
  threshold_value: number | null;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  rivers: { id: string; name: string; slug: string };
}

interface River {
  id: string;
  name: string;
  slug: string;
}

interface AlertsListProps {
  alerts: Alert[];
  rivers: River[];
}

function alertTypeLabel(type: string, threshold: number | null) {
  if (type === 'optimal_flow')    return 'Optimal flow conditions';
  if (type === 'flow_threshold')  return `Flow threshold: ${threshold} CFS`;
  if (type === 'temperature')     return `Temperature: ${threshold}°F`;
  return type;
}

export function AlertsList({ alerts: initialAlerts, rivers }: AlertsListProps) {
  const router = useRouter();
  const [alerts, setAlerts]               = useState(initialAlerts);
  const activeAlerts = alerts.filter((a) => a.is_active);
  const historyAlerts = alerts.filter((a) => !a.is_active);
  const [selectedRiver, setSelectedRiver] = useState('');
  const [alertType, setAlertType]         = useState('optimal_flow');
  const [threshold, setThreshold]         = useState('');
  const [loading, setLoading]             = useState(false);

  const handleCreateAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRiver) return;
    setLoading(true);
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          river_id: selectedRiver,
          alert_type: alertType,
          threshold_value: threshold ? parseFloat(threshold) : null,
        }),
      });
      if (res.ok) {
        setSelectedRiver('');
        setThreshold('');
        router.refresh();
      }
    } catch (err) {
      console.error('Error creating alert:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAlert = async (alertId: string) => {
    try {
      const res = await fetch('/api/alerts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alert_id: alertId }),
      });
      if (res.ok) setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    } catch (err) {
      console.error('Error deleting alert:', err);
    }
  };

  const handleToggleAlert = async (alertId: string, isActive: boolean) => {
    try {
      const res = await fetch('/api/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alert_id: alertId, is_active: !isActive }),
      });
      if (res.ok) {
        setAlerts((prev) =>
          prev.map((a) => (a.id === alertId ? { ...a, is_active: !isActive } : a))
        );
      }
    } catch (err) {
      console.error('Error toggling alert:', err);
    }
  };

  return (
    <div className="grid lg:grid-cols-3 gap-6">

      {/* ── Alert list ── */}
      <div className="lg:col-span-2 space-y-6">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Active Alerts</h2>

          {activeAlerts.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-10 text-center">
              <Bell className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">No active alerts.</p>
              <p className="text-sm text-muted-foreground mt-1">
                Create one on the right to get notified when conditions are prime.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-center gap-4 bg-card border border-border rounded-xl px-4 py-4"
                >
                  <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 bg-primary/10">
                    <Bell className="h-4 w-4 text-primary" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm truncate">{alert.rivers.name}</span>
                      <Badge variant="default" className="text-xs">Active</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {alertTypeLabel(alert.alert_type, alert.threshold_value)}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => handleToggleAlert(alert.id, alert.is_active)}
                    >
                      Pause
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      aria-label="Delete alert"
                      onClick={() => handleDeleteAlert(alert.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Alert History</h2>
          </div>

          {historyAlerts.length === 0 ? (
            <p className="text-sm text-muted-foreground bg-card border border-border rounded-xl px-4 py-6 text-center">
              No past alerts.
            </p>
          ) : (
            <div className="space-y-2">
              {historyAlerts.map((alert) => {
                const firedAt = alert.updated_at ?? alert.created_at;
                return (
                  <div
                    key={alert.id}
                    className="flex items-center gap-4 bg-card border border-border/50 rounded-xl px-4 py-3 opacity-80"
                  >
                    <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 bg-secondary/40">
                      <BellOff className="h-4 w-4 text-muted-foreground" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">{alert.rivers.name}</span>
                        <span className="text-xs text-muted-foreground">
                          Fired {format(parseISO(firedAt), 'MMM d')}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {alertTypeLabel(alert.alert_type, alert.threshold_value)}
                      </p>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground hover:text-foreground shrink-0"
                      onClick={() => handleToggleAlert(alert.id, alert.is_active)}
                    >
                      Resume
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* ── Create form ── */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3 pt-5 px-5">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              Create Alert
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <form onSubmit={handleCreateAlert} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">River</label>
                <Select
                  value={selectedRiver}
                  onChange={(e) => setSelectedRiver(e.target.value)}
                  required
                  className="bg-background"
                >
                  <option value="">Select a river…</option>
                  {rivers.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Alert Type</label>
                <Select
                  value={alertType}
                  onChange={(e) => setAlertType(e.target.value)}
                  className="bg-background"
                >
                  <option value="optimal_flow">Optimal Flow</option>
                  <option value="flow_threshold">Flow Threshold (CFS)</option>
                  <option value="temperature">Temperature (°F)</option>
                </Select>
              </div>

              {(alertType === 'flow_threshold' || alertType === 'temperature') && (
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    {alertType === 'temperature' ? 'Threshold (°F)' : 'Threshold (CFS)'}
                  </label>
                  <Input
                    type="number"
                    step="0.1"
                    value={threshold}
                    onChange={(e) => setThreshold(e.target.value)}
                    placeholder={alertType === 'temperature' ? 'e.g. 65' : 'e.g. 500'}
                    required
                    className="bg-background"
                  />
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Creating…' : 'Create Alert'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Info card */}
        <Card className="border-border/50">
          <CardContent className="px-5 py-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Info className="h-4 w-4" />
              Alert types
            </div>
            {[
              { label: 'Optimal Flow', desc: 'Notifies when flow is within the optimal range for that river.' },
              { label: 'Flow Threshold', desc: 'Fires when flow crosses a specific CFS value.' },
              { label: 'Temperature', desc: 'Fires when water temp reaches your target.' },
            ].map(({ label, desc }) => (
              <div key={label} className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground/80">{label}:</span> {desc}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
