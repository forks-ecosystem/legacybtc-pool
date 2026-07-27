import { useListBlocks } from "@workspace/api-client-react";
import { formatCurrency, formatRelativeTime, formatDateTime, truncateAddress, EXPLORER_URL } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, useLocation } from "wouter";
import { useCard } from "@/hooks/use-card";
import { useKeyboardList } from "@/hooks/use-keyboard-list";

export default function Blocks() {
  const { data, isLoading, error } = useListBlocks({ limit: 100 });
  const { open, openUrl, close } = useCard();
  const [, navigate] = useLocation();

  const renderBlockCard = (block: NonNullable<typeof data>['blocks'][number]) => {
    open(
      <div className="font-mono max-w-sm">
        <h2 className="text-lg font-bold mb-3">Block #{block.height}</h2>
        <table className="w-full text-sm">
          <tbody>
            <tr className="border-b border-border">
              <td className="text-muted-foreground py-1.5 pr-4 align-top">Height</td>
              <td className="font-semibold py-1.5 text-right">{block.height}</td>
            </tr>
            <tr className="border-b border-border">
              <td className="text-muted-foreground py-1.5 pr-4 align-top">Hash</td>
              <td className="py-1.5 text-right"><span className="text-xs break-all">{block.hash}</span></td>
            </tr>
            <tr className="border-b border-border">
              <td className="text-muted-foreground py-1.5 pr-4 align-top">Finder</td>
              <td className="py-1.5 text-right text-primary">{truncateAddress(block.finderAddress)}</td>
            </tr>
            <tr className="border-b border-border">
              <td className="text-muted-foreground py-1.5 pr-4 align-top">Reward</td>
              <td className="py-1.5 text-right font-semibold">{formatCurrency(block.reward)} LBTC</td>
            </tr>
            <tr className="border-b border-border">
              <td className="text-muted-foreground py-1.5 pr-4 align-top">Mode</td>
              <td className="py-1.5 text-right uppercase">{block.mode}</td>
            </tr>
            <tr className="border-b border-border">
              <td className="text-muted-foreground py-1.5 pr-4 align-top">Status</td>
              <td className="py-1.5 text-right"><span className={block.confirmed ? 'text-green-400' : 'text-orange-400'}>{block.confirmed ? 'Confirmed' : 'Pending'}</span></td>
            </tr>
            <tr>
              <td className="text-muted-foreground py-1.5 pr-4 align-top">Found</td>
              <td className="py-1.5 text-right">{formatDateTime(block.foundAt)}</td>
            </tr>
          </tbody>
        </table>
        <div className="flex gap-2 mt-4 pt-3 border-t border-border">
          <button onClick={() => openUrl(`${EXPLORER_URL}${block.hash}`)} className="flex-1 px-3 py-2 text-xs font-mono rounded bg-muted hover:bg-muted/80 text-foreground border border-border cursor-pointer text-center">
            1 Block
          </button>
          <button onClick={() => { navigate(`/miners/${block.finderAddress}`); close(); }} className="flex-1 px-3 py-2 text-xs font-mono rounded bg-muted hover:bg-muted/80 text-foreground border border-border cursor-pointer text-center">
            2 Finder
          </button>
        </div>
      </div>
    );
  };

  const { containerRef, handleKeyDown } = useKeyboardList({
    items: data?.blocks ?? [],
    onEnter: renderBlockCard,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold font-mono tracking-tight uppercase">Found Blocks</h1>
      <Card className="bg-card border-border max-w-5xl">
          <CardContent className="p-0">
            <div className="space-y-2 p-4">
              {[1,2,3,4,5,6,7].map(i => <Skeleton key={i} className="h-12 w-full bg-muted/20" />)}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !data) {
    return <div className="p-8 text-center text-destructive font-mono bg-destructive/10 border border-destructive/20 rounded-md">Error loading blocks</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold font-mono tracking-tight uppercase">Found Blocks</h1>
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="border-b border-border/50">
          <CardTitle className="text-sm font-mono text-muted-foreground flex justify-between">
            <span>Total Pool Blocks: <span className="text-foreground">{data.total}</span></span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <div ref={containerRef} onKeyDown={handleKeyDown}>
            <Table>
              <TableHeader>
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className="font-mono text-muted-foreground font-bold">Height</TableHead>
                  <TableHead className="font-mono text-muted-foreground font-bold">Finder</TableHead>
                  <TableHead className="font-mono text-muted-foreground font-bold">Mode</TableHead>
                  <TableHead className="font-mono text-muted-foreground font-bold">Reward</TableHead>
                  <TableHead className="font-mono text-muted-foreground font-bold">Hash</TableHead>
                  <TableHead className="font-mono text-muted-foreground font-bold">Status</TableHead>
                  <TableHead className="font-mono text-muted-foreground font-bold text-right">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.blocks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center p-8 font-mono text-muted-foreground">
                      No blocks found yet. Keep mining!
                    </TableCell>
                  </TableRow>
                ) : (
                  data.blocks.map((block, i) => (
                    <TableRow
                      key={block.id}
                      data-list-item
                      tabIndex={0}
                      className="border-border/50 hover:bg-muted/50 transition-colors focus:bg-muted/60 focus:outline-none"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') renderBlockCard(block);
                        if (e.key === '1') openUrl(`${EXPLORER_URL}${block.hash}`);
                        if (e.key === '2') { navigate(`/miners/${block.finderAddress}`); close(); }
                      }}
                    >
                      <TableCell className="font-mono font-bold">
                        {block.height}
                      </TableCell>
                      <TableCell className="font-mono">
                        <Link href={`/miners/${block.finderAddress}`} className="text-primary hover:underline">
                          {truncateAddress(block.finderAddress)}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] font-mono uppercase ${block.mode === 'solo' ? 'border-primary/50 text-primary' : ''}`}>
                          {block.mode}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono">
                        {formatCurrency(block.reward)} LBTC
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {truncateAddress(block.hash)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] uppercase font-mono ${block.confirmed ? 'bg-green-900/40 text-green-400 border-green-700' : 'bg-orange-900/40 text-orange-400 border-orange-700'}`}>
                          {block.confirmed ? 'Confirmed' : 'Pending'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground" title={formatDateTime(block.foundAt)}>
                        {formatRelativeTime(block.foundAt)}
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
