interface IconProps {
  name: string
  className?: string
}

/** Material Symbols Outlined glyph, as used throughout the Stitch designs. */
export function Icon({ name, className = '' }: IconProps) {
  return (
    <span aria-hidden="true" className={`material-symbols-outlined ${className}`}>
      {name}
    </span>
  )
}
