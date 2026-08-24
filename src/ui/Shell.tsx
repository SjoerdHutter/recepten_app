import type { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useData } from '../state/data';
import { useLocalState } from '../state/localState';
import { useSettings } from '../state/settings';
import { Icon, type IconName } from './Icon';

const TABS: Array<{ to: string; label: string; icon: IconName }> = [
  { to: '/', label: 'Recepten', icon: 'boek' },
  { to: '/lijst', label: 'Boodschappen', icon: 'lijst' },
  { to: '/instellingen', label: 'Instellingen', icon: 'tandwiel' },
];

/** Klein en altijd zichtbaar: in welke modus zit ik en is er verbinding? */
const StatusPil = () => {
  const { canWrite, tokenState } = useSettings();
  const { online, syncing } = useData();

  const tekst = canWrite ? 'Schrijfmodus' : 'Leesmodus';
  const kleur = canWrite ? 'bg-ok-soft text-ok' : 'bg-surface-2 text-ink-2';

  return (
    <NavLink
      to="/instellingen"
      className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium ${kleur}`}
      title={
        canWrite
          ? 'Er staat een token met schrijfrechten klaar.'
          : 'Zonder token kun je lezen; recepten toevoegen gaat via GitHub.'
      }
    >
      {!canWrite ? <Icon name="slot" className="h-3.5 w-3.5" /> : null}
      {tekst}
      {tokenState === 'fout' ? <span className="text-danger">!</span> : null}
      {!online ? <Icon name="wolkUit" className="h-3.5 w-3.5" /> : null}
      {syncing ? <span className="animate-pulse">·</span> : null}
    </NavLink>
  );
};

export const Shell = ({ children }: { children: ReactNode }) => {
  const { selection } = useLocalState();
  const { pathname } = useLocation();

  return (
    <div className="min-h-dvh">
      <header className="safe-top sticky top-0 z-30 border-b border-line bg-bg/95 backdrop-blur print-hidden">
        <div className="mx-auto flex h-12 w-full max-w-2xl items-center justify-between gap-3 px-4">
          <span className="text-[15px] font-semibold tracking-tight">Recepten</span>
          <StatusPil />
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-4 pt-4 pb-28">{children}</main>

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/95 pt-1 backdrop-blur print-hidden">
        <div className="mx-auto flex w-full max-w-2xl">
          {TABS.map((tab) => {
            const actief =
              tab.to === '/'
                ? pathname === '/' || pathname.startsWith('/recept')
                : pathname === tab.to;
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={`relative flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-[11px] font-medium ${
                  actief ? 'text-accent' : 'text-ink-3'
                }`}
              >
                <Icon name={tab.icon} className="h-6 w-6" />
                {tab.label}
                {tab.to === '/lijst' && selection.length > 0 ? (
                  <span className="absolute right-[22%] top-0 min-w-5 rounded-full bg-accent px-1.5 text-[10px] leading-5 text-on-accent">
                    {selection.length}
                  </span>
                ) : null}
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
