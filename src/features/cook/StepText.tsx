import { formatMinutes } from '../../domain/units/format';
import type { TimeMention } from '../../domain/text/timers';
import { Icon } from '../../ui/Icon';

/**
 * Zet de staptekst neer met de tijdsaanduidingen als aantikbare knop. Zo hoef
 * je niet zelf te bedenken hoe lang "een halfuur" is en waar je dat invoert:
 * je tikt op het woord dat er staat.
 */
export const StepText = ({
  text,
  mentions,
  onStart,
}: {
  text: string;
  mentions: TimeMention[];
  onStart: (mention: TimeMention) => void;
}) => {
  if (mentions.length === 0) return <>{text}</>;

  const delen: Array<{ soort: 'tekst'; waarde: string } | { soort: 'tijd'; mention: TimeMention }> =
    [];
  let cursor = 0;
  for (const mention of mentions) {
    if (mention.start > cursor) {
      delen.push({ soort: 'tekst', waarde: text.slice(cursor, mention.start) });
    }
    delen.push({ soort: 'tijd', mention });
    cursor = mention.end;
  }
  if (cursor < text.length) delen.push({ soort: 'tekst', waarde: text.slice(cursor) });

  return (
    <>
      {delen.map((deel, index) =>
        deel.soort === 'tekst' ? (
          <span key={index}>{deel.waarde}</span>
        ) : (
          <button
            key={index}
            type="button"
            onClick={() => onStart(deel.mention)}
            title={`Timer van ${formatMinutes(Math.round(deel.mention.seconds / 60))} starten`}
            className="mx-0.5 inline-flex items-baseline gap-1 rounded-lg bg-accent-soft px-1.5 py-0.5 font-semibold text-accent underline decoration-dotted underline-offset-4"
          >
            <Icon name="klok" className="h-4 w-4 self-center" />
            {deel.mention.text}
          </button>
        ),
      )}
    </>
  );
};
