import { useMemo, useState } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { ChevronDown, ChevronUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import type { ApiLatestResponse, ApiTimeseriesPoint, ApiTimeseriesResponse } from "@/lib/api";

type TimeseriesParams = {
  device_ids: string[];
  metrics: string[];
  start: string;
  end: string;
  bucket?: string;
};

type LatestParams = {
  site_id?: string;
  device_ids?: string[];
  metrics?: string[];
};

type Props = {
  title?: string;
  enabled: boolean;
  params: TimeseriesParams;
  query: Pick<
    UseQueryResult<ApiTimeseriesResponse | null>,
    "data" | "status" | "fetchStatus" | "isFetching" | "isLoading" | "isError" | "error"
  >;
  latest?: {
    enabled: boolean;
    params: LatestParams;
    query: Pick<
      UseQueryResult<ApiLatestResponse | null>,
      "data" | "status" | "fetchStatus" | "isFetching" | "isLoading" | "isError" | "error"
    >;
  };
};

function formatIso(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("it-IT");
}

function safeIsoFromBucket(p: ApiTimeseriesPoint) {
  // ts_bucket is an ISO string (in our direct DB mapping it equals row.ts)
  return p.ts_bucket;
}

export function TimeseriesDiagnostics({ title = "Diagnostica timeseries", enabled, params, query, latest }: Props) {
  const [open, setOpen] = useState(true);

  const points = (query.data?.data ?? []) as ApiTimeseriesPoint[];

  const stats = useMemo(() => {
    const metricCounts = new Map<string, number>();
    const deviceCounts = new Map<string, number>();

    let minTs: string | null = null;
    let maxTs: string | null = null;

    for (const p of points) {
      metricCounts.set(p.metric, (metricCounts.get(p.metric) ?? 0) + 1);
      deviceCounts.set(p.device_id, (deviceCounts.get(p.device_id) ?? 0) + 1);

      const iso = safeIsoFromBucket(p);
      if (!minTs || iso < minTs) minTs = iso;
      if (!maxTs || iso > maxTs) maxTs = iso;
    }

    const metrics = Array.from(metricCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([metric, count]) => ({ metric, count }));

    const devices = Array.from(deviceCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([device_id, count]) => ({ device_id, count }));

    return {
      pointCount: points.length,
      metrics,
      devices,
      minTs,
      maxTs,
    };
  }, [points]);

  const headerBadges = (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant={enabled ? "secondary" : "destructive"}>{enabled ? "enabled" : "disabled"}</Badge>
      <Badge variant="outline">status: {query.status}</Badge>
      <Badge variant="outline">fetch: {query.fetchStatus}</Badge>
      {query.isFetching ? <Badge variant="secondary">fetching…</Badge> : null}
      {query.isError ? <Badge variant="destructive">error</Badge> : null}
      {!query.isError && enabled && query.status === "success" && stats.pointCount === 0 ? (
        <Badge variant="destructive">0 punti</Badge>
      ) : null}
      {latest?.enabled ? <Badge variant="outline">latest: {latest.query.status}</Badge> : null}
    </div>
  );

  return (
    <Card className="border-border/60">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader className="py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-base">{title}</CardTitle>
              <div className="mt-2">{headerBadges}</div>
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="shrink-0">
                {open ? (
                  <span className="inline-flex items-center gap-2">
                    Nascondi <ChevronUp className="h-4 w-4" />
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    Mostra <ChevronDown className="h-4 w-4" />
                  </span>
                )}
              </Button>
            </CollapsibleTrigger>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="text-sm font-medium">Parametri richiesta</div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>
                    device_ids: <span className="font-mono">{params.device_ids.length}</span>
                  </div>
                  <div className="break-all">
                    start: <span className="font-mono">{formatIso(params.start)}</span>
                  </div>
                  <div className="break-all">
                    end: <span className="font-mono">{formatIso(params.end)}</span>
                  </div>
                  <div>
                    bucket: <span className="font-mono">{params.bucket ?? "(none)"}</span>
                  </div>
                  <div className="break-all">
                    metrics richieste ({params.metrics.length}): <span className="font-mono">{params.metrics.join(", ")}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Risposta</div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>
                    punti: <span className="font-mono">{stats.pointCount}</span>
                    {query.data?.meta?.point_count != null ? <span className="ml-2">(meta: {query.data.meta.point_count})</span> : null}
                  </div>
                  {query.data?.meta ? (
                    <>
                      <div>
                        source: <span className="font-mono">{query.data.meta.source}</span>
                      </div>
                      <div>
                        bucket(meta): <span className="font-mono">{query.data.meta.bucket}</span>
                      </div>
                    </>
                  ) : null}
                  <div>
                    copertura: <span className="font-mono">{stats.minTs ? formatIso(stats.minTs) : "—"}</span> →{" "}
                    <span className="font-mono">{stats.maxTs ? formatIso(stats.maxTs) : "—"}</span>
                  </div>
                </div>
              </div>
            </div>

            <Separator className="my-4" />

            {latest?.enabled ? (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Latest (snapshot)</div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div>
                        status: <span className="font-mono">{latest.query.status}</span>
                        {latest.query.isFetching ? <span className="ml-2">(fetching…)</span> : null}
                      </div>
                      <div>
                        device_ids: <span className="font-mono">{latest.params.device_ids?.length ?? 0}</span>
                      </div>
                      <div>
                        metrics richieste: <span className="font-mono">{latest.params.metrics?.length ?? 0}</span>
                      </div>
                      <div>
                        righe: <span className="font-mono">{latest.query.data?.meta?.metric_count ?? 0}</span>
                      </div>
                      <div>
                        device_count: <span className="font-mono">{latest.query.data?.meta?.device_count ?? 0}</span>
                      </div>
                      <div className="break-all">
                        metriche presenti:{" "}
                        <span className="font-mono">
                          {latest.query.data?.data
                            ? Array.from(
                                new Set(
                                  Object.values(latest.query.data.data)
                                    .flat()
                                    .map((m) => m.metric)
                                )
                              )
                                .slice(0, 20)
                                .join(", ") || "—"
                            : "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Errori</div>
                    <div className="text-xs text-muted-foreground break-words">
                      {latest.query.isError ? String(latest.query.error) : "—"}
                    </div>
                  </div>
                </div>

                <Separator className="my-4" />
              </>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="text-sm font-medium">Metriche presenti (dopo normalizzazione)</div>
                {stats.metrics.length === 0 ? (
                  <div className="text-xs text-muted-foreground">—</div>
                ) : (
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {stats.metrics.map((m) => (
                      <li key={m.metric} className="flex items-center justify-between gap-2">
                        <span className="font-mono break-all">{m.metric}</span>
                        <span className="font-mono">{m.count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">Dispositivi presenti</div>
                {stats.devices.length === 0 ? (
                  <div className="text-xs text-muted-foreground">—</div>
                ) : (
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {stats.devices.slice(0, 10).map((d) => (
                      <li key={d.device_id} className="flex items-center justify-between gap-2">
                        <span className="font-mono break-all">{d.device_id}</span>
                        <span className="font-mono">{d.count}</span>
                      </li>
                    ))}
                    {stats.devices.length > 10 ? (
                      <li className="text-xs text-muted-foreground">… altri {stats.devices.length - 10}</li>
                    ) : null}
                  </ul>
                )}
              </div>
            </div>

            {query.isError ? (
              <>
                <Separator className="my-4" />
                <div className="text-xs text-destructive break-words">{String(query.error)}</div>
              </>
            ) : null}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
