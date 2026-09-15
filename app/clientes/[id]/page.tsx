import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

type Row = Record<string, unknown>;

export default async function ClienteDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: client, error: clientError } = await supabase
    .from("clients_with_responsible")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (clientError) {
    throw new Error(`No se pudo cargar el cliente: ${clientError.message}`);
  }

  if (!client) {
    notFound();
  }

  const related = await Promise.allSettled([
    supabase
      .from("documents")
      .select("*")
      .eq("client_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("tickets")
      .select("*")
      .eq("client_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("service_requests")
      .select("*")
      .eq("client_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("payments")
      .select("*")
      .eq("client_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const rowsAt = (index: number): Row[] => {
    const result = related[index];
    if (!result || result.status === "rejected" || result.value.error) return [];
    return (result.value.data || []) as Row[];
  };

  const documents = rowsAt(0);
  const tickets = rowsAt(1);
  const serviceRequests = rowsAt(2);
  const payments = rowsAt(3);

  const hasPartialFailure = related.some(
    (result) => result.status === "rejected" || Boolean(result.value.error)
  );

  return (
    <AppShell>
      <main className="space-y-6 p-6">
        {hasPartialFailure ? (
          <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100">
            El cliente cargó, pero una sección relacionada no respondió. Puedes reintentar la página sin perder información.
          </div>
        ) : null}

        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold">{String(client.name || "Cliente")}</h1>
          <p className="text-sm text-slate-500">
            {String(client.email || "Sin correo")} · {String(client.phone || "Sin teléfono")}
          </p>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <Info label="Tipo" value={client.client_type} />
            <Info label="Estado" value={client.status} />
            <Info label="Responsable" value={client.responsible_name || "Sin responsable"} />
            <Info label="WhatsApp" value={client.whatsapp} />
            <Info label="Documento / RNC" value={client.document_id} />
            <Info label="Dirección" value={client.address} />
          </div>

          {client.notes ? (
            <div className="mt-4 rounded-xl bg-slate-50 p-4">
              <p className="text-sm font-semibold">Notas</p>
              <p className="mt-1 text-sm text-slate-600">{String(client.notes)}</p>
            </div>
          ) : null}
        </section>

        <Section title="Servicios solicitados">
          {serviceRequests.length ? (
            serviceRequests.map((item) => (
              <Card key={String(item.id)}>
                <p className="font-medium">{String(item.title || item.service_name || "Solicitud")}</p>
                <p className="text-sm text-slate-500">Estado: {String(item.status || "sin estado")}</p>
              </Card>
            ))
          ) : (
            <Empty text="Este cliente todavía no tiene servicios solicitados." />
          )}
        </Section>

        <Section title="Documentos">
          {documents.length ? (
            documents.map((doc) => (
              <Card key={String(doc.id)}>
                <p className="font-medium">{String(doc.name || doc.title || "Documento")}</p>
                <p className="text-sm text-slate-500">Estado: {String(doc.status || "sin estado")}</p>
              </Card>
            ))
          ) : (
            <Empty text="No hay documentos subidos para este cliente." />
          )}
        </Section>

        <Section title="Tickets">
          {tickets.length ? (
            tickets.map((ticket) => (
              <Card key={String(ticket.id)}>
                <p className="font-medium">{String(ticket.subject || ticket.title || "Ticket")}</p>
                <p className="text-sm text-slate-500">Estado: {String(ticket.status || "sin estado")}</p>
              </Card>
            ))
          ) : (
            <Empty text="Este cliente no tiene tickets abiertos." />
          )}
        </Section>

        <Section title="Pagos">
          {payments.length ? (
            payments.map((payment) => (
              <Card key={String(payment.id)}>
                <p className="font-medium">RD$ {String(payment.amount || 0)}</p>
                <p className="text-sm text-slate-500">Estado: {String(payment.status || "sin estado")}</p>
              </Card>
            ))
          ) : (
            <Empty text="No hay pagos registrados para este cliente." />
          )}
        </Section>
      </main>
    </AppShell>
  );
}

function Info({ label, value }: { label: string; value?: unknown }) {
  return (
    <div className="rounded-xl border p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value ? String(value) : "-"}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-bold">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border p-4">{children}</div>;
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-slate-500">{text}</p>;
}
