import { useParams } from "wouter";
import { 
  useGetMiner, getGetMinerQueryKey,
  useGetMinerPayouts, getGetMinerPayoutsQueryKey,
  useGetMinerShares, getGetMinerSharesQueryKey 
} from "@workspace/api-client-react";
import { formatHashrate, formatCurrency, formatRelativeTime, formatDateTime, truncateAddress, EXPLORER_URL } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Server, Activity, Wallet, Coins, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function MinerDetail() {
  const { address } = useParams<{ address: string }>();
  const { toast } = useToast();

  const { data: miner, isLoading: isMinerLoading, error: minerError } = useGetMiner(address || "", {
    query: { enabled: !!address, queryKey: getGetMinerQueryKey(address || "") }
  });

  const { data: payouts, isLoading: isPayoutsLoading } = useGetMinerPayouts(address || "", {
    query: { enabled: !!address, queryKey: getGetMinerPayoutsQueryKey(address || "") }
  });

  const { data: shares, isLoading: isSharesLoading } = useGetMinerShares(address || "", {
    query: { enabled: !!address, queryKey: getGetMinerSharesQueryKey(address || "") }
  });

  const copyToClipboard = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      toast({
        title: "Address Copied",
        description: "Miner address copied to clipboard",
      });
    }
  };

  if (isMinerLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-full max-w-2xl bg-card" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 w-full bg-card" />)}
        </div>
        <Skeleton className="h-96 w-full bg-card" />
      </div>
    );
  }

  if (minerError || !miner) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold font-mono text-muted-foreground uppercase">Miner Details</h1>
        <div className="p-8 text-center border-2 border-dashed border-border rounded-lg bg-card">
          <p className="font-mono text-muted-foreground">Miner <span className="text-primary">{address}</span> not found.</p>
          <p className="text-sm font-mono mt-2 text-muted-foreground">The address might be incorrect or the miner hasn't submitted any shares yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pt-2 pb-6 pl-11 pr-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-sm font-mono text-muted-foreground uppercase tracking-widest mb-1 flex items-center gap-2">
            Miner Stats
            {miner.mode && (
              <Badge variant="outline" className={`text-[10px] uppercase ${miner.mode === 'solo' ? 'border-primary/50 text-primary' : ''}`}>
                {miner.mode}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-bold font-mono break-all">{address}</h1>
            <button onClick={copyToClipboard} className="text-muted-foreground hover:text-primary transition-colors cursor-pointer">
              <Copy className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-mono text-muted-foreground uppercase">Last Seen</div>
          <div className="font-mono font-bold">{formatRelativeTime(miner.lastSeen)}</div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Hashrate</CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-primary">{formatHashrate(miner.hashrate)}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Pending Balance</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{formatCurrency(miner.pendingBalance)} <span className="text-sm text-muted-foreground">LBTC</span></div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Total Paid</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{formatCurrency(miner.totalPaid)} <span className="text-sm text-muted-foreground">LBTC</span></div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Workers</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{miner.workerCount}</div>
            <div className="text-xs text-muted-foreground font-mono mt-1">
              {miner.validShares} shares valid
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="workers" className="w-full">
        <TabsList className="bg-card border border-border w-full justify-start h-auto p-1 font-mono rounded-md">
          <TabsTrigger value="workers" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground uppercase py-2">Workers</TabsTrigger>
          <TabsTrigger value="payouts" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground uppercase py-2">Payouts</TabsTrigger>
          <TabsTrigger value="shares" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground uppercase py-2">Recent Shares</TabsTrigger>
        </TabsList>
        
        <TabsContent value="workers" className="mt-4">
          <Card className="bg-card border-border">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead className="font-mono text-muted-foreground font-bold">Worker Name</TableHead>
                    <TableHead className="font-mono text-muted-foreground font-bold">Hashrate</TableHead>
                    <TableHead className="font-mono text-muted-foreground font-bold">Valid Shares</TableHead>
                    <TableHead className="font-mono text-muted-foreground font-bold text-right">Last Seen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {miner.workers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center p-8 font-mono text-muted-foreground">
                        No active workers.
                      </TableCell>
                    </TableRow>
                  ) : (
                    miner.workers.map((worker) => (
                      <TableRow key={worker.name} className="border-border/50">
                        <TableCell className="font-mono font-semibold">{worker.name}</TableCell>
                        <TableCell className="font-mono text-primary">{formatHashrate(worker.hashrate)}</TableCell>
                        <TableCell className="font-mono">{worker.validShares}</TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">{formatRelativeTime(worker.lastSeen)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payouts" className="mt-4">
          <Card className="bg-card border-border">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead className="font-mono text-muted-foreground font-bold">Amount</TableHead>
                    <TableHead className="font-mono text-muted-foreground font-bold">TXID</TableHead>
                    <TableHead className="font-mono text-muted-foreground font-bold text-right">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isPayoutsLoading ? (
                    <TableRow><TableCell colSpan={3} className="text-center p-4 font-mono">Loading...</TableCell></TableRow>
                  ) : (!payouts || payouts.payouts.length === 0) ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center p-8 font-mono text-muted-foreground">
                        No payouts yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    payouts.payouts.map((payout) => (
                      <TableRow key={payout.id} className="border-border/50">
                        <TableCell className="font-mono font-bold">{formatCurrency(payout.amount)} LBTC</TableCell>
                        <TableCell className="font-mono text-muted-foreground text-xs">
                          {payout.txid ? (
                            <a href={`${EXPLORER_URL}${payout.txid}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                              {truncateAddress(payout.txid)}
                            </a>
                          ) : 'Pending'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground" title={formatDateTime(payout.createdAt)}>
                          {formatRelativeTime(payout.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="shares" className="mt-4">
          <Card className="bg-card border-border">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead className="font-mono text-muted-foreground font-bold">Worker</TableHead>
                    <TableHead className="font-mono text-muted-foreground font-bold">Difficulty</TableHead>
                    <TableHead className="font-mono text-muted-foreground font-bold">Status</TableHead>
                    <TableHead className="font-mono text-muted-foreground font-bold">Mode</TableHead>
                    <TableHead className="font-mono text-muted-foreground font-bold text-right">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isSharesLoading ? (
                    <TableRow><TableCell colSpan={5} className="text-center p-4 font-mono">Loading...</TableCell></TableRow>
                  ) : (!shares || shares.shares.length === 0) ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center p-8 font-mono text-muted-foreground">
                        No recent shares.
                      </TableCell>
                    </TableRow>
                  ) : (
                    shares.shares.map((share) => (
                      <TableRow key={share.id} className="border-border/50">
                        <TableCell className="font-mono">{share.workerName}</TableCell>
                        <TableCell className="font-mono">{share.difficulty.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant={share.valid ? "default" : "destructive"} className="text-[10px] font-mono uppercase bg-primary text-primary-foreground">
                            {share.valid ? 'Valid' : 'Invalid'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] font-mono uppercase ${share.mode === 'solo' ? 'border-primary/50 text-primary' : ''}`}>
                            {share.mode}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground" title={formatDateTime(share.createdAt)}>
                          {formatRelativeTime(share.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
