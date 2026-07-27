import type { QueryKey, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import type { BlockList, HealthStatus, ListBlocksParams, ListMinersParams, ListPayoutsParams, MinerList, MinerStats, PayoutList, PoolConfig, PoolDashboard, PoolStats, ShareList } from './api.schemas';
import { customFetch } from '../custom-fetch';
type AwaitedInput<T> = PromiseLike<T> | T;
type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;
type SecondParameter<T extends (...args: never) => unknown> = Parameters<T>[1];
export declare const getHealthCheckUrl: () => string;
/**
 * Returns server health status
 * @summary Health check
 */
export declare const healthCheck: (options?: RequestInit) => Promise<HealthStatus>;
export declare const getHealthCheckQueryKey: () => readonly ["/api/healthz"];
export declare const getHealthCheckQueryOptions: <TData = Awaited<ReturnType<typeof healthCheck>>, TError = unknown>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData> & {
    queryKey: QueryKey;
};
export type HealthCheckQueryResult = NonNullable<Awaited<ReturnType<typeof healthCheck>>>;
export type HealthCheckQueryError = unknown;
/**
 * @summary Health check
 */
export declare function useHealthCheck<TData = Awaited<ReturnType<typeof healthCheck>>, TError = unknown>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetPoolStatsUrl: () => string;
/**
 * @summary Get overall pool statistics
 */
export declare const getPoolStats: (options?: RequestInit) => Promise<PoolStats>;
export declare const getGetPoolStatsQueryKey: () => readonly ["/api/pool/stats"];
export declare const getGetPoolStatsQueryOptions: <TData = Awaited<ReturnType<typeof getPoolStats>>, TError = unknown>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPoolStats>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getPoolStats>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetPoolStatsQueryResult = NonNullable<Awaited<ReturnType<typeof getPoolStats>>>;
export type GetPoolStatsQueryError = unknown;
/**
 * @summary Get overall pool statistics
 */
export declare function useGetPoolStats<TData = Awaited<ReturnType<typeof getPoolStats>>, TError = unknown>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPoolStats>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetPoolDashboardUrl: () => string;
/**
 * @summary Get combined dashboard data (stats + recent blocks + recent payouts)
 */
export declare const getPoolDashboard: (options?: RequestInit) => Promise<PoolDashboard>;
export declare const getGetPoolDashboardQueryKey: () => readonly ["/api/pool/dashboard"];
export declare const getGetPoolDashboardQueryOptions: <TData = Awaited<ReturnType<typeof getPoolDashboard>>, TError = unknown>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPoolDashboard>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getPoolDashboard>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetPoolDashboardQueryResult = NonNullable<Awaited<ReturnType<typeof getPoolDashboard>>>;
export type GetPoolDashboardQueryError = unknown;
/**
 * @summary Get combined dashboard data (stats + recent blocks + recent payouts)
 */
export declare function useGetPoolDashboard<TData = Awaited<ReturnType<typeof getPoolDashboard>>, TError = unknown>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPoolDashboard>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetPoolConfigUrl: () => string;
/**
 * @summary Get pool connection config (stratum host, ports, fees)
 */
export declare const getPoolConfig: (options?: RequestInit) => Promise<PoolConfig>;
export declare const getGetPoolConfigQueryKey: () => readonly ["/api/pool/config"];
export declare const getGetPoolConfigQueryOptions: <TData = Awaited<ReturnType<typeof getPoolConfig>>, TError = unknown>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPoolConfig>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getPoolConfig>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetPoolConfigQueryResult = NonNullable<Awaited<ReturnType<typeof getPoolConfig>>>;
export type GetPoolConfigQueryError = unknown;
/**
 * @summary Get pool connection config (stratum host, ports, fees)
 */
export declare function useGetPoolConfig<TData = Awaited<ReturnType<typeof getPoolConfig>>, TError = unknown>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPoolConfig>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getListBlocksUrl: (params?: ListBlocksParams) => string;
/**
 * @summary List found blocks
 */
export declare const listBlocks: (params?: ListBlocksParams, options?: RequestInit) => Promise<BlockList>;
export declare const getListBlocksQueryKey: (params?: ListBlocksParams) => readonly ["/api/pool/blocks", ...ListBlocksParams[]];
export declare const getListBlocksQueryOptions: <TData = Awaited<ReturnType<typeof listBlocks>>, TError = unknown>(params?: ListBlocksParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listBlocks>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listBlocks>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListBlocksQueryResult = NonNullable<Awaited<ReturnType<typeof listBlocks>>>;
export type ListBlocksQueryError = unknown;
/**
 * @summary List found blocks
 */
export declare function useListBlocks<TData = Awaited<ReturnType<typeof listBlocks>>, TError = unknown>(params?: ListBlocksParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listBlocks>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getListPayoutsUrl: (params?: ListPayoutsParams) => string;
/**
 * @summary List recent payouts
 */
export declare const listPayouts: (params?: ListPayoutsParams, options?: RequestInit) => Promise<PayoutList>;
export declare const getListPayoutsQueryKey: (params?: ListPayoutsParams) => readonly ["/api/pool/payouts", ...ListPayoutsParams[]];
export declare const getListPayoutsQueryOptions: <TData = Awaited<ReturnType<typeof listPayouts>>, TError = unknown>(params?: ListPayoutsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listPayouts>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listPayouts>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListPayoutsQueryResult = NonNullable<Awaited<ReturnType<typeof listPayouts>>>;
export type ListPayoutsQueryError = unknown;
/**
 * @summary List recent payouts
 */
export declare function useListPayouts<TData = Awaited<ReturnType<typeof listPayouts>>, TError = unknown>(params?: ListPayoutsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listPayouts>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getListMinersUrl: (params?: ListMinersParams) => string;
/**
 * @summary List all active miners
 */
export declare const listMiners: (params?: ListMinersParams, options?: RequestInit) => Promise<MinerList>;
export declare const getListMinersQueryKey: (params?: ListMinersParams) => readonly ["/api/pool/miners", ...ListMinersParams[]];
export declare const getListMinersQueryOptions: <TData = Awaited<ReturnType<typeof listMiners>>, TError = unknown>(params?: ListMinersParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listMiners>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listMiners>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListMinersQueryResult = NonNullable<Awaited<ReturnType<typeof listMiners>>>;
export type ListMinersQueryError = unknown;
/**
 * @summary List all active miners
 */
export declare function useListMiners<TData = Awaited<ReturnType<typeof listMiners>>, TError = unknown>(params?: ListMinersParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listMiners>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetMinerUrl: (address: string) => string;
/**
 * @summary Get miner stats by address
 */
export declare const getMiner: (address: string, options?: RequestInit) => Promise<MinerStats>;
export declare const getGetMinerQueryKey: (address: string) => readonly [`/api/pool/miners/${string}`];
export declare const getGetMinerQueryOptions: <TData = Awaited<ReturnType<typeof getMiner>>, TError = void>(address: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getMiner>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getMiner>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetMinerQueryResult = NonNullable<Awaited<ReturnType<typeof getMiner>>>;
export type GetMinerQueryError = void;
/**
 * @summary Get miner stats by address
 */
export declare function useGetMiner<TData = Awaited<ReturnType<typeof getMiner>>, TError = void>(address: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getMiner>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetMinerPayoutsUrl: (address: string) => string;
/**
 * @summary Get payout history for a specific miner
 */
export declare const getMinerPayouts: (address: string, options?: RequestInit) => Promise<PayoutList>;
export declare const getGetMinerPayoutsQueryKey: (address: string) => readonly [`/api/pool/miners/${string}/payouts`];
export declare const getGetMinerPayoutsQueryOptions: <TData = Awaited<ReturnType<typeof getMinerPayouts>>, TError = unknown>(address: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getMinerPayouts>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getMinerPayouts>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetMinerPayoutsQueryResult = NonNullable<Awaited<ReturnType<typeof getMinerPayouts>>>;
export type GetMinerPayoutsQueryError = unknown;
/**
 * @summary Get payout history for a specific miner
 */
export declare function useGetMinerPayouts<TData = Awaited<ReturnType<typeof getMinerPayouts>>, TError = unknown>(address: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getMinerPayouts>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetMinerSharesUrl: (address: string) => string;
/**
 * @summary Get recent share history for a miner
 */
export declare const getMinerShares: (address: string, options?: RequestInit) => Promise<ShareList>;
export declare const getGetMinerSharesQueryKey: (address: string) => readonly [`/api/pool/miners/${string}/shares`];
export declare const getGetMinerSharesQueryOptions: <TData = Awaited<ReturnType<typeof getMinerShares>>, TError = unknown>(address: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getMinerShares>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getMinerShares>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetMinerSharesQueryResult = NonNullable<Awaited<ReturnType<typeof getMinerShares>>>;
export type GetMinerSharesQueryError = unknown;
/**
 * @summary Get recent share history for a miner
 */
export declare function useGetMinerShares<TData = Awaited<ReturnType<typeof getMinerShares>>, TError = unknown>(address: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getMinerShares>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export {};
