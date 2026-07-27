import { useGetPoolConfig } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Start() {
  const { data: config, isLoading, error } = useGetPoolConfig();
  const { toast } = useToast();

  const copyText = (text: string, title: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: `${title} Copied`,
      description: "Copied to clipboard.",
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold font-mono tracking-tight uppercase">Getting Started</h1>
        <Skeleton className="h-48 w-full bg-card" />
        <Skeleton className="h-64 w-full bg-card" />
      </div>
    );
  }

  if (error || !config) {
    return <div className="p-8 text-center text-destructive font-mono bg-destructive/10 border border-destructive/20 rounded-md">Error loading pool config</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold font-mono tracking-tight uppercase">Connect Your Miner</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-card border-border">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="text-lg font-mono">Pool Connection (PPLNS)</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <p className="text-sm text-muted-foreground font-mono">
              Standard pool mining. Rewards are split proportionally based on shares submitted.
            </p>
            <div className="bg-muted p-4 rounded-md flex items-center justify-between group">
              <code className="font-mono text-sm text-primary">
                stratum+tcp://{config.stratumHost}:{config.pplnsPort}
              </code>
              <button 
                onClick={() => copyText(`stratum+tcp://${config.stratumHost}:${config.pplnsPort}`, "PPLNS URL")}
                className="text-muted-foreground hover:text-primary transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="text-lg font-mono">Solo Connection</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <p className="text-sm text-muted-foreground font-mono">
              Solo mining. You keep the full block reward if your miner finds a block.
            </p>
            <div className="bg-muted p-4 rounded-md flex items-center justify-between group">
              <code className="font-mono text-sm text-primary">
                stratum+tcp://{config.stratumHost}:{config.soloPort}
              </code>
              <button 
                onClick={() => copyText(`stratum+tcp://${config.stratumHost}:${config.soloPort}`, "SOLO URL")}
                className="text-muted-foreground hover:text-primary transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="text-lg font-mono uppercase">Miner Configuration (cpuminer)</CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          <div className="space-y-2">
            <h3 className="font-mono font-bold text-sm">Example cpuminer-opt command (PPLNS)</h3>
            <div className="bg-background border border-border p-4 rounded-md relative group">
              <code className="font-mono text-sm text-muted-foreground block whitespace-pre-wrap break-all">
                cpuminer-opt -a {config.algorithm} -o stratum+tcp://{config.stratumHost}:{config.pplnsPort} -u YOUR_LBTC_ADDRESS.worker_name -p x
              </code>
              <button 
                onClick={() => copyText(`cpuminer-opt -a ${config.algorithm} -o stratum+tcp://${config.stratumHost}:${config.pplnsPort} -u YOUR_LBTC_ADDRESS.worker_name -p x`, "Command")}
                className="absolute top-4 right-4 text-muted-foreground hover:text-primary transition-colors opacity-0 group-hover:opacity-100 cursor-pointer bg-background p-1 rounded-sm shadow-sm"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-mono font-bold text-sm">Pool Settings</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-muted/50 p-3 rounded border border-border/50">
                <div className="text-xs font-mono text-muted-foreground uppercase mb-1">Coin</div>
                <div className="font-mono font-bold">{config.coin} ({config.ticker})</div>
              </div>
              <div className="bg-muted/50 p-3 rounded border border-border/50">
                <div className="text-xs font-mono text-muted-foreground uppercase mb-1">Algorithm</div>
                <div className="font-mono font-bold">{config.algorithm}</div>
              </div>
              <div className="bg-muted/50 p-3 rounded border border-border/50">
                <div className="text-xs font-mono text-muted-foreground uppercase mb-1">Fee</div>
                <div className="font-mono font-bold">{config.devFeePercent}%</div>
              </div>
              <div className="bg-muted/50 p-3 rounded border border-border/50">
                <div className="text-xs font-mono text-muted-foreground uppercase mb-1">Min Payout</div>
                <div className="font-mono font-bold">{config.payoutThreshold} {config.ticker}</div>
              </div>
            </div>
          </div>

          <div className="bg-primary/10 border border-primary/20 p-4 rounded-md">
            <h4 className="font-mono font-bold text-primary mb-2">Important Notes</h4>
            <ul className="list-disc list-inside font-mono text-sm text-muted-foreground space-y-1 ml-4">
              <li>Use your exact LegacyCoin (LBTC) wallet address as the username.</li>
              <li>Append your worker name to the address separated by a dot (e.g. <code className="text-primary bg-background px-1 py-0.5 rounded text-xs">LbtcAddress123.worker1</code>).</li>
              <li>Password field (-p) is ignored but traditionally set to 'x'.</li>
              <li>Payouts run automatically when your pending balance reaches {config.payoutThreshold} {config.ticker}.</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
