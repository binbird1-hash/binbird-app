import {
  deriveAccountId,
  deriveAccountName,
  type PortalClientRow,
} from "@/lib/clientPortalAccess";
import { supabaseServer } from "@/lib/supabaseServer";

export const metadata = {
  title: "Client tokens • Admin",
};

export default async function AdminTokensPage() {
  const supabase = supabaseServer();

  const { data: tokenRows, error: tokenError } = await supabase
    .from("client_portal_tokens")
    .select("token, account_id, property_id, created_at, expires_at")
    .order("created_at", { ascending: false });

  if (tokenError) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold text-white">Client portal links</h1>
        <p className="text-sm text-red-300">Unable to load client tokens: {tokenError.message}</p>
      </div>
    );
  }

  const tokens = tokenRows ?? [];

  const accountIds = new Set<string>();
  const propertyIds = new Set<string>();

  tokens.forEach((row) => {
    const accountId = row.account_id?.trim();
    if (accountId) {
      accountIds.add(accountId);
    }
    const propertyId = row.property_id?.trim();
    if (propertyId) {
      propertyIds.add(propertyId);
    }
  });

  let clientRows: PortalClientRow[] = [];

  if (accountIds.size || propertyIds.size) {
    const filters: string[] = [];
    const escape = (value: string) => value.replace(/,/g, "\\,").replace(/'/g, "''");

    accountIds.forEach((accountId) => {
      filters.push(`account_id.eq.${escape(accountId)}`);
    });

    propertyIds.forEach((propertyId) => {
      filters.push(`property_id.eq.${escape(propertyId)}`);
    });

    const { data, error } = await supabase
      .from("client_list")
      .select("property_id, account_id, client_name, company, address, notes")
      .or(filters.join(","));

    if (!error) {
      clientRows = (data ?? []).map((row) => ({
        property_id: row.property_id,
        account_id: row.account_id,
        client_name: row.client_name,
        company: row.company,
        address: row.address,
        notes: row.notes,
      }));
    }
  }

  const clientsByProperty = new Map<string, PortalClientRow>();
  clientRows.forEach((row) => {
    if (row.property_id) {
      clientsByProperty.set(row.property_id, row);
    }
  });

  const accountsById = new Map<
    string,
    {
      id: string;
      name: string;
      properties: PortalClientRow[];
    }
  >();

  clientRows.forEach((row) => {
    const accountId = deriveAccountId(row);
    const existing = accountsById.get(accountId);
    if (existing) {
      existing.properties.push(row);
    } else {
      accountsById.set(accountId, {
        id: accountId,
        name: deriveAccountName(row),
        properties: [row],
      });
    }
  });

  const decoratedTokens = tokens.map((row) => {
    const property = row.property_id ? clientsByProperty.get(row.property_id) ?? null : null;
    const explicitAccountId = row.account_id?.trim() ?? null;
    const resolvedAccountId = explicitAccountId ?? (property ? deriveAccountId(property) : null);
    const account = resolvedAccountId ? accountsById.get(resolvedAccountId) : null;

    return {
      token: row.token,
      href: `/c/${encodeURIComponent(row.token)}`,
      accountName: property ? deriveAccountName(property) : account?.name ?? resolvedAccountId ?? "Client Account",
      scopeDescription: property
        ? property.address ?? property.client_name ?? "Property"
        : `${account?.properties.length ?? 0} properties`,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    };
  });

  decoratedTokens.sort((a, b) => a.accountName.localeCompare(b.accountName));

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-white">Client portal links</h1>
        <p className="text-sm text-slate-300">
          Share these tokens with verified contacts to give them access to their client portal.
        </p>
        <p className="text-xs text-slate-400">
          Token generation is currently read-only. Contact engineering to issue additional links.
        </p>
      </div>

      {decoratedTokens.length === 0 ? (
        <p className="text-sm text-slate-300">No client tokens found.</p>
      ) : (
        <ul className="space-y-3">
          {decoratedTokens.map((entry) => (
            <li key={entry.token} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">{entry.accountName}</p>
                  <p className="text-xs text-slate-400">{entry.scopeDescription}</p>
                </div>
                <a
                  href={entry.href}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium text-red-300 hover:text-red-200"
                >
                  Open link
                </a>
              </div>
              <div className="mt-2 text-xs text-slate-500">
                <span className="font-mono text-slate-300">{entry.href}</span>
                {entry.expiresAt && (
                  <span className="ml-3">
                    Expires {new Date(entry.expiresAt).toLocaleDateString()}
                  </span>
                )}
                {entry.createdAt && (
                  <span className="ml-3">Created {new Date(entry.createdAt).toLocaleDateString()}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
