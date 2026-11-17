import { DRAW_COLORS } from '../hooks/useDrawings'

interface Props {
  color: string
  onColor: (c: string) => void
  canUndo: boolean
  onUndo: () => void
  onClear: () => void
  onDone: () => void
}

/** Barre d'outils du mode stylo (couleurs, annuler, effacer, terminé). */
export default function DrawToolbar({ color, onColor, canUndo, onUndo, onClear, onDone }: Props) {
  return (
    <>
      <div className="draw-hint">🔒 Carte bloquée · dessinez avec le doigt</div>
      <div className="draw-bar" role="toolbar" aria-label="Outils de dessin">
        <div className="draw-colors" role="radiogroup" aria-label="Couleur">
          {DRAW_COLORS.map((c) => (
            <button
              key={c.color}
              role="radio"
              aria-checked={c.color === color}
              aria-label={c.label}
              className={c.color === color ? 'on' : ''}
              style={{ background: c.color }}
              onClick={() => onColor(c.color)}
            />
          ))}
        </div>
        <button className="draw-tool" onClick={onUndo} disabled={!canUndo} aria-label="Annuler le dernier trait">
          ↩︎
        </button>
        <button
          className="draw-tool"
          onClick={() => {
            if (window.confirm('Effacer tous les dessins ?')) onClear()
          }}
          disabled={!canUndo}
          aria-label="Tout effacer"
        >
          🗑️
        </button>
        <button className="draw-done" onClick={onDone}>
          Terminé
        </button>
      </div>
    </>
  )
}
