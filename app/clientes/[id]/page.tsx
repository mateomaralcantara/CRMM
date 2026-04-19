import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

export default async function ClienteDetallePage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();

  const { data: client } = await supabase
    .from("clients_with_responsible")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!client) {
    notFound();
  }

  const { data: documents } = await supabase
    .from("documents")
    .select("*")
    .eq("client_id", params.id)
    .order("created_at", { ascending: false });

  const { data: tickets } = await supabase
    .from("tickets")
    .select("*")
    .eq("client_id", params.id)
    .order("created_at", { ascending: false });

  const { data: serviceRequests } = await supabase
    .from("service_requests")
    .select("*")
    .eq("client_id", params.id)
    .order("created_at", { ascending: false });

  const { data: payments } = await supabase
    .from("payments")
    .select("*")
    .eq("client_id", params.id)
    .order("created_at", { ascending: false });

  return (
    <AppShell>
      <main className="space-y-6 p-6">
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold">{client.name}</h1>
          <p className="text-sm text-slate-500">
            {client.email || "Sin correo"} · {client.phone || "Sin teléfono"}
          </p>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <Info label="Tipo" value={client.client_type} />
            <Info label="Estado" value={client.status} />
            <Info
              label="Responsable"
              value={client.responsible_name || "Sin responsable"}
            />
            <Info label="WhatsApp" value={client.whatsapp} />
            <Info label="Documento / RNC" value={client.document_id} />
            <Info label="Dirección" value={client.address} />
          </div>

          {client.notes && (
            <div className="mt-4 rounded-xl bg-slate-50 p-4">
              <p className="text-sm font-semibold">Notas</p>
              <p className="mt-1 text-sm text-slate-600">{client.notes}</p>
            </div>
          )}
        </section>

        <Section title="Servicios solicitados">
          {serviceRequests?.length ? (
            serviceRequests.map((item) => (
              <Card key={item.id}>
                <p className="font-medium">
                  {item.title || item.service_name || "Solicitud"}
                </p>
                <p className="text-sm text-slate-500">
                  Estado: {item.status || "sin estado"}
                </p>
              </Card>
            ))
          ) : (
            <Empty text="Este cliente todavía no tiene servicios solicitados." />
          )}
        </Section>

        <Section title="Documentos">
          {documents?.length ? (
            documents.map((doc) => (
              <Card key={doc.id}>
                <p className="font-medium">
                  {doc.name || doc.title || "Documento"}
                </p>
                <p className="text-sm text-slate-500">
                  Estado: {doc.status || "sin estado"}
                </p>
              </Card>
            ))
          ) : (
            <Empty text="No hay documentos subidos para este cliente." />
          )}
        </Section>

        <Section title="Tickets">
          {tickets?.length ? (
            tickets.map((ticket) => (
              <Card key={ticket.id}>
                <p className="font-medium">
                  {ticket.subject || ticket.title || "Ticket"}
                </p>
                <p className="text-sm text-slate-500">
                  Estado: {ticket.status || "sin estado"}
                </p>
              </Card>
            ))
          ) : (
            <Empty text="Este cliente no tiene tickets abiertos." />
          )}
        </Section>

        <Section title="Pagos">
          {payments?.length ? (
            payments.map((payment) => (
              <Card key={payment.id}>
                <p className="font-medium">
                  RD$ {payment.amount || 0}
                </p>
                <p className="text-sm text-slate-500">
                  Estado: {payment.status || "sin estado"}
                </p>
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

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-xl border p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">
        {value || "-"}
      </p>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
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