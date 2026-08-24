/**
 * Git berekent de sha van een bestand over "blob <lengte>\0<inhoud>". Door die
 * hier na te rekenen kunnen de bestanden die met de app zijn meegeleverd
 * vergeleken worden met wat er in de repo staat, zonder ze opnieuw op te halen.
 */
export async function gitBlobSha(text: string): Promise<string> {
  const inhoud = new TextEncoder().encode(text);
  const kop = new TextEncoder().encode(`blob ${inhoud.length}\0`);
  const samen = new Uint8Array(kop.length + inhoud.length);
  samen.set(kop, 0);
  samen.set(inhoud, kop.length);
  const digest = await crypto.subtle.digest('SHA-1', samen);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
