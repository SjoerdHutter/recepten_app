/**
 * De service worker registreren én bijgewerkt houden.
 *
 * Dit stond eerst niet in de app: vite-plugin-pwa spuugt met de standaard-
 * instelling een regeltje uit dat de worker registreert en verder niets. Dat
 * gaat een keer mis, en het ging ook mis. `skipWaiting` en `clientsClaim` zorgen
 * er wel voor dat een nieuwe worker het overneemt, maar de pagina die op dat
 * moment draait houdt de JavaScript vast die hij al had ingeladen. Een
 * geïnstalleerde app die je nooit helemaal afsluit blijft zo op oude code
 * hangen — en oude code die nieuwe databestanden krijgt voorgeschoteld keurt ze
 * af op velden die hij nog niet kent. Dan verdwijnen er stilletjes recepten uit
 * je kookboek, en lijkt het alsof de gegevens stuk zijn.
 *
 * Daarom drie dingen: bij een wisseling van worker de pagina herladen, met de
 * regelmaat opnieuw kijken of er iets nieuws is, en een knop in de instellingen
 * om het af te dwingen.
 */

/** Eens per uur is vaak genoeg; vaker levert alleen verkeer op. */
const CONTROLE_INTERVAL = 60 * 60 * 1000;

let registratie: ServiceWorkerRegistration | null = null;

/** Kijkt of er een nieuwe versie klaarstaat. Stil: fouten zijn hier geen ramp. */
export const checkForUpdate = async (): Promise<void> => {
  try {
    await registratie?.update();
  } catch {
    /* offline of geen worker: dan de volgende keer weer */
  }
};

export const registerServiceWorker = (): void => {
  if (!('serviceWorker' in navigator)) return;

  // Bij de allereerste installatie is er nog geen worker aan het roer. Dan valt
  // er niets te vervangen en zou herladen alleen maar irritant zijn. Deze vlag
  // beweegt daarom mee: zodra de eerste worker het overneemt telt de volgende
  // wisseling wél als een update. (Een vaste vlag die bij het laden van de
  // module wordt gezet, werkt niet: die blijft na de eerste installatie voorgoed
  // op "nee" staan en dan werkt de app zichzelf in die sessie nooit meer bij.)
  let heeftController = Boolean(navigator.serviceWorker.controller);
  let herladen = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!heeftController) {
      heeftController = true;
      return;
    }
    if (herladen) return;
    herladen = true;
    // De nieuwe worker heeft het overgenomen; deze pagina draait nog op de oude
    // code. Eén keer herladen en je zit op de nieuwe versie.
    window.location.reload();
  });

  window.addEventListener('load', () => {
    const url = `${import.meta.env.BASE_URL}sw.js`;
    void navigator.serviceWorker
      .register(url, { scope: import.meta.env.BASE_URL })
      .then((nieuw) => {
        registratie = nieuw;
        window.setInterval(() => void checkForUpdate(), CONTROLE_INTERVAL);
        // Terugkomen in de app is het natuurlijke moment om te kijken: dat is
        // precies wanneer je hem weer gaat gebruiken.
        document.addEventListener('visibilitychange', () => {
          if (!document.hidden) void checkForUpdate();
        });
      })
      .catch(() => {
        // Zonder service worker werkt de app gewoon, alleen niet offline.
      });
  });
};
