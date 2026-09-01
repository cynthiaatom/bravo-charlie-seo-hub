import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Copy, Plus, PlugZap } from "lucide-react";
import { toast } from "sonner";
import { getProjects } from "@/serverFunctions/projects";
import {
  createBravoCharlieClient,
  getBravoCharlieClients,
  issueBravoCharlieWpRegistrationCode,
} from "@/serverFunctions/bravo-charlie";

export const Route = createFileRoute("/_app/clients")({ component: ClientsPage });

function ClientsPage() {
  const queryClient = useQueryClient();
  const clientsQuery = useQuery({ queryKey: ["bravo-charlie", "clients"], queryFn: () => getBravoCharlieClients() });
  const projectsQuery = useQuery({ queryKey: ["projects"], queryFn: () => getProjects() });
  const [name, setName] = React.useState("");
  const [projectId, setProjectId] = React.useState("");
  const [registration, setRegistration] = React.useState<{ clientId: string; code: string; expiresAt: string } | null>(null);

  const createMutation = useMutation({
    mutationFn: () => createBravoCharlieClient({ data: { name, projectId } }),
    onSuccess: async () => {
      setName("");
      setProjectId("");
      await queryClient.invalidateQueries({ queryKey: ["bravo-charlie", "clients"] });
      toast.success("Client created");
    },
    onError: () => toast.error("Could not create client"),
  });

  const registrationMutation = useMutation({
    mutationFn: (input: { clientId: string; projectId: string }) => issueBravoCharlieWpRegistrationCode({ data: input }),
    onSuccess: (data, variables) => setRegistration({ clientId: variables.clientId, code: data.code, expiresAt: data.expiresAt }),
    onError: () => toast.error("Could not create registration code"),
  });

  const clients = clientsQuery.data ?? [];
  const projects = projectsQuery.data ?? [];
  const assignedProjects = new Set(clients.flatMap((client) => client.project ? [client.project.id] : []));
  const availableProjects = projects.filter((project) => !assignedProjects.has(project.id));

  return (
    <div className="h-full overflow-auto bg-base-100 px-4 py-8 pb-24 md:px-6 md:py-12 md:pb-8">
      <div className="mx-auto w-full max-w-5xl space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><Building2 className="size-6" /> Bravo Charlie Clients</h1>
            <p className="mt-1 text-sm text-base-content/60">Agency clients mapped to OpenSEO projects and connected WordPress sites.</p>
          </div>
        </div>

        <section className="rounded-xl border border-base-300 bg-base-100 p-4">
          <h2 className="font-semibold">Add client</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <input className="input input-bordered w-full" placeholder="Client name" value={name} onChange={(event) => setName(event.target.value)} />
            <select className="select select-bordered w-full" value={projectId} onChange={(event) => setProjectId(event.target.value)}>
              <option value="">Choose OpenSEO project</option>
              {availableProjects.map((project) => <option key={project.id} value={project.id}>{project.name}{project.domain ? ` — ${project.domain}` : ""}</option>)}
            </select>
            <button className="btn btn-primary" disabled={!name.trim() || !projectId || createMutation.isPending} onClick={() => createMutation.mutate()}><Plus className="size-4" /> Add client</button>
          </div>
        </section>

        <section className="space-y-3">
          {clientsQuery.isLoading ? <div className="flex justify-center py-10"><span className="loading loading-spinner loading-md" /></div> : null}
          {!clientsQuery.isLoading && clients.length === 0 ? <div className="rounded-xl border border-dashed border-base-300 p-10 text-center text-sm text-base-content/60">No Bravo Charlie clients yet.</div> : null}
          {clients.map((client) => (
            <article key={client.id} className="rounded-xl border border-base-300 p-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2"><h2 className="truncate text-lg font-semibold">{client.name}</h2><span className="badge badge-ghost badge-sm">{client.status}</span></div>
                  <p className="mt-1 text-sm text-base-content/60">{client.project ? `${client.project.name}${client.project.domain ? ` · ${client.project.domain}` : ""}` : "No project linked"}</p>
                  {client.wordpress ? (
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span className="badge badge-success badge-outline">WordPress connected</span>
                      <span className="badge badge-ghost">SEO health {client.wordpress.healthScore ?? "—"}</span>
                      <span className="badge badge-ghost">404s {client.wordpress.error404Hits}</span>
                      <span className="badge badge-ghost">CWV {client.wordpress.cwvAssessment ?? "unknown"}</span>
                    </div>
                  ) : <p className="mt-3 text-xs text-base-content/50">WordPress not connected yet.</p>}
                </div>
                {client.project ? <button className="btn btn-outline btn-sm" disabled={registrationMutation.isPending} onClick={() => registrationMutation.mutate({ clientId: client.id, projectId: client.project!.id })}><PlugZap className="size-4" /> Add WordPress site</button> : null}
              </div>

              {registration?.clientId === client.id ? (
                <div className="mt-4 rounded-lg bg-base-200 p-3">
                  <div className="text-xs font-medium uppercase tracking-wide text-base-content/50">One-time registration code</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2"><code className="rounded bg-base-100 px-3 py-2 text-base font-semibold">{registration.code}</code><button className="btn btn-ghost btn-sm" onClick={() => { void navigator.clipboard.writeText(registration.code); toast.success("Code copied"); }}><Copy className="size-4" /> Copy</button></div>
                  <p className="mt-2 text-xs text-base-content/50">Expires {new Date(registration.expiresAt).toLocaleString()}. Enter it in Bravo Charlie SEO on the WordPress site.</p>
                </div>
              ) : null}
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}
