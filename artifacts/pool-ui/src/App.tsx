import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CardProvider } from "@/hooks/use-card";
import { Layout } from "@/components/layout";
import Dashboard from "@/pages/dashboard";
import Miners from "@/pages/miners";
import MinerDetail from "@/pages/miner-detail";
import Blocks from "@/pages/blocks";
import Payouts from "@/pages/payouts";
import Start from "@/pages/start";
import Admin from "@/pages/admin";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/miners" component={Miners} />
      <Route path="/miners/:address" component={MinerDetail} />
      <Route path="/blocks" component={Blocks} />
      <Route path="/payouts" component={Payouts} />
      <Route path="/start" component={Start} />
      <Route path="/admin" component={Admin} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <CardProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Layout>
              <Router />
            </Layout>
          </WouterRouter>
        </CardProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
