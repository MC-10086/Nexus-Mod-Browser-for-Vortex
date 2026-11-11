import * as React from "react";

import { DEFAULT_PAGE_SIZE } from "../constants";
import { t } from "../i18n";
import { describeError } from "../nexus/client";
import { getNexusService } from "../nexus";
import { IModSummary, ISearchResult } from "../types";
import { Icon } from "./icons";
import { Button, Pagination } from "./primitives";

interface IUploaderModsDialogProps {
  api: any;
  domain: string;
  gameName: string;
  uploaderId: number;
  uploaderName: string;
  blocked: boolean;
  busyMods: number[];
  onClose: () => void;
  onDownload: (mod: IModSummary) => void;
  onViewPage: (mod: IModSummary) => void;
  onDetails: (mod: IModSummary) => void;
}

export default function UploaderModsDialog(props: IUploaderModsDialogProps) {
  const { api, domain, gameName, uploaderId, uploaderName, blocked, busyMods, onClose } = props;
  const [request, setRequest] = React.useState({ page: 1 });
  const [response, setResponse] = React.useState<{
    request: { page: number };
    result?: ISearchResult;
    error?: string;
  } | undefined>(undefined);
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const closeRef = React.useRef(onClose);
  closeRef.current = onClose;

  React.useEffect(() => {
    let cancelled = false;
    getNexusService(api).search({
      domain,
      uploaderId,
      query: "",
      sortField: "updatedAt",
      offset: (request.page - 1) * DEFAULT_PAGE_SIZE,
      count: DEFAULT_PAGE_SIZE,
    }).then((result) => {
      if (!cancelled) {
        setResponse({ request, result });
      }
    }).catch((err) => {
      if (!cancelled) {
        setResponse({ request, error: describeError(err) });
      }
    });
    scrollRef.current?.scrollTo({ top: 0 });
    return () => { cancelled = true; };
  }, [api, domain, uploaderId, request]);

  React.useEffect(() => {
    if (blocked || typeof document === "undefined") {
      return;
    }
    const onKeyDown = (evt: KeyboardEvent) => {
      if (evt.key === "Escape" && !evt.defaultPrevented) {
        evt.preventDefault();
        closeRef.current();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [blocked]);

  const current = response?.request === request ? response : undefined;
  const result = current?.result;
  const totalPages = Math.ceil((result?.totalCount ?? 0) / DEFAULT_PAGE_SIZE);
  const title = t("uploader.title", { name: uploaderName });

  return (
    <div
      className="nxm-modal nxm-modal-xl"
      ref={(element: HTMLDivElement | null) => { if (element !== null) { element.inert = blocked; } }}
      role="dialog"
      aria-modal={!blocked}
      aria-hidden={blocked || undefined}
      aria-label={title}
      data-testid="uploader-mods-dialog"
    >
      <div className="nxm-modal-overlay" onClick={blocked ? undefined : onClose} />
      <div className="nxm-modal-panel flex flex-col" style={{ maxHeight: "85vh", overflow: "hidden" }}>
        <button
          type="button"
          className="nxm-modal-close"
          aria-label={t("common.close")}
          title={t("common.close")}
          onClick={onClose}
        >
          <Icon name="close" size={5} />
        </button>
        <div className="shrink-0" style={{ paddingRight: 40 }}>
          <p className="nxm-modal-title" style={{ marginBottom: 4 }}>{title}</p>
          <p className="text-body-xs text-neutral-subdued">{gameName}</p>
        </div>

        <div ref={scrollRef} className="min-h-0 grow overflow-y-auto" style={{ overscrollBehavior: "contain" }}>
          {current === undefined && <p role="status" className="py-3">{t("uploader.loading")}</p>}
          {current?.error !== undefined && (
            <div className="space-y-2 py-3">
              <p role="alert" className="text-danger-strong">{current.error}</p>
              <Button brand="neutral" appearance="moderate" icon="refresh" onClick={() => setRequest({ page: request.page })}>
                {t("common.retry")}
              </Button>
            </div>
          )}
          {result?.nodes.length === 0 && <p className="py-3">{t("uploader.empty")}</p>}
          {result?.nodes.map((mod) => {
            const busy = busyMods.includes(mod.modId);
            return (
              <div key={mod.modId} className="flex flex-wrap items-start gap-x-3 border-t border-stroke-weak py-2" data-testid="uploader-mod-row">
                <div className="flex min-w-0 grow flex-col gap-y-1" style={{ flexBasis: "15rem" }}>
                  <p className="truncate font-semibold text-body-sm" title={mod.name}>{mod.name}</p>
                  {mod.version && <p className="text-body-xs text-neutral-subdued">v{mod.version}</p>}
                  {mod.summary && <p className="line-clamp-2 text-body-xs text-neutral-subdued">{mod.summary}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-x-2">
                  <Button size="sm" icon="download" disabled={busy} onClick={() => props.onDownload(mod)}>
                    {busy ? t("common.downloading") : t("common.download")}
                  </Button>
                  <Button size="sm" brand="neutral" appearance="weak" icon="openInNew" onClick={() => props.onViewPage(mod)}>
                    {t("common.viewPage")}
                  </Button>
                  <Button size="sm" brand="neutral" appearance="weak" icon="details" onClick={() => props.onDetails(mod)}>
                    {t("common.details")}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {totalPages > 1 && (
          <Pagination
            currentPage={request.page}
            totalPages={totalPages}
            onChange={(page) => { if (page !== request.page) { setRequest({ page }); } }}
            className="shrink-0 border-t border-stroke-weak pt-3"
          />
        )}
      </div>
    </div>
  );
}
