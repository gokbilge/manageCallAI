import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Phone, Circle } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { DataCard } from '@/components/data/data-card';
import { apiRequest } from '@/lib/api/client';

type PresenceStatus = 'available' | 'away' | 'busy' | 'dnd' | 'offline';

type DirectoryContact = {
  extension_id: string;
  extension_number: string;
  display_name: string;
  presence_status: PresenceStatus | null;
};

const PRESENCE_LABEL: Record<PresenceStatus, string> = {
  available: 'Available',
  away: 'Away',
  busy: 'Busy',
  dnd: 'Do Not Disturb',
  offline: 'Offline',
};

const PRESENCE_COLOR: Record<PresenceStatus, string> = {
  available: 'text-[var(--color-success)]',
  away: 'text-[var(--color-warning)]',
  busy: 'text-[var(--color-danger)]',
  dnd: 'text-[var(--color-danger)]',
  offline: 'text-[var(--color-muted-fg)]',
};

function PresenceDot({ status }: { status: PresenceStatus | null }) {
  const s = status ?? 'offline';
  return (
    <Circle
      className={`size-2.5 fill-current ${PRESENCE_COLOR[s]}`}
      aria-label={PRESENCE_LABEL[s]}
    />
  );
}

async function fetchContacts(): Promise<DirectoryContact[]> {
  const res = await apiRequest<{ data: DirectoryContact[] }>('/api/v1/me/contacts');
  return res.data;
}

export function ContactsDirectoryPage() {
  const [search, setSearch] = useState('');

  const { data: contacts = [], isLoading, isError } = useQuery({
    queryKey: ['me-contacts'],
    queryFn: fetchContacts,
  });

  const filtered = contacts.filter(
    (c) =>
      c.display_name.toLowerCase().includes(search.toLowerCase()) ||
      c.extension_number.includes(search),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Self-Service"
        title="Contacts Directory"
        description="Browse internal extensions and their current availability."
      />

      <DataCard title="Internal Extensions">
        <div className="p-4">
          <div className="relative mb-4">
            <Search
              className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-muted-fg)]"
              aria-hidden="true"
            />
            <input
              type="search"
              placeholder="Search by name or extension…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] py-2 pl-9 pr-3 text-sm placeholder:text-[var(--color-muted-fg)] focus:outline-none focus:ring-2 focus:ring-[var(--color-tenant)]"
              aria-label="Search contacts"
            />
          </div>

          {isLoading && (
            <p className="py-8 text-center text-sm text-[var(--color-muted-fg)]">Loading contacts…</p>
          )}

          {isError && (
            <p className="py-8 text-center text-sm text-[var(--color-danger)]">
              Failed to load contacts. Please try again.
            </p>
          )}

          {!isLoading && !isError && filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-[var(--color-muted-fg)]">
              {search ? 'No contacts match your search.' : 'No contacts found in this directory.'}
            </p>
          )}

          {!isLoading && !isError && filtered.length > 0 && (
            <ul className="divide-y divide-[var(--color-border)]" role="list">
              {filtered.map((contact) => (
                <li
                  key={contact.extension_id}
                  className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <PresenceDot status={contact.presence_status} />
                    <div>
                      <p className="text-sm font-medium text-[var(--color-fg)]">{contact.display_name}</p>
                      <p className="text-xs text-[var(--color-muted-fg)]">
                        {contact.presence_status
                          ? PRESENCE_LABEL[contact.presence_status]
                          : 'No presence data'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pl-6 sm:pl-0">
                    <Phone className="size-3.5 text-[var(--color-muted-fg)]" aria-hidden="true" />
                    <span className="font-mono text-sm text-[var(--color-fg)]">
                      {contact.extension_number}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DataCard>
    </div>
  );
}
