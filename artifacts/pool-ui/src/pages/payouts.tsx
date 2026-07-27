import { useListPayouts } from "@workspace/api-client-react";
import { formatCurrency, formatRelativeTime, formatDateTime, truncateAddress, EXPLORER_URL } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { useCard } from "@/hooks/use-card";
import { useKeyboardList } from "@/hooks/use-keyboard-list";

export default function Payouts() {
  const { data, isLoading, error } = useListPayouts({ limit: 100 });
  const { open, openUrl } = useCard();

  const renderPayoutCard = (p: NonNullable<typeof data>['payouts'][number]) => {
    open(
      <div className="space-y-4 font-mono">
        <h2 className="text-lg font-bold">Payout</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between border-b border-border pb-1">
            <span className="text-muted-foreground">Miner</span>
            <span className="text-primary">{truncateAddress(p.address)}</span>
          </div>
          <div className="flex justify-between border-b border-border pb-1">
            <span className="text-muted-foreground">Amount</span>
            <span className="font-semibold">{formatCurrency(p.amount)} LBTC</span>
          </div>
          <div className="flex justify-between border-b border-border pb-1">
            <span className="text-muted-foreground">TXID</span>
            <span className="text-xs truncate max-w-[200px] text-right">{p.txid || 'Pending'}</span>
          </div>
          <div className="flex justify-between border-b border-border pb-1">
            <span className="text-muted-foreground">Block</span>
            <span>{p.blockHeight ?? '-'}</span>
          </div>
          <div className="flex justify-between border-b border-border pb-1">
            <span className="text-muted-foreground">Created</span>
            <span>{formatDateTime(p.createdAt)}</span>
          </div>
        </div>
      </div>
    );
  };

  const { containerRef, handleKeyDown } = useKeyboardList({
    items: data?.payouts ?? [],
    onEnter: renderPayoutCard,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold font-mono tracking-tight uppercase">Recent Payouts</h1>
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
    return <div className="p-8 text-center text-destructive font-mono bg-destructive/10 border border-destructive/20 rounded-md">Error loading payouts</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold font-mono tracking-tight uppercase">Recent Payouts</h1>

      <Card className="bg-card border-border">
        <CardHeader className="border-b border-border/50">
          <CardTitle className="text-sm font-mono text-muted-foreground flex justify-between">
            <span>Total Payouts: <span className="text-foreground">{data.total}</span></span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <div ref={containerRef} onKeyDown={handleKeyDown}>
            <Table>
              <TableHeader>
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className="font-mono text-muted-foreground font-bold">Miner</TableHead>
                  <TableHead className="font-mono text-muted-foreground font-bold">Amount</TableHead>
                  <TableHead className="font-mono text-muted-foreground font-bold">TXID</TableHead>
                  <TableHead className="font-mono text-muted-foreground font-bold text-right">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.payouts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center p-8 font-mono text-muted-foreground">
                      No payouts have been processed yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.payouts.map((p, i) => (
                    <TableRow
                      key={p.id}
                      data-list-item
                      tabIndex={0}
                      className="border-border/50 hover:bg-muted/50 transition-colors focus:bg-muted/60 focus:outline-none"
                      onKeyDown={(e) => { if (e.key === 'Enter') renderPayoutCard(p); }}
                    >
                      <TableCell className="font-mono">
                        <Link href={`/miners/${p.address}`} className="text-primary hover:underline">
                          {truncateAddress(p.address)}
                        </Link>
                      </TableCell>
                      <TableCell className="font-mono font-bold">
                        {formatCurrency(p.amount)} LBTC
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {p.txid ? (
                          <button onClick={(e) => { e.preventDefault(); openUrl(`${EXPLORER_URL}${p.txid}`); }} className="text-primary hover:underline font-mono text-xs cursor-pointer bg-transparent border-0 p-0">
                            {truncateAddress(p.txid)}
                          </button>
                        ) : 'Pending'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground" title={formatDateTime(p.createdAt)}>
                        {formatRelativeTime(p.createdAt)}
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
