import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Activity, Bell, Heart, TrendingUp } from 'lucide-react';

export default function Home() {
  return (
    <div className="container mx-auto px-4 py-12">
      {/* Hero Section */}
      <div className="text-center max-w-4xl mx-auto mb-16">
        <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          StreamFlows
        </h1>
        <p className="text-xl md:text-2xl text-muted-foreground mb-8">
          Real-time river conditions for fly fishing guides in New England
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          <Link href="/rivers">
            <Button size="lg" className="text-lg">
              View Rivers
            </Button>
          </Link>
          <Link href="/signup">
            <Button size="lg" variant="outline" className="text-lg">
              Sign Up Free
            </Button>
          </Link>
        </div>
      </div>

      {/* Features Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
        <Card className="border-2">
          <CardContent className="pt-6">
            <div className="rounded-full bg-primary/10 w-12 h-12 flex items-center justify-center mb-4">
              <Activity className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Real-time Data</h3>
            <p className="text-muted-foreground">
              Live USGS flow data updated every 15 minutes for accurate conditions
            </p>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardContent className="pt-6">
            <div className="rounded-full bg-primary/10 w-12 h-12 flex items-center justify-center mb-4">
              <Heart className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Favorite Rivers</h3>
            <p className="text-muted-foreground">
              Save your go-to spots and track conditions at a glance
            </p>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardContent className="pt-6">
            <div className="rounded-full bg-primary/10 w-12 h-12 flex items-center justify-center mb-4">
              <Bell className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Smart Alerts</h3>
            <p className="text-muted-foreground">
              Get notified when your rivers hit optimal fishing conditions
            </p>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardContent className="pt-6">
            <div className="rounded-full bg-primary/10 w-12 h-12 flex items-center justify-center mb-4">
              <TrendingUp className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Flow Trends</h3>
            <p className="text-muted-foreground">
              See if conditions are rising, falling, or stable with trend indicators
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Stats Section */}
      <div className="bg-secondary/10 rounded-lg p-8 mb-16">
        <div className="grid md:grid-cols-3 gap-8 text-center">
          <div>
            <div className="text-4xl font-bold text-primary mb-2">50+</div>
            <div className="text-muted-foreground">New England Rivers</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-primary mb-2">6</div>
            <div className="text-muted-foreground">States Covered</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-primary mb-2">15 min</div>
            <div className="text-muted-foreground">Update Frequency</div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="text-center max-w-2xl mx-auto">
        <h2 className="text-3xl font-bold mb-4">Ready to track your rivers?</h2>
        <p className="text-muted-foreground mb-6">
          Join fly fishing guides across New England who rely on StreamFlows for
          up-to-date river conditions.
        </p>
        <Link href="/rivers">
          <Button size="lg">Browse All Rivers</Button>
        </Link>
      </div>
    </div>
  );
}
