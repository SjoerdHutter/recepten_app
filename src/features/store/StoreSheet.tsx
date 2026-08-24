import { useState } from 'react';
import { CATEGORY_LABELS } from '../../domain/schema/enums';
import { moveInOrder, normalizeOrder } from '../../domain/store/profile';
import { useLocalState } from '../../state/localState';
import { Icon } from '../../ui/Icon';
import { Sheet } from '../../ui/Sheet';
import { Button } from '../../ui/controls';

/**
 * De looproute door een winkel. Elke supermarkt is anders ingedeeld en je loopt
 * er altijd hetzelfde rondje; door die volgorde één keer goed te zetten hoef je
 * nooit meer terug te lopen voor de melk.
 *
 * Slepen werkt met een muis. Op een telefoon staan er pijltjes bij: een lijstje
 * van tien met een vinger sorteren is daar bewerkelijker dan twee tikken.
 */
export const StoreSheet = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const {
    stores,
    activeStore,
    activeStoreId,
    setActiveStore,
    addStore,
    renameStore,
    removeStore,
    setStoreOrder,
  } = useLocalState();
  const [nieuweNaam, setNieuweNaam] = useState('');
  const [sleept, setSleept] = useState<number | null>(null);

  const volgorde = normalizeOrder(activeStore.order);

  const verplaats = (van: number, naar: number) => {
    if (naar < 0 || naar >= volgorde.length) return;
    setStoreOrder(activeStore.id, moveInOrder(volgorde, van, naar));
  };

  return (
    <Sheet open={open} onClose={onClose} title="Winkel en looproute">
      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Winkel</h3>
          <div className="flex flex-wrap gap-1.5">
            {stores.map((winkel) => (
              <button
                key={winkel.id}
                type="button"
                onClick={() => setActiveStore(winkel.id)}
                aria-pressed={winkel.id === activeStoreId}
                className={`min-h-11 rounded-xl px-3.5 text-sm font-medium ${
                  winkel.id === activeStoreId
                    ? 'bg-accent text-on-accent'
                    : 'bg-surface-2 text-ink-2'
                }`}
              >
                {winkel.name}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={nieuweNaam}
              onChange={(event) => setNieuweNaam(event.target.value)}
              placeholder="Naam van een nieuwe winkel"
              className="h-12 flex-1 rounded-xl border border-line bg-surface px-3"
              aria-label="Nieuwe winkel"
            />
            <Button
              disabled={!nieuweNaam.trim()}
              onClick={() => {
                addStore(nieuweNaam);
                setNieuweNaam('');
              }}
            >
              <Icon name="plus" className="h-4 w-4" />
            </Button>
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <input
              value={activeStore.name}
              onChange={(event) => renameStore(activeStore.id, event.target.value)}
              className="h-11 flex-1 rounded-xl border border-line bg-surface px-3 font-medium"
              aria-label="Naam van deze winkel"
            />
            {stores.length > 1 ? (
              <Button variant="danger" onClick={() => removeStore(activeStore.id)}>
                <Icon name="prullenbak" className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-ink-3">
            Zet de schappen in de volgorde waarin je erlangs loopt. Je boodschappenlijst volgt die
            volgorde.
          </p>

          <ul className="flex flex-col gap-1.5">
            {volgorde.map((categorie, index) => (
              <li
                key={categorie}
                draggable
                onDragStart={() => setSleept(index)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (sleept !== null) verplaats(sleept, index);
                  setSleept(null);
                }}
                onDragEnd={() => setSleept(null)}
                className="flex min-h-12 items-center gap-2 rounded-xl border border-line bg-surface px-3"
              >
                <span className="w-6 text-center text-sm tabular-nums text-ink-3">{index + 1}</span>
                <span className="flex-1 text-[15px]">{CATEGORY_LABELS[categorie]}</span>
                <button
                  type="button"
                  onClick={() => verplaats(index, index - 1)}
                  disabled={index === 0}
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-ink-3 disabled:opacity-30"
                  aria-label={`${CATEGORY_LABELS[categorie]} omhoog`}
                >
                  <Icon name="omlaag" className="h-4 w-4 rotate-180" />
                </button>
                <button
                  type="button"
                  onClick={() => verplaats(index, index + 1)}
                  disabled={index === volgorde.length - 1}
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-ink-3 disabled:opacity-30"
                  aria-label={`${CATEGORY_LABELS[categorie]} omlaag`}
                >
                  <Icon name="omlaag" className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </section>

        <Button variant="primary" full onClick={onClose}>
          Klaar
        </Button>
      </div>
    </Sheet>
  );
};
