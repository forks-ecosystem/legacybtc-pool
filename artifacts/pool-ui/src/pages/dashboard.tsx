import { useGetPoolDashboard } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatHashrate, formatCurrency, formatRelativeTime, formatDateTime, truncateAddress } from "@/lib/format";
import { Link, useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useCard } from "@/hooks/use-card";
import { useKeyboardList } from "@/hooks/use-keyboard-list";
import { Activity, Server, Pickaxe, Coins, Hash } from "lucide-react";
import { useEffect } from "react";

export default function Dashboard() {
  const { data: dashboard, isLoading, error } = useGetPoolDashboard();
  const [, navigate] = useLocation();

  useEffect(() => {
    fetch("/api/admin/status")
      .then(r => r.json())
      .then(data => { if (!data.configured) navigate("/admin"); })
      .catch(() => {});
  }, []);
  const { open } = useCard();

  function blockCardContent(block: NonNullable<typeof dashboard>['recentBlocks'][number]) {
    return (
      <div className="space-y-4 font-mono">
        <h2 className="text-lg font-bold">Block #{block.height}</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between border-b border-border pb-1">
            <span className="text-muted-foreground">Height</span>
            <span className="font-semibold">{block.height}</span>
          </div>
          <div className="flex justify-between border-b border-border pb-1">
            <span className="text-muted-foreground">Finder</span>
            <span className="text-primary">{truncateAddress(block.finderAddress)}</span>
          </div>
          <div className="flex justify-between border-b border-border pb-1">
            <span className="text-muted-foreground">Reward</span>
            <span className="font-semibold">{formatCurrency(block.reward)} LBTC</span>
          </div>
          <div className="flex justify-between border-b border-border pb-1">
            <span className="text-muted-foreground">Mode</span>
            <span className="uppercase">{block.mode}</span>
          </div>
          <div className="flex justify-between border-b border-border pb-1">
            <span className="text-muted-foreground">Status</span>
            <span className={block.confirmed ? 'text-green-400' : 'text-orange-400'}>{block.confirmed ? 'Confirmed' : 'Pending'}</span>
          </div>
          <div className="flex justify-between border-b border-border pb-1">
            <span className="text-muted-foreground">Found</span>
            <span>{formatDateTime(block.foundAt)}</span>
          </div>
        </div>
      </div>
    );
  }

  const { containerRef: blocksRef, handleKeyDown: blocksKeys } = useKeyboardList({
    items: dashboard?.recentBlocks ?? [],
    onEnter: (block) => open(blockCardContent(block)),
  });

  const { containerRef: minersRef, handleKeyDown: minersKeys } = useKeyboardList({
    items: dashboard?.topMiners ?? [],
    onEnter: (miner) => open(
      <div className="space-y-4 font-mono">
        <h2 className="text-lg font-bold">Miner</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between border-b border-border pb-1">
            <span className="text-muted-foreground">Address</span>
            <span className="text-primary text-xs truncate max-w-[200px] text-right">{miner.address}</span>
          </div>
          <div className="flex justify-between border-b border-border pb-1">
            <span className="text-muted-foreground">Hashrate</span>
            <span className="font-semibold text-primary">{formatHashrate(miner.hashrate)}</span>
          </div>
          <div className="flex justify-between border-b border-border pb-1">
            <span className="text-muted-foreground">Workers</span>
            <span>{miner.workerCount}</span>
          </div>
          <div className="flex justify-between border-b border-border pb-1">
            <span className="text-muted-foreground">Total Paid</span>
            <span>{formatCurrency(miner.totalPaid)} LBTC</span>
          </div>
        </div>
      </div>
    ),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold font-mono tracking-tight">POOL DASHBOARD</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 w-full bg-card" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-96 w-full bg-card" />
          <Skeleton className="h-96 w-full bg-card" />
        </div>
      </div>
    );
  }

  if (error || !dashboard) {
    return <div className="p-8 text-center text-destructive font-mono bg-destructive/10 border border-destructive/20 rounded-md">Error loading dashboard data</div>;
  }

  const { stats, recentBlocks, recentPayouts, topMiners } = dashboard;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold font-mono tracking-tight">POOL OVERVIEW</h1>
        <div className="flex gap-4 font-mono text-sm">
          <div className="flex flex-col items-end">
            <span className="text-muted-foreground">Network Hashrate</span>
            <span className="font-semibold text-primary">{formatHashrate(stats.networkHashrate)}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-muted-foreground">Difficulty</span>
            <span className="font-semibold">{stats.networkDifficulty.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border hover:border-primary/50 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium font-mono text-muted-foreground">Pool Hashrate</CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-primary">{formatHashrate(stats.hashrate)}</div>
            <p className="text-xs text-muted-foreground mt-1 font-mono">
              {((stats.hashrate / stats.networkHashrate) * 100).toFixed(2)}% of network
            </p>
          </CardContent>
        </Card>
        
        <Card className="bg-card border-border hover:border-primary/50 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium font-mono text-muted-foreground">Active Miners</CardTitle>
            <Pickaxe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{stats.activeMiners}</div>
            <p className="text-xs text-muted-foreground mt-1 font-mono">
              {stats.activeWorkers} workers online
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border hover:border-primary/50 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium font-mono text-muted-foreground">Blocks Found</CardTitle>
            <BoxIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{stats.totalBlocksFound}</div>
            <div className="flex gap-2 mt-1">
              <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary">SOLO {stats.soloBlocksFound}</Badge>
              <Badge variant="outline" className="text-[10px] font-mono">PPLNS {stats.pplnsBlocksFound}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border hover:border-primary/50 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium font-mono text-muted-foreground">Total Paid</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{formatCurrency(stats.totalPaidOut)} LBTC</div>
            <p className="text-xs text-muted-foreground mt-1 font-mono">
              Height: {stats.blockHeight.toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Blocks */}
        <Card className="bg-card border-border">
          <CardHeader className="border-b border-border/50 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-mono">Recent Blocks</CardTitle>
              <Link href="/blocks" className="text-xs font-mono text-primary hover:underline">View All</Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {recentBlocks.length === 0 ? (
              <div className="p-8 text-center text-sm font-mono text-muted-foreground">No blocks found yet.</div>
            ) : (
              <div ref={blocksRef} onKeyDown={blocksKeys} className="divide-y divide-border/50">
                {recentBlocks.map(block => (
                  <div key={block.id} data-list-item tabIndex={0} onClick={() => open(blockCardContent(block))} className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors focus:bg-muted/60 focus:outline-none cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div className="bg-muted p-2 rounded-md font-mono text-xs text-muted-foreground">
                        {block.height}
                      </div>
                      <div>
                        <div className="font-mono text-sm">
                          <Link href={`/miners/${block.finderAddress}`} className="text-primary hover:underline">
                            {truncateAddress(block.finderAddress)}
                          </Link>
                        </div>
                        <div className="text-xs text-muted-foreground font-mono mt-1">
                          {formatRelativeTime(block.foundAt)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-sm font-semibold">{formatCurrency(block.reward)} LBTC</div>
                      <div className="mt-1 flex justify-end gap-2">
                        <Badge variant="outline" className={`text-[10px] uppercase font-mono ${block.mode === 'solo' ? 'border-primary/50 text-primary' : ''}`}>
                          {block.mode}
                        </Badge>
                        <Badge variant="outline" className={`text-[10px] uppercase font-mono ${block.confirmed ? 'bg-green-900/40 text-green-400 border-green-700' : 'bg-orange-900/40 text-orange-400 border-orange-700'}`}>
                          {block.confirmed ? 'Confirmed' : 'Pending'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Miners */}
        <Card className="bg-card border-border">
          <CardHeader className="border-b border-border/50 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-mono">Top Miners</CardTitle>
              <Link href="/miners" className="text-xs font-mono text-primary hover:underline">View All</Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {topMiners.length === 0 ? (
               <div className="p-8 text-center text-sm font-mono text-muted-foreground">No active miners.</div>
            ) : (
              <div ref={minersRef} onKeyDown={minersKeys} className="divide-y divide-border/50">
                {topMiners.map((miner, i) => (
                  <div key={miner.address} data-list-item tabIndex={0} className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors focus:bg-muted/60 focus:outline-none">
                    <div className="flex items-center gap-4">
                      <div className="font-mono text-xs text-muted-foreground w-4">{i + 1}.</div>
                      <div>
                        <div className="font-mono text-sm">
                          <Link href={`/miners/${miner.address}`} className="text-primary hover:underline">
                            {truncateAddress(miner.address)}
                          </Link>
                        </div>
                        <div className="text-xs text-muted-foreground font-mono mt-1">
                          {miner.workerCount} workers
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-sm font-semibold text-primary">{formatHashrate(miner.hashrate)}</div>
                      <div className="text-xs text-muted-foreground font-mono mt-1">
                        {formatCurrency(miner.totalPaid)} paid
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function BoxIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </svg>
  )
}
