'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Bell, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Alert {
  id: string;
  river_id: string;
  alert_type: string;
  threshold_value: number | null;
  is_active: boolean;
  created_at: string;
  rivers: {
    id: string;
    name: string;
    slug: string;
  };
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

export function AlertsList({ alerts: initialAlerts, rivers }: AlertsListProps) {
  const router = useRouter();
  const [alerts, setAlerts] = useState(initialAlerts);
  const [selectedRiver, setSelectedRiver] = useState('');
  const [alertType, setAlertType] = useState('optimal_flow');
  const [threshold, setThreshold] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreateAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRiver) return;

    setLoading(true);
    try {
      const response = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          river_id: selectedRiver,
          alert_type: alertType,
          threshold_value: threshold ? parseFloat(threshold) : null,
        }),
      });

      if (response.ok) {
        setSelectedRiver('');
        setThreshold('');
        router.refresh();
      }
    } catch (error) {
      console.error('Error creating alert:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAlert = async (alertId: string) => {
    try {
      const response = await fetch('/api/alerts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alert_id: alertId }),
      });

      if (response.ok) {
        setAlerts(alerts.filter((a) => a.id !== alertId));
      }
    } catch (error) {
      console.error('Error deleting alert:', error);
    }
  };

  const handleToggleAlert = async (alertId: string, isActive: boolean) => {
    try {
      const response = await fetch('/api/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alert_id: alertId, is_active: !isActive }),
      });

      if (response.ok) {
        setAlerts(
          alerts.map((a) =>
            a.id === alertId ? { ...a, is_active: !isActive } : a
          )
        );
      }
    } catch (error) {
      console.error('Error toggling alert:', error);
    }
  };

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Active Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            {alerts.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No alerts configured yet. Create one to get started!
              </p>
            ) : (
              <div className="space-y-4">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Bell className="h-4 w-4 text-primary" />
                        <span className="font-semibold">
                          {alert.rivers.name}
                        </span>
                        <Badge variant={alert.is_active ? 'default' : 'secondary'}>
                          {alert.is_active ? 'Active' : 'Paused'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {alert.alert_type === 'optimal_flow' && 'Optimal flow conditions'}
                        {alert.alert_type === 'flow_threshold' &&
                          `Flow ${alert.threshold_value} CFS`}
                        {alert.alert_type === 'temperature' &&
                          `Temperature ${alert.threshold_value}°F`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          handleToggleAlert(alert.id, alert.is_active)
                        }
                      >
                        {alert.is_active ? 'Pause' : 'Activate'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteAlert(alert.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div>
        <Card>
          <CardHeader>
            <CardTitle>Create Alert</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateAlert} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  River
                </label>
                <Select
                  value={selectedRiver}
                  onChange={(e) => setSelectedRiver(e.target.value)}
                  required
                >
                  <option value="">Select a river</option>
                  {rivers.map((river) => (
                    <option key={river.id} value={river.id}>
                      {river.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Alert Type
                </label>
                <Select
                  value={alertType}
                  onChange={(e) => setAlertType(e.target.value)}
                >
                  <option value="optimal_flow">Optimal Flow</option>
                  <option value="flow_threshold">Flow Threshold</option>
                  <option value="temperature">Temperature</option>
                </Select>
              </div>

              {(alertType === 'flow_threshold' || alertType === 'temperature') && (
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Threshold Value
                  </label>
                  <Input
                    type="number"
                    step="0.1"
                    value={threshold}
                    onChange={(e) => setThreshold(e.target.value)}
                    placeholder={
                      alertType === 'temperature' ? 'e.g., 65' : 'e.g., 500'
                    }
                    required
                  />
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Creating...' : 'Create Alert'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>About Alerts</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              <strong>Optimal Flow:</strong> Get notified when flow is within
              the optimal range
            </p>
            <p>
              <strong>Flow Threshold:</strong> Alert when flow crosses a specific
              value
            </p>
            <p>
              <strong>Temperature:</strong> Alert when water temperature reaches
              a threshold
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
