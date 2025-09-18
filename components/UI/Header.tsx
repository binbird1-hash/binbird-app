export default function Header({ title }: { title: string }) {
  return (
    <header className="mb-6 text-center">
      <h1 className="text-3xl font-bold text-[var(--accent)]">{title}</h1>
    </header>
  )
}
