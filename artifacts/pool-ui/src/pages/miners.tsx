import { useState } from "react";
import { useLocation } from "wouter";
import { useListMiners } from "@workspace/api-client-react";
import { formatHashrate, formatCurrency, formatRelativeTime, truncateAddress } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useCard } from "@/hooks/use-card";
import { useKeyboardList } from "@/hooks/use-keyboard-list";

export default function Miners() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const { data, isLoading, error } = useListMiners({});
  const { open, openUrl } = useCard();

  const renderMinerCard = (m: NonNullable<typeof data>['miners'][number]) => {
    open(
      <div className="space-y-4 font-mono">
        <h2 className="text-lg font-bold">Miner</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between border-b border-border pb-1">
            <span className="text-muted-foreground">Address</span>
            <span className="text-primary text-xs truncate max-w-[200px] text-right">{m.address}</span>
          </div>
          <div className="flex justify-between border-b border-border pb-1">
            <span className="text-muted-foreground">Mode</span>
            <span className="uppercase">{m.mode || '-'}</span>
          </div>
          <div className="flex justify-between border-b border-border pb-1">
            <span className="text-muted-foreground">Hashrate</span>
            <span className="font-semibold text-primary">{formatHashrate(m.hashrate)}</span>
          </div>
          <div className="flex justify-between border-b border-border pb-1">
            <span className="text-muted-foreground">Workers</span>
            <span>{m.workerCount}</span>
          </div>
          <div className="flex justify-between border-b border-border pb-1">
            <span className="text-muted-foreground">Pending</span>
            <span>{formatCurrency(m.pendingBalance)} LBTC</span>
          </div>
          <div className="flex justify-between border-b border-border pb-1">
            <span className="text-muted-foreground">Total Paid</span>
            <span>{formatCurrency(m.totalPaid)} LBTC</span>
          </div>
          <div className="flex justify-between border-b border-border pb-1">
            <span className="text-muted-foreground">Last Seen</span>
            <span>{formatRelativeTime(m.lastSeen)}</span>
          </div>
        </div>
      </div>
    );
  };

  const { containerRef, handleKeyDown } = useKeyboardList({
    items: data?.miners ?? [],
    onEnter: (m) => openUrl(`/miners/${m.address}`),
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      setLocation(`/miners/${search.trim()}`);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold font-mono tracking-tight uppercase">Miners</h1>
        <Skeleton className="h-12 w-full max-w-md bg-card" />
        <Card className="bg-card border-border">
          <CardContent className="p-0">
            <div className="space-y-2 p-4">
              {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 w-full bg-muted/20" />)}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !data) {
    return <div className="p-8 text-center text-destructive font-mono bg-destructive/10 border border-destructive/20 rounded-md">Error loading miners</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold font-mono tracking-tight uppercase">Active Miners</h1>
        
        <form onSubmit={handleSearch} className="flex gap-2 max-w-md w-full">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by LBTC Address..."
              className="pl-9 font-mono bg-card border-border focus-visible:ring-primary"
            />
          </div>
          <Button type="submit" variant="secondary" className="font-mono font-bold">Search</Button>
        </form>
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="border-b border-border/50">
          <CardTitle className="text-sm font-mono text-muted-foreground flex justify-between">
            <span>Total Miners: <span className="text-foreground">{data.total}</span></span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div ref={containerRef} onKeyDown={handleKeyDown}>
            <Table>
              <TableHeader>
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className="font-mono text-muted-foreground font-bold">Miner Address</TableHead>
                  <TableHead className="font-mono text-muted-foreground font-bold">Mode</TableHead>
                  <TableHead className="font-mono text-muted-foreground font-bold">Hashrate</TableHead>
                  <TableHead className="font-mono text-muted-foreground font-bold">Workers</TableHead>
                  <TableHead className="font-mono text-muted-foreground font-bold">Pending</TableHead>
                  <TableHead className="font-mono text-muted-foreground font-bold text-right">Last Seen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.miners.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center p-8 font-mono text-muted-foreground">
                      No active miners found.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.miners.map((miner, i) => (
                    <TableRow
                      key={miner.address}
                      data-list-item
                      tabIndex={0}
                      className="border-border/50 hover:bg-muted/50 transition-colors group focus:bg-muted/60 focus:outline-none"
                      onKeyDown={(e) => { if (e.key === 'Enter') renderMinerCard(miner); }}
                    >
                      <TableCell className="font-mono">
                        <span
                          onClick={() => openUrl(`/miners/${miner.address}`)}
                          className="text-primary hover:underline flex items-center gap-2 cursor-pointer"
                        >
                          {truncateAddress(miner.address)}
                          <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </span>
                      </TableCell>
                      <TableCell>
                        {miner.mode && (
                          <Badge variant="outline" className={`text-[10px] font-mono uppercase ${miner.mode === 'solo' ? 'border-primary/50 text-primary' : ''}`}>
                            {miner.mode}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-primary font-semibold">
                        {formatHashrate(miner.hashrate)}
                      </TableCell>
                      <TableCell className="font-mono">
                        {miner.workerCount}
                      </TableCell>
                      <TableCell className="font-mono">
                        {formatCurrency(miner.pendingBalance)} LBTC
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {formatRelativeTime(miner.lastSeen)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
