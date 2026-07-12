/** Avatar do utilizador: mostra a foto se existir, senão o emoji. */

interface Props {
  avatar: string
  avatarPhoto?: string | null
  size?: number
  className?: string
}

export default function Avatar({ avatar, avatarPhoto, size = 40, className = '' }: Props) {
  const dim = { width: size, height: size }
  if (avatarPhoto) {
    const src = avatarPhoto.startsWith('data:') ? avatarPhoto : `data:image/jpeg;base64,${avatarPhoto}`
    return (
      <img
        src={src}
        alt=""
        style={dim}
        className={`shrink-0 rounded-full object-cover ${className}`}
        aria-hidden
      />
    )
  }
  return (
    <span
      style={{ ...dim, fontSize: size * 0.5 }}
      className={`flex shrink-0 items-center justify-center rounded-full bg-bg ${className}`}
      aria-hidden
    >
      {avatar}
    </span>
  )
}
