import * as React from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Copy, ExternalLink, PlugZap, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  createBravoCharlieClient,
  getBravoCharlieClients,
  issueBravoCharlieWpRegistrationCode,
} from "@/serverFunctions/bravo-charlie";
import { getProjects } from "@/serverFunctions/projects";
import { getStandardErrorMessage } from "@/client/lib/error-messages";

export const Route = createFileRoute("/_app/clients")({
  component: BravoCharlieClientsPage,
});

type RegistrationCode = {
  clientId: string;
  projectId: string;
  code: string;
  expiresAt: string;
};

function BravoCharlieClientsPage() {
  const queryClient = useQueryClient();
  const [creating, setCreating] = React.useState(false);
  const [registration, setRegistration] =
    React.useState<RegistrationCode | null>(null);

  const clientsQuery = useQuery({
    queryKey: ["bravo-charlie", "clients"],
    queryFn: () => getBravoCharlieClients(),
  });
  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: () => getProjects(),
  });

  const issueCode = useMutation({
    mutationFn: (input: { clientId: string; projectId: string }) =>
      issueBravoCharlieWpRegistrationCode({ data: input }),
    onSuccess: (data, variables) => {
      setRegistration({ ...variables, ...data });
    },
    onError: (error) =>
      toast.error(
        getStandardErrorMessage(error, "Could not create registration code"),
      ),
  });

  const clients = clientsQuery.data ?? [];
  const assignedProjectIds = new Set(
    clients.map((client) => client.project?.id).filter(Boolean),
  );
  const availableProjects = (projectsQuery.data ?? []).filter(
    (project) => !assignedProjectIds.has(project.id),
  );

  return (
    <div className="h-full overflow-auto bg-base-100 px-4 py-8 pb-24 md:px-6 md:py-12 md:pb-8">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="size-6 text-primary" />
              <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
            </div>
            <p className="mt-1 max-w-2xl text-sm text-base-content/60">
              Bravo Charlie's agency registry. Each client maps to an OpenSEO
              project and can connect one WordPress site in Hub M1.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setCreating(true)}
            disabled={availableProjects.length === 0}
          >
            <Plus className="size-4" /> New client
          </button>
        </div>

        {clientsQuery.isLoading ? (
          <div className="flex justify-center py-16">
            <span className="loading loading-spinner loading-md" />
          </div>
        ) : clients.length === 0 ? (
          <div className="rounded-xl border border-dashed border-base-300 p-10 text-center">
            <h2 className="font-semibold">No Bravo Charlie clients yet</h2>
            <p className="mt-1 text-sm text-base-content/60">
              Create an OpenSEO project first, then attach it to a client here.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {clients.map((client) => (
              <article
                key={client.id}
                className="rounded-xl border border-base-300 bg-base-100 p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-semibold">
                      {client.name}
                    </h2>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-base-content/60">
                      <span className="badge badge-ghost badge-sm">
                        {client.status}
                      </span>
                      {client.project?.domain ? (
                        <span>{client.project.domain}</span>
                      ) : null}
                    </div>
                  </div>
                  {client.project ? (
                    <Link
                      to="/p/$projectId"
                      params={{ projectId: client.project.id }}
                      className="btn btn-ghost btn-xs"
                    >
                      Open SEO <ExternalLink className="size-3" />
                    </Link>
                  ) : null}
                </div>

                <div className="mt-5 grid grid-cols-3 gap-2 rounded-lg bg-base-200/60 p-3 text-center">
                  <Metric
                    label="SEO health"
                    value={
                      client.wordpress?.healthScore == null
                        ? "—"
                        : `${client.wordpress.healthScore}/100`
                    }
                  />
                  <Metric
                    label="404 hits"
                    value={String(client.wordpress?.error404Hits ?? 0)}
                  />
                  <Metric
                    label="Core Web Vitals"
                    value={client.wordpress?.cwvAssessment ?? "Waiting"}
                  />
                </div>

                <div className="mt-4 border-t border-base-300 pt-4">
                  {client.wordpress ? (
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2 font-medium">
                        <PlugZap className="size-4 text-success" />
                        WordPress connected
                      </div>
                      <a
                        href={client.wordpress.siteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="link link-hover block truncate text-xs text-base-content/60"
                      >
                        {client.wordpress.siteUrl}
                      </a>
                      <p className="text-xs text-base-content/50">
                        Plugin {client.wordpress.pluginVersion}
                        {client.wordpress.lastHeartbeatAt
                          ? ` · last seen ${new Date(
                              client.wordpress.lastHeartbeatAt,
                            ).toLocaleString()}`
                          : " · waiting for first heartbeat"}
                      </p>
                    </div>
                  ) : client.project ? (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() =>
                        issueCode.mutate({
                          clientId: client.id,
                          projectId: client.project!.id,
                        })
                      }
                      disabled={issueCode.isPending}
                    >
                      <PlugZap className="size-4" /> Add WordPress site
                    </button>
                  ) : (
                    <p className="text-sm text-warning">
                      No OpenSEO project mapped.
                    </p>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {creating ? (
        <CreateClientModal
          projects={availableProjects}
          onClose={() => setCreating(false)}
          onCreated={async () => {
            setCreating(false);
            await queryClient.invalidateQueries({
              queryKey: ["bravo-charlie", "clients"],
            });
          }}
        />
      ) : null}

      {registration ? (
        <RegistrationCodeModal
          registration={registration}
          onClose={() => setRegistration(null)}
        />
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-xs text-base-content/50">{label}</div>
      <div className="mt-1 truncate text-sm font-semibold">{value}</div>
    </div>
  );
}

function CreateClientModal({
  projects,
  onClose,
  onCreated,
}: {
  projects: Array<{ id: string; name: string; domain: string | null }>;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [name, setName] = React.useState("");
  const [projectId, setProjectId] = React.useState(projects[0]?.id ?? "");
  const mutation = useMutation({
    mutationFn: () =>
      createBravoCharlieClient({ data: { name: name.trim(), projectId } }),
    onSuccess: async () => {
      toast.success("Client created");
      await onCreated();
    },
    onError: (error) =>
      toast.error(getStandardErrorMessage(error, "Could not create client")),
  });

  return (
    <div className="modal modal-open" role="dialog" aria-modal="true">
      <div className="modal-box max-w-lg">
        <h2 className="text-lg font-semibold">New Bravo Charlie client</h2>
        <p className="mt-1 text-sm text-base-content/60">
          M1 maps one existing OpenSEO project to one client.
        </p>
        <label className="form-control mt-5">
          <span className="label-text mb-1">Client name</span>
          <input
            className="input input-bordered w-full"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
          />
        </label>
        <label className="form-control mt-4">
          <span className="label-text mb-1">OpenSEO project</span>
          <select
            className="select select-bordered w-full"
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
                {project.domain ? ` — ${project.domain}` : ""}
              </option>
            ))}
          </select>
        </label>
        <div className="modal-action">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={name.trim().length < 2 || !projectId || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            Create client
          </button>
        </div>
      </div>
      <button className="modal-backdrop" type="button" onClick={onClose}>
        Close
      </button>
    </div>
  );
}

function RegistrationCodeModal({
  registration,
  onClose,
}: {
  registration: RegistrationCode;
  onClose: () => void;
}) {
  const copy = async () => {
    await navigator.clipboard.writeText(registration.code);
    toast.success("Registration code copied");
  };

  return (
    <div className="modal modal-open" role="dialog" aria-modal="true">
      <div className="modal-box max-w-lg">
        <h2 className="text-lg font-semibold">Connect WordPress</h2>
        <p className="mt-2 text-sm text-base-content/60">
          In WordPress → BC SEO → Hub Registration, enter this one-time code. It
          expires at {new Date(registration.expiresAt).toLocaleString()}.
        </p>
        <div className="mt-5 flex items-center gap-2 rounded-lg bg-base-200 p-3">
          <code className="flex-1 text-center text-lg font-semibold tracking-wide">
            {registration.code}
          </code>
          <button
            type="button"
            className="btn btn-square btn-sm"
            onClick={() => void copy()}
            aria-label="Copy registration code"
          >
            <Copy className="size-4" />
          </button>
        </div>
        <div className="mt-4 rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs">
          The Hub stores only a SHA-256 hash of this code. The WordPress site
          exchanges it once for an HMAC relationship; the site secret is then
          encrypted at rest in the Hub.
        </div>
        <div className="modal-action">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
      <button className="modal-backdrop" type="button" onClick={onClose}>
        Close
      </button>
    </div>
  );
}
